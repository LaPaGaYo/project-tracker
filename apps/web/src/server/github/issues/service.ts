import { createHash } from "node:crypto";

import type { GithubIssueState, TaskStatus, WorkflowStateRecord } from "@the-platform/shared";

import { resolveWorkspaceContext } from "../../work-management/utils";
import { WorkspaceError } from "../../workspaces/core";
import type { AppSession } from "../../workspaces/types";

import type {
  GithubIssueImportClient,
  GithubIssueLinkRecord,
  GithubIssueSyncRepository,
  GithubIssueSyncSettings,
  GithubIssueWithComments,
  ImportGithubIssuesSummary
} from "./types";

const defaultGithubIssueSyncSettings: GithubIssueSyncSettings = {
  syncEnabled: false,
  importClosedIssues: false,
  syncTitle: true,
  syncBody: true,
  syncState: true,
  closedWorkflowStateId: null,
  reopenedWorkflowStateId: null
};

function hashBaseline(value: string | null) {
  return createHash("sha256").update(value ?? "").digest("hex");
}

function statusFromGithubState(state: GithubIssueState): TaskStatus {
  return state === "closed" ? "Done" : "Todo";
}

function completedAtFromGithubIssue(issue: GithubIssueWithComments) {
  if (issue.state !== "closed") {
    return null;
  }

  return issue.githubClosedAt ?? issue.githubUpdatedAt;
}

function firstBacklogState(states: WorkflowStateRecord[]) {
  return states.find((state) => state.category === "backlog")?.id ?? null;
}

function workflowStateForUpdate(issue: GithubIssueWithComments, settings: GithubIssueSyncSettings) {
  if (issue.state === "closed") {
    return settings.closedWorkflowStateId ?? undefined;
  }

  return settings.reopenedWorkflowStateId ?? undefined;
}

function shouldSkipLinkedWorkItemUpdate(link: GithubIssueLinkRecord) {
  return !link.syncEnabled || link.syncStatus === "conflict" || link.syncStatus === "paused" || link.syncStatus === "error";
}

function hasWorkItemUpdatePatch(input: Parameters<GithubIssueSyncRepository["updateWorkItemFromGithubIssue"]>[0]) {
  return (
    input.title !== undefined ||
    input.description !== undefined ||
    input.status !== undefined ||
    input.workflowStateId !== undefined ||
    input.completedAt !== undefined
  );
}

async function upsertComments(
  repository: GithubIssueSyncRepository,
  githubIssueId: string,
  comments: GithubIssueWithComments["comments"]
) {
  for (const comment of comments) {
    await repository.upsertGithubIssueComment({
      githubIssueId,
      providerCommentId: comment.providerCommentId,
      body: comment.body,
      url: comment.url,
      authorLogin: comment.authorLogin,
      githubCreatedAt: comment.githubCreatedAt,
      githubUpdatedAt: comment.githubUpdatedAt
    });
  }
}

async function upsertSyncedLink(
  repository: GithubIssueSyncRepository,
  input: {
    link: GithubIssueLinkRecord | null;
    workItemId: string;
    repositoryId: string;
    githubIssueId: string;
    issue: GithubIssueWithComments;
    settings: GithubIssueSyncSettings;
    source: string;
    lastSyncedWorkItemUpdatedAt: string | null;
  }
) {
  await repository.upsertGithubIssueLink({
    workItemId: input.workItemId,
    repositoryId: input.repositoryId,
    githubIssueId: input.githubIssueId,
    source: input.link?.source ?? input.source,
    syncStatus: "synced",
    syncEnabled: input.link?.syncEnabled ?? input.settings.syncEnabled,
    syncTitle: input.link?.syncTitle ?? input.settings.syncTitle,
    syncBody: input.link?.syncBody ?? input.settings.syncBody,
    syncState: input.link?.syncState ?? input.settings.syncState,
    lastSyncedGithubUpdatedAt: input.issue.githubUpdatedAt,
    lastSyncedWorkItemUpdatedAt: input.lastSyncedWorkItemUpdatedAt,
    lastSyncedTitleHash: hashBaseline(input.issue.title),
    lastSyncedBodyHash: hashBaseline(input.issue.body),
    lastSyncedState: input.issue.state,
    conflictFields: null,
    errorMessage: null
  });
}

export async function importGithubIssuesForProject(
  repository: GithubIssueSyncRepository,
  session: { userId: string },
  workspaceSlug: string,
  projectKey: string,
  client: GithubIssueImportClient,
  options?: { settings?: Partial<GithubIssueSyncSettings> }
): Promise<ImportGithubIssuesSummary> {
  const { workspace } = await resolveWorkspaceContext(repository, session as AppSession, workspaceSlug, "admin");
  const project = await repository.getProjectByKey(workspace.id, projectKey);
  if (!project) {
    throw new WorkspaceError(404, "project not found.");
  }

  const connection = await repository.getProjectGithubConnection(project.id);
  if (!connection) {
    throw new WorkspaceError(409, "project GitHub connection is required before importing issues.");
  }

  const storedSettings = await repository.getGithubIssueSyncSettings(project.id);
  const settings = {
    ...defaultGithubIssueSyncSettings,
    ...(storedSettings ?? {}),
    ...(options?.settings ?? {})
  };
  const workflowStates = await repository.listWorkflowStates(project.id);
  const snapshot = await client.getRepositoryIssuesSnapshot(
    {
      owner: connection.repository.owner,
      name: connection.repository.name,
      fullName: connection.repository.fullName,
      installationId: connection.repository.installationId
    },
    { includeClosed: settings.importClosedIssues }
  );
  const issues = snapshot.issues;

  const summary: ImportGithubIssuesSummary = {
    created: 0,
    updated: 0,
    skippedPullRequests: 0,
    conflicted: 0,
    failed: 0
  };

  for (const issue of issues) {
    if (issue.isPullRequest) {
      summary.skippedPullRequests += 1;
      continue;
    }

    try {
      const projection = await repository.upsertGithubIssue({
        repositoryId: connection.repository.id,
        providerIssueId: issue.providerIssueId,
        number: issue.number,
        title: issue.title,
        body: issue.body,
        url: issue.url,
        state: issue.state,
        authorLogin: issue.authorLogin,
        githubCreatedAt: issue.githubCreatedAt,
        githubUpdatedAt: issue.githubUpdatedAt,
        githubClosedAt: issue.githubClosedAt
      });
      const link = await repository.getGithubIssueLinkByIssueId(projection.id);

      if (link) {
        if (shouldSkipLinkedWorkItemUpdate(link)) {
          if (link.syncStatus === "conflict") {
            summary.conflicted += 1;
          }
          await upsertComments(repository, projection.id, issue.comments);
          continue;
        }

        const updateInput: Parameters<GithubIssueSyncRepository["updateWorkItemFromGithubIssue"]>[0] = {
          projectId: project.id,
          workspaceId: workspace.id,
          workItemId: link.workItemId,
          actorId: session.userId
        };
        if (settings.syncTitle && link.syncTitle) {
          updateInput.title = issue.title;
        }
        if (settings.syncBody && link.syncBody) {
          updateInput.description = issue.body ?? "";
        }
        if (settings.syncState && link.syncState) {
          updateInput.status = statusFromGithubState(issue.state);
          updateInput.completedAt = completedAtFromGithubIssue(issue);
          const workflowStateId = workflowStateForUpdate(issue, settings);
          if (workflowStateId !== undefined) {
            updateInput.workflowStateId = workflowStateId;
          }
        }

        if (!hasWorkItemUpdatePatch(updateInput)) {
          await upsertComments(repository, projection.id, issue.comments);
          continue;
        }

        const updateResult = await repository.updateWorkItemFromGithubIssue(updateInput);

        if (updateResult?.changed) {
          await upsertSyncedLink(repository, {
            link,
            workItemId: link.workItemId,
            repositoryId: connection.repository.id,
            githubIssueId: projection.id,
            issue,
            settings,
            source: "initial_import",
            lastSyncedWorkItemUpdatedAt: updateResult.workItem.updatedAt
          });
          summary.updated += 1;
        } else if (!updateResult) {
          summary.failed += 1;
        }
      } else {
        const createResult = await repository.createWorkItemAndLinkGithubIssue({
          projectId: project.id,
          workspaceId: workspace.id,
          workItem: {
            title: issue.title,
            description: issue.body ?? "",
            type: "task",
            priority: "none",
            status: statusFromGithubState(issue.state),
            workflowStateId: firstBacklogState(workflowStates),
            stageId: null,
            planItemId: null,
            position: 0,
            completedAt: completedAtFromGithubIssue(issue)
          },
          link: {
            repositoryId: connection.repository.id,
            githubIssueId: projection.id,
            source: "initial_import",
            syncStatus: "synced",
            syncEnabled: settings.syncEnabled,
            syncTitle: settings.syncTitle,
            syncBody: settings.syncBody,
            syncState: settings.syncState,
            lastSyncedGithubUpdatedAt: issue.githubUpdatedAt,
            lastSyncedTitleHash: hashBaseline(issue.title),
            lastSyncedBodyHash: hashBaseline(issue.body),
            lastSyncedState: issue.state,
            conflictFields: null,
            errorMessage: null
          },
          actorId: session.userId
        });
        if (createResult.created) {
          summary.created += 1;
        }
      }

      await upsertComments(repository, projection.id, issue.comments);
    } catch {
      summary.failed += 1;
    }
  }

  return summary;
}

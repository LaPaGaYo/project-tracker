import { and, eq } from "drizzle-orm";

import {
  db,
  githubIssueComments,
  githubIssues,
  githubRepositories,
  projectGithubConnections,
  projects,
  tasks,
  workflowStates,
  workItemGithubIssueLinks
} from "@the-platform/db";
import type {
  GithubRepositoryRecord,
  ProjectGithubConnectionRecord,
  ProjectRecord,
  WorkflowStateRecord,
  WorkItemRecord
} from "@the-platform/shared";

import { insertActivityLogEntry } from "../../activity/repository";
import { createWorkspaceRepository } from "../../workspaces/repository";

import type {
  GithubIssueCommentProjectionRecord,
  GithubIssueLinkRecord,
  GithubIssueProjectionRecord,
  GithubIssueSyncRepository,
  GithubIssueSyncSettings
} from "./types";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const defaultGithubIssueSyncSettings: GithubIssueSyncSettings = {
  syncEnabled: true,
  importClosedIssues: false,
  syncTitle: true,
  syncBody: true,
  syncState: true,
  closedWorkflowStateId: null,
  reopenedWorkflowStateId: null
};

function toIso(value: Date | null) {
  return value ? value.toISOString() : null;
}

function serializeProject(row: typeof projects.$inferSelect): ProjectRecord {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    key: row.key,
    itemCounter: row.itemCounter,
    title: row.title,
    description: row.description,
    stage: row.stage,
    dueDate: toIso(row.dueDate),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

function serializeGithubRepository(row: typeof githubRepositories.$inferSelect): GithubRepositoryRecord {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    provider: row.provider,
    providerRepositoryId: row.providerRepositoryId,
    owner: row.owner,
    name: row.name,
    fullName: row.fullName,
    defaultBranch: row.defaultBranch,
    installationId: row.installationId,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

function serializeProjectGithubConnection(row: typeof projectGithubConnections.$inferSelect): ProjectGithubConnectionRecord {
  return {
    id: row.id,
    projectId: row.projectId,
    repositoryId: row.repositoryId,
    stagingEnvironmentName: row.stagingEnvironmentName,
    productionEnvironmentName: row.productionEnvironmentName,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

function serializeWorkflowState(row: typeof workflowStates.$inferSelect): WorkflowStateRecord {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    category: row.category,
    position: row.position,
    color: row.color,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

function serializeWorkItem(row: typeof tasks.$inferSelect, workspaceId: string): WorkItemRecord {
  return {
    id: row.id,
    projectId: row.projectId,
    workspaceId,
    identifier: row.identifier,
    title: row.title,
    description: row.description,
    status: row.status,
    type: row.type,
    parentId: row.parentId,
    assigneeId: row.assigneeId,
    priority: row.priority,
    labels: row.labels,
    workflowStateId: row.workflowStateId,
    stageId: row.stageId,
    planItemId: row.planItemId,
    position: row.position,
    blockedReason: row.blockedReason,
    dueDate: toIso(row.dueDate),
    completedAt: toIso(row.completedAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

function serializeGithubIssue(row: typeof githubIssues.$inferSelect): GithubIssueProjectionRecord {
  return {
    id: row.id,
    repositoryId: row.repositoryId,
    providerIssueId: row.providerIssueId,
    number: row.number,
    title: row.title,
    body: row.body,
    url: row.url,
    state: row.state,
    authorLogin: row.authorLogin,
    githubCreatedAt: row.githubCreatedAt.toISOString(),
    githubUpdatedAt: row.githubUpdatedAt.toISOString(),
    githubClosedAt: toIso(row.githubClosedAt),
    lastSyncedAt: toIso(row.lastSyncedAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

function serializeGithubIssueLink(row: typeof workItemGithubIssueLinks.$inferSelect): GithubIssueLinkRecord {
  return {
    id: row.id,
    workItemId: row.workItemId,
    repositoryId: row.repositoryId,
    githubIssueId: row.githubIssueId,
    source: row.source,
    syncStatus: row.syncStatus,
    syncEnabled: row.syncEnabled,
    syncTitle: row.syncTitle,
    syncBody: row.syncBody,
    syncState: row.syncState,
    lastSyncedGithubUpdatedAt: toIso(row.lastSyncedGithubUpdatedAt),
    lastSyncedWorkItemUpdatedAt: toIso(row.lastSyncedWorkItemUpdatedAt),
    lastSyncedTitleHash: row.lastSyncedTitleHash,
    lastSyncedBodyHash: row.lastSyncedBodyHash,
    lastSyncedState: row.lastSyncedState,
    conflictFields: row.conflictFields,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

function serializeGithubIssueComment(row: typeof githubIssueComments.$inferSelect): GithubIssueCommentProjectionRecord {
  return {
    id: row.id,
    githubIssueId: row.githubIssueId,
    providerCommentId: row.providerCommentId,
    body: row.body,
    url: row.url,
    authorLogin: row.authorLogin,
    githubCreatedAt: row.githubCreatedAt.toISOString(),
    githubUpdatedAt: row.githubUpdatedAt.toISOString(),
    githubDeletedAt: toIso(row.githubDeletedAt),
    lastSyncedAt: toIso(row.lastSyncedAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

async function createWorkItemForGithubIssueInTransaction(
  tx: Transaction,
  input: Parameters<GithubIssueSyncRepository["createWorkItemForGithubIssue"]>[0]
) {
  const [project] = await tx.select().from(projects).where(eq(projects.id, input.projectId)).limit(1).for("update");
  if (!project) {
    throw new Error("Project not found.");
  }

  const nextCounter = project.itemCounter + 1;
  const identifier = `${project.key}-${nextCounter}`;
  const [item] = await tx
    .insert(tasks)
    .values({
      projectId: input.projectId,
      title: input.title,
      description: input.description,
      status: input.status,
      type: input.type,
      parentId: null,
      assigneeId: null,
      identifier,
      priority: input.priority,
      labels: null,
      workflowStateId: input.workflowStateId,
      stageId: input.stageId,
      planItemId: input.planItemId,
      position: input.position,
      blockedReason: null,
      dueDate: null,
      completedAt: input.completedAt ? new Date(input.completedAt) : null,
      updatedAt: new Date()
    })
    .returning();

  if (!item) {
    throw new Error("Failed to create work item.");
  }

  await tx
    .update(projects)
    .set({
      itemCounter: nextCounter,
      updatedAt: new Date()
    })
    .where(eq(projects.id, input.projectId));

  await insertActivityLogEntry(tx, {
    workspaceId: input.workspaceId,
    entityType: "work_item",
    entityId: item.id,
    action: "created",
    actorId: input.actorId,
    metadata: {
      projectId: input.projectId,
      identifier,
      title: item.title,
      source: "github_issue_import"
    }
  });

  return serializeWorkItem(item, project.workspaceId);
}

export function createGithubIssueSyncRepository(): GithubIssueSyncRepository {
  const workspaceRepository = createWorkspaceRepository();

  return {
    ...workspaceRepository,

    async getProjectByKey(workspaceId, projectKey) {
      const [project] = await db
        .select()
        .from(projects)
        .where(and(eq(projects.workspaceId, workspaceId), eq(projects.key, projectKey)))
        .limit(1);

      return project ? serializeProject(project) : null;
    },

    async getProjectGithubConnection(projectId) {
      const [row] = await db
        .select({
          connection: projectGithubConnections,
          repository: githubRepositories
        })
        .from(projectGithubConnections)
        .innerJoin(githubRepositories, eq(projectGithubConnections.repositoryId, githubRepositories.id))
        .where(eq(projectGithubConnections.projectId, projectId))
        .limit(1);

      return row
        ? {
            connection: serializeProjectGithubConnection(row.connection),
            repository: serializeGithubRepository(row.repository)
          }
        : null;
    },

    async getGithubIssueSyncSettings() {
      return defaultGithubIssueSyncSettings;
    },

    async listWorkflowStates(projectId) {
      const rows = await db
        .select()
        .from(workflowStates)
        .where(eq(workflowStates.projectId, projectId))
        .orderBy(workflowStates.position, workflowStates.createdAt);

      return rows.map(serializeWorkflowState);
    },

    async createWorkItemForGithubIssue(input) {
      return db.transaction((tx) => createWorkItemForGithubIssueInTransaction(tx, input));
    },

    async updateWorkItemFromGithubIssue(input) {
      const [currentRow] = await db
        .select({
          task: tasks,
          workspaceId: projects.workspaceId
        })
        .from(tasks)
        .innerJoin(projects, eq(tasks.projectId, projects.id))
        .where(and(eq(tasks.projectId, input.projectId), eq(tasks.id, input.workItemId)))
        .limit(1);

      if (!currentRow) {
        return null;
      }

      const [updated] = await db
        .update(tasks)
        .set({
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.workflowStateId !== undefined ? { workflowStateId: input.workflowStateId } : {}),
          ...(input.completedAt !== undefined ? { completedAt: input.completedAt ? new Date(input.completedAt) : null } : {}),
          updatedAt: new Date()
        })
        .where(eq(tasks.id, input.workItemId))
        .returning();

      if (!updated) {
        return null;
      }

      await insertActivityLogEntry(db, {
        workspaceId: input.workspaceId,
        entityType: "work_item",
        entityId: input.workItemId,
        action: "updated",
        actorId: input.actorId,
        metadata: {
          projectId: input.projectId,
          source: "github_issue_import"
        }
      });

      return serializeWorkItem(updated, currentRow.workspaceId);
    },

    async upsertGithubIssue(input) {
      const now = new Date();
      const values = {
        repositoryId: input.repositoryId,
        providerIssueId: input.providerIssueId,
        number: input.number,
        title: input.title,
        body: input.body,
        url: input.url,
        state: input.state,
        authorLogin: input.authorLogin,
        githubCreatedAt: new Date(input.githubCreatedAt),
        githubUpdatedAt: new Date(input.githubUpdatedAt),
        githubClosedAt: input.githubClosedAt ? new Date(input.githubClosedAt) : null,
        lastSyncedAt: now,
        updatedAt: now
      };
      const [row] = await db
        .insert(githubIssues)
        .values(values)
        .onConflictDoUpdate({
          target: [githubIssues.repositoryId, githubIssues.providerIssueId],
          set: values
        })
        .returning();

      if (!row) {
        throw new Error("Failed to upsert GitHub issue.");
      }

      return serializeGithubIssue(row);
    },

    async getGithubIssueLinkByIssueId(githubIssueId) {
      const [row] = await db
        .select()
        .from(workItemGithubIssueLinks)
        .where(eq(workItemGithubIssueLinks.githubIssueId, githubIssueId))
        .limit(1);

      return row ? serializeGithubIssueLink(row) : null;
    },

    async upsertGithubIssueLink(input) {
      const values = {
        workItemId: input.workItemId,
        repositoryId: input.repositoryId,
        githubIssueId: input.githubIssueId,
        source: input.source,
        syncStatus: input.syncStatus,
        syncEnabled: input.syncEnabled,
        syncTitle: input.syncTitle,
        syncBody: input.syncBody,
        syncState: input.syncState,
        lastSyncedGithubUpdatedAt: input.lastSyncedGithubUpdatedAt ? new Date(input.lastSyncedGithubUpdatedAt) : null,
        lastSyncedWorkItemUpdatedAt: input.lastSyncedWorkItemUpdatedAt
          ? new Date(input.lastSyncedWorkItemUpdatedAt)
          : null,
        lastSyncedTitleHash: input.lastSyncedTitleHash,
        lastSyncedBodyHash: input.lastSyncedBodyHash,
        lastSyncedState: input.lastSyncedState,
        conflictFields: input.conflictFields,
        errorMessage: input.errorMessage,
        updatedAt: new Date()
      };
      const [row] = await db
        .insert(workItemGithubIssueLinks)
        .values(values)
        .onConflictDoUpdate({
          target: workItemGithubIssueLinks.githubIssueId,
          set: values
        })
        .returning();

      if (!row) {
        throw new Error("Failed to upsert GitHub issue link.");
      }

      return serializeGithubIssueLink(row);
    },

    async upsertGithubIssueComment(input) {
      const now = new Date();
      const values = {
        githubIssueId: input.githubIssueId,
        providerCommentId: input.providerCommentId,
        body: input.body,
        url: input.url,
        authorLogin: input.authorLogin,
        githubCreatedAt: new Date(input.githubCreatedAt),
        githubUpdatedAt: new Date(input.githubUpdatedAt),
        githubDeletedAt: null,
        lastSyncedAt: now,
        updatedAt: now
      };
      const [row] = await db
        .insert(githubIssueComments)
        .values(values)
        .onConflictDoUpdate({
          target: [githubIssueComments.githubIssueId, githubIssueComments.providerCommentId],
          set: values
        })
        .returning();

      if (!row) {
        throw new Error("Failed to upsert GitHub issue comment.");
      }

      return serializeGithubIssueComment(row);
    }
  };
}

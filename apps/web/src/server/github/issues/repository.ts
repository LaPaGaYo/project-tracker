import { createHash } from "node:crypto";

import { and, eq, sql } from "drizzle-orm";

import {
  db,
  githubIssueComments,
  githubIssues,
  githubIssueSyncOperations,
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
  GithubIssueSyncOperationRecord,
  GithubIssueSyncRepository,
  GithubIssueSyncSettings
} from "./types";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type LinkMutationDatabase = Pick<typeof db, "insert">;

const defaultGithubIssueSyncSettings: GithubIssueSyncSettings = {
  syncEnabled: false,
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

function hashBaseline(value: string | null) {
  return createHash("sha256").update(value ?? "").digest("hex");
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

function serializeGithubIssueSyncOperation(
  row: typeof githubIssueSyncOperations.$inferSelect
): GithubIssueSyncOperationRecord {
  return {
    id: row.id,
    linkId: row.linkId,
    operationKey: row.operationKey,
    operationType: row.operationType,
    status: row.status,
    requestedBy: row.requestedBy,
    requestedAt: row.requestedAt.toISOString(),
    completedAt: toIso(row.completedAt),
    githubUpdatedAtBefore: toIso(row.githubUpdatedAtBefore),
    targetFields: row.targetFields,
    errorMessage: row.errorMessage
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

async function upsertGithubIssueLinkInTransaction(
  database: LinkMutationDatabase,
  input: Parameters<GithubIssueSyncRepository["upsertGithubIssueLink"]>[0]
) {
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
    lastSyncedWorkItemUpdatedAt: input.lastSyncedWorkItemUpdatedAt ? new Date(input.lastSyncedWorkItemUpdatedAt) : null,
    lastSyncedTitleHash: input.lastSyncedTitleHash,
    lastSyncedBodyHash: input.lastSyncedBodyHash,
    lastSyncedState: input.lastSyncedState,
    conflictFields: input.conflictFields,
    errorMessage: input.errorMessage,
    updatedAt: new Date()
  };
  const [row] = await database
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

    async createWorkItemAndLinkGithubIssue(input) {
      return db.transaction(async (tx) => {
        const [lockedIssue] = await tx
          .select({ id: githubIssues.id })
          .from(githubIssues)
          .where(eq(githubIssues.id, input.link.githubIssueId))
          .limit(1)
          .for("update");

        if (!lockedIssue) {
          throw new Error("GitHub issue not found.");
        }

        const [existing] = await tx
          .select({
            link: workItemGithubIssueLinks,
            task: tasks,
            workspaceId: projects.workspaceId
          })
          .from(workItemGithubIssueLinks)
          .innerJoin(tasks, eq(workItemGithubIssueLinks.workItemId, tasks.id))
          .innerJoin(projects, eq(tasks.projectId, projects.id))
          .where(eq(workItemGithubIssueLinks.githubIssueId, input.link.githubIssueId))
          .limit(1);

        if (existing) {
          return {
            workItem: serializeWorkItem(existing.task, existing.workspaceId),
            link: serializeGithubIssueLink(existing.link),
            created: false
          };
        }

        const workItem = await createWorkItemForGithubIssueInTransaction(tx, {
          projectId: input.projectId,
          workspaceId: input.workspaceId,
          title: input.workItem.title,
          description: input.workItem.description,
          type: input.workItem.type,
          priority: input.workItem.priority,
          status: input.workItem.status,
          workflowStateId: input.workItem.workflowStateId,
          stageId: input.workItem.stageId,
          planItemId: input.workItem.planItemId,
          position: input.workItem.position,
          completedAt: input.workItem.completedAt,
          actorId: input.actorId
        });
        const link = await upsertGithubIssueLinkInTransaction(tx, {
          workItemId: workItem.id,
          repositoryId: input.link.repositoryId,
          githubIssueId: input.link.githubIssueId,
          source: input.link.source,
          syncStatus: input.link.syncStatus,
          syncEnabled: input.link.syncEnabled,
          syncTitle: input.link.syncTitle,
          syncBody: input.link.syncBody,
          syncState: input.link.syncState,
          lastSyncedGithubUpdatedAt: input.link.lastSyncedGithubUpdatedAt,
          lastSyncedWorkItemUpdatedAt: workItem.updatedAt,
          lastSyncedTitleHash: input.link.lastSyncedTitleHash,
          lastSyncedBodyHash: input.link.lastSyncedBodyHash,
          lastSyncedState: input.link.lastSyncedState,
          conflictFields: input.link.conflictFields,
          errorMessage: input.link.errorMessage
        });

        return { workItem, link, created: true };
      });
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

      const current = currentRow.task;
      const completedAt = input.completedAt !== undefined ? (input.completedAt ? new Date(input.completedAt) : null) : undefined;
      const updates = {
        ...(input.title !== undefined && input.title !== current.title ? { title: input.title } : {}),
        ...(input.description !== undefined && input.description !== current.description
          ? { description: input.description }
          : {}),
        ...(input.status !== undefined && input.status !== current.status ? { status: input.status } : {}),
        ...(input.workflowStateId !== undefined && input.workflowStateId !== current.workflowStateId
          ? { workflowStateId: input.workflowStateId }
          : {}),
        ...(completedAt !== undefined && toIso(completedAt) !== toIso(current.completedAt) ? { completedAt } : {})
      };

      if (Object.keys(updates).length === 0) {
        return {
          workItem: serializeWorkItem(current, currentRow.workspaceId),
          changed: false
        };
      }

      const [updated] = await db
        .update(tasks)
        .set({
          ...updates,
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

      return {
        workItem: serializeWorkItem(updated, currentRow.workspaceId),
        changed: true
      };
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

    async getGithubIssueLinkForWorkItem(workItemId) {
      const [row] = await db
        .select({
          link: workItemGithubIssueLinks,
          issue: githubIssues,
          repository: githubRepositories
        })
        .from(workItemGithubIssueLinks)
        .innerJoin(githubIssues, eq(workItemGithubIssueLinks.githubIssueId, githubIssues.id))
        .innerJoin(githubRepositories, eq(workItemGithubIssueLinks.repositoryId, githubRepositories.id))
        .where(eq(workItemGithubIssueLinks.workItemId, workItemId))
        .limit(1);

      return row
        ? {
            link: serializeGithubIssueLink(row.link),
            issue: serializeGithubIssue(row.issue),
            repository: serializeGithubRepository(row.repository)
          }
        : null;
    },

    async upsertGithubIssueLink(input) {
      return upsertGithubIssueLinkInTransaction(db, input);
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
    },

    async createGithubIssueSyncOperation(input) {
      const [row] = await db
        .insert(githubIssueSyncOperations)
        .values({
          linkId: input.linkId,
          operationKey: input.operationKey,
          operationType: input.operationType,
          status: input.status,
          requestedBy: input.requestedBy,
          githubUpdatedAtBefore: input.githubUpdatedAtBefore ? new Date(input.githubUpdatedAtBefore) : null,
          targetFields: input.targetFields
        })
        .onConflictDoUpdate({
          target: githubIssueSyncOperations.operationKey,
          set: {
            operationKey: sql`${githubIssueSyncOperations.operationKey}`
          }
        })
        .returning();

      if (!row) {
        throw new Error("Failed to create GitHub issue sync operation.");
      }

      return {
        ...serializeGithubIssueSyncOperation(row),
        reused: row.requestedBy !== input.requestedBy || row.status !== input.status
      };
    },

    async completeGithubIssueSyncOperation(input) {
      await db
        .update(githubIssueSyncOperations)
        .set({
          status: "succeeded",
          completedAt: new Date()
        })
        .where(eq(githubIssueSyncOperations.id, input.operationId));
    },

    async failGithubIssueSyncOperation(input) {
      await db
        .update(githubIssueSyncOperations)
        .set({
          status: "failed",
          completedAt: new Date(),
          errorMessage: input.errorMessage
        })
        .where(eq(githubIssueSyncOperations.id, input.operationId));
    },

    async markGithubIssueLinkError(input) {
      await db
        .update(workItemGithubIssueLinks)
        .set({
          syncStatus: "error",
          errorMessage: input.errorMessage,
          updatedAt: new Date()
        })
        .where(eq(workItemGithubIssueLinks.id, input.linkId));
    },

    async updateIssueProjectionFromOutbound(input) {
      const [row] = await db
        .update(githubIssues)
        .set({
          title: input.issue.title,
          body: input.issue.body,
          state: input.issue.state,
          githubUpdatedAt: new Date(input.issue.githubUpdatedAt),
          githubClosedAt: input.issue.githubClosedAt ? new Date(input.issue.githubClosedAt) : null,
          lastSyncedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(githubIssues.id, input.githubIssueId))
        .returning();

      return row ? serializeGithubIssue(row) : undefined;
    },

    async updateGithubIssueLinkBaseline(input) {
      const [row] = await db
        .update(workItemGithubIssueLinks)
        .set({
          syncStatus: "synced",
          lastSyncedGithubUpdatedAt: new Date(input.issue.githubUpdatedAt),
          lastSyncedTitleHash: hashBaseline(input.issue.title),
          lastSyncedBodyHash: hashBaseline(input.issue.body),
          lastSyncedState: input.issue.state,
          conflictFields: null,
          errorMessage: null,
          updatedAt: new Date()
        })
        .where(eq(workItemGithubIssueLinks.id, input.linkId))
        .returning();

      return row ? serializeGithubIssueLink(row) : undefined;
    }
  };
}

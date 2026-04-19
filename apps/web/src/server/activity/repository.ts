import { and, desc, eq } from "drizzle-orm";

import { activityLog, db, projects, tasks } from "@the-platform/db";
import type { ActivityLogRecord, ProjectRecord, WorkItemRecord } from "@the-platform/shared";

import { createWorkspaceRepository } from "../workspaces/repository.ts";

import type { ActivityFeedOptions, ActivityRepository } from "./types.ts";

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
    position: row.position,
    blockedReason: row.blockedReason,
    dueDate: toIso(row.dueDate),
    completedAt: toIso(row.completedAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

function serializeActivity(row: typeof activityLog.$inferSelect): ActivityLogRecord {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    entityType: row.entityType as ActivityLogRecord["entityType"],
    entityId: row.entityId,
    action: row.action as ActivityLogRecord["action"],
    actorId: row.actorId,
    metadata: row.metadata ?? null,
    createdAt: row.createdAt.toISOString()
  };
}

export interface ActivityMutationInput {
  workspaceId: string;
  entityType: ActivityLogRecord["entityType"];
  entityId: string;
  action: ActivityLogRecord["action"];
  actorId: string;
  metadata?: Record<string, unknown> | null;
}

type ActivityInsertDatabase = Pick<typeof db, "insert">;

export async function insertActivityLogEntry(database: ActivityInsertDatabase, input: ActivityMutationInput) {
  const [entry] = await database
    .insert(activityLog)
    .values({
      workspaceId: input.workspaceId,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      actorId: input.actorId,
      metadata: input.metadata ?? null
    })
    .returning();

  if (!entry) {
    throw new Error("Failed to create activity log entry.");
  }

  return serializeActivity(entry);
}

function applyLimit(rows: ActivityLogRecord[], options?: ActivityFeedOptions) {
  return rows.slice(0, options?.limit ?? 50);
}

export function createActivityRepository(): ActivityRepository {
  const workspaceRepository = createWorkspaceRepository();

  return {
    ...workspaceRepository,

    async getProjectByKey(workspaceId, projectKey) {
      const [project] = await db
        .select()
        .from(projects)
        .where(and(eq(projects.workspaceId, workspaceId), eq(projects.key, projectKey)))
        .orderBy(desc(projects.updatedAt));

      return project ? serializeProject(project) : null;
    },

    async getWorkItemByIdentifier(projectId, identifier) {
      const [row] = await db
        .select({
          task: tasks,
          workspaceId: projects.workspaceId
        })
        .from(tasks)
        .innerJoin(projects, eq(tasks.projectId, projects.id))
        .where(and(eq(tasks.projectId, projectId), eq(tasks.identifier, identifier)))
        .orderBy(desc(tasks.createdAt));

      if (!row) {
        return null;
      }

      return serializeWorkItem(row.task, row.workspaceId);
    },

    async listProjectActivity(workspaceId, projectId, options) {
      const rows = await db
        .select()
        .from(activityLog)
        .where(eq(activityLog.workspaceId, workspaceId))
        .orderBy(desc(activityLog.createdAt));

      const filtered = rows
        .map(serializeActivity)
        .filter((entry) => entry.entityId === projectId || entry.metadata?.projectId === projectId);

      return applyLimit(filtered, options);
    },

    async listWorkItemActivity(workspaceId, workItemId, options) {
      const rows = await db
        .select()
        .from(activityLog)
        .where(eq(activityLog.workspaceId, workspaceId))
        .orderBy(desc(activityLog.createdAt));

      const filtered = rows
        .map(serializeActivity)
        .filter((entry) => entry.entityId === workItemId);

      return applyLimit(filtered, options);
    }
  };
}

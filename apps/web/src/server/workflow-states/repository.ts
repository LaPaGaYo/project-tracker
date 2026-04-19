import { and, eq, max } from "drizzle-orm";

import { db, projects, tasks, workflowStates } from "@the-platform/db";
import type { ProjectRecord, WorkflowStateRecord } from "@the-platform/shared";

import { insertActivityLogEntry } from "../activity/repository.ts";
import { createWorkspaceRepository } from "../workspaces/repository.ts";

import type { WorkflowStateRepository } from "./types.ts";

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

export function createWorkflowStateRepository(): WorkflowStateRepository {
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

    async listWorkflowStates(projectId) {
      const rows = await db
        .select()
        .from(workflowStates)
        .where(eq(workflowStates.projectId, projectId))
        .orderBy(workflowStates.position, workflowStates.createdAt);

      return rows.map(serializeWorkflowState);
    },

    async getWorkflowState(projectId, stateId) {
      const [state] = await db
        .select()
        .from(workflowStates)
        .where(and(eq(workflowStates.projectId, projectId), eq(workflowStates.id, stateId)))
        .limit(1);

      return state ? serializeWorkflowState(state) : null;
    },

    async createWorkflowState(input) {
      return db.transaction(async (tx) => {
        const [positionRow] = await tx
          .select({
            position: max(workflowStates.position)
          })
          .from(workflowStates)
          .where(eq(workflowStates.projectId, input.projectId));

        const [state] = await tx
          .insert(workflowStates)
          .values({
            projectId: input.projectId,
            name: input.name,
            category: input.category,
            color: input.color,
            position: input.position ?? (positionRow?.position ?? -1) + 1,
            updatedAt: new Date()
          })
          .returning();

        if (!state) {
          throw new Error("Failed to create workflow state.");
        }

        await tx
          .update(projects)
          .set({
            updatedAt: new Date()
          })
          .where(eq(projects.id, input.projectId));

        await insertActivityLogEntry(tx, {
          workspaceId: input.workspaceId,
          entityType: "workflow_state",
          entityId: state.id,
          action: "created",
          actorId: input.actorId,
          metadata: {
            projectId: input.projectId,
            stateId: state.id,
            name: state.name
          }
        });

        return serializeWorkflowState(state);
      });
    },

    async updateWorkflowState(projectId, stateId, input) {
      return db.transaction(async (tx) => {
        const [current] = await tx
          .select()
          .from(workflowStates)
          .where(and(eq(workflowStates.projectId, projectId), eq(workflowStates.id, stateId)))
          .limit(1);

        if (!current) {
          return null;
        }

        const [updated] = await tx
          .update(workflowStates)
          .set({
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.category !== undefined ? { category: input.category } : {}),
            ...(input.color !== undefined ? { color: input.color } : {}),
            ...(input.position !== undefined ? { position: input.position } : {}),
            updatedAt: new Date()
          })
          .where(eq(workflowStates.id, stateId))
          .returning();

        if (!updated) {
          return null;
        }

        await tx
          .update(projects)
          .set({
            updatedAt: new Date()
          })
          .where(eq(projects.id, projectId));

        await insertActivityLogEntry(tx, {
          workspaceId: input.workspaceId,
          entityType: "workflow_state",
          entityId: stateId,
          action: "updated",
          actorId: input.actorId,
          metadata: {
            projectId,
            before: {
              name: current.name,
              category: current.category,
              color: current.color,
              position: current.position
            },
            after: {
              name: updated.name,
              category: updated.category,
              color: updated.color,
              position: updated.position
            }
          }
        });

        return serializeWorkflowState(updated);
      });
    },

    async deleteWorkflowState(projectId, stateId, workspaceId, actorId) {
      return db.transaction(async (tx) => {
        const [state] = await tx
          .select()
          .from(workflowStates)
          .where(and(eq(workflowStates.projectId, projectId), eq(workflowStates.id, stateId)))
          .limit(1);

        if (!state) {
          return "not_found";
        }

        const workItems = await tx
          .select({
            id: tasks.id
          })
          .from(tasks)
          .where(and(eq(tasks.projectId, projectId), eq(tasks.workflowStateId, stateId)))
          .limit(1);

        if (workItems.length > 0) {
          return "has_items";
        }

        await insertActivityLogEntry(tx, {
          workspaceId,
          entityType: "workflow_state",
          entityId: stateId,
          action: "deleted",
          actorId,
          metadata: {
            projectId,
            name: state.name
          }
        });

        await tx.delete(workflowStates).where(eq(workflowStates.id, stateId));
        await tx
          .update(projects)
          .set({
            updatedAt: new Date()
          })
          .where(eq(projects.id, projectId));

        return "deleted";
      });
    }
  };
}

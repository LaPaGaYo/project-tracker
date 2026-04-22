import { and, desc, eq, inArray } from "drizzle-orm";

import { activityLog, db, descriptionVersions, projects, tasks, workflowStates } from "@the-platform/db";
import type {
  DescriptionVersionRecord,
  ProjectRecord,
  WorkflowStateRecord,
  WorkItemRecord
} from "@the-platform/shared";

import { insertActivityLogEntry } from "../activity/repository";
import { createWorkspaceRepository } from "../workspaces/repository";

import type { WorkItemRepository } from "./types";

const priorityRank: Record<WorkItemRecord["priority"], number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
  urgent: 4
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

function serializeDescriptionVersion(row: typeof descriptionVersions.$inferSelect): DescriptionVersionRecord {
  return {
    id: row.id,
    workItemId: row.workItemId,
    content: row.content,
    authorId: row.authorId,
    createdAt: row.createdAt.toISOString()
  };
}

function compareWorkItems(
  left: WorkItemRecord,
  right: WorkItemRecord,
  field: "position" | "identifier" | "priority" | "created_at",
  order: "asc" | "desc"
) {
  const direction = order === "desc" ? -1 : 1;

  if (field === "identifier") {
    return left.identifier!.localeCompare(right.identifier!, undefined, {
      numeric: true,
      sensitivity: "base"
    }) * direction;
  }

  if (field === "priority") {
    return (priorityRank[left.priority] - priorityRank[right.priority]) * direction;
  }

  if (field === "created_at") {
    return (new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()) * direction;
  }

  const positionDelta = left.position - right.position;
  if (positionDelta !== 0) {
    return positionDelta * direction;
  }

  return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
}

export function createWorkItemRepository(): WorkItemRepository {
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

    async getWorkItemById(projectId, workItemId) {
      const [row] = await db
        .select({
          task: tasks,
          workspaceId: projects.workspaceId
        })
        .from(tasks)
        .innerJoin(projects, eq(tasks.projectId, projects.id))
        .where(and(eq(tasks.projectId, projectId), eq(tasks.id, workItemId)))
        .limit(1);

      return row ? serializeWorkItem(row.task, row.workspaceId) : null;
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
        .limit(1);

      return row ? serializeWorkItem(row.task, row.workspaceId) : null;
    },

    async createWorkItem(input) {
      return db.transaction(async (tx) => {
        const [project] = await tx
          .select()
          .from(projects)
          .where(eq(projects.id, input.projectId))
          .limit(1)
          .for("update");

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
            parentId: input.parentId,
            assigneeId: input.assigneeId,
            identifier,
            priority: input.priority,
            labels: input.labels,
            workflowStateId: input.workflowStateId,
            position: input.position,
            blockedReason: input.blockedReason,
            dueDate: input.dueDate ? new Date(input.dueDate) : null,
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
            title: item.title
          }
        });

        return serializeWorkItem(item, project.workspaceId);
      });
    },

    async listWorkItems(projectId, filters) {
      const rows = await db
        .select({
          task: tasks,
          workspaceId: projects.workspaceId
        })
        .from(tasks)
        .innerJoin(projects, eq(tasks.projectId, projects.id))
        .where(eq(tasks.projectId, projectId))
        .orderBy(tasks.position, desc(tasks.createdAt));

      const items = rows
        .map((row) => serializeWorkItem(row.task, row.workspaceId))
        .filter((item) => {
          if (filters?.types?.length && !filters.types.includes(item.type)) {
            return false;
          }

          if (filters?.priorities?.length && !filters.priorities.includes(item.priority)) {
            return false;
          }

          if (filters?.workflowStateIds?.length && !filters.workflowStateIds.includes(item.workflowStateId ?? "")) {
            return false;
          }

          if (filters?.assigneeId && item.assigneeId !== filters.assigneeId) {
            return false;
          }

          return true;
        });

      const field = filters?.sort?.field ?? "position";
      const order = filters?.sort?.order ?? "asc";

      return items.sort((left, right) => compareWorkItems(left, right, field, order));
    },

    async updateWorkItem(projectId, identifier, input) {
      return db.transaction(async (tx) => {
        const [currentRow] = await tx
          .select({
            task: tasks,
            workspaceId: projects.workspaceId
          })
          .from(tasks)
          .innerJoin(projects, eq(tasks.projectId, projects.id))
          .where(and(eq(tasks.projectId, projectId), eq(tasks.identifier, identifier)))
          .limit(1);

        if (!currentRow) {
          return null;
        }

        const current = currentRow.task;

        if (input.description !== undefined && input.description !== current.description) {
          await tx.insert(descriptionVersions).values({
            workItemId: current.id,
            content: current.description,
            authorId: input.actorId
          });
        }

        const [updated] = await tx
          .update(tasks)
          .set({
            ...(input.title !== undefined ? { title: input.title } : {}),
            ...(input.description !== undefined ? { description: input.description } : {}),
            ...(input.type !== undefined ? { type: input.type } : {}),
            ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
            ...(input.assigneeId !== undefined ? { assigneeId: input.assigneeId } : {}),
            ...(input.priority !== undefined ? { priority: input.priority } : {}),
            ...(input.labels !== undefined ? { labels: input.labels } : {}),
            ...(input.workflowStateId !== undefined ? { workflowStateId: input.workflowStateId } : {}),
            ...(input.dueDate !== undefined ? { dueDate: input.dueDate ? new Date(input.dueDate) : null } : {}),
            ...(input.blockedReason !== undefined ? { blockedReason: input.blockedReason } : {}),
            ...(input.position !== undefined ? { position: input.position } : {}),
            ...(input.status !== undefined ? { status: input.status } : {}),
            updatedAt: new Date()
          })
          .where(eq(tasks.id, current.id))
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

        if (input.assigneeId !== undefined && input.assigneeId !== current.assigneeId) {
          await insertActivityLogEntry(tx, {
            workspaceId: input.workspaceId,
            entityType: "work_item",
            entityId: current.id,
            action: "assigned",
            actorId: input.actorId,
            metadata: {
              projectId,
              before: current.assigneeId,
              after: input.assigneeId
            }
          });
        }

        if (input.workflowStateId !== undefined && input.workflowStateId !== current.workflowStateId) {
          await insertActivityLogEntry(tx, {
            workspaceId: input.workspaceId,
            entityType: "work_item",
            entityId: current.id,
            action: "state_changed",
            actorId: input.actorId,
            metadata: {
              projectId,
              before: current.workflowStateId,
              after: input.workflowStateId
            }
          });
        }

        if (input.position !== undefined && input.position !== current.position) {
          await insertActivityLogEntry(tx, {
            workspaceId: input.workspaceId,
            entityType: "work_item",
            entityId: current.id,
            action: "moved",
            actorId: input.actorId,
            metadata: {
              projectId,
              before: current.position,
              after: input.position
            }
          });
        }

        const needsUpdatedLog =
          input.title !== undefined ||
          input.description !== undefined ||
          input.type !== undefined ||
          input.parentId !== undefined ||
          input.priority !== undefined ||
          input.labels !== undefined ||
          input.dueDate !== undefined ||
          input.blockedReason !== undefined;

        if (needsUpdatedLog) {
          await insertActivityLogEntry(tx, {
            workspaceId: input.workspaceId,
            entityType: "work_item",
            entityId: current.id,
            action: "updated",
            actorId: input.actorId,
            metadata: {
              projectId,
              identifier,
              before: {
                title: current.title,
                description: current.description,
                type: current.type,
                parentId: current.parentId,
                priority: current.priority,
                labels: current.labels,
                dueDate: toIso(current.dueDate),
                blockedReason: current.blockedReason
              },
              after: {
                title: updated.title,
                description: updated.description,
                type: updated.type,
                parentId: updated.parentId,
                priority: updated.priority,
                labels: updated.labels,
                dueDate: toIso(updated.dueDate),
                blockedReason: updated.blockedReason
              }
            }
          });
        }

        return serializeWorkItem(updated, currentRow.workspaceId);
      });
    },

    async moveWorkItem(projectId, identifier, input) {
      return this.moveWorkItems(projectId, identifier, {
        updates: [
          {
            identifier,
            position: input.position,
            ...(input.workflowStateId !== undefined ? { workflowStateId: input.workflowStateId } : {}),
            ...(input.status !== undefined ? { status: input.status } : {})
          }
        ],
        workspaceId: input.workspaceId,
        actorId: input.actorId
      });
    },

    async moveWorkItems(projectId, identifier, input) {
      return db.transaction(async (tx) => {
        const rows = await tx
          .select({
            task: tasks,
            workspaceId: projects.workspaceId
          })
          .from(tasks)
          .innerJoin(projects, eq(tasks.projectId, projects.id))
          .where(and(eq(tasks.projectId, projectId), inArray(tasks.identifier, input.updates.map((update) => update.identifier))))
          .for("update");

        if (rows.length !== input.updates.length) {
          return null;
        }

        const rowsByIdentifier = new Map(rows.map((row) => [row.task.identifier, row]));
        const updatedByIdentifier = new Map<string, typeof tasks.$inferSelect>();

        for (const update of input.updates) {
          const currentRow = rowsByIdentifier.get(update.identifier);
          if (!currentRow) {
            return null;
          }

          const current = currentRow.task;
          const nextWorkflowStateId =
            update.workflowStateId !== undefined ? update.workflowStateId : current.workflowStateId;
          const nextStatus = update.status ?? current.status;

          const [updated] = await tx
            .update(tasks)
            .set({
              position: update.position,
              workflowStateId: nextWorkflowStateId,
              status: nextStatus,
              updatedAt: new Date()
            })
            .where(eq(tasks.id, current.id))
            .returning();

          if (!updated) {
            return null;
          }

          updatedByIdentifier.set(update.identifier, updated);

          if (nextWorkflowStateId !== current.workflowStateId) {
            await insertActivityLogEntry(tx, {
              workspaceId: input.workspaceId,
              entityType: "work_item",
              entityId: current.id,
              action: "state_changed",
              actorId: input.actorId,
              metadata: {
                projectId,
                before: current.workflowStateId,
                after: nextWorkflowStateId
              }
            });
          }

          if (update.position !== current.position) {
            await insertActivityLogEntry(tx, {
              workspaceId: input.workspaceId,
              entityType: "work_item",
              entityId: current.id,
              action: "moved",
              actorId: input.actorId,
              metadata: {
                projectId,
                before: current.position,
                after: update.position
              }
            });
          }
        }

        await tx
          .update(projects)
          .set({
            updatedAt: new Date()
          })
          .where(eq(projects.id, projectId));

        const primaryRow = rowsByIdentifier.get(identifier);
        const primaryUpdated = updatedByIdentifier.get(identifier);
        if (!primaryRow || !primaryUpdated) {
          return null;
        }

        return serializeWorkItem(primaryUpdated, primaryRow.workspaceId);
      });
    },

    async deleteWorkItem(projectId, identifier, workspaceId, actorId) {
      return db.transaction(async (tx) => {
        const [current] = await tx
          .select()
          .from(tasks)
          .where(and(eq(tasks.projectId, projectId), eq(tasks.identifier, identifier)))
          .limit(1);

        if (!current) {
          return false;
        }

        await insertActivityLogEntry(tx, {
          workspaceId,
          entityType: "work_item",
          entityId: current.id,
          action: "deleted",
          actorId,
          metadata: {
            projectId,
            identifier,
            title: current.title
          }
        });

        const deleted = await tx.delete(tasks).where(eq(tasks.id, current.id)).returning({
          id: tasks.id
        });

        await tx
          .update(projects)
          .set({
            updatedAt: new Date()
          })
          .where(eq(projects.id, projectId));

        return deleted.length > 0;
      });
    },

    async getWorkItemCreatorId(workItemId) {
      const [entry] = await db
        .select({
          actorId: activityLog.actorId
        })
        .from(activityLog)
        .where(and(eq(activityLog.entityId, workItemId), eq(activityLog.action, "created")))
        .orderBy(activityLog.createdAt)
        .limit(1);

      return entry?.actorId ?? null;
    },

    async listDescriptionVersions(workItemId) {
      const rows = await db
        .select()
        .from(descriptionVersions)
        .where(eq(descriptionVersions.workItemId, workItemId))
        .orderBy(desc(descriptionVersions.createdAt));

      return rows.map(serializeDescriptionVersion);
    }
  };
}

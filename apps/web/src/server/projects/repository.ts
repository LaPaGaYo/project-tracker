import { and, desc, eq } from "drizzle-orm";

import { db, projects, tasks, workflowStates } from "@the-platform/db";
import type { ProjectRecord, WorkflowStateRecord } from "@the-platform/shared";

import { insertActivityLogEntry } from "../activity/repository";
import { createWorkspaceRepository } from "../workspaces/repository";

import type { ProjectRepository, ProjectWithCounts } from "./types";

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

const defaultWorkflowStateTemplates: Array<{
  name: string;
  category: WorkflowStateRecord["category"];
  position: number;
  color: string | null;
}> = [
  { name: "Backlog", category: "backlog", position: 0, color: "#64748b" },
  { name: "Todo", category: "active", position: 1, color: "#2563eb" },
  { name: "In Progress", category: "active", position: 2, color: "#f97316" },
  { name: "Done", category: "done", position: 3, color: "#16a34a" }
];

function getEmptyCounts(project: ProjectRecord): ProjectWithCounts {
  return {
    ...project,
    workItemCount: 0,
    backlogItemCount: 0,
    activeItemCount: 0,
    doneItemCount: 0
  };
}

export function createProjectRepository(): ProjectRepository {
  const workspaceRepository = createWorkspaceRepository();

  return {
    ...workspaceRepository,

    async createProject(input) {
      return db.transaction(async (tx) => {
        const [project] = await tx
          .insert(projects)
          .values({
            workspaceId: input.workspaceId,
            key: input.key,
            itemCounter: 0,
            title: input.title,
            description: input.description,
            stage: input.stage,
            dueDate: input.dueDate ? new Date(input.dueDate) : null,
            updatedAt: new Date()
          })
          .returning();

        if (!project) {
          throw new Error("Failed to create project.");
        }

        await tx.insert(workflowStates).values(
          defaultWorkflowStateTemplates.map((state) => ({
            projectId: project.id,
            name: state.name,
            category: state.category,
            position: state.position,
            color: state.color,
            updatedAt: new Date()
          }))
        );

        await insertActivityLogEntry(tx, {
          workspaceId: input.workspaceId,
          entityType: "project",
          entityId: project.id,
          action: "created",
          actorId: input.actorId,
          metadata: {
            projectId: project.id,
            key: project.key,
            title: project.title
          }
        });

        return serializeProject(project);
      });
    },

    async listProjects(workspaceId) {
      const projectRows = await db
        .select()
        .from(projects)
        .where(eq(projects.workspaceId, workspaceId))
        .orderBy(desc(projects.updatedAt));

      const taskRows = await db
        .select({
          projectId: tasks.projectId,
          status: tasks.status
        })
        .from(tasks)
        .innerJoin(projects, eq(tasks.projectId, projects.id))
        .where(eq(projects.workspaceId, workspaceId));

      const counts = new Map<string, ProjectWithCounts>();

      for (const row of projectRows) {
        counts.set(row.id, getEmptyCounts(serializeProject(row)));
      }

      for (const row of taskRows) {
        const project = counts.get(row.projectId);
        if (!project) {
          continue;
        }

        project.workItemCount += 1;

        if (row.status === "Done") {
          project.doneItemCount += 1;
        } else if (row.status === "Doing" || row.status === "Blocked") {
          project.activeItemCount += 1;
        } else {
          project.backlogItemCount += 1;
        }
      }

      return projectRows.map((row) => counts.get(row.id) ?? getEmptyCounts(serializeProject(row)));
    },

    async getProjectByKey(workspaceId, projectKey) {
      const [project] = await db
        .select()
        .from(projects)
        .where(and(eq(projects.workspaceId, workspaceId), eq(projects.key, projectKey)))
        .limit(1);

      return project ? serializeProject(project) : null;
    },

    async updateProject(projectId, input) {
      return db.transaction(async (tx) => {
        const [current] = await tx.select().from(projects).where(eq(projects.id, projectId)).limit(1);

        if (!current) {
          return null;
        }

        const [updated] = await tx
          .update(projects)
          .set({
            ...(input.title !== undefined ? { title: input.title } : {}),
            ...(input.description !== undefined ? { description: input.description } : {}),
            ...(input.stage !== undefined ? { stage: input.stage } : {}),
            ...(input.dueDate !== undefined ? { dueDate: input.dueDate ? new Date(input.dueDate) : null } : {}),
            updatedAt: new Date()
          })
          .where(eq(projects.id, projectId))
          .returning();

        if (!updated) {
          return null;
        }

        await insertActivityLogEntry(tx, {
          workspaceId: input.workspaceId,
          entityType: "project",
          entityId: projectId,
          action: "updated",
          actorId: input.actorId,
          metadata: {
            projectId,
            before: {
              title: current.title,
              description: current.description,
              stage: current.stage,
              dueDate: toIso(current.dueDate)
            },
            after: {
              title: updated.title,
              description: updated.description,
              stage: updated.stage,
              dueDate: toIso(updated.dueDate)
            }
          }
        });

        return serializeProject(updated);
      });
    },

    async deleteProject(projectId, workspaceId, actorId) {
      return db.transaction(async (tx) => {
        const [project] = await tx.select().from(projects).where(eq(projects.id, projectId)).limit(1);
        if (!project) {
          return false;
        }

        await insertActivityLogEntry(tx, {
          workspaceId,
          entityType: "project",
          entityId: projectId,
          action: "deleted",
          actorId,
          metadata: {
            projectId,
            key: project.key,
            title: project.title
          }
        });

        const deleted = await tx.delete(projects).where(eq(projects.id, projectId)).returning({
          id: projects.id
        });

        return deleted.length > 0;
      });
    },

    async listWorkflowStates(projectId) {
      const rows = await db
        .select()
        .from(workflowStates)
        .where(eq(workflowStates.projectId, projectId))
        .orderBy(workflowStates.position, workflowStates.createdAt);

      return rows.map(serializeWorkflowState);
    }
  };
}

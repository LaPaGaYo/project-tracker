import { and, asc, eq, isNull } from "drizzle-orm";

import { comments, db, projects, tasks } from "@the-platform/db";
import type { CommentRecord, ProjectRecord, WorkItemRecord } from "@the-platform/shared";

import { insertActivityLogEntry } from "../activity/repository";
import { createWorkspaceRepository } from "../workspaces/repository";

import type { CommentRepository } from "./types";

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

function serializeComment(row: typeof comments.$inferSelect): CommentRecord {
  return {
    id: row.id,
    workItemId: row.workItemId,
    authorId: row.authorId,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: toIso(row.deletedAt)
  };
}

export function createCommentRepository(): CommentRepository {
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

    async getCommentById(commentId) {
      const [row] = await db.select().from(comments).where(eq(comments.id, commentId)).limit(1);
      return row ? serializeComment(row) : null;
    },

    async createComment(input) {
      return db.transaction(async (tx) => {
        const [comment] = await tx
          .insert(comments)
          .values({
            workItemId: input.workItemId,
            authorId: input.authorId,
            content: input.content,
            updatedAt: new Date()
          })
          .returning();

        if (!comment) {
          throw new Error("Failed to create comment.");
        }

        await insertActivityLogEntry(tx, {
          workspaceId: input.workspaceId,
          entityType: "work_item",
          entityId: input.workItemId,
          action: "created",
          actorId: input.authorId,
          metadata: {
            projectId: input.projectId,
            target: "comment",
            commentId: comment.id
          }
        });

        return serializeComment(comment);
      });
    },

    async updateComment(input) {
      return db.transaction(async (tx) => {
        const [current] = await tx
          .select()
          .from(comments)
          .where(eq(comments.id, input.commentId))
          .limit(1)
          .for("update");

        if (!current || current.deletedAt) {
          return null;
        }

        const [comment] = await tx
          .update(comments)
          .set({
            content: input.content,
            updatedAt: new Date()
          })
          .where(eq(comments.id, input.commentId))
          .returning();

        if (!comment) {
          return null;
        }

        await insertActivityLogEntry(tx, {
          workspaceId: input.workspaceId,
          entityType: "work_item",
          entityId: input.workItemId,
          action: "updated",
          actorId: input.actorId,
          metadata: {
            projectId: input.projectId,
            target: "comment",
            commentId: comment.id
          }
        });

        return serializeComment(comment);
      });
    },

    async deleteComment(input) {
      return db.transaction(async (tx) => {
        const [current] = await tx
          .select()
          .from(comments)
          .where(eq(comments.id, input.commentId))
          .limit(1)
          .for("update");

        if (!current || current.deletedAt) {
          return false;
        }

        const deleted = await tx
          .update(comments)
          .set({
            deletedAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(comments.id, input.commentId))
          .returning({
            id: comments.id
          });

        if (deleted.length === 0) {
          return false;
        }

        await insertActivityLogEntry(tx, {
          workspaceId: input.workspaceId,
          entityType: "work_item",
          entityId: input.workItemId,
          action: "deleted",
          actorId: input.actorId,
          metadata: {
            projectId: input.projectId,
            target: "comment",
            commentId: input.commentId
          }
        });

        return true;
      });
    },

    async listComments(workItemId) {
      const rows = await db
        .select()
        .from(comments)
        .where(and(eq(comments.workItemId, workItemId), isNull(comments.deletedAt)))
        .orderBy(asc(comments.createdAt));

      return rows.map(serializeComment);
    }
  };
}

import { and, desc, eq, inArray, isNull } from "drizzle-orm";

import {
  activityLog,
  comments,
  db,
  notificationEvents,
  notificationPreferences,
  notificationRecipients,
  projects,
  tasks,
  workspaces
} from "@the-platform/db";
import type {
  NotificationEventRecord,
  NotificationInboxItem,
  NotificationPreferenceRecord,
  NotificationRecipientRecord
} from "@the-platform/shared";

import { createWorkspaceRepository } from "../workspaces/repository";

import type {
  CreateNotificationEventInput,
  NotificationPreferenceUpdateInput,
  NotificationRecipientInput,
  NotificationRepository
} from "./types";

function toIso(value: Date | null) {
  return value ? value.toISOString() : null;
}

function serializeNotificationEvent(row: typeof notificationEvents.$inferSelect): NotificationEventRecord {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    projectId: row.projectId,
    workItemId: row.workItemId,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    eventType: row.eventType,
    actorId: row.actorId,
    priority: row.priority,
    title: row.title,
    body: row.body,
    url: row.url,
    metadata: row.metadata,
    createdAt: row.createdAt.toISOString()
  };
}

function serializeNotificationRecipient(
  row: typeof notificationRecipients.$inferSelect
): NotificationRecipientRecord {
  return {
    id: row.id,
    eventId: row.eventId,
    workspaceId: row.workspaceId,
    recipientId: row.recipientId,
    reason: row.reason,
    readAt: toIso(row.readAt),
    dismissedAt: toIso(row.dismissedAt),
    createdAt: row.createdAt.toISOString()
  };
}

function serializeNotificationPreference(
  row: typeof notificationPreferences.$inferSelect
): NotificationPreferenceRecord {
  return {
    workspaceId: row.workspaceId,
    userId: row.userId,
    commentsEnabled: row.commentsEnabled,
    mentionsEnabled: row.mentionsEnabled,
    assignmentsEnabled: row.assignmentsEnabled,
    githubEnabled: row.githubEnabled,
    stateChangesEnabled: row.stateChangesEnabled,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

function preferenceUpdateSet(updates: NotificationPreferenceUpdateInput) {
  return {
    ...(updates.commentsEnabled !== undefined ? { commentsEnabled: updates.commentsEnabled } : {}),
    ...(updates.mentionsEnabled !== undefined ? { mentionsEnabled: updates.mentionsEnabled } : {}),
    ...(updates.assignmentsEnabled !== undefined ? { assignmentsEnabled: updates.assignmentsEnabled } : {}),
    ...(updates.githubEnabled !== undefined ? { githubEnabled: updates.githubEnabled } : {}),
    ...(updates.stateChangesEnabled !== undefined ? { stateChangesEnabled: updates.stateChangesEnabled } : {}),
    updatedAt: new Date()
  };
}

function uniqueRecipientInputs(recipients: NotificationRecipientInput[]) {
  const seen = new Set<string>();

  return recipients.filter((recipient) => {
    const key = `${recipient.recipientId}:${recipient.reason}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export function createNotificationRepository(): NotificationRepository {
  const workspaceRepository = createWorkspaceRepository();

  return {
    ...workspaceRepository,

    async upsertNotificationEvent(input: CreateNotificationEventInput) {
      const [event] = await db
        .insert(notificationEvents)
        .values({
          workspaceId: input.workspaceId,
          projectId: input.projectId ?? null,
          workItemId: input.workItemId ?? null,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          eventType: input.eventType,
          actorId: input.actorId ?? null,
          priority: input.priority ?? "normal",
          title: input.title,
          body: input.body ?? null,
          url: input.url,
          metadata: input.metadata ?? null
        })
        .onConflictDoUpdate({
          target: [
            notificationEvents.workspaceId,
            notificationEvents.sourceType,
            notificationEvents.sourceId,
            notificationEvents.eventType
          ],
          set: {
            projectId: input.projectId ?? null,
            workItemId: input.workItemId ?? null,
            actorId: input.actorId ?? null,
            priority: input.priority ?? "normal",
            title: input.title,
            body: input.body ?? null,
            url: input.url,
            metadata: input.metadata ?? null
          }
        })
        .returning();

      if (!event) {
        throw new Error("Failed to upsert notification event.");
      }

      return serializeNotificationEvent(event);
    },

    async insertNotificationRecipients(input) {
      const uniqueRecipients = uniqueRecipientInputs(input.recipients);
      if (uniqueRecipients.length === 0) {
        return [];
      }

      await db
        .insert(notificationRecipients)
        .values(
          uniqueRecipients.map((recipient) => ({
            eventId: input.eventId,
            workspaceId: input.workspaceId,
            recipientId: recipient.recipientId,
            reason: recipient.reason
          }))
        )
        .onConflictDoNothing({
          target: [
            notificationRecipients.eventId,
            notificationRecipients.recipientId,
            notificationRecipients.reason
          ]
        });

      const recipientIds = Array.from(new Set(uniqueRecipients.map((recipient) => recipient.recipientId)));
      const reasons = Array.from(new Set(uniqueRecipients.map((recipient) => recipient.reason)));
      const rows = await db
        .select()
        .from(notificationRecipients)
        .where(
          and(
            eq(notificationRecipients.eventId, input.eventId),
            inArray(notificationRecipients.recipientId, recipientIds),
            inArray(notificationRecipients.reason, reasons)
          )
        )
        .orderBy(notificationRecipients.createdAt);

      return rows.map(serializeNotificationRecipient);
    },

    async getNotificationPreferences(workspaceId, userId) {
      const [preferences] = await db
        .select()
        .from(notificationPreferences)
        .where(
          and(
            eq(notificationPreferences.workspaceId, workspaceId),
            eq(notificationPreferences.userId, userId)
          )
        )
        .limit(1);

      return preferences ? serializeNotificationPreference(preferences) : null;
    },

    async upsertNotificationPreferences(input) {
      const [preferences] = await db
        .insert(notificationPreferences)
        .values({
          workspaceId: input.workspaceId,
          userId: input.userId,
          ...input.updates
        })
        .onConflictDoUpdate({
          target: [notificationPreferences.workspaceId, notificationPreferences.userId],
          set: preferenceUpdateSet(input.updates)
        })
        .returning();

      if (!preferences) {
        throw new Error("Failed to upsert notification preferences.");
      }

      return serializeNotificationPreference(preferences);
    },

    async listInboxForUser(input) {
      const filters = [
        eq(notificationRecipients.workspaceId, input.workspaceId),
        eq(notificationRecipients.recipientId, input.recipientId),
        isNull(notificationRecipients.dismissedAt),
        ...(input.projectId ? [eq(notificationEvents.projectId, input.projectId)] : []),
        ...(input.unreadOnly ? [isNull(notificationRecipients.readAt)] : [])
      ];
      const query = db
        .select({
          event: notificationEvents,
          recipient: notificationRecipients,
          workItemIdentifier: tasks.identifier,
          projectKey: projects.key,
          workspaceSlug: workspaces.slug
        })
        .from(notificationRecipients)
        .innerJoin(notificationEvents, eq(notificationRecipients.eventId, notificationEvents.id))
        .innerJoin(workspaces, eq(notificationRecipients.workspaceId, workspaces.id))
        .leftJoin(projects, eq(notificationEvents.projectId, projects.id))
        .leftJoin(tasks, eq(notificationEvents.workItemId, tasks.id))
        .where(and(...filters))
        .orderBy(desc(notificationRecipients.createdAt));
      const rows = await (input.limit === null ? query : query.limit(input.limit ?? 30));

      return rows.map(
        (row): NotificationInboxItem => ({
          event: serializeNotificationEvent(row.event),
          recipient: serializeNotificationRecipient(row.recipient),
          workItemIdentifier: row.workItemIdentifier,
          projectKey: row.projectKey,
          workspaceSlug: row.workspaceSlug,
          isUnread: row.recipient.readAt === null
        })
      );
    },

    async markNotificationReadForUser(input) {
      const [recipient] = await db
        .update(notificationRecipients)
        .set({
          readAt: new Date(input.readAt)
        })
        .where(
          and(
            eq(notificationRecipients.id, input.notificationId),
            eq(notificationRecipients.workspaceId, input.workspaceId),
            eq(notificationRecipients.recipientId, input.recipientId)
          )
        )
        .returning();

      return recipient ? serializeNotificationRecipient(recipient) : null;
    },

    async markAllNotificationsReadForUser(input) {
      const updated = await db
        .update(notificationRecipients)
        .set({
          readAt: new Date(input.readAt)
        })
        .where(
          and(
            eq(notificationRecipients.workspaceId, input.workspaceId),
            eq(notificationRecipients.recipientId, input.recipientId),
            isNull(notificationRecipients.readAt)
          )
        )
        .returning({
          id: notificationRecipients.id
        });

      return {
        updatedCount: updated.length
      };
    },

    async listWorkspaceMembers(workspaceId) {
      return workspaceRepository.listMembers(workspaceId);
    },

    async getWorkItemParticipants(workItemId) {
      const [commentRows, activityRows] = await Promise.all([
        db
          .select({
            userId: comments.authorId
          })
          .from(comments)
          .where(and(eq(comments.workItemId, workItemId), isNull(comments.deletedAt))),
        db
          .select({
            userId: activityLog.actorId
          })
          .from(activityLog)
          .where(and(eq(activityLog.entityId, workItemId), eq(activityLog.action, "created")))
      ]);

      return Array.from(new Set([...commentRows, ...activityRows].map((row) => row.userId)));
    }
  };
}

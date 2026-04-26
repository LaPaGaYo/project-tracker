import { and, desc, eq, gte, inArray, isNull } from "drizzle-orm";

import {
  activityLog,
  comments,
  db,
  notificationEvents,
  notificationPreferences,
  notificationRecipients,
  projects,
  tasks,
  workspaceMembers,
  workspaces
} from "@the-platform/db";
import type {
  NotificationEventRecord,
  NotificationEventType,
  NotificationPreferenceRecord,
  NotificationPriority,
  NotificationRecipientReason,
  NotificationRecipientRecord,
  NotificationSourceType,
  WorkspaceMemberRecord,
  WorkspaceRole
} from "@the-platform/shared";

type RepairReason = "missing_recipients" | "activity_backfill";
type ActivityBackfillAction = "assigned" | "state_changed" | "updated";

export interface NotificationRepairWorkItem {
  id: string;
  workspaceId: string;
  workspaceSlug: string;
  projectId: string;
  projectKey: string;
  title: string;
  identifier: string | null;
  assigneeId: string | null;
}

export interface NotificationActivityBackfillCandidate {
  activityId: string;
  workspaceId: string;
  projectId: string;
  workItem: NotificationRepairWorkItem;
  action: ActivityBackfillAction;
  actorId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface NotificationRepairEventInput {
  workspaceId: string;
  projectId: string | null;
  workItemId: string | null;
  sourceType: NotificationSourceType;
  sourceId: string;
  eventType: NotificationEventType;
  actorId: string | null;
  priority: NotificationPriority;
  title: string;
  body: string | null;
  url: string;
  metadata: Record<string, unknown> | null;
}

export interface NotificationRepairRepository {
  listNotificationEventsMissingRecipients(input?: { limit?: number }): Promise<NotificationEventRecord[]>;
  listRecentActivityBackfillCandidates(input: {
    since: string;
    limit?: number;
  }): Promise<NotificationActivityBackfillCandidate[]>;
  upsertNotificationEvent(input: NotificationRepairEventInput): Promise<NotificationEventRecord>;
  insertNotificationRecipients(input: {
    eventId: string;
    workspaceId: string;
    recipients: Array<{
      recipientId: string;
      reason: NotificationRecipientReason;
    }>;
  }): Promise<NotificationRecipientRecord[]>;
  listWorkspaceMembers(workspaceId: string): Promise<WorkspaceMemberRecord[]>;
  getNotificationPreferences(workspaceId: string, userId: string): Promise<NotificationPreferenceRecord | null>;
  getWorkItemParticipants(workItemId: string): Promise<string[]>;
  getWorkItemSnapshot(workItemId: string): Promise<NotificationRepairWorkItem | null>;
  listWorkspaceAdminRecipientIds(workspaceId: string): Promise<string[]>;
}

export interface NotificationRepairSummary {
  mode: "repair-notifications";
  events: Array<{
    eventId: string;
    sourceId: string;
    eventType: NotificationEventType;
    reason: RepairReason;
    recipientsInserted: number;
  }>;
  totals: {
    eventsRepaired: number;
    activityEventsBackfilled: number;
    recipientsInserted: number;
  };
}

interface NotificationRepairDependencies {
  repository: NotificationRepairRepository;
  backfillRecentActivity?: boolean;
  activityLookbackMs?: number;
  limit?: number;
  now?: () => Date;
}

const mentionPattern = /(^|[^A-Za-z0-9_@])@([A-Za-z0-9][A-Za-z0-9._:-]{0,254})/g;
const defaultActivityLookbackMs = 24 * 60 * 60 * 1000;

function toIso(value: Date | null) {
  return value ? value.toISOString() : null;
}

function defaultPreferences(workspaceId: string, userId: string): NotificationPreferenceRecord {
  const now = new Date(0).toISOString();

  return {
    workspaceId,
    userId,
    commentsEnabled: true,
    mentionsEnabled: true,
    assignmentsEnabled: true,
    githubEnabled: true,
    stateChangesEnabled: true,
    createdAt: now,
    updatedAt: now
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readNestedString(source: Record<string, unknown> | null, path: string[]) {
  let current: unknown = source;

  for (const key of path) {
    if (!isRecord(current)) {
      return null;
    }

    current = current[key];
  }

  return readString(current);
}

function readAfterValue(metadata: Record<string, unknown> | null) {
  return readNestedString(metadata, ["after"]) ?? readNestedString(metadata, ["after", "assigneeId"]);
}

function notificationUrl(workItem: NotificationRepairWorkItem) {
  return `/workspaces/${workItem.workspaceSlug}/projects/${workItem.projectKey}/items/${workItem.identifier ?? workItem.id}`;
}

function eventWorkItemLabel(workItem: NotificationRepairWorkItem) {
  return workItem.identifier ?? workItem.title;
}

function uniqueRecipients(
  recipients: Array<{ recipientId: string; reason: NotificationRecipientReason }>
) {
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

function extractMentionedUserIds(content: string | null) {
  if (!content) {
    return [];
  }

  const mentionedUserIds = new Set<string>();
  for (const match of content.matchAll(mentionPattern)) {
    const userId = match[2];
    if (userId) {
      mentionedUserIds.add(userId);
    }
  }

  return Array.from(mentionedUserIds);
}

function preferenceAllowsNotification(
  preferences: NotificationPreferenceRecord,
  eventType: NotificationEventType,
  reason: NotificationRecipientReason
) {
  if (reason === "mention" || eventType === "mention_created") {
    return preferences.mentionsEnabled;
  }

  if (eventType === "comment_created") {
    return preferences.commentsEnabled;
  }

  if (eventType === "assignment_changed") {
    return preferences.assignmentsEnabled;
  }

  if (eventType.startsWith("github_")) {
    return preferences.githubEnabled;
  }

  if (eventType === "state_changed" || eventType === "priority_raised") {
    return preferences.stateChangesEnabled;
  }

  return true;
}

async function getWorkItemOrNull(repository: NotificationRepairRepository, workItemId: string | null) {
  return workItemId ? repository.getWorkItemSnapshot(workItemId) : null;
}

async function participantRecipients(
  repository: NotificationRepairRepository,
  workItem: NotificationRepairWorkItem,
  assigneeReason: NotificationRecipientReason = "assigned"
) {
  const participants = await repository.getWorkItemParticipants(workItem.id);

  return uniqueRecipients([
    ...(workItem.assigneeId
      ? [
          {
            recipientId: workItem.assigneeId,
            reason: assigneeReason
          }
        ]
      : []),
    ...participants
      .filter((participantId) => participantId !== workItem.assigneeId)
      .map((participantId) => ({
        recipientId: participantId,
        reason: "participant" as const
      }))
  ]);
}

async function resolveCandidateRecipients(
  repository: NotificationRepairRepository,
  event: NotificationEventRecord
) {
  if (event.eventType === "mention_created") {
    return extractMentionedUserIds(event.body).map((recipientId) => ({
      recipientId,
      reason: "mention" as const
    }));
  }

  if (event.eventType === "comment_created") {
    const workItem = await getWorkItemOrNull(repository, event.workItemId);
    if (!workItem) {
      return [];
    }

    const mentionedUserIds = new Set(extractMentionedUserIds(event.body));
    return (await participantRecipients(repository, workItem, "participant")).filter(
      (recipient) => !mentionedUserIds.has(recipient.recipientId)
    );
  }

  if (event.eventType === "assignment_changed") {
    const workItem = await getWorkItemOrNull(repository, event.workItemId);
    const assigneeId = readNestedString(event.metadata, ["after", "assigneeId"]) ?? workItem?.assigneeId ?? null;

    return assigneeId
      ? [
          {
            recipientId: assigneeId,
            reason: "assigned" as const
          }
        ]
      : [];
  }

  if (
    event.eventType === "state_changed" ||
    event.eventType === "priority_raised" ||
    event.eventType === "github_pr_changed" ||
    event.eventType === "github_check_changed" ||
    event.eventType === "github_deploy_changed"
  ) {
    const workItem = await getWorkItemOrNull(repository, event.workItemId);
    return workItem ? participantRecipients(repository, workItem) : [];
  }

  if (event.eventType === "github_webhook_failed") {
    return (await repository.listWorkspaceAdminRecipientIds(event.workspaceId)).map((recipientId) => ({
      recipientId,
      reason: "github" as const
    }));
  }

  return (await repository.listWorkspaceAdminRecipientIds(event.workspaceId)).map((recipientId) => ({
    recipientId,
    reason: "system" as const
  }));
}

async function filterRecipients(
  repository: NotificationRepairRepository,
  event: NotificationEventRecord,
  recipients: Array<{ recipientId: string; reason: NotificationRecipientReason }>
) {
  const memberIds = new Set((await repository.listWorkspaceMembers(event.workspaceId)).map((member) => member.userId));
  const candidates = uniqueRecipients(recipients).filter(
    (recipient) => memberIds.has(recipient.recipientId) && recipient.recipientId !== event.actorId
  );
  const filtered: Array<{ recipientId: string; reason: NotificationRecipientReason }> = [];

  for (const recipient of candidates) {
    const preferences =
      (await repository.getNotificationPreferences(event.workspaceId, recipient.recipientId)) ??
      defaultPreferences(event.workspaceId, recipient.recipientId);

    if (preferenceAllowsNotification(preferences, event.eventType, recipient.reason)) {
      filtered.push(recipient);
    }
  }

  return filtered;
}

async function repairEvent(
  repository: NotificationRepairRepository,
  summary: NotificationRepairSummary,
  event: NotificationEventRecord,
  reason: RepairReason
) {
  const recipients = await filterRecipients(repository, event, await resolveCandidateRecipients(repository, event));
  const inserted = await repository.insertNotificationRecipients({
    eventId: event.id,
    workspaceId: event.workspaceId,
    recipients
  });

  summary.events.push({
    eventId: event.id,
    sourceId: event.sourceId,
    eventType: event.eventType,
    reason,
    recipientsInserted: inserted.length
  });
  summary.totals.eventsRepaired += 1;
  summary.totals.recipientsInserted += inserted.length;
}

function eventInputForActivity(candidate: NotificationActivityBackfillCandidate): NotificationRepairEventInput | null {
  const sourceId = `activity:${candidate.activityId}`;

  if (candidate.action === "assigned") {
    const assigneeId = readAfterValue(candidate.metadata) ?? candidate.workItem.assigneeId;
    if (!assigneeId) {
      return null;
    }

    return {
      workspaceId: candidate.workspaceId,
      projectId: candidate.projectId,
      workItemId: candidate.workItem.id,
      sourceType: "work_item",
      sourceId,
      eventType: "assignment_changed",
      actorId: candidate.actorId,
      priority: "normal",
      title: `${eventWorkItemLabel(candidate.workItem)} assigned to you`,
      body: candidate.workItem.title,
      url: notificationUrl(candidate.workItem),
      metadata: {
        ...(candidate.metadata ?? {}),
        after: {
          assigneeId
        }
      }
    };
  }

  if (candidate.action === "state_changed") {
    return {
      workspaceId: candidate.workspaceId,
      projectId: candidate.projectId,
      workItemId: candidate.workItem.id,
      sourceType: "work_item",
      sourceId,
      eventType: "state_changed",
      actorId: candidate.actorId,
      priority: "normal",
      title: `${eventWorkItemLabel(candidate.workItem)} changed state`,
      body: candidate.workItem.title,
      url: notificationUrl(candidate.workItem),
      metadata: candidate.metadata
    };
  }

  const beforePriority = readNestedString(candidate.metadata, ["before", "priority"]);
  const afterPriority = readNestedString(candidate.metadata, ["after", "priority"]);
  if (beforePriority !== "urgent" && afterPriority === "urgent") {
    return {
      workspaceId: candidate.workspaceId,
      projectId: candidate.projectId,
      workItemId: candidate.workItem.id,
      sourceType: "work_item",
      sourceId,
      eventType: "priority_raised",
      actorId: candidate.actorId,
      priority: "high",
      title: `${eventWorkItemLabel(candidate.workItem)} is urgent`,
      body: candidate.workItem.title,
      url: notificationUrl(candidate.workItem),
      metadata: candidate.metadata
    };
  }

  return null;
}

function emptySummary(): NotificationRepairSummary {
  return {
    mode: "repair-notifications",
    events: [],
    totals: {
      eventsRepaired: 0,
      activityEventsBackfilled: 0,
      recipientsInserted: 0
    }
  };
}

export async function runNotificationRepair(dependencies: NotificationRepairDependencies) {
  const summary = emptySummary();
  const limit = dependencies.limit ?? 100;
  const missingEvents = await dependencies.repository.listNotificationEventsMissingRecipients({ limit });

  for (const event of missingEvents) {
    await repairEvent(dependencies.repository, summary, event, "missing_recipients");
  }

  if (dependencies.backfillRecentActivity) {
    const now = dependencies.now ?? (() => new Date());
    const since = new Date(now().getTime() - (dependencies.activityLookbackMs ?? defaultActivityLookbackMs)).toISOString();
    const candidates = await dependencies.repository.listRecentActivityBackfillCandidates({ since, limit });

    for (const candidate of candidates) {
      const input = eventInputForActivity(candidate);
      if (!input) {
        continue;
      }

      const event = await dependencies.repository.upsertNotificationEvent(input);
      summary.totals.activityEventsBackfilled += 1;
      await repairEvent(dependencies.repository, summary, event, "activity_backfill");
    }
  }

  return summary;
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

function serializeWorkspaceMember(row: typeof workspaceMembers.$inferSelect): WorkspaceMemberRecord {
  return {
    workspaceId: row.workspaceId,
    userId: row.userId,
    role: row.role,
    invitedAt: row.invitedAt.toISOString(),
    joinedAt: toIso(row.joinedAt)
  };
}

function serializeWorkItemSnapshot(row: {
  workItem: typeof tasks.$inferSelect;
  project: typeof projects.$inferSelect;
  workspace: typeof workspaces.$inferSelect;
}): NotificationRepairWorkItem {
  return {
    id: row.workItem.id,
    workspaceId: row.workspace.id,
    workspaceSlug: row.workspace.slug,
    projectId: row.project.id,
    projectKey: row.project.key,
    title: row.workItem.title,
    identifier: row.workItem.identifier,
    assigneeId: row.workItem.assigneeId
  };
}

export function createNotificationRepairRepository(): NotificationRepairRepository {
  return {
    async listNotificationEventsMissingRecipients(input = {}) {
      const rows = await db
        .select({
          event: notificationEvents
        })
        .from(notificationEvents)
        .leftJoin(notificationRecipients, eq(notificationRecipients.eventId, notificationEvents.id))
        .where(isNull(notificationRecipients.id))
        .orderBy(desc(notificationEvents.createdAt))
        .limit(input.limit ?? 100);

      return rows.map((row) => serializeNotificationEvent(row.event));
    },

    async listRecentActivityBackfillCandidates(input) {
      const rows = await db
        .select({
          activity: activityLog,
          workItem: tasks,
          project: projects,
          workspace: workspaces
        })
        .from(activityLog)
        .innerJoin(tasks, eq(activityLog.entityId, tasks.id))
        .innerJoin(projects, eq(tasks.projectId, projects.id))
        .innerJoin(workspaces, eq(activityLog.workspaceId, workspaces.id))
        .where(
          and(
            eq(activityLog.entityType, "work_item"),
            inArray(activityLog.action, ["assigned", "state_changed", "updated"]),
            gte(activityLog.createdAt, new Date(input.since))
          )
        )
        .orderBy(desc(activityLog.createdAt))
        .limit(input.limit ?? 100);

      if (rows.length === 0) {
        return [];
      }

      const sourceIds = rows.map((row) => `activity:${row.activity.id}`);
      const existingEvents = await db
        .select({
          sourceId: notificationEvents.sourceId
        })
        .from(notificationEvents)
        .where(
          and(
            eq(notificationEvents.sourceType, "work_item"),
            inArray(notificationEvents.sourceId, sourceIds)
          )
        );
      const existingSourceIds = new Set(existingEvents.map((event) => event.sourceId));

      return rows.filter((row) => !existingSourceIds.has(`activity:${row.activity.id}`)).map(
        (row): NotificationActivityBackfillCandidate => ({
          activityId: row.activity.id,
          workspaceId: row.activity.workspaceId,
          projectId: row.project.id,
          workItem: serializeWorkItemSnapshot(row),
          action: row.activity.action as ActivityBackfillAction,
          actorId: row.activity.actorId,
          metadata: row.activity.metadata,
          createdAt: row.activity.createdAt.toISOString()
        })
      );
    },

    async upsertNotificationEvent(input) {
      const [event] = await db
        .insert(notificationEvents)
        .values({
          workspaceId: input.workspaceId,
          projectId: input.projectId,
          workItemId: input.workItemId,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          eventType: input.eventType,
          actorId: input.actorId,
          priority: input.priority,
          title: input.title,
          body: input.body,
          url: input.url,
          metadata: input.metadata
        })
        .onConflictDoUpdate({
          target: [
            notificationEvents.workspaceId,
            notificationEvents.sourceType,
            notificationEvents.sourceId,
            notificationEvents.eventType
          ],
          set: {
            projectId: input.projectId,
            workItemId: input.workItemId,
            actorId: input.actorId,
            priority: input.priority,
            title: input.title,
            body: input.body,
            url: input.url,
            metadata: input.metadata
          }
        })
        .returning();

      if (!event) {
        throw new Error("Failed to upsert notification event.");
      }

      return serializeNotificationEvent(event);
    },

    async insertNotificationRecipients(input) {
      const recipients = uniqueRecipients(input.recipients);
      if (recipients.length === 0) {
        return [];
      }

      const inserted = await db
        .insert(notificationRecipients)
        .values(
          recipients.map((recipient) => ({
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
        })
        .returning();

      return inserted.map(serializeNotificationRecipient);
    },

    async listWorkspaceMembers(workspaceId) {
      const rows = await db.select().from(workspaceMembers).where(eq(workspaceMembers.workspaceId, workspaceId));
      return rows.map(serializeWorkspaceMember);
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
    },

    async getWorkItemSnapshot(workItemId) {
      const [row] = await db
        .select({
          workItem: tasks,
          project: projects,
          workspace: workspaces
        })
        .from(tasks)
        .innerJoin(projects, eq(tasks.projectId, projects.id))
        .innerJoin(workspaces, eq(projects.workspaceId, workspaces.id))
        .where(eq(tasks.id, workItemId))
        .limit(1);

      return row ? serializeWorkItemSnapshot(row) : null;
    },

    async listWorkspaceAdminRecipientIds(workspaceId) {
      const rows = await db
        .select({
          userId: workspaceMembers.userId
        })
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, workspaceId),
            inArray(workspaceMembers.role, ["owner", "admin"] satisfies WorkspaceRole[])
          )
        );

      return rows.map((row) => row.userId);
    }
  };
}

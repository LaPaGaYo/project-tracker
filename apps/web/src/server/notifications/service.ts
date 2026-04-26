import type {
  NotificationEventType,
  NotificationPreferenceRecord,
  NotificationRecipientReason
} from "@the-platform/shared";

import { WorkspaceError } from "../workspaces/core";
import { resolveWorkspaceContext } from "../work-management/utils";

import type { AppSession } from "../workspaces/types";

import type {
  CreateNotificationEventInput,
  CreateNotificationForSourceInput,
  CreateNotificationResult,
  NotificationPreferenceUpdateInput,
  NotificationRepository,
  NotificationRecipientInput
} from "./types";

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

function normalizePreferenceUpdates(input: NotificationPreferenceUpdateInput): NotificationPreferenceUpdateInput {
  return {
    ...(typeof input.commentsEnabled === "boolean" ? { commentsEnabled: input.commentsEnabled } : {}),
    ...(typeof input.mentionsEnabled === "boolean" ? { mentionsEnabled: input.mentionsEnabled } : {}),
    ...(typeof input.assignmentsEnabled === "boolean" ? { assignmentsEnabled: input.assignmentsEnabled } : {}),
    ...(typeof input.githubEnabled === "boolean" ? { githubEnabled: input.githubEnabled } : {}),
    ...(typeof input.stateChangesEnabled === "boolean" ? { stateChangesEnabled: input.stateChangesEnabled } : {})
  };
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

function uniqueRecipients(recipients: NotificationRecipientInput[]) {
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

async function filterRecipients(
  repository: NotificationRepository,
  workspaceId: string,
  input: CreateNotificationForSourceInput
) {
  const members = await repository.listWorkspaceMembers(workspaceId);
  const memberIds = new Set(members.map((member) => member.userId));
  const actorId = input.actorId ?? null;
  const candidates = uniqueRecipients(input.recipients).filter(
    (recipient) => memberIds.has(recipient.recipientId) && recipient.recipientId !== actorId
  );

  const filtered: NotificationRecipientInput[] = [];
  for (const recipient of candidates) {
    const preferences =
      (await repository.getNotificationPreferences(workspaceId, recipient.recipientId)) ??
      defaultPreferences(workspaceId, recipient.recipientId);

    if (preferenceAllowsNotification(preferences, input.eventType, recipient.reason)) {
      filtered.push(recipient);
    }
  }

  return filtered;
}

export async function createNotificationForSource(
  repository: NotificationRepository,
  session: AppSession,
  workspaceSlug: string,
  input: CreateNotificationForSourceInput
): Promise<CreateNotificationResult> {
  const { workspace } = await resolveWorkspaceContext(repository, session, workspaceSlug, "viewer");
  return createNotificationForWorkspace(repository, {
    workspaceId: workspace.id,
    ...input
  });
}

export async function createNotificationForWorkspace(
  repository: NotificationRepository,
  input: CreateNotificationForSourceInput & Pick<CreateNotificationEventInput, "workspaceId">
): Promise<CreateNotificationResult> {
  const recipients = await filterRecipients(repository, input.workspaceId, input);
  const event = await repository.upsertNotificationEvent({
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
  });

  return {
    event,
    recipients: await repository.insertNotificationRecipients({
      eventId: event.id,
      workspaceId: input.workspaceId,
      recipients
    })
  };
}

export async function listNotificationsForUser(
  repository: NotificationRepository,
  session: AppSession,
  workspaceSlug: string,
  options: { limit?: number } = {}
) {
  const { workspace } = await resolveWorkspaceContext(repository, session, workspaceSlug, "viewer");

  return repository.listInboxForUser({
    workspaceId: workspace.id,
    recipientId: session.userId,
    ...(options.limit !== undefined ? { limit: options.limit } : {})
  });
}

export async function markNotificationReadForUser(
  repository: NotificationRepository,
  session: AppSession,
  workspaceSlug: string,
  notificationId: string
) {
  const { workspace } = await resolveWorkspaceContext(repository, session, workspaceSlug, "viewer");
  const recipient = await repository.markNotificationReadForUser({
    workspaceId: workspace.id,
    recipientId: session.userId,
    notificationId,
    readAt: new Date().toISOString()
  });

  if (!recipient) {
    throw new WorkspaceError(404, "notification not found.");
  }

  return recipient;
}

export async function markAllNotificationsReadForUser(
  repository: NotificationRepository,
  session: AppSession,
  workspaceSlug: string
) {
  const { workspace } = await resolveWorkspaceContext(repository, session, workspaceSlug, "viewer");

  return repository.markAllNotificationsReadForUser({
    workspaceId: workspace.id,
    recipientId: session.userId,
    readAt: new Date().toISOString()
  });
}

export async function getNotificationPreferencesForUser(
  repository: NotificationRepository,
  session: AppSession,
  workspaceSlug: string
) {
  const { workspace } = await resolveWorkspaceContext(repository, session, workspaceSlug, "viewer");

  return (
    (await repository.getNotificationPreferences(workspace.id, session.userId)) ??
    defaultPreferences(workspace.id, session.userId)
  );
}

export async function updateNotificationPreferencesForUser(
  repository: NotificationRepository,
  session: AppSession,
  workspaceSlug: string,
  input: NotificationPreferenceUpdateInput
) {
  const { workspace } = await resolveWorkspaceContext(repository, session, workspaceSlug, "viewer");

  return repository.upsertNotificationPreferences({
    workspaceId: workspace.id,
    userId: session.userId,
    updates: normalizePreferenceUpdates(input)
  });
}

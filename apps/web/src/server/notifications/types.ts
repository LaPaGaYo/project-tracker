import type {
  NotificationEventRecord,
  NotificationEventType,
  NotificationInboxItem,
  NotificationPreferenceRecord,
  NotificationPriority,
  NotificationRecipientReason,
  NotificationRecipientRecord,
  NotificationSourceType,
  WorkspaceMemberRecord
} from "@the-platform/shared";

import type { WorkspaceRepository } from "../workspaces/types";

export interface NotificationRecipientInput {
  recipientId: string;
  reason: NotificationRecipientReason;
}

export interface CreateNotificationEventInput {
  workspaceId: string;
  projectId?: string | null;
  workItemId?: string | null;
  sourceType: NotificationSourceType;
  sourceId: string;
  eventType: NotificationEventType;
  actorId?: string | null;
  priority?: NotificationPriority;
  title: string;
  body?: string | null;
  url: string;
  metadata?: Record<string, unknown> | null;
}

export interface CreateNotificationForSourceInput
  extends Omit<CreateNotificationEventInput, "workspaceId"> {
  recipients: NotificationRecipientInput[];
}

export interface NotificationPreferenceUpdateInput {
  commentsEnabled?: boolean;
  mentionsEnabled?: boolean;
  assignmentsEnabled?: boolean;
  githubEnabled?: boolean;
  stateChangesEnabled?: boolean;
}

export interface NotificationRepository
  extends Pick<WorkspaceRepository, "findWorkspaceBySlug" | "getMembership" | "listMembers"> {
  upsertNotificationEvent(input: CreateNotificationEventInput): Promise<NotificationEventRecord>;
  insertNotificationRecipients(input: {
    eventId: string;
    workspaceId: string;
    recipients: NotificationRecipientInput[];
  }): Promise<NotificationRecipientRecord[]>;
  getNotificationPreferences(
    workspaceId: string,
    userId: string
  ): Promise<NotificationPreferenceRecord | null>;
  upsertNotificationPreferences(input: {
    workspaceId: string;
    userId: string;
    updates: NotificationPreferenceUpdateInput;
  }): Promise<NotificationPreferenceRecord>;
  listInboxForUser(input: {
    workspaceId: string;
    recipientId: string;
    projectId?: string;
    unreadOnly?: boolean;
    limit?: number | null;
  }): Promise<NotificationInboxItem[]>;
  markNotificationReadForUser(input: {
    workspaceId: string;
    recipientId: string;
    notificationId: string;
    readAt: string;
  }): Promise<NotificationRecipientRecord | null>;
  markAllNotificationsReadForUser(input: {
    workspaceId: string;
    recipientId: string;
    readAt: string;
  }): Promise<{ updatedCount: number }>;
  listWorkspaceMembers(workspaceId: string): Promise<WorkspaceMemberRecord[]>;
  getWorkItemParticipants(workItemId: string): Promise<string[]>;
}

export interface CreateNotificationResult {
  event: NotificationEventRecord;
  recipients: NotificationRecipientRecord[];
}

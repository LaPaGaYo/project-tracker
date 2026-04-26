import assert from "node:assert/strict";
import test from "node:test";

import type {
  NotificationEventRecord,
  NotificationPreferenceRecord,
  NotificationRecipientReason,
  NotificationRecipientRecord,
  WorkspaceMemberRecord
} from "@the-platform/shared";

import {
  runNotificationRepair,
  type NotificationActivityBackfillCandidate,
  type NotificationRepairEventInput,
  type NotificationRepairRepository,
  type NotificationRepairWorkItem
} from "./notification-repair";

const workspaceMembers: WorkspaceMemberRecord[] = [
  {
    workspaceId: "workspace-1",
    userId: "owner-1",
    role: "owner",
    invitedAt: "2026-04-25T12:00:00.000Z",
    joinedAt: "2026-04-25T12:00:00.000Z"
  },
  {
    workspaceId: "workspace-1",
    userId: "assignee-1",
    role: "member",
    invitedAt: "2026-04-25T12:00:00.000Z",
    joinedAt: "2026-04-25T12:00:00.000Z"
  },
  {
    workspaceId: "workspace-1",
    userId: "participant-1",
    role: "member",
    invitedAt: "2026-04-25T12:00:00.000Z",
    joinedAt: "2026-04-25T12:00:00.000Z"
  },
  {
    workspaceId: "workspace-1",
    userId: "muted-1",
    role: "member",
    invitedAt: "2026-04-25T12:00:00.000Z",
    joinedAt: "2026-04-25T12:00:00.000Z"
  }
];

const workItem: NotificationRepairWorkItem = {
  id: "work-item-1",
  workspaceId: "workspace-1",
  workspaceSlug: "platform-ops",
  projectId: "project-1",
  projectKey: "OPS",
  title: "Repair notification recipients",
  identifier: "OPS-1",
  assigneeId: "assignee-1"
};

function event(overrides: Partial<NotificationEventRecord> = {}): NotificationEventRecord {
  return {
    id: "event-1",
    workspaceId: "workspace-1",
    projectId: "project-1",
    workItemId: "work-item-1",
    sourceType: "work_item",
    sourceId: "work-item-1:assignment:assignee-1:2026-04-25T12:00:00.000Z",
    eventType: "assignment_changed",
    actorId: "owner-1",
    priority: "normal",
    title: "OPS-1 assigned to you",
    body: "Repair notification recipients",
    url: "/workspaces/platform-ops/projects/OPS/items/OPS-1",
    metadata: {
      after: {
        assigneeId: "assignee-1"
      }
    },
    createdAt: "2026-04-25T12:00:00.000Z",
    ...overrides
  };
}

function preferences(
  userId: string,
  overrides: Partial<NotificationPreferenceRecord> = {}
): NotificationPreferenceRecord {
  return {
    workspaceId: "workspace-1",
    userId,
    commentsEnabled: true,
    mentionsEnabled: true,
    assignmentsEnabled: true,
    githubEnabled: true,
    stateChangesEnabled: true,
    createdAt: "2026-04-25T12:00:00.000Z",
    updatedAt: "2026-04-25T12:00:00.000Z",
    ...overrides
  };
}

class MemoryNotificationRepairRepository implements NotificationRepairRepository {
  insertedRecipients: Array<{ eventId: string; recipientId: string; reason: NotificationRecipientReason }> = [];

  upsertedEvents: NotificationRepairEventInput[] = [];

  constructor(
    private readonly fixtures: {
      missingEvents?: NotificationEventRecord[];
      members?: WorkspaceMemberRecord[];
      participants?: string[];
      preferences?: Record<string, NotificationPreferenceRecord>;
      workItems?: Record<string, NotificationRepairWorkItem>;
      activityCandidates?: NotificationActivityBackfillCandidate[];
      adminRecipientIds?: string[];
    } = {}
  ) {}

  listNotificationEventsMissingRecipients() {
    return Promise.resolve(this.fixtures.missingEvents ?? []);
  }

  listRecentActivityBackfillCandidates() {
    return Promise.resolve(this.fixtures.activityCandidates ?? []);
  }

  upsertNotificationEvent(input: NotificationRepairEventInput) {
    this.upsertedEvents.push(input);
    return Promise.resolve(
      event({
        id: `event-${input.sourceId}`,
        ...input
      })
    );
  }

  insertNotificationRecipients(input: {
    eventId: string;
    workspaceId: string;
    recipients: Array<{ recipientId: string; reason: NotificationRecipientReason }>;
  }) {
    const inserted: NotificationRecipientRecord[] = [];

    for (const recipient of input.recipients) {
      const key = `${input.eventId}:${recipient.recipientId}:${recipient.reason}`;
      const exists = this.insertedRecipients.some(
        (entry) => `${entry.eventId}:${entry.recipientId}:${entry.reason}` === key
      );

      if (exists) {
        continue;
      }

      this.insertedRecipients.push({
        eventId: input.eventId,
        recipientId: recipient.recipientId,
        reason: recipient.reason
      });
      inserted.push({
        id: `recipient-${this.insertedRecipients.length}`,
        eventId: input.eventId,
        workspaceId: input.workspaceId,
        recipientId: recipient.recipientId,
        reason: recipient.reason,
        readAt: null,
        dismissedAt: null,
        createdAt: "2026-04-25T12:01:00.000Z"
      });
    }

    return Promise.resolve(inserted);
  }

  listWorkspaceMembers() {
    return Promise.resolve(this.fixtures.members ?? workspaceMembers);
  }

  getNotificationPreferences(workspaceId: string, userId: string) {
    return Promise.resolve(this.fixtures.preferences?.[`${workspaceId}:${userId}`] ?? null);
  }

  getWorkItemParticipants() {
    return Promise.resolve(this.fixtures.participants ?? ["participant-1"]);
  }

  getWorkItemSnapshot(workItemId: string) {
    return Promise.resolve(this.fixtures.workItems?.[workItemId] ?? workItem);
  }

  listWorkspaceAdminRecipientIds() {
    return Promise.resolve(this.fixtures.adminRecipientIds ?? ["owner-1"]);
  }
}

void test("runNotificationRepair rebuilds recipients for notification events that have no recipient rows", async () => {
  const repository = new MemoryNotificationRepairRepository({
    missingEvents: [event()]
  });

  const summary = await runNotificationRepair({ repository });

  assert.equal(summary.totals.eventsRepaired, 1);
  assert.equal(summary.totals.recipientsInserted, 1);
  assert.deepEqual(repository.insertedRecipients, [
    {
      eventId: "event-1",
      recipientId: "assignee-1",
      reason: "assigned"
    }
  ]);
});

void test("runNotificationRepair applies notification preferences and suppresses actor self-notifications", async () => {
  const repository = new MemoryNotificationRepairRepository({
    missingEvents: [
      event({
        eventType: "comment_created",
        sourceType: "comment",
        sourceId: "comment-1",
        actorId: "participant-1",
        body: "Comment that should notify followers."
      })
    ],
    participants: ["participant-1", "muted-1"],
    preferences: {
      "workspace-1:assignee-1": preferences("assignee-1", { commentsEnabled: false }),
      "workspace-1:muted-1": preferences("muted-1", { commentsEnabled: false })
    }
  });

  const summary = await runNotificationRepair({ repository });

  assert.equal(summary.totals.eventsRepaired, 1);
  assert.equal(summary.totals.recipientsInserted, 0);
  assert.deepEqual(repository.insertedRecipients, []);
});

void test("runNotificationRepair remains duplicate-safe when the same event is processed again", async () => {
  const repository = new MemoryNotificationRepairRepository({
    missingEvents: [event()]
  });

  const first = await runNotificationRepair({ repository });
  const second = await runNotificationRepair({ repository });

  assert.equal(first.totals.recipientsInserted, 1);
  assert.equal(second.totals.recipientsInserted, 0);
  assert.deepEqual(repository.insertedRecipients, [
    {
      eventId: "event-1",
      recipientId: "assignee-1",
      reason: "assigned"
    }
  ]);
});

void test("runNotificationRepair can backfill recent assignment activity when explicitly enabled", async () => {
  const repository = new MemoryNotificationRepairRepository({
    missingEvents: [],
    activityCandidates: [
      {
        activityId: "activity-1",
        workspaceId: "workspace-1",
        projectId: "project-1",
        workItem,
        action: "assigned",
        actorId: "owner-1",
        metadata: {
          after: "assignee-1"
        },
        createdAt: "2026-04-25T12:00:00.000Z"
      }
    ]
  });

  const summary = await runNotificationRepair({
    repository,
    backfillRecentActivity: true,
    now: () => new Date("2026-04-25T13:00:00.000Z")
  });

  assert.equal(summary.totals.activityEventsBackfilled, 1);
  assert.equal(summary.totals.recipientsInserted, 1);
  assert.equal(repository.upsertedEvents[0]?.sourceId, "activity:activity-1");
  assert.equal(repository.upsertedEvents[0]?.eventType, "assignment_changed");
});

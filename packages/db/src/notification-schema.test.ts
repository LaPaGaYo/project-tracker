import assert from "node:assert/strict";
import test from "node:test";

import { getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";

import {
  notificationEventTypes,
  notificationPriorities,
  notificationRecipientReasons,
  notificationSourceTypes
} from "@the-platform/shared";

import {
  notificationEvents,
  notificationEventTypeEnum,
  notificationPreferences,
  notificationPriorityEnum,
  notificationRecipients,
  notificationRecipientReasonEnum,
  notificationSourceTypeEnum,
  schemaTableNames
} from "./schema";

function getIndexNames(table: Parameters<typeof getTableConfig>[0]): string[] {
  return getTableConfig(table)
    .indexes.map((index) => index.config.name)
    .filter((name): name is string => typeof name === "string");
}

void test("notification schema adds durable event, recipient, and preference tables", () => {
  assert.deepEqual(schemaTableNames.slice(-3), [
    "notification_events",
    "notification_recipients",
    "notification_preferences"
  ]);

  assert.equal(getTableName(notificationEvents), "notification_events");
  assert.equal(getTableName(notificationRecipients), "notification_recipients");
  assert.equal(getTableName(notificationPreferences), "notification_preferences");
});

void test("notification schema enums stay aligned with shared contracts", () => {
  assert.deepEqual(notificationSourceTypeEnum.enumValues, notificationSourceTypes);
  assert.deepEqual(notificationEventTypeEnum.enumValues, notificationEventTypes);
  assert.deepEqual(notificationPriorityEnum.enumValues, notificationPriorities);
  assert.deepEqual(notificationRecipientReasonEnum.enumValues, notificationRecipientReasons);
});

void test("notification schema defines uniqueness and inbox lookup indexes", () => {
  assert.deepEqual(getIndexNames(notificationEvents), [
    "notification_events_workspace_created_idx",
    "notification_events_project_created_idx",
    "notification_events_work_item_created_idx",
    "notification_events_workspace_source_event_unique"
  ]);

  assert.deepEqual(getIndexNames(notificationRecipients), [
    "notification_recipients_workspace_recipient_read_created_idx",
    "notification_recipients_workspace_recipient_created_idx",
    "notification_recipients_event_recipient_reason_unique"
  ]);

  assert.deepEqual(getIndexNames(notificationPreferences), [
    "notification_preferences_workspace_user_unique"
  ]);
});

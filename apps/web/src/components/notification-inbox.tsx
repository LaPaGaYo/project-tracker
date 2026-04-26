"use client";

import Link from "next/link";
import { useState } from "react";

import type {
  NotificationInboxItem,
  NotificationPreferenceRecord,
  NotificationRecipientRecord
} from "@the-platform/shared";

import { NotificationBell } from "./notification-bell";
import { NotificationPreferences } from "./notification-preferences";

interface NotificationInboxProps {
  workspaceSlug: string;
  initialNotifications: NotificationInboxItem[];
  initialPreferences: NotificationPreferenceRecord;
  initialUnreadCount?: number;
}

function sourceLabel(notification: NotificationInboxItem) {
  const eventType = notification.event.eventType;

  if (eventType === "mention_created") {
    return "Mention";
  }

  if (eventType === "comment_created") {
    return "Comment";
  }

  if (eventType === "assignment_changed") {
    return "Assignment";
  }

  if (eventType.startsWith("github_")) {
    return "GitHub";
  }

  if (eventType === "state_changed" || eventType === "priority_raised") {
    return "Workflow";
  }

  return "System";
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function unreadCountFor(notifications: NotificationInboxItem[]) {
  return notifications.filter((notification) => notification.isUnread).length;
}

function markNotificationRead(
  notification: NotificationInboxItem,
  recipient: NotificationRecipientRecord
): NotificationInboxItem {
  return {
    ...notification,
    recipient,
    isUnread: recipient.readAt === null
  };
}

export function NotificationInbox({
  workspaceSlug,
  initialNotifications,
  initialPreferences,
  initialUnreadCount
}: NotificationInboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [preferences, setPreferences] = useState(initialPreferences);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount ?? unreadCountFor(initialNotifications));
  const [pendingNotificationId, setPendingNotificationId] = useState<string | null>(null);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function markRead(notification: NotificationInboxItem) {
    if (!notification.isUnread) {
      return;
    }

    setPendingNotificationId(notification.recipient.id);
    setError(null);

    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/notifications/${notification.recipient.id}`,
        {
          method: "PATCH"
        }
      );

      if (!response.ok) {
        throw new Error("Failed to mark notification read.");
      }

      const data = (await response.json()) as { notification: NotificationRecipientRecord };
      setNotifications((current) =>
        current.map((item) =>
          item.recipient.id === notification.recipient.id ? markNotificationRead(item, data.notification) : item
        )
      );
      setUnreadCount((current) => Math.max(0, current - 1));
    } catch {
      setError("Could not mark notification read.");
    } finally {
      setPendingNotificationId(null);
    }
  }

  async function markAllRead() {
    if (unreadCount === 0) {
      return;
    }

    setIsMarkingAllRead(true);
    setError(null);

    try {
      const response = await fetch(`/api/workspaces/${workspaceSlug}/notifications/mark-all-read`, {
        method: "POST"
      });

      if (!response.ok) {
        throw new Error("Failed to mark all notifications read.");
      }

      const readAt = new Date().toISOString();
      setNotifications((current) =>
        current.map((notification) => ({
          ...notification,
          isUnread: false,
          recipient: {
            ...notification.recipient,
            readAt: notification.recipient.readAt ?? readAt
          }
        }))
      );
      setUnreadCount(0);
    } catch {
      setError("Could not mark all notifications read.");
    } finally {
      setIsMarkingAllRead(false);
    }
  }

  return (
    <div className="relative">
      <NotificationBell
        isOpen={isOpen}
        unreadCount={unreadCount}
        onToggle={() => {
          setIsOpen((current) => !current);
        }}
      />
      {isOpen ? (
        <section
          role="dialog"
          aria-label="Notification inbox"
          className="absolute right-0 z-30 mt-3 w-[min(92vw,28rem)] overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#11161d]/95 text-left shadow-[0_28px_90px_rgba(0,0,0,0.42)] backdrop-blur"
        >
          <div className="flex items-start justify-between gap-4 border-b border-white/8 px-4 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-planka-accent">Inbox</p>
              <h2 className="mt-1 text-lg font-semibold text-planka-text">Notification inbox</h2>
              <p className="text-xs text-planka-text-muted">
                {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                void markAllRead();
              }}
              disabled={unreadCount === 0 || isMarkingAllRead}
              className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-planka-text-muted transition hover:border-white/20 hover:text-planka-text disabled:cursor-not-allowed disabled:opacity-45"
            >
              Mark all read
            </button>
          </div>

          <div className="max-h-[22rem] overflow-y-auto px-2 py-2">
            {notifications.length === 0 ? (
              <div className="rounded-[1.25rem] border border-dashed border-white/10 px-4 py-8 text-center">
                <p className="text-sm font-semibold text-planka-text">No notifications yet</p>
                <p className="mt-1 text-xs text-planka-text-muted">
                  Mentions, assignments, and engineering changes will land here.
                </p>
              </div>
            ) : (
              <ul aria-label="Notifications" className="space-y-2">
                {notifications.map((notification) => (
                  <li
                    key={notification.recipient.id}
                    className={[
                      "rounded-[1.25rem] border px-3 py-3 transition",
                      notification.isUnread
                        ? "border-[#4f89ff]/45 bg-[#13233b]/72"
                        : "border-white/8 bg-black/12"
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-white/10 bg-black/18 px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-planka-text-muted">
                            {sourceLabel(notification)}
                          </span>
                          {notification.workItemIdentifier ? (
                            <span className="rounded-full bg-black/20 px-2 py-0.5 text-[0.68rem] font-semibold text-planka-text-muted">
                              {notification.workItemIdentifier}
                            </span>
                          ) : null}
                          <span className="text-xs text-planka-text-muted">
                            {formatTimestamp(notification.event.createdAt)}
                          </span>
                        </div>
                        <Link
                          href={notification.event.url}
                          className="block truncate text-sm font-semibold text-planka-text transition hover:text-white"
                        >
                          {notification.event.title}
                        </Link>
                        {notification.event.body ? (
                          <p className="line-clamp-2 text-xs leading-5 text-planka-text-muted">
                            {notification.event.body}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <span
                          className={[
                            "rounded-full px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.12em]",
                            notification.isUnread
                              ? "bg-planka-selected text-white"
                              : "border border-white/8 text-planka-text-muted"
                          ].join(" ")}
                        >
                          {notification.isUnread ? "Unread" : "Read"}
                        </span>
                        {notification.isUnread ? (
                          <button
                            type="button"
                            onClick={() => {
                              void markRead(notification);
                            }}
                            disabled={pendingNotificationId === notification.recipient.id}
                            className="text-xs font-semibold text-planka-accent transition hover:text-white disabled:opacity-50"
                          >
                            Mark {notification.event.title} read
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {error ? <p className="px-4 pb-3 text-xs font-semibold text-[#f6b0ab]">{error}</p> : null}

          <NotificationPreferences
            workspaceSlug={workspaceSlug}
            preferences={preferences}
            onPreferencesChange={setPreferences}
          />
        </section>
      ) : null}
    </div>
  );
}

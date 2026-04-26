import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { NotificationInboxItem, NotificationPreferenceRecord } from "@the-platform/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NotificationInbox } from "../../../components/notification-inbox";
import { render } from "../../../test/render";

const preferences: NotificationPreferenceRecord = {
  workspaceId: "workspace-1",
  userId: "user-1",
  commentsEnabled: true,
  mentionsEnabled: true,
  assignmentsEnabled: true,
  githubEnabled: true,
  stateChangesEnabled: true,
  createdAt: "2026-04-25T12:00:00.000Z",
  updatedAt: "2026-04-25T12:00:00.000Z"
};

function notification(
  overrides: Partial<NotificationInboxItem> & {
    id: string;
    title: string;
    eventType?: NotificationInboxItem["event"]["eventType"];
    readAt?: string | null;
    workItemIdentifier?: string | null;
  }
): NotificationInboxItem {
  const readAt = overrides.readAt ?? null;

  return {
    event: {
      id: `event-${overrides.id}`,
      workspaceId: "workspace-1",
      projectId: "project-1",
      workItemId: "item-1",
      sourceType: overrides.eventType?.startsWith("github_") ? "github" : "comment",
      sourceId: `source-${overrides.id}`,
      eventType: overrides.eventType ?? "mention_created",
      actorId: "user-2",
      priority: "normal",
      title: overrides.title,
      body: "A teammate needs your attention.",
      url: `/workspaces/platform-ops/projects/OPS?selected=${overrides.workItemIdentifier ?? "OPS-1"}`,
      metadata: null,
      createdAt: "2026-04-25T12:00:00.000Z"
    },
    recipient: {
      id: overrides.id,
      eventId: `event-${overrides.id}`,
      workspaceId: "workspace-1",
      recipientId: "user-1",
      reason: "mention",
      readAt,
      dismissedAt: null,
      createdAt: "2026-04-25T12:01:00.000Z"
    },
    workItemIdentifier: overrides.workItemIdentifier ?? "OPS-1",
    projectKey: "OPS",
    workspaceSlug: "platform-ops",
    isUnread: readAt === null,
    ...overrides
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("NotificationInbox", () => {
  it("shows the unread badge and renders inbox rows with context", () => {
    render(
      <NotificationInbox
        workspaceSlug="platform-ops"
        initialNotifications={[
          notification({ id: "notification-1", title: "Henry mentioned you", workItemIdentifier: "OPS-1" }),
          notification({
            id: "notification-2",
            title: "Production deploy is live",
            eventType: "github_deploy_changed",
            readAt: "2026-04-25T12:05:00.000Z",
            workItemIdentifier: "OPS-2"
          })
        ]}
        initialPreferences={preferences}
      />
    );

    expect(screen.getByLabelText("1 unread notification")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Notifications/i }));

    const inbox = screen.getByRole("dialog", { name: "Notification inbox" });
    const notificationList = within(inbox).getByRole("list", { name: "Notifications" });
    expect(within(inbox).getByRole("link", { name: "Henry mentioned you" })).toHaveAttribute(
      "href",
      "/workspaces/platform-ops/projects/OPS?selected=OPS-1"
    );
    expect(within(notificationList).getByText("Mention")).toBeInTheDocument();
    expect(within(notificationList).getByText("GitHub")).toBeInTheDocument();
    expect(within(notificationList).getByText("OPS-1")).toBeInTheDocument();
    expect(within(notificationList).getByText("Unread")).toBeInTheDocument();
  });

  it("marks a single notification read through the workspace API", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          notification: {
            ...notification({ id: "notification-1", title: "Henry mentioned you" }).recipient,
            readAt: "2026-04-25T12:10:00.000Z"
          }
        })
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <NotificationInbox
        workspaceSlug="platform-ops"
        initialNotifications={[notification({ id: "notification-1", title: "Henry mentioned you" })]}
        initialPreferences={preferences}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Notifications/i }));
    fireEvent.click(screen.getByRole("button", { name: "Mark Henry mentioned you read" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/workspaces/platform-ops/notifications/notification-1",
        expect.objectContaining({ method: "PATCH" })
      );
    });
    expect(screen.queryByLabelText("1 unread notification")).not.toBeInTheDocument();
    expect(screen.getByText("Read")).toBeInTheDocument();
  });

  it("marks every visible notification read", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ updatedCount: 2 })
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <NotificationInbox
        workspaceSlug="platform-ops"
        initialNotifications={[
          notification({ id: "notification-1", title: "Henry mentioned you" }),
          notification({ id: "notification-2", title: "OPS-2 moved to Review", eventType: "state_changed" })
        ]}
        initialPreferences={preferences}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Notifications/i }));
    fireEvent.click(screen.getByRole("button", { name: "Mark all read" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/workspaces/platform-ops/notifications/mark-all-read",
        expect.objectContaining({ method: "POST" })
      );
    });
    expect(screen.queryByLabelText("2 unread notifications")).not.toBeInTheDocument();
    expect(screen.getAllByText("Read")).toHaveLength(2);
  });

  it("updates coarse notification preferences from the inbox panel", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          preferences: {
            ...preferences,
            githubEnabled: false
          }
        })
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <NotificationInbox
        workspaceSlug="platform-ops"
        initialNotifications={[]}
        initialPreferences={preferences}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Notifications/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: "GitHub" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/workspaces/platform-ops/notification-preferences",
        expect.objectContaining({
          body: JSON.stringify({ githubEnabled: false }),
          method: "PATCH"
        })
      );
    });
    expect(screen.getByRole("checkbox", { name: "GitHub" })).not.toBeChecked();
  });
});

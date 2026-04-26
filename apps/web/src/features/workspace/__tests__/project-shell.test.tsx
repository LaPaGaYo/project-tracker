import { cleanup, screen } from "@testing-library/react";
import type { NotificationInboxItem, NotificationPreferenceRecord, WorkspaceSummary } from "@the-platform/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "../../../components/app-shell";
import { render } from "../../../test/render";
import type { AppSession } from "../../../server/workspaces/types";
import { ProjectShell } from "../project-shell";

const useSearchParams = vi.hoisted(() => vi.fn());
const useSelectedLayoutSegment = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useSearchParams,
  useSelectedLayoutSegment
}));

afterEach(() => {
  cleanup();
  useSearchParams.mockReset();
  useSelectedLayoutSegment.mockReset();
});

const session: AppSession = {
  userId: "user-1",
  email: "henry@example.com",
  displayName: "Henry",
  provider: "demo"
};

const workspaces: WorkspaceSummary[] = [
  {
    id: "workspace-1",
    name: "Platform Ops",
    slug: "platform-ops",
    role: "owner",
    createdAt: "2026-04-20T12:00:00.000Z",
    updatedAt: "2026-04-20T12:00:00.000Z"
  },
  {
    id: "workspace-2",
    name: "Growth Lab",
    slug: "growth-lab",
    role: "member",
    createdAt: "2026-04-20T12:00:00.000Z",
    updatedAt: "2026-04-20T12:00:00.000Z"
  }
];

const notificationPreferences: NotificationPreferenceRecord = {
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

const notification: NotificationInboxItem = {
  event: {
    id: "event-1",
    workspaceId: "workspace-1",
    projectId: "project-1",
    workItemId: "item-1",
    sourceType: "comment",
    sourceId: "comment-1",
    eventType: "mention_created",
    actorId: "user-2",
    priority: "normal",
    title: "Henry mentioned you",
    body: "A teammate needs your attention.",
    url: "/workspaces/platform-ops/projects/OPS?selected=OPS-1",
    metadata: null,
    createdAt: "2026-04-25T12:00:00.000Z"
  },
  recipient: {
    id: "notification-1",
    eventId: "event-1",
    workspaceId: "workspace-1",
    recipientId: "user-1",
    reason: "mention",
    readAt: null,
    dismissedAt: null,
    createdAt: "2026-04-25T12:01:00.000Z"
  },
  workItemIdentifier: "OPS-1",
  projectKey: "OPS",
  workspaceSlug: "platform-ops",
  isUnread: true
};

describe("AppShell", () => {
  it("renders the global workspace shell around project content", () => {
    render(
      <AppShell
        currentWorkspaceId="workspace-1"
        isClerkEnabled={false}
        session={session}
        workspaces={workspaces}
      >
        <div>Board content</div>
      </AppShell>
    );

    expect(screen.getByRole("link", { name: "The Platform" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Platform Ops" })).toHaveAttribute(
      "href",
      "/workspaces/platform-ops/projects"
    );
    expect(screen.getByRole("link", { name: "Growth Lab" })).toHaveAttribute(
      "href",
      "/workspaces/growth-lab/projects"
    );
    expect(screen.getByText("Henry")).toBeInTheDocument();
    expect(screen.getByText("demo")).toBeInTheDocument();
    expect(screen.getByText("Board content")).toBeInTheDocument();
  });
});

describe("ProjectShell", () => {
  it("renders the project notification inbox in the header", () => {
    useSearchParams.mockReturnValue(new URLSearchParams("view=overview"));
    useSelectedLayoutSegment.mockReturnValue(null);

    render(
      <ProjectShell
        workspaceSlug="platform-ops"
        projectKey="OPS"
        projectTitle="Platform Ops"
        projectDescription="Execution surface redesign"
        canCreate
        notificationInbox={{
          notifications: [notification],
          preferences: notificationPreferences,
          unreadCount: 1
        }}
        stage={{
          label: "Current stage",
          title: "Phase 2: Execution Surface",
          progressLabel: "3/7 plan items complete"
        }}
      >
        <div>Board content</div>
      </ProjectShell>
    );

    expect(screen.getByRole("button", { name: /Notifications/i })).toBeInTheDocument();
    expect(screen.getByLabelText("1 unread notification")).toBeInTheDocument();
  });
});

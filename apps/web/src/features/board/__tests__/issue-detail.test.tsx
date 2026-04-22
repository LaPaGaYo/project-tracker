import { screen } from "@testing-library/react";
import type {
  CommentRecord,
  DescriptionVersionRecord,
  WorkspaceMemberRecord,
  WorkflowStateRecord,
  WorkItemRecord
} from "@the-platform/shared";
import { describe, expect, it, vi } from "vitest";

import { DetailPanel } from "../../../components/detail-panel";
import { render } from "../../../test/render";
import type { TimelineEntry } from "../../../components/timeline";

const router = vi.hoisted(() => ({
  back: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn()
}));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams("view=board")
}));

const item: WorkItemRecord = {
  id: "item-1",
  projectId: "project-1",
  workspaceId: "workspace-1",
  identifier: "OPS-1",
  title: "Build board shell",
  description: "Keep create and edit flows alive while the shell changes.",
  status: "Todo",
  type: "task",
  parentId: null,
  assigneeId: "henry",
  priority: "high",
  labels: ["ui", "phase5"],
  workflowStateId: "state-active",
  position: 1000,
  blockedReason: null,
  dueDate: null,
  completedAt: null,
  createdAt: "2026-04-20T12:00:00.000Z",
  updatedAt: "2026-04-20T12:00:00.000Z"
};

const members: WorkspaceMemberRecord[] = [
  {
    workspaceId: "workspace-1",
    userId: "henry",
    role: "owner",
    invitedAt: "2026-04-20T12:00:00.000Z",
    joinedAt: "2026-04-20T12:00:00.000Z"
  }
];

const states: WorkflowStateRecord[] = [
  {
    id: "state-backlog",
    projectId: "project-1",
    name: "Backlog",
    category: "backlog",
    position: 0,
    color: null,
    createdAt: "2026-04-20T12:00:00.000Z",
    updatedAt: "2026-04-20T12:00:00.000Z"
  },
  {
    id: "state-active",
    projectId: "project-1",
    name: "In Progress",
    category: "active",
    position: 1,
    color: null,
    createdAt: "2026-04-20T12:00:00.000Z",
    updatedAt: "2026-04-20T12:00:00.000Z"
  }
];

const comments: CommentRecord[] = [
  {
    id: "comment-1",
    workItemId: "item-1",
    authorId: "henry",
    content: "Pair with the CI owner before merging.",
    createdAt: "2026-04-20T13:00:00.000Z",
    updatedAt: "2026-04-20T13:00:00.000Z",
    deletedAt: null
  }
];

const versions: DescriptionVersionRecord[] = [
  {
    id: "version-1",
    workItemId: "item-1",
    content: "Keep create and edit flows alive.",
    authorId: "henry",
    createdAt: "2026-04-20T12:30:00.000Z"
  }
];

const timeline: TimelineEntry[] = [
  {
    kind: "activity",
    createdAt: "2026-04-20T12:45:00.000Z",
    activity: {
      id: "activity-1",
      workspaceId: "workspace-1",
      entityType: "work_item",
      entityId: "item-1",
      action: "assigned",
      actorId: "henry",
      metadata: {
        from: null,
        to: "henry"
      },
      createdAt: "2026-04-20T12:45:00.000Z"
    }
  }
];

describe("DetailPanel", () => {
  it("renders the functional issue detail surface with metadata and comments", () => {
    render(
      <DetailPanel
        workspaceSlug="platform-ops"
        projectKey="OPS"
        basePath="/workspaces/platform-ops/projects/OPS"
        item={item}
        comments={comments}
        versions={versions}
        timeline={timeline}
        members={members}
        states={states}
        sessionUserId="henry"
        membershipRole="owner"
      />
    );

    expect(screen.getAllByText("OPS-1")).toHaveLength(2);
    expect(screen.getByDisplayValue("Build board shell")).toBeInTheDocument();
    expect(screen.getByText("Description history")).toBeInTheDocument();
    expect(screen.getByText("Comments")).toBeInTheDocument();
    expect(screen.getByText("Timeline")).toBeInTheDocument();
    expect(screen.getByLabelText("Priority")).toHaveValue("high");
    expect(screen.getByLabelText("Type")).toHaveValue("task");
    expect(screen.getByLabelText("State")).toHaveValue("state-active");
    expect(screen.getByLabelText("Assignee")).toHaveValue("henry");
    expect(screen.getByText("Pair with the CI owner before merging.")).toBeInTheDocument();
    expect(screen.getByText("Assignment updated")).toBeInTheDocument();
  });
});

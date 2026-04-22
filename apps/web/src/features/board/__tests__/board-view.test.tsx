import { fireEvent, screen, within } from "@testing-library/react";
import type { WorkspaceMemberRecord, WorkflowStateRecord, WorkItemRecord } from "@the-platform/shared";
import { describe, expect, it, vi } from "vitest";

import { BoardView } from "../../../components/board-view";
import { render } from "../../../test/render";

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

const items: WorkItemRecord[] = [
  {
    id: "item-1",
    projectId: "project-1",
    workspaceId: "workspace-1",
    identifier: "OPS-1",
    title: "Build board shell",
    description: "Show the backlog card on the functional project surface.",
    status: "Todo",
    type: "task",
    parentId: null,
    assigneeId: "henry",
    priority: "high",
    labels: ["ui"],
    workflowStateId: "state-backlog",
    position: 0,
    blockedReason: null,
    dueDate: null,
    completedAt: null,
    createdAt: "2026-04-20T12:00:00.000Z",
    updatedAt: "2026-04-20T12:00:00.000Z"
  },
  {
    id: "item-2",
    projectId: "project-1",
    workspaceId: "workspace-1",
    identifier: "OPS-2",
    title: "Wire filters",
    description: "",
    status: "Todo",
    type: "subtask",
    parentId: "item-1",
    assigneeId: "henry",
    priority: "medium",
    labels: null,
    workflowStateId: "state-backlog",
    position: 1000,
    blockedReason: null,
    dueDate: null,
    completedAt: null,
    createdAt: "2026-04-20T12:00:00.000Z",
    updatedAt: "2026-04-20T12:00:00.000Z"
  }
];

describe("BoardView", () => {
  it("renders workflow columns and opens the clicked card", () => {
    const onOpenItem = vi.fn();

    render(
      <BoardView
        workspaceSlug="platform-ops"
        projectKey="OPS"
        items={items}
        members={members}
        states={states}
        onOpenItem={onOpenItem}
      />
    );

    const backlogColumn = screen.getByRole("region", { name: "Backlog" });
    const activeColumn = screen.getByRole("region", { name: "In Progress" });

    expect(within(backlogColumn).getByRole("heading", { name: "Backlog" })).toBeInTheDocument();
    expect(within(activeColumn).getByRole("heading", { name: "In Progress" })).toBeInTheDocument();
    expect(within(backlogColumn).getByText("OPS-1")).toBeInTheDocument();
    expect(within(backlogColumn).getByText("Build board shell")).toBeInTheDocument();
    expect(within(backlogColumn).getByText("1 subtasks")).toBeInTheDocument();
    expect(within(activeColumn).getByText("No items here yet")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Build board shell"));

    expect(onOpenItem).toHaveBeenCalledWith("OPS-1");
  });
});

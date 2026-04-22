import { fireEvent, screen } from "@testing-library/react";
import type { WorkspaceMemberRecord, WorkflowStateRecord } from "@the-platform/shared";
import { describe, expect, it, vi } from "vitest";

import { FilterBar } from "../../../components/filter-bar";
import { render } from "../../../test/render";

const router = vi.hoisted(() => ({
  replace: vi.fn()
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/workspaces/platform-ops/projects/OPS",
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams("")
}));

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
  }
];

describe("FilterBar", () => {
  it("starts compact and expands the full filter controls on demand", () => {
    render(<FilterBar members={members} states={states} />);

    expect(screen.getByRole("button", { name: "Filters" })).toBeInTheDocument();
    expect(screen.queryByText("Type")).not.toBeInTheDocument();
    expect(screen.queryByText("Priority")).not.toBeInTheDocument();
    expect(screen.queryByText("State")).not.toBeInTheDocument();
    expect(screen.queryByText("Assignee")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Filters" }));

    expect(screen.getByText("Type")).toBeInTheDocument();
    expect(screen.getByText("Priority")).toBeInTheDocument();
    expect(screen.getByText("State")).toBeInTheDocument();
    expect(screen.getByText("Assignee")).toBeInTheDocument();
  });
});

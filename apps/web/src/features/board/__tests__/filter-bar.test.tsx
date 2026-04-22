import { fireEvent, screen, waitFor } from "@testing-library/react";
import type { WorkspaceMemberRecord, WorkflowStateRecord } from "@the-platform/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FilterBar } from "../../../components/filter-bar";
import { render } from "../../../test/render";

const router = vi.hoisted(() => ({
  replace: vi.fn()
}));
const useSearchParamsMock = vi.hoisted(() => vi.fn<() => URLSearchParams>());

vi.mock("next/navigation", () => ({
  usePathname: () => "/workspaces/platform-ops/projects/OPS",
  useRouter: () => router,
  useSearchParams: () => useSearchParamsMock()
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
  beforeEach(() => {
    router.replace.mockReset();
    useSearchParamsMock.mockReturnValue(new URLSearchParams(""));
  });

  it("keeps the compact filter strip visible on the board surface", () => {
    render(<FilterBar members={members} states={states} />);

    expect(screen.getByText("Type")).toBeInTheDocument();
    expect(screen.getByText("Priority")).toBeInTheDocument();
    expect(screen.getByText("State")).toBeInTheDocument();
    expect(screen.getByText("Assignee")).toBeInTheDocument();
  });

  it("writes filter selections into the query string and clears them back to the base path", async () => {
    useSearchParamsMock.mockReturnValue(new URLSearchParams("type=task&priority=high"));

    render(<FilterBar members={members} states={states} />);

    fireEvent.click(screen.getByRole("button", { name: "epic" }));

    const expectedNextQuery = new URLSearchParams({
      type: "task,epic",
      priority: "high"
    }).toString();

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith(
        `/workspaces/platform-ops/projects/OPS?${expectedNextQuery}`,
        { scroll: false }
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));

    await waitFor(() => {
      expect(router.replace).toHaveBeenLastCalledWith("/workspaces/platform-ops/projects/OPS", {
        scroll: false
      });
    });
  });
});

import { screen } from "@testing-library/react";
import type { WorkflowStateRecord } from "@the-platform/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CreateWorkItemDialog } from "../create-work-item-dialog";
import { render } from "../../test/render";

const usePathnameMock = vi.hoisted(() => vi.fn<() => string>());
const useSearchParamsMock = vi.hoisted(() => vi.fn<() => URLSearchParams>());

vi.mock("next/navigation", () => ({
  usePathname: (): string => usePathnameMock(),
  useSearchParams: (): URLSearchParams => useSearchParamsMock()
}));

vi.mock("@/app/actions", () => ({
  createWorkItemAction: vi.fn()
}));

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

describe("CreateWorkItemDialog", () => {
  beforeEach(() => {
    usePathnameMock.mockReturnValue("/workspaces/platform-ops/projects/OPS");
    useSearchParamsMock.mockReturnValue(new URLSearchParams("view=list&type=task"));
    window.history.replaceState(
      {},
      "",
      "/workspaces/platform-ops/projects/OPS?view=list&type=task#create-work-item"
    );
  });

  it("opens the create form from the deep-link anchor and preserves the current return location", () => {
    const { container } = render(
      <CreateWorkItemDialog
        workspaceSlug="platform-ops"
        projectKey="OPS"
        states={states}
        canCreate
      />
    );

    const details = container.querySelector("details");
    const returnToInput = container.querySelector('input[name="returnTo"]');

    expect(details).toHaveAttribute("open");
    expect(returnToInput).toHaveValue(
      "/workspaces/platform-ops/projects/OPS?view=list&type=task#create-work-item"
    );
  });

  it("renders stage-aware planning controls in the create form", () => {
    render(
      <CreateWorkItemDialog
        workspaceSlug="platform-ops"
        projectKey="OPS"
        states={states}
        canCreate
      />
    );

    expect(screen.getByLabelText("Stage")).toBeInTheDocument();
    expect(screen.getByLabelText("Plan item")).toBeInTheDocument();
  });
});

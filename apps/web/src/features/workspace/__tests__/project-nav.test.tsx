import { cleanup, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { render } from "../../../test/render";

import { ProjectNav } from "../project-nav";
import { ViewToolbar } from "../view-toolbar";

const usePathname = vi.hoisted(() => vi.fn());
const useSearchParams = vi.hoisted(() => vi.fn());
const useSelectedLayoutSegment = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  usePathname,
  useSearchParams,
  useSelectedLayoutSegment
}));

afterEach(() => {
  cleanup();
  usePathname.mockReset();
  useSearchParams.mockReset();
  useSelectedLayoutSegment.mockReset();
});

describe("ProjectNav", () => {
  it("shows the current stage ribbon for the functional project workspace", () => {
    render(
      <ProjectNav
        stageLabel="Current stage"
        stageTitle="Phase 2: Execution Surface"
        progressLabel="3/7 plan items complete"
      />
    );

    expect(screen.getByRole("region", { name: "Current stage" })).toBeInTheDocument();
    expect(screen.getByText("Phase 2: Execution Surface")).toBeInTheDocument();
    expect(screen.getByText("3/7 plan items complete")).toBeInTheDocument();
  });

  it("sends the create issue CTA to the board create-work-item anchor", () => {
    render(
      <ProjectNav
        canCreate
        createIssueHref="/workspaces/platform-ops/projects/OPS?view=board#create-work-item"
        stageLabel="Current stage"
        stageTitle="Phase 2: Execution Surface"
        progressLabel="3/7 plan items complete"
      />
    );

    expect(screen.getByRole("link", { name: "Create issue" })).toHaveAttribute(
      "href",
      "/workspaces/platform-ops/projects/OPS?view=board#create-work-item"
    );
  });
});

describe("ViewToolbar", () => {
  it("renders the functional project routes and marks Board active on the base path", () => {
    usePathname.mockReturnValue("/workspaces/platform-ops/projects/OPS");
    useSearchParams.mockReturnValue(new URLSearchParams(""));
    useSelectedLayoutSegment.mockReturnValue(null);

    render(<ViewToolbar workspaceSlug="platform-ops" projectKey="OPS" />);

    const navigation = screen.getByRole("navigation", { name: "Project views" });

    expect(within(navigation).getByRole("link", { name: "Board" })).toHaveAttribute(
      "href",
      "/workspaces/platform-ops/projects/OPS?view=board"
    );
    expect(within(navigation).getByRole("link", { name: "List" })).toHaveAttribute(
      "href",
      "/workspaces/platform-ops/projects/OPS?view=list"
    );
    expect(within(navigation).getByRole("link", { name: "Plan" })).toHaveAttribute(
      "href",
      "/workspaces/platform-ops/projects/OPS/plan"
    );
    expect(within(navigation).getByRole("link", { name: "Overview" })).toHaveAttribute(
      "href",
      "/workspaces/platform-ops/projects/OPS/overview"
    );
    expect(within(navigation).getByRole("link", { name: "Board" })).toHaveAttribute("aria-current", "page");
  });

  it("marks List active when the board surface is opened with list query state", () => {
    usePathname.mockReturnValue("/workspaces/platform-ops/projects/OPS");
    useSearchParams.mockReturnValue(new URLSearchParams("view=list"));
    useSelectedLayoutSegment.mockReturnValue(null);

    render(<ViewToolbar workspaceSlug="platform-ops" projectKey="OPS" />);

    expect(screen.getByRole("link", { name: "List" })).toHaveAttribute("aria-current", "page");
  });

  it("marks Plan active when the plan segment is selected", () => {
    usePathname.mockReturnValue("/workspaces/platform-ops/projects/OPS/plan");
    useSearchParams.mockReturnValue(new URLSearchParams(""));
    useSelectedLayoutSegment.mockReturnValue("plan");

    render(<ViewToolbar workspaceSlug="platform-ops" projectKey="OPS" />);

    expect(screen.getByRole("link", { name: "Plan" })).toHaveAttribute("aria-current", "page");
  });

  it("marks Board active when the explicit board query flag is present", () => {
    usePathname.mockReturnValue("/workspaces/platform-ops/projects/OPS");
    useSearchParams.mockReturnValue(new URLSearchParams("view=board"));
    useSelectedLayoutSegment.mockReturnValue(null);

    render(<ViewToolbar workspaceSlug="platform-ops" projectKey="OPS" />);

    expect(screen.getByRole("link", { name: "Board" })).toHaveAttribute("aria-current", "page");
  });

  it("does not misread the project key as a child route segment", () => {
    usePathname.mockReturnValue("/workspaces/platform-ops/projects/plan");
    useSearchParams.mockReturnValue(new URLSearchParams("view=board"));
    useSelectedLayoutSegment.mockReturnValue(null);

    render(<ViewToolbar workspaceSlug="platform-ops" projectKey="plan" />);

    expect(screen.getByRole("link", { name: "Board" })).toHaveAttribute("aria-current", "page");
  });
});

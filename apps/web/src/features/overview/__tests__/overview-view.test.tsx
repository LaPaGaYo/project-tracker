import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { render } from "../../../test/render";

import { OverviewView } from "../overview-view";

const overview = {
  currentStage: "Phase 8: Readiness",
  health: ["Scope: stable", "Delivery risk: low", "Engineering risk: stable"],
  milestones: [
    { label: "Notifications", monthStart: 0, monthSpan: 2, tone: "completed" as const },
    { label: "Readiness", monthStart: 2, monthSpan: 2, tone: "current" as const }
  ],
  readiness: {
    status: "Ready with risk" as const,
    tone: "warning" as const,
    narrative: "Ready with risk: 1 PR is awaiting review.",
    metrics: [
      { label: "Plan", value: "4/5 done", detail: "1 current-stage item remains", tone: "warning" as const },
      { label: "Issues", value: "1 urgent", detail: "No blocked work", tone: "warning" as const },
      { label: "GitHub", value: "1 review", detail: "Checks are passing", tone: "warning" as const },
      { label: "Notifications", value: "2 unread", detail: "1 high priority", tone: "warning" as const }
    ],
    decisionCues: [
      { label: "Ship gate", value: "In review", tone: "warning" as const },
      { label: "Primary blocker", value: "None", tone: "success" as const }
    ],
    actions: [
      {
        id: "review-pr-task-1",
        title: "Review OPS-4 pull request",
        detail: "Review requested before release.",
        href: "/workspaces/platform-ops/projects/OPS/engineering",
        sourceType: "github" as const,
        priority: "medium" as const
      }
    ]
  }
};

describe("OverviewView", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders readiness as the primary overview while keeping the milestone roadmap visible", () => {
    render(
      <OverviewView
        brief="Build a Jira-style execution shell, bring GitHub live engineering state into issue workflows, and keep project alignment lightweight and readable."
        overview={overview}
        workspaceSlug="platform-ops"
        projectKey="OPS"
      />
    );

    expect(screen.getByText("Readiness command center")).toBeInTheDocument();
    expect(screen.getByText("Ready with risk")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    expect(screen.getByText("Ready with risk: 1 PR is awaiting review.")).toBeInTheDocument();
    expect(screen.getByText("4/5 done")).toBeInTheDocument();
    expect(screen.getByText("Decision cues")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Review OPS-4 pull request/i })).toHaveAttribute(
      "href",
      "/workspaces/platform-ops/projects/OPS/engineering"
    );
    expect(screen.getByText("Milestone roadmap")).toBeInTheDocument();
  });

  it("searches readiness signals from the overview", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          query: "pipeline",
          results: [
            {
              id: "work-item-1",
              type: "work_item",
              title: "OPS-1 Fix release pipeline",
              snippet: "Pipeline blocks the release.",
              href: "/workspaces/platform-ops/projects/OPS?selected=OPS-1",
              chip: "Risk",
              rank: 0
            }
          ]
        })
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<OverviewView workspaceSlug="platform-ops" projectKey="OPS" brief="Project brief." overview={overview} />);

    fireEvent.change(screen.getByPlaceholderText("Search blockers, PRs, comments..."), {
      target: { value: "pipeline" }
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/workspaces/platform-ops/projects/OPS/search?q=pipeline");
    });
    expect(await screen.findByRole("link", { name: /OPS-1 Fix release pipeline/i })).toHaveAttribute(
      "href",
      "/workspaces/platform-ops/projects/OPS?selected=OPS-1"
    );
  });
});

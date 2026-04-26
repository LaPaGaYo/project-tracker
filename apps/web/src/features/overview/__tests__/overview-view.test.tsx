import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { render } from "../../../test/render";

import { OverviewView } from "../overview-view";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });

  return { promise, resolve };
}

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

  it("shows explicit empty readiness actions when the current stage has no blocking work", () => {
    render(
      <OverviewView
        brief="Project brief."
        overview={{
          ...overview,
          readiness: {
            ...overview.readiness,
            status: "Ready",
            tone: "success",
            narrative: "Ready: current stage has no blocking work and engineering signals are stable.",
            actions: []
          }
        }}
        workspaceSlug="platform-ops"
        projectKey="OPS"
      />
    );

    expect(
      screen.getByText("No readiness actions. The current stage has no blocking work or high-priority signals.")
    ).toBeInTheDocument();
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

    expect(screen.getByRole("searchbox", { name: "Readiness search" })).toBeInTheDocument();

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

  it("shows readiness search guidance before a valid query is entered", () => {
    render(<OverviewView workspaceSlug="platform-ops" projectKey="OPS" brief="Project brief." overview={overview} />);

    expect(
      screen.getByText("Search across blockers, PRs, comments, plan items, and notifications.")
    ).toBeInTheDocument();

    fireEvent.change(screen.getByRole("searchbox", { name: "Readiness search" }), {
      target: { value: "p" }
    });

    expect(
      screen.getByText("Search across blockers, PRs, comments, plan items, and notifications.")
    ).toBeInTheDocument();
  });

  it("shows an empty readiness search state for valid queries without results", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results: [] })
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<OverviewView workspaceSlug="platform-ops" projectKey="OPS" brief="Project brief." overview={overview} />);

    fireEvent.change(screen.getByRole("searchbox", { name: "Readiness search" }), {
      target: { value: "missing" }
    });

    expect(await screen.findByText('No readiness signals found for "missing".')).toBeInTheDocument();
    expect(
      screen.queryByText("Search across blockers, PRs, comments, plan items, and notifications.")
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Search failed. Try again from the project overview.")).not.toBeInTheDocument();
  });

  it("shows an error instead of crashing when readiness search fails", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("network failed"))
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ query: "pipeline" })
      });
    vi.stubGlobal("fetch", fetchMock);

    render(<OverviewView workspaceSlug="platform-ops" projectKey="OPS" brief="Project brief." overview={overview} />);

    fireEvent.change(screen.getByRole("searchbox", { name: "Readiness search" }), {
      target: { value: "network" }
    });

    expect(await screen.findByText("Search failed. Try again from the project overview.")).toBeInTheDocument();
    expect(
      screen.queryByText("Search across blockers, PRs, comments, plan items, and notifications.")
    ).not.toBeInTheDocument();
    expect(screen.queryByText('No readiness signals found for "network".')).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("searchbox", { name: "Readiness search" }), {
      target: { value: "pipeline" }
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/workspaces/platform-ops/projects/OPS/search?q=pipeline");
    });
    expect(await screen.findByText("Search failed. Try again from the project overview.")).toBeInTheDocument();
  });

  it("keeps stale readiness search responses from replacing newer results", async () => {
    const firstSearch = deferred<{
      ok: boolean;
      json: () => Promise<{ results: unknown[] }>;
    }>();
    const secondSearch = deferred<{
      ok: boolean;
      json: () => Promise<{ results: unknown[] }>;
    }>();
    const fetchMock = vi.fn().mockReturnValueOnce(firstSearch.promise).mockReturnValueOnce(secondSearch.promise);
    vi.stubGlobal("fetch", fetchMock);

    render(<OverviewView workspaceSlug="platform-ops" projectKey="OPS" brief="Project brief." overview={overview} />);

    const input = screen.getByRole("searchbox", { name: "Readiness search" });
    fireEvent.change(input, { target: { value: "pipe" } });
    fireEvent.change(input, { target: { value: "pipeline" } });

    secondSearch.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          results: [
            {
              id: "latest-result",
              type: "work_item",
              title: "OPS-2 Latest pipeline result",
              snippet: "Newest search result.",
              href: "/workspaces/platform-ops/projects/OPS?selected=OPS-2",
              chip: "Current",
              rank: 0
            }
          ]
        })
    });

    expect(await screen.findByRole("link", { name: /OPS-2 Latest pipeline result/i })).toBeInTheDocument();

    firstSearch.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          results: [
            {
              id: "stale-result",
              type: "work_item",
              title: "OPS-1 Stale pipeline result",
              snippet: "Old search result.",
              href: "/workspaces/platform-ops/projects/OPS?selected=OPS-1",
              chip: "Stale",
              rank: 0
            }
          ]
        })
    });

    await waitFor(() => {
      expect(screen.queryByRole("link", { name: /OPS-1 Stale pipeline result/i })).not.toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: /OPS-2 Latest pipeline result/i })).toBeInTheDocument();
  });

  it("does not repopulate readiness search results after the query is cleared", async () => {
    const search = deferred<{
      ok: boolean;
      json: () => Promise<{ results: unknown[] }>;
    }>();
    const fetchMock = vi.fn().mockReturnValueOnce(search.promise);
    vi.stubGlobal("fetch", fetchMock);

    render(<OverviewView workspaceSlug="platform-ops" projectKey="OPS" brief="Project brief." overview={overview} />);

    const input = screen.getByRole("searchbox", { name: "Readiness search" });
    fireEvent.change(input, { target: { value: "pipeline" } });
    fireEvent.change(input, { target: { value: "" } });

    search.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          results: [
            {
              id: "late-result",
              type: "work_item",
              title: "OPS-3 Late pipeline result",
              snippet: "Late result.",
              href: "/workspaces/platform-ops/projects/OPS?selected=OPS-3",
              chip: "Late",
              rank: 0
            }
          ]
        })
    });

    await waitFor(() => {
      expect(screen.queryByRole("link", { name: /OPS-3 Late pipeline result/i })).not.toBeInTheDocument();
    });
  });
});

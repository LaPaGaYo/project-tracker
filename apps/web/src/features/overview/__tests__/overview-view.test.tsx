import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { render } from "../../../test/render";

import { OverviewView } from "../overview-view";

const overview = {
  currentStage: "Phase 2: Execution Surface",
  health: ["Scope: stable", "Delivery risk: low", "Engineering risk: 1 failing check"],
  milestones: [
    { label: "Foundation Alignment", monthStart: 0, monthSpan: 2, tone: "completed" as const },
    { label: "Execution Surface", monthStart: 2, monthSpan: 2, tone: "current" as const },
    { label: "Engineering Signals", monthStart: 4, monthSpan: 2, tone: "upcoming" as const }
  ]
};

describe("OverviewView", () => {
  it("renders a lightweight milestone roadmap and current project health", () => {
    render(
      <OverviewView
        brief="Build a Jira-style execution shell, bring GitHub live engineering state into issue workflows, and keep project alignment lightweight and readable."
        overview={overview}
      />
    );

    expect(screen.getByText("Milestone roadmap")).toBeInTheDocument();
    expect(screen.getAllByText("Foundation Alignment")).toHaveLength(2);
    expect(screen.getAllByText("Execution Surface")).toHaveLength(2);
    expect(screen.getAllByText("Engineering Signals")).toHaveLength(2);
    expect(screen.getByText("Phase 2: Execution Surface")).toBeInTheDocument();
    expect(screen.getByText("Engineering risk: 1 failing check")).toBeInTheDocument();
  });
});

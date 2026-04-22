import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { render } from "../../../test/render";

import { PlanView } from "../plan-view";

const plan = {
  currentStage: {
    label: "Current stage",
    title: "Phase 2: Execution Surface",
    progressLabel: "1/2 plan items complete",
    goal: "Align the board, plan, and issue drawer model before rollout."
  },
  stages: [
    {
      label: "Completed stage",
      title: "Phase 1: Foundation Alignment",
      progressLabel: "1/1 plan items complete"
    },
    {
      label: "Current stage",
      title: "Phase 2: Execution Surface",
      progressLabel: "1/2 plan items complete"
    }
  ],
  items: [
    {
      title: "Finalize board card hierarchy and issue drawer model",
      description: "The redesigned board and issue detail model are stable enough for implementation.",
      linkedIssues: ["OPS-1", "OPS-2"],
      stageTitle: "Phase 2: Execution Surface"
    }
  ],
  gates: [
    {
      title: "Phase 2: Execution Surface gate",
      description: "Gate status: In review. Align the board, plan, and issue drawer model before rollout.",
      linkedIssues: ["OPS-1", "OPS-2"],
      stageTitle: "Phase 2: Execution Surface"
    }
  ]
};

describe("PlanView", () => {
  it("renders the stage-based plan surface with a current-stage panel", () => {
    render(<PlanView plan={plan} />);

    expect(screen.getByRole("heading", { name: "Plan" })).toBeInTheDocument();
    const currentStage = screen.getByRole("region", { name: "Current stage" });
    expect(within(currentStage).getByText("Current stage")).toBeInTheDocument();
    expect(within(currentStage).getByRole("heading", { name: "Phase 2: Execution Surface" })).toBeInTheDocument();
    expect(screen.getByText("Finalize board card hierarchy and issue drawer model")).toBeInTheDocument();
    expect(
      within(screen.getByRole("article", { name: "Finalize board card hierarchy and issue drawer model" })).getByText(
        "Linked issues: OPS-1, OPS-2"
      )
    ).toBeInTheDocument();
    expect(screen.getByText("Phase 2: Execution Surface gate")).toBeInTheDocument();
    expect(screen.getByText("Align the board, plan, and issue drawer model before rollout.")).toBeInTheDocument();

    const stage = screen.getByRole("region", { name: "Phase 2: Execution Surface" });
    expect(within(stage).getByText("1/2 plan items complete")).toBeInTheDocument();
  });
});

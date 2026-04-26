import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { render } from "../../../test/render";

import { EngineeringView } from "../engineering-view";

const engineering = {
  repository: "the-platform/platform-ops",
  connectionStatus: "Connected",
  defaultBranch: "main",
  pullRequests: "2 open",
  checks: "1 failing",
  deploys: "Production live",
  issueSummary: ["OPS-1 · merged · passing · phase 2", "OPS-2 · review requested · passing · phase 2"],
  items: [
    {
      taskId: "task-1",
      identifier: "OPS-1",
      title: "Ship engineering telemetry",
      repository: "the-platform/platform-ops",
      defaultBranch: "main",
      branchName: "ops-1-engineering-telemetry",
      pullRequestLabel: "PR Open",
      pullRequestUrl: "https://github.com/the-platform/platform-ops/pull/128",
      pullRequestNumber: 128,
      checkLabel: "CI Failing",
      checkUrl: "https://github.com/the-platform/platform-ops/actions/runs/128",
      deployLabel: "Deploy Staging",
      deployUrl: "https://staging.the-platform.dev",
      deployEnvironment: "staging",
      stageLabel: "Phase 2: Live Engineering",
      summary: "OPS-1 · open · failing · phase 2",
      hasPullRequest: true,
      hasFailingChecks: true,
      hasDeploy: true
    },
    {
      taskId: "task-2",
      identifier: "OPS-2",
      title: "Close rollout review",
      repository: "the-platform/platform-ops",
      defaultBranch: "main",
      branchName: "ops-2-rollout-review",
      pullRequestLabel: "PR Merged",
      pullRequestUrl: "https://github.com/the-platform/platform-ops/pull/129",
      pullRequestNumber: 129,
      checkLabel: "CI Passing",
      checkUrl: "https://github.com/the-platform/platform-ops/actions/runs/129",
      deployLabel: "Deploy Production",
      deployUrl: "https://the-platform.dev",
      deployEnvironment: "production",
      stageLabel: "Phase 2: Live Engineering",
      summary: "OPS-2 · merged · passing · phase 2",
      hasPullRequest: true,
      hasFailingChecks: false,
      hasDeploy: true
    }
  ]
};

describe("EngineeringView", () => {
  it("renders repository-backed engineering sections and sync health", () => {
    render(<EngineeringView engineering={engineering} />);

    expect(screen.getByText("Sync health")).toBeInTheDocument();
    expect(screen.getByText("the-platform/platform-ops")).toBeInTheDocument();
    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(screen.getByText("main")).toBeInTheDocument();
    expect(screen.getByText("Pull requests")).toBeInTheDocument();
    expect(screen.getByText("2 open")).toBeInTheDocument();
    expect(screen.getByText("Production live")).toBeInTheDocument();
    expect(screen.getByText("Linked pull requests")).toBeInTheDocument();
    expect(screen.getByText("Failing checks")).toBeInTheDocument();
    expect(screen.getByText("Deployments")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "PR Open" })).toHaveAttribute(
      "href",
      "https://github.com/the-platform/platform-ops/pull/128"
    );
    expect(screen.getByRole("link", { name: "Deploy Production" })).toHaveAttribute(
      "href",
      "https://the-platform.dev"
    );
    expect(screen.getByText("OPS-1 · merged · passing · phase 2")).toBeInTheDocument();
  });

  it("shows setup guidance when repository signals need a GitHub connection", () => {
    render(
      <EngineeringView
        engineering={{
          ...engineering,
          connectionStatus: "Setup required"
        }}
      />
    );

    expect(screen.getByText("Connect GitHub to populate engineering readiness signals.")).toBeInTheDocument();
    expect(screen.getByText("Linked pull requests")).toBeInTheDocument();
    expect(screen.getByText("Failing checks")).toBeInTheDocument();
    expect(screen.getByText("Deployments")).toBeInTheDocument();
    expect(screen.getByText("OPS-1 · merged · passing · phase 2")).toBeInTheDocument();
  });
});

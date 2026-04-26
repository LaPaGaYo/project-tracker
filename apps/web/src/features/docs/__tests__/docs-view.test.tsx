import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { render } from "../../../test/render";

import { DocsView } from "../docs-view";

const docs = [
  {
    slug: "project-brief",
    title: "Project brief",
    body: "Baseline context for the platform ops workspace."
  },
  {
    slug: "stage-gate-checklist",
    title: "Stage gate checklist",
    body: "Checks the team needs before rollout."
  }
] as const;

describe("DocsView", () => {
  it("renders lightweight collaboration docs from real project content", () => {
    render(<DocsView docs={docs} />);

    expect(screen.getByText("Light collaboration")).toBeInTheDocument();
    expect(screen.getAllByText("Project brief")).toHaveLength(2);
    expect(screen.getByText("Stage gate checklist")).toBeInTheDocument();
    expect(screen.getByText("Baseline context for the platform ops workspace.")).toBeInTheDocument();
  });
});

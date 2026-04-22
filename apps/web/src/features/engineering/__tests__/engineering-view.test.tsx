import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { render } from "../../../test/render";

import { EngineeringView } from "../engineering-view";

const engineering = {
  pullRequests: "2 open",
  checks: "1 failing",
  deploys: "Production live",
  issueSummary: ["OPS-1 · merged · passing · phase 2", "OPS-2 · review requested · passing · phase 2"]
};

describe("EngineeringView", () => {
  it("renders the engineering summary cards and issue feed", () => {
    render(<EngineeringView engineering={engineering} />);

    expect(screen.getByText("Pull requests")).toBeInTheDocument();
    expect(screen.getByText("2 open")).toBeInTheDocument();
    expect(screen.getByText("Production live")).toBeInTheDocument();
    expect(screen.getByText("OPS-1 · merged · passing · phase 2")).toBeInTheDocument();
  });
});

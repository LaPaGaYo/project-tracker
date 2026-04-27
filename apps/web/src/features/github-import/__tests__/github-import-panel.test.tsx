import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { render } from "../../../test/render";

import { GithubImportPanel } from "../github-import-panel";

vi.mock("@/app/actions", () => ({
  importGithubProjectAction: vi.fn()
}));

describe("GithubImportPanel", () => {
  it("renders an admin import form without token fields", () => {
    render(<GithubImportPanel workspaceSlug="platform-ops" canImport />);

    expect(screen.getByRole("heading", { name: "Import from GitHub" })).toBeInTheDocument();
    expect(screen.getByLabelText("Repository owner")).toBeInTheDocument();
    expect(screen.getByLabelText("Repository name")).toBeInTheDocument();
    expect(screen.getByLabelText("Default branch")).toBeInTheDocument();
    expect(screen.getByLabelText("Installation ID")).toBeInTheDocument();
    expect(screen.queryByLabelText(/token/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import repository" })).toBeEnabled();
  });

  it("renders a setup state for users without import access", () => {
    render(<GithubImportPanel workspaceSlug="platform-ops" canImport={false} />);

    expect(screen.getByRole("heading", { name: "Import from GitHub" })).toBeInTheDocument();
    expect(screen.getByText("Workspace admin access is required to import GitHub projects.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Import repository" })).not.toBeInTheDocument();
  });
});

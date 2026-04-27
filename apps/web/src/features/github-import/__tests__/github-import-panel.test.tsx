import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { render } from "../../../test/render";

import { GithubImportPanel } from "../github-import-panel";

vi.mock("@/app/actions", () => ({
  importInstalledGithubRepositoryAction: vi.fn()
}));

describe("GithubImportPanel", () => {
  const installUrl = "https://github.com/apps/the-platform-dev/installations/new?state=platform-ops";
  const repositories = [
    {
      providerRepositoryId: "42",
      owner: "the-platform",
      name: "platform-ops",
      fullName: "the-platform/platform-ops",
      defaultBranch: "main",
      htmlUrl: "https://github.com/the-platform/platform-ops",
      isPrivate: true
    },
    {
      providerRepositoryId: "77",
      owner: "the-platform",
      name: "docs",
      fullName: "the-platform/docs",
      defaultBranch: "trunk",
      htmlUrl: null,
      isPrivate: false
    }
  ];

  it("renders an install CTA before a GitHub installation is active", () => {
    render(
      <GithubImportPanel
        workspaceSlug="platform-ops"
        canImport
        installUrl={installUrl}
        installationId={null}
        repositories={[]}
        errorMessage={null}
        missingConfiguration={[]}
      />
    );

    expect(screen.getByRole("heading", { name: "Import from GitHub" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Install GitHub App" })).toHaveAttribute("href", installUrl);
    expect(screen.queryByLabelText("Repository owner")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Repository name")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Default branch")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Installation ID")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/token/i)).not.toBeInTheDocument();
  });

  it("renders a repository picker for an active installation", () => {
    render(
      <GithubImportPanel
        workspaceSlug="platform-ops"
        canImport
        installUrl={installUrl}
        installationId="987"
        repositories={repositories}
        errorMessage={null}
        missingConfiguration={[]}
      />
    );

    expect(screen.getByText("the-platform/platform-ops")).toBeInTheDocument();
    expect(screen.getByText("the-platform/docs")).toBeInTheDocument();
    expect(screen.getByLabelText("the-platform/platform-ops")).toHaveAttribute("value", "42");
    expect(screen.getByLabelText("the-platform/docs")).toHaveAttribute("value", "77");
    expect(screen.getByLabelText("Project name")).toBeInTheDocument();
    expect(screen.getByLabelText("Project key")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import selected repository" })).toBeEnabled();
    expect(screen.queryByLabelText("Provider repository ID")).not.toBeInTheDocument();
  });

  it("renders a setup state when GitHub App configuration is missing", () => {
    render(
      <GithubImportPanel
        workspaceSlug="platform-ops"
        canImport
        installUrl={null}
        installationId={null}
        repositories={[]}
        errorMessage={null}
        missingConfiguration={["GITHUB_APP_SLUG", "GITHUB_APP_ID"]}
      />
    );

    expect(screen.getByText("GitHub App setup is not configured yet.")).toBeInTheDocument();
    expect(screen.getByText("GITHUB_APP_SLUG, GITHUB_APP_ID")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Install GitHub App" })).not.toBeInTheDocument();
  });

  it("renders an empty state when the installation has no repositories", () => {
    render(
      <GithubImportPanel
        workspaceSlug="platform-ops"
        canImport
        installUrl={installUrl}
        installationId="987"
        repositories={[]}
        errorMessage={null}
        missingConfiguration={[]}
      />
    );

    expect(screen.getByText("No repositories are available from this installation.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Update GitHub App installation" })).toHaveAttribute("href", installUrl);
  });

  it("renders a safe error state when repository loading fails", () => {
    render(
      <GithubImportPanel
        workspaceSlug="platform-ops"
        canImport
        installUrl={installUrl}
        installationId="987"
        repositories={[]}
        errorMessage="GitHub installation repository request failed: 403 Forbidden"
        missingConfiguration={[]}
      />
    );

    expect(screen.getByText("Could not load repositories from this installation.")).toBeInTheDocument();
    expect(screen.getByText("GitHub installation repository request failed: 403 Forbidden")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Update GitHub App installation" })).toHaveAttribute("href", installUrl);
  });

  it("renders a setup state for users without import access", () => {
    render(
      <GithubImportPanel
        workspaceSlug="platform-ops"
        canImport={false}
        installUrl={installUrl}
        installationId={null}
        repositories={[]}
        errorMessage={null}
        missingConfiguration={[]}
      />
    );

    expect(screen.getByRole("heading", { name: "Import from GitHub" })).toBeInTheDocument();
    expect(screen.getByText("Workspace admin access is required to install or import GitHub repositories.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Install GitHub App" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Import selected repository" })).not.toBeInTheDocument();
  });
});

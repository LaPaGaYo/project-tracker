import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { render } from "../../../test/render";

import { GithubImportPanel } from "../github-import-panel";

vi.mock("@/app/actions", () => ({
  importInstalledGithubRepositoryAction: vi.fn(),
}));

describe("GithubImportPanel", () => {
  const installUrl =
    "https://github.com/apps/the-platform-dev/installations/new?state=platform-ops";
  const repositories = [
    {
      providerRepositoryId: "42",
      owner: "the-platform",
      name: "platform-ops",
      fullName: "the-platform/platform-ops",
      defaultBranch: "main",
      htmlUrl: "https://github.com/the-platform/platform-ops",
      isPrivate: true,
    },
    {
      providerRepositoryId: "77",
      owner: "the-platform",
      name: "docs",
      fullName: "the-platform/docs",
      defaultBranch: "trunk",
      htmlUrl: null,
      isPrivate: false,
    },
  ];

  it("renders an install CTA before a GitHub installation is active", () => {
    render(
      <GithubImportPanel
        workspaceSlug="platform-ops"
        canImport
        installUrl={installUrl}
        authorizationUrl={null}
        authorizationStatus="not_required"
        authorizationErrorCode={null}
        authorizedGithubLogin={null}
        installationId={null}
        repositories={[]}
        errorMessage={null}
        missingConfiguration={[]}
      />
    );

    expect(
      screen.getByRole("heading", { name: "Import from GitHub" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Install GitHub App" })
    ).toHaveAttribute("href", installUrl);
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
        authorizationUrl="/github/authorize?workspaceSlug=platform-ops&githubInstallationId=987"
        authorizationStatus="authorized"
        authorizationErrorCode={null}
        authorizedGithubLogin="henry"
        installationId="987"
        repositories={repositories}
        errorMessage={null}
        missingConfiguration={[]}
      />
    );

    expect(screen.getByText("the-platform/platform-ops")).toBeInTheDocument();
    expect(screen.getByText("the-platform/docs")).toBeInTheDocument();
    expect(screen.getByLabelText("the-platform/platform-ops")).toHaveAttribute(
      "value",
      "42"
    );
    expect(screen.getByLabelText("the-platform/docs")).toHaveAttribute(
      "value",
      "77"
    );
    expect(screen.getByLabelText("Project name")).toBeInTheDocument();
    expect(screen.getByLabelText("Project key")).toBeInTheDocument();
    expect(screen.getByText("Authorized as henry")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Import selected repository" })
    ).toBeEnabled();
    expect(
      screen.queryByLabelText("Provider repository ID")
    ).not.toBeInTheDocument();
  });

  it("renders GitHub Issues sync controls and posts issue imports for a connected project", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        summary: {
          created: 2,
          updated: 1,
          skippedPullRequests: 3,
          conflicted: 0,
          failed: 0,
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <GithubImportPanel
        workspaceSlug="acme"
        projectKey="OPS"
        canImport
        installUrl={installUrl}
        authorizationUrl="/github/authorize?workspaceSlug=acme&githubInstallationId=987"
        authorizationStatus="authorized"
        authorizationErrorCode={null}
        authorizedGithubLogin="henry"
        installationId="987"
        repositories={repositories}
        errorMessage={null}
        missingConfiguration={[]}
      />
    );

    expect(
      screen.getByRole("button", { name: "Import GitHub issues" })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Sync issue title and body")).toBeChecked();
    expect(screen.getByLabelText("Sync open and closed state")).toBeChecked();

    fireEvent.click(
      screen.getByRole("button", { name: "Import GitHub issues" })
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/workspaces/acme/projects/OPS/github/issues/import",
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  it("renders an authorize CTA when installation exists without a valid GitHub user proof", () => {
    render(
      <GithubImportPanel
        workspaceSlug="platform-ops"
        canImport
        installUrl={installUrl}
        authorizationUrl="/github/authorize?workspaceSlug=platform-ops&githubInstallationId=987"
        authorizationStatus="missing"
        authorizationErrorCode={null}
        authorizedGithubLogin={null}
        installationId="987"
        repositories={[]}
        errorMessage={null}
        missingConfiguration={[]}
      />
    );

    expect(
      screen.getByText("GitHub user authorization is required.")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Authorize GitHub access" })
    ).toHaveAttribute(
      "href",
      "/github/authorize?workspaceSlug=platform-ops&githubInstallationId=987"
    );
    expect(
      screen.queryByRole("button", { name: "Import selected repository" })
    ).not.toBeInTheDocument();
  });

  it("renders authorized identity next to the repository picker", () => {
    render(
      <GithubImportPanel
        workspaceSlug="platform-ops"
        canImport
        installUrl={installUrl}
        authorizationUrl="/github/authorize?workspaceSlug=platform-ops&githubInstallationId=987"
        authorizationStatus="authorized"
        authorizationErrorCode={null}
        authorizedGithubLogin="henry"
        installationId="987"
        repositories={repositories}
        errorMessage={null}
        missingConfiguration={[]}
      />
    );

    expect(screen.getByText("Authorized as henry")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Import selected repository" })
    ).toBeEnabled();
  });

  it("renders a re-authorization CTA when GitHub user proof is expired", () => {
    render(
      <GithubImportPanel
        workspaceSlug="platform-ops"
        canImport
        installUrl={installUrl}
        authorizationUrl="/github/authorize?workspaceSlug=platform-ops&githubInstallationId=987"
        authorizationStatus="expired"
        authorizationErrorCode={null}
        authorizedGithubLogin={null}
        installationId="987"
        repositories={repositories}
        errorMessage={null}
        missingConfiguration={[]}
      />
    );

    expect(
      screen.getByText("GitHub authorization expired.")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Re-authorize GitHub access" })
    ).toHaveAttribute(
      "href",
      "/github/authorize?workspaceSlug=platform-ops&githubInstallationId=987"
    );
    expect(
      screen.queryByRole("button", { name: "Import selected repository" })
    ).not.toBeInTheDocument();
  });

  it("renders an authorization error state without import controls", () => {
    render(
      <GithubImportPanel
        workspaceSlug="platform-ops"
        canImport
        installUrl={installUrl}
        authorizationUrl="/github/authorize?workspaceSlug=platform-ops&githubInstallationId=987"
        authorizationStatus="error"
        authorizationErrorCode="access_denied"
        authorizedGithubLogin={null}
        installationId="987"
        repositories={repositories}
        errorMessage={null}
        missingConfiguration={[]}
      />
    );

    expect(
      screen.getByText("Authorization failed: access_denied")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Authorize GitHub access" })
    ).toHaveAttribute(
      "href",
      "/github/authorize?workspaceSlug=platform-ops&githubInstallationId=987"
    );
    expect(
      screen.queryByRole("button", { name: "Import selected repository" })
    ).not.toBeInTheDocument();
  });

  it("renders a setup state when GitHub App configuration is missing", () => {
    render(
      <GithubImportPanel
        workspaceSlug="platform-ops"
        canImport
        installUrl={null}
        authorizationUrl={null}
        authorizationStatus="not_required"
        authorizationErrorCode={null}
        authorizedGithubLogin={null}
        installationId={null}
        repositories={[]}
        errorMessage={null}
        missingConfiguration={["GITHUB_APP_SLUG", "GITHUB_APP_ID"]}
      />
    );

    expect(
      screen.getByText("GitHub App setup is not configured yet.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("GITHUB_APP_SLUG, GITHUB_APP_ID")
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Install GitHub App" })
    ).not.toBeInTheDocument();
  });

  it("renders an empty state when the installation has no repositories", () => {
    render(
      <GithubImportPanel
        workspaceSlug="platform-ops"
        canImport
        installUrl={installUrl}
        authorizationUrl="/github/authorize?workspaceSlug=platform-ops&githubInstallationId=987"
        authorizationStatus="authorized"
        authorizationErrorCode={null}
        authorizedGithubLogin="henry"
        installationId="987"
        repositories={[]}
        errorMessage={null}
        missingConfiguration={[]}
      />
    );

    expect(
      screen.getByText("No repositories are available from this installation.")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Update GitHub App installation" })
    ).toHaveAttribute("href", installUrl);
  });

  it("renders a safe error state when repository loading fails", () => {
    render(
      <GithubImportPanel
        workspaceSlug="platform-ops"
        canImport
        installUrl={installUrl}
        authorizationUrl="/github/authorize?workspaceSlug=platform-ops&githubInstallationId=987"
        authorizationStatus="authorized"
        authorizationErrorCode={null}
        authorizedGithubLogin="henry"
        installationId="987"
        repositories={[]}
        errorMessage="GitHub installation repository request failed: 403 Forbidden"
        missingConfiguration={[]}
      />
    );

    expect(
      screen.getByText("Could not load repositories from this installation.")
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "GitHub installation repository request failed: 403 Forbidden"
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Update GitHub App installation" })
    ).toHaveAttribute("href", installUrl);
  });

  it("renders a setup state for users without import access", () => {
    render(
      <GithubImportPanel
        workspaceSlug="platform-ops"
        canImport={false}
        installUrl={installUrl}
        authorizationUrl={null}
        authorizationStatus="not_required"
        authorizationErrorCode={null}
        authorizedGithubLogin={null}
        installationId={null}
        repositories={[]}
        errorMessage={null}
        missingConfiguration={[]}
      />
    );

    expect(
      screen.getByRole("heading", { name: "Import from GitHub" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Workspace admin access is required to install or import GitHub repositories."
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Install GitHub App" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Import selected repository" })
    ).not.toBeInTheDocument();
  });
});

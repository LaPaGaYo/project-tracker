"use client";

import { useState, type ReactNode } from "react";

import { importInstalledGithubRepositoryAction } from "@/app/actions";

export interface GithubImportPanelRepository {
  providerRepositoryId: string;
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  htmlUrl: string | null;
  isPrivate: boolean;
}

type GithubAuthorizationStatus =
  | "not_required"
  | "missing"
  | "expired"
  | "invalid"
  | "error"
  | "authorized";

interface GithubImportPanelProps {
  workspaceSlug: string;
  projectKey?: string;
  canImport: boolean;
  installUrl: string | null;
  authorizationUrl: string | null;
  authorizationStatus: GithubAuthorizationStatus;
  authorizationErrorCode: string | null;
  authorizedGithubLogin: string | null;
  installationId: string | null;
  repositories: GithubImportPanelRepository[];
  errorMessage: string | null;
  missingConfiguration: string[];
}

interface IssueImportSummary {
  created: number;
  updated: number;
  skippedPullRequests: number;
  conflicted: number;
  failed: number;
}

function InstallLink({ href, label }: { href: string | null; label: string }) {
  if (!href) {
    return null;
  }

  return (
    <a
      className="inline-flex items-center justify-center rounded-2xl bg-planka-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-planka-accent-hover"
      href={href}
    >
      {label}
    </a>
  );
}

function StateCard({ children }: { children: ReactNode }) {
  return (
    <div className="mt-5 rounded-3xl border border-dashed border-white/12 bg-black/10 px-5 py-5 text-sm leading-7 text-planka-text-muted">
      {children}
    </div>
  );
}

export function GithubImportPanel({
  workspaceSlug,
  projectKey,
  canImport,
  installUrl,
  authorizationUrl,
  authorizationStatus,
  authorizationErrorCode,
  authorizedGithubLogin,
  installationId,
  repositories,
  errorMessage,
  missingConfiguration,
}: GithubImportPanelProps) {
  const [syncTitleAndBody, setSyncTitleAndBody] = useState(true);
  const [syncState, setSyncState] = useState(true);
  const [importClosedIssues, setImportClosedIssues] = useState(false);
  const [isImportingIssues, setIsImportingIssues] = useState(false);
  const [issueImportSummary, setIssueImportSummary] =
    useState<IssueImportSummary | null>(null);
  const [issueImportError, setIssueImportError] = useState<string | null>(null);

  const issueSyncEndpoint = projectKey
    ? `/api/workspaces/${workspaceSlug}/projects/${projectKey}/github/issues`
    : null;
  const canRenderIssueSyncControls =
    projectKey && canImport && missingConfiguration.length === 0;

  async function persistIssueSyncSettings(next: {
    syncTitleAndBody: boolean;
    syncState: boolean;
    importClosedIssues: boolean;
  }) {
    if (!issueSyncEndpoint) {
      return;
    }

    const response = await fetch(`${issueSyncEndpoint}/settings`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        issueSyncEnabled: next.syncTitleAndBody || next.syncState,
        syncTitle: next.syncTitleAndBody,
        syncBody: next.syncTitleAndBody,
        syncState: next.syncState,
        importClosedIssues: next.importClosedIssues,
        closedWorkflowStateId: null,
        reopenedWorkflowStateId: null,
      }),
    });
    if (!response.ok) {
      throw new Error("issue sync settings save failed");
    }
  }

  async function handleIssueImport() {
    if (!issueSyncEndpoint) {
      return;
    }

    setIsImportingIssues(true);
    setIssueImportSummary(null);
    setIssueImportError(null);

    try {
      await persistIssueSyncSettings({
        syncTitleAndBody,
        syncState,
        importClosedIssues,
      });
      const response = await fetch(`${issueSyncEndpoint}/import`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("issue import failed");
      }

      const payload = (await response.json()) as {
        summary?: IssueImportSummary;
      };
      if (!payload.summary) {
        throw new Error("issue import response missing summary");
      }

      setIssueImportSummary(payload.summary);
    } catch {
      setIssueImportError(
        "Issue import failed. Check GitHub App permissions and try again."
      );
    } finally {
      setIsImportingIssues(false);
    }
  }

  function handleTitleAndBodyChange(checked: boolean) {
    setSyncTitleAndBody(checked);
    void persistIssueSyncSettings({
      syncTitleAndBody: checked,
      syncState,
      importClosedIssues,
    });
  }

  function handleStateChange(checked: boolean) {
    setSyncState(checked);
    void persistIssueSyncSettings({
      syncTitleAndBody,
      syncState: checked,
      importClosedIssues,
    });
  }

  function handleImportClosedChange(checked: boolean) {
    setImportClosedIssues(checked);
    void persistIssueSyncSettings({
      syncTitleAndBody,
      syncState,
      importClosedIssues: checked,
    });
  }

  const issueSyncControls = canRenderIssueSyncControls ? (
    <div className="mt-6 grid gap-4 rounded-3xl border border-white/8 bg-planka-card/45 p-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-planka-accent">
          GitHub Issues sync
        </p>
        <p className="mt-2 text-sm leading-7 text-planka-text-muted">
          Import issues into this project and keep the fields the team has opted
          into aligned with GitHub.
        </p>
      </div>
      <div className="grid gap-3">
        <label className="flex items-center gap-3 text-sm text-planka-text">
          <input
            checked={syncTitleAndBody}
            className="accent-planka-accent"
            type="checkbox"
            onChange={(event) =>
              handleTitleAndBodyChange(event.currentTarget.checked)
            }
          />
          <span>Sync issue title and body</span>
        </label>
        <label className="flex items-center gap-3 text-sm text-planka-text">
          <input
            checked={syncState}
            className="accent-planka-accent"
            type="checkbox"
            onChange={(event) => handleStateChange(event.currentTarget.checked)}
          />
          <span>Sync open and closed state</span>
        </label>
        <label className="flex items-center gap-3 text-sm text-planka-text">
          <input
            checked={importClosedIssues}
            className="accent-planka-accent"
            type="checkbox"
            onChange={(event) =>
              handleImportClosedChange(event.currentTarget.checked)
            }
          />
          <span>Import closed GitHub issues</span>
        </label>
      </div>
      <button
        className="rounded-2xl bg-planka-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-planka-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isImportingIssues}
        type="button"
        onClick={() => {
          void handleIssueImport();
        }}
      >
        {isImportingIssues ? "Importing GitHub issues" : "Import GitHub issues"}
      </button>
      {issueImportSummary ? (
        <p className="rounded-3xl border border-white/8 bg-black/10 px-4 py-3 text-xs leading-6 text-planka-text-muted">
          Issue import summary: {issueImportSummary.created} created,{" "}
          {issueImportSummary.updated} updated,{" "}
          {issueImportSummary.skippedPullRequests} skipped,{" "}
          {issueImportSummary.conflicted} conflicted, and{" "}
          {issueImportSummary.failed} failed.
        </p>
      ) : null}
      {issueImportError ? (
        <p className="rounded-3xl border border-rose-300/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {issueImportError}
        </p>
      ) : null}
    </div>
  ) : null;

  return (
    <section className="rounded-[2rem] border border-white/8 bg-black/15 p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-planka-accent">
        Repository onboarding
      </p>
      <h2 className="mt-4 text-2xl font-semibold text-planka-text">
        Import from GitHub
      </h2>
      <p className="mt-3 text-sm leading-7 text-planka-text-muted">
        Install the workspace GitHub App, choose a repository, and start with
        engineering signals connected from day one.
      </p>

      {!canImport ? (
        <StateCard>
          Workspace admin access is required to install or import GitHub
          repositories.
        </StateCard>
      ) : missingConfiguration.length > 0 ? (
        <StateCard>
          <p className="font-semibold text-planka-text">
            GitHub App setup is not configured yet.
          </p>
          <p className="mt-2">
            Missing configuration:{" "}
            <span>{missingConfiguration.join(", ")}</span>
          </p>
        </StateCard>
      ) : !installationId ? (
        <div className="mt-6 grid gap-4 rounded-3xl border border-white/8 bg-planka-card/50 p-5">
          <p className="text-sm leading-7 text-planka-text-muted">
            Start by installing the GitHub App for the organization or account
            that owns the repositories this workspace should track.
          </p>
          <InstallLink href={installUrl} label="Install GitHub App" />
        </div>
      ) : installationId && authorizationStatus !== "authorized" ? (
        <StateCard>
          <p className="font-semibold text-planka-text">
            {authorizationStatus === "expired"
              ? "GitHub authorization expired."
              : "GitHub user authorization is required."}
          </p>
          <p className="mt-2">
            Authorize the GitHub App as a user who can access this installation
            before importing repositories.
          </p>
          {authorizationErrorCode ? (
            <p className="mt-2">
              Authorization failed: {authorizationErrorCode}
            </p>
          ) : null}
          <div className="mt-4">
            <InstallLink
              href={authorizationUrl}
              label={
                authorizationStatus === "expired"
                  ? "Re-authorize GitHub access"
                  : "Authorize GitHub access"
              }
            />
          </div>
        </StateCard>
      ) : errorMessage ? (
        <StateCard>
          <p className="font-semibold text-planka-text">
            Could not load repositories from this installation.
          </p>
          <p className="mt-2">{errorMessage}</p>
          <div className="mt-4">
            <InstallLink
              href={installUrl}
              label="Update GitHub App installation"
            />
          </div>
        </StateCard>
      ) : repositories.length === 0 ? (
        <StateCard>
          <p className="font-semibold text-planka-text">
            No repositories are available from this installation.
          </p>
          <p className="mt-2">
            Update the installation and select at least one repository for this
            workspace.
          </p>
          <div className="mt-4">
            <InstallLink
              href={installUrl}
              label="Update GitHub App installation"
            />
          </div>
        </StateCard>
      ) : (
        <>
          <form
            action={importInstalledGithubRepositoryAction.bind(
              null,
              workspaceSlug,
              installationId
            )}
            className="mt-6 grid gap-5"
          >
            {authorizedGithubLogin ? (
              <p className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-planka-text-muted">
                Authorized as {authorizedGithubLogin}
              </p>
            ) : null}
            <div className="grid gap-3">
              {repositories.map((repository) => (
                <label
                  key={repository.providerRepositoryId}
                  className="grid cursor-pointer gap-3 rounded-3xl border border-white/10 bg-planka-card/55 p-4 text-sm text-planka-text transition hover:border-planka-accent/50"
                >
                  <span className="flex items-start gap-3">
                    <input
                      required
                      aria-label={repository.fullName}
                      className="mt-1 accent-planka-accent"
                      name="providerRepositoryId"
                      type="radio"
                      value={repository.providerRepositoryId}
                    />
                    <span>
                      <span className="block font-semibold">
                        {repository.fullName}
                      </span>
                      <span className="mt-1 block text-xs uppercase tracking-[0.2em] text-planka-text-muted">
                        {repository.isPrivate ? "Private" : "Public"} - default{" "}
                        {repository.defaultBranch}
                      </span>
                    </span>
                  </span>
                </label>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-2 text-sm text-planka-text">
                <span>Project name</span>
                <input
                  name="projectName"
                  placeholder="Platform Ops"
                  className="rounded-2xl border border-white/10 bg-planka-bg px-4 py-3 outline-none placeholder:text-planka-text-muted"
                />
              </label>
              <label className="grid gap-2 text-sm text-planka-text">
                <span>Project key</span>
                <input
                  name="key"
                  maxLength={8}
                  placeholder="OPS"
                  className="rounded-2xl border border-white/10 bg-planka-bg px-4 py-3 uppercase outline-none placeholder:text-planka-text-muted"
                />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-2 text-sm text-planka-text">
                <span>Staging environment</span>
                <input
                  name="stagingEnvironmentName"
                  placeholder="staging"
                  className="rounded-2xl border border-white/10 bg-planka-bg px-4 py-3 outline-none placeholder:text-planka-text-muted"
                />
              </label>
              <label className="grid gap-2 text-sm text-planka-text">
                <span>Production environment</span>
                <input
                  name="productionEnvironmentName"
                  placeholder="production"
                  className="rounded-2xl border border-white/10 bg-planka-bg px-4 py-3 outline-none placeholder:text-planka-text-muted"
                />
              </label>
            </div>

            <p className="rounded-3xl border border-white/8 bg-black/10 px-4 py-3 text-xs leading-6 text-planka-text-muted">
              Repository metadata is resolved server-side from the GitHub App
              installation. Installation access tokens stay server-only.
            </p>
            <button className="rounded-2xl bg-planka-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-planka-accent-hover">
              Import selected repository
            </button>
          </form>

          {issueSyncControls}
        </>
      )}
      {repositories.length === 0 ? issueSyncControls : null}
    </section>
  );
}

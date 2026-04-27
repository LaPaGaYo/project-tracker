import type { ReactNode } from "react";

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

interface GithubImportPanelProps {
  workspaceSlug: string;
  canImport: boolean;
  installUrl: string | null;
  installationId: string | null;
  repositories: GithubImportPanelRepository[];
  errorMessage: string | null;
  missingConfiguration: string[];
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
  canImport,
  installUrl,
  installationId,
  repositories,
  errorMessage,
  missingConfiguration
}: GithubImportPanelProps) {
  return (
    <section className="rounded-[2rem] border border-white/8 bg-black/15 p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-planka-accent">Repository onboarding</p>
      <h2 className="mt-4 text-2xl font-semibold text-planka-text">Import from GitHub</h2>
      <p className="mt-3 text-sm leading-7 text-planka-text-muted">
        Install the workspace GitHub App, choose a repository, and start with engineering signals connected from day one.
      </p>

      {!canImport ? (
        <StateCard>Workspace admin access is required to install or import GitHub repositories.</StateCard>
      ) : missingConfiguration.length > 0 ? (
        <StateCard>
          <p className="font-semibold text-planka-text">GitHub App setup is not configured yet.</p>
          <p className="mt-2">
            Missing configuration: <span>{missingConfiguration.join(", ")}</span>
          </p>
        </StateCard>
      ) : !installationId ? (
        <div className="mt-6 grid gap-4 rounded-3xl border border-white/8 bg-planka-card/50 p-5">
          <p className="text-sm leading-7 text-planka-text-muted">
            Start by installing the GitHub App for the organization or account that owns the repositories this workspace
            should track.
          </p>
          <InstallLink href={installUrl} label="Install GitHub App" />
        </div>
      ) : errorMessage ? (
        <StateCard>
          <p className="font-semibold text-planka-text">Could not load repositories from this installation.</p>
          <p className="mt-2">{errorMessage}</p>
          <div className="mt-4">
            <InstallLink href={installUrl} label="Update GitHub App installation" />
          </div>
        </StateCard>
      ) : repositories.length === 0 ? (
        <StateCard>
          <p className="font-semibold text-planka-text">No repositories are available from this installation.</p>
          <p className="mt-2">Update the installation and select at least one repository for this workspace.</p>
          <div className="mt-4">
            <InstallLink href={installUrl} label="Update GitHub App installation" />
          </div>
        </StateCard>
      ) : (
        <form
          action={importInstalledGithubRepositoryAction.bind(null, workspaceSlug, installationId)}
          className="mt-6 grid gap-5"
        >
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
                    <span className="block font-semibold">{repository.fullName}</span>
                    <span className="mt-1 block text-xs uppercase tracking-[0.2em] text-planka-text-muted">
                      {repository.isPrivate ? "Private" : "Public"} - default {repository.defaultBranch}
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
            Repository metadata is resolved server-side from the GitHub App installation. Installation access tokens stay
            server-only.
          </p>
          <button className="rounded-2xl bg-planka-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-planka-accent-hover">
            Import selected repository
          </button>
        </form>
      )}
    </section>
  );
}

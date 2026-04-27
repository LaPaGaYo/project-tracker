import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { CreateProjectDialog } from "@/components/create-project-dialog";
import {
  buildGithubAppInstallUrl,
  createGithubAppInstallationClient,
  getGithubAppMissingConfiguration,
  type GithubInstallationRepository,
} from "@/server/github/app-installation";
import { GithubImportPanel } from "@/features/github-import/github-import-panel";
import { getGithubUserAuthorizationMissingConfiguration } from "@/server/github/user-authorization";
import {
  GITHUB_USER_AUTH_PROOF_COOKIE,
  verifyGithubUserAuthorizationProof,
  type GithubUserAuthorizationProofVerificationStatus,
} from "@/server/github/user-authorization-state";
import { getAppSession, isClerkConfigured } from "@/server/auth";
import { createProjectRepository } from "@/server/projects/repository";
import { listProjectsForUser } from "@/server/projects/service";
import { createWorkspaceRepository } from "@/server/workspaces/repository";
import { listWorkspacesForUser } from "@/server/workspaces/service";
import {
  WorkspaceError,
  requireWorkspaceMembership,
} from "@/server/workspaces/core";

export const dynamic = "force-dynamic";

function readSearchParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function resolveGithubInstallUrl(workspaceSlug: string) {
  const appSlug = process.env.GITHUB_APP_SLUG?.trim();
  if (!appSlug) {
    return null;
  }

  return buildGithubAppInstallUrl({
    appSlug,
    workspaceSlug,
  });
}

function resolveGithubAuthorizationUrl(
  workspaceSlug: string,
  installationId: string | null
) {
  if (!installationId) {
    return null;
  }

  const params = new URLSearchParams({
    workspaceSlug,
    githubInstallationId: installationId,
  });
  return `/github/authorize?${params.toString()}`;
}

export default async function WorkspaceProjectsPage({
  params,
  searchParams,
}: {
  params: Promise<{
    slug: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getAppSession();
  if (!session) {
    redirect("/sign-in");
  }

  const { slug } = await params;
  const workspaceRepository = createWorkspaceRepository();
  const workspace = await workspaceRepository.findWorkspaceBySlug(slug);

  if (!workspace) {
    notFound();
  }

  try {
    const membership = await requireWorkspaceMembership(
      workspaceRepository,
      session,
      workspace.id,
      "viewer"
    );
    const [workspaces, projects] = await Promise.all([
      listWorkspacesForUser(workspaceRepository, session),
      listProjectsForUser(createProjectRepository(), session, slug),
    ]);

    const canCreate = membership.role !== "viewer";
    const canImport =
      membership.role === "owner" || membership.role === "admin";
    const resolvedSearchParams = (await searchParams) ?? {};
    const githubInstallationId = readSearchParam(
      resolvedSearchParams.githubInstallationId
    );
    const installUrl = resolveGithubInstallUrl(slug);
    const authorizationUrl = resolveGithubAuthorizationUrl(
      slug,
      githubInstallationId
    );
    const missingConfiguration = [
      ...getGithubAppMissingConfiguration(),
      ...getGithubUserAuthorizationMissingConfiguration(),
    ];
    const cookieStore = await cookies();
    const missingProofStatus: Extract<
      GithubUserAuthorizationProofVerificationStatus,
      "missing"
    > = "missing";
    const proofResult = githubInstallationId
      ? verifyGithubUserAuthorizationProof(
          cookieStore.get(GITHUB_USER_AUTH_PROOF_COOKIE)?.value,
          {
            secret: process.env.GITHUB_USER_AUTH_STATE_SECRET ?? "",
            now: new Date(),
            productUserId: session.userId,
            workspaceSlug: slug,
            installationId: githubInstallationId,
          }
        )
      : { status: missingProofStatus };
    const githubAuthorizationError = readSearchParam(
      resolvedSearchParams.githubAuthorizationError
    );
    const authorizationStatus = !githubInstallationId
      ? "not_required"
      : githubAuthorizationError
        ? "error"
        : proofResult.status === "valid"
          ? "authorized"
          : proofResult.status === "expired"
            ? "expired"
            : proofResult.status === "invalid"
              ? "invalid"
              : "missing";
    const authorizedGithubLogin =
      proofResult.status === "valid" ? proofResult.proof.githubLogin : null;
    let githubRepositories: GithubInstallationRepository[] = [];
    let githubRepositoryError: string | null = null;

    if (
      canImport &&
      githubInstallationId &&
      missingConfiguration.length === 0 &&
      proofResult.status === "valid"
    ) {
      try {
        const repositories =
          await createGithubAppInstallationClient().listRepositories(
            githubInstallationId
          );
        const allowedRepositoryIds = new Set(
          proofResult.proof.allowedProviderRepositoryIds
        );
        githubRepositories = repositories.filter((repository) =>
          allowedRepositoryIds.has(repository.providerRepositoryId)
        );
      } catch (error) {
        githubRepositoryError =
          error instanceof Error
            ? error.message
            : "Could not load repositories from this GitHub installation.";
      }
    }

    return (
      <AppShell
        currentWorkspaceId={workspace.id}
        session={session}
        workspaces={workspaces}
        isClerkEnabled={isClerkConfigured()}
      >
        <section className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <article className="rounded-[2rem] border border-white/8 bg-planka-card/75 p-8 shadow-[0_32px_120px_rgba(0,0,0,0.24)] backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-planka-accent">
              Projects
            </p>
            <h1 className="mt-4 text-3xl font-semibold text-planka-text">
              {workspace.name}
            </h1>
            <p className="mt-3 text-sm leading-7 text-planka-text-muted">
              Browse workspace-scoped projects, then drill into work items
              grouped by workflow state.
            </p>
            <div className="mt-8 overflow-hidden rounded-3xl border border-white/8">
              <div className="grid grid-cols-[1.6fr_0.6fr_0.8fr_0.8fr] bg-black/20 px-5 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-planka-text-muted">
                <span>Project</span>
                <span>Key</span>
                <span>Items</span>
                <span>Updated</span>
              </div>
              <div className="grid gap-px bg-white/6">
                {projects.length > 0 ? (
                  projects.map((project) => (
                    <Link
                      key={project.id}
                      href={`/workspaces/${slug}/projects/${project.key}`}
                      className="grid grid-cols-[1.6fr_0.6fr_0.8fr_0.8fr] bg-planka-card/70 px-5 py-4 text-sm text-planka-text transition hover:bg-planka-card"
                    >
                      <span>
                        <strong className="font-semibold">
                          {project.title}
                        </strong>
                        <span className="mt-1 block text-xs uppercase tracking-[0.2em] text-planka-text-muted">
                          {project.stage}
                        </span>
                      </span>
                      <span>{project.key}</span>
                      <span>{project.workItemCount}</span>
                      <span>
                        {new Date(project.updatedAt).toLocaleDateString()}
                      </span>
                    </Link>
                  ))
                ) : (
                  <div className="px-5 py-8 text-sm text-planka-text-muted">
                    No projects yet. Create the first one to start tracking work
                    in this workspace.
                  </div>
                )}
              </div>
            </div>
          </article>

          <aside className="grid gap-6">
            <CreateProjectDialog workspaceSlug={slug} canCreate={canCreate} />
            <GithubImportPanel
              workspaceSlug={slug}
              canImport={canImport}
              installUrl={installUrl}
              authorizationUrl={authorizationUrl}
              authorizationStatus={authorizationStatus}
              authorizationErrorCode={githubAuthorizationError}
              authorizedGithubLogin={authorizedGithubLogin}
              installationId={githubInstallationId}
              repositories={githubRepositories}
              errorMessage={githubRepositoryError}
              missingConfiguration={missingConfiguration}
            />
            <div className="rounded-[2rem] border border-white/8 bg-black/15 p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-planka-accent">
                Workspace Context
              </p>
              <p className="mt-4 text-sm text-planka-text-muted">
                Current route uses the workspace slug:
                <span className="ml-2 rounded-full border border-white/12 px-3 py-1 text-planka-text">
                  /{slug}
                </span>
              </p>
              <p className="mt-4 text-sm text-planka-text-muted">
                Your role:{" "}
                <span className="font-semibold text-planka-text">
                  {membership.role}
                </span>
              </p>
            </div>
          </aside>
        </section>
      </AppShell>
    );
  } catch (error) {
    if (error instanceof WorkspaceError && error.status === 404) {
      notFound();
    }

    throw error;
  }
}

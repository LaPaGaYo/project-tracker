import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { CreateProjectDialog } from "@/components/create-project-dialog";
import { getAppSession, isClerkConfigured } from "@/server/auth";
import { createProjectRepository } from "@/server/projects/repository";
import { listProjectsForUser } from "@/server/projects/service";
import { createWorkspaceRepository } from "@/server/workspaces/repository";
import { listWorkspacesForUser } from "@/server/workspaces/service";
import { WorkspaceError, requireWorkspaceMembership } from "@/server/workspaces/core";

export const dynamic = "force-dynamic";

export default async function WorkspaceProjectsPage({
  params
}: {
  params: Promise<{
    slug: string;
  }>;
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
    const membership = await requireWorkspaceMembership(workspaceRepository, session, workspace.id, "viewer");
    const [workspaces, projects] = await Promise.all([
      listWorkspacesForUser(workspaceRepository, session),
      listProjectsForUser(createProjectRepository(), session, slug)
    ]);

    const canCreate = membership.role !== "viewer";

    return (
      <AppShell
        currentWorkspaceId={workspace.id}
        session={session}
        workspaces={workspaces}
        isClerkEnabled={isClerkConfigured()}
      >
        <section className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <article className="rounded-[2rem] border border-white/8 bg-planka-card/75 p-8 shadow-[0_32px_120px_rgba(0,0,0,0.24)] backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-planka-accent">Projects</p>
            <h1 className="mt-4 text-3xl font-semibold text-planka-text">{workspace.name}</h1>
            <p className="mt-3 text-sm leading-7 text-planka-text-muted">
              Browse workspace-scoped projects, then drill into work items grouped by workflow state.
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
                        <strong className="font-semibold">{project.title}</strong>
                        <span className="mt-1 block text-xs uppercase tracking-[0.2em] text-planka-text-muted">
                          {project.stage}
                        </span>
                      </span>
                      <span>{project.key}</span>
                      <span>{project.workItemCount}</span>
                      <span>{new Date(project.updatedAt).toLocaleDateString()}</span>
                    </Link>
                  ))
                ) : (
                  <div className="px-5 py-8 text-sm text-planka-text-muted">
                    No projects yet. Create the first one to start tracking work in this workspace.
                  </div>
                )}
              </div>
            </div>
          </article>

          <aside className="grid gap-6">
            <CreateProjectDialog workspaceSlug={slug} canCreate={canCreate} />
            <div className="rounded-[2rem] border border-white/8 bg-black/15 p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-planka-accent">Workspace Context</p>
              <p className="mt-4 text-sm text-planka-text-muted">
                Current route uses the workspace slug:
                <span className="ml-2 rounded-full border border-white/12 px-3 py-1 text-planka-text">/{slug}</span>
              </p>
              <p className="mt-4 text-sm text-planka-text-muted">
                Your role: <span className="font-semibold text-planka-text">{membership.role}</span>
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

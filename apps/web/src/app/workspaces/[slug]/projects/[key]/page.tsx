import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { CreateWorkItemDialog } from "@/components/create-work-item-dialog";
import { WorkItemRow } from "@/components/work-item-row";
import { getAppSession, isClerkConfigured } from "@/server/auth";
import { createProjectRepository } from "@/server/projects/repository";
import { getProjectForUser } from "@/server/projects/service";
import { createWorkItemRepository } from "@/server/work-items/repository";
import { listWorkItemsForUser } from "@/server/work-items/service";
import { createWorkspaceRepository } from "@/server/workspaces/repository";
import { listWorkspacesForUser } from "@/server/workspaces/service";
import { WorkspaceError, requireWorkspaceMembership } from "@/server/workspaces/core";
import { createWorkflowStateRepository } from "@/server/workflow-states/repository";
import { listWorkflowStatesForUser } from "@/server/workflow-states/service";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params
}: {
  params: Promise<{
    slug: string;
    key: string;
  }>;
}) {
  const session = await getAppSession();
  if (!session) {
    redirect("/sign-in");
  }

  const { slug, key } = await params;
  const workspaceRepository = createWorkspaceRepository();
  const workspace = await workspaceRepository.findWorkspaceBySlug(slug);

  if (!workspace) {
    notFound();
  }

  try {
    const membership = await requireWorkspaceMembership(workspaceRepository, session, workspace.id, "viewer");
    const [workspaces, project, states, items] = await Promise.all([
      listWorkspacesForUser(workspaceRepository, session),
      getProjectForUser(createProjectRepository(), session, slug, key),
      listWorkflowStatesForUser(createWorkflowStateRepository(), session, slug, key),
      listWorkItemsForUser(createWorkItemRepository(), session, slug, key)
    ]);

    const groupedItems = new Map<string, typeof items>();
    for (const state of states) {
      groupedItems.set(
        state.id,
        items.filter((item) => item.workflowStateId === state.id)
      );
    }

    const unassignedItems = items.filter((item) => !item.workflowStateId);
    const canCreate = membership.role !== "viewer";

    return (
      <AppShell
        currentWorkspaceId={workspace.id}
        session={session}
        workspaces={workspaces}
        isClerkEnabled={isClerkConfigured()}
      >
        <section className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <article className="rounded-[2rem] border border-white/8 bg-planka-card/75 p-8 shadow-[0_32px_120px_rgba(0,0,0,0.24)] backdrop-blur">
            <Link href={`/workspaces/${slug}/projects`} className="text-xs font-semibold uppercase tracking-[0.3em] text-planka-accent">
              Back to projects
            </Link>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold text-planka-text">{project.title}</h1>
              <span className="rounded-full bg-planka-selected px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white">
                {project.key}
              </span>
            </div>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-planka-text-muted">
              {project.description || "No project description yet."}
            </p>

            <div className="mt-8 grid gap-6">
              {states.map((state) => (
                <section key={state.id} className="rounded-3xl border border-white/8 bg-black/10 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-planka-accent">
                        {state.category}
                      </p>
                      <h2 className="mt-2 text-xl font-semibold text-planka-text">{state.name}</h2>
                    </div>
                    <span className="rounded-full border border-white/12 px-3 py-1 text-xs uppercase tracking-[0.2em] text-planka-text-muted">
                      {(groupedItems.get(state.id) ?? []).length} items
                    </span>
                  </div>
                  <div className="mt-4 grid gap-3">
                    {(groupedItems.get(state.id) ?? []).length > 0 ? (
                      (groupedItems.get(state.id) ?? []).map((item) => <WorkItemRow key={item.id} item={item} />)
                    ) : (
                      <div className="rounded-3xl border border-dashed border-white/12 px-4 py-6 text-sm text-planka-text-muted">
                        No work items in this state yet.
                      </div>
                    )}
                  </div>
                </section>
              ))}

              {unassignedItems.length > 0 ? (
                <section className="rounded-3xl border border-white/8 bg-black/10 p-5">
                  <h2 className="text-xl font-semibold text-planka-text">Unassigned State</h2>
                  <div className="mt-4 grid gap-3">
                    {unassignedItems.map((item) => (
                      <WorkItemRow key={item.id} item={item} />
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          </article>

          <aside className="grid gap-6">
            <CreateWorkItemDialog
              workspaceSlug={slug}
              projectKey={key}
              states={states}
              canCreate={canCreate}
            />
            <div className="rounded-[2rem] border border-white/8 bg-black/15 p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-planka-accent">Project Summary</p>
              <div className="mt-5 grid gap-3 text-sm text-planka-text-muted">
                <p>
                  Workspace:
                  <span className="ml-2 font-semibold text-planka-text">{workspace.name}</span>
                </p>
                <p>
                  Stage:
                  <span className="ml-2 font-semibold text-planka-text">{project.stage}</span>
                </p>
                <p>
                  Role:
                  <span className="ml-2 font-semibold text-planka-text">{membership.role}</span>
                </p>
                <p>
                  Total items:
                  <span className="ml-2 font-semibold text-planka-text">{items.length}</span>
                </p>
              </div>
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

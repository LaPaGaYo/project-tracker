import Link from "next/link";

import { ClerkGuestButtons } from "@/components/clerk-auth-controls";
import { AppShell } from "@/components/app-shell";
import { createWorkspaceAction, signInDemoAction } from "@/app/actions";
import { getAppSession, isClerkConfigured } from "@/server/auth";
import { createWorkspaceRepository } from "@/server/workspaces/repository";
import { listWorkspacesForUser } from "@/server/workspaces/service";

export const dynamic = "force-dynamic";

function GuestCard() {
  const clerkEnabled = isClerkConfigured();

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center px-6 py-16">
      <div className="rounded-[2rem] border border-white/8 bg-planka-card/75 p-8 shadow-[0_32px_120px_rgba(0,0,0,0.32)] backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-planka-accent">Phase 2</p>
        <h1 className="mt-4 text-4xl font-semibold text-planka-text">Auth and workspace control plane</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-planka-text-muted">
          Sign in to create a workspace, invite teammates, and validate role-based access control for the next
          product phases.
        </p>
        <div className="mt-8">
          {clerkEnabled ? (
            <ClerkGuestButtons />
          ) : (
            <form action={signInDemoAction} className="grid gap-4 rounded-3xl border border-white/8 bg-black/10 p-5 lg:grid-cols-[1fr_1fr_auto]">
              <input
                required
                name="displayName"
                placeholder="Display name"
                className="rounded-2xl border border-white/10 bg-planka-bg px-4 py-3 text-sm text-planka-text outline-none placeholder:text-planka-text-muted"
              />
              <input
                required
                name="email"
                type="email"
                placeholder="you@example.com"
                className="rounded-2xl border border-white/10 bg-planka-bg px-4 py-3 text-sm text-planka-text outline-none placeholder:text-planka-text-muted"
              />
              <button className="rounded-2xl bg-planka-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-planka-accent-hover">
                Continue in demo mode
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}

export default async function HomePage() {
  const session = await getAppSession();

  if (!session) {
    return <GuestCard />;
  }

  const repository = createWorkspaceRepository();
  const workspaces = await listWorkspacesForUser(repository, session);

  return (
    <AppShell
      session={session}
      workspaces={workspaces}
      isClerkEnabled={isClerkConfigured()}
    >
      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-[2rem] border border-white/8 bg-planka-card/75 p-8 shadow-[0_32px_120px_rgba(0,0,0,0.24)] backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-planka-accent">Workspace Switcher</p>
          <h1 className="mt-4 text-3xl font-semibold text-planka-text">Choose a workspace or create the first one</h1>
          <p className="mt-4 text-sm leading-7 text-planka-text-muted">
            Phase 3 adds workspace-scoped projects, work items, workflow states, and activity history on top of the
            auth and workspace foundations.
          </p>
          <div className="mt-8 grid gap-3">
            {workspaces.length > 0 ? (
              workspaces.map((workspace) => (
                <Link
                  key={workspace.id}
                  href={`/workspaces/${workspace.slug}/projects`}
                  className="rounded-3xl border border-white/8 bg-black/10 px-5 py-4 transition hover:border-white/16 hover:bg-black/20"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-lg font-semibold text-planka-text">{workspace.name}</p>
                      <p className="mt-1 text-sm text-planka-text-muted">
                        /{workspace.slug} · {workspace.role}
                      </p>
                    </div>
                    <span className="rounded-full bg-planka-selected px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white">
                      Open
                    </span>
                  </div>
                </Link>
              ))
            ) : (
              <div className="rounded-3xl border border-dashed border-white/12 bg-black/10 px-5 py-8 text-sm text-planka-text-muted">
                No workspace yet. Create one to begin the Phase 3 project and work-item flow.
              </div>
            )}
          </div>
        </article>

        <article className="rounded-[2rem] border border-white/8 bg-black/15 p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-planka-accent">Create Workspace</p>
          <form action={createWorkspaceAction} className="mt-6 grid gap-4">
            <label className="grid gap-2 text-sm text-planka-text">
              <span>Name</span>
              <input
                required
                name="name"
                placeholder="Platform Ops"
                className="rounded-2xl border border-white/10 bg-planka-bg px-4 py-3 outline-none placeholder:text-planka-text-muted"
              />
            </label>
            <label className="grid gap-2 text-sm text-planka-text">
              <span>Slug</span>
              <input
                name="slug"
                placeholder="platform-ops"
                className="rounded-2xl border border-white/10 bg-planka-bg px-4 py-3 outline-none placeholder:text-planka-text-muted"
              />
            </label>
            <button className="rounded-2xl bg-planka-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-planka-accent-hover">
              Create workspace
            </button>
          </form>
        </article>
      </section>
    </AppShell>
  );
}

import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import {
  inviteMemberAction,
  removeMemberAction,
  updateMemberRoleAction,
  updateWorkspaceAction
} from "@/app/actions";
import { getAppSession, isClerkConfigured } from "@/server/auth";
import { createWorkspaceRepository } from "@/server/workspaces/repository";
import { getWorkspaceDetailsForUser, listWorkspacesForUser, WorkspaceError } from "@/server/workspaces/service";
import { workspaceRoles } from "@the-platform/shared";

export const dynamic = "force-dynamic";

export default async function WorkspacePage({
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
  const repository = createWorkspaceRepository();
  const workspace = await repository.findWorkspaceBySlug(slug);

  if (!workspace) {
    notFound();
  }

  const workspaces = await listWorkspacesForUser(repository, session);

  try {
    const details = await getWorkspaceDetailsForUser(repository, session, workspace.id);

    return (
      <AppShell
        currentWorkspaceId={workspace.id}
        session={session}
        workspaces={workspaces}
        isClerkEnabled={isClerkConfigured()}
      >
        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <article className="rounded-[2rem] border border-white/8 bg-planka-card/75 p-8 shadow-[0_32px_120px_rgba(0,0,0,0.24)] backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-planka-accent">Workspace Settings</p>
            <h1 className="mt-4 text-3xl font-semibold text-planka-text">{details.workspace.name}</h1>
            <p className="mt-3 text-sm text-planka-text-muted">
              Current role: <span className="font-semibold text-planka-text">{details.currentRole}</span>
            </p>
            <form action={updateWorkspaceAction.bind(null, workspace.id)} className="mt-8 grid gap-4">
              <label className="grid gap-2 text-sm text-planka-text">
                <span>Name</span>
                <input
                  required
                  name="name"
                  defaultValue={details.workspace.name}
                  className="rounded-2xl border border-white/10 bg-planka-bg px-4 py-3 outline-none"
                />
              </label>
              <label className="grid gap-2 text-sm text-planka-text">
                <span>Slug</span>
                <input
                  required
                  name="slug"
                  defaultValue={details.workspace.slug}
                  className="rounded-2xl border border-white/10 bg-planka-bg px-4 py-3 outline-none"
                />
              </label>
              <button className="rounded-2xl bg-planka-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-planka-accent-hover">
                Save settings
              </button>
            </form>
          </article>

          <article className="rounded-[2rem] border border-white/8 bg-black/15 p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-planka-accent">Invite Member</p>
            <form action={inviteMemberAction.bind(null, workspace.id)} className="mt-6 grid gap-4">
              <label className="grid gap-2 text-sm text-planka-text">
                <span>Email</span>
                <input
                  required
                  type="email"
                  name="email"
                  placeholder="teammate@example.com"
                  className="rounded-2xl border border-white/10 bg-planka-bg px-4 py-3 outline-none"
                />
              </label>
              <label className="grid gap-2 text-sm text-planka-text">
                <span>Role</span>
                <select
                  name="role"
                  defaultValue="member"
                  className="rounded-2xl border border-white/10 bg-planka-bg px-4 py-3 outline-none"
                >
                  {workspaceRoles.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </label>
              <button className="rounded-2xl bg-planka-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-planka-accent-hover">
                Send invite
              </button>
            </form>

            <div className="mt-8 grid gap-3">
              {details.invitations.map((invitation) => (
                <div key={invitation.id} className="rounded-3xl border border-white/8 bg-black/10 px-4 py-3">
                  <p className="text-sm font-semibold text-planka-text">{invitation.email}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.2em] text-planka-text-muted">
                    pending · {invitation.role}
                  </p>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="mt-6 rounded-[2rem] border border-white/8 bg-planka-card/75 p-8 shadow-[0_24px_80px_rgba(0,0,0,0.18)] backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-planka-accent">Members</p>
          <div className="mt-6 grid gap-4">
            {details.members.map((member) => (
              <div key={member.userId} className="grid gap-4 rounded-3xl border border-white/8 bg-black/10 px-5 py-4 lg:grid-cols-[1fr_auto_auto] lg:items-center">
                <div>
                  <p className="text-sm font-semibold text-planka-text">{member.userId}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.2em] text-planka-text-muted">
                    invited {member.invitedAt} · joined {member.joinedAt ?? "pending"}
                  </p>
                </div>
                <form action={updateMemberRoleAction.bind(null, workspace.id, member.userId)} className="flex items-center gap-3">
                  <select
                    name="role"
                    defaultValue={member.role}
                    className="rounded-2xl border border-white/10 bg-planka-bg px-4 py-2 text-sm outline-none"
                  >
                    {workspaceRoles.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                  <button className="rounded-2xl border border-white/12 px-4 py-2 text-sm font-semibold text-planka-text transition hover:border-white/24 hover:bg-white/6">
                    Save
                  </button>
                </form>
                <form action={removeMemberAction.bind(null, workspace.id, member.userId)}>
                  <button className="rounded-2xl border border-planka-error/40 px-4 py-2 text-sm font-semibold text-planka-error transition hover:bg-planka-error/10">
                    Remove
                  </button>
                </form>
              </div>
            ))}
          </div>
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

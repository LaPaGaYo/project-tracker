import Link from "next/link";

import type { AppSession } from "@/server/workspaces/types";
import type { WorkspaceSummary } from "@the-platform/shared";

import { ClerkUserMenu } from "./clerk-auth-controls";
import { signOutAction } from "@/app/actions";

interface AppShellProps {
  children: React.ReactNode;
  currentWorkspaceId?: string;
  isClerkEnabled: boolean;
  session: AppSession;
  workspaces: WorkspaceSummary[];
}

function DemoSignOutButton() {
  return (
    <form action={signOutAction}>
      <button className="rounded-full border border-white/12 px-4 py-2 text-sm font-semibold text-planka-text transition hover:border-white/24 hover:bg-white/6">
        Sign out
      </button>
    </form>
  );
}

export function AppShell({
  children,
  currentWorkspaceId,
  isClerkEnabled,
  session,
  workspaces
}: AppShellProps) {
  return (
    <main className="min-h-screen">
      <header className="border-b border-white/6 bg-black/10 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Link href="/" className="text-xs font-semibold uppercase tracking-[0.3em] text-planka-accent">
              The Platform
            </Link>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {workspaces.map((workspace) => (
                <Link
                  key={workspace.id}
                  href={`/workspaces/${workspace.slug}/projects`}
                  aria-current={workspace.id === currentWorkspaceId ? "page" : undefined}
                  className={`rounded-full px-3 py-1 text-sm transition ${
                    workspace.id === currentWorkspaceId
                      ? "bg-planka-selected text-white"
                      : "border border-white/8 bg-planka-card/70 text-planka-text-muted hover:border-white/16 hover:text-planka-text"
                  }`}
                >
                  {workspace.name}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-semibold text-planka-text">{session.displayName ?? session.email}</p>
              <p className="text-xs uppercase tracking-[0.2em] text-planka-text-muted">{session.provider}</p>
            </div>
            {isClerkEnabled ? <ClerkUserMenu /> : <DemoSignOutButton />}
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-6 py-10">{children}</div>
    </main>
  );
}

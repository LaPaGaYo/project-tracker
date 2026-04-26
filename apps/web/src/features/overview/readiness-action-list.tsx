import Link from "next/link";

import type { ProjectReadinessAction } from "@/server/projects/readiness";

const sourceLabel: Record<ProjectReadinessAction["sourceType"], string> = {
  github: "GitHub",
  notification: "Notification",
  plan: "Plan",
  work_item: "Work item"
};

export function ReadinessActionList({ actions }: { actions: ProjectReadinessAction[] }) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-planka-card/90 p-5 shadow-[0_18px_46px_rgba(0,0,0,0.18)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-planka-text-muted">Team action list</p>
          <h2 className="mt-1 text-xl font-semibold text-planka-text">Next best moves</h2>
        </div>
        <span className="rounded-full border border-white/10 bg-black/10 px-3 py-1 text-xs font-semibold text-planka-text-muted">
          Rule based
        </span>
      </div>

      {actions.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {actions.map((action) => (
            <li key={action.id}>
              <Link
                className="block rounded-[1.25rem] border border-white/10 bg-black/10 px-4 py-3 transition hover:border-planka-selected/60 hover:bg-planka-selected/20"
                href={action.href}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-planka-text">{action.title}</p>
                  <span className="shrink-0 rounded-full border border-white/10 px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-planka-text-muted">
                    {sourceLabel[action.sourceType]}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-5 text-planka-text-muted">{action.detail}</p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-[1.25rem] border border-white/10 bg-black/10 px-4 py-3 text-sm leading-5 text-planka-text-muted">
          No readiness actions. The current stage has no blocking work or high-priority signals.
        </p>
      )}
    </section>
  );
}

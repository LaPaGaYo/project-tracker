import type { ProjectReadinessView } from "@/server/projects/readiness";

import { MilestoneRoadmap } from "./milestone-roadmap";
import { ReadinessActionList } from "./readiness-action-list";
import { ReadinessSummary } from "./readiness-summary";

interface OverviewMilestone {
  label: string;
  monthStart: number;
  monthSpan: number;
  tone: "completed" | "current" | "upcoming";
}

interface OverviewViewModel {
  currentStage: string;
  health: string[];
  milestones: OverviewMilestone[];
  readiness: ProjectReadinessView;
}

export function OverviewView({ brief, overview }: { brief: string; overview: OverviewViewModel }) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-6">
        <ReadinessSummary readiness={overview.readiness} />

        <section className="rounded-[2rem] border border-white/10 bg-planka-card/90 p-6 shadow-[0_18px_46px_rgba(0,0,0,0.18)]">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-planka-text-muted">Overview</p>
          <h2 className="mt-1 text-2xl font-semibold text-planka-text">Project alignment</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-planka-text-muted">{brief}</p>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-planka-card/90 p-5 shadow-[0_18px_46px_rgba(0,0,0,0.18)]">
          <MilestoneRoadmap milestones={overview.milestones} />
        </section>
      </div>

      <aside className="space-y-4">
        <ReadinessActionList actions={overview.readiness.actions} />

        <section className="rounded-[2rem] border border-white/10 bg-planka-selected/40 p-5 shadow-[0_18px_46px_rgba(0,0,0,0.18)]">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-planka-text-muted">Current stage</p>
          <p className="mt-2 text-xl font-semibold text-planka-text">{overview.currentStage}</p>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-planka-card/90 p-5 shadow-[0_18px_46px_rgba(0,0,0,0.18)]">
          <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-planka-text-muted">Health</h2>
          <ul className="mt-3 space-y-3 text-sm text-planka-text-muted">
            {overview.health.map((entry) => (
              <li key={entry} className="rounded-[1.25rem] border border-white/10 bg-black/10 px-4 py-3">
                {entry}
              </li>
            ))}
          </ul>
        </section>
      </aside>
    </div>
  );
}

import type { ProjectReadinessTone, ProjectReadinessView } from "@/server/projects/readiness";

import { ReadinessSignalCard } from "./readiness-signal-card";

const tonePillClass: Record<ProjectReadinessTone, string> = {
  danger: "border-red-300/30 bg-red-500/10 text-red-100",
  neutral: "border-white/10 bg-black/10 text-planka-text-muted",
  success: "border-emerald-300/30 bg-emerald-500/10 text-emerald-100",
  warning: "border-amber-300/30 bg-amber-500/10 text-amber-100"
};

export function ReadinessSummary({ readiness }: { readiness: ProjectReadinessView }) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-planka-card/90 p-6 shadow-[0_18px_46px_rgba(0,0,0,0.18)]">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-planka-text-muted">
              Readiness command center
            </p>
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${tonePillClass[readiness.tone]}`}>
              {readiness.tone}
            </span>
          </div>
          <h1 className="mt-3 text-3xl font-semibold text-planka-text">{readiness.status}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-planka-text-muted">{readiness.narrative}</p>
        </div>

        <aside className="rounded-[1.5rem] border border-white/10 bg-black/10 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-planka-text-muted">Decision cues</h2>
          <dl className="mt-3 space-y-3">
            {readiness.decisionCues.map((cue) => (
              <div key={cue.label} className={`rounded-[1rem] border px-3 py-2 ${tonePillClass[cue.tone]}`}>
                <dt className="text-xs font-semibold uppercase tracking-[0.12em] opacity-75">{cue.label}</dt>
                <dd className="mt-1 text-sm font-semibold">{cue.value}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {readiness.metrics.map((metric) => (
          <ReadinessSignalCard key={metric.label} metric={metric} />
        ))}
      </div>
    </section>
  );
}

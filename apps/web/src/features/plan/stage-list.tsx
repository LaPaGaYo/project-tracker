import type { PlanStageViewModel } from "./types";

export function StageList({ stages }: { stages: PlanStageViewModel[] }) {
  return (
    <section className="grid gap-4 xl:grid-cols-3">
      {stages.map((stage) => (
        <section
          key={`${stage.label}-${stage.title}`}
          aria-label={stage.title}
          className="rounded-[2rem] border border-white/10 bg-black/10 p-5"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-planka-text-muted">{stage.label}</p>
          <h2 className="mt-2 text-lg font-semibold text-planka-text">{stage.title}</h2>
          <p className="mt-3 text-sm text-planka-text-muted">{stage.progressLabel}</p>
        </section>
      ))}
    </section>
  );
}

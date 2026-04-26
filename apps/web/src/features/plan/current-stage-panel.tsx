import type { CurrentPlanStageViewModel } from "./types";

export function CurrentStagePanel({ currentStage }: { currentStage: CurrentPlanStageViewModel }) {
  return (
    <section
      aria-label="Current stage"
      className="rounded-[2rem] border border-white/10 bg-planka-card/90 p-5 shadow-[0_18px_46px_rgba(0,0,0,0.18)]"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-planka-text-muted">{currentStage.label}</p>
      <h2 className="mt-2 text-2xl font-semibold text-planka-text">{currentStage.title}</h2>
      <p className="mt-2 text-sm font-medium text-planka-accent">{currentStage.progressLabel}</p>
      <p className="mt-4 text-sm leading-7 text-planka-text-muted">{currentStage.goal}</p>
    </section>
  );
}

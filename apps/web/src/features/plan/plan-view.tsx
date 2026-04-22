import type { PlanViewModel } from "./types";

import { CurrentStagePanel } from "./current-stage-panel";
import { PlanItemList } from "./plan-item-list";
import { StageGateCard } from "./stage-gate-card";
import { StageList } from "./stage-list";

export function PlanView({ plan }: { plan: PlanViewModel }) {
  return (
    <section aria-label="Project plan" className="space-y-6">
      <header className="rounded-[2rem] border border-white/10 bg-planka-card/90 p-6 shadow-[0_18px_46px_rgba(0,0,0,0.18)]">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-planka-text-muted">Planning surface</p>
        <h1 className="mt-1 text-3xl font-semibold text-planka-text">Plan</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-planka-text-muted">
          Keep stages, plan items, and gate checks aligned to the current execution surface.
        </p>
      </header>

      <div className="grid gap-4">
        <StageList stages={plan.stages} />
        <CurrentStagePanel currentStage={plan.currentStage} />
        <PlanItemList items={plan.items} />
        <div className="grid gap-4 xl:grid-cols-2">
          {plan.gates.map((gate) => (
            <StageGateCard key={gate.title} gate={gate} />
          ))}
        </div>
      </div>
    </section>
  );
}

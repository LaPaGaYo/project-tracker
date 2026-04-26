import type { StageGateViewModel } from "./types";

export function StageGateCard({ gate }: { gate: StageGateViewModel }) {
  return (
    <article
      aria-label={gate.title}
      className="rounded-[1.75rem] border border-white/10 bg-planka-card/90 p-5 shadow-[0_18px_46px_rgba(0,0,0,0.18)]"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-planka-text-muted">{gate.stageTitle}</p>
      <h3 className="mt-2 text-lg font-semibold text-planka-text">{gate.title}</h3>
      <p className="mt-3 text-sm leading-7 text-planka-text-muted">{gate.description}</p>
      <p className="mt-4 text-sm text-planka-text">Linked issues: {gate.linkedIssues.join(", ") || "None"}</p>
    </article>
  );
}

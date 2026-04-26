import type { ProjectReadinessMetric } from "@/server/projects/readiness";

const toneClass: Record<ProjectReadinessMetric["tone"], string> = {
  danger: "border-red-300/30 bg-red-500/10 text-red-100",
  neutral: "border-white/10 bg-black/10 text-planka-text",
  success: "border-emerald-300/30 bg-emerald-500/10 text-emerald-100",
  warning: "border-amber-300/30 bg-amber-500/10 text-amber-100"
};

export function ReadinessSignalCard({ metric }: { metric: ProjectReadinessMetric }) {
  return (
    <article className={`rounded-[1.5rem] border p-4 ${toneClass[metric.tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] opacity-80">{metric.label}</p>
      <p className="mt-2 text-2xl font-semibold">{metric.value}</p>
      <p className="mt-2 text-sm leading-5 opacity-80">{metric.detail}</p>
    </article>
  );
}

interface OverviewMilestone {
  label: string;
  monthStart: number;
  monthSpan: number;
  tone: "completed" | "current" | "upcoming";
}

const toneClassName: Record<OverviewMilestone["tone"], string> = {
  completed: "bg-[#173127] text-[#9dd5b1] ring-1 ring-[#205339]",
  current: "bg-planka-selected text-white ring-1 ring-[#4f89ff]",
  upcoming: "border border-dashed border-white/12 bg-black/10 text-planka-text-muted"
};

export function MilestoneRoadmap({ milestones }: { milestones: OverviewMilestone[] }) {
  return (
    <section aria-label="Milestone roadmap">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-planka-text-muted">Milestone roadmap</h2>
          <p className="mt-1 text-sm text-planka-text-muted">A lightweight gantt for project stages and milestones.</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4">
        {milestones.map((milestone) => (
          <div key={`${milestone.label}-${milestone.monthStart}`} className="grid gap-2 md:grid-cols-[16rem_minmax(0,1fr)] md:items-center">
            <div>
              <p className="text-sm font-semibold text-planka-text">{milestone.label}</p>
              <p className="text-xs uppercase tracking-[0.12em] text-planka-text-muted">
                Month {milestone.monthStart + 1}-{milestone.monthStart + milestone.monthSpan}
              </p>
            </div>
            <div className="rounded-full border border-white/10 bg-black/10 p-1">
              <div
                className={["h-10 rounded-full px-4", toneClassName[milestone.tone]].join(" ")}
                style={{
                  marginLeft: `${milestone.monthStart * 8}%`,
                  width: `${Math.max(milestone.monthSpan * 16, 20)}%`
                }}
              >
                <div className="flex h-full items-center text-sm font-semibold">{milestone.label}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

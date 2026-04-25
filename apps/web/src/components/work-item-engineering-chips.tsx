"use client";

import type { ProjectWorkspaceEngineeringItemView } from "../features/workspace/project-workspace-view";

interface WorkItemEngineeringChipsProps {
  engineering?: ProjectWorkspaceEngineeringItemView | null;
  compact?: boolean;
}

function chipClasses(compact: boolean) {
  return compact
    ? "rounded-full border border-white/10 bg-black/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-planka-text-muted"
    : "rounded-full border border-white/10 bg-black/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-planka-text-muted";
}

export function WorkItemEngineeringChips({
  engineering,
  compact = false
}: WorkItemEngineeringChipsProps) {
  if (!engineering) {
    return null;
  }

  const classes = chipClasses(compact);

  return (
    <div className="flex flex-wrap gap-2">
      <span className={classes}>{engineering.pullRequestLabel}</span>
      <span className={classes}>{engineering.checkLabel}</span>
      <span className={classes}>{engineering.deployLabel}</span>
    </div>
  );
}

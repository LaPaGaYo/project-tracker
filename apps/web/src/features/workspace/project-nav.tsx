import Link from "next/link";

import { StatusPill } from "./status-pill";

interface ProjectNavProps {
  stageLabel: string;
  stageTitle: string;
  progressLabel: string;
  canCreate?: boolean;
  createIssueHref?: string;
}

export function ProjectNav({
  stageLabel,
  stageTitle,
  progressLabel,
  canCreate = false,
  createIssueHref
}: ProjectNavProps) {
  return (
    <section
      aria-label={stageLabel}
      className="rounded-[2rem] border border-white/10 bg-black/10 px-5 py-5 shadow-[0_18px_46px_rgba(0,0,0,0.18)]"
    >
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 space-y-2">
          <StatusPill tone="accent">{stageLabel}</StatusPill>
          <h2 className="text-lg font-semibold text-planka-text">{stageTitle}</h2>
          <p className="text-sm text-planka-text-muted">{progressLabel}</p>
        </div>
        {canCreate && createIssueHref ? (
          <Link
            href={createIssueHref}
            className="ml-auto inline-flex items-center rounded-full bg-planka-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-planka-accent-hover"
          >
            Create issue
          </Link>
        ) : null}
      </div>
    </section>
  );
}

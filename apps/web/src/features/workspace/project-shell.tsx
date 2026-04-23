import type { ReactNode } from "react";

import { ProjectNav } from "./project-nav";
import { StatusPill } from "./status-pill";
import { ViewToolbar } from "./view-toolbar";

interface ProjectShellProps {
  workspaceSlug: string;
  projectKey: string;
  projectTitle: string;
  projectDescription: string;
  stage: {
    label: string;
    title: string;
    progressLabel: string;
  };
  canCreate?: boolean;
  children: ReactNode;
}

export function ProjectShell({
  workspaceSlug,
  projectKey,
  projectTitle,
  projectDescription,
  stage,
  canCreate = false,
  children
}: ProjectShellProps) {
  const boardPath = `/workspaces/${workspaceSlug}/projects/${projectKey}?view=board`;

  return (
    <div className="space-y-6">
      <header className="rounded-[2rem] border border-white/10 bg-planka-card/75 p-6 shadow-[0_32px_120px_rgba(0,0,0,0.24)] backdrop-blur">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl space-y-4">
            <StatusPill tone="neutral">{projectKey}</StatusPill>
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-planka-text-muted">Project</p>
              <h1 className="mt-1 text-3xl font-semibold text-planka-text">{projectTitle}</h1>
            </div>
            <p className="text-sm leading-7 text-planka-text-muted">
              {projectDescription || "No project description yet."}
            </p>
          </div>
          <ProjectNav
            canCreate={canCreate}
            createIssueHref={`${boardPath}#create-work-item`}
            progressLabel={stage.progressLabel}
            stageLabel={stage.label}
            stageTitle={stage.title}
          />
        </div>
        <div className="mt-6">
          <ViewToolbar workspaceSlug={workspaceSlug} projectKey={projectKey} />
        </div>
      </header>
      {children}
    </div>
  );
}

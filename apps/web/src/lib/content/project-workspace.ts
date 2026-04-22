import type { ProjectRecord } from "@the-platform/shared";

import type { ProjectWorkspaceView } from "@/server/projects/workspace";

export interface ProjectWorkspaceContentDoc {
  slug: string;
  title: string;
  body: string;
}

export interface ProjectWorkspaceContent {
  brief: string;
  recentDecisions: string[];
  docs: ProjectWorkspaceContentDoc[];
}

function buildProjectBrief(
  project: Pick<ProjectRecord, "description" | "title">,
  workspaceView: ProjectWorkspaceView
) {
  if (project.description.trim().length > 0) {
    return project.description;
  }

  return `${project.title} is currently focused on ${workspaceView.stage.title.toLowerCase()}.`;
}

export function buildProjectWorkspaceContent(
  project: Pick<ProjectRecord, "description" | "key" | "title">,
  workspaceView: ProjectWorkspaceView
): ProjectWorkspaceContent {
  return {
    brief: buildProjectBrief(project, workspaceView),
    recentDecisions: [
      `Current stage focus: ${workspaceView.plan.currentStage.goal}`,
      workspaceView.plan.gates[0]?.description ?? "No stage gate has been defined yet.",
      `Engineering summary: ${workspaceView.engineering.pullRequests}, ${workspaceView.engineering.checks}, ${workspaceView.engineering.deploys}.`
    ],
    docs: [
      {
        slug: "project-brief",
        title: "Project brief",
        body: buildProjectBrief(project, workspaceView)
      },
      {
        slug: "current-stage-focus",
        title: "Current stage focus",
        body: workspaceView.plan.currentStage.goal
      },
      {
        slug: "engineering-handoff",
        title: "Engineering handoff",
        body: workspaceView.engineering.issueSummary.join("; ")
      }
    ]
  };
}

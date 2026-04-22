import type {
  PlanItemRecord,
  ProjectRecord,
  ProjectStageRecord,
  TaskGithubStatusRecord,
  WorkItemRecord
} from "@the-platform/shared";

import { resolveWorkspaceContext } from "../work-management/utils";
import { WorkspaceError } from "../workspaces/core";
import type { AppSession } from "../workspaces/types";

import type { ProjectRepository } from "./types";
import type { WorkItemRepository } from "../work-items/types";

interface ProjectWorkspaceDependencies {
  projectRepository: Pick<
    ProjectRepository,
    "findWorkspaceBySlug" | "getMembership" | "getProjectByKey" | "listProjectStages" | "listPlanItems" | "listTaskGithubStatuses"
  >;
  workItemRepository: Pick<WorkItemRepository, "listWorkItems">;
}

export interface ProjectWorkspaceCurrentStage {
  label: string;
  title: string;
  progressLabel: string;
  goal: string;
}

export interface ProjectWorkspacePlanStage {
  label: string;
  title: string;
  progressLabel: string;
}

export interface ProjectWorkspacePlanItemView {
  title: string;
  description: string;
  linkedIssues: string[];
  stageTitle: string;
}

export interface ProjectWorkspaceStageGate {
  title: string;
  description: string;
  linkedIssues: string[];
  stageTitle: string;
}

export interface ProjectWorkspaceOverviewMilestone {
  label: string;
  monthStart: number;
  monthSpan: number;
  tone: "completed" | "current" | "upcoming";
}

export interface ProjectWorkspaceView {
  project: {
    key: string;
    title: string;
    description: string;
    stage: ProjectRecord["stage"];
  };
  stage: ProjectWorkspaceCurrentStage;
  plan: {
    currentStage: ProjectWorkspaceCurrentStage;
    stages: ProjectWorkspacePlanStage[];
    items: ProjectWorkspacePlanItemView[];
    gates: ProjectWorkspaceStageGate[];
  };
  overview: {
    currentStage: string;
    health: string[];
    milestones: ProjectWorkspaceOverviewMilestone[];
  };
  engineering: {
    pullRequests: string;
    checks: string;
    deploys: string;
    issueSummary: string[];
  };
}

async function resolveProjectContext(
  projectRepository: ProjectWorkspaceDependencies["projectRepository"],
  session: AppSession,
  workspaceSlug: string,
  projectKey: string
) {
  const { workspace, membership } = await resolveWorkspaceContext(projectRepository, session, workspaceSlug, "viewer");

  const project = await projectRepository.getProjectByKey(workspace.id, projectKey);
  if (!project) {
    throw new WorkspaceError(404, "project not found.");
  }

  return {
    workspace,
    membership,
    project
  };
}

function toStagePrefix(stageTitle: string) {
  return stageTitle.split(":")[0]?.trim() || stageTitle;
}

function formatPlanProgressLabel(planItems: PlanItemRecord[], stageId: string) {
  const items = planItems.filter((item) => item.stageId === stageId);
  const completedCount = items.filter((item) => item.status === "Done").length;

  return `${completedCount}/${items.length} plan items complete`;
}

function selectCurrentStage(stages: ProjectStageRecord[]) {
  return (
    stages.find((stage) => stage.status === "In Progress") ??
    stages.find((stage) => stage.status === "Blocked") ??
    stages.find((stage) => stage.status === "Planned") ??
    stages.at(-1) ??
    null
  );
}

function buildFallbackCurrentStage(project: ProjectRecord): ProjectWorkspaceCurrentStage {
  return {
    label: "Current stage",
    title: `${project.stage} stage`,
    progressLabel: "0/0 plan items complete",
    goal: project.description || "Define the first stage to populate this workspace."
  };
}

function toStageLabel(index: number, currentStageIndex: number) {
  if (index === currentStageIndex) {
    return "Current stage";
  }

  if (index < currentStageIndex) {
    return "Completed stage";
  }

  return "Upcoming stage";
}

function toPullRequestLabel(prStatus: string) {
  switch (prStatus) {
    case "Open PR":
      return "Open";
    case "Review requested":
      return "Review requested";
    case "Merged":
      return "Merged";
    default:
      return "None";
  }
}

function toCheckLabel(ciStatus: string) {
  switch (ciStatus) {
    case "Failing":
      return "Failing";
    case "Passing":
      return "Passing";
    default:
      return "None";
  }
}

function buildCurrentStage(
  project: ProjectRecord,
  stages: ProjectStageRecord[],
  currentStage: ProjectStageRecord | null,
  currentStageIndex: number,
  planItems: PlanItemRecord[]
): ProjectWorkspaceCurrentStage {
  if (!currentStage) {
    return buildFallbackCurrentStage(project);
  }

  return {
    label: toStageLabel(currentStageIndex, currentStageIndex),
    title: currentStage.title,
    progressLabel: formatPlanProgressLabel(planItems, currentStage.id),
    goal: currentStage.goal
  };
}

function buildPlanStages(
  stages: ProjectStageRecord[],
  currentStageIndex: number,
  planItems: PlanItemRecord[]
): ProjectWorkspacePlanStage[] {
  return stages.map((stage, index) => ({
    label: toStageLabel(index, currentStageIndex),
    title: stage.title,
    progressLabel: formatPlanProgressLabel(planItems, stage.id)
  }));
}

function buildStageGates(
  stages: ProjectStageRecord[],
  issuesByStageId: Map<string, WorkItemRecord[]>
): ProjectWorkspaceStageGate[] {
  return stages.map((stage) => ({
    title: `${stage.title} gate`,
    description: `Gate status: ${stage.gateStatus}. ${stage.goal}`,
    linkedIssues: (issuesByStageId.get(stage.id) ?? [])
      .map((task) => task.identifier)
      .filter((identifier): identifier is string => Boolean(identifier)),
    stageTitle: stage.title
  }));
}

function buildOverviewMilestones(
  stages: ProjectStageRecord[],
  currentStageIndex: number
): ProjectWorkspaceOverviewMilestone[] {
  return stages.map((stage, index) => ({
    label: stage.title.replace(/^Phase \d+:\s*/, ""),
    monthStart: index * 2,
    monthSpan: 2,
    tone: index < currentStageIndex ? "completed" : index === currentStageIndex ? "current" : "upcoming"
  }));
}

function summarizeDeploys(githubStatuses: TaskGithubStatusRecord[]) {
  if (githubStatuses.some((status) => status.deployStatus === "Production")) {
    return "Production live";
  }

  if (githubStatuses.some((status) => status.deployStatus === "Staging")) {
    return "Staging live";
  }

  return "No live deploy";
}

function buildHealthSummary(tasks: WorkItemRecord[], githubStatuses: TaskGithubStatusRecord[]) {
  const blockedCount = tasks.filter((task) => task.status === "Blocked").length;
  const failingChecks = githubStatuses.filter((status) => status.ciStatus === "Failing").length;
  const readyCount = tasks.filter((task) => task.status === "Todo").length;

  return [
    `Scope: ${readyCount > 0 ? `${readyCount} ready in backlog` : "stable"}`,
    `Delivery risk: ${blockedCount > 0 ? `${blockedCount} blocked issue` : "low"}`,
    `Engineering risk: ${failingChecks > 0 ? `${failingChecks} failing check` : "stable"}`
  ];
}

export async function getProjectWorkspaceForUser(
  dependencies: ProjectWorkspaceDependencies,
  session: AppSession,
  workspaceSlug: string,
  projectKey: string
): Promise<ProjectWorkspaceView> {
  const { project } = await resolveProjectContext(dependencies.projectRepository, session, workspaceSlug, projectKey);

  const [stages, planItems, tasks, githubStatuses] = await Promise.all([
    dependencies.projectRepository.listProjectStages(project.id),
    dependencies.projectRepository.listPlanItems(project.id),
    dependencies.workItemRepository.listWorkItems(project.id),
    dependencies.projectRepository.listTaskGithubStatuses(project.id)
  ]);

  const sortedStages = [...stages].sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }

    return left.title.localeCompare(right.title);
  });
  const sortedTasks = [...tasks].sort((left, right) => {
    if (left.position !== right.position) {
      return left.position - right.position;
    }

    return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
  });
  const currentStage = selectCurrentStage(sortedStages);
  const currentStageIndex = currentStage ? sortedStages.findIndex((stage) => stage.id === currentStage.id) : 0;
  const stageById = new Map(sortedStages.map((stage) => [stage.id, stage]));
  const githubStatusByTaskId = new Map(githubStatuses.map((status) => [status.taskId, status]));
  const issuesByPlanItemId = new Map<string, WorkItemRecord[]>();
  const issuesByStageId = new Map<string, WorkItemRecord[]>();

  for (const task of sortedTasks) {
    if (task.planItemId) {
      const existing = issuesByPlanItemId.get(task.planItemId) ?? [];
      existing.push(task);
      issuesByPlanItemId.set(task.planItemId, existing);
    }

    if (task.stageId) {
      const existing = issuesByStageId.get(task.stageId) ?? [];
      existing.push(task);
      issuesByStageId.set(task.stageId, existing);
    }
  }

  const planItemsInStageOrder = [...planItems].sort((left, right) => {
    const leftStageOrder = stageById.get(left.stageId)?.sortOrder ?? Number.MAX_SAFE_INTEGER;
    const rightStageOrder = stageById.get(right.stageId)?.sortOrder ?? Number.MAX_SAFE_INTEGER;

    if (leftStageOrder !== rightStageOrder) {
      return leftStageOrder - rightStageOrder;
    }

    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }

    return left.title.localeCompare(right.title);
  });

  const currentStageCard = buildCurrentStage(project, sortedStages, currentStage, currentStageIndex, planItems);

  return {
    project: {
      key: project.key,
      title: project.title,
      description: project.description,
      stage: project.stage
    },
    stage: currentStageCard,
    plan: {
      currentStage: currentStageCard,
      stages: buildPlanStages(sortedStages, currentStageIndex, planItems),
      items: planItemsInStageOrder.map((item) => ({
        title: item.title,
        description: item.blocker ? `${item.outcome} Blocker: ${item.blocker}` : item.outcome,
        linkedIssues: (issuesByPlanItemId.get(item.id) ?? [])
          .map((task) => task.identifier)
          .filter((identifier): identifier is string => Boolean(identifier)),
        stageTitle: stageById.get(item.stageId)?.title ?? "Unassigned stage"
      })),
      gates: buildStageGates(sortedStages, issuesByStageId)
    },
    overview: {
      currentStage: currentStageCard.title,
      health: buildHealthSummary(sortedTasks, githubStatuses),
      milestones: buildOverviewMilestones(sortedStages, currentStageIndex)
    },
    engineering: {
      pullRequests: `${githubStatuses.filter((status) => status.prStatus === "Open PR" || status.prStatus === "Review requested").length} open`,
      checks: `${githubStatuses.filter((status) => status.ciStatus === "Failing").length} failing`,
      deploys: summarizeDeploys(githubStatuses),
      issueSummary: sortedTasks.map((task) => {
        const stage = task.stageId ? stageById.get(task.stageId) : undefined;
        const githubStatus = githubStatusByTaskId.get(task.id);

        return [
          task.identifier ?? "unknown",
          toPullRequestLabel(githubStatus?.prStatus ?? "No PR").toLowerCase(),
          toCheckLabel(githubStatus?.ciStatus ?? "Unknown").toLowerCase(),
          (stage ? toStagePrefix(stage.title) : "No stage").toLowerCase()
        ].join(" · ");
      })
    }
  };
}

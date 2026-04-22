import "dotenv/config";

import { pathToFileURL } from "node:url";

import type {
  PlanItemStatus,
  ProjectStage,
  StageStatus,
  TaskGithubCiStatus,
  TaskGithubDeployStatus,
  TaskGithubPrStatus,
  TaskStatus
} from "@the-platform/shared";

import { db, sql } from "./client";
import { planItems, projectStages, projects, taskGithubStatus, tasks, workspaces } from "./schema";

function getGithubSeedStatus(index: number): {
  prStatus: TaskGithubPrStatus;
  ciStatus: TaskGithubCiStatus;
  deployStatus: TaskGithubDeployStatus;
} {
  if (index === 0) {
    return {
      prStatus: "Open PR",
      ciStatus: "Failing",
      deployStatus: "Staging"
    };
  }

  if (index === 1) {
    return {
      prStatus: "Review requested",
      ciStatus: "Passing",
      deployStatus: "Not deployed"
    };
  }

  return {
    prStatus: "No PR",
    ciStatus: "Unknown",
    deployStatus: "Not deployed"
  };
}

const developmentProject = {
  title: "Platform Ops",
  description: "Seeded project for the redesigned project workspace.",
  stage: "Planning" as ProjectStage
};

const developmentTasks: Array<{
  identifier: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: "high" | "medium" | "low";
  assigneeId: string | null;
  stageSlug: string;
  planItemTitle: string;
  position: number;
}> = [
  {
    identifier: "OPS-1",
    title: "Build issue drawer with activity, comments, and engineering context",
    description: "Use a right-side issue drawer for quick work, with full-page detail for deep reading and sharing.",
    status: "Todo",
    priority: "high",
    assigneeId: "henry",
    stageSlug: "execution-surface",
    planItemTitle: "Finalize board card hierarchy and issue drawer model",
    position: 0
  },
  {
    identifier: "OPS-2",
    title: "Approve board card hierarchy and issue drawer model",
    description: "Confirm the stage plan item is ready for execution and gate review.",
    status: "Doing",
    priority: "medium",
    assigneeId: "henry",
    stageSlug: "execution-surface",
    planItemTitle: "Finalize board card hierarchy and issue drawer model",
    position: 1
  },
  {
    identifier: "OPS-3",
    title: "Revisit incident response checklists",
    description: "Update the issue triage checklist before rollout to the team workspace shell.",
    status: "Blocked",
    priority: "low",
    assigneeId: "mina",
    stageSlug: "foundation-alignment",
    planItemTitle: "Capture rollout risks and operator handoff notes",
    position: 2
  }
] as const;

const developmentStageSeed: Array<{
  slug: string;
  title: string;
  goal: string;
  status: StageStatus;
  gateStatus: string;
  sortOrder: number;
}> = [
  {
    slug: "foundation-alignment",
    title: "Phase 1: Foundation Alignment",
    goal: "Stabilize the shared project shell model and document rollout risks.",
    status: "Completed",
    gateStatus: "Passed",
    sortOrder: 0
  },
  {
    slug: "execution-surface",
    title: "Phase 2: Execution Surface",
    goal: "Align the board, plan, and issue drawer model before rollout.",
    status: "In Progress",
    gateStatus: "In review",
    sortOrder: 1
  }
];

const developmentPlanItemSeed: Array<{
  stageSlug: string;
  title: string;
  outcome: string;
  status: PlanItemStatus;
  blocker: string | null;
  sortOrder: number;
}> = [
  {
    stageSlug: "foundation-alignment",
    title: "Capture rollout risks and operator handoff notes",
    outcome: "The rollout has a clear risk register and operator handoff checklist.",
    status: "Done",
    blocker: null,
    sortOrder: 0
  },
  {
    stageSlug: "execution-surface",
    title: "Finalize board card hierarchy and issue drawer model",
    outcome: "The redesigned board and issue detail model are stable enough for implementation.",
    status: "In Review",
    blocker: null,
    sortOrder: 0
  }
];

export async function seedDevelopmentData() {
  await db.delete(workspaces);

  const seededWorkspaces = await db
    .insert(workspaces)
    .values({
      name: "Development Workspace",
      slug: "development-workspace"
    })
    .returning({
      id: workspaces.id,
      name: workspaces.name
    });
  const workspace = seededWorkspaces[0];

  if (!workspace) {
    throw new Error("Failed to insert development seed workspace.");
  }

  const seededProjects = await db
    .insert(projects)
    .values({
      ...developmentProject,
      workspaceId: workspace.id,
      key: "OPS",
      itemCounter: developmentTasks.length
    })
    .returning({
      id: projects.id,
      title: projects.title
    });
  const project = seededProjects[0];

  if (!project) {
    throw new Error("Failed to insert development seed project.");
  }

  const seededStages = await db
    .insert(projectStages)
    .values(
      developmentStageSeed.map((stage) => ({
        ...stage,
        projectId: project.id
      }))
    )
    .returning({
      id: projectStages.id,
      slug: projectStages.slug
    });

  const stageIdBySlug = new Map(seededStages.map((stage) => [stage.slug, stage.id]));

  const seededPlanItems = await db
    .insert(planItems)
    .values(
      developmentPlanItemSeed.map((item) => {
        const stageId = stageIdBySlug.get(item.stageSlug);

        if (!stageId) {
          throw new Error(`Missing stage for plan item seed: ${item.stageSlug}`);
        }

        return {
          stageId,
          title: item.title,
          outcome: item.outcome,
          status: item.status,
          blocker: item.blocker,
          sortOrder: item.sortOrder
        };
      })
    )
    .returning({
      id: planItems.id,
      stageId: planItems.stageId,
      title: planItems.title
    });

  const planItemIdByStageAndTitle = new Map(
    seededPlanItems.map((item) => [`${item.stageId}:${item.title}`, item.id])
  );

  const seededTasks = await db
    .insert(tasks)
    .values(
      developmentTasks.map((task) => {
        const stageId = stageIdBySlug.get(task.stageSlug);

        if (!stageId) {
          throw new Error(`Missing stage for task seed: ${task.stageSlug}`);
        }

        const planItemId = planItemIdByStageAndTitle.get(`${stageId}:${task.planItemTitle}`);

        if (!planItemId) {
          throw new Error(`Missing plan item for task seed: ${task.stageSlug}/${task.planItemTitle}`);
        }

        return {
          projectId: project.id,
          identifier: task.identifier,
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          assigneeId: task.assigneeId,
          stageId,
          planItemId,
          position: task.position
        };
      })
    )
    .returning({
      id: tasks.id
    });

  await db.insert(taskGithubStatus).values(
    seededTasks.map((task, index) => ({
      taskId: task.id,
      ...getGithubSeedStatus(index)
    }))
  );

  return {
    projectTitle: project.title,
    projectCount: 1,
    stageCount: developmentStageSeed.length,
    planItemCount: developmentPlanItemSeed.length,
    taskCount: developmentTasks.length
  };
}

async function main() {
  const result = await seedDevelopmentData();

  console.info(
    `Seeded ${result.projectCount} project (${result.projectTitle}), ${result.stageCount} stages, ${result.planItemCount} plan items, and ${result.taskCount} tasks.`
  );
}

async function closeConnection() {
  await sql.end();
}

const isDirectExecution =
  typeof process.argv[1] === "string" && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  main()
    .catch((error: unknown) => {
      console.error("Failed to seed development data.");
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await closeConnection();
    });
}

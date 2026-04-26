import "dotenv/config";

import { pathToFileURL } from "node:url";

import type {
  GithubCheckRollupStatus,
  GithubDeploymentEnvironment,
  GithubDeploymentStatus,
  GithubPullRequestState,
  GithubWebhookDeliveryStatus,
  GithubWebhookEventName,
  NotificationEventType,
  NotificationPriority,
  NotificationRecipientReason,
  NotificationSourceType,
  PlanItemStatus,
  ProjectStage,
  StageStatus,
  TaskGithubCiStatus,
  TaskGithubDeployStatus,
  TaskGithubPrStatus,
  TaskStatus,
  WorkItemGithubLinkSource
} from "@the-platform/shared";

import { db, sql } from "./client";
import {
  githubCheckRollups,
  githubDeployments,
  githubPullRequests,
  githubRepositories,
  githubWebhookDeliveries,
  notificationEvents,
  notificationPreferences,
  notificationRecipients,
  planItems,
  projectGithubConnections,
  projectStages,
  projects,
  taskGithubStatus,
  tasks,
  workItemGithubLinks,
  workspaces
} from "./schema";

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

const developmentGithubRepositorySeed = {
  providerRepositoryId: "repo_platform_ops_local",
  owner: "the-platform",
  name: "platform-ops",
  fullName: "the-platform/platform-ops",
  defaultBranch: "main",
  installationId: "installation_platform_ops_local"
} as const;

const developmentGithubPullRequestSeed: Array<{
  taskIdentifier: string;
  providerPullRequestId: string;
  number: number;
  title: string;
  body: string | null;
  url: string;
  state: GithubPullRequestState;
  isDraft: boolean;
  authorLogin: string;
  baseBranch: string;
  headBranch: string;
  headSha: string;
  mergedAt: string | null;
  closedAt: string | null;
}> = [
  {
    taskIdentifier: "OPS-1",
    providerPullRequestId: "pr_ops_1",
    number: 128,
    title: "OPS-1 Build issue drawer with activity, comments, and engineering context",
    body: "Implements the engineering context shell for OPS-1.",
    url: "https://github.com/the-platform/platform-ops/pull/128",
    state: "open",
    isDraft: false,
    authorLogin: "henry",
    baseBranch: "main",
    headBranch: "feature/ops-1-issue-drawer",
    headSha: "a1b2c3d4e5f607182930aabbccddeeff00112233",
    mergedAt: null,
    closedAt: null
  },
  {
    taskIdentifier: "OPS-2",
    providerPullRequestId: "pr_ops_2",
    number: 130,
    title: "OPS-2 Approve board card hierarchy and issue drawer model",
    body: "Requests review for OPS-2 before rollout.",
    url: "https://github.com/the-platform/platform-ops/pull/130",
    state: "open",
    isDraft: false,
    authorLogin: "henry",
    baseBranch: "main",
    headBranch: "feature/ops-2-board-review",
    headSha: "b1c2d3e4f50617283940bbccddeeaa1100223344",
    mergedAt: null,
    closedAt: null
  }
];

const developmentGithubCheckRollupSeed: Array<{
  headSha: string;
  status: GithubCheckRollupStatus;
  url: string;
  checkCount: number;
  completedAt: string | null;
}> = [
  {
    headSha: "a1b2c3d4e5f607182930aabbccddeeff00112233",
    status: "failing",
    url: "https://github.com/the-platform/platform-ops/actions/runs/501",
    checkCount: 7,
    completedAt: null
  },
  {
    headSha: "b1c2d3e4f50617283940bbccddeeaa1100223344",
    status: "passing",
    url: "https://github.com/the-platform/platform-ops/actions/runs/502",
    checkCount: 5,
    completedAt: "2026-04-22T16:05:00.000Z"
  }
];

const developmentGithubDeploymentSeed: Array<{
  headSha: string;
  providerDeploymentId: string;
  environmentName: string;
  environment: GithubDeploymentEnvironment;
  status: GithubDeploymentStatus;
  url: string;
}> = [
  {
    headSha: "a1b2c3d4e5f607182930aabbccddeeff00112233",
    providerDeploymentId: "deployment_ops_1",
    environmentName: "staging",
    environment: "staging",
    status: "success",
    url: "https://github.com/the-platform/platform-ops/deployments/401"
  }
];

const developmentGithubLinkSeed: Array<{
  taskIdentifier: string;
  branchName: string;
  source: WorkItemGithubLinkSource;
  confidence: number;
}> = [
  {
    taskIdentifier: "OPS-1",
    branchName: "feature/ops-1-issue-drawer",
    source: "pr_title",
    confidence: 100
  },
  {
    taskIdentifier: "OPS-2",
    branchName: "feature/ops-2-board-review",
    source: "pr_title",
    confidence: 100
  }
];

const developmentGithubWebhookDeliverySeed: Array<{
  deliveryId: string;
  eventName: GithubWebhookEventName;
  status: GithubWebhookDeliveryStatus;
  receivedAt: string;
  processedAt: string | null;
  errorMessage: string | null;
}> = [
  {
    deliveryId: "delivery_ops_pr_128",
    eventName: "pull_request",
    status: "processed",
    receivedAt: "2026-04-22T15:45:00.000Z",
    processedAt: "2026-04-22T15:45:02.000Z",
    errorMessage: null
  },
  {
    deliveryId: "delivery_ops_deploy_401",
    eventName: "deployment_status",
    status: "failed",
    receivedAt: "2026-04-22T15:50:00.000Z",
    processedAt: "2026-04-22T15:50:01.000Z",
    errorMessage: "Temporary GitHub status replay required for deployment classification."
  }
];

const developmentNotificationSeed: Array<{
  workItemIdentifier: string;
  sourceType: NotificationSourceType;
  sourceId: string;
  eventType: NotificationEventType;
  actorId: string | null;
  priority: NotificationPriority;
  title: string;
  body: string | null;
  url: string;
  metadata: Record<string, unknown> | null;
  recipientId: string;
  reason: NotificationRecipientReason;
}> = [
  {
    workItemIdentifier: "OPS-1",
    sourceType: "github",
    sourceId: "pr_ops_1:failing-check",
    eventType: "github_check_changed",
    actorId: null,
    priority: "high",
    title: "OPS-1 has a failing CI check",
    body: "The linked pull request for OPS-1 needs attention before the current stage can pass.",
    url: "/workspaces/development-workspace/projects/OPS/items/OPS-1",
    metadata: {
      repository: "the-platform/platform-ops",
      checkStatus: "failing"
    },
    recipientId: "henry",
    reason: "github"
  }
];

export async function seedDevelopmentData() {
  await db.delete(githubWebhookDeliveries);
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
      id: tasks.id,
      identifier: tasks.identifier
    });

  const taskIdByIdentifier = new Map(
    seededTasks.flatMap((task) => (task.identifier ? [[task.identifier, task.id] as const] : []))
  );

  const seededRepositoryRows = await db
    .insert(githubRepositories)
    .values({
      workspaceId: workspace.id,
      providerRepositoryId: developmentGithubRepositorySeed.providerRepositoryId,
      owner: developmentGithubRepositorySeed.owner,
      name: developmentGithubRepositorySeed.name,
      fullName: developmentGithubRepositorySeed.fullName,
      defaultBranch: developmentGithubRepositorySeed.defaultBranch,
      installationId: developmentGithubRepositorySeed.installationId
    })
    .returning({
      id: githubRepositories.id
    });
  const repository = seededRepositoryRows[0];

  if (!repository) {
    throw new Error("Failed to insert development seed GitHub repository.");
  }

  await db.insert(projectGithubConnections).values({
    projectId: project.id,
    repositoryId: repository.id,
    stagingEnvironmentName: "staging",
    productionEnvironmentName: "production"
  });

  const seededPullRequests = await db
    .insert(githubPullRequests)
    .values(
      developmentGithubPullRequestSeed.map((pullRequest) => ({
        repositoryId: repository.id,
        providerPullRequestId: pullRequest.providerPullRequestId,
        number: pullRequest.number,
        title: pullRequest.title,
        body: pullRequest.body,
        url: pullRequest.url,
        state: pullRequest.state,
        isDraft: pullRequest.isDraft,
        authorLogin: pullRequest.authorLogin,
        baseBranch: pullRequest.baseBranch,
        headBranch: pullRequest.headBranch,
        headSha: pullRequest.headSha,
        mergedAt: pullRequest.mergedAt ? new Date(pullRequest.mergedAt) : null,
        closedAt: pullRequest.closedAt ? new Date(pullRequest.closedAt) : null
      }))
    )
    .returning({
      id: githubPullRequests.id,
      headSha: githubPullRequests.headSha,
      number: githubPullRequests.number
    });

  const pullRequestIdByNumber = new Map(seededPullRequests.map((pullRequest) => [pullRequest.number, pullRequest.id]));
  const pullRequestIdByTaskIdentifier = new Map(
    developmentGithubPullRequestSeed.map((pullRequest) => [
      pullRequest.taskIdentifier,
      pullRequestIdByNumber.get(pullRequest.number) ?? null
    ])
  );

  await db.insert(githubCheckRollups).values(
    developmentGithubCheckRollupSeed.map((checkRollup) => ({
      repositoryId: repository.id,
      headSha: checkRollup.headSha,
      status: checkRollup.status,
      url: checkRollup.url,
      checkCount: checkRollup.checkCount,
      completedAt: checkRollup.completedAt ? new Date(checkRollup.completedAt) : null
    }))
  );

  await db.insert(githubDeployments).values(
    developmentGithubDeploymentSeed.map((deployment) => ({
      repositoryId: repository.id,
      providerDeploymentId: deployment.providerDeploymentId,
      headSha: deployment.headSha,
      environmentName: deployment.environmentName,
      environment: deployment.environment,
      status: deployment.status,
      url: deployment.url
    }))
  );

  await db.insert(workItemGithubLinks).values(
    developmentGithubLinkSeed.map((link) => {
      const taskId = taskIdByIdentifier.get(link.taskIdentifier);

      if (!taskId) {
        throw new Error(`Missing task for GitHub link seed: ${link.taskIdentifier}`);
      }

      return {
        workItemId: taskId,
        repositoryId: repository.id,
        pullRequestId: pullRequestIdByTaskIdentifier.get(link.taskIdentifier) ?? null,
        branchName: link.branchName,
        source: link.source,
        confidence: link.confidence
      };
    })
  );

  await db.insert(githubWebhookDeliveries).values(
    developmentGithubWebhookDeliverySeed.map((delivery) => ({
      repositoryId: repository.id,
      deliveryId: delivery.deliveryId,
      eventName: delivery.eventName,
      status: delivery.status,
      receivedAt: new Date(delivery.receivedAt),
      processedAt: delivery.processedAt ? new Date(delivery.processedAt) : null,
      errorMessage: delivery.errorMessage
    }))
  );

  await db.insert(notificationPreferences).values({
    workspaceId: workspace.id,
    userId: "henry"
  });

  const seededNotificationEvents = await db
    .insert(notificationEvents)
    .values(
      developmentNotificationSeed.map((notification) => {
        const taskId = taskIdByIdentifier.get(notification.workItemIdentifier);

        if (!taskId) {
          throw new Error(`Missing task for notification seed: ${notification.workItemIdentifier}`);
        }

        return {
          workspaceId: workspace.id,
          projectId: project.id,
          workItemId: taskId,
          sourceType: notification.sourceType,
          sourceId: notification.sourceId,
          eventType: notification.eventType,
          actorId: notification.actorId,
          priority: notification.priority,
          title: notification.title,
          body: notification.body,
          url: notification.url,
          metadata: notification.metadata
        };
      })
    )
    .returning({
      id: notificationEvents.id,
      sourceId: notificationEvents.sourceId
    });

  const notificationEventIdBySourceId = new Map(
    seededNotificationEvents.map((notification) => [notification.sourceId, notification.id])
  );

  await db.insert(notificationRecipients).values(
    developmentNotificationSeed.map((notification) => {
      const eventId = notificationEventIdBySourceId.get(notification.sourceId);

      if (!eventId) {
        throw new Error(`Missing notification event for recipient seed: ${notification.sourceId}`);
      }

      return {
        eventId,
        workspaceId: workspace.id,
        recipientId: notification.recipientId,
        reason: notification.reason
      };
    })
  );

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

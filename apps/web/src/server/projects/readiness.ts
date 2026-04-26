import type {
  NotificationInboxItem,
  PlanItemRecord,
  ProjectStageRecord,
  TaskGithubStatusRecord,
  WorkItemRecord,
} from "@the-platform/shared";

export type ProjectReadinessStatus = "Ready" | "Ready with risk" | "Blocked";
export type ProjectReadinessTone = "success" | "warning" | "danger" | "neutral";
export type ProjectReadinessActionSource =
  | "work_item"
  | "plan"
  | "github"
  | "notification";

export interface ProjectReadinessMetric {
  label: string;
  value: string;
  detail: string;
  tone: ProjectReadinessTone;
}

export interface ProjectReadinessDecisionCue {
  label: string;
  value: string;
  tone: ProjectReadinessTone;
}

export interface ProjectReadinessAction {
  id: string;
  title: string;
  detail: string;
  href: string;
  sourceType: ProjectReadinessActionSource;
  priority: "high" | "medium" | "low";
}

export interface ProjectReadinessEngineeringSignal {
  taskId: string;
  identifier: string;
  checkLabel: string;
  checkUrl: string | null;
  pullRequestLabel: string;
  pullRequestUrl: string | null;
}

export interface ProjectReadinessView {
  status: ProjectReadinessStatus;
  tone: ProjectReadinessTone;
  narrative: string;
  metrics: ProjectReadinessMetric[];
  decisionCues: ProjectReadinessDecisionCue[];
  actions: ProjectReadinessAction[];
}

export interface BuildProjectReadinessInput {
  baseProjectHref?: string;
  currentStage: ProjectStageRecord | null;
  stages: ProjectStageRecord[];
  planItems: PlanItemRecord[];
  tasks: WorkItemRecord[];
  githubStatuses: TaskGithubStatusRecord[];
  engineeringItems: ProjectReadinessEngineeringSignal[];
  notificationInbox: NotificationInboxItem[];
}

interface RankedReadinessAction extends ProjectReadinessAction {
  rank: number;
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function hasBlockedReason(task: WorkItemRecord) {
  return Boolean(task.blockedReason?.trim());
}

function isActiveTask(task: WorkItemRecord) {
  return task.status !== "Done";
}

function isIncompletePlanItem(planItem: PlanItemRecord) {
  return planItem.status !== "Done";
}

function taskLabel(task: WorkItemRecord) {
  return task.identifier ? `${task.identifier}: ${task.title}` : task.title;
}

function stableHref(input: BuildProjectReadinessInput, suffix = "") {
  return input.baseProjectHref
    ? `${input.baseProjectHref.replace(/\/+$/, "")}${suffix}`
    : "#";
}

function workItemHref(input: BuildProjectReadinessInput, task: WorkItemRecord) {
  return task.identifier
    ? stableHref(input, `/items/${task.identifier}`)
    : stableHref(input);
}

function planHref(input: BuildProjectReadinessInput) {
  return stableHref(input, "/plan");
}

function engineeringHref(input: BuildProjectReadinessInput) {
  return stableHref(input, "/engineering");
}

function findEngineeringItem(
  engineeringItems: ProjectReadinessEngineeringSignal[],
  githubStatus: TaskGithubStatusRecord
) {
  return engineeringItems.find((item) => item.taskId === githubStatus.taskId);
}

function buildMetrics(
  input: BuildProjectReadinessInput
): ProjectReadinessMetric[] {
  const activeTasks = input.tasks.filter(isActiveTask);
  const blockedTaskCount = activeTasks.filter(
    (task) => task.status === "Blocked" || hasBlockedReason(task)
  ).length;
  const urgentTaskCount = activeTasks.filter(
    (task) => task.priority === "urgent"
  ).length;
  const failingCheckCount = input.githubStatuses.filter(
    (status) => status.ciStatus === "Failing"
  ).length;
  const unreadNotificationCount = input.notificationInbox.filter(
    (notification) => notification.isUnread
  ).length;
  const currentStagePlanItems = input.currentStage
    ? input.planItems.filter(
        (planItem) => planItem.stageId === input.currentStage?.id
      )
    : [];
  const completedCurrentStagePlanItems = currentStagePlanItems.filter(
    (planItem) => planItem.status === "Done"
  ).length;

  return [
    {
      label: "Work items",
      value: pluralize(blockedTaskCount, "blocked"),
      detail: `${pluralize(urgentTaskCount, "urgent item")} in scope`,
      tone:
        blockedTaskCount > 0
          ? "danger"
          : urgentTaskCount > 0
            ? "warning"
            : "success",
    },
    {
      label: "GitHub",
      value: pluralize(failingCheckCount, "failing check"),
      detail: `${pluralize(input.githubStatuses.length, "GitHub signal")} tracked`,
      tone: failingCheckCount > 0 ? "danger" : "success",
    },
    {
      label: "Current plan",
      value: `${completedCurrentStagePlanItems}/${currentStagePlanItems.length} complete`,
      detail: input.currentStage?.title ?? "No current stage selected",
      tone: currentStagePlanItems.some(isIncompletePlanItem)
        ? "warning"
        : "success",
    },
    {
      label: "Notifications",
      value: `${unreadNotificationCount} unread`,
      detail: `${pluralize(
        input.notificationInbox.filter(
          (notification) =>
            notification.isUnread && notification.event.priority === "high"
        ).length,
        "high-priority notification"
      )}`,
      tone: input.notificationInbox.some(
        (notification) =>
          notification.isUnread && notification.event.priority === "high"
      )
        ? "warning"
        : "neutral",
    },
  ];
}

function buildDecisionCues(
  input: BuildProjectReadinessInput,
  status: ProjectReadinessStatus
): ProjectReadinessDecisionCue[] {
  const failingCheckCount = input.githubStatuses.filter(
    (githubStatus) => githubStatus.ciStatus === "Failing"
  ).length;
  const stageBlockerCount = input.currentStage?.status === "Blocked" ? 1 : 0;
  const activeTasks = input.tasks.filter(isActiveTask);
  const blockedTaskCount = activeTasks.filter(
    (task) => task.status === "Blocked" || hasBlockedReason(task)
  ).length;
  const reviewPrCount = input.githubStatuses.filter(
    (githubStatus) =>
      githubStatus.prStatus === "Open PR" ||
      githubStatus.prStatus === "Review requested"
  ).length;
  const currentStagePlanItems = input.currentStage
    ? input.planItems.filter(
        (planItem) => planItem.stageId === input.currentStage?.id
      )
    : [];
  const incompletePlanItemCount =
    currentStagePlanItems.filter(isIncompletePlanItem).length;

  return [
    {
      label: "Ship gate",
      value:
        status === "Blocked"
          ? `${pluralize(
              failingCheckCount + stageBlockerCount + blockedTaskCount,
              "blocker"
            )} to clear`
          : status === "Ready with risk"
            ? "Proceed with watch items"
            : "Clear",
      tone:
        status === "Blocked"
          ? "danger"
          : status === "Ready with risk"
            ? "warning"
            : "success",
    },
    {
      label: "Review load",
      value: pluralize(reviewPrCount, "PR needing attention"),
      tone: reviewPrCount > 0 ? "warning" : "success",
    },
    {
      label: "Plan confidence",
      value: pluralize(incompletePlanItemCount, "open plan item"),
      tone: incompletePlanItemCount > 0 ? "warning" : "success",
    },
  ];
}

function buildActions(
  input: BuildProjectReadinessInput
): ProjectReadinessAction[] {
  const actions: RankedReadinessAction[] = [];
  const currentStagePlanItems = input.currentStage
    ? input.planItems.filter(
        (planItem) => planItem.stageId === input.currentStage?.id
      )
    : [];

  for (const githubStatus of input.githubStatuses.filter(
    (status) => status.ciStatus === "Failing"
  )) {
    const engineeringItem = findEngineeringItem(
      input.engineeringItems,
      githubStatus
    );
    actions.push({
      id: `github-check-${githubStatus.id}`,
      title: engineeringItem
        ? `Fix failing checks for ${engineeringItem.identifier}`
        : "Fix failing checks",
      detail:
        engineeringItem?.checkLabel ?? "CI is failing and blocks readiness.",
      href: engineeringItem?.checkUrl ?? engineeringHref(input),
      sourceType: "github",
      priority: "high",
      rank: 0,
    });
  }

  for (const task of input.tasks.filter(
    (item) =>
      isActiveTask(item) &&
      (item.status === "Blocked" || hasBlockedReason(item))
  )) {
    actions.push({
      id: `blocked-work-item-${task.id}`,
      title: `Unblock ${taskLabel(task)}`,
      detail: task.blockedReason?.trim() || "Work item is blocked.",
      href: workItemHref(input, task),
      sourceType: "work_item",
      priority: "high",
      rank: 1,
    });
  }

  if (input.currentStage?.status === "Blocked") {
    actions.push({
      id: `stage-gate-${input.currentStage.id}`,
      title: `Resolve blocked stage gate: ${input.currentStage.title}`,
      detail: input.currentStage.gateStatus || input.currentStage.goal,
      href: planHref(input),
      sourceType: "plan",
      priority: "high",
      rank: 2,
    });
  }

  for (const task of input.tasks.filter(
    (item) => isActiveTask(item) && item.priority === "urgent"
  )) {
    actions.push({
      id: `urgent-work-item-${task.id}`,
      title: `Resolve urgent work: ${taskLabel(task)}`,
      detail: "Urgent priority is a readiness risk.",
      href: workItemHref(input, task),
      sourceType: "work_item",
      priority: "medium",
      rank: 3,
    });
  }

  for (const githubStatus of input.githubStatuses.filter(
    (status) =>
      status.prStatus === "Open PR" || status.prStatus === "Review requested"
  )) {
    const engineeringItem = findEngineeringItem(
      input.engineeringItems,
      githubStatus
    );
    actions.push({
      id: `github-pr-${githubStatus.id}`,
      title: engineeringItem
        ? `Review ${engineeringItem.identifier}`
        : "Review pull request",
      detail: engineeringItem?.pullRequestLabel ?? githubStatus.prStatus,
      href: engineeringItem?.pullRequestUrl ?? engineeringHref(input),
      sourceType: "github",
      priority: "medium",
      rank: 4,
    });
  }

  for (const notification of input.notificationInbox.filter(
    (item) => item.isUnread && item.event.priority === "high"
  )) {
    actions.push({
      id: `notification-${notification.recipient.id}`,
      title: notification.event.title,
      detail: notification.event.body ?? "High-priority unread notification.",
      href: notification.event.url,
      sourceType: "notification",
      priority: "medium",
      rank: 5,
    });
  }

  for (const planItem of currentStagePlanItems.filter(isIncompletePlanItem)) {
    actions.push({
      id: `plan-${planItem.id}`,
      title: `Finish plan item: ${planItem.title}`,
      detail: planItem.blocker?.trim() || planItem.outcome,
      href: planHref(input),
      sourceType: "plan",
      priority: "low",
      rank: 6,
    });
  }

  return actions
    .sort(
      (left, right) => left.rank - right.rank || left.id.localeCompare(right.id)
    )
    .slice(0, 5)
    .map(({ rank: _rank, ...action }) => action);
}

function buildNarrative(
  input: BuildProjectReadinessInput,
  status: ProjectReadinessStatus
) {
  const failingCheckCount = input.githubStatuses.filter(
    (githubStatus) => githubStatus.ciStatus === "Failing"
  ).length;
  const isCurrentStageBlocked = input.currentStage?.status === "Blocked";
  const activeTasks = input.tasks.filter(isActiveTask);
  const blockedTaskCount = activeTasks.filter(
    (task) => task.status === "Blocked" || hasBlockedReason(task)
  ).length;
  const urgentTaskCount = activeTasks.filter(
    (task) => task.priority === "urgent"
  ).length;
  const reviewPrCount = input.githubStatuses.filter(
    (githubStatus) =>
      githubStatus.prStatus === "Open PR" ||
      githubStatus.prStatus === "Review requested"
  ).length;
  const highPriorityUnreadCount = input.notificationInbox.filter(
    (notification) =>
      notification.isUnread && notification.event.priority === "high"
  ).length;
  const currentStagePlanItems = input.currentStage
    ? input.planItems.filter(
        (planItem) => planItem.stageId === input.currentStage?.id
      )
    : [];
  const incompletePlanItemCount =
    currentStagePlanItems.filter(isIncompletePlanItem).length;
  const hasStagingDeployWithoutProduction =
    input.githubStatuses.some(
      (githubStatus) => githubStatus.deployStatus === "Staging"
    ) &&
    !input.githubStatuses.some(
      (githubStatus) => githubStatus.deployStatus === "Production"
    );

  if (status === "Blocked") {
    const blockers = [
      isCurrentStageBlocked ? "current stage is blocked" : null,
      failingCheckCount > 0
        ? pluralize(failingCheckCount, "failing check")
        : null,
      blockedTaskCount > 0
        ? pluralize(blockedTaskCount, "blocked work item")
        : null,
    ].filter((blocker): blocker is string => Boolean(blocker));

    return `Readiness is blocked by ${
      blockers.length > 0 ? blockers.join(", ") : "a readiness blocker"
    }.`;
  }

  if (status === "Ready with risk") {
    const risks = [
      urgentTaskCount > 0
        ? pluralize(urgentTaskCount, "urgent work item")
        : null,
      reviewPrCount > 0
        ? pluralize(reviewPrCount, "PR awaiting review", "PRs awaiting review")
        : null,
      highPriorityUnreadCount > 0
        ? pluralize(highPriorityUnreadCount, "high-priority notification")
        : null,
      hasStagingDeployWithoutProduction
        ? "staging deploy without production"
        : null,
      incompletePlanItemCount > 0
        ? pluralize(incompletePlanItemCount, "incomplete plan item")
        : null,
    ].filter((risk): risk is string => Boolean(risk));

    return `Ready with risk: ${
      risks.length > 0 ? risks.join(", ") : "readiness watch item"
    } need attention.`;
  }

  return "Ready: no blocking work, no urgent risks, and release signals are stable.";
}

export function buildProjectReadiness(
  input: BuildProjectReadinessInput
): ProjectReadinessView {
  const hasProductionDeploy = input.githubStatuses.some(
    (githubStatus) => githubStatus.deployStatus === "Production"
  );
  const currentStagePlanItems = input.currentStage
    ? input.planItems.filter(
        (planItem) => planItem.stageId === input.currentStage?.id
      )
    : [];
  const isBlocked =
    input.currentStage?.status === "Blocked" ||
    input.tasks
      .filter(isActiveTask)
      .some((task) => task.status === "Blocked" || hasBlockedReason(task)) ||
    input.githubStatuses.some(
      (githubStatus) => githubStatus.ciStatus === "Failing"
    );
  const hasRisk =
    input.tasks
      .filter(isActiveTask)
      .some((task) => task.priority === "urgent") ||
    input.githubStatuses.some(
      (githubStatus) =>
        githubStatus.prStatus === "Open PR" ||
        githubStatus.prStatus === "Review requested"
    ) ||
    (input.githubStatuses.some(
      (githubStatus) => githubStatus.deployStatus === "Staging"
    ) &&
      !hasProductionDeploy) ||
    input.notificationInbox.some(
      (notification) =>
        notification.isUnread && notification.event.priority === "high"
    ) ||
    currentStagePlanItems.some(isIncompletePlanItem);
  const status: ProjectReadinessStatus = isBlocked
    ? "Blocked"
    : hasRisk
      ? "Ready with risk"
      : "Ready";
  const tone: ProjectReadinessTone =
    status === "Blocked"
      ? "danger"
      : status === "Ready with risk"
        ? "warning"
        : "success";

  return {
    status,
    tone,
    narrative: buildNarrative(input, status),
    metrics: buildMetrics(input),
    decisionCues: buildDecisionCues(input, status),
    actions: buildActions(input),
  };
}

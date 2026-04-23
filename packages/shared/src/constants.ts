export const APP_NAME = "The Platform";

export const projectStages = [
  "Idea",
  "Planning",
  "Active",
  "Paused",
  "Completed",
  "Archived"
] as const satisfies readonly [string, ...string[]];

export const taskStatuses = ["Todo", "Doing", "Blocked", "Done"] as const satisfies readonly [
  string,
  ...string[]
];

export const stageStatuses = ["Planned", "In Progress", "Blocked", "Completed"] as const satisfies readonly [
  string,
  ...string[]
];

export const planItemStatuses = ["Todo", "In Review", "Blocked", "Done"] as const satisfies readonly [
  string,
  ...string[]
];

export const workspaceRoles = ["owner", "admin", "member", "viewer"] as const satisfies readonly [
  string,
  ...string[]
];

export const invitationStatuses = ["pending", "accepted", "revoked"] as const satisfies readonly [
  string,
  ...string[]
];

export const workItemTypes = ["epic", "task", "subtask"] as const satisfies readonly [
  string,
  ...string[]
];

export const workItemPriorities = ["urgent", "high", "medium", "low", "none"] as const satisfies readonly [
  string,
  ...string[]
];

export const taskGithubPrStatuses = ["No PR", "Open PR", "Review requested", "Merged"] as const satisfies readonly [
  string,
  ...string[]
];

export const taskGithubCiStatuses = ["Unknown", "Passing", "Failing"] as const satisfies readonly [
  string,
  ...string[]
];

export const taskGithubDeployStatuses = ["Not deployed", "Staging", "Production"] as const satisfies readonly [
  string,
  ...string[]
];

export const githubRepositoryProviders = ["github"] as const satisfies readonly [string, ...string[]];

export const githubPullRequestStates = ["open", "closed", "merged"] as const satisfies readonly [
  string,
  ...string[]
];

export const githubCheckRollupStatuses = [
  "pending",
  "passing",
  "failing",
  "cancelled",
  "skipped",
  "unknown"
] as const satisfies readonly [string, ...string[]];

export const githubDeploymentEnvironments = [
  "development",
  "preview",
  "staging",
  "production",
  "other"
] as const satisfies readonly [string, ...string[]];

export const githubDeploymentStatuses = [
  "queued",
  "in_progress",
  "success",
  "failure",
  "inactive",
  "unknown"
] as const satisfies readonly [string, ...string[]];

export const workItemGithubLinkSources = ["pr_title", "pr_body", "branch_name", "manual"] as const satisfies readonly [
  string,
  ...string[]
];

export const githubWebhookEventNames = [
  "pull_request",
  "check_run",
  "check_suite",
  "deployment",
  "deployment_status"
] as const satisfies readonly [string, ...string[]];

export const githubWebhookDeliveryStatuses = ["pending", "processed", "ignored", "failed"] as const satisfies readonly [
  string,
  ...string[]
];

export const workflowStateCategories = ["backlog", "active", "done"] as const satisfies readonly [
  string,
  ...string[]
];

export const foundationPackages = ["apps/web", "apps/worker", "packages/db", "packages/shared"] as const;

export type ProjectStage = (typeof projectStages)[number];
export type TaskStatus = (typeof taskStatuses)[number];
export type StageStatus = (typeof stageStatuses)[number];
export type PlanItemStatus = (typeof planItemStatuses)[number];
export type WorkspaceRole = (typeof workspaceRoles)[number];
export type InvitationStatus = (typeof invitationStatuses)[number];
export type WorkItemType = (typeof workItemTypes)[number];
export type WorkItemPriority = (typeof workItemPriorities)[number];
export type TaskGithubPrStatus = (typeof taskGithubPrStatuses)[number];
export type TaskGithubCiStatus = (typeof taskGithubCiStatuses)[number];
export type TaskGithubDeployStatus = (typeof taskGithubDeployStatuses)[number];
export type GithubRepositoryProvider = (typeof githubRepositoryProviders)[number];
export type GithubPullRequestState = (typeof githubPullRequestStates)[number];
export type GithubCheckRollupStatus = (typeof githubCheckRollupStatuses)[number];
export type GithubDeploymentEnvironment = (typeof githubDeploymentEnvironments)[number];
export type GithubDeploymentStatus = (typeof githubDeploymentStatuses)[number];
export type WorkItemGithubLinkSource = (typeof workItemGithubLinkSources)[number];
export type GithubWebhookEventName = (typeof githubWebhookEventNames)[number];
export type GithubWebhookDeliveryStatus = (typeof githubWebhookDeliveryStatuses)[number];
export type WorkflowStateCategory = (typeof workflowStateCategories)[number];

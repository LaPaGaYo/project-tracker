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
export type WorkflowStateCategory = (typeof workflowStateCategories)[number];

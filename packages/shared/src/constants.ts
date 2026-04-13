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

export const foundationPackages = ["apps/web", "apps/worker", "packages/db", "packages/shared"] as const;

export type ProjectStage = (typeof projectStages)[number];
export type TaskStatus = (typeof taskStatuses)[number];

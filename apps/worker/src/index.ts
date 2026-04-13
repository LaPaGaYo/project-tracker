import { schemaTableNames } from "@the-platform/db";
import { APP_NAME, foundationPackages, projectStages, taskStatuses } from "@the-platform/shared";

export function createWorkerBanner(): string {
  return [
    `${APP_NAME} worker placeholder`,
    `Watching foundations: ${foundationPackages.join(", ")}`,
    `Project stages: ${projectStages.join(", ")}`,
    `Task statuses: ${taskStatuses.join(", ")}`,
    `Backed by tables: ${schemaTableNames.join(", ")}`
  ].join("\n");
}

console.info(createWorkerBanner());

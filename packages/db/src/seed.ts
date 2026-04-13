import "dotenv/config";

import { pathToFileURL } from "node:url";

import type { ProjectStage, TaskStatus } from "@the-platform/shared";

import { db, sql } from "./client";
import { projects, tasks } from "./schema";

const developmentProject = {
  title: "Platform foundation rollout",
  description: "Seeded project for local development.",
  stage: "Planning" as ProjectStage
};

const developmentTasks: Array<{
  title: string;
  description: string;
  status: TaskStatus;
  position: number;
}> = [
  {
    title: "Audit Phase 1 foundation",
    description: "Verify the monorepo skeleton and baseline tooling.",
    status: "Doing",
    position: 0
  },
  {
    title: "Seed the development database",
    description: "Populate local environments with a representative project and tasks.",
    status: "Todo" as const,
    position: 1
  },
  {
    title: "Prepare worker deployment",
    description: "Wire a separate deployment path for the background worker.",
    status: "Todo" as const,
    position: 2
  }
] as const;

export async function seedDevelopmentData() {
  await db.delete(tasks);
  await db.delete(projects);

  const seededProjects = await db.insert(projects).values(developmentProject).returning({
    id: projects.id,
    title: projects.title
  });
  const project = seededProjects[0];

  if (!project) {
    throw new Error("Failed to insert development seed project.");
  }

  await db.insert(tasks).values(
    developmentTasks.map((task) => ({
      ...task,
      projectId: project.id
    }))
  );

  return {
    projectTitle: project.title,
    projectCount: 1,
    taskCount: developmentTasks.length
  };
}

async function main() {
  const result = await seedDevelopmentData();

  console.info(
    `Seeded ${result.projectCount} project (${result.projectTitle}) and ${result.taskCount} tasks.`
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

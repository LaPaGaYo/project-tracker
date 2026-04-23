import { and, eq } from "drizzle-orm";

import { db, githubRepositories, projectGithubConnections, projects } from "@the-platform/db";
import type { GithubRepositoryRecord, ProjectGithubConnectionRecord, ProjectRecord } from "@the-platform/shared";

import { insertActivityLogEntry } from "../activity/repository";
import { createWorkspaceRepository } from "../workspaces/repository";

import type { GithubConnectionRepository, ProjectGithubConnectionView } from "./types";

function toIso(value: Date | null) {
  return value ? value.toISOString() : null;
}

function serializeProject(row: typeof projects.$inferSelect): ProjectRecord {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    key: row.key,
    itemCounter: row.itemCounter,
    title: row.title,
    description: row.description,
    stage: row.stage,
    dueDate: toIso(row.dueDate),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

function serializeGithubRepository(row: typeof githubRepositories.$inferSelect): GithubRepositoryRecord {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    provider: row.provider,
    providerRepositoryId: row.providerRepositoryId,
    owner: row.owner,
    name: row.name,
    fullName: row.fullName,
    defaultBranch: row.defaultBranch,
    installationId: row.installationId,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

function serializeProjectGithubConnection(row: typeof projectGithubConnections.$inferSelect): ProjectGithubConnectionRecord {
  return {
    id: row.id,
    projectId: row.projectId,
    repositoryId: row.repositoryId,
    stagingEnvironmentName: row.stagingEnvironmentName,
    productionEnvironmentName: row.productionEnvironmentName,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

export function createGithubConnectionRepository(): GithubConnectionRepository {
  const workspaceRepository = createWorkspaceRepository();

  return {
    ...workspaceRepository,

    async getProjectByKey(workspaceId, projectKey) {
      const [project] = await db
        .select()
        .from(projects)
        .where(and(eq(projects.workspaceId, workspaceId), eq(projects.key, projectKey)))
        .limit(1);

      return project ? serializeProject(project) : null;
    },

    async getProjectGithubConnection(projectId) {
      const [row] = await db
        .select({
          connection: projectGithubConnections,
          repository: githubRepositories
        })
        .from(projectGithubConnections)
        .innerJoin(githubRepositories, eq(projectGithubConnections.repositoryId, githubRepositories.id))
        .where(eq(projectGithubConnections.projectId, projectId))
        .limit(1);

      if (!row) {
        return null;
      }

      return {
        connection: serializeProjectGithubConnection(row.connection),
        repository: serializeGithubRepository(row.repository)
      };
    },

    async createProjectGithubConnection(input) {
      return db.transaction(async (tx) => {
        const [project] = await tx.select().from(projects).where(eq(projects.id, input.projectId)).limit(1);
        if (!project) {
          throw new Error("project not found.");
        }

        const [existingConnection] = await tx
          .select()
          .from(projectGithubConnections)
          .where(eq(projectGithubConnections.projectId, input.projectId))
          .limit(1);

        if (existingConnection) {
          throw new Error("project already has a primary GitHub repository.");
        }

        const [existingRepository] = await tx
          .select()
          .from(githubRepositories)
          .where(
            and(
              eq(githubRepositories.workspaceId, input.workspaceId),
              eq(githubRepositories.provider, "github"),
              eq(githubRepositories.providerRepositoryId, input.providerRepositoryId)
            )
          )
          .limit(1);

        const [repository] = existingRepository
          ? await tx
              .update(githubRepositories)
              .set({
                owner: input.owner,
                name: input.name,
                fullName: input.fullName,
                defaultBranch: input.defaultBranch,
                installationId: input.installationId,
                isActive: true,
                updatedAt: new Date()
              })
              .where(eq(githubRepositories.id, existingRepository.id))
              .returning()
          : await tx
              .insert(githubRepositories)
              .values({
                workspaceId: input.workspaceId,
                provider: "github",
                providerRepositoryId: input.providerRepositoryId,
                owner: input.owner,
                name: input.name,
                fullName: input.fullName,
                defaultBranch: input.defaultBranch,
                installationId: input.installationId,
                isActive: true,
                updatedAt: new Date()
              })
              .returning();

        if (!repository) {
          throw new Error("failed to create GitHub repository record.");
        }

        const [repositoryConnection] = await tx
          .select()
          .from(projectGithubConnections)
          .where(eq(projectGithubConnections.repositoryId, repository.id))
          .limit(1);

        if (repositoryConnection) {
          throw new Error("repository is already connected to another project.");
        }

        const [connection] = await tx
          .insert(projectGithubConnections)
          .values({
            projectId: input.projectId,
            repositoryId: repository.id,
            stagingEnvironmentName: input.stagingEnvironmentName,
            productionEnvironmentName: input.productionEnvironmentName,
            updatedAt: new Date()
          })
          .returning();

        if (!connection) {
          throw new Error("failed to create project GitHub connection.");
        }

        await insertActivityLogEntry(tx, {
          workspaceId: input.workspaceId,
          entityType: "project",
          entityId: input.projectId,
          action: "updated",
          actorId: input.actorId,
          metadata: {
            projectId: input.projectId,
            githubConnection: {
              repositoryFullName: repository.fullName,
              defaultBranch: repository.defaultBranch,
              stagingEnvironmentName: connection.stagingEnvironmentName,
              productionEnvironmentName: connection.productionEnvironmentName
            }
          }
        });

        return {
          connection: serializeProjectGithubConnection(connection),
          repository: serializeGithubRepository(repository)
        } satisfies ProjectGithubConnectionView;
      });
    }
  };
}

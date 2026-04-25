import { and, eq, inArray, notInArray, or } from "drizzle-orm";

import {
  db,
  githubCheckRollups,
  githubDeployments,
  githubPullRequests,
  githubRepositories,
  githubWebhookDeliveries,
  projectGithubConnections,
  projects,
  taskGithubStatus,
  tasks,
  workItemGithubLinks
} from "@the-platform/db";
import type {
  GithubCheckRollupStatus,
  GithubDeploymentEnvironment,
  GithubDeploymentStatus,
  GithubRepositoryRecord,
  GithubWebhookDeliveryRecord,
  ProjectGithubConnectionRecord,
  ProjectRecord
} from "@the-platform/shared";

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

function serializeGithubWebhookDelivery(row: typeof githubWebhookDeliveries.$inferSelect): GithubWebhookDeliveryRecord {
  return {
    id: row.id,
    repositoryId: row.repositoryId,
    deliveryId: row.deliveryId,
    eventName: row.eventName,
    status: row.status,
    receivedAt: row.receivedAt.toISOString(),
    processedAt: toIso(row.processedAt),
    errorMessage: row.errorMessage
  };
}

function normalizeIdentifierList(values: string[]) {
  return Array.from(
    new Set(
      values
        .map((value) => value.trim().toUpperCase())
        .filter(Boolean)
    )
  );
}

function includesIdentifier(values: string[], identifier: string) {
  return values.some((value) => value.toUpperCase() === identifier.toUpperCase());
}

function matchesEnvironmentName(environmentName: string | null, targetName: string | null) {
  if (!environmentName || !targetName) {
    return false;
  }

  return environmentName.trim().toLowerCase() === targetName.trim().toLowerCase();
}

function toTaskPrStatus(states: Array<"open" | "closed" | "merged" | null>) {
  if (states.some((state) => state === "merged")) {
    return "Merged" as const;
  }

  if (states.some((state) => state === "open")) {
    return "Open PR" as const;
  }

  return "No PR" as const;
}

function toTaskCiStatus(statuses: Array<GithubCheckRollupStatus | null>) {
  if (statuses.some((status) => status === "failing" || status === "cancelled")) {
    return "Failing" as const;
  }

  if (statuses.some((status) => status === "passing" || status === "skipped")) {
    return "Passing" as const;
  }

  return "Unknown" as const;
}

function isProductionDeployment(
  deployment: {
    deploymentEnvironment: GithubDeploymentEnvironment | null;
    deploymentEnvironmentName: string | null;
    deploymentStatus: GithubDeploymentStatus | null;
  },
  connection: { productionEnvironmentName: string | null }
) {
  if (deployment.deploymentStatus !== "success") {
    return false;
  }

  return (
    deployment.deploymentEnvironment === "production" ||
    matchesEnvironmentName(deployment.deploymentEnvironmentName, connection.productionEnvironmentName)
  );
}

function isStagingDeployment(
  deployment: {
    deploymentEnvironment: GithubDeploymentEnvironment | null;
    deploymentEnvironmentName: string | null;
    deploymentStatus: GithubDeploymentStatus | null;
  },
  connection: { stagingEnvironmentName: string | null; productionEnvironmentName: string | null }
) {
  if (deployment.deploymentStatus !== "success" || isProductionDeployment(deployment, connection)) {
    return false;
  }

  return (
    deployment.deploymentEnvironment === "staging" ||
    deployment.deploymentEnvironment === "preview" ||
    deployment.deploymentEnvironment === "development" ||
    matchesEnvironmentName(deployment.deploymentEnvironmentName, connection.stagingEnvironmentName) ||
    Boolean(deployment.deploymentEnvironmentName)
  );
}

async function resolveProjectBindingForRepository(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  repositoryId: string
) {
  const [row] = await tx
    .select({
      project: projects,
      connection: projectGithubConnections
    })
    .from(projectGithubConnections)
    .innerJoin(projects, eq(projectGithubConnections.projectId, projects.id))
    .where(eq(projectGithubConnections.repositoryId, repositoryId))
    .limit(1);

  if (!row) {
    return null;
  }

  return row;
}

async function replaceAutomaticPullRequestLinks(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  input: {
    projectId: string;
    repositoryId: string;
    pullRequestId: string;
    branchName: string;
    titleIdentifiers: string[];
    bodyIdentifiers: string[];
    branchIdentifiers: string[];
  }
) {
  await tx
    .delete(workItemGithubLinks)
    .where(
      and(
        eq(workItemGithubLinks.pullRequestId, input.pullRequestId),
        or(
          eq(workItemGithubLinks.source, "pr_title"),
          eq(workItemGithubLinks.source, "pr_body"),
          eq(workItemGithubLinks.source, "branch_name")
        )
      )
    );

  const candidateIdentifiers = normalizeIdentifierList([
    ...input.titleIdentifiers,
    ...input.bodyIdentifiers,
    ...input.branchIdentifiers
  ]);
  if (candidateIdentifiers.length === 0) {
    return;
  }

  const matchedTasks = await tx
    .select({
      id: tasks.id,
      identifier: tasks.identifier
    })
    .from(tasks)
    .where(and(eq(tasks.projectId, input.projectId), inArray(tasks.identifier, candidateIdentifiers)));

  if (matchedTasks.length === 0) {
    return;
  }

  const matchedIdentifiers = matchedTasks
    .map((task) => task.identifier)
    .filter((identifier): identifier is string => Boolean(identifier));
  const distinctMatches = Array.from(new Set(matchedIdentifiers));

  if (distinctMatches.length !== 1) {
    return;
  }

  const identifier = distinctMatches[0];
  if (!identifier) {
    return;
  }

  const matchedTask = matchedTasks.find((task) => task.identifier === identifier);
  if (!matchedTask) {
    return;
  }

  const source = includesIdentifier(input.titleIdentifiers, identifier)
    ? "pr_title"
    : includesIdentifier(input.bodyIdentifiers, identifier)
      ? "pr_body"
      : "branch_name";
  const confidence = source === "pr_title" ? 100 : source === "pr_body" ? 90 : 80;

  await tx
    .insert(workItemGithubLinks)
    .values({
      workItemId: matchedTask.id,
      repositoryId: input.repositoryId,
      pullRequestId: input.pullRequestId,
      branchName: input.branchName,
      source,
      confidence,
      linkedAt: new Date()
    })
    .onConflictDoUpdate({
      target: [workItemGithubLinks.workItemId, workItemGithubLinks.pullRequestId],
      set: {
        repositoryId: input.repositoryId,
        branchName: input.branchName,
        source,
        confidence,
        linkedAt: new Date()
      }
    });
}

async function rebuildProjectTaskGithubStatuses(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  projectId: string,
  connection: {
    stagingEnvironmentName: string | null;
    productionEnvironmentName: string | null;
  }
) {
  const projectTaskRows = await tx
    .select({
      id: tasks.id
    })
    .from(tasks)
    .where(eq(tasks.projectId, projectId));

  const projectTaskIds = projectTaskRows.map((row) => row.id);
  if (projectTaskIds.length === 0) {
    return;
  }

  const rows = await tx
    .select({
      workItemId: workItemGithubLinks.workItemId,
      pullRequestState: githubPullRequests.state,
      checkStatus: githubCheckRollups.status,
      deploymentEnvironment: githubDeployments.environment,
      deploymentEnvironmentName: githubDeployments.environmentName,
      deploymentStatus: githubDeployments.status
    })
    .from(workItemGithubLinks)
    .innerJoin(tasks, eq(workItemGithubLinks.workItemId, tasks.id))
    .leftJoin(githubPullRequests, eq(workItemGithubLinks.pullRequestId, githubPullRequests.id))
    .leftJoin(
      githubCheckRollups,
      and(
        eq(githubPullRequests.repositoryId, githubCheckRollups.repositoryId),
        eq(githubPullRequests.headSha, githubCheckRollups.headSha)
      )
    )
    .leftJoin(
      githubDeployments,
      and(
        eq(githubPullRequests.repositoryId, githubDeployments.repositoryId),
        eq(githubPullRequests.headSha, githubDeployments.headSha)
      )
    )
    .where(eq(tasks.projectId, projectId));

  const grouped = new Map<
    string,
    Array<{
      pullRequestState: "open" | "closed" | "merged" | null;
      checkStatus: GithubCheckRollupStatus | null;
      deploymentEnvironment: GithubDeploymentEnvironment | null;
      deploymentEnvironmentName: string | null;
      deploymentStatus: GithubDeploymentStatus | null;
    }>
  >();

  for (const row of rows) {
    const existing = grouped.get(row.workItemId) ?? [];
    existing.push({
      pullRequestState: row.pullRequestState,
      checkStatus: row.checkStatus,
      deploymentEnvironment: row.deploymentEnvironment,
      deploymentEnvironmentName: row.deploymentEnvironmentName,
      deploymentStatus: row.deploymentStatus
    });
    grouped.set(row.workItemId, existing);
  }

  const nextTaskIds = Array.from(grouped.keys());
  if (nextTaskIds.length === 0) {
    await tx.delete(taskGithubStatus).where(inArray(taskGithubStatus.taskId, projectTaskIds));
    return;
  }

  await tx
    .delete(taskGithubStatus)
    .where(and(inArray(taskGithubStatus.taskId, projectTaskIds), notInArray(taskGithubStatus.taskId, nextTaskIds)));

  for (const [taskId, entries] of grouped) {
    const prStatus = toTaskPrStatus(entries.map((entry) => entry.pullRequestState));
    const ciStatus = toTaskCiStatus(entries.map((entry) => entry.checkStatus));
    const deployStatus = entries.some((entry) => isProductionDeployment(entry, connection))
      ? "Production"
      : entries.some((entry) => isStagingDeployment(entry, connection))
        ? "Staging"
        : "Not deployed";

    await tx
      .insert(taskGithubStatus)
      .values({
        taskId,
        prStatus,
        ciStatus,
        deployStatus
      })
      .onConflictDoUpdate({
        target: [taskGithubStatus.taskId],
        set: {
          prStatus,
          ciStatus,
          deployStatus
        }
      });
  }
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

    async findGithubRepositoryByProviderRepositoryId(providerRepositoryId) {
      const [repository] = await db
        .select()
        .from(githubRepositories)
        .where(and(eq(githubRepositories.provider, "github"), eq(githubRepositories.providerRepositoryId, providerRepositoryId)))
        .limit(1);

      return repository ? serializeGithubRepository(repository) : null;
    },

    async getGithubWebhookDeliveryByDeliveryId(deliveryId) {
      const [delivery] = await db
        .select()
        .from(githubWebhookDeliveries)
        .where(eq(githubWebhookDeliveries.deliveryId, deliveryId))
        .limit(1);

      return delivery ? serializeGithubWebhookDelivery(delivery) : null;
    },

    async createGithubWebhookDelivery(input) {
      const [delivery] = await db
        .insert(githubWebhookDeliveries)
        .values({
          repositoryId: input.repositoryId,
          deliveryId: input.deliveryId,
          eventName: input.eventName,
          status: input.status,
          receivedAt: new Date(input.receivedAt),
          processedAt: input.processedAt ? new Date(input.processedAt) : null,
          errorMessage: input.errorMessage
        })
        .returning();

      if (!delivery) {
        throw new Error("failed to create GitHub webhook delivery.");
      }

      return serializeGithubWebhookDelivery(delivery);
    },

    async updateGithubWebhookDelivery(deliveryId, input) {
      const [delivery] = await db
        .update(githubWebhookDeliveries)
        .set({
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.processedAt !== undefined
            ? { processedAt: input.processedAt ? new Date(input.processedAt) : null }
            : {}),
          ...(input.errorMessage !== undefined ? { errorMessage: input.errorMessage } : {})
        })
        .where(eq(githubWebhookDeliveries.deliveryId, deliveryId))
        .returning();

      return delivery ? serializeGithubWebhookDelivery(delivery) : null;
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
    },

    async applyPullRequestWebhookProjection(input) {
      await db.transaction(async (tx) => {
        const [pullRequest] = await tx
          .insert(githubPullRequests)
          .values({
            repositoryId: input.repositoryId,
            providerPullRequestId: input.providerPullRequestId,
            number: input.number,
            title: input.title,
            body: input.body,
            url: input.url,
            state: input.state,
            isDraft: input.isDraft,
            authorLogin: input.authorLogin,
            baseBranch: input.baseBranch,
            headBranch: input.headBranch,
            headSha: input.headSha,
            createdAt: new Date(input.createdAt),
            updatedAt: new Date(input.updatedAt),
            mergedAt: input.mergedAt ? new Date(input.mergedAt) : null,
            closedAt: input.closedAt ? new Date(input.closedAt) : null
          })
          .onConflictDoUpdate({
            target: [githubPullRequests.repositoryId, githubPullRequests.providerPullRequestId],
            set: {
              number: input.number,
              title: input.title,
              body: input.body,
              url: input.url,
              state: input.state,
              isDraft: input.isDraft,
              authorLogin: input.authorLogin,
              baseBranch: input.baseBranch,
              headBranch: input.headBranch,
              headSha: input.headSha,
              updatedAt: new Date(input.updatedAt),
              mergedAt: input.mergedAt ? new Date(input.mergedAt) : null,
              closedAt: input.closedAt ? new Date(input.closedAt) : null
            }
          })
          .returning();

        if (!pullRequest) {
          throw new Error("failed to upsert GitHub pull request.");
        }

        const binding = await resolveProjectBindingForRepository(tx, input.repositoryId);
        if (!binding) {
          return;
        }

        await replaceAutomaticPullRequestLinks(tx, {
          projectId: binding.project.id,
          repositoryId: input.repositoryId,
          pullRequestId: pullRequest.id,
          branchName: input.headBranch,
          titleIdentifiers: input.titleIdentifiers,
          bodyIdentifiers: input.bodyIdentifiers,
          branchIdentifiers: input.branchIdentifiers
        });

        await rebuildProjectTaskGithubStatuses(tx, binding.project.id, binding.connection);
      });
    },

    async applyCheckRollupWebhookProjection(input) {
      await db.transaction(async (tx) => {
        await tx
          .insert(githubCheckRollups)
          .values({
            repositoryId: input.repositoryId,
            headSha: input.headSha,
            status: input.status,
            url: input.url,
            checkCount: input.checkCount,
            completedAt: input.completedAt ? new Date(input.completedAt) : null,
            updatedAt: new Date()
          })
          .onConflictDoUpdate({
            target: [githubCheckRollups.repositoryId, githubCheckRollups.headSha],
            set: {
              status: input.status,
              url: input.url,
              checkCount: input.checkCount,
              completedAt: input.completedAt ? new Date(input.completedAt) : null,
              updatedAt: new Date()
            }
          });

        const binding = await resolveProjectBindingForRepository(tx, input.repositoryId);
        if (!binding) {
          return;
        }

        await rebuildProjectTaskGithubStatuses(tx, binding.project.id, binding.connection);
      });
    },

    async applyDeploymentWebhookProjection(input) {
      await db.transaction(async (tx) => {
        await tx
          .insert(githubDeployments)
          .values({
            repositoryId: input.repositoryId,
            providerDeploymentId: input.providerDeploymentId,
            headSha: input.headSha,
            environmentName: input.environmentName,
            environment: input.environment,
            status: input.status,
            url: input.url,
            updatedAt: new Date()
          })
          .onConflictDoUpdate({
            target: [githubDeployments.repositoryId, githubDeployments.providerDeploymentId],
            set: {
              headSha: input.headSha,
              environmentName: input.environmentName,
              environment: input.environment,
              status: input.status,
              url: input.url,
              updatedAt: new Date()
            }
          });

        const binding = await resolveProjectBindingForRepository(tx, input.repositoryId);
        if (!binding) {
          return;
        }

        await rebuildProjectTaskGithubStatuses(tx, binding.project.id, binding.connection);
      });
    }
  };
}

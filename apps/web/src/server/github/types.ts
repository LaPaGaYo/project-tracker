import type {
  GithubRepositoryRecord,
  GithubWebhookDeliveryRecord,
  GithubWebhookDeliveryStatus,
  GithubWebhookEventName,
  ProjectGithubConnectionRecord,
  ProjectRecord
} from "@the-platform/shared";

import type { WorkspaceRepository } from "../workspaces/types";

export interface CreateProjectGithubConnectionInput {
  providerRepositoryId?: unknown;
  owner?: unknown;
  name?: unknown;
  fullName?: unknown;
  defaultBranch?: unknown;
  installationId?: unknown;
  stagingEnvironmentName?: unknown;
  productionEnvironmentName?: unknown;
}

export interface ProjectGithubConnectionView {
  connection: ProjectGithubConnectionRecord;
  repository: GithubRepositoryRecord;
}

export interface GithubWebhookRepository {
  findGithubRepositoryByProviderRepositoryId(providerRepositoryId: string): Promise<GithubRepositoryRecord | null>;
  getGithubWebhookDeliveryByDeliveryId(deliveryId: string): Promise<GithubWebhookDeliveryRecord | null>;
  createGithubWebhookDelivery(input: {
    repositoryId: string | null;
    deliveryId: string;
    eventName: GithubWebhookEventName;
    status: GithubWebhookDeliveryStatus;
    receivedAt: string;
    processedAt: string | null;
    errorMessage: string | null;
  }): Promise<GithubWebhookDeliveryRecord>;
  updateGithubWebhookDelivery(
    deliveryId: string,
    input: {
      status?: GithubWebhookDeliveryStatus;
      processedAt?: string | null;
      errorMessage?: string | null;
    }
  ): Promise<GithubWebhookDeliveryRecord | null>;
}

export interface GithubConnectionRepository
  extends Pick<WorkspaceRepository, "findWorkspaceBySlug" | "getMembership">,
    GithubWebhookRepository {
  getProjectByKey(workspaceId: string, projectKey: string): Promise<ProjectRecord | null>;
  getProjectGithubConnection(projectId: string): Promise<ProjectGithubConnectionView | null>;
  createProjectGithubConnection(input: {
    projectId: string;
    workspaceId: string;
    providerRepositoryId: string;
    owner: string;
    name: string;
    fullName: string;
    defaultBranch: string;
    installationId: string;
    stagingEnvironmentName: string | null;
    productionEnvironmentName: string | null;
    actorId: string;
  }): Promise<ProjectGithubConnectionView>;
}

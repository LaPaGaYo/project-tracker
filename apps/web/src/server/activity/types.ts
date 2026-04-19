import type { ActivityLogRecord, ProjectRecord, WorkItemRecord } from "@the-platform/shared";

import type { AppSession, WorkspaceRepository } from "../workspaces/types";

export interface ActivityFeedOptions {
  limit?: number;
}

export interface ActivityRepository
  extends Pick<WorkspaceRepository, "findWorkspaceBySlug" | "getMembership"> {
  getProjectByKey(workspaceId: string, projectKey: string): Promise<ProjectRecord | null>;
  getWorkItemByIdentifier(projectId: string, identifier: string): Promise<WorkItemRecord | null>;
  listProjectActivity(
    workspaceId: string,
    projectId: string,
    options?: ActivityFeedOptions
  ): Promise<ActivityLogRecord[]>;
  listWorkItemActivity(
    workspaceId: string,
    workItemId: string,
    options?: ActivityFeedOptions
  ): Promise<ActivityLogRecord[]>;
}

export interface ActivityServiceDependencies {
  repository: ActivityRepository;
  session: AppSession;
}

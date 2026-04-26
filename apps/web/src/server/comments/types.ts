import type { ActivityLogRecord, CommentRecord, ProjectRecord, WorkItemRecord } from "@the-platform/shared";

import type { ActivityRepository } from "../activity/types";
import type { NotificationRepository } from "../notifications/types";
import type { WorkItemRepository } from "../work-items/types";
import type { WorkspaceRepository } from "../workspaces/types";

export interface CommentRepository
  extends Pick<WorkspaceRepository, "findWorkspaceBySlug" | "getMembership"> {
  getProjectByKey(workspaceId: string, projectKey: string): Promise<ProjectRecord | null>;
  getWorkItemByIdentifier(projectId: string, identifier: string): Promise<WorkItemRecord | null>;
  getCommentById(commentId: string): Promise<CommentRecord | null>;
  createComment(input: {
    workspaceId: string;
    projectId: string;
    workItemId: string;
    authorId: string;
    content: string;
  }): Promise<CommentRecord>;
  updateComment(input: {
    commentId: string;
    workspaceId: string;
    projectId: string;
    workItemId: string;
    actorId: string;
    content: string;
  }): Promise<CommentRecord | null>;
  deleteComment(input: {
    commentId: string;
    workspaceId: string;
    projectId: string;
    workItemId: string;
    actorId: string;
  }): Promise<boolean>;
  listComments(workItemId: string): Promise<CommentRecord[]>;
}

export interface CommentNotificationDependencies {
  notificationRepository?: NotificationRepository;
}

export type WorkItemTimelineEntry =
  | {
      kind: "activity";
      createdAt: string;
      activity: ActivityLogRecord;
    }
  | {
      kind: "comment";
      createdAt: string;
      comment: CommentRecord;
    };

export interface TimelineDependencies {
  activityRepository: ActivityRepository;
  commentRepository: CommentRepository;
  workItemRepository: Pick<
    WorkItemRepository,
    "findWorkspaceBySlug" | "getMembership" | "getProjectByKey" | "getWorkItemByIdentifier"
  >;
}

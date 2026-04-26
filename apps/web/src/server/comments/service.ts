import type { CommentRecord, ProjectRecord, WorkItemRecord, WorkspaceRecord } from "@the-platform/shared";

import { createNotificationForSource } from "../notifications/service";
import type { NotificationRecipientInput, NotificationRepository } from "../notifications/types";
import { hasMinimumRole, WorkspaceError } from "../workspaces/core";
import { requireNonEmptyString, requireRoleAtLeast, resolveWorkspaceContext } from "../work-management/utils";

import type { AppSession } from "../workspaces/types";

import type {
  CommentNotificationDependencies,
  CommentRepository,
  TimelineDependencies,
  WorkItemTimelineEntry
} from "./types";

const mentionPattern = /(^|[^A-Za-z0-9_@])@([A-Za-z0-9][A-Za-z0-9._:-]{0,254})/g;

function uniqueUserIds(userIds: Iterable<string>) {
  return Array.from(new Set(Array.from(userIds).filter((userId) => userId.length > 0)));
}

function extractMentionedMemberIds(content: string, workspaceMemberIds: Set<string>) {
  const mentionedUserIds = new Set<string>();

  for (const match of content.matchAll(mentionPattern)) {
    const userId = match[2];
    if (userId && workspaceMemberIds.has(userId)) {
      mentionedUserIds.add(userId);
    }
  }

  return Array.from(mentionedUserIds);
}

function workItemUrl(workspaceSlug: string, projectKey: string, workItem: WorkItemRecord) {
  return `/workspaces/${workspaceSlug}/projects/${projectKey}/items/${workItem.identifier ?? workItem.id}`;
}

async function emitCommentNotifications(
  notificationRepository: NotificationRepository | undefined,
  session: AppSession,
  workspaceSlug: string,
  context: {
    workspace: WorkspaceRecord;
    project: ProjectRecord;
    workItem: WorkItemRecord;
  },
  comment: CommentRecord,
  content: string,
  priorComments: CommentRecord[]
) {
  if (!notificationRepository) {
    return;
  }

  const members = await notificationRepository.listWorkspaceMembers(context.workspace.id);
  const memberIds = new Set(members.map((member) => member.userId));
  const mentionedUserIds = extractMentionedMemberIds(content, memberIds);
  const url = workItemUrl(workspaceSlug, context.project.key, context.workItem);
  const metadata = {
    commentId: comment.id,
    identifier: context.workItem.identifier
  };

  if (mentionedUserIds.length > 0) {
    await createNotificationForSource(notificationRepository, session, workspaceSlug, {
      projectId: context.project.id,
      workItemId: context.workItem.id,
      sourceType: "comment",
      sourceId: comment.id,
      eventType: "mention_created",
      actorId: session.userId,
      priority: "normal",
      title: `${session.displayName} mentioned you`,
      body: content,
      url,
      metadata,
      recipients: mentionedUserIds.map(
        (recipientId): NotificationRecipientInput => ({
          recipientId,
          reason: "mention"
        })
      )
    });
  }

  const mentionedSet = new Set(mentionedUserIds);
  const participantIds = uniqueUserIds([
    ...(context.workItem.assigneeId ? [context.workItem.assigneeId] : []),
    ...priorComments.map((priorComment) => priorComment.authorId)
  ]).filter((userId) => memberIds.has(userId) && userId !== session.userId && !mentionedSet.has(userId));

  if (participantIds.length === 0) {
    return;
  }

  await createNotificationForSource(notificationRepository, session, workspaceSlug, {
    projectId: context.project.id,
    workItemId: context.workItem.id,
    sourceType: "comment",
    sourceId: comment.id,
    eventType: "comment_created",
    actorId: session.userId,
    priority: "normal",
    title: `${session.displayName} commented on ${context.workItem.identifier ?? context.workItem.title}`,
    body: content,
    url,
    metadata,
    recipients: participantIds.map(
      (recipientId): NotificationRecipientInput => ({
        recipientId,
        reason: "participant"
      })
    )
  });
}

async function resolveCommentContext(
  repository: CommentRepository,
  session: AppSession,
  workspaceSlug: string,
  projectKey: string,
  identifier: string,
  minimumRole: "viewer" | "member" = "viewer"
) {
  const { workspace, membership } = await resolveWorkspaceContext(repository, session, workspaceSlug, minimumRole);
  const project = await repository.getProjectByKey(workspace.id, projectKey);

  if (!project) {
    throw new WorkspaceError(404, "project not found.");
  }

  const workItem = await repository.getWorkItemByIdentifier(project.id, identifier);
  if (!workItem) {
    throw new WorkspaceError(404, "work item not found.");
  }

  return {
    workspace,
    membership,
    project,
    workItem
  };
}

export async function listCommentsForUser(
  repository: CommentRepository,
  session: AppSession,
  workspaceSlug: string,
  projectKey: string,
  identifier: string
) {
  const { workItem } = await resolveCommentContext(repository, session, workspaceSlug, projectKey, identifier);
  return repository.listComments(workItem.id);
}

export async function createCommentForUser(
  repository: CommentRepository,
  session: AppSession,
  workspaceSlug: string,
  projectKey: string,
  identifier: string,
  input: { content?: unknown },
  notificationDependencies: CommentNotificationDependencies = {}
) {
  const { workspace, membership, project, workItem } = await resolveCommentContext(
    repository,
    session,
    workspaceSlug,
    projectKey,
    identifier,
    "viewer"
  );

  requireRoleAtLeast(membership.role, "member", "only members and above can create comments.");
  const content = requireNonEmptyString(input.content, "content");
  const priorComments = await repository.listComments(workItem.id);

  const comment = await repository.createComment({
    workspaceId: workspace.id,
    projectId: project.id,
    workItemId: workItem.id,
    authorId: session.userId,
    content
  });

  await emitCommentNotifications(
    notificationDependencies.notificationRepository,
    session,
    workspaceSlug,
    {
      workspace,
      project,
      workItem
    },
    comment,
    content,
    priorComments
  );

  return comment;
}

export async function updateCommentForUser(
  repository: CommentRepository,
  session: AppSession,
  workspaceSlug: string,
  projectKey: string,
  identifier: string,
  commentId: string,
  input: { content?: unknown }
) {
  const { workspace, membership, project, workItem } = await resolveCommentContext(
    repository,
    session,
    workspaceSlug,
    projectKey,
    identifier,
    "viewer"
  );

  requireRoleAtLeast(membership.role, "member", "only members and above can edit comments.");

  const comment = await repository.getCommentById(commentId);
  if (!comment || comment.workItemId !== workItem.id || comment.deletedAt) {
    throw new WorkspaceError(404, "comment not found.");
  }

  const canModerate = hasMinimumRole(membership.role, "admin");
  if (!canModerate && comment.authorId !== session.userId) {
    throw new WorkspaceError(403, "only comment authors or admins can edit comments.");
  }

  const updated = await repository.updateComment({
    commentId,
    workspaceId: workspace.id,
    projectId: project.id,
    workItemId: workItem.id,
    actorId: session.userId,
    content: requireNonEmptyString(input.content, "content")
  });

  if (!updated) {
    throw new WorkspaceError(404, "comment not found.");
  }

  return updated;
}

export async function deleteCommentForUser(
  repository: CommentRepository,
  session: AppSession,
  workspaceSlug: string,
  projectKey: string,
  identifier: string,
  commentId: string
) {
  const { workspace, membership, project, workItem } = await resolveCommentContext(
    repository,
    session,
    workspaceSlug,
    projectKey,
    identifier,
    "viewer"
  );

  requireRoleAtLeast(membership.role, "member", "only members and above can delete comments.");

  const comment = await repository.getCommentById(commentId);
  if (!comment || comment.workItemId !== workItem.id || comment.deletedAt) {
    throw new WorkspaceError(404, "comment not found.");
  }

  const canModerate = hasMinimumRole(membership.role, "admin");
  if (!canModerate && comment.authorId !== session.userId) {
    throw new WorkspaceError(403, "only comment authors or admins can delete comments.");
  }

  const deleted = await repository.deleteComment({
    commentId,
    workspaceId: workspace.id,
    projectId: project.id,
    workItemId: workItem.id,
    actorId: session.userId
  });

  if (!deleted) {
    throw new WorkspaceError(404, "comment not found.");
  }
}

export async function listWorkItemTimelineForUser(
  dependencies: TimelineDependencies,
  session: AppSession,
  workspaceSlug: string,
  projectKey: string,
  identifier: string
) {
  const { workspace } = await resolveWorkspaceContext(
    dependencies.workItemRepository,
    session,
    workspaceSlug,
    "viewer"
  );
  const project = await dependencies.workItemRepository.getProjectByKey(workspace.id, projectKey);

  if (!project) {
    throw new WorkspaceError(404, "project not found.");
  }

  const workItem = await dependencies.workItemRepository.getWorkItemByIdentifier(project.id, identifier);
  if (!workItem) {
    throw new WorkspaceError(404, "work item not found.");
  }

  const [comments, activity] = await Promise.all([
    dependencies.commentRepository.listComments(workItem.id),
    dependencies.activityRepository.listWorkItemActivity(workspace.id, workItem.id)
  ]);

  const entries: WorkItemTimelineEntry[] = [
    ...comments.map((comment) => ({
      kind: "comment" as const,
      createdAt: comment.createdAt,
      comment
    })),
    ...activity
      .filter((entry) => entry.metadata?.target !== "comment")
      .map((activity) => ({
        kind: "activity" as const,
        createdAt: activity.createdAt,
        activity
      }))
  ];

  return entries.sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  );
}

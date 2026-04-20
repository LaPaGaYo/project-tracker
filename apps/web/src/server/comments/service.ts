import { hasMinimumRole, WorkspaceError } from "../workspaces/core";
import { requireNonEmptyString, requireRoleAtLeast, resolveWorkspaceContext } from "../work-management/utils";

import type { AppSession } from "../workspaces/types";

import type { CommentRepository, TimelineDependencies, WorkItemTimelineEntry } from "./types";

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

  requireRoleAtLeast(membership.role, "member", "only members and above can create comments.");

  return repository.createComment({
    workspaceId: workspace.id,
    projectId: project.id,
    workItemId: workItem.id,
    authorId: session.userId,
    content: requireNonEmptyString(input.content, "content")
  });
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

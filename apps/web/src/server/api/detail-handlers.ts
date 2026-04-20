import type { ActivityRepository } from "../activity/types";
import type { CommentRepository } from "../comments/types";
import {
  createCommentForUser,
  deleteCommentForUser,
  listCommentsForUser,
  updateCommentForUser
} from "../comments/service";
import {
  listDescriptionVersionsForUser,
  updateDescriptionForUser
} from "../work-items/service";
import type { WorkItemRepository } from "../work-items/types";
import { WorkspaceError } from "../workspaces/core";
import type { AppSession } from "../workspaces/types";

export interface DetailHandlerDependencies {
  getSession: () => Promise<AppSession | null>;
  commentRepository: CommentRepository;
  workItemRepository: WorkItemRepository;
  activityRepository: ActivityRepository;
}

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

function handleError(error: unknown) {
  if (error instanceof WorkspaceError) {
    return json(
      {
        error: error.message
      },
      error.status
    );
  }

  throw error;
}

async function parseJsonBody(request: Request) {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    throw new WorkspaceError(400, "request body must be valid JSON.");
  }
}

async function requireSession(dependencies: DetailHandlerDependencies) {
  const session = await dependencies.getSession();
  if (!session) {
    return null;
  }

  return session;
}

export async function handleListComments(
  _request: Request,
  params: { slug: string; key: string; identifier: string },
  dependencies: DetailHandlerDependencies
) {
  const session = await requireSession(dependencies);
  if (!session) {
    return json({ error: "authentication required." }, 401);
  }

  try {
    const comments = await listCommentsForUser(
      dependencies.commentRepository,
      session,
      params.slug,
      params.key,
      params.identifier
    );

    return json({ comments });
  } catch (error) {
    return handleError(error);
  }
}

export async function handleCreateComment(
  request: Request,
  params: { slug: string; key: string; identifier: string },
  dependencies: DetailHandlerDependencies
) {
  const session = await requireSession(dependencies);
  if (!session) {
    return json({ error: "authentication required." }, 401);
  }

  try {
    const body = await parseJsonBody(request);
    const comment = await createCommentForUser(
      dependencies.commentRepository,
      session,
      params.slug,
      params.key,
      params.identifier,
      body
    );

    return json({ comment }, 201);
  } catch (error) {
    return handleError(error);
  }
}

export async function handlePatchComment(
  request: Request,
  params: { slug: string; key: string; identifier: string; commentId: string },
  dependencies: DetailHandlerDependencies
) {
  const session = await requireSession(dependencies);
  if (!session) {
    return json({ error: "authentication required." }, 401);
  }

  try {
    const body = await parseJsonBody(request);
    const comment = await updateCommentForUser(
      dependencies.commentRepository,
      session,
      params.slug,
      params.key,
      params.identifier,
      params.commentId,
      body
    );

    return json({ comment });
  } catch (error) {
    return handleError(error);
  }
}

export async function handleDeleteComment(
  _request: Request,
  params: { slug: string; key: string; identifier: string; commentId: string },
  dependencies: DetailHandlerDependencies
) {
  const session = await requireSession(dependencies);
  if (!session) {
    return json({ error: "authentication required." }, 401);
  }

  try {
    await deleteCommentForUser(
      dependencies.commentRepository,
      session,
      params.slug,
      params.key,
      params.identifier,
      params.commentId
    );

    return new Response(null, { status: 204 });
  } catch (error) {
    return handleError(error);
  }
}

export async function handlePatchDescription(
  request: Request,
  params: { slug: string; key: string; identifier: string },
  dependencies: DetailHandlerDependencies
) {
  const session = await requireSession(dependencies);
  if (!session) {
    return json({ error: "authentication required." }, 401);
  }

  try {
    const body = await parseJsonBody(request);
    const workItem = await updateDescriptionForUser(
      dependencies.workItemRepository,
      session,
      params.slug,
      params.key,
      params.identifier,
      {
        content: body.content
      }
    );

    return json({ workItem });
  } catch (error) {
    return handleError(error);
  }
}

export async function handleListDescriptionVersions(
  _request: Request,
  params: { slug: string; key: string; identifier: string },
  dependencies: DetailHandlerDependencies
) {
  const session = await requireSession(dependencies);
  if (!session) {
    return json({ error: "authentication required." }, 401);
  }

  try {
    const versions = await listDescriptionVersionsForUser(
      dependencies.workItemRepository,
      session,
      params.slug,
      params.key,
      params.identifier
    );

    return json({ versions });
  } catch (error) {
    return handleError(error);
  }
}

import {
  createInvitationForUser,
  createWorkspaceForUser,
  getWorkspaceDetailsForUser,
  listWorkspacesForUser,
  removeWorkspaceMemberForUser,
  requireWorkspaceRole,
  syncInvitationsFromClerkWebhookRequest,
  updateWorkspaceForUser,
  updateWorkspaceMemberRoleForUser,
  WorkspaceError
} from "../workspaces/service";
import type { AppSession, WorkspaceRepository } from "../workspaces/types";

export interface WorkspaceHandlerDependencies {
  getSession: () => Promise<AppSession | null>;
  repository: WorkspaceRepository;
}

export interface WorkspaceOnlyDependencies {
  repository: WorkspaceRepository;
}

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status
  });
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

async function requireSession(dependencies: WorkspaceHandlerDependencies) {
  const session = await dependencies.getSession();
  if (!session) {
    return null;
  }

  return session;
}

async function parseJsonBody(request: Request) {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    throw new WorkspaceError(400, "request body must be valid JSON.");
  }
}

export async function handleListWorkspaces(
  _request: Request,
  dependencies: WorkspaceHandlerDependencies
) {
  const session = await requireSession(dependencies);
  if (!session) {
    return json({ error: "authentication required." }, 401);
  }

  try {
    const workspaces = await listWorkspacesForUser(dependencies.repository, session);
    return json({ workspaces });
  } catch (error) {
    return handleError(error);
  }
}

export async function handleCreateWorkspace(
  request: Request,
  dependencies: WorkspaceHandlerDependencies
) {
  const session = await requireSession(dependencies);
  if (!session) {
    return json({ error: "authentication required." }, 401);
  }

  try {
    const body = await parseJsonBody(request);
    const workspace = await createWorkspaceForUser(dependencies.repository, session, body);
    return json({ workspace }, 201);
  } catch (error) {
    return handleError(error);
  }
}

export async function handleGetWorkspace(
  _request: Request,
  params: {
    workspaceId: string;
  },
  dependencies: WorkspaceHandlerDependencies
) {
  const session = await requireSession(dependencies);
  if (!session) {
    return json({ error: "authentication required." }, 401);
  }

  try {
    const details = await getWorkspaceDetailsForUser(dependencies.repository, session, params.workspaceId);
    return json(details);
  } catch (error) {
    return handleError(error);
  }
}

export async function handlePatchWorkspace(
  request: Request,
  params: {
    workspaceId: string;
  },
  dependencies: WorkspaceHandlerDependencies
) {
  const session = await requireSession(dependencies);
  if (!session) {
    return json({ error: "authentication required." }, 401);
  }

  try {
    const body = await parseJsonBody(request);
    const workspace = await updateWorkspaceForUser(
      dependencies.repository,
      session,
      params.workspaceId,
      body
    );

    return json({ workspace });
  } catch (error) {
    return handleError(error);
  }
}

export async function handleListMembers(
  _request: Request,
  params: {
    workspaceId: string;
  },
  dependencies: WorkspaceHandlerDependencies
) {
  const response = await handleGetWorkspace(
    _request,
    {
      workspaceId: params.workspaceId
    },
    dependencies
  );

  if (!response.ok) {
    return response;
  }

  const details = (await response.json()) as {
    invitations: unknown[];
    members: unknown[];
  };

  return json({
    members: details.members,
    invitations: details.invitations
  });
}

export async function handleCreateInvitation(
  request: Request,
  params: {
    workspaceId: string;
  },
  dependencies: WorkspaceHandlerDependencies
) {
  const session = await requireSession(dependencies);
  if (!session) {
    return json({ error: "authentication required." }, 401);
  }

  try {
    const body = await parseJsonBody(request);
    const invitation = await createInvitationForUser(
      dependencies.repository,
      session,
      params.workspaceId,
      body
    );

    return json({ invitation }, 201);
  } catch (error) {
    return handleError(error);
  }
}

export async function handlePatchMemberRole(
  request: Request,
  params: {
    workspaceId: string;
    userId: string;
  },
  dependencies: WorkspaceHandlerDependencies
) {
  const session = await requireSession(dependencies);
  if (!session) {
    return json({ error: "authentication required." }, 401);
  }

  try {
    const body = await parseJsonBody(request);
    const membership = await updateWorkspaceMemberRoleForUser(
      dependencies.repository,
      session,
      params.workspaceId,
      params.userId,
      requireWorkspaceRole(body.role)
    );

    return json({ membership });
  } catch (error) {
    return handleError(error);
  }
}

export async function handleDeleteMember(
  _request: Request,
  params: {
    workspaceId: string;
    userId: string;
  },
  dependencies: WorkspaceHandlerDependencies
) {
  const session = await requireSession(dependencies);
  if (!session) {
    return json({ error: "authentication required." }, 401);
  }

  try {
    await removeWorkspaceMemberForUser(
      dependencies.repository,
      session,
      params.workspaceId,
      params.userId
    );

    return new Response(null, {
      status: 204
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function handleSyncInvitationsFromClerkWebhook(
  request: Request,
  dependencies: WorkspaceOnlyDependencies
) {
  try {
    return await syncInvitationsFromClerkWebhookRequest(dependencies.repository, request);
  } catch (error) {
    return handleError(error);
  }
}

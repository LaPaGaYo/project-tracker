import {
  getItemActivityForUser,
  getProjectActivityForUser
} from "../activity/service";
import type { ActivityRepository } from "../activity/types";
import {
  createProjectForUser,
  deleteProjectForUser,
  getProjectForUser,
  listProjectsForUser,
  updateProjectForUser
} from "../projects/service";
import type { ProjectRepository } from "../projects/types";
import type { AppSession } from "../workspaces/types";
import { WorkspaceError } from "../workspaces/core";
import {
  createWorkItemForUser,
  deleteWorkItemForUser,
  getWorkItemForUser,
  listWorkItemsForUser,
  updateWorkItemForUser
} from "../work-items/service";
import type { WorkItemRepository } from "../work-items/types";
import {
  createWorkflowStateForUser,
  deleteWorkflowStateForUser,
  listWorkflowStatesForUser,
  updateWorkflowStateForUser
} from "../workflow-states/service";
import type { WorkflowStateRepository } from "../workflow-states/types";

export interface ProjectHandlerDependencies {
  getSession: () => Promise<AppSession | null>;
  projectRepository: ProjectRepository;
  workItemRepository: WorkItemRepository;
  workflowStateRepository: WorkflowStateRepository;
  activityRepository: ActivityRepository;
}

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

async function requireSession(dependencies: ProjectHandlerDependencies) {
  const session = await dependencies.getSession();
  if (!session) {
    return null;
  }

  return session;
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

export async function handleListProjects(
  _request: Request,
  params: { slug: string },
  dependencies: ProjectHandlerDependencies
) {
  const session = await requireSession(dependencies);
  if (!session) {
    return json({ error: "authentication required." }, 401);
  }

  try {
    const projects = await listProjectsForUser(dependencies.projectRepository, session, params.slug);
    return json({ projects });
  } catch (error) {
    return handleError(error);
  }
}

export async function handleCreateProject(
  request: Request,
  params: { slug: string },
  dependencies: ProjectHandlerDependencies
) {
  const session = await requireSession(dependencies);
  if (!session) {
    return json({ error: "authentication required." }, 401);
  }

  try {
    const body = await parseJsonBody(request);
    const project = await createProjectForUser(dependencies.projectRepository, session, params.slug, body);
    return json({ project }, 201);
  } catch (error) {
    return handleError(error);
  }
}

export async function handleGetProject(
  _request: Request,
  params: { slug: string; key: string },
  dependencies: ProjectHandlerDependencies
) {
  const session = await requireSession(dependencies);
  if (!session) {
    return json({ error: "authentication required." }, 401);
  }

  try {
    const [project, states] = await Promise.all([
      getProjectForUser(dependencies.projectRepository, session, params.slug, params.key),
      listWorkflowStatesForUser(dependencies.workflowStateRepository, session, params.slug, params.key)
    ]);

    return json({
      project,
      workflowStates: states
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function handlePatchProject(
  request: Request,
  params: { slug: string; key: string },
  dependencies: ProjectHandlerDependencies
) {
  const session = await requireSession(dependencies);
  if (!session) {
    return json({ error: "authentication required." }, 401);
  }

  try {
    const body = await parseJsonBody(request);
    const project = await updateProjectForUser(
      dependencies.projectRepository,
      session,
      params.slug,
      params.key,
      body
    );

    return json({ project });
  } catch (error) {
    return handleError(error);
  }
}

export async function handleDeleteProject(
  _request: Request,
  params: { slug: string; key: string },
  dependencies: ProjectHandlerDependencies
) {
  const session = await requireSession(dependencies);
  if (!session) {
    return json({ error: "authentication required." }, 401);
  }

  try {
    await deleteProjectForUser(dependencies.projectRepository, session, params.slug, params.key);
    return new Response(null, { status: 204 });
  } catch (error) {
    return handleError(error);
  }
}

export async function handleListWorkItems(
  request: Request,
  params: { slug: string; key: string },
  dependencies: ProjectHandlerDependencies
) {
  const session = await requireSession(dependencies);
  if (!session) {
    return json({ error: "authentication required." }, 401);
  }

  try {
    const url = new URL(request.url);
    const type = url.searchParams.get("type");
    const workflowStateId = url.searchParams.get("workflowStateId");
    const assigneeId = url.searchParams.get("assigneeId");
    const filters = {
      ...(type ? { type } : {}),
      ...(workflowStateId ? { workflowStateId } : {}),
      ...(assigneeId ? { assigneeId } : {})
    };
    const workItems = await listWorkItemsForUser(
      dependencies.workItemRepository,
      session,
      params.slug,
      params.key,
      filters
    );

    return json({ workItems });
  } catch (error) {
    return handleError(error);
  }
}

export async function handleCreateWorkItem(
  request: Request,
  params: { slug: string; key: string },
  dependencies: ProjectHandlerDependencies
) {
  const session = await requireSession(dependencies);
  if (!session) {
    return json({ error: "authentication required." }, 401);
  }

  try {
    const body = await parseJsonBody(request);
    const workItem = await createWorkItemForUser(
      dependencies.workItemRepository,
      session,
      params.slug,
      params.key,
      body
    );

    return json({ workItem }, 201);
  } catch (error) {
    return handleError(error);
  }
}

export async function handleGetWorkItem(
  _request: Request,
  params: { slug: string; key: string; identifier: string },
  dependencies: ProjectHandlerDependencies
) {
  const session = await requireSession(dependencies);
  if (!session) {
    return json({ error: "authentication required." }, 401);
  }

  try {
    const workItem = await getWorkItemForUser(
      dependencies.workItemRepository,
      session,
      params.slug,
      params.key,
      params.identifier
    );

    return json({ workItem });
  } catch (error) {
    return handleError(error);
  }
}

export async function handlePatchWorkItem(
  request: Request,
  params: { slug: string; key: string; identifier: string },
  dependencies: ProjectHandlerDependencies
) {
  const session = await requireSession(dependencies);
  if (!session) {
    return json({ error: "authentication required." }, 401);
  }

  try {
    const body = await parseJsonBody(request);
    const workItem = await updateWorkItemForUser(
      dependencies.workItemRepository,
      session,
      params.slug,
      params.key,
      params.identifier,
      body
    );

    return json({ workItem });
  } catch (error) {
    return handleError(error);
  }
}

export async function handleDeleteWorkItem(
  _request: Request,
  params: { slug: string; key: string; identifier: string },
  dependencies: ProjectHandlerDependencies
) {
  const session = await requireSession(dependencies);
  if (!session) {
    return json({ error: "authentication required." }, 401);
  }

  try {
    await deleteWorkItemForUser(
      dependencies.workItemRepository,
      session,
      params.slug,
      params.key,
      params.identifier
    );
    return new Response(null, { status: 204 });
  } catch (error) {
    return handleError(error);
  }
}

export async function handleListWorkflowStates(
  _request: Request,
  params: { slug: string; key: string },
  dependencies: ProjectHandlerDependencies
) {
  const session = await requireSession(dependencies);
  if (!session) {
    return json({ error: "authentication required." }, 401);
  }

  try {
    const states = await listWorkflowStatesForUser(
      dependencies.workflowStateRepository,
      session,
      params.slug,
      params.key
    );
    return json({ workflowStates: states });
  } catch (error) {
    return handleError(error);
  }
}

export async function handleCreateWorkflowState(
  request: Request,
  params: { slug: string; key: string },
  dependencies: ProjectHandlerDependencies
) {
  const session = await requireSession(dependencies);
  if (!session) {
    return json({ error: "authentication required." }, 401);
  }

  try {
    const body = await parseJsonBody(request);
    const workflowState = await createWorkflowStateForUser(
      dependencies.workflowStateRepository,
      session,
      params.slug,
      params.key,
      body
    );
    return json({ workflowState }, 201);
  } catch (error) {
    return handleError(error);
  }
}

export async function handlePatchWorkflowState(
  request: Request,
  params: { slug: string; key: string; stateId: string },
  dependencies: ProjectHandlerDependencies
) {
  const session = await requireSession(dependencies);
  if (!session) {
    return json({ error: "authentication required." }, 401);
  }

  try {
    const body = await parseJsonBody(request);
    const workflowState = await updateWorkflowStateForUser(
      dependencies.workflowStateRepository,
      session,
      params.slug,
      params.key,
      params.stateId,
      body
    );
    return json({ workflowState });
  } catch (error) {
    return handleError(error);
  }
}

export async function handleDeleteWorkflowState(
  _request: Request,
  params: { slug: string; key: string; stateId: string },
  dependencies: ProjectHandlerDependencies
) {
  const session = await requireSession(dependencies);
  if (!session) {
    return json({ error: "authentication required." }, 401);
  }

  try {
    await deleteWorkflowStateForUser(
      dependencies.workflowStateRepository,
      session,
      params.slug,
      params.key,
      params.stateId
    );
    return new Response(null, { status: 204 });
  } catch (error) {
    return handleError(error);
  }
}

export async function handleGetProjectActivity(
  request: Request,
  params: { slug: string; key: string },
  dependencies: ProjectHandlerDependencies
) {
  const session = await requireSession(dependencies);
  if (!session) {
    return json({ error: "authentication required." }, 401);
  }

  try {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") ?? "50");
    const activity = await getProjectActivityForUser(
      dependencies.activityRepository,
      session,
      params.slug,
      params.key,
      Number.isNaN(limit) ? undefined : { limit }
    );

    return json({ activity });
  } catch (error) {
    return handleError(error);
  }
}

export async function handleGetWorkItemActivity(
  request: Request,
  params: { slug: string; key: string; identifier: string },
  dependencies: ProjectHandlerDependencies
) {
  const session = await requireSession(dependencies);
  if (!session) {
    return json({ error: "authentication required." }, 401);
  }

  try {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") ?? "50");
    const activity = await getItemActivityForUser(
      dependencies.activityRepository,
      session,
      params.slug,
      params.key,
      params.identifier,
      Number.isNaN(limit) ? undefined : { limit }
    );

    return json({ activity });
  } catch (error) {
    return handleError(error);
  }
}

import {
  getNotificationPreferencesForUser,
  listNotificationsForUser,
  markAllNotificationsReadForUser,
  markNotificationReadForUser,
  updateNotificationPreferencesForUser
} from "../notifications/service";
import type { NotificationRepository } from "../notifications/types";
import { WorkspaceError } from "../workspaces/core";
import type { AppSession } from "../workspaces/types";

export interface NotificationHandlerDependencies {
  getSession: () => Promise<AppSession | null>;
  notificationRepository: NotificationRepository;
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

async function requireSession(dependencies: NotificationHandlerDependencies) {
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

function parseLimit(request: Request) {
  const value = new URL(request.url).searchParams.get("limit");
  if (!value) {
    return undefined;
  }

  const limit = Number(value);
  return Number.isInteger(limit) && limit > 0 ? limit : undefined;
}

export async function handleListNotifications(
  request: Request,
  params: { slug: string },
  dependencies: NotificationHandlerDependencies
) {
  const session = await requireSession(dependencies);
  if (!session) {
    return json({ error: "authentication required." }, 401);
  }

  try {
    const limit = parseLimit(request);
    const notifications = await listNotificationsForUser(
      dependencies.notificationRepository,
      session,
      params.slug,
      limit === undefined ? {} : { limit }
    );

    return json({ notifications });
  } catch (error) {
    return handleError(error);
  }
}

export async function handlePatchNotification(
  _request: Request,
  params: { slug: string; notificationId: string },
  dependencies: NotificationHandlerDependencies
) {
  const session = await requireSession(dependencies);
  if (!session) {
    return json({ error: "authentication required." }, 401);
  }

  try {
    const notification = await markNotificationReadForUser(
      dependencies.notificationRepository,
      session,
      params.slug,
      params.notificationId
    );

    return json({ notification });
  } catch (error) {
    return handleError(error);
  }
}

export async function handleMarkAllNotificationsRead(
  _request: Request,
  params: { slug: string },
  dependencies: NotificationHandlerDependencies
) {
  const session = await requireSession(dependencies);
  if (!session) {
    return json({ error: "authentication required." }, 401);
  }

  try {
    const result = await markAllNotificationsReadForUser(
      dependencies.notificationRepository,
      session,
      params.slug
    );

    return json(result);
  } catch (error) {
    return handleError(error);
  }
}

export async function handleGetNotificationPreferences(
  _request: Request,
  params: { slug: string },
  dependencies: NotificationHandlerDependencies
) {
  const session = await requireSession(dependencies);
  if (!session) {
    return json({ error: "authentication required." }, 401);
  }

  try {
    const preferences = await getNotificationPreferencesForUser(
      dependencies.notificationRepository,
      session,
      params.slug
    );

    return json({ preferences });
  } catch (error) {
    return handleError(error);
  }
}

export async function handlePatchNotificationPreferences(
  request: Request,
  params: { slug: string },
  dependencies: NotificationHandlerDependencies
) {
  const session = await requireSession(dependencies);
  if (!session) {
    return json({ error: "authentication required." }, 401);
  }

  try {
    const body = await parseJsonBody(request);
    const preferences = await updateNotificationPreferencesForUser(
      dependencies.notificationRepository,
      session,
      params.slug,
      body
    );

    return json({ preferences });
  } catch (error) {
    return handleError(error);
  }
}

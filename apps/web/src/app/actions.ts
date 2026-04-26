"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { clearDemoSession, createDemoSession, getAppSession, isClerkConfigured } from "@/server/auth";
import { createProjectRepository } from "@/server/projects/repository";
import { createProjectForUser } from "@/server/projects/service";
import { createWorkItemRepository } from "@/server/work-items/repository";
import { createWorkItemForUser } from "@/server/work-items/service";
import {
  createInvitationForUser,
  createWorkspaceForUser,
  removeWorkspaceMemberForUser,
  updateWorkspaceForUser,
  updateWorkspaceMemberRoleForUser
} from "@/server/workspaces/service";
import { createWorkspaceRepository } from "@/server/workspaces/repository";
import { requireWorkspaceRole } from "@/server/workspaces/service";

function readFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function resolveProjectReturnTo(workspaceSlug: string, projectKey: string, value: FormDataEntryValue | null) {
  const defaultPath = `/workspaces/${workspaceSlug}/projects/${projectKey}`;

  if (typeof value !== "string") {
    return defaultPath;
  }

  const normalized = value.trim();
  if (!normalized.startsWith(defaultPath)) {
    return defaultPath;
  }

  const nextCharacter = normalized.charAt(defaultPath.length);
  if (nextCharacter && nextCharacter !== "/" && nextCharacter !== "?" && nextCharacter !== "#") {
    return defaultPath;
  }

  return normalized;
}

async function requireSessionForAction() {
  const session = await getAppSession();
  if (!session) {
    redirect("/sign-in");
  }

  return session;
}

export async function signInDemoAction(formData: FormData) {
  if (isClerkConfigured()) {
    redirect("/sign-in");
  }

  const email = readFormString(formData, "email").trim().toLowerCase();
  const displayName = readFormString(formData, "displayName").trim();

  if (!email) {
    throw new Error("email is required");
  }

  await createDemoSession({
    email,
    displayName
  });

  redirect("/");
}

export async function signOutAction() {
  if (!isClerkConfigured()) {
    await clearDemoSession();
  }

  redirect("/");
}

export async function createWorkspaceAction(formData: FormData) {
  const session = await requireSessionForAction();
  const repository = createWorkspaceRepository();

  const workspace = await createWorkspaceForUser(repository, session, {
    name: formData.get("name"),
    slug: formData.get("slug")
  });

  revalidatePath("/", "layout");
  redirect(`/workspaces/${workspace.slug}/projects`);
}

export async function updateWorkspaceAction(workspaceId: string, formData: FormData) {
  const session = await requireSessionForAction();
  const repository = createWorkspaceRepository();

  const workspace = await updateWorkspaceForUser(repository, session, workspaceId, {
    name: formData.get("name"),
    slug: formData.get("slug")
  });

  revalidatePath("/", "layout");
  redirect(`/workspaces/${workspace.slug}`);
}

export async function inviteMemberAction(workspaceId: string, formData: FormData) {
  const session = await requireSessionForAction();
  const repository = createWorkspaceRepository();

  await createInvitationForUser(repository, session, workspaceId, {
    email: formData.get("email"),
    role: formData.get("role")
  });

  const workspace = await repository.getWorkspaceById(workspaceId);
  if (!workspace) {
    redirect("/");
  }

  revalidatePath(`/workspaces/${workspace.slug}`);
  redirect(`/workspaces/${workspace.slug}`);
}

export async function updateMemberRoleAction(
  workspaceId: string,
  userId: string,
  formData: FormData
) {
  const session = await requireSessionForAction();
  const repository = createWorkspaceRepository();

  await updateWorkspaceMemberRoleForUser(
    repository,
    session,
    workspaceId,
    userId,
    requireWorkspaceRole(formData.get("role"))
  );

  const workspace = await repository.getWorkspaceById(workspaceId);
  if (!workspace) {
    redirect("/");
  }

  revalidatePath(`/workspaces/${workspace.slug}`);
  redirect(`/workspaces/${workspace.slug}`);
}

export async function removeMemberAction(workspaceId: string, userId: string) {
  const session = await requireSessionForAction();
  const repository = createWorkspaceRepository();

  await removeWorkspaceMemberForUser(repository, session, workspaceId, userId);

  const workspace = await repository.getWorkspaceById(workspaceId);
  if (!workspace) {
    redirect("/");
  }

  revalidatePath(`/workspaces/${workspace.slug}`);
  redirect(`/workspaces/${workspace.slug}`);
}

export async function createProjectAction(workspaceSlug: string, formData: FormData) {
  const session = await requireSessionForAction();
  const repository = createProjectRepository();

  const project = await createProjectForUser(repository, session, workspaceSlug, {
    name: formData.get("name"),
    key: formData.get("key"),
    description: formData.get("description")
  });

  revalidatePath(`/workspaces/${workspaceSlug}/projects`);
  redirect(`/workspaces/${workspaceSlug}/projects/${project.key}`);
}

export async function createWorkItemAction(workspaceSlug: string, projectKey: string, formData: FormData) {
  const session = await requireSessionForAction();
  const repository = createWorkItemRepository();
  const returnTo = resolveProjectReturnTo(workspaceSlug, projectKey, formData.get("returnTo"));

  await createWorkItemForUser(repository, session, workspaceSlug, projectKey, {
    title: formData.get("title"),
    description: formData.get("description"),
    type: formData.get("type"),
    priority: formData.get("priority"),
    workflowStateId: formData.get("workflowStateId"),
    stageId: formData.get("stageId"),
    planItemId: formData.get("planItemId"),
    labels: formData.get("labels")
  });

  revalidatePath(`/workspaces/${workspaceSlug}/projects`);
  revalidatePath(`/workspaces/${workspaceSlug}/projects/${projectKey}`);
  redirect(returnTo);
}

import { notFound, redirect } from "next/navigation";

import { getAppSession, isClerkConfigured } from "@/server/auth";
import { createProjectRepository } from "@/server/projects/repository";
import { getProjectForUser } from "@/server/projects/service";
import { getProjectWorkspaceForUser } from "@/server/projects/workspace";
import { createWorkItemRepository } from "@/server/work-items/repository";
import { WorkspaceError, requireWorkspaceMembership } from "@/server/workspaces/core";
import { createWorkspaceRepository } from "@/server/workspaces/repository";
import { listWorkspacesForUser } from "@/server/workspaces/service";

export async function loadProjectPageData(workspaceSlug: string, projectKey: string) {
  const session = await getAppSession();
  if (!session) {
    redirect("/sign-in");
  }

  const workspaceRepository = createWorkspaceRepository();
  const projectRepository = createProjectRepository();
  const workItemRepository = createWorkItemRepository();
  const workspace = await workspaceRepository.findWorkspaceBySlug(workspaceSlug);

  if (!workspace) {
    notFound();
  }

  try {
    const membership = await requireWorkspaceMembership(workspaceRepository, session, workspace.id, "viewer");
    const [workspaces, project] = await Promise.all([
      listWorkspacesForUser(workspaceRepository, session),
      getProjectForUser(projectRepository, session, workspaceSlug, projectKey)
    ]);
    const [workspaceView, projectStages, planItems] = await Promise.all([
      getProjectWorkspaceForUser(
        {
          projectRepository,
          workItemRepository
        },
        session,
        workspaceSlug,
        projectKey
      ),
      projectRepository.listProjectStages(project.id),
      projectRepository.listPlanItems(project.id)
    ]);

    return {
      canCreate: membership.role !== "viewer",
      isClerkEnabled: isClerkConfigured(),
      membership,
      project,
      session,
      workspace,
      workspaces,
      workspaceView,
      projectStages,
      planItems
    };
  } catch (error) {
    if (error instanceof WorkspaceError && error.status === 404) {
      notFound();
    }

    throw error;
  }
}

import {
  handleDeleteProject,
  handleGetProject,
  handlePatchProject
} from "@/server/api/project-handlers";
import { createActivityRepository } from "@/server/activity/repository";
import { getAppSession } from "@/server/auth";
import { createProjectRepository } from "@/server/projects/repository";
import { createWorkItemRepository } from "@/server/work-items/repository";
import { createWorkflowStateRepository } from "@/server/workflow-states/repository";

const dependencies = {
  getSession: getAppSession,
  projectRepository: createProjectRepository(),
  workItemRepository: createWorkItemRepository(),
  workflowStateRepository: createWorkflowStateRepository(),
  activityRepository: createActivityRepository()
};

export async function GET(
  request: Request,
  context: {
    params: Promise<{
      slug: string;
      key: string;
    }>;
  }
) {
  const params = await context.params;
  return handleGetProject(request, params, dependencies);
}

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{
      slug: string;
      key: string;
    }>;
  }
) {
  const params = await context.params;
  return handlePatchProject(request, params, dependencies);
}

export async function DELETE(
  request: Request,
  context: {
    params: Promise<{
      slug: string;
      key: string;
    }>;
  }
) {
  const params = await context.params;
  return handleDeleteProject(request, params, dependencies);
}

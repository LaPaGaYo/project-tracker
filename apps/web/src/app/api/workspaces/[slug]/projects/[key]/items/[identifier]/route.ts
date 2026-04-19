import {
  handleDeleteWorkItem,
  handleGetWorkItem,
  handlePatchWorkItem
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
      identifier: string;
    }>;
  }
) {
  const params = await context.params;
  return handleGetWorkItem(request, params, dependencies);
}

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{
      slug: string;
      key: string;
      identifier: string;
    }>;
  }
) {
  const params = await context.params;
  return handlePatchWorkItem(request, params, dependencies);
}

export async function DELETE(
  request: Request,
  context: {
    params: Promise<{
      slug: string;
      key: string;
      identifier: string;
    }>;
  }
) {
  const params = await context.params;
  return handleDeleteWorkItem(request, params, dependencies);
}

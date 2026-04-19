import {
  handleCreateWorkItem,
  handleListWorkItems
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
  return handleListWorkItems(request, params, dependencies);
}

export async function POST(
  request: Request,
  context: {
    params: Promise<{
      slug: string;
      key: string;
    }>;
  }
) {
  const params = await context.params;
  return handleCreateWorkItem(request, params, dependencies);
}

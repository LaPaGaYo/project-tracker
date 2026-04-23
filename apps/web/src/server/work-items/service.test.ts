import type {
  PlanItemRecord,
  ProjectRecord,
  ProjectStageRecord,
  WorkflowStateRecord,
  WorkItemRecord,
  WorkspaceMemberRecord,
  WorkspaceRecord
} from "@the-platform/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createWorkItemForUser, updateWorkItemForUser } from "./service";
import type { AppSession } from "../workspaces/types";

const session: AppSession = {
  userId: "henry",
  email: "henry@example.com",
  displayName: "Henry",
  provider: "demo"
};

const workspace: WorkspaceRecord = {
  id: "workspace-1",
  name: "Platform Ops",
  slug: "platform-ops",
  createdAt: "2026-04-20T12:00:00.000Z",
  updatedAt: "2026-04-20T12:00:00.000Z"
};

const membership: WorkspaceMemberRecord = {
  workspaceId: workspace.id,
  userId: session.userId,
  role: "member",
  invitedAt: "2026-04-20T12:00:00.000Z",
  joinedAt: "2026-04-20T12:00:00.000Z"
};

const project: ProjectRecord = {
  id: "project-1",
  workspaceId: workspace.id,
  key: "OPS",
  itemCounter: 1,
  title: "Platform Ops",
  description: "Execution surface redesign",
  stage: "Planning",
  dueDate: null,
  createdAt: "2026-04-20T12:00:00.000Z",
  updatedAt: "2026-04-20T12:00:00.000Z"
};

const workflowState: WorkflowStateRecord = {
  id: "state-backlog",
  projectId: project.id,
  name: "Backlog",
  category: "backlog",
  position: 0,
  color: null,
  createdAt: "2026-04-20T12:00:00.000Z",
  updatedAt: "2026-04-20T12:00:00.000Z"
};

const projectStage: ProjectStageRecord = {
  id: "stage-1",
  projectId: project.id,
  slug: "execution-surface",
  title: "Phase 2: Execution Surface",
  goal: "Land the functional project workspace shell.",
  status: "In Progress",
  gateStatus: "Pending",
  sortOrder: 1
};

const planItem: PlanItemRecord = {
  id: "plan-item-1",
  stageId: projectStage.id,
  title: "Ship create and edit flows",
  outcome: "Keep stage-linked issue execution alive during the redesign.",
  status: "Todo",
  blocker: null,
  sortOrder: 1
};

const workItem: WorkItemRecord = {
  id: "item-1",
  projectId: project.id,
  workspaceId: workspace.id,
  identifier: "OPS-1",
  title: "Build issue drawer",
  description: "Preserve editing during the UI redesign.",
  status: "Todo",
  type: "task",
  parentId: null,
  assigneeId: null,
  priority: "high",
  labels: null,
  workflowStateId: workflowState.id,
  stageId: projectStage.id,
  planItemId: planItem.id,
  position: 0,
  blockedReason: null,
  dueDate: null,
  completedAt: null,
  createdAt: "2026-04-20T12:00:00.000Z",
  updatedAt: "2026-04-20T12:00:00.000Z"
};

function createRepository() {
  return {
    findWorkspaceBySlug: vi.fn().mockResolvedValue(workspace),
    getMembership: vi.fn().mockResolvedValue(membership),
    listMembers: vi.fn().mockResolvedValue([membership]),
    getProjectByKey: vi.fn().mockResolvedValue(project),
    listWorkflowStates: vi.fn().mockResolvedValue([workflowState]),
    getWorkflowState: vi.fn().mockResolvedValue(workflowState),
    getWorkItemById: vi.fn().mockResolvedValue(null),
    getWorkItemByIdentifier: vi.fn().mockResolvedValue(workItem),
    createWorkItem: vi.fn().mockResolvedValue(workItem),
    updateWorkItem: vi.fn().mockResolvedValue(workItem),
    moveWorkItem: vi.fn(),
    moveWorkItems: vi.fn(),
    deleteWorkItem: vi.fn(),
    getWorkItemCreatorId: vi.fn(),
    listDescriptionVersions: vi.fn(),
    getProjectStage: vi.fn().mockResolvedValue(projectStage),
    getPlanItem: vi.fn().mockResolvedValue(planItem)
  };
}

describe("work item planning linkage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes stage and plan item selections through createWorkItemForUser", async () => {
    const repository = createRepository();

    await createWorkItemForUser(repository as never, session, "platform-ops", "OPS", {
      title: "Wire up stage-linked create",
      workflowStateId: workflowState.id,
      stageId: projectStage.id,
      planItemId: planItem.id
    } as never);

    expect(repository.createWorkItem).toHaveBeenCalledWith(
      expect.objectContaining({
        stageId: projectStage.id,
        planItemId: planItem.id
      })
    );
  });

  it("passes stage and plan item selections through updateWorkItemForUser", async () => {
    const repository = createRepository();

    await updateWorkItemForUser(repository as never, session, "platform-ops", "OPS", "OPS-1", {
      stageId: projectStage.id,
      planItemId: planItem.id
    } as never);

    expect(repository.updateWorkItem).toHaveBeenCalledWith(
      project.id,
      "OPS-1",
      expect.objectContaining({
        stageId: projectStage.id,
        planItemId: planItem.id
      })
    );
  });
});

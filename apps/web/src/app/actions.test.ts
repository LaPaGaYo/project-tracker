import { beforeEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.hoisted(() => vi.fn((path: string) => {
  throw new Error(`REDIRECT:${path}`);
}));
const revalidatePathMock = vi.hoisted(() => vi.fn());
const getAppSessionMock = vi.hoisted(() => vi.fn());
const createWorkItemRepositoryMock = vi.hoisted(() => vi.fn());
const createWorkItemForUserMock = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock
}));

vi.mock("@/server/auth", () => ({
  clearDemoSession: vi.fn(),
  createDemoSession: vi.fn(),
  getAppSession: getAppSessionMock,
  isClerkConfigured: vi.fn().mockReturnValue(false)
}));

vi.mock("@/server/projects/repository", () => ({
  createProjectRepository: vi.fn()
}));

vi.mock("@/server/projects/service", () => ({
  createProjectForUser: vi.fn()
}));

vi.mock("@/server/workspaces/repository", () => ({
  createWorkspaceRepository: vi.fn()
}));

vi.mock("@/server/workspaces/service", () => ({
  createInvitationForUser: vi.fn(),
  createWorkspaceForUser: vi.fn(),
  removeWorkspaceMemberForUser: vi.fn(),
  requireWorkspaceRole: vi.fn(),
  updateWorkspaceForUser: vi.fn(),
  updateWorkspaceMemberRoleForUser: vi.fn()
}));

vi.mock("@/server/work-items/repository", () => ({
  createWorkItemRepository: createWorkItemRepositoryMock
}));

vi.mock("@/server/work-items/service", () => ({
  createWorkItemForUser: createWorkItemForUserMock
}));

import { createWorkItemAction } from "./actions";

describe("createWorkItemAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAppSessionMock.mockResolvedValue({
      userId: "henry",
      email: "henry@example.com",
      displayName: "Henry",
      provider: "demo"
    });
    createWorkItemRepositoryMock.mockReturnValue({});
    createWorkItemForUserMock.mockResolvedValue({
      id: "item-1"
    });
  });

  it("redirects back to the submitted returnTo location after create", async () => {
    const formData = new FormData();
    formData.set("title", "Wire up stage-linked create");
    formData.set("returnTo", "/workspaces/platform-ops/projects/OPS?view=list&type=task#create-work-item");

    await expect(createWorkItemAction("platform-ops", "OPS", formData)).rejects.toThrow(
      /^REDIRECT:\/workspaces\/platform-ops\/projects\/OPS\?view=list&type=task#create-work-item$/
    );
  });

  it("rejects returnTo values that target a different project key prefix", async () => {
    const formData = new FormData();
    formData.set("title", "Wire up stage-linked create");
    formData.set("returnTo", "/workspaces/platform-ops/projects/OPS2?view=list");

    await expect(createWorkItemAction("platform-ops", "OPS", formData)).rejects.toThrow(
      /^REDIRECT:\/workspaces\/platform-ops\/projects\/OPS$/
    );
  });
});

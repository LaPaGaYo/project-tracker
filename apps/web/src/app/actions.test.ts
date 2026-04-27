import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.hoisted(() =>
  vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  })
);
const revalidatePathMock = vi.hoisted(() => vi.fn());
const cookiesMock = vi.hoisted(() => vi.fn());
const getAppSessionMock = vi.hoisted(() => vi.fn());
const createGithubAppInstallationClientMock = vi.hoisted(() => vi.fn());
const createGithubConnectionRepositoryMock = vi.hoisted(() => vi.fn());
const createProjectRepositoryMock = vi.hoisted(() => vi.fn());
const importGithubInstallationRepositoryForUserMock = vi.hoisted(() => vi.fn());
const verifyGithubUserAuthorizationProofMock = vi.hoisted(() => vi.fn());
const createWorkItemRepositoryMock = vi.hoisted(() => vi.fn());
const createWorkItemForUserMock = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

vi.mock("@/server/auth", () => ({
  clearDemoSession: vi.fn(),
  createDemoSession: vi.fn(),
  getAppSession: getAppSessionMock,
  isClerkConfigured: vi.fn().mockReturnValue(false),
}));

vi.mock("@/server/projects/repository", () => ({
  createProjectRepository: createProjectRepositoryMock,
}));

vi.mock("@/server/projects/service", () => ({
  createProjectForUser: vi.fn(),
}));

vi.mock("@/server/workspaces/repository", () => ({
  createWorkspaceRepository: vi.fn(),
}));

vi.mock("@/server/workspaces/service", () => ({
  createInvitationForUser: vi.fn(),
  createWorkspaceForUser: vi.fn(),
  removeWorkspaceMemberForUser: vi.fn(),
  requireWorkspaceRole: vi.fn(),
  updateWorkspaceForUser: vi.fn(),
  updateWorkspaceMemberRoleForUser: vi.fn(),
}));

vi.mock("@/server/work-items/repository", () => ({
  createWorkItemRepository: createWorkItemRepositoryMock,
}));

vi.mock("@/server/work-items/service", () => ({
  createWorkItemForUser: createWorkItemForUserMock,
}));

vi.mock("@/server/github/repository", () => ({
  createGithubConnectionRepository: createGithubConnectionRepositoryMock,
}));

vi.mock("@/server/github/app-installation", () => ({
  createGithubAppInstallationClient: createGithubAppInstallationClientMock,
}));

vi.mock("@/server/github/installation-import", () => ({
  importGithubInstallationRepositoryForUser:
    importGithubInstallationRepositoryForUserMock,
}));

vi.mock("@/server/github/user-authorization-state", () => ({
  GITHUB_USER_AUTH_PROOF_COOKIE: "the_platform_github_user_auth_proof",
  verifyGithubUserAuthorizationProof: verifyGithubUserAuthorizationProofMock,
}));

import {
  createWorkItemAction,
  importInstalledGithubRepositoryAction,
} from "./actions";

describe("server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("GITHUB_USER_AUTH_STATE_SECRET", "proof-secret");
    getAppSessionMock.mockResolvedValue({
      userId: "henry",
      email: "henry@example.com",
      displayName: "Henry",
      provider: "demo",
    });
    cookiesMock.mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: "signed-proof" }),
    });
    verifyGithubUserAuthorizationProofMock.mockReturnValue({
      status: "valid",
      proof: {
        productUserId: "henry",
        workspaceSlug: "platform-ops",
        githubUserId: "12345",
        githubLogin: "henry-gh",
        installationId: "987",
        allowedProviderRepositoryIds: ["42"],
        nonce: "nonce-proof",
        issuedAt: "2026-04-27T12:00:00.000Z",
        expiresAt: "2026-04-27T12:15:00.000Z",
      },
    });
    createProjectRepositoryMock.mockReturnValue({});
    createGithubConnectionRepositoryMock.mockReturnValue({});
    createGithubAppInstallationClientMock.mockReturnValue({});
    importGithubInstallationRepositoryForUserMock.mockResolvedValue({
      project: {
        key: "OPS",
      },
    });
    createWorkItemRepositoryMock.mockReturnValue({});
    createWorkItemForUserMock.mockResolvedValue({
      id: "item-1",
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("redirects back to the submitted returnTo location after create", async () => {
    const formData = new FormData();
    formData.set("title", "Wire up stage-linked create");
    formData.set(
      "returnTo",
      "/workspaces/platform-ops/projects/OPS?view=list&type=task#create-work-item"
    );

    await expect(
      createWorkItemAction("platform-ops", "OPS", formData)
    ).rejects.toThrow(
      /^REDIRECT:\/workspaces\/platform-ops\/projects\/OPS\?view=list&type=task#create-work-item$/
    );
  });

  it("rejects returnTo values that target a different project key prefix", async () => {
    const formData = new FormData();
    formData.set("title", "Wire up stage-linked create");
    formData.set(
      "returnTo",
      "/workspaces/platform-ops/projects/OPS2?view=list"
    );

    await expect(
      createWorkItemAction("platform-ops", "OPS", formData)
    ).rejects.toThrow(/^REDIRECT:\/workspaces\/platform-ops\/projects\/OPS$/);
  });

  it("redirects to engineering after importing a selected installed repository", async () => {
    const formData = new FormData();
    formData.set("providerRepositoryId", "42");
    formData.set("projectName", "Platform Ops");
    formData.set("key", "OPS");

    await expect(
      importInstalledGithubRepositoryAction("platform-ops", "987", formData)
    ).rejects.toThrow(
      /^REDIRECT:\/workspaces\/platform-ops\/projects\/OPS\/engineering$/
    );

    expect(importGithubInstallationRepositoryForUserMock).toHaveBeenCalledWith(
      {
        projectRepository: {},
        githubRepository: {},
        installationClient: {},
        authorizationProof: {
          productUserId: "henry",
          workspaceSlug: "platform-ops",
          githubUserId: "12345",
          githubLogin: "henry-gh",
          installationId: "987",
          allowedProviderRepositoryIds: ["42"],
          nonce: "nonce-proof",
          issuedAt: "2026-04-27T12:00:00.000Z",
          expiresAt: "2026-04-27T12:15:00.000Z",
        },
      },
      {
        userId: "henry",
        email: "henry@example.com",
        displayName: "Henry",
        provider: "demo",
      },
      "platform-ops",
      "987",
      {
        providerRepositoryId: "42",
        projectName: "Platform Ops",
        key: "OPS",
        stagingEnvironmentName: null,
        productionEnvironmentName: null,
      }
    );
  });

  it("passes null authorization proof when proof verification is invalid", async () => {
    verifyGithubUserAuthorizationProofMock.mockReturnValue({
      status: "invalid",
    });
    const formData = new FormData();
    formData.set("providerRepositoryId", "42");
    formData.set("projectName", "Platform Ops");
    formData.set("key", "OPS");

    await expect(
      importInstalledGithubRepositoryAction("platform-ops", "987", formData)
    ).rejects.toThrow(
      /^REDIRECT:\/workspaces\/platform-ops\/projects\/OPS\/engineering$/
    );

    expect(importGithubInstallationRepositoryForUserMock).toHaveBeenCalledWith(
      expect.objectContaining({
        authorizationProof: null,
      }),
      expect.any(Object),
      "platform-ops",
      "987",
      expect.any(Object)
    );
  });

  it("does not verify proof with a blank secret and passes null authorization proof", async () => {
    vi.stubEnv("GITHUB_USER_AUTH_STATE_SECRET", "");
    const formData = new FormData();
    formData.set("providerRepositoryId", "42");
    formData.set("projectName", "Platform Ops");
    formData.set("key", "OPS");

    await expect(
      importInstalledGithubRepositoryAction("platform-ops", "987", formData)
    ).rejects.toThrow(
      /^REDIRECT:\/workspaces\/platform-ops\/projects\/OPS\/engineering$/
    );

    expect(verifyGithubUserAuthorizationProofMock).not.toHaveBeenCalled();
    expect(importGithubInstallationRepositoryForUserMock).toHaveBeenCalledWith(
      expect.objectContaining({
        authorizationProof: null,
      }),
      expect.any(Object),
      "platform-ops",
      "987",
      expect.any(Object)
    );
  });
});

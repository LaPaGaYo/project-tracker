import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getAppSessionMock = vi.hoisted(() => vi.fn());
const getGithubUserAuthorizationMissingConfigurationMock = vi.hoisted(() =>
  vi.fn()
);
const createGithubUserAuthorizationClientMock = vi.hoisted(() => vi.fn());
const completeGithubUserAuthorizationMock = vi.hoisted(() => vi.fn());
const buildGithubProjectsReturnPathMock = vi.hoisted(() =>
  vi.fn(
    (
      workspaceSlug: string,
      installationId: string,
      params?: URLSearchParams
    ) => {
      const nextParams = new URLSearchParams(params ?? undefined);
      nextParams.set("githubInstallationId", installationId);
      return `/workspaces/${workspaceSlug}/projects?${nextParams.toString()}`;
    }
  )
);
const verifyGithubUserAuthorizationStateMock = vi.hoisted(() => vi.fn());
const createWorkspaceRepositoryMock = vi.hoisted(() => vi.fn());
const requireWorkspaceMembershipMock = vi.hoisted(() => vi.fn());

vi.mock("@/server/auth", () => ({
  getAppSession: getAppSessionMock,
}));

vi.mock("@/server/github/user-authorization", () => ({
  createGithubUserAuthorizationClient: createGithubUserAuthorizationClientMock,
  getGithubUserAuthorizationMissingConfiguration:
    getGithubUserAuthorizationMissingConfigurationMock,
}));

vi.mock("@/server/github/user-authorization-flow", () => ({
  buildGithubProjectsReturnPath: buildGithubProjectsReturnPathMock,
  completeGithubUserAuthorization: completeGithubUserAuthorizationMock,
}));

vi.mock("@/server/github/user-authorization-state", () => ({
  GITHUB_USER_AUTH_PKCE_COOKIE: "the_platform_github_user_auth_pkce",
  GITHUB_USER_AUTH_PROOF_COOKIE: "the_platform_github_user_auth_proof",
  verifyGithubUserAuthorizationState: verifyGithubUserAuthorizationStateMock,
}));

vi.mock("@/server/workspaces/repository", () => ({
  createWorkspaceRepository: createWorkspaceRepositoryMock,
}));

vi.mock("@/server/workspaces/core", () => ({
  requireWorkspaceMembership: requireWorkspaceMembershipMock,
}));

import { GET } from "./route";

function createCallbackRequest() {
  return new NextRequest(
    "http://localhost/github/authorize/callback?code=oauth-code&state=signed-state",
    {
      headers: {
        cookie: "the_platform_github_user_auth_pkce=verifier-123",
      },
    }
  );
}

describe("GET /github/authorize/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("APP_BASE_URL", "http://localhost:3000");
    vi.stubEnv("GITHUB_USER_AUTH_STATE_SECRET", "state-secret");
    getGithubUserAuthorizationMissingConfigurationMock.mockReturnValue([]);
    getAppSessionMock.mockResolvedValue({
      userId: "henry",
      email: "henry@example.com",
      displayName: "Henry",
      provider: "demo",
    });
    verifyGithubUserAuthorizationStateMock.mockReturnValue({
      status: "valid",
      payload: {
        workspaceSlug: "platform-ops",
        installationId: "987",
        returnPath:
          "/workspaces/platform-ops/projects?githubInstallationId=987",
        nonce: "nonce-state",
        issuedAt: "2026-04-27T12:00:00.000Z",
        expiresAt: "2026-04-27T12:10:00.000Z",
      },
    });
    createWorkspaceRepositoryMock.mockReturnValue({
      findWorkspaceBySlug: vi.fn().mockResolvedValue({
        id: "workspace-1",
        slug: "platform-ops",
      }),
    });
    createGithubUserAuthorizationClientMock.mockReturnValue({});
    completeGithubUserAuthorizationMock.mockResolvedValue({
      status: "success",
      redirectPath:
        "/workspaces/platform-ops/projects?githubInstallationId=987",
      proofCookieValue: "signed-proof",
      proofMaxAgeSeconds: 900,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does not exchange the code when callback membership is no longer admin", async () => {
    requireWorkspaceMembershipMock.mockRejectedValue(new Error("forbidden"));

    const response = await GET(createCallbackRequest());
    const location = new URL(response.headers.get("location") ?? "");

    expect(location.pathname).toBe("/workspaces/platform-ops/projects");
    expect(location.searchParams.get("githubAuthorizationError")).toBe(
      "installation_inaccessible"
    );
    expect(location.searchParams.get("githubInstallationId")).toBe("987");
    expect(verifyGithubUserAuthorizationStateMock).toHaveBeenCalledTimes(1);
    const [[signedState, verificationOptions]] =
      verifyGithubUserAuthorizationStateMock.mock.calls as [
        [string, { secret: string; now: Date }],
      ];
    expect(signedState).toBe("signed-state");
    expect(verificationOptions.secret).toBe("state-secret");
    expect(verificationOptions.now).toBeInstanceOf(Date);
    expect(requireWorkspaceMembershipMock).toHaveBeenCalledWith(
      expect.any(Object),
      {
        userId: "henry",
        email: "henry@example.com",
        displayName: "Henry",
        provider: "demo",
      },
      "workspace-1",
      "admin"
    );
    expect(createGithubUserAuthorizationClientMock).not.toHaveBeenCalled();
    expect(completeGithubUserAuthorizationMock).not.toHaveBeenCalled();
    expect(response.headers.get("set-cookie")).toContain(
      "the_platform_github_user_auth_pkce="
    );
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });
});

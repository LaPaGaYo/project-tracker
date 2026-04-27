import { NextResponse, type NextRequest } from "next/server";

import { getAppSession } from "@/server/auth";
import { getGithubUserAuthorizationMissingConfiguration } from "@/server/github/user-authorization";
import { prepareGithubUserAuthorizationRedirect } from "@/server/github/user-authorization-flow";
import { GITHUB_USER_AUTH_PKCE_COOKIE } from "@/server/github/user-authorization-state";
import { requireWorkspaceMembership } from "@/server/workspaces/core";
import { createWorkspaceRepository } from "@/server/workspaces/repository";

export const dynamic = "force-dynamic";

function isSecureCookie() {
  return process.env.NODE_ENV === "production";
}

function redirectTo(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, request.nextUrl.origin));
}

export async function GET(request: NextRequest) {
  const session = await getAppSession();
  if (!session) {
    return redirectTo(request, "/sign-in");
  }

  const workspaceSlug =
    request.nextUrl.searchParams.get("workspaceSlug")?.trim() ?? "";
  const installationId =
    request.nextUrl.searchParams.get("githubInstallationId")?.trim() ?? "";
  const workspaceRepository = createWorkspaceRepository();
  const workspace =
    await workspaceRepository.findWorkspaceBySlug(workspaceSlug);
  if (!workspace || !installationId) {
    return redirectTo(request, "/");
  }

  await requireWorkspaceMembership(
    workspaceRepository,
    session,
    workspace.id,
    "admin"
  );

  const returnPath = `/workspaces/${workspaceSlug}/projects?githubInstallationId=${encodeURIComponent(installationId)}`;
  if (getGithubUserAuthorizationMissingConfiguration().length > 0) {
    return redirectTo(request, returnPath);
  }

  const prepared = prepareGithubUserAuthorizationRedirect({
    workspaceSlug,
    installationId,
    returnPath,
    appBaseUrl: process.env.APP_BASE_URL ?? "http://localhost:3000",
    githubBaseUrl: process.env.GITHUB_BASE_URL,
    clientId: process.env.GITHUB_APP_CLIENT_ID ?? "",
    stateSecret: process.env.GITHUB_USER_AUTH_STATE_SECRET ?? "",
  });

  const response = NextResponse.redirect(prepared.authorizationUrl);
  response.cookies.set(GITHUB_USER_AUTH_PKCE_COOKIE, prepared.pkceVerifier, {
    httpOnly: true,
    maxAge: 10 * 60,
    path: "/github/authorize/callback",
    sameSite: "lax",
    secure: isSecureCookie(),
  });

  return response;
}

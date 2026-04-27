import { NextResponse, type NextRequest } from "next/server";

import { getAppSession } from "@/server/auth";
import {
  createGithubUserAuthorizationClient,
  getGithubUserAuthorizationMissingConfiguration,
} from "@/server/github/user-authorization";
import {
  buildGithubProjectsReturnPath,
  completeGithubUserAuthorization,
} from "@/server/github/user-authorization-flow";
import {
  GITHUB_USER_AUTH_PKCE_COOKIE,
  GITHUB_USER_AUTH_PROOF_COOKIE,
  type GithubUserAuthorizationStatePayload,
  verifyGithubUserAuthorizationState,
} from "@/server/github/user-authorization-state";
import { requireWorkspaceMembership } from "@/server/workspaces/core";
import { createWorkspaceRepository } from "@/server/workspaces/repository";
import type { AppSession } from "@/server/workspaces/types";

export const dynamic = "force-dynamic";

function isSecureCookie() {
  return process.env.NODE_ENV === "production";
}

function redirectTo(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, request.nextUrl.origin));
}

function expirePkceCookie(response: NextResponse) {
  response.cookies.set(GITHUB_USER_AUTH_PKCE_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/github/authorize/callback",
    sameSite: "lax",
    secure: isSecureCookie(),
  });
}

function readSafeReturnPathParams(returnPath: string) {
  const params = new URLSearchParams();

  try {
    const returnPathParams = new URL(returnPath, "http://local.test")
      .searchParams;
    const setupAction = returnPathParams.get("githubSetupAction");
    if (setupAction) {
      params.set("githubSetupAction", setupAction);
    }
  } catch {
    return params;
  }

  return params;
}

function buildCallbackErrorPath(
  state: GithubUserAuthorizationStatePayload,
  errorCode: string
) {
  const params = readSafeReturnPathParams(state.returnPath);
  params.set("githubAuthorizationError", errorCode);

  try {
    return buildGithubProjectsReturnPath(
      state.workspaceSlug,
      state.installationId,
      params
    );
  } catch {
    return `/?githubAuthorizationError=${errorCode}`;
  }
}

async function verifyCallbackWorkspaceAdmin(
  request: NextRequest,
  session: AppSession,
  signedState: string,
  stateSecret: string
) {
  const stateResult = verifyGithubUserAuthorizationState(signedState, {
    secret: stateSecret,
    now: new Date(),
  });

  if (stateResult.status !== "valid") {
    return null;
  }

  const workspaceRepository = createWorkspaceRepository();
  const workspace = await workspaceRepository.findWorkspaceBySlug(
    stateResult.payload.workspaceSlug
  );

  if (!workspace) {
    return redirectTo(
      request,
      buildCallbackErrorPath(stateResult.payload, "installation_inaccessible")
    );
  }

  try {
    await requireWorkspaceMembership(
      workspaceRepository,
      session,
      workspace.id,
      "admin"
    );
  } catch {
    return redirectTo(
      request,
      buildCallbackErrorPath(stateResult.payload, "installation_inaccessible")
    );
  }

  return null;
}

export async function GET(request: NextRequest) {
  const pkceVerifier =
    request.cookies.get(GITHUB_USER_AUTH_PKCE_COOKIE)?.value ?? "";
  const session = await getAppSession();
  if (!session) {
    const response = redirectTo(request, "/sign-in");
    expirePkceCookie(response);
    return response;
  }

  if (getGithubUserAuthorizationMissingConfiguration().length > 0) {
    const response = redirectTo(
      request,
      "/?githubAuthorizationError=token_exchange_failed"
    );
    expirePkceCookie(response);
    return response;
  }

  const signedState = request.nextUrl.searchParams.get("state")?.trim() ?? "";
  const stateSecret = process.env.GITHUB_USER_AUTH_STATE_SECRET ?? "";
  const accessDeniedResponse = await verifyCallbackWorkspaceAdmin(
    request,
    session,
    signedState,
    stateSecret
  );
  if (accessDeniedResponse) {
    expirePkceCookie(accessDeniedResponse);
    return accessDeniedResponse;
  }

  const result = await completeGithubUserAuthorization({
    code: request.nextUrl.searchParams.get("code")?.trim() ?? "",
    signedState,
    pkceVerifier,
    session,
    stateSecret,
    appBaseUrl: process.env.APP_BASE_URL ?? "http://localhost:3000",
    client: createGithubUserAuthorizationClient(),
  });

  const response = redirectTo(request, result.redirectPath);
  expirePkceCookie(response);

  if (result.status === "success") {
    response.cookies.set(
      GITHUB_USER_AUTH_PROOF_COOKIE,
      result.proofCookieValue,
      {
        httpOnly: true,
        maxAge: result.proofMaxAgeSeconds,
        path: "/",
        sameSite: "lax",
        secure: isSecureCookie(),
      }
    );
  }

  return response;
}

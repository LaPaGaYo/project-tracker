import { NextResponse, type NextRequest } from "next/server";

import { getAppSession } from "@/server/auth";
import {
  createGithubUserAuthorizationClient,
  getGithubUserAuthorizationMissingConfiguration,
} from "@/server/github/user-authorization";
import { completeGithubUserAuthorization } from "@/server/github/user-authorization-flow";
import {
  GITHUB_USER_AUTH_PKCE_COOKIE,
  GITHUB_USER_AUTH_PROOF_COOKIE,
} from "@/server/github/user-authorization-state";

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

  const result = await completeGithubUserAuthorization({
    code: request.nextUrl.searchParams.get("code")?.trim() ?? "",
    signedState: request.nextUrl.searchParams.get("state")?.trim() ?? "",
    pkceVerifier,
    session,
    stateSecret: process.env.GITHUB_USER_AUTH_STATE_SECRET ?? "",
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

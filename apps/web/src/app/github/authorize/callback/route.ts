import { NextResponse, type NextRequest } from "next/server";

import { getAppSession } from "@/server/auth";
import { createGithubUserAuthorizationClient } from "@/server/github/user-authorization";
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

export async function GET(request: NextRequest) {
  const session = await getAppSession();
  if (!session) {
    return redirectTo(request, "/sign-in");
  }

  const pkceVerifier =
    request.cookies.get(GITHUB_USER_AUTH_PKCE_COOKIE)?.value ?? "";
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
  response.cookies.set(GITHUB_USER_AUTH_PKCE_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/github/authorize/callback",
    sameSite: "lax",
    secure: isSecureCookie(),
  });

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

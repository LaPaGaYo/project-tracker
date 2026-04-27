import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getAppSession } from "@/server/auth";
import { createGithubUserAuthorizationClient } from "@/server/github/user-authorization";
import { completeGithubUserAuthorization } from "@/server/github/user-authorization-flow";
import {
  GITHUB_USER_AUTH_PKCE_COOKIE,
  GITHUB_USER_AUTH_PROOF_COOKIE,
} from "@/server/github/user-authorization-state";

export const dynamic = "force-dynamic";

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function isSecureCookie() {
  return process.env.NODE_ENV === "production";
}

export default async function GithubAuthorizeCallbackPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getAppSession();
  if (!session) {
    redirect("/sign-in");
  }

  const cookieStore = await cookies();
  const pkceVerifier =
    cookieStore.get(GITHUB_USER_AUTH_PKCE_COOKIE)?.value ?? "";
  cookieStore.delete(GITHUB_USER_AUTH_PKCE_COOKIE);

  const params = await searchParams;
  const result = await completeGithubUserAuthorization({
    code: readParam(params.code).trim(),
    signedState: readParam(params.state).trim(),
    pkceVerifier,
    session,
    stateSecret: process.env.GITHUB_USER_AUTH_STATE_SECRET ?? "",
    appBaseUrl: process.env.APP_BASE_URL ?? "http://localhost:3000",
    client: createGithubUserAuthorizationClient(),
  });

  if (result.status === "success") {
    cookieStore.set(GITHUB_USER_AUTH_PROOF_COOKIE, result.proofCookieValue, {
      httpOnly: true,
      maxAge: result.proofMaxAgeSeconds,
      path: "/",
      sameSite: "lax",
      secure: isSecureCookie(),
    });
  }

  redirect(result.redirectPath);
}

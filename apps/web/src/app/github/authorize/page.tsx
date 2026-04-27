import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getAppSession } from "@/server/auth";
import { getGithubUserAuthorizationMissingConfiguration } from "@/server/github/user-authorization";
import { prepareGithubUserAuthorizationRedirect } from "@/server/github/user-authorization-flow";
import { GITHUB_USER_AUTH_PKCE_COOKIE } from "@/server/github/user-authorization-state";
import { requireWorkspaceMembership } from "@/server/workspaces/core";
import { createWorkspaceRepository } from "@/server/workspaces/repository";

export const dynamic = "force-dynamic";

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function isSecureCookie() {
  return process.env.NODE_ENV === "production";
}

export default async function GithubAuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getAppSession();
  if (!session) {
    redirect("/sign-in");
  }

  const params = await searchParams;
  const workspaceSlug = readParam(params.workspaceSlug).trim();
  const installationId = readParam(params.githubInstallationId).trim();
  const workspaceRepository = createWorkspaceRepository();
  const workspace =
    await workspaceRepository.findWorkspaceBySlug(workspaceSlug);
  if (!workspace || !installationId) {
    redirect("/");
  }

  await requireWorkspaceMembership(
    workspaceRepository,
    session,
    workspace.id,
    "admin"
  );

  const returnPath = `/workspaces/${workspaceSlug}/projects?githubInstallationId=${encodeURIComponent(installationId)}`;
  if (getGithubUserAuthorizationMissingConfiguration().length > 0) {
    redirect(returnPath);
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

  const cookieStore = await cookies();
  cookieStore.set(GITHUB_USER_AUTH_PKCE_COOKIE, prepared.pkceVerifier, {
    httpOnly: true,
    maxAge: 10 * 60,
    path: "/github/authorize/callback",
    sameSite: "lax",
    secure: isSecureCookie(),
  });

  redirect(prepared.authorizationUrl);
}

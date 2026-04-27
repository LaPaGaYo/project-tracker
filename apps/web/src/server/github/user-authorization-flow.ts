import { randomBytes } from "node:crypto";

import type { AppSession } from "../workspaces/types";
import {
  buildGithubAppUserAuthorizationUrl,
  type GithubUserAuthorizationClient,
} from "./user-authorization";
import {
  createGithubUserAuthorizationProof,
  createGithubUserAuthorizationState,
  createPkceChallenge,
  createPkceVerifier,
  verifyGithubUserAuthorizationState,
} from "./user-authorization-state";

const STATE_MAX_AGE_SECONDS = 10 * 60;
const PROOF_MAX_AGE_SECONDS = 15 * 60;

type GithubUserAuthorizationErrorCode =
  | "state_invalid"
  | "state_expired"
  | "pkce_missing"
  | "token_exchange_failed"
  | "installation_inaccessible"
  | "repositories_inaccessible";

interface PrepareGithubUserAuthorizationRedirectInput {
  workspaceSlug: string;
  installationId: string;
  returnPath: string;
  appBaseUrl: string;
  githubBaseUrl?: string | undefined;
  clientId: string;
  stateSecret: string;
  now?: Date | undefined;
  nonce?: string | undefined;
  pkceVerifier?: string | undefined;
}

interface CompleteGithubUserAuthorizationInput {
  code: string;
  signedState: string | null | undefined;
  pkceVerifier: string | null | undefined;
  session: AppSession;
  stateSecret: string;
  appBaseUrl: string;
  now?: Date | undefined;
  client: GithubUserAuthorizationClient;
}

export type CompleteGithubUserAuthorizationResult =
  | {
      status: "success";
      redirectPath: string;
      proofCookieValue: string;
      proofMaxAgeSeconds: number;
    }
  | {
      status: "error";
      redirectPath: string;
      errorCode: GithubUserAuthorizationErrorCode;
    };

function addSeconds(date: Date, seconds: number) {
  return new Date(date.getTime() + seconds * 1000);
}

function createNonce() {
  return randomBytes(16).toString("base64url");
}

function readReturnPathParams(returnPath: string) {
  return new URL(returnPath, "http://local.test").searchParams;
}

function buildErrorRedirectPath(input: {
  workspaceSlug?: string | undefined;
  installationId?: string | undefined;
  returnPath?: string | undefined;
  errorCode: GithubUserAuthorizationErrorCode;
}) {
  if (!input.workspaceSlug || !input.installationId) {
    return `/?githubAuthorizationError=${input.errorCode}`;
  }

  const params = input.returnPath
    ? readReturnPathParams(input.returnPath)
    : new URLSearchParams();
  params.set("githubAuthorizationError", input.errorCode);
  return buildGithubProjectsReturnPath(
    input.workspaceSlug,
    input.installationId,
    params
  );
}

function buildErrorResult(input: {
  workspaceSlug?: string | undefined;
  installationId?: string | undefined;
  returnPath?: string | undefined;
  errorCode: GithubUserAuthorizationErrorCode;
}): CompleteGithubUserAuthorizationResult {
  return {
    status: "error",
    redirectPath: buildErrorRedirectPath(input),
    errorCode: input.errorCode,
  };
}

function readExpiredStateRedirectInput(
  input: CompleteGithubUserAuthorizationInput
) {
  const stateResult = verifyGithubUserAuthorizationState(input.signedState, {
    secret: input.stateSecret,
    now: new Date(0),
  });

  if (stateResult.status !== "valid") {
    return {};
  }

  return {
    workspaceSlug: stateResult.payload.workspaceSlug,
    installationId: stateResult.payload.installationId,
    returnPath: stateResult.payload.returnPath,
  };
}

export function buildGithubUserAuthorizationCallbackUrl(appBaseUrl: string) {
  return new URL("/github/authorize/callback", appBaseUrl).toString();
}

export function buildGithubProjectsReturnPath(
  workspaceSlug: string,
  installationId: string,
  params?: URLSearchParams
) {
  const returnParams = new URLSearchParams(params);
  returnParams.set("githubInstallationId", installationId);
  const query = returnParams.toString();
  return `/workspaces/${workspaceSlug}/projects${query ? `?${query}` : ""}`;
}

export function prepareGithubUserAuthorizationRedirect(
  input: PrepareGithubUserAuthorizationRedirectInput
) {
  const now = input.now ?? new Date();
  const pkceVerifier = input.pkceVerifier ?? createPkceVerifier();
  const state = createGithubUserAuthorizationState(
    {
      workspaceSlug: input.workspaceSlug,
      installationId: input.installationId,
      returnPath: input.returnPath,
      nonce: input.nonce ?? createNonce(),
      issuedAt: now.toISOString(),
      expiresAt: addSeconds(now, STATE_MAX_AGE_SECONDS).toISOString(),
    },
    input.stateSecret
  );

  return {
    authorizationUrl: buildGithubAppUserAuthorizationUrl({
      clientId: input.clientId,
      redirectUri: buildGithubUserAuthorizationCallbackUrl(input.appBaseUrl),
      state,
      codeChallenge: createPkceChallenge(pkceVerifier),
      githubBaseUrl: input.githubBaseUrl,
    }),
    pkceVerifier,
  };
}

export async function completeGithubUserAuthorization(
  input: CompleteGithubUserAuthorizationInput
): Promise<CompleteGithubUserAuthorizationResult> {
  const now = input.now ?? new Date();
  const stateResult = verifyGithubUserAuthorizationState(input.signedState, {
    secret: input.stateSecret,
    now,
  });

  if (stateResult.status === "expired") {
    return buildErrorResult({
      ...readExpiredStateRedirectInput(input),
      errorCode: "state_expired",
    });
  }

  if (stateResult.status !== "valid") {
    return buildErrorResult({ errorCode: "state_invalid" });
  }

  const state = stateResult.payload;
  const errorBase = {
    workspaceSlug: state.workspaceSlug,
    installationId: state.installationId,
    returnPath: state.returnPath,
  };

  if (!input.pkceVerifier) {
    return buildErrorResult({ ...errorBase, errorCode: "pkce_missing" });
  }

  let userAccessToken: string;
  let githubUser: Awaited<ReturnType<GithubUserAuthorizationClient["getUser"]>>;
  try {
    userAccessToken = await input.client.exchangeCodeForUserAccessToken({
      code: input.code,
      redirectUri: buildGithubUserAuthorizationCallbackUrl(input.appBaseUrl),
      codeVerifier: input.pkceVerifier,
    });
    githubUser = await input.client.getUser(userAccessToken);
  } catch {
    return buildErrorResult({
      ...errorBase,
      errorCode: "token_exchange_failed",
    });
  }

  try {
    const installations =
      await input.client.listUserInstallations(userAccessToken);
    if (
      !installations.some(
        (installation) => installation.installationId === state.installationId
      )
    ) {
      return buildErrorResult({
        ...errorBase,
        errorCode: "installation_inaccessible",
      });
    }
  } catch {
    return buildErrorResult({
      ...errorBase,
      errorCode: "installation_inaccessible",
    });
  }

  let allowedProviderRepositoryIds: string[];
  try {
    const repositories = await input.client.listUserInstallationRepositories(
      userAccessToken,
      state.installationId
    );
    allowedProviderRepositoryIds = repositories.map(
      (repository) => repository.providerRepositoryId
    );
  } catch {
    return buildErrorResult({
      ...errorBase,
      errorCode: "repositories_inaccessible",
    });
  }

  const successParams = readReturnPathParams(state.returnPath);
  successParams.set("githubAuthorized", "1");
  const redirectPath = buildGithubProjectsReturnPath(
    state.workspaceSlug,
    state.installationId,
    successParams
  );

  return {
    status: "success",
    redirectPath,
    proofCookieValue: createGithubUserAuthorizationProof(
      {
        productUserId: input.session.userId,
        workspaceSlug: state.workspaceSlug,
        githubUserId: githubUser.id,
        githubLogin: githubUser.login,
        installationId: state.installationId,
        allowedProviderRepositoryIds,
        nonce: state.nonce,
        issuedAt: now.toISOString(),
        expiresAt: addSeconds(now, PROOF_MAX_AGE_SECONDS).toISOString(),
      },
      input.stateSecret
    ),
    proofMaxAgeSeconds: PROOF_MAX_AGE_SECONDS,
  };
}

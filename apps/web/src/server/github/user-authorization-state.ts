import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

export const GITHUB_USER_AUTH_PKCE_COOKIE =
  "the_platform_github_user_auth_pkce";
export const GITHUB_USER_AUTH_PROOF_COOKIE =
  "the_platform_github_user_auth_proof";

export type GithubUserAuthorizationStateVerificationStatus =
  | "valid"
  | "missing"
  | "invalid"
  | "expired";
export type GithubUserAuthorizationProofVerificationStatus =
  | "valid"
  | "missing"
  | "invalid"
  | "expired"
  | "wrong_user"
  | "wrong_workspace"
  | "wrong_installation";

export interface GithubUserAuthorizationStatePayload {
  workspaceSlug: string;
  installationId: string;
  returnPath: string;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
}

export interface GithubUserAuthorizationProof {
  productUserId: string;
  workspaceSlug: string;
  githubUserId: string;
  githubLogin: string;
  installationId: string;
  allowedProviderRepositoryIds: string[];
  nonce: string;
  issuedAt: string;
  expiresAt: string;
}

interface GithubUserAuthorizationStateVerificationOptions {
  secret: string;
  now: Date;
}

interface GithubUserAuthorizationProofVerificationOptions {
  secret: string;
  now: Date;
  productUserId: string;
  workspaceSlug: string;
  installationId: string;
}

function hasSigningSecret(secret: string) {
  return secret.trim().length > 0;
}

function requireSigningSecret(secret: string) {
  if (!hasSigningSecret(secret)) {
    throw new Error("GitHub user authorization signing secret is required.");
  }

  return secret;
}

function signPayload(payload: unknown, secret: string) {
  const signingSecret = requireSigningSecret(secret);
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", signingSecret)
    .update(body)
    .digest("base64url");
  return `${body}.${signature}`;
}

function verifySignedPayload(value: string | null | undefined, secret: string) {
  if (!value) {
    return { status: "missing" as const };
  }

  if (!hasSigningSecret(secret)) {
    return { status: "invalid" as const };
  }

  const [body, signature, extra] = value.split(".");
  if (!body || !signature || extra !== undefined) {
    return { status: "invalid" as const };
  }

  const expected = createHmac("sha256", secret)
    .update(body)
    .digest("base64url");
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  if (
    expectedBuffer.length !== actualBuffer.length ||
    !timingSafeEqual(expectedBuffer, actualBuffer)
  ) {
    return { status: "invalid" as const };
  }

  try {
    const payload: unknown = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8")
    );
    return { status: "valid" as const, payload };
  } catch {
    return { status: "invalid" as const };
  }
}

function isExpired(expiresAt: string, now: Date) {
  const expiresAtTime = Date.parse(expiresAt);
  return Number.isNaN(expiresAtTime) || expiresAtTime <= now.getTime();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasStringFields(value: Record<string, unknown>, fields: string[]) {
  return fields.every(
    (field) => typeof value[field] === "string" && value[field].length > 0
  );
}

function isGithubUserAuthorizationStatePayload(
  value: unknown
): value is GithubUserAuthorizationStatePayload {
  return (
    isRecord(value) &&
    hasStringFields(value, [
      "workspaceSlug",
      "installationId",
      "returnPath",
      "nonce",
      "issuedAt",
      "expiresAt",
    ])
  );
}

function isGithubUserAuthorizationProof(
  value: unknown
): value is GithubUserAuthorizationProof {
  return (
    isRecord(value) &&
    hasStringFields(value, [
      "productUserId",
      "workspaceSlug",
      "githubUserId",
      "githubLogin",
      "installationId",
      "nonce",
      "issuedAt",
      "expiresAt",
    ]) &&
    Array.isArray(value.allowedProviderRepositoryIds) &&
    value.allowedProviderRepositoryIds.every(
      (repositoryId) => typeof repositoryId === "string"
    )
  );
}

export function createPkceVerifier() {
  return randomBytes(32).toString("base64url");
}

export function createPkceChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function createGithubUserAuthorizationState(
  payload: GithubUserAuthorizationStatePayload,
  secret: string
) {
  return signPayload(payload, secret);
}

export function verifyGithubUserAuthorizationState(
  value: string | null | undefined,
  options: GithubUserAuthorizationStateVerificationOptions
):
  | { status: "valid"; payload: GithubUserAuthorizationStatePayload }
  | {
      status: Exclude<GithubUserAuthorizationStateVerificationStatus, "valid">;
    } {
  const verified = verifySignedPayload(value, options.secret);
  if (verified.status !== "valid") {
    return verified;
  }

  if (!isGithubUserAuthorizationStatePayload(verified.payload)) {
    return { status: "invalid" };
  }

  const payload = verified.payload;
  if (isExpired(payload.expiresAt, options.now)) {
    return { status: "expired" };
  }

  return { status: "valid", payload };
}

export function createGithubUserAuthorizationProof(
  payload: GithubUserAuthorizationProof,
  secret: string
) {
  return signPayload(payload, secret);
}

export function verifyGithubUserAuthorizationProof(
  value: string | null | undefined,
  options: GithubUserAuthorizationProofVerificationOptions
):
  | { status: "valid"; proof: GithubUserAuthorizationProof }
  | {
      status: Exclude<GithubUserAuthorizationProofVerificationStatus, "valid">;
    } {
  const verified = verifySignedPayload(value, options.secret);
  if (verified.status !== "valid") {
    return verified;
  }

  if (!isGithubUserAuthorizationProof(verified.payload)) {
    return { status: "invalid" };
  }

  const proof = verified.payload;
  if (isExpired(proof.expiresAt, options.now)) {
    return { status: "expired" };
  }

  if (proof.productUserId !== options.productUserId) {
    return { status: "wrong_user" };
  }

  if (proof.workspaceSlug !== options.workspaceSlug) {
    return { status: "wrong_workspace" };
  }

  if (proof.installationId !== options.installationId) {
    return { status: "wrong_installation" };
  }

  return { status: "valid", proof };
}

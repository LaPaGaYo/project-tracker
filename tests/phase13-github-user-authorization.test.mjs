import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import {
  createGithubUserAuthorizationProof,
  createGithubUserAuthorizationState,
  createPkceChallenge,
  verifyGithubUserAuthorizationProof,
  verifyGithubUserAuthorizationState
} from "../apps/web/src/server/github/user-authorization-state.ts";

const fixedNow = new Date("2026-04-27T12:00:00.000Z");

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60_000);
}

function signRawBody(body, secret) {
  const signature = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function createSignedInvalidJson(secret) {
  return signRawBody(Buffer.from("{").toString("base64url"), secret);
}

test("github user authorization state is signed, expiring, and tamper-resistant", () => {
  const signedState = createGithubUserAuthorizationState(
    {
      workspaceSlug: "platform-ops",
      installationId: "987",
      returnPath: "/workspaces/platform-ops/projects?githubInstallationId=987",
      nonce: "nonce-state",
      issuedAt: fixedNow.toISOString(),
      expiresAt: addMinutes(fixedNow, 10).toISOString()
    },
    "state-secret"
  );

  const verified = verifyGithubUserAuthorizationState(signedState, {
    secret: "state-secret",
    now: fixedNow
  });

  assert.equal(verified.status, "valid");
  assert.equal(verified.payload.workspaceSlug, "platform-ops");
  assert.equal(verified.payload.installationId, "987");

  assert.equal(
    verifyGithubUserAuthorizationState(`${signedState.slice(0, -1)}x`, {
      secret: "state-secret",
      now: fixedNow
    }).status,
    "invalid"
  );

  assert.equal(
    verifyGithubUserAuthorizationState(signedState, {
      secret: "state-secret",
      now: addMinutes(fixedNow, 11)
    }).status,
    "expired"
  );
});

test("github user authorization state rejects signed malformed payloads", () => {
  const malformedState = createGithubUserAuthorizationState(
    {
      expiresAt: addMinutes(fixedNow, 10).toISOString()
    },
    "state-secret"
  );

  assert.equal(
    verifyGithubUserAuthorizationState(malformedState, {
      secret: "state-secret",
      now: fixedNow
    }).status,
    "invalid"
  );
});

test("github user authorization state rejects missing and invalid signed values", () => {
  const validState = createGithubUserAuthorizationState(
    {
      workspaceSlug: "platform-ops",
      installationId: "987",
      returnPath: "/workspaces/platform-ops/projects?githubInstallationId=987",
      nonce: "nonce-state",
      issuedAt: fixedNow.toISOString(),
      expiresAt: addMinutes(fixedNow, 10).toISOString()
    },
    "state-secret"
  );
  const options = { secret: "state-secret", now: fixedNow };

  assert.equal(verifyGithubUserAuthorizationState(null, options).status, "missing");
  assert.equal(verifyGithubUserAuthorizationState(undefined, options).status, "missing");
  assert.equal(verifyGithubUserAuthorizationState("not-a-token", options).status, "invalid");
  assert.equal(verifyGithubUserAuthorizationState("body.signature.extra", options).status, "invalid");
  assert.equal(
    verifyGithubUserAuthorizationState(validState, {
      secret: "wrong-secret",
      now: fixedNow
    }).status,
    "invalid"
  );
  assert.equal(verifyGithubUserAuthorizationState(createSignedInvalidJson("state-secret"), options).status, "invalid");
});

test("pkce challenge uses SHA-256 base64url encoding", () => {
  assert.equal(createPkceChallenge("verifier-123"), "Ds3NpaREu9I2EYq6l0l3ZkFyv_Gt5O4EpGD6cZlY0Kg");
});

test("github user authorization proof is bound to user, workspace, installation, and repository ids", () => {
  const proof = createGithubUserAuthorizationProof(
    {
      productUserId: "user-1",
      workspaceSlug: "platform-ops",
      githubUserId: "12345",
      githubLogin: "henry",
      installationId: "987",
      allowedProviderRepositoryIds: ["42", "77"],
      nonce: "nonce-proof",
      issuedAt: fixedNow.toISOString(),
      expiresAt: addMinutes(fixedNow, 15).toISOString()
    },
    "proof-secret"
  );

  assert.deepEqual(
    verifyGithubUserAuthorizationProof(proof, {
      secret: "proof-secret",
      now: fixedNow,
      productUserId: "user-1",
      workspaceSlug: "platform-ops",
      installationId: "987"
    }),
    {
      status: "valid",
      proof: {
        productUserId: "user-1",
        workspaceSlug: "platform-ops",
        githubUserId: "12345",
        githubLogin: "henry",
        installationId: "987",
        allowedProviderRepositoryIds: ["42", "77"],
        nonce: "nonce-proof",
        issuedAt: fixedNow.toISOString(),
        expiresAt: addMinutes(fixedNow, 15).toISOString()
      }
    }
  );

  assert.equal(
    verifyGithubUserAuthorizationProof(proof, {
      secret: "proof-secret",
      now: fixedNow,
      productUserId: "user-2",
      workspaceSlug: "platform-ops",
      installationId: "987"
    }).status,
    "wrong_user"
  );

  assert.equal(
    verifyGithubUserAuthorizationProof(proof, {
      secret: "proof-secret",
      now: fixedNow,
      productUserId: "user-1",
      workspaceSlug: "other-workspace",
      installationId: "987"
    }).status,
    "wrong_workspace"
  );

  assert.equal(
    verifyGithubUserAuthorizationProof(proof, {
      secret: "proof-secret",
      now: fixedNow,
      productUserId: "user-1",
      workspaceSlug: "platform-ops",
      installationId: "999"
    }).status,
    "wrong_installation"
  );
});

test("github user authorization proof rejects signed malformed payloads", () => {
  const malformedProof = createGithubUserAuthorizationProof(
    {
      productUserId: "user-1",
      workspaceSlug: "platform-ops",
      installationId: "987",
      expiresAt: addMinutes(fixedNow, 15).toISOString()
    },
    "proof-secret"
  );

  assert.equal(
    verifyGithubUserAuthorizationProof(malformedProof, {
      secret: "proof-secret",
      now: fixedNow,
      productUserId: "user-1",
      workspaceSlug: "platform-ops",
      installationId: "987"
    }).status,
    "invalid"
  );
});

test("github user authorization proof rejects missing and invalid signed values", () => {
  const validProof = createGithubUserAuthorizationProof(
    {
      productUserId: "user-1",
      workspaceSlug: "platform-ops",
      githubUserId: "12345",
      githubLogin: "henry",
      installationId: "987",
      allowedProviderRepositoryIds: ["42", "77"],
      nonce: "nonce-proof",
      issuedAt: fixedNow.toISOString(),
      expiresAt: addMinutes(fixedNow, 15).toISOString()
    },
    "proof-secret"
  );
  const options = {
    secret: "proof-secret",
    now: fixedNow,
    productUserId: "user-1",
    workspaceSlug: "platform-ops",
    installationId: "987"
  };

  assert.equal(verifyGithubUserAuthorizationProof(null, options).status, "missing");
  assert.equal(verifyGithubUserAuthorizationProof(undefined, options).status, "missing");
  assert.equal(verifyGithubUserAuthorizationProof("not-a-token", options).status, "invalid");
  assert.equal(verifyGithubUserAuthorizationProof("body.signature.extra", options).status, "invalid");
  assert.equal(
    verifyGithubUserAuthorizationProof(validProof, {
      ...options,
      secret: "wrong-secret"
    }).status,
    "invalid"
  );
  assert.equal(verifyGithubUserAuthorizationProof(createSignedInvalidJson("proof-secret"), options).status, "invalid");
});

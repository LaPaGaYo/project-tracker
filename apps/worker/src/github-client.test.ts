import assert from "node:assert/strict";
import test from "node:test";

import type { GithubTokenProvider } from "./github-app-auth";
import { createGithubClient } from "./github-client";

function createJsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "content-type": "application/json"
    }
  });
}

void test("createGithubClient resolves a repository token from the configured provider", async () => {
  const providerCalls: string[] = [];
  const requests: Array<{ url: string; init: RequestInit }> = [];
  const tokenProvider: GithubTokenProvider = {
    getToken(target) {
      providerCalls.push(`${target.fullName}:${target.installationId ?? "none"}`);
      return Promise.resolve("ghs_repository_installation");
    }
  };

  const client = createGithubClient({
    baseUrl: "https://github.test",
    tokenProvider,
    fetch: async (url, init) => {
      requests.push({ url: String(url), init: init ?? {} });
      return createJsonResponse([]);
    }
  });

  const snapshot = await client.getRepositorySnapshot({
    owner: "the-platform",
    name: "platform-ops",
    fullName: "the-platform/platform-ops",
    installationId: "installation-1"
  });

  assert.deepEqual(providerCalls, ["the-platform/platform-ops:installation-1"]);
  assert.equal(snapshot.pullRequests.length, 0);
  assert.equal(requests.length, 1);
  assert.equal((requests[0]?.init.headers as Record<string, string>).authorization, "Bearer ghs_repository_installation");
});

import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import test from "node:test";

import { createGithubTokenProvider, normalizeGithubAppPrivateKey } from "./github-app-auth";

function createPrivateKeyPem() {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  return privateKey.export({ format: "pem", type: "pkcs8" }).toString();
}

function createJsonResponse(body: unknown, init: { status?: number; statusText?: string } = {}) {
  const responseInit: ResponseInit = {
    status: init.status ?? 201,
    ...(init.statusText ? { statusText: init.statusText } : {}),
    headers: {
      "content-type": "application/json"
    }
  };

  return new Response(JSON.stringify(body), responseInit);
}

function serializeFetchUrl(url: string | URL | Request) {
  if (typeof url === "string") {
    return url;
  }

  if (url instanceof URL) {
    return url.href;
  }

  return url.url;
}

void test("createGithubTokenProvider returns GITHUB_TOKEN as local developer fallback", async () => {
  const provider = createGithubTokenProvider({
    env: {
      GITHUB_TOKEN: "github_pat_dev"
    }
  });

  assert.equal(
    await provider.getToken({
      fullName: "the-platform/platform-ops"
    }),
    "github_pat_dev"
  );
});

void test("createGithubTokenProvider returns GITHUB_APP_INSTALLATION_TOKEN as manual fallback", async () => {
  const provider = createGithubTokenProvider({
    env: {
      GITHUB_APP_INSTALLATION_TOKEN: "ghs_manual_installation"
    }
  });

  assert.equal(
    await provider.getToken({
      fullName: "the-platform/platform-ops"
    }),
    "ghs_manual_installation"
  );
});

void test("normalizeGithubAppPrivateKey accepts escaped newlines and base64 input", () => {
  const privateKey = createPrivateKeyPem();
  assert.equal(normalizeGithubAppPrivateKey({ privateKey: privateKey.replaceAll("\n", "\\n") }), privateKey.trim());
  assert.equal(
    normalizeGithubAppPrivateKey({ privateKeyBase64: Buffer.from(privateKey).toString("base64") }),
    privateKey.trim()
  );
});

void test("dynamic GitHub App provider exchanges an app JWT for an installation token", async () => {
  const requests: Array<{ url: string; init: RequestInit }> = [];
  const provider = createGithubTokenProvider({
    appId: "12345",
    privateKey: createPrivateKeyPem(),
    apiBaseUrl: "https://github.test",
    now: () => new Date("2026-04-26T12:00:00.000Z"),
    fetch: (url, init) => {
      requests.push({ url: serializeFetchUrl(url), init: init ?? {} });
      return Promise.resolve(createJsonResponse({
        token: "ghs_installation_token",
        expires_at: "2026-04-26T13:00:00.000Z"
      }));
    }
  });

  const token = await provider.getToken({
    fullName: "the-platform/platform-ops",
    installationId: "98765"
  });

  assert.equal(token, "ghs_installation_token");
  assert.equal(requests.length, 1);
  assert.equal(requests[0]?.url, "https://github.test/app/installations/98765/access_tokens");
  assert.equal(requests[0]?.init.method, "POST");
  assert.match(
    String((requests[0]?.init.headers as Record<string, string>).authorization),
    /^Bearer [^.]+\.[^.]+\.[^.]+$/
  );
});

void test("dynamic GitHub App provider caches valid installation tokens per installation", async () => {
  let requestCount = 0;
  const provider = createGithubTokenProvider({
    appId: "12345",
    privateKey: createPrivateKeyPem(),
    apiBaseUrl: "https://github.test",
    now: () => new Date("2026-04-26T12:00:00.000Z"),
    fetch: () => {
      requestCount += 1;
      return Promise.resolve(createJsonResponse({
        token: `ghs_installation_token_${requestCount}`,
        expires_at: "2026-04-26T13:00:00.000Z"
      }));
    }
  });

  const target = {
    fullName: "the-platform/platform-ops",
    installationId: "98765"
  };

  assert.equal(await provider.getToken(target), "ghs_installation_token_1");
  assert.equal(await provider.getToken(target), "ghs_installation_token_1");
  assert.equal(requestCount, 1);
});

void test("dynamic GitHub App provider refreshes tokens inside the refresh window", async () => {
  let now = new Date("2026-04-26T12:00:00.000Z");
  let requestCount = 0;
  const provider = createGithubTokenProvider({
    appId: "12345",
    privateKey: createPrivateKeyPem(),
    apiBaseUrl: "https://github.test",
    cacheRefreshWindowMs: 5 * 60 * 1000,
    now: () => now,
    fetch: () => {
      requestCount += 1;
      return Promise.resolve(createJsonResponse({
        token: `ghs_installation_token_${requestCount}`,
        expires_at: "2026-04-26T12:10:00.000Z"
      }));
    }
  });

  const target = {
    fullName: "the-platform/platform-ops",
    installationId: "98765"
  };

  assert.equal(await provider.getToken(target), "ghs_installation_token_1");
  now = new Date("2026-04-26T12:06:00.000Z");
  assert.equal(await provider.getToken(target), "ghs_installation_token_2");
  assert.equal(requestCount, 2);
});

void test("dynamic GitHub App provider requires repository installation id", async () => {
  const provider = createGithubTokenProvider({
    appId: "12345",
    privateKey: createPrivateKeyPem(),
    apiBaseUrl: "https://github.test",
    fetch: () => Promise.resolve(createJsonResponse({}))
  });

  await assert.rejects(
    provider.getToken({
      fullName: "the-platform/platform-ops"
    }),
    /Missing GitHub installation id for the-platform\/platform-ops/
  );
});

void test("createGithubTokenProvider fails clearly when no worker credentials are configured", () => {
  assert.throws(
    () =>
      createGithubTokenProvider({
        env: {}
      }),
    /GITHUB_TOKEN, GITHUB_APP_INSTALLATION_TOKEN, or GitHub App credentials are required/
  );
});

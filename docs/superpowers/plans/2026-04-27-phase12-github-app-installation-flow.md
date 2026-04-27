# Phase 12 GitHub App Installation Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let workspace admins install the GitHub App, select a server-verified installation repository, and import it without manually typing GitHub repository metadata.

**Architecture:** Add a web-side GitHub App installation client that mints short-lived installation tokens server-side and lists repositories for an installation. Add a selected-repository import service that verifies the selected repository against the server-fetched installation repository list before reusing the Phase 11 import service. Replace the manual metadata UI with install/setup/repository-picker states.

**Tech Stack:** Next.js App Router, React server components, Next server actions, Node `crypto`, Node `test`, Vitest Testing Library, Drizzle-backed repositories.

---

## File Structure

- Create `apps/web/src/server/github/app-installation.ts`: install URL building, private key normalization, app JWT signing, installation token minting, installation repository listing.
- Create `apps/web/src/server/github/installation-import.ts`: selected installed repository import orchestration.
- Create `apps/web/src/server/github/setup.ts`: pure setup redirect helper for the GitHub setup callback route.
- Create `apps/web/src/app/github/setup/page.tsx`: GitHub setup callback page.
- Create `tests/phase12-github-installation-import.test.mjs`: Node service/client tests.
- Modify `apps/web/src/features/github-import/github-import-panel.tsx`: replace manual metadata form with app install and repository picker states.
- Modify `apps/web/src/features/github-import/__tests__/github-import-panel.test.tsx`: UI tests for install, picker, missing config, empty, error, non-admin states.
- Modify `apps/web/src/app/workspaces/[slug]/projects/page.tsx`: read setup query params and pass server-fetched repository data to the panel.
- Modify `apps/web/src/app/actions.ts`: add `importInstalledGithubRepositoryAction`.
- Modify `apps/web/src/app/actions.test.ts`: cover selected repository import action redirect.
- Modify `.env.example`: document `APP_BASE_URL` and `GITHUB_APP_SLUG`.

## Task 1: GitHub App Installation Client

**Files:**
- Create: `apps/web/src/server/github/app-installation.ts`
- Test: `tests/phase12-github-installation-import.test.mjs`
- Modify: `.env.example`

- [ ] **Step 1: Write failing client tests**

Add tests to `tests/phase12-github-installation-import.test.mjs` for:

```js
test("buildGithubAppInstallUrl encodes workspace state", () => {
  const url = buildGithubAppInstallUrl({
    appSlug: "the-platform-dev",
    workspaceSlug: "platform-ops"
  });

  assert.equal(
    url,
    "https://github.com/apps/the-platform-dev/installations/new?state=platform-ops"
  );
});

test("normalizeGithubAppPrivateKey accepts escaped and base64 PEM values", () => {
  const pem = "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----";
  assert.equal(normalizeGithubAppPrivateKey({ privateKey: pem.replaceAll("\n", "\\n") }), pem);
  assert.equal(
    normalizeGithubAppPrivateKey({ privateKeyBase64: Buffer.from(pem).toString("base64") }),
    pem
  );
});

test("installation client mints an installation token and lists repositories", async () => {
  const calls = [];
  const client = createGithubAppInstallationClient({
    appId: "123",
    privateKey: TEST_PRIVATE_KEY,
    apiBaseUrl: "https://api.github.test",
    fetch: async (url, init) => {
      calls.push({ url: String(url), init });
      if (String(url).endsWith("/app/installations/987/access_tokens")) {
        return jsonResponse({ token: "ghs_installation", expires_at: "2099-01-01T00:00:00Z" }, 201);
      }
      return jsonResponse({
        repositories: [
          {
            id: 42,
            name: "platform-ops",
            full_name: "the-platform/platform-ops",
            default_branch: "main",
            private: true,
            html_url: "https://github.com/the-platform/platform-ops",
            owner: { login: "the-platform" }
          }
        ]
      });
    }
  });

  const repositories = await client.listRepositories("987");

  assert.equal(repositories[0].providerRepositoryId, "42");
  assert.equal(repositories[0].fullName, "the-platform/platform-ops");
  assert.match(String(calls[0].init.headers.authorization), /^Bearer /);
  assert.equal(calls[1].init.headers.authorization, "Bearer ghs_installation");
});
```

- [ ] **Step 2: Run client tests and verify RED**

Run:

```bash
node --import tsx --test tests/phase12-github-installation-import.test.mjs
```

Expected: FAIL because `apps/web/src/server/github/app-installation.ts` does not exist.

- [ ] **Step 3: Implement the minimal client**

Create `apps/web/src/server/github/app-installation.ts` with exports:

```ts
export interface GithubInstallationRepository {
  providerRepositoryId: string;
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  htmlUrl: string | null;
  isPrivate: boolean;
}

export interface GithubAppInstallationClient {
  listRepositories(installationId: string): Promise<GithubInstallationRepository[]>;
}

export function buildGithubAppInstallUrl(input: {
  appSlug: string;
  workspaceSlug: string;
  githubBaseUrl?: string;
}): string;

export function normalizeGithubAppPrivateKey(input: {
  privateKey?: string | undefined;
  privateKeyBase64?: string | undefined;
}): string | undefined;

export function createGithubAppInstallationClient(options?: {
  appId?: string | undefined;
  privateKey?: string | undefined;
  privateKeyBase64?: string | undefined;
  apiBaseUrl?: string | undefined;
  fetch?: typeof fetch | undefined;
  env?: Record<string, string | undefined> | undefined;
}): GithubAppInstallationClient;
```

Implementation notes:

- Use `node:crypto` `createSign("RSA-SHA256")` as in the worker token provider.
- Use `POST /app/installations/{installation_id}/access_tokens` with a Bearer app JWT.
- Use `GET /installation/repositories?per_page=100` with the installation token.
- Use `accept: application/vnd.github+json` and `x-github-api-version: 2022-11-28`.
- Throw `GitHub App credentials are required to list installation repositories.` when app id/private key are missing.
- Do not return or log token response bodies.

- [ ] **Step 4: Run client tests and verify GREEN**

Run:

```bash
node --import tsx --test tests/phase12-github-installation-import.test.mjs
```

Expected: the client tests pass.

- [ ] **Step 5: Update environment docs**

Add to `.env.example`:

```bash
APP_BASE_URL=http://localhost:3000
GITHUB_APP_SLUG=
```

Keep existing worker credential comments, but clarify the same app credentials are used by web setup and worker reconciliation.

## Task 2: Selected Installed Repository Import Service

**Files:**
- Create: `apps/web/src/server/github/installation-import.ts`
- Modify: `tests/phase12-github-installation-import.test.mjs`

- [ ] **Step 1: Write failing service tests**

Add tests for:

```js
test("admin imports a selected installation repository as a connected project", async (t) => {
  const harness = createPersistedHarness(t);
  const admin = createNamedSession("admin-gh-installed-import");
  const workspace = await harness.createWorkspace(admin, "github-installed-import");
  const projectKey = createUniqueProjectKey();

  const result = await importGithubInstallationRepositoryForUser(
    {
      projectRepository: harness.repositories.projectRepository,
      githubRepository: harness.repositories.githubRepository,
      installationClient: {
        listRepositories: async (installationId) => {
          assert.equal(installationId, "987");
          return [selectedRepositoryFixture("42")];
        }
      }
    },
    admin,
    workspace.slug,
    "987",
    {
      providerRepositoryId: "42",
      projectName: "Platform Ops",
      key: projectKey,
      stagingEnvironmentName: "staging",
      productionEnvironmentName: "production"
    }
  );

  assert.equal(result.project.key, projectKey);
  assert.equal(result.github.repository.fullName, "the-platform/platform-ops");
});

test("selected repository import rejects non-admin users before calling GitHub", async (t) => {
  const harness = createPersistedHarness(t);
  const owner = createNamedSession("owner-gh-installed-rbac");
  const member = createNamedSession("member-gh-installed-rbac");
  const workspace = await harness.createWorkspace(owner, "github-installed-rbac");
  await harness.addMembership(workspace.id, member, "member");
  let called = false;

  await assert.rejects(
    () =>
      importGithubInstallationRepositoryForUser(
        {
          projectRepository: harness.repositories.projectRepository,
          githubRepository: harness.repositories.githubRepository,
          installationClient: {
            listRepositories: async () => {
              called = true;
              return [];
            }
          }
        },
        member,
        workspace.slug,
        "987",
        { providerRepositoryId: "42" }
      ),
    /only owners and admins can import GitHub projects/
  );

  assert.equal(called, false);
});

test("selected repository import rejects repositories outside the installation", async (t) => {
  const harness = createPersistedHarness(t);
  const admin = createNamedSession("admin-gh-installed-missing");
  const workspace = await harness.createWorkspace(admin, "github-installed-missing");

  await assert.rejects(
    () =>
      importGithubInstallationRepositoryForUser(
        {
          projectRepository: harness.repositories.projectRepository,
          githubRepository: harness.repositories.githubRepository,
          installationClient: { listRepositories: async () => [selectedRepositoryFixture("42")] }
        },
        admin,
        workspace.slug,
        "987",
        { providerRepositoryId: "404" }
      ),
    /selected repository is not available to this GitHub installation/
  );
});
```

- [ ] **Step 2: Run service tests and verify RED**

Run:

```bash
node --import tsx --test tests/phase12-github-installation-import.test.mjs
```

Expected: FAIL because `installation-import.ts` does not exist.

- [ ] **Step 3: Implement selected import service**

Create `apps/web/src/server/github/installation-import.ts`:

```ts
import { WorkspaceError } from "../workspaces/core";
import {
  requireNonEmptyString,
  requireRoleAtLeast,
  resolveWorkspaceContext
} from "../work-management/utils";
import type { AppSession } from "../workspaces/types";
import type { ProjectRepository } from "../projects/types";

import { importGithubProjectForUser, type ImportGithubProjectResult } from "./import";
import type { GithubConnectionRepository } from "./types";
import type { GithubAppInstallationClient } from "./app-installation";

export interface ImportGithubInstallationRepositoryInput {
  providerRepositoryId?: unknown;
  projectName?: unknown;
  key?: unknown;
  description?: unknown;
  stagingEnvironmentName?: unknown;
  productionEnvironmentName?: unknown;
}

export async function importGithubInstallationRepositoryForUser(
  dependencies: {
    projectRepository: ProjectRepository;
    githubRepository: GithubConnectionRepository;
    installationClient: GithubAppInstallationClient;
  },
  session: AppSession,
  workspaceSlug: string,
  installationIdInput: unknown,
  input: ImportGithubInstallationRepositoryInput
): Promise<ImportGithubProjectResult> {
  const { membership } = await resolveWorkspaceContext(
    dependencies.projectRepository,
    session,
    workspaceSlug,
    "viewer"
  );
  requireRoleAtLeast(membership.role, "admin", "only owners and admins can import GitHub projects.");

  const installationId = requireNonEmptyString(installationIdInput, "installationId");
  const providerRepositoryId = requireNonEmptyString(input.providerRepositoryId, "providerRepositoryId");
  const repositories = await dependencies.installationClient.listRepositories(installationId);
  const selected = repositories.find((repository) => repository.providerRepositoryId === providerRepositoryId);

  if (!selected) {
    throw new WorkspaceError(404, "selected repository is not available to this GitHub installation.");
  }

  return importGithubProjectForUser(
    {
      projectRepository: dependencies.projectRepository,
      githubRepository: dependencies.githubRepository
    },
    session,
    workspaceSlug,
    {
      providerRepositoryId: selected.providerRepositoryId,
      owner: selected.owner,
      name: selected.name,
      fullName: selected.fullName,
      defaultBranch: selected.defaultBranch,
      installationId,
      projectName: input.projectName,
      key: input.key,
      description: input.description,
      stagingEnvironmentName: input.stagingEnvironmentName,
      productionEnvironmentName: input.productionEnvironmentName
    }
  );
}
```

- [ ] **Step 4: Run service tests and verify GREEN**

Run:

```bash
node --import tsx --test tests/phase12-github-installation-import.test.mjs
```

Expected: all Phase 12 Node tests pass.

## Task 3: Setup Callback Route

**Files:**
- Create: `apps/web/src/server/github/setup.ts`
- Create: `apps/web/src/app/github/setup/page.tsx`
- Modify: `tests/phase12-github-installation-import.test.mjs`

- [ ] **Step 1: Write failing setup helper tests**

Add tests:

```js
test("resolveGithubSetupRedirect returns workspace projects URL for valid setup params", () => {
  assert.equal(
    resolveGithubSetupRedirect(new URLSearchParams({
      state: "platform-ops",
      installation_id: "987",
      setup_action: "install"
    })),
    "/workspaces/platform-ops/projects?githubInstallationId=987&githubSetupAction=install"
  );
});

test("resolveGithubSetupRedirect returns home for invalid setup state", () => {
  assert.equal(
    resolveGithubSetupRedirect(new URLSearchParams({
      state: "../platform-ops",
      installation_id: "987"
    })),
    "/"
  );
});
```

- [ ] **Step 2: Run setup tests and verify RED**

Run:

```bash
node --import tsx --test tests/phase12-github-installation-import.test.mjs
```

Expected: FAIL because `setup.ts` does not exist.

- [ ] **Step 3: Implement setup helper and route**

Create `apps/web/src/server/github/setup.ts` with:

```ts
export function resolveGithubSetupRedirect(searchParams: URLSearchParams) {
  const state = searchParams.get("state")?.trim() ?? "";
  const installationId = searchParams.get("installation_id")?.trim() ?? "";
  const setupAction = searchParams.get("setup_action")?.trim() ?? "";

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(state)) {
    return "/";
  }

  const params = new URLSearchParams();
  if (installationId) {
    params.set("githubInstallationId", installationId);
  }
  if (setupAction) {
    params.set("githubSetupAction", setupAction);
  }

  const query = params.toString();
  return `/workspaces/${state}/projects${query ? `?${query}` : ""}`;
}
```

Create `apps/web/src/app/github/setup/page.tsx`:

```tsx
import { redirect } from "next/navigation";

import { getAppSession } from "@/server/auth";
import { resolveGithubSetupRedirect } from "@/server/github/setup";

export const dynamic = "force-dynamic";

export default async function GithubSetupPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getAppSession();
  const resolvedSearchParams = await searchParams;
  const nextParams = new URLSearchParams();

  for (const [key, value] of Object.entries(resolvedSearchParams)) {
    if (typeof value === "string") {
      nextParams.set(key, value);
    }
  }

  if (!session) {
    redirect("/sign-in");
  }

  redirect(resolveGithubSetupRedirect(nextParams));
}
```

- [ ] **Step 4: Run setup tests and verify GREEN**

Run:

```bash
node --import tsx --test tests/phase12-github-installation-import.test.mjs
```

Expected: setup helper tests pass.

## Task 4: Workspace UI and Page Wiring

**Files:**
- Modify: `apps/web/src/features/github-import/github-import-panel.tsx`
- Modify: `apps/web/src/features/github-import/__tests__/github-import-panel.test.tsx`
- Modify: `apps/web/src/app/workspaces/[slug]/projects/page.tsx`

- [ ] **Step 1: Write failing UI tests**

Replace the Phase 11 panel tests with tests that assert:

```ts
render(
  <GithubImportPanel
    workspaceSlug="platform-ops"
    canImport
    installUrl="https://github.com/apps/the-platform-dev/installations/new?state=platform-ops"
    installationId={null}
    repositories={[]}
    errorMessage={null}
    missingConfiguration={[]}
  />
);
expect(screen.getByRole("link", { name: "Install GitHub App" })).toHaveAttribute(
  "href",
  "https://github.com/apps/the-platform-dev/installations/new?state=platform-ops"
);
expect(screen.queryByLabelText("Repository owner")).not.toBeInTheDocument();
```

Also add tests for:

- repository picker with `providerRepositoryId` radio values;
- missing configuration state;
- empty repository state;
- error state;
- non-admin state.

- [ ] **Step 2: Run UI tests and verify RED**

Run:

```bash
npm test --workspace @the-platform/web -- src/features/github-import/__tests__/github-import-panel.test.tsx
```

Expected: FAIL because `GithubImportPanel` still requires old props and renders manual fields.

- [ ] **Step 3: Implement panel states**

Update `GithubImportPanel` props to:

```ts
interface GithubImportPanelRepository {
  providerRepositoryId: string;
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  htmlUrl: string | null;
  isPrivate: boolean;
}

interface GithubImportPanelProps {
  workspaceSlug: string;
  canImport: boolean;
  installUrl: string | null;
  installationId: string | null;
  repositories: GithubImportPanelRepository[];
  errorMessage: string | null;
  missingConfiguration: string[];
}
```

Render:

- non-admin copy when `!canImport`;
- missing configuration copy when `missingConfiguration.length > 0`;
- install CTA when no installation id is active;
- error copy plus install/update CTA when `errorMessage` exists;
- empty state when `installationId` is active and repositories are empty;
- repository radio picker form when repositories are present.

The repository picker form must use:

```tsx
<form action={importInstalledGithubRepositoryAction.bind(null, workspaceSlug, installationId)}>
  <input type="radio" name="providerRepositoryId" value={repository.providerRepositoryId} required />
</form>
```

Do not render manual owner, name, provider repository id, default branch, or installation id text inputs.

- [ ] **Step 4: Wire projects page**

Update `WorkspaceProjectsPage` to accept `searchParams`.

For admins:

- compute `installUrl` from `GITHUB_APP_SLUG` and workspace slug;
- read `githubInstallationId`;
- if installation id is present and app credentials exist, call `createGithubAppInstallationClient().listRepositories(installationId)`;
- catch listing errors and pass a safe `errorMessage`;
- pass `missingConfiguration` when slug or app credentials are absent.

Do not call GitHub for non-admin users.

- [ ] **Step 5: Run UI tests and verify GREEN**

Run:

```bash
npm test --workspace @the-platform/web -- src/features/github-import/__tests__/github-import-panel.test.tsx
```

Expected: all GitHub import panel tests pass.

## Task 5: Server Action Wiring

**Files:**
- Modify: `apps/web/src/app/actions.ts`
- Modify: `apps/web/src/app/actions.test.ts`

- [ ] **Step 1: Write failing action test**

Add a Vitest case:

```ts
it("redirects to engineering after importing a selected installed repository", async () => {
  getAppSessionMock.mockResolvedValue({
    userId: "henry",
    email: "henry@example.com",
    displayName: "Henry",
    provider: "demo"
  });
  importGithubInstallationRepositoryForUserMock.mockResolvedValue({
    project: { key: "OPS" }
  });
  const formData = new FormData();
  formData.set("providerRepositoryId", "42");

  await expect(
    importInstalledGithubRepositoryAction("platform-ops", "987", formData)
  ).rejects.toThrow(/^REDIRECT:\/workspaces\/platform-ops\/projects\/OPS\/engineering$/);
});
```

Mock:

```ts
vi.mock("@/server/github/installation-import", () => ({
  importGithubInstallationRepositoryForUser: importGithubInstallationRepositoryForUserMock
}));
vi.mock("@/server/github/app-installation", () => ({
  createGithubAppInstallationClient: createGithubAppInstallationClientMock
}));
vi.mock("@/server/github/repository", () => ({
  createGithubConnectionRepository: createGithubConnectionRepositoryMock
}));
```

- [ ] **Step 2: Run action test and verify RED**

Run:

```bash
npm test --workspace @the-platform/web -- src/app/actions.test.ts
```

Expected: FAIL because the new action does not exist.

- [ ] **Step 3: Implement action**

Add to `apps/web/src/app/actions.ts`:

```ts
export async function importInstalledGithubRepositoryAction(
  workspaceSlug: string,
  installationId: string,
  formData: FormData
) {
  const session = await requireSessionForAction();
  const result = await importGithubInstallationRepositoryForUser(
    {
      projectRepository: createProjectRepository(),
      githubRepository: createGithubConnectionRepository(),
      installationClient: createGithubAppInstallationClient()
    },
    session,
    workspaceSlug,
    installationId,
    {
      providerRepositoryId: formData.get("providerRepositoryId"),
      projectName: formData.get("projectName"),
      key: formData.get("key"),
      stagingEnvironmentName: formData.get("stagingEnvironmentName"),
      productionEnvironmentName: formData.get("productionEnvironmentName")
    }
  );

  revalidatePath(`/workspaces/${workspaceSlug}/projects`);
  redirect(`/workspaces/${workspaceSlug}/projects/${result.project.key}/engineering`);
}
```

- [ ] **Step 4: Run action test and verify GREEN**

Run:

```bash
npm test --workspace @the-platform/web -- src/app/actions.test.ts
```

Expected: action tests pass.

## Task 6: Full Verification and Commit

**Files:**
- Verify all changed files.

- [ ] **Step 1: Run focused verification**

Run:

```bash
node --import tsx --test tests/phase12-github-installation-import.test.mjs
npm test --workspace @the-platform/web -- src/features/github-import/__tests__/github-import-panel.test.tsx
npm test --workspace @the-platform/web -- src/app/actions.test.ts
```

Expected: all focused tests pass.

- [ ] **Step 2: Run full verification**

Run:

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

Expected: all commands pass.

- [ ] **Step 3: Review diff**

Run:

```bash
git diff --check
git status --short
git diff --stat
```

Expected: no whitespace errors and only Phase 12 files changed.

- [ ] **Step 4: Commit**

Run:

```bash
git add .env.example apps/web/src/server/github/app-installation.ts apps/web/src/server/github/installation-import.ts apps/web/src/server/github/setup.ts apps/web/src/app/github/setup/page.tsx apps/web/src/features/github-import/github-import-panel.tsx apps/web/src/features/github-import/__tests__/github-import-panel.test.tsx apps/web/src/app/workspaces/[slug]/projects/page.tsx apps/web/src/app/actions.ts apps/web/src/app/actions.test.ts tests/phase12-github-installation-import.test.mjs docs/superpowers/specs/2026-04-27-phase12-github-app-installation-flow-design.md docs/superpowers/plans/2026-04-27-phase12-github-app-installation-flow.md
git commit -m "Add GitHub App installation import flow"
```

Expected: commit succeeds on `branch/phase12-github-app-installation-flow`.

## Self-Review

- Spec coverage: The plan covers install URL, setup redirect, server-side repository listing, selected repository import, UI states, action wiring, env docs, and verification.
- Placeholder scan: No `TBD`, `TODO`, or unspecified edge-case placeholders remain.
- Type consistency: The repository metadata type uses `providerRepositoryId`, `owner`, `name`, `fullName`, `defaultBranch`, `htmlUrl`, and `isPrivate` consistently across client, service, UI, and tests.

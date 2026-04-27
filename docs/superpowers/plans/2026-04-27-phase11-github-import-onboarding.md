# Phase 11 GitHub Import Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let workspace admins create a project from selected GitHub repository metadata and connect that project to the repository in one tested flow.

**Architecture:** Add a server import service that composes existing project creation and GitHub connection services with admin preflight and rollback. Add a workspace projects page panel plus server action that submits the repository selection payload and redirects to the imported project engineering page. Keep GitHub tokens server-only and out of the browser contract.

**Tech Stack:** Next.js App Router server actions, React server/client components, Vitest Testing Library, Node `test`, Drizzle-backed repositories.

---

## File Structure

- Create `apps/web/src/server/github/import.ts` for import normalization and orchestration.
- Create `tests/phase11-github-import.test.mjs` for repository-backed service tests.
- Create `apps/web/src/features/github-import/github-import-panel.tsx` for workspace page import UI.
- Create `apps/web/src/features/github-import/__tests__/github-import-panel.test.tsx` for UI tests.
- Modify `apps/web/src/app/actions.ts` to add `importGithubProjectAction`.
- Modify `apps/web/src/app/workspaces/[slug]/projects/page.tsx` to render the import panel.

## Task 1: Server Import Service

**Files:**
- Create: `apps/web/src/server/github/import.ts`
- Create: `tests/phase11-github-import.test.mjs`

- [ ] **Step 1: Write failing service tests**

Create `tests/phase11-github-import.test.mjs` with tests for:

```js
test("admin can import a GitHub repository as a connected project", async (t) => {
  const harness = createPersistedHarness(t);
  const admin = createNamedSession("admin-gh-import");
  const workspace = await harness.createWorkspace(admin, "github-import");

  const result = await importGithubProjectForUser(
    {
      projectRepository: harness.repositories.projectRepository,
      githubRepository: harness.repositories.githubRepository
    },
    admin,
    workspace.slug,
    {
      providerRepositoryId: `repo_import_${uniqueSuffix()}`,
      owner: "the-platform",
      name: "imported-service",
      fullName: "the-platform/imported-service",
      defaultBranch: "main",
      installationId: `installation_${uniqueSuffix()}`,
      projectName: "Imported Service",
      key: createUniqueProjectKey(),
      stagingEnvironmentName: "staging",
      productionEnvironmentName: "production"
    }
  );

  assert.equal(result.project.title, "Imported Service");
  assert.equal(result.github.repository.fullName, "the-platform/imported-service");

  const workspaceView = await getProjectWorkspaceForUser(
    {
      projectRepository: harness.repositories.projectRepository,
      workItemRepository: harness.repositories.workItemRepository
    },
    admin,
    workspace.slug,
    result.project.key
  );

  assert.equal(workspaceView.engineering.repository, "the-platform/imported-service");
  assert.equal(workspaceView.engineering.connectionStatus, "Connected");
});
```

Also add tests for:

```js
test("members cannot import GitHub projects", async (t) => { /* expect 403 */ });
test("connection failure rolls back the newly-created project", async (t) => { /* duplicate repository then assert no rollback project */ });
```

- [ ] **Step 2: Run service tests and verify RED**

Run:

```bash
node --import tsx --test tests/phase11-github-import.test.mjs
```

Expected: FAIL because `apps/web/src/server/github/import.ts` does not exist.

- [ ] **Step 3: Implement minimal service**

Create `apps/web/src/server/github/import.ts` with:

```ts
import type { ProjectRecord } from "@the-platform/shared";

import { createProjectForUser, deleteProjectForUser } from "../projects/service";
import type { ProjectRepository } from "../projects/types";
import type { AppSession } from "../workspaces/types";
import { requireRoleAtLeast, resolveWorkspaceContext, requireNonEmptyString } from "../work-management/utils";

import { connectProjectGithubRepositoryForUser } from "./service";
import type { GithubConnectionRepository, ProjectGithubConnectionView } from "./types";

export interface ImportGithubProjectInput {
  providerRepositoryId?: unknown;
  owner?: unknown;
  name?: unknown;
  fullName?: unknown;
  defaultBranch?: unknown;
  installationId?: unknown;
  stagingEnvironmentName?: unknown;
  productionEnvironmentName?: unknown;
  projectName?: unknown;
  key?: unknown;
  description?: unknown;
}

export interface ImportGithubProjectDependencies {
  projectRepository: ProjectRepository;
  githubRepository: GithubConnectionRepository;
}

export interface ImportGithubProjectResult {
  project: ProjectRecord;
  github: ProjectGithubConnectionView;
}
```

Implement `importGithubProjectForUser(...)` by:

- resolving workspace context with minimum role `admin`;
- using `requireRoleAtLeast(membership.role, "admin", "only owners and admins can import GitHub projects.")`;
- creating a project through `createProjectForUser`;
- connecting that project through `connectProjectGithubRepositoryForUser`;
- deleting the project with `deleteProjectForUser` if connection throws after project creation;
- returning `{ project, github }`.

Derive missing `projectName` from repository `name` by replacing `-` and `_` with spaces and title-casing words. Derive missing `key` from repository `name` by uppercasing alphanumeric characters and taking the first 8 characters; validation remains delegated to `createProjectForUser`.

- [ ] **Step 4: Run service tests and verify GREEN**

Run:

```bash
node --import tsx --test tests/phase11-github-import.test.mjs
```

Expected: all Phase 11 service tests pass.

- [ ] **Step 5: Commit service slice**

Run:

```bash
git add apps/web/src/server/github/import.ts tests/phase11-github-import.test.mjs
git commit -m "Add GitHub project import service"
```

## Task 2: GitHub Import Panel

**Files:**
- Create: `apps/web/src/features/github-import/github-import-panel.tsx`
- Create: `apps/web/src/features/github-import/__tests__/github-import-panel.test.tsx`
- Modify: `apps/web/src/app/workspaces/[slug]/projects/page.tsx`
- Modify: `apps/web/src/app/actions.ts`

- [ ] **Step 1: Write failing UI tests**

Create `apps/web/src/features/github-import/__tests__/github-import-panel.test.tsx` to assert:

```tsx
expect(screen.getByRole("heading", { name: "Import from GitHub" })).toBeInTheDocument();
expect(screen.getByLabelText("Repository owner")).toBeInTheDocument();
expect(screen.getByLabelText("Repository name")).toBeInTheDocument();
expect(screen.queryByLabelText(/token/i)).not.toBeInTheDocument();
expect(screen.getByRole("button", { name: "Import repository" })).toBeEnabled();
```

For non-admin roles:

```tsx
expect(screen.getByText("Workspace admin access is required to import GitHub projects.")).toBeInTheDocument();
expect(screen.queryByRole("button", { name: "Import repository" })).not.toBeInTheDocument();
```

- [ ] **Step 2: Run UI tests and verify RED**

Run:

```bash
npm test --workspace @the-platform/web -- src/features/github-import/__tests__/github-import-panel.test.tsx
```

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement import panel**

Create a client-safe component with props:

```ts
interface GithubImportPanelProps {
  workspaceSlug: string;
  canImport: boolean;
}
```

Render a form using `action={importGithubProjectAction.bind(null, workspaceSlug)}` with fields:

- `providerRepositoryId`
- `owner`
- `name`
- `defaultBranch`
- `installationId`
- `projectName`
- `key`
- `stagingEnvironmentName`
- `productionEnvironmentName`

Do not include token fields.

- [ ] **Step 4: Wire action and page**

Add `importGithubProjectAction(workspaceSlug, formData)` to `apps/web/src/app/actions.ts`:

- require session;
- call `importGithubProjectForUser`;
- revalidate `/workspaces/${workspaceSlug}/projects`;
- redirect to `/workspaces/${workspaceSlug}/projects/${result.project.key}/engineering`.

Modify the projects page so `canImport = membership.role === "owner" || membership.role === "admin"` and render `<GithubImportPanel workspaceSlug={slug} canImport={canImport} />` in the aside.

- [ ] **Step 5: Run UI tests and targeted service tests**

Run:

```bash
npm test --workspace @the-platform/web -- src/features/github-import/__tests__/github-import-panel.test.tsx
node --import tsx --test tests/phase11-github-import.test.mjs
```

Expected: all targeted tests pass.

- [ ] **Step 6: Commit UI slice**

Run:

```bash
git add apps/web/src/features/github-import apps/web/src/app/actions.ts 'apps/web/src/app/workspaces/[slug]/projects/page.tsx'
git commit -m "Add GitHub import onboarding panel"
```

## Task 3: Full Verification

**Files:**
- No new files.

- [ ] **Step 1: Run full test suite**

Run:

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 2: Run lint**

Run:

```bash
npm run lint
```

Expected: all lint tasks pass.

- [ ] **Step 3: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: all typecheck tasks pass.

- [ ] **Step 4: Run build**

Run:

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 5: Browser smoke**

Run the web app, open the workspace projects page, and verify:

- GitHub import panel is visible to admins.
- The panel does not show token fields.
- Submitting a valid local repository metadata payload redirects to the imported project engineering page.

- [ ] **Step 6: Commit any verification polish**

If fixes were needed, commit them with:

```bash
git commit -m "Polish GitHub import onboarding"
```

# Phase 11 GitHub Import Onboarding Design

## Goal

Turn the GitHub-first auth and worker foundation into an onboarding path where a workspace admin can start a project from a GitHub repository and immediately get engineering readiness signals once webhooks or reconciliation populate the local read model.

## Current Baseline

- Phase 6 added GitHub repository records, project connections, webhook ingestion, and local engineering read models.
- Phase 9 added server-side GitHub App installation token minting for worker reconciliation.
- Phase 10 added the branded auth gateway and a GitHub login entry point.
- The server already supports connecting an existing project to one primary GitHub repository through `connectProjectGithubRepositoryForUser`.
- The product still lacks a user-facing way to import or start a project from a selected GitHub repository.

## Product Decision

Phase 11 starts with a small, durable import boundary instead of building the full GitHub App installation UX in one step.

The first deliverable is a workspace-level GitHub import request:

1. A workspace admin selects or supplies repository metadata that represents a GitHub App installation repository selection.
2. The server creates a project using that repository as the project seed.
3. The server connects the new project to the selected repository through the existing GitHub connection model.
4. If connection fails after project creation, the server rolls the project back so failed imports do not leave orphan projects.

This keeps the core business behavior testable without depending on a live GitHub OAuth session, GitHub App installation callback, or external network availability.

## Scope

This phase includes:

- `importGithubProjectForUser`, a server service that creates a project and connects the selected GitHub repository.
- a server action for the workspace projects page import form.
- a GitHub import panel on the workspace projects page.
- role enforcement so only owners and admins can import GitHub projects.
- validation for repository owner, name, full name, provider repository id, default branch, installation id, project name, and project key.
- rollback on post-project connection failure.
- tests for successful import, role denial, rollback, and UI affordances.

This phase does not include:

- GitHub Marketplace/App registration automation.
- live GitHub repository list fetching in the browser.
- storing GitHub installation access tokens in the database.
- user-scoped GitHub OAuth token storage.
- importing GitHub issues into work items.
- multi-provider source control support.

## Architecture

### Server Boundary

Add `apps/web/src/server/github/import.ts`.

Responsibilities:

- normalize repository metadata into a project import request;
- derive a readable project name from the repository name when one is not provided;
- derive a project key from the repository name when one is not provided;
- require an admin-level workspace role before creating anything;
- create the project with the existing `createProjectForUser` service;
- connect the repository with the existing `connectProjectGithubRepositoryForUser` service;
- delete the newly created project if the repository connection fails.

The service should accept dependencies explicitly:

- `projectRepository`
- `githubRepository`

This keeps tests isolated and matches existing service patterns.

### UI Boundary

Add `apps/web/src/features/github-import/github-import-panel.tsx`.

The panel renders on `apps/web/src/app/workspaces/[slug]/projects/page.tsx` near the existing create-project card.

Behavior:

- admins and owners see an import form;
- members/viewers see explanatory copy that importing requires workspace admin access;
- local/demo environments can submit repository metadata directly;
- copy makes clear that this is the same payload a GitHub App installation flow will provide later.

The UI must not request or display GitHub access tokens.

### Server Action

Add `importGithubProjectAction(workspaceSlug, formData)` in `apps/web/src/app/actions.ts`.

Behavior:

- require an app session;
- call `importGithubProjectForUser`;
- revalidate the workspace project list;
- redirect to the imported project engineering page so the user immediately sees the repository setup and engineering signal surface.

### Error Handling

- Missing required repository fields return existing `WorkspaceError(400, ...)` messages from validation helpers.
- Non-admin import attempts return `403` with `only owners and admins can import GitHub projects.`
- Duplicate project key errors are allowed to surface as existing project creation failures.
- If project creation succeeds but repository connection fails, the service deletes the created project and rethrows the original connection error.

## Testing Strategy

Use TDD.

Required tests:

- importing a repository as an admin creates a project and connects it to GitHub;
- members cannot import GitHub projects;
- a duplicate repository connection rolls back the newly-created project;
- the import panel renders an admin form without token fields;
- the import panel renders a non-admin setup state.

Verification commands:

```bash
node --import tsx --test tests/phase11-github-import.test.mjs
npm test --workspace @the-platform/web -- src/features/github-import/__tests__/github-import-panel.test.tsx
npm test
npm run lint
npm run typecheck
npm run build
```

## Success Criteria

- Workspace admins can start a project from selected GitHub repository metadata.
- Imported projects have a primary GitHub repository connection immediately after creation.
- Failed connection attempts do not leave orphan projects.
- The workspace projects page introduces a visible GitHub import path.
- No browser surface asks for or receives GitHub access tokens.

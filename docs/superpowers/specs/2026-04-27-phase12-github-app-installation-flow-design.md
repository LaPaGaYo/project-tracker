# Phase 12 GitHub App Installation Flow Design

## Goal

Replace the manual GitHub repository metadata import form with a GitHub App installation flow that lets workspace admins install the app, select an installed repository, and import it as a connected project without exposing GitHub tokens to the browser.

## Current Baseline

- Phase 6 added GitHub repository records, project connections, webhook ingestion, and local engineering read models.
- Phase 9 added worker-side GitHub App installation token minting from server-side app credentials.
- Phase 10 added the GitHub-first auth entry point.
- Phase 11 added `importGithubProjectForUser`, which creates a project from repository metadata and connects that project to GitHub in one rollback-safe service.
- The workspace projects page still asks admins to type repository owner, repository id, default branch, and installation id manually.

## Product Decision

Phase 12 should turn Phase 11's metadata boundary into a real product onboarding path, but it should not attempt to finish the entire GitHub identity model.

The user-facing flow is:

1. A workspace admin clicks "Install GitHub App" from the workspace projects page.
2. GitHub opens the app installation URL and lets the admin choose account/repositories.
3. GitHub redirects back to the product setup URL with `installation_id` and the original workspace state.
4. The product shows repositories available to that installation.
5. The admin selects one repository and imports it.
6. The server validates the selected repository by fetching repository metadata from GitHub using server-side GitHub App credentials.
7. The existing Phase 11 import service creates the project and connects the repository.

The browser never receives a GitHub access token and never submits authoritative repository metadata. Hidden form values may carry `installationId` and `providerRepositoryId`, but owner/name/default branch must be resolved server-side from GitHub before import.

## Scope

This phase includes:

- a GitHub App install URL builder using `GITHUB_APP_SLUG`;
- a setup redirect route that receives GitHub's `installation_id` and returns the user to the workspace projects page;
- a server-side GitHub App installation client for listing installation repositories;
- a selected-repository import service that verifies the repository belongs to the installation before calling `importGithubProjectForUser`;
- a repository picker UI on the workspace projects page;
- setup/error/empty states for missing app config, missing installation id, no repositories, fetch failures, and non-admin users;
- focused tests for URL building, installation repository listing, selected repository import, UI states, and server action behavior;
- `.env.example` documentation for the new app slug and setup URL base.

This phase does not include:

- GitHub App registration automation;
- GitHub Marketplace purchase handling;
- storing GitHub installation access tokens in Postgres;
- user-scoped GitHub OAuth token storage;
- verifying the installing GitHub user through a GitHub App user access token;
- importing GitHub issues into work items;
- connecting more than one primary repository to a project;
- multi-provider source control support.

## Security Boundary

GitHub's setup URL sends an `installation_id` query parameter after installation. That parameter is not trusted as proof of user identity or authorization. Phase 12 treats it only as a candidate installation id.

Before importing a project, the server must:

- require an authenticated product session;
- require owner/admin role in the target workspace;
- use server-side GitHub App credentials to mint an installation token for the candidate installation;
- list repositories available to that installation;
- find the selected `providerRepositoryId` in that server-fetched list;
- pass only the server-fetched repository metadata into `importGithubProjectForUser`.

This proves the app installation exists and has access to the selected repository. It does not prove the current product user is the GitHub user who installed the app. That verification requires a later GitHub App user authorization flow. The product risk is bounded in this phase because only workspace admins can attach repositories, tokens stay server-side, and the selected repository must be readable by this app installation.

## Architecture

### Configuration

Add these environment variables:

- `GITHUB_APP_SLUG`: GitHub App slug used to build `https://github.com/apps/{slug}/installations/new`.
- `APP_BASE_URL`: public product origin used when documenting the GitHub App setup URL, for example `http://localhost:3000` locally or production origin in deploys.

Existing variables remain:

- `GITHUB_APP_ID`
- `GITHUB_APP_PRIVATE_KEY`
- `GITHUB_APP_PRIVATE_KEY_BASE64`
- `GITHUB_API_URL`

### Server GitHub App Client

Add `apps/web/src/server/github/app-installation.ts`.

Responsibilities:

- normalize app install and API base URLs;
- build the install URL with a `state` value that preserves the workspace slug;
- normalize private keys from plain PEM or base64 input;
- generate a short-lived app JWT;
- exchange the app JWT for an installation token with `POST /app/installations/{installation_id}/access_tokens`;
- list repositories with `GET /installation/repositories`;
- map GitHub repository payloads into internal repository selection metadata.

Returned repository metadata should include:

- `providerRepositoryId`
- `owner`
- `name`
- `fullName`
- `defaultBranch`
- `htmlUrl`
- `isPrivate`

The token response itself must not be returned to UI code, persisted, or logged.

### Selected Repository Import Service

Add `apps/web/src/server/github/installation-import.ts`.

Responsibilities:

- require workspace admin access before any external GitHub request;
- validate `installationId` and `providerRepositoryId`;
- call the installation client to list repositories;
- fail with `404` if the selected provider repository id is not available from that installation;
- call `importGithubProjectForUser` with server-resolved repository metadata and optional project/environment fields.

The service should accept dependencies explicitly:

- `projectRepository`
- `githubRepository`
- `installationClient`

This keeps service tests isolated from live GitHub and matches existing service patterns.

### Setup Route

Add `apps/web/src/app/github/setup/page.tsx`.

Behavior:

- require an app session;
- read `installation_id`, `setup_action`, and `state`;
- treat `state` as the workspace slug, after strict slug normalization;
- redirect to `/workspaces/{slug}/projects?githubInstallationId={installation_id}&githubSetupAction={setup_action}`;
- redirect to `/` when state is missing or invalid.

The setup route does not import anything. It only carries the candidate installation id back to the workspace UI.

### Workspace Projects UI

Update `GithubImportPanel`.

Admin states:

- if `GITHUB_APP_SLUG` is configured and no installation id is active, show an "Install GitHub App" CTA;
- if installation id is active and repositories loaded, show a repository picker plus optional project name/key and environment fields;
- if repository fetch fails, show a clear setup error and keep the install/update CTA visible;
- if no repositories are returned, show an empty state explaining that the installation has no selected repositories;
- if app slug or app credentials are missing, show a setup state that names the missing configuration category.

Non-admin state:

- show read-only copy that workspace admin access is required to install or import GitHub repositories;
- do not render install or import actions.

The manual owner/name/repository-id/default-branch/installation-id fields should no longer be the primary product UI.

### Server Action

Add `importInstalledGithubRepositoryAction(workspaceSlug, installationId, formData)` in `apps/web/src/app/actions.ts`.

Behavior:

- require an app session;
- call `importGithubInstallationRepositoryForUser`;
- revalidate the workspace projects page;
- redirect to the imported project engineering page.

Keep the Phase 11 `importGithubProjectAction` only if tests or local developer flows still require it, but the workspace projects page should use the installed-repository action.

## Error Handling

- Missing `GITHUB_APP_SLUG` returns a UI setup state, not a thrown page error.
- Missing app credentials while an installation id is active returns an actionable UI error.
- Invalid or absent `installation_id` from the setup route redirects back to the workspace projects page without repository selection.
- GitHub token exchange or repository listing failures should be shown as setup errors without exposing response bodies or token-like values.
- Non-admin import attempts return `403` with an admin-only message before GitHub is called.
- A selected repository id that is not present in the server-fetched installation repository list returns `404`.
- Existing duplicate project/repository errors continue to surface through `importGithubProjectForUser`.

## Testing Strategy

Use TDD.

Required tests:

- install URL builder produces a GitHub App install URL with encoded workspace state;
- private key normalization accepts escaped PEM and base64 PEM;
- installation repository client mints a token and lists repositories without exposing the token;
- selected-repository import creates a connected project from server-fetched repository metadata;
- selected-repository import rejects non-admin users before calling GitHub;
- selected-repository import rejects repository ids not present in the installation repository list;
- setup redirect helper returns the workspace projects URL for valid GitHub setup params and `/` for invalid state;
- import panel renders install CTA when no installation is active;
- import panel renders repository picker when installation repositories are present;
- import panel does not render manual owner/name/repository id/default branch/installation id fields in the primary flow;
- import panel renders missing-config, empty, error, and non-admin states.

Verification commands:

```bash
node --import tsx --test tests/phase12-github-installation-import.test.mjs
npm test --workspace @the-platform/web -- src/features/github-import/__tests__/github-import-panel.test.tsx
npm test --workspace @the-platform/web -- src/app/actions.test.ts
npm test
npm run lint
npm run typecheck
npm run build
```

## Success Criteria

- Workspace admins can start GitHub App installation from the projects page.
- GitHub setup callback returns admins to the correct workspace with an active installation id.
- The projects page can show server-fetched installation repositories.
- Admins can import a selected installed repository without typing repository metadata manually.
- Imported projects still land on the engineering page with a primary GitHub repository connection.
- The browser never receives or submits GitHub access tokens.
- The primary UI no longer asks for raw repository owner/name/id/default branch/installation id.

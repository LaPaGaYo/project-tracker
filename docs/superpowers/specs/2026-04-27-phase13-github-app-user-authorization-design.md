# Phase 13 GitHub App User Authorization Design

## Goal

Close the Phase 12 authorization gap by proving that the current product user has GitHub access to the selected GitHub App installation before the product lists repositories or imports one into a workspace.

## Current Baseline

- Phase 9 added server-side GitHub App installation token minting from app credentials.
- Phase 11 added rollback-safe GitHub repository import and project connection creation.
- Phase 12 added the GitHub App installation setup URL, installation repository listing, repository picker UI, and selected-repository import.
- Phase 12 intentionally treats GitHub's `installation_id` as a candidate only. The server validates that the app installation exists and has the selected repository, but it does not yet prove the current product user is a GitHub user who can access that installation.

## Product Decision

Phase 13 should add a GitHub App user authorization step to the repository import setup path. This is not the same as replacing product login. The product session remains Clerk/demo auth; GitHub authorization is a linked integration proof used for importing repositories.

The user-facing flow is:

1. A workspace owner/admin clicks "Install GitHub App" from the workspace projects page.
2. GitHub completes or updates the app installation and redirects to `/github/setup` with `installation_id`, `setup_action`, and `state`.
3. The product redirects the admin into GitHub App user authorization for the same workspace and installation.
4. GitHub redirects back with a short-lived authorization `code` and the original state.
5. The server exchanges the code for a GitHub App user access token.
6. The server uses that user access token to list installations and repositories accessible to the GitHub user.
7. If the selected installation is accessible to that GitHub user, the server stores a short-lived signed authorization proof and redirects back to the workspace projects page.
8. The projects page lists only repositories that are available to both the app installation and the authorized GitHub user.
9. Import requires the workspace owner/admin role, the signed user authorization proof, and server-fetched repository metadata.

The GitHub user access token is used only during the callback to verify access. It is not persisted, not returned to the browser, and not used by background workers.

## Scope

This phase includes:

- a GitHub App user authorization URL builder using `GITHUB_APP_CLIENT_ID`;
- signed OAuth state with workspace slug, candidate installation id, nonce, and return path;
- PKCE support for the GitHub App user authorization flow;
- a callback route that exchanges `code` for a GitHub App user access token;
- a server GitHub user authorization client for `GET /user`, `GET /user/installations`, and `GET /user/installations/{installation_id}/repositories`;
- a short-lived signed authorization proof stored in an HTTP-only cookie;
- workspace projects page logic that requires the proof before repository listing;
- import service logic that rejects installation imports when the proof is missing, expired, or does not cover the selected installation/repository;
- UI states for "authorize GitHub access", "authorization expired", "authorization failed", and "authorized as GitHub user";
- `.env.example` documentation for GitHub App OAuth client credentials and state-signing secret;
- focused tests for state signing, PKCE, callback verification, UI states, and import authorization.

This phase does not include:

- replacing Clerk/demo product login with GitHub login;
- persistent GitHub account linking in Postgres;
- storing GitHub user access tokens or refresh tokens;
- refreshing GitHub user access tokens;
- GitHub App authorization revocation webhook handling;
- organization-wide team mapping between GitHub teams and product workspace roles;
- GitHub Marketplace purchase handling;
- importing GitHub issues into work items.

## External Contracts

GitHub App user authorization uses GitHub's web application flow:

- the user is sent to `https://github.com/login/oauth/authorize` with `client_id`, `redirect_uri`, `state`, and PKCE parameters;
- GitHub redirects back with `code` and `state`;
- the server exchanges the code at `https://github.com/login/oauth/access_token` with the app client id, app client secret, redirect URI, and PKCE verifier;
- the resulting user access token can call GitHub APIs on behalf of the user.

GitHub's user access token permissions are the intersection of the app's access and the user's access. The token can be used to check which installations and repositories the user can access with `GET /user/installations` and `GET /user/installations/{installation_id}/repositories`.

References:

- https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app
- https://docs.github.com/en/apps/creating-github-apps/writing-code-for-a-github-app/building-a-login-with-github-button-with-a-github-app
- https://docs.github.com/en/rest/apps/installations?apiVersion=2022-11-28
- https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/about-the-setup-url

## Security Boundary

The `installation_id` from GitHub setup is still a candidate. It becomes usable only after all checks pass:

- the product session exists;
- the product user is owner/admin in the workspace;
- OAuth callback state is valid, unexpired, and bound to the same workspace and installation id;
- PKCE verifier matches the authorization request;
- GitHub code exchange succeeds;
- the GitHub user access token can see the candidate installation through `GET /user/installations`;
- the GitHub user access token can see the selected repository through `GET /user/installations/{installation_id}/repositories`;
- the server-fetched repository id matches the repository id submitted by the form.

The signed proof is not a GitHub token. It contains only:

- product user id;
- workspace slug;
- GitHub user id and login;
- installation id;
- allowed repository ids;
- issued-at timestamp;
- expiration timestamp;
- nonce.

The proof expires quickly, with a target lifetime of 15 minutes. Expiry keeps this phase from needing refresh token lifecycle management while still supporting the immediate repository import flow.

## Architecture

### Configuration

Add these environment variables:

- `GITHUB_APP_CLIENT_ID`: GitHub App OAuth client id. This is different from `GITHUB_APP_ID`.
- `GITHUB_APP_CLIENT_SECRET`: GitHub App OAuth client secret. Server-only.
- `GITHUB_USER_AUTH_STATE_SECRET`: HMAC secret for signing OAuth state and authorization proof cookies.
- `GITHUB_BASE_URL`: optional GitHub web origin override, defaulting to `https://github.com`.

Existing variables remain:

- `APP_BASE_URL`
- `GITHUB_APP_SLUG`
- `GITHUB_APP_ID`
- `GITHUB_APP_PRIVATE_KEY`
- `GITHUB_APP_PRIVATE_KEY_BASE64`
- `GITHUB_API_URL`

The configured GitHub App callback URL should be:

```text
{APP_BASE_URL}/github/authorize/callback
```

### OAuth State And Proof

Add `apps/web/src/server/github/user-authorization-state.ts`.

Responsibilities:

- create random nonces and PKCE verifiers;
- hash PKCE verifiers into S256 code challenges;
- sign and verify URL-safe state payloads with HMAC SHA-256;
- sign and verify short-lived authorization proofs;
- reject malformed, expired, wrong-user, wrong-workspace, and wrong-installation payloads;
- serialize proof data without token-like values.

The OAuth state payload should include:

- `workspaceSlug`
- `installationId`
- `returnPath`
- `nonce`
- `issuedAt`
- `expiresAt`

The proof payload should include:

- `productUserId`
- `workspaceSlug`
- `githubUserId`
- `githubLogin`
- `installationId`
- `allowedProviderRepositoryIds`
- `issuedAt`
- `expiresAt`
- `nonce`

### GitHub User Authorization Client

Add `apps/web/src/server/github/user-authorization.ts`.

Responsibilities:

- build the GitHub App user authorization URL;
- exchange the OAuth code for a user access token;
- fetch the GitHub user profile with `GET /user`;
- list installations accessible to the user with `GET /user/installations`;
- list repositories accessible to the user for an installation with `GET /user/installations/{installation_id}/repositories`;
- map GitHub repository payloads into the same internal repository metadata shape used by Phase 12.

The client must not expose response bodies that may contain tokens in thrown error messages. Errors should name the failed step and status code only.

### Routes

Update `apps/web/src/app/github/setup/page.tsx`.

Behavior:

- require a product session;
- read `installation_id`, `setup_action`, and `state`;
- validate `state` as a workspace slug;
- redirect to `/github/authorize?workspaceSlug={slug}&githubInstallationId={installation_id}&githubSetupAction={setup_action}` when an installation id exists;
- redirect to the workspace projects page without repository selection when installation id is absent.

Add `apps/web/src/app/github/authorize/page.tsx`.

Behavior:

- require a product session;
- require workspace owner/admin role before leaving for GitHub;
- validate the workspace slug and installation id;
- create signed OAuth state and PKCE verifier;
- store the PKCE verifier in an HTTP-only, same-site cookie scoped to the callback path, with `secure` enabled outside local HTTP development;
- redirect to GitHub's `/login/oauth/authorize`.

Add `apps/web/src/app/github/authorize/callback/page.tsx`.

Behavior:

- require a product session;
- verify `state`;
- read and clear the PKCE verifier cookie;
- exchange `code` for a user access token;
- fetch the GitHub user profile;
- fetch user-accessible installations and require the candidate installation id;
- fetch user-accessible repositories for that installation;
- store the signed authorization proof cookie;
- redirect to the workspace projects page with `githubInstallationId` and `githubAuthorized=1`;
- on failure, redirect to the workspace projects page with `githubAuthorizationError` set to one of `state_invalid`, `state_expired`, `pkce_missing`, `token_exchange_failed`, `installation_inaccessible`, or `repositories_inaccessible`.

### Workspace Projects Page

Update `apps/web/src/app/workspaces/[slug]/projects/page.tsx`.

Behavior:

- build the install/update URL as Phase 12 does;
- when `githubInstallationId` is present, verify the signed proof for the current product user, workspace, and installation;
- list repositories only when the proof is valid;
- intersect repository ids from the proof with repositories fetched by the app installation client before passing them to UI;
- pass GitHub authorization state into `GithubImportPanel`.

If proof is missing or expired, the page should not call the installation repository client. It should show an authorization CTA instead.

### Import Service

Update `apps/web/src/server/github/installation-import.ts`.

Behavior:

- keep the existing owner/admin check before any GitHub call;
- require a verified authorization proof dependency before listing installation repositories;
- reject with `403` when the proof is missing, expired, wrong-user, wrong-workspace, or wrong-installation;
- list installation repositories with the app installation client;
- require the selected repository id to be both in the app installation repository list and in the proof's allowed repository ids;
- pass only server-resolved repository metadata into `importGithubProjectForUser`.

### Server Action

Update `importInstalledGithubRepositoryAction` in `apps/web/src/app/actions.ts`.

Behavior:

- require an app session;
- read and verify the GitHub authorization proof cookie;
- pass the proof into `importGithubInstallationRepositoryForUser`;
- revalidate the workspace projects page;
- redirect to the imported project engineering page.

### UI

Update `GithubImportPanel`.

New states:

- no installation id: show "Install GitHub App";
- installation id without proof: show "Authorize GitHub access";
- expired proof: show "Re-authorize GitHub access";
- authorization failure query param: show safe failure copy and retry CTA;
- valid proof and repositories present: show repository picker plus "Authorized as {githubLogin}";
- valid proof and no repositories: show empty state that the GitHub user and app installation share no repositories;
- non-admin: show read-only admin-required state.

The panel should keep the Phase 12 rule that manual repository metadata is not a primary flow.

## Error Handling

- Missing `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`, or `GITHUB_USER_AUTH_STATE_SECRET` renders setup guidance instead of throwing a page error.
- Invalid GitHub setup state redirects to `/`.
- Missing installation id redirects to the workspace projects page without repository selection.
- OAuth state mismatch, expired state, missing PKCE verifier, failed token exchange, inaccessible installation, and inaccessible repository redirects use only these query codes: `state_invalid`, `state_expired`, `pkce_missing`, `token_exchange_failed`, `installation_inaccessible`, `repositories_inaccessible`.
- Import attempts without a valid proof return `403` before any GitHub installation token is minted.
- Safe UI messages must not include OAuth codes, access tokens, refresh tokens, PKCE verifiers, full response bodies, or HMAC signatures.

## Testing Strategy

Use TDD.

Required tests:

- OAuth URL builder includes client id, redirect URI, signed state, S256 code challenge, and `code_challenge_method=S256`;
- state verifier rejects tampered, expired, wrong-user, wrong-workspace, and wrong-installation payloads;
- proof verifier accepts valid proof and rejects expired/wrong-user/wrong-workspace/wrong-installation payloads;
- token exchange calls GitHub's access token endpoint with client id, client secret, code, redirect URI, and PKCE verifier;
- user authorization client lists user installations and installation repositories with the user access token;
- setup redirect sends candidate installations to the authorization route;
- callback helper creates a proof only when the GitHub user can access the installation and repositories;
- projects page helper refuses to list installation repositories without proof;
- selected-repository import rejects missing proof before GitHub is called;
- selected-repository import rejects repository ids not included in the proof;
- selected-repository import succeeds when workspace role, proof, installation repository list, and selected repository all match;
- import panel renders authorize, re-authorize, authorized, empty, error, and non-admin states.

Verification commands:

```bash
node --import tsx --test tests/phase13-github-user-authorization.test.mjs
node --import tsx --test tests/phase12-github-installation-import.test.mjs
npm test --workspace @the-platform/web -- src/features/github-import/__tests__/github-import-panel.test.tsx
npm test --workspace @the-platform/web -- src/app/actions.test.ts
npm test
npm run lint
npm run typecheck
npm run build
```

## Success Criteria

- A workspace owner/admin cannot list or import repositories for a GitHub App installation until they authorize the GitHub App as a GitHub user.
- The product verifies that the GitHub user can access the candidate installation and selected repository.
- The browser never receives GitHub user access tokens, refresh tokens, app installation tokens, PKCE verifiers, or HMAC secrets.
- GitHub user access tokens are not persisted.
- The authorization proof expires quickly and is bound to the product user, workspace, installation, and allowed repository ids.
- Repository import remains server-authoritative and still redirects to the imported project's engineering page.

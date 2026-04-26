# Phase 9 GitHub App Worker Auth Design

## Goal

Make worker-side GitHub reconciliation safe for team and production use by replacing shared personal tokens with server-side GitHub App installation token minting.

## Current Baseline

- Phase 6 already chose a `GitHub App + webhook ingestion + local read model` architecture.
- `github_repositories.installation_id` is already stored and serialized into worker reconciliation targets.
- `apps/worker/src/github-client.ts` currently accepts only a static `GITHUB_TOKEN` or `GITHUB_APP_INSTALLATION_TOKEN`.
- Static tokens unblock local development, but they are not acceptable as the product-level team integration model.

## Product Decision

Use GitHub App installation tokens for production worker reconciliation.

This keeps repo access attached to the workspace-installed GitHub App instead of any individual teammate. Users still log into the product through the product auth system; GitHub account linking can later map GitHub identities to product users, but background reconciliation should not depend on personal user tokens.

## Scope

This task includes:

- a worker token provider that can mint GitHub App installation access tokens from server-side app credentials
- per-installation in-memory token caching until shortly before expiry
- compatibility with existing static token fallback for local development
- worker/client wiring so repository reconciliation resolves credentials from each target repository installation
- focused tests for token minting, caching, fallback, and missing-credential failures
- environment documentation for local development and production-like worker runs

This task does not include:

- GitHub App installation or authorization UI
- GitHub App registration automation
- storing installation access tokens in Postgres
- user-to-GitHub OAuth linking
- changing webhook verification or event ingestion behavior
- multi-provider source control integrations

## Recommended Architecture

Add a focused worker auth unit, `apps/worker/src/github-app-auth.ts`, responsible for:

- normalizing GitHub App private key input from environment
- generating short-lived app JWTs with `RS256`
- exchanging the JWT for an installation access token through `POST /app/installations/{installation_id}/access_tokens`
- caching token responses per `installationId` until a safety window before `expires_at`

Keep `apps/worker/src/github-client.ts` responsible for GitHub REST reads only. The client should depend on a small `GithubTokenProvider` interface:

```ts
export interface GithubTokenProvider {
  getToken(target: GithubClientTarget): Promise<string>;
}
```

`GithubClientTarget` already includes `installationId` through `GithubReconcileTarget`, so reconciliation can pass the same target object without new database columns.

## Credential Resolution

The worker should resolve credentials in this order:

1. Explicit test/client option token, for unit tests and controlled fixtures.
2. `GITHUB_TOKEN`, for local developer PAT fallback.
3. `GITHUB_APP_INSTALLATION_TOKEN`, for manual one-off installation token fallback.
4. Dynamic GitHub App credentials from `GITHUB_APP_ID` plus private key.

Dynamic GitHub App credentials should support:

- `GITHUB_APP_ID`
- `GITHUB_APP_PRIVATE_KEY`
- `GITHUB_APP_PRIVATE_KEY_BASE64`

`GITHUB_APP_PRIVATE_KEY` should accept either real PEM newlines or escaped `\n` sequences. `GITHUB_APP_PRIVATE_KEY_BASE64` is useful for deployment systems that cannot safely store multiline secrets.

## Runtime Behavior

For each reconciled repository:

1. `runGithubReconciliationCycle` selects active repository targets as it does today.
2. `createGithubClient` calls `tokenProvider.getToken(target)` before making GitHub API requests.
3. The token provider uses `target.installationId` when dynamic GitHub App auth is active.
4. The provider reuses a cached token if it is still valid beyond the refresh safety window.
5. If the token is absent, expired, or near expiry, the provider generates a new app JWT and requests a fresh installation token.

The installation token must remain server-side only. It should never be persisted, returned to the browser, written to logs, or stored in project connection records.

## Failure Handling

- If no static token and no complete GitHub App credentials exist, keep a clear startup/runtime error: `GITHUB_TOKEN, GITHUB_APP_INSTALLATION_TOKEN, or GitHub App credentials are required for worker reconciliation.`
- If dynamic auth is active but a target lacks `installationId`, fail that reconciliation with an actionable message naming the repository full name.
- If GitHub returns a non-2xx token exchange response, include HTTP status and status text, but do not log token-like response data.
- If the private key is malformed, fail before attempting GitHub API calls.
- Existing notification repair mode remains independent and should not require GitHub credentials.

## Testing Strategy

Use TDD against worker unit tests before production code changes.

Required tests:

- static token provider returns `GITHUB_TOKEN` without requiring installation id
- static installation token fallback returns `GITHUB_APP_INSTALLATION_TOKEN`
- dynamic GitHub App provider posts to `/app/installations/{installationId}/access_tokens`
- dynamic provider includes a Bearer JWT and GitHub API headers
- dynamic provider caches a valid token for repeated calls with the same installation id
- dynamic provider refreshes when the cached token is inside the safety window
- dynamic provider rejects missing installation id with a repository-specific error
- `createGithubClient` can call GitHub with a token resolved from the provider

Verification commands:

```bash
npm test --workspace @the-platform/worker
npm run lint --workspace @the-platform/worker
npm run typecheck --workspace @the-platform/worker
npm test
```

## Success Criteria

- The root worker can run reconciliation without a personal PAT when GitHub App credentials are present.
- Local development still works with `GITHUB_TOKEN` for quick setup.
- No GitHub installation token is persisted to the database.
- Worker tests cover token minting and cache behavior.
- Environment examples make it clear that PATs are local fallback only, not the team integration model.

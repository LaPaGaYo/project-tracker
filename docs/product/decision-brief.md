# Decision Brief: The Platform V1

## Summary

Build a GitHub-native project execution platform for software teams. Next.js + Postgres + Clerk. Greenfield build using existing Vue prototype as design reference. Ship a product that can replace GitHub Projects + spreadsheets + Slack for a small engineering team's daily execution.

## Key Decisions

### 1. Greenfield Build (not brownfield)
**Decision:** New Next.js/React/Postgres codebase. Existing Vue 3 prototype serves as UX reference only.
**Why:** Framework mismatch (Vue vs React) makes code reuse impractical. Patterns and data model shape carry forward, components do not.
**Trade-off:** Slower initial velocity vs. clean architecture from day one. Worth it for a product that needs multi-tenancy, auth, and real-time baked in from the start.

### 2. Clerk for Auth (not Auth0, not custom)
**Decision:** Clerk handles identity and sessions. Workspace membership, project roles, and authorization live in our database.
**Why:** Fastest path to working auth with Next.js. Good invite flows out of the box.
**Trade-off:** Clerk dependency for identity. Mitigated by auth abstraction layer from day one. Swap to Auth0 if enterprise SSO becomes a near-term requirement.

### 3. Medium-Depth GitHub Integration
**Decision:** One-way dominant sync from GitHub into the platform via GitHub App + webhooks. No bidirectional sync in V1.
**Why:** Deep write-back creates conflict resolution complexity that delays shipping. Medium depth (PR/commit/CI visibility, activity timelines) delivers the core differentiator without the risk.
**Trade-off:** Users cannot create GitHub issues from work items in V1. Acceptable because the product is the planning layer, GitHub is the execution layer.

### 4. SSE Before WebSockets
**Decision:** Server-sent events for real-time updates. WebSockets deferred.
**Why:** V1 real-time needs are server-to-client (board updates, GitHub events, notifications). SSE handles this with less infrastructure complexity.
**Trade-off:** No live presence or collaborative editing in V1. These features are not in V1 scope anyway.

### 5. Vercel + Separate Workers
**Decision:** Next.js app on Vercel. GitHub webhook processing and background jobs on separate worker infrastructure.
**Why:** Webhook processing must be durable, retryable, and decoupled from UI request lifecycles. Vercel Functions are not the right home for the core sync pipeline.
**Trade-off:** Two deployment targets instead of one. Worth it for reliability of the GitHub integration, which is the product's primary differentiator.

### 6. Application-Enforced Multi-Tenancy
**Decision:** Shared database, shared schema, workspace_id on every tenant-bound table. Application-layer enforcement, not Postgres RLS.
**Why:** Simpler to develop and debug. RLS can be added later for defense-in-depth without changing the application logic.
**Trade-off:** Tenant isolation depends on correct service-layer scoping. Mitigated by consistent patterns and testing.

### 7. Light Hierarchy for V1
**Decision:** Epic > Task/Story > Subtask > Bug. No Initiative or Portfolio layer.
**Why:** Full portfolio hierarchy adds schema complexity and UI surface without proving the core thesis. The V1 question is whether teams will use this for daily execution, not strategic planning.
**Trade-off:** PMs who want roadmap-level views will find V1 limited. Acceptable for proving the concept.

### 8. Postgres Search (not dedicated search engine)
**Decision:** Full-text search + structured filters + trigram/fuzzy for V1.
**Why:** Search is not a V1 differentiator. Postgres handles V1 volume. Dedicated search adds operational cost with no user-facing payoff yet.
**Trade-off:** Search UX will be "good enough" not "great." Revisit when scale or UX expectations justify Typesense/Meilisearch.

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| GitHub webhook reliability at scale | Medium | High | Durable queue between receiver and processor, dead letter queue, retry with backoff |
| Clerk vendor lock-in | Low | Medium | Auth abstraction layer from day one |
| Multi-tenancy bugs leaking data | Medium | Critical | Tenant scoping in base query layer, integration tests per endpoint |
| V1 scope creep beyond what's shippable | High | High | This document. Non-goals are explicit. Cut features, not quality. |
| Worker infrastructure complexity | Medium | Medium | Start simple (single worker process), scale horizontally when needed |

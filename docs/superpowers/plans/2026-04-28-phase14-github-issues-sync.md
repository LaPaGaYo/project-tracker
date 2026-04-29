# Phase 14 GitHub Issues Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the GitHub Issues sync foundation: import issues as work items, sync title/body/state bidirectionally under explicit settings, and render GitHub issue comments inbound in the work item timeline.

**Architecture:** Add issue-specific projection tables beside the existing GitHub PR/check/deploy projection, not inside `work_item_github_links` or local `comments`. Keep GitHub-owned fields guarded by sync baselines and conflicts; keep execution fields platform-owned. Use GitHub App installation tokens for import, reconcile, and outbound writes.

**Tech Stack:** Next.js App Router, React 19, Drizzle/Postgres, Node test runner for packages/worker/db, Vitest for web, GitHub REST API, GitHub webhooks.

---

## Source Spec

- Spec: `docs/superpowers/specs/2026-04-28-phase14-github-issues-sync-design.md`

## Execution Rules

- Work in `.worktrees/phase14-github-issues-sync-design` unless the implementation lead creates a new execution worktree from this branch.
- Do not touch `.nexus-worktrees/`.
- Preserve existing PR/check/deploy behavior.
- Do not persist GitHub user access tokens.
- Do not write platform comments to GitHub in Phase 14.
- Commit after each task.
- Prefer TDD: write focused failing tests before implementation in every code task.

## File Map

Create:

- `apps/web/src/server/github/issues/types.ts`: normalized issue, comment, sync status, conflict, and service DTOs.
- `apps/web/src/server/github/issues/parsers.ts`: pure payload normalization for REST and webhook issue/comment payloads.
- `apps/web/src/server/github/issues/repository.ts`: Drizzle repository for issues, links, comments, operations, and settings.
- `apps/web/src/server/github/issues/service.ts`: import, webhook projection, conflict detection, outbound sync orchestration.
- `apps/web/src/server/github/issues/service.test.ts`: service-level tests.
- `apps/web/src/server/github/issues/parsers.test.ts`: parser tests.
- `apps/web/src/app/api/workspaces/[slug]/projects/[key]/github/issues/import/route.ts`: admin import endpoint.
- `apps/web/src/app/api/workspaces/[slug]/projects/[key]/github/issues/settings/route.ts`: admin issue sync settings endpoint.
- `apps/worker/src/github-issues-client.ts`: GitHub REST issue/comment snapshot client.
- `apps/worker/src/github-issues-client.test.ts`: REST client tests.
- `apps/worker/src/github-issues-reconcile.ts`: worker-side issue/comment reconcile runner.
- `apps/worker/src/github-issues-reconcile.test.ts`: reconcile tests.

Modify:

- `packages/shared/src/constants.ts`: add issue sync enums and webhook names.
- `packages/shared/src/types.test.ts`: assert new shared types.
- `packages/db/src/schema.ts`: add tables/enums and exports.
- `packages/db/src/github-schema.test.ts`: assert new tables, enums, indexes.
- `packages/db/drizzle/*`: generated migration and metadata.
- `apps/web/src/server/github/webhooks.ts`: accept `issues` and `issue_comment`.
- `apps/web/src/server/github/service.ts`: route issue webhook payloads into the issue service.
- `apps/web/src/server/github/types.ts`: extend repository interfaces for issue webhook processing.
- `apps/web/src/server/api/detail-handlers.ts`: trigger outbound body sync after description edits.
- `apps/web/src/server/work-items/service.ts`: trigger outbound title/state sync after explicit user edits.
- `apps/web/src/server/work-items/types.ts`: add optional issue sync dependency.
- `apps/web/src/server/comments/types.ts`: extend timeline union with external GitHub comments.
- `apps/web/src/server/comments/service.ts`: merge external GitHub comments into work item timeline.
- `apps/web/src/app/workspaces/[slug]/projects/[key]/project-detail-content.tsx`: load sync status and timeline entries.
- `apps/web/src/components/timeline.tsx`: render GitHub comment entries.
- `apps/web/src/components/detail-panel.tsx`: render sync status, conflict, paused, and error states.
- `apps/web/src/features/board/__tests__/issue-detail.test.tsx`: UI coverage for sync and external comments.
- `apps/web/src/features/github-import/github-import-panel.tsx`: expose issue import/settings actions after repo connection.
- `apps/web/src/features/github-import/__tests__/github-import-panel.test.tsx`: UI coverage for issue import/settings.
- `apps/worker/src/github-reconcile.ts`: include issue reconcile in cycle mode.
- `apps/worker/src/github-client.ts`: extract shared GitHub request helper only if needed by the issue client.
- `docs/product/idea-brief.md`: update product context.
- `docs/product/decision-brief.md`: update phase decision.
- `docs/product/prd.md`: update Phase 14 PRD.

---

### Task 1: Shared Contracts, Schema, And Migration

**Files:**

- Modify: `packages/shared/src/constants.ts`
- Modify: `packages/shared/src/types.test.ts`
- Modify: `packages/db/src/schema.ts`
- Modify: `packages/db/src/github-schema.test.ts`
- Generate: `packages/db/drizzle/*.sql`
- Generate: `packages/db/drizzle/meta/*.json`

- [ ] **Step 1: Write failing shared/db contract tests**

  In `packages/shared/src/types.test.ts`, import the new constants and type aliases expected by this phase:

  ```ts
  import {
    githubIssueStates,
    githubIssueSyncOperationStatuses,
    githubIssueSyncOperationTypes,
    githubIssueSyncStatuses,
    githubWebhookEventNames,
    type GithubIssueState,
    type GithubIssueSyncOperationStatus,
    type GithubIssueSyncOperationType,
    type GithubIssueSyncStatus,
  } from "./constants";
  ```

  Add assertions:

  ```ts
  type Expect<T extends true> = T;
  type Equal<A, B> =
    (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
      ? true
      : false;

  type _GithubIssueState = Expect<
    Equal<(typeof githubIssueStates)[number], GithubIssueState>
  >;
  type _GithubIssueSyncStatus = Expect<
    Equal<(typeof githubIssueSyncStatuses)[number], GithubIssueSyncStatus>
  >;
  type _GithubIssueSyncOperationStatus = Expect<
    Equal<
      (typeof githubIssueSyncOperationStatuses)[number],
      GithubIssueSyncOperationStatus
    >
  >;
  type _GithubIssueSyncOperationType = Expect<
    Equal<
      (typeof githubIssueSyncOperationTypes)[number],
      GithubIssueSyncOperationType
    >
  >;
  ```

  In `packages/db/src/github-schema.test.ts`, extend the enum test:

  ```ts
  assert.deepEqual(githubIssueStateEnum.enumValues, githubIssueStates);
  assert.deepEqual(
    githubIssueSyncStatusEnum.enumValues,
    githubIssueSyncStatuses
  );
  assert.deepEqual(
    githubIssueSyncOperationStatusEnum.enumValues,
    githubIssueSyncOperationStatuses
  );
  assert.deepEqual(
    githubIssueSyncOperationTypeEnum.enumValues,
    githubIssueSyncOperationTypes
  );
  assert.deepEqual(
    githubWebhookEventNameEnum.enumValues,
    githubWebhookEventNames
  );
  ```

  Add new table names to the GitHub table assertion:

  ```ts
  ("github_issues",
    "work_item_github_issue_links",
    "github_issue_sync_operations",
    "github_issue_comments");
  ```

- [ ] **Step 2: Run tests to verify failure**

  Run:

  ```bash
  npm run test --workspace @the-platform/shared
  npm run test --workspace @the-platform/db
  ```

  Expected: shared test fails because constants/types do not exist; db test fails because enums/tables do not exist.

- [ ] **Step 3: Add shared constants**

  In `packages/shared/src/constants.ts`, add:

  ```ts
  export const githubIssueStates = [
    "open",
    "closed",
  ] as const satisfies readonly [string, ...string[]];

  export const githubIssueSyncStatuses = [
    "synced",
    "pending_outbound",
    "conflict",
    "error",
    "paused",
  ] as const satisfies readonly [string, ...string[]];

  export const githubIssueSyncOperationStatuses = [
    "pending",
    "succeeded",
    "failed",
  ] as const satisfies readonly [string, ...string[]];

  export const githubIssueSyncOperationTypes = [
    "update_issue",
  ] as const satisfies readonly [string, ...string[]];
  ```

  Extend `githubWebhookEventNames`:

  ```ts
  export const githubWebhookEventNames = [
    "pull_request",
    "check_run",
    "check_suite",
    "deployment",
    "deployment_status",
    "issues",
    "issue_comment",
  ] as const satisfies readonly [string, ...string[]];
  ```

  Add type aliases:

  ```ts
  export type GithubIssueState = (typeof githubIssueStates)[number];
  export type GithubIssueSyncStatus = (typeof githubIssueSyncStatuses)[number];
  export type GithubIssueSyncOperationStatus =
    (typeof githubIssueSyncOperationStatuses)[number];
  export type GithubIssueSyncOperationType =
    (typeof githubIssueSyncOperationTypes)[number];
  ```

- [ ] **Step 4: Add Drizzle schema**

  In `packages/db/src/schema.ts`, import new constants and define enums:

  ```ts
  export const githubIssueStateEnum = pgEnum(
    "github_issue_state",
    githubIssueStates
  );
  export const githubIssueSyncStatusEnum = pgEnum(
    "github_issue_sync_status",
    githubIssueSyncStatuses
  );
  export const githubIssueSyncOperationStatusEnum = pgEnum(
    "github_issue_sync_operation_status",
    githubIssueSyncOperationStatuses
  );
  export const githubIssueSyncOperationTypeEnum = pgEnum(
    "github_issue_sync_operation_type",
    githubIssueSyncOperationTypes
  );
  ```

  Add tables after `githubPullRequests`:

  ```ts
  export const githubIssues = pgTable(
    "github_issues",
    {
      id: uuid("id").defaultRandom().primaryKey(),
      repositoryId: uuid("repository_id")
        .notNull()
        .references(() => githubRepositories.id, { onDelete: "cascade" }),
      providerIssueId: varchar("provider_issue_id", { length: 255 }).notNull(),
      number: integer("number").notNull(),
      title: varchar("title", { length: 300 }).notNull(),
      body: text("body"),
      url: text("url").notNull(),
      state: githubIssueStateEnum("state").notNull().default("open"),
      authorLogin: varchar("author_login", { length: 255 }),
      githubCreatedAt: timestamp("github_created_at", {
        withTimezone: true,
      }).notNull(),
      githubUpdatedAt: timestamp("github_updated_at", {
        withTimezone: true,
      }).notNull(),
      githubClosedAt: timestamp("github_closed_at", { withTimezone: true }),
      lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
      createdAt: timestamp("created_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
    },
    (table) => ({
      repositoryStateUpdatedIndex: index(
        "github_issues_repository_state_updated_idx"
      ).on(table.repositoryId, table.state, table.githubUpdatedAt),
      repositoryNumberUnique: uniqueIndex(
        "github_issues_repository_number_unique"
      ).on(table.repositoryId, table.number),
      repositoryProviderIssueUnique: uniqueIndex(
        "github_issues_repository_provider_issue_unique"
      ).on(table.repositoryId, table.providerIssueId),
    })
  );
  ```

  Add the link, operation, and comment tables:

  ```ts
  export const workItemGithubIssueLinks = pgTable(
    "work_item_github_issue_links",
    {
      id: uuid("id").defaultRandom().primaryKey(),
      workItemId: uuid("work_item_id")
        .notNull()
        .references(() => tasks.id, { onDelete: "cascade" }),
      repositoryId: uuid("repository_id")
        .notNull()
        .references(() => githubRepositories.id, { onDelete: "cascade" }),
      githubIssueId: uuid("github_issue_id")
        .notNull()
        .references(() => githubIssues.id, { onDelete: "cascade" }),
      source: varchar("source", { length: 40 })
        .notNull()
        .default("initial_import"),
      syncStatus: githubIssueSyncStatusEnum("sync_status")
        .notNull()
        .default("synced"),
      syncEnabled: boolean("sync_enabled").notNull().default(true),
      syncTitle: boolean("sync_title").notNull().default(true),
      syncBody: boolean("sync_body").notNull().default(true),
      syncState: boolean("sync_state").notNull().default(true),
      lastSyncedGithubUpdatedAt: timestamp("last_synced_github_updated_at", {
        withTimezone: true,
      }),
      lastSyncedWorkItemUpdatedAt: timestamp(
        "last_synced_work_item_updated_at",
        { withTimezone: true }
      ),
      lastSyncedTitleHash: varchar("last_synced_title_hash", { length: 64 }),
      lastSyncedBodyHash: varchar("last_synced_body_hash", { length: 64 }),
      lastSyncedState: githubIssueStateEnum("last_synced_state"),
      conflictFields: text("conflict_fields").array(),
      errorMessage: text("error_message"),
      createdAt: timestamp("created_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
    },
    (table) => ({
      repositoryStatusIndex: index(
        "work_item_github_issue_links_repository_status_idx"
      ).on(table.repositoryId, table.syncStatus),
      workItemUnique: uniqueIndex(
        "work_item_github_issue_links_work_item_unique"
      ).on(table.workItemId),
      githubIssueUnique: uniqueIndex(
        "work_item_github_issue_links_github_issue_unique"
      ).on(table.githubIssueId),
    })
  );

  export const githubIssueSyncOperations = pgTable(
    "github_issue_sync_operations",
    {
      id: uuid("id").defaultRandom().primaryKey(),
      linkId: uuid("link_id")
        .notNull()
        .references(() => workItemGithubIssueLinks.id, { onDelete: "cascade" }),
      operationKey: varchar("operation_key", { length: 255 }).notNull(),
      operationType: githubIssueSyncOperationTypeEnum("operation_type")
        .notNull()
        .default("update_issue"),
      status: githubIssueSyncOperationStatusEnum("status")
        .notNull()
        .default("pending"),
      requestedBy: varchar("requested_by", { length: 255 }).notNull(),
      requestedAt: timestamp("requested_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
      completedAt: timestamp("completed_at", { withTimezone: true }),
      githubUpdatedAtBefore: timestamp("github_updated_at_before", {
        withTimezone: true,
      }),
      targetFields: jsonb("target_fields")
        .$type<Record<string, unknown>>()
        .notNull(),
      errorMessage: text("error_message"),
    },
    (table) => ({
      linkStatusRequestedIndex: index(
        "github_issue_sync_operations_link_status_requested_idx"
      ).on(table.linkId, table.status, table.requestedAt),
      operationKeyUnique: uniqueIndex(
        "github_issue_sync_operations_operation_key_unique"
      ).on(table.operationKey),
    })
  );

  export const githubIssueComments = pgTable(
    "github_issue_comments",
    {
      id: uuid("id").defaultRandom().primaryKey(),
      githubIssueId: uuid("github_issue_id")
        .notNull()
        .references(() => githubIssues.id, { onDelete: "cascade" }),
      providerCommentId: varchar("provider_comment_id", {
        length: 255,
      }).notNull(),
      body: text("body").notNull(),
      url: text("url").notNull(),
      authorLogin: varchar("author_login", { length: 255 }),
      githubCreatedAt: timestamp("github_created_at", {
        withTimezone: true,
      }).notNull(),
      githubUpdatedAt: timestamp("github_updated_at", {
        withTimezone: true,
      }).notNull(),
      githubDeletedAt: timestamp("github_deleted_at", { withTimezone: true }),
      lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
      createdAt: timestamp("created_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
    },
    (table) => ({
      issueCreatedIndex: index("github_issue_comments_issue_created_idx").on(
        table.githubIssueId,
        table.githubCreatedAt
      ),
      issueProviderCommentUnique: uniqueIndex(
        "github_issue_comments_issue_provider_comment_unique"
      ).on(table.githubIssueId, table.providerCommentId),
    })
  );
  ```

- [ ] **Step 5: Generate migration**

  Run:

  ```bash
  npm run db:generate --workspace @the-platform/db
  ```

  Expected: a new `packages/db/drizzle/0008_*.sql` and matching metadata snapshot are generated.

- [ ] **Step 6: Run focused tests**

  Run:

  ```bash
  npm run test --workspace @the-platform/shared
  npm run test --workspace @the-platform/db
  npm run typecheck --workspace @the-platform/db
  ```

  Expected: all pass.

- [ ] **Step 7: Commit**

  ```bash
  git add packages/shared/src/constants.ts packages/shared/src/types.test.ts packages/db/src/schema.ts packages/db/src/github-schema.test.ts packages/db/drizzle
  git commit -m "feat: add github issue sync schema"
  ```

---

### Task 2: GitHub Issue Parsers And REST Client

**Files:**

- Create: `apps/web/src/server/github/issues/types.ts`
- Create: `apps/web/src/server/github/issues/parsers.ts`
- Create: `apps/web/src/server/github/issues/parsers.test.ts`
- Create: `apps/worker/src/github-issues-client.ts`
- Create: `apps/worker/src/github-issues-client.test.ts`

- [ ] **Step 1: Write parser tests**

  In `apps/web/src/server/github/issues/parsers.test.ts`, cover:

  ```ts
  import { describe, expect, it } from "vitest";

  import {
    normalizeGithubIssuePayload,
    normalizeGithubIssueCommentPayload,
  } from "./parsers";

  describe("github issue parsers", () => {
    it("normalizes a GitHub issue payload", () => {
      const result = normalizeGithubIssuePayload(
        {
          id: 101,
          number: 7,
          title: "Sync issue title",
          body: "Issue body",
          html_url: "https://github.com/acme/platform/issues/7",
          state: "open",
          user: { login: "octocat" },
          created_at: "2026-04-27T10:00:00Z",
          updated_at: "2026-04-27T11:00:00Z",
          closed_at: null,
        },
        "2026-04-27T12:00:00.000Z"
      );

      expect(result).toEqual({
        providerIssueId: "101",
        number: 7,
        title: "Sync issue title",
        body: "Issue body",
        url: "https://github.com/acme/platform/issues/7",
        state: "open",
        authorLogin: "octocat",
        githubCreatedAt: "2026-04-27T10:00:00.000Z",
        githubUpdatedAt: "2026-04-27T11:00:00.000Z",
        githubClosedAt: null,
        isPullRequest: false,
      });
    });

    it("marks pull request issue payloads so import can skip them", () => {
      const result = normalizeGithubIssuePayload(
        {
          id: 102,
          number: 8,
          title: "PR",
          body: null,
          html_url: "https://github.com/acme/platform/pull/8",
          state: "open",
          pull_request: {
            url: "https://api.github.com/repos/acme/platform/pulls/8",
          },
          created_at: "2026-04-27T10:00:00Z",
          updated_at: "2026-04-27T10:00:00Z",
        },
        "2026-04-27T12:00:00.000Z"
      );

      expect(result?.isPullRequest).toBe(true);
    });

    it("normalizes an issue comment payload", () => {
      const result = normalizeGithubIssueCommentPayload(
        {
          id: 201,
          body: "Comment body",
          html_url:
            "https://github.com/acme/platform/issues/7#issuecomment-201",
          user: { login: "mona" },
          created_at: "2026-04-27T12:00:00Z",
          updated_at: "2026-04-27T12:30:00Z",
        },
        "2026-04-27T13:00:00.000Z"
      );

      expect(result).toEqual({
        providerCommentId: "201",
        body: "Comment body",
        url: "https://github.com/acme/platform/issues/7#issuecomment-201",
        authorLogin: "mona",
        githubCreatedAt: "2026-04-27T12:00:00.000Z",
        githubUpdatedAt: "2026-04-27T12:30:00.000Z",
      });
    });
  });
  ```

- [ ] **Step 2: Run parser tests to verify failure**

  Run:

  ```bash
  npm run test --workspace @the-platform/web -- apps/web/src/server/github/issues/parsers.test.ts
  ```

  Expected: fails because files do not exist.

- [ ] **Step 3: Implement parser types and parser functions**

  In `types.ts`, define:

  ```ts
  import type {
    GithubIssueState,
    GithubIssueSyncStatus,
  } from "@the-platform/shared";

  export interface NormalizedGithubIssue {
    providerIssueId: string;
    number: number;
    title: string;
    body: string | null;
    url: string;
    state: GithubIssueState;
    authorLogin: string | null;
    githubCreatedAt: string;
    githubUpdatedAt: string;
    githubClosedAt: string | null;
    isPullRequest: boolean;
  }

  export interface NormalizedGithubIssueComment {
    providerCommentId: string;
    body: string;
    url: string;
    authorLogin: string | null;
    githubCreatedAt: string;
    githubUpdatedAt: string;
  }

  export interface GithubIssueSyncView {
    status: GithubIssueSyncStatus;
    issueNumber: number;
    issueUrl: string;
    repositoryFullName: string;
    conflictFields: string[];
    errorMessage: string | null;
    syncEnabled: boolean;
  }
  ```

  In `parsers.ts`, implement strict record guards, number/string readers, ISO timestamp normalization, pull request detection via `pull_request`, and state normalization to `open` or `closed`.

- [ ] **Step 4: Write REST client tests**

  In `apps/worker/src/github-issues-client.test.ts`, test:
  - `GET /repos/{owner}/{repo}/issues?state=open&per_page=100` by default;
  - `state=all` when `includeClosed` is true;
  - pull request issue payloads are excluded from returned issues;
  - comments are fetched with `/repos/{owner}/{repo}/issues/{number}/comments?per_page=100`;
  - installation token provider is called with the target repository.

- [ ] **Step 5: Run REST client tests to verify failure**

  Run:

  ```bash
  npm run test --workspace @the-platform/worker -- src/github-issues-client.test.ts
  ```

  Expected: fails because client does not exist.

- [ ] **Step 6: Implement REST client**

  Create `apps/worker/src/github-issues-client.ts` with:

  ```ts
  export interface GithubIssueSnapshot {
    providerIssueId: string;
    number: number;
    title: string;
    body: string | null;
    url: string;
    state: "open" | "closed";
    authorLogin: string | null;
    githubCreatedAt: string;
    githubUpdatedAt: string;
    githubClosedAt: string | null;
    comments: GithubIssueCommentSnapshot[];
  }

  export interface GithubIssueCommentSnapshot {
    providerCommentId: string;
    body: string;
    url: string;
    authorLogin: string | null;
    githubCreatedAt: string;
    githubUpdatedAt: string;
  }

  export interface GithubIssuesClient {
    getRepositoryIssuesSnapshot(
      target: GithubClientTarget,
      options?: { includeClosed?: boolean }
    ): Promise<{ fetchedAt: string; issues: GithubIssueSnapshot[] }>;
    updateIssue(
      target: GithubClientTarget,
      issueNumber: number,
      input: { title?: string; body?: string; state?: "open" | "closed" }
    ): Promise<GithubIssueSnapshot>;
  }
  ```

  Use the existing `createGithubTokenProvider`, `GITHUB_API_URL`, `accept: application/vnd.github+json`, and `x-github-api-version` header pattern from `apps/worker/src/github-client.ts`.

- [ ] **Step 7: Run focused tests**

  Run:

  ```bash
  npm run test --workspace @the-platform/web -- apps/web/src/server/github/issues/parsers.test.ts
  npm run test --workspace @the-platform/worker -- src/github-issues-client.test.ts
  npm run typecheck --workspace @the-platform/worker
  ```

  Expected: all pass.

- [ ] **Step 8: Commit**

  ```bash
  git add apps/web/src/server/github/issues/types.ts apps/web/src/server/github/issues/parsers.ts apps/web/src/server/github/issues/parsers.test.ts apps/worker/src/github-issues-client.ts apps/worker/src/github-issues-client.test.ts
  git commit -m "feat: add github issues parser and client"
  ```

---

### Task 3: Issue Projection Repository And Import Service

**Files:**

- Create: `apps/web/src/server/github/issues/repository.ts`
- Create: `apps/web/src/server/github/issues/service.ts`
- Create: `apps/web/src/server/github/issues/service.test.ts`
- Modify: `apps/web/src/server/github/issues/types.ts`

- [ ] **Step 1: Write failing service tests for import**

  In `service.test.ts`, define an in-memory repository implementing the issue service repository interface. Cover:

  ```ts
  describe("importGithubIssuesForProject", () => {
    it("requires workspace admin role before import", async () => {
      await expect(
        importGithubIssuesForProject(
          repository,
          viewerSession,
          "acme",
          "OPS",
          client
        )
      ).rejects.toMatchObject({
        status: 403,
      });
    });

    it("imports non-PR GitHub issues as work items and links them", async () => {
      const summary = await importGithubIssuesForProject(
        repository,
        adminSession,
        "acme",
        "OPS",
        client
      );

      expect(summary).toEqual({
        created: 1,
        updated: 0,
        skippedPullRequests: 1,
        conflicted: 0,
        failed: 0,
      });
      expect(repository.createdWorkItems[0]?.title).toBe("GitHub issue title");
      expect(repository.links[0]?.syncStatus).toBe("synced");
    });

    it("upserts GitHub comments without creating local platform comments", async () => {
      await importGithubIssuesForProject(
        repository,
        adminSession,
        "acme",
        "OPS",
        client
      );

      expect(repository.githubIssueComments).toHaveLength(1);
      expect(repository.localCommentsCreated).toBe(0);
    });
  });
  ```

- [ ] **Step 2: Run import service tests to verify failure**

  Run:

  ```bash
  npm run test --workspace @the-platform/web -- apps/web/src/server/github/issues/service.test.ts
  ```

  Expected: fails because service/repository contracts do not exist.

- [ ] **Step 3: Define repository/service contracts**

  In `types.ts`, add:

  ```ts
  export interface ImportGithubIssuesSummary {
    created: number;
    updated: number;
    skippedPullRequests: number;
    conflicted: number;
    failed: number;
  }

  export interface GithubIssueImportClient {
    getRepositoryIssuesSnapshot(
      target: {
        owner: string;
        name: string;
        fullName: string;
        installationId?: string | null;
      },
      options?: { includeClosed?: boolean }
    ): Promise<{
      fetchedAt: string;
      issues: Array<
        NormalizedGithubIssue & { comments: NormalizedGithubIssueComment[] }
      >;
    }>;
  }
  ```

  Define `GithubIssueSyncRepository` with workspace lookup, membership lookup, project lookup, project connection lookup, issue/comment upsert, work item create/update, link get/upsert, and settings get/update methods.

- [ ] **Step 4: Implement import service**

  Implement `importGithubIssuesForProject(repository, session, workspaceSlug, projectKey, client)`:
  - resolve workspace/project/membership;
  - require role at least `admin`;
  - require project GitHub connection;
  - read issue sync settings;
  - fetch snapshot with `includeClosed: settings.importClosedIssues`;
  - skip `isPullRequest`;
  - upsert issue projection;
  - find existing link by issue id;
  - create work item with `type: "task"`, `priority: "none"`, `status` from GitHub state, and first backlog workflow state when no existing link exists;
  - upsert link with initial hashes and timestamps;
  - upsert issue comments;
  - return summary counts.

- [ ] **Step 5: Implement Drizzle repository**

  Create `createGithubIssueSyncRepository()` in `repository.ts`. Follow serializer style in existing repositories:
  - `toIso(Date | null)`;
  - row serializer per table;
  - transaction for create work item plus link creation;
  - `onConflictDoUpdate` for issue and comment projections;
  - sanitized error strings for persisted errors.

- [ ] **Step 6: Run focused tests**

  Run:

  ```bash
  npm run test --workspace @the-platform/web -- apps/web/src/server/github/issues/service.test.ts
  npm run typecheck --workspace @the-platform/web
  ```

  Expected: all pass.

- [ ] **Step 7: Commit**

  ```bash
  git add apps/web/src/server/github/issues/repository.ts apps/web/src/server/github/issues/service.ts apps/web/src/server/github/issues/service.test.ts apps/web/src/server/github/issues/types.ts
  git commit -m "feat: import github issues as work items"
  ```

---

### Task 4: Worker Issue Reconcile

**Files:**

- Create: `apps/worker/src/github-issues-reconcile.ts`
- Create: `apps/worker/src/github-issues-reconcile.test.ts`
- Modify: `apps/worker/src/github-reconcile.ts`

- [ ] **Step 1: Write failing reconcile tests**

  In `github-issues-reconcile.test.ts`, cover:

  ```ts
  it("reconciles connected repositories with issue sync enabled", async () => {
    const summary = await backfillConnectedGithubIssues({
      repository,
      projector,
      client,
    });
    assert.equal(summary.totals.repositoriesReconciled, 1);
    assert.equal(summary.totals.issuesApplied, 2);
    assert.equal(summary.totals.commentsApplied, 3);
  });

  it("does not reconcile repositories with issue sync disabled", async () => {
    repository.targets[0]!.issueSyncEnabled = false;
    const summary = await backfillConnectedGithubIssues({
      repository,
      projector,
      client,
    });
    assert.equal(summary.totals.repositoriesReconciled, 0);
  });
  ```

- [ ] **Step 2: Run reconcile tests to verify failure**

  Run:

  ```bash
  npm run test --workspace @the-platform/worker -- src/github-issues-reconcile.test.ts
  ```

  Expected: fails because reconcile module does not exist.

- [ ] **Step 3: Implement issue reconcile module**

  Add:

  ```ts
  export interface GithubIssuesReconcileTarget extends GithubRepositoryRecord {
    projectId: string;
    issueSyncEnabled: boolean;
    importClosedIssues: boolean;
  }

  export interface GithubIssuesProjectionWriter {
    applyGithubIssueSnapshot(input: {
      repositoryId: string;
      projectId: string;
      issue: GithubIssueSnapshot;
    }): Promise<void>;
  }
  ```

  Implement `backfillConnectedGithubIssues` by listing enabled targets, fetching issue snapshots, and applying each issue through the projector.

- [ ] **Step 4: Wire cycle mode carefully**

  In `apps/worker/src/github-reconcile.ts`, preserve existing PR/check/deploy summary. Add issue reconcile as a separate exported function or a nested optional phase so existing tests do not need issue fixtures unless the test imports issue reconcile.

- [ ] **Step 5: Run worker tests**

  Run:

  ```bash
  npm run test --workspace @the-platform/worker
  npm run typecheck --workspace @the-platform/worker
  ```

  Expected: all pass.

- [ ] **Step 6: Commit**

  ```bash
  git add apps/worker/src/github-issues-reconcile.ts apps/worker/src/github-issues-reconcile.test.ts apps/worker/src/github-reconcile.ts
  git commit -m "feat: reconcile github issues in worker"
  ```

---

### Task 5: Issues And Issue Comment Webhooks

**Files:**

- Modify: `apps/web/src/server/github/webhooks.ts`
- Modify: `apps/web/src/server/github/service.ts`
- Modify: `apps/web/src/server/github/types.ts`
- Modify: `apps/web/src/server/github/issues/service.ts`
- Modify: `apps/web/src/server/github/issues/service.test.ts`

- [ ] **Step 1: Write failing webhook tests**

  Extend existing GitHub service/webhook tests or add tests in `apps/web/src/server/github/issues/service.test.ts`:

  ```ts
  describe("projectGithubIssueWebhookEvent", () => {
    it("projects issue opened events into linked work items", async () => {
      await projectGithubIssueWebhookEvent(
        repository,
        githubRepository,
        "issues",
        openedPayload,
        receivedAt
      );
      expect(repository.githubIssues[0]?.number).toBe(7);
      expect(repository.links[0]?.syncStatus).toBe("synced");
    });

    it("marks title conflicts instead of overwriting both sides", async () => {
      repository.seedPlatformAndGithubTitleChanges();
      await projectGithubIssueWebhookEvent(
        repository,
        githubRepository,
        "issues",
        editedPayload,
        receivedAt
      );
      expect(repository.links[0]?.syncStatus).toBe("conflict");
      expect(repository.links[0]?.conflictFields).toEqual(["title"]);
    });

    it("projects issue_comment created events as external comments", async () => {
      await projectGithubIssueWebhookEvent(
        repository,
        githubRepository,
        "issue_comment",
        commentPayload,
        receivedAt
      );
      expect(repository.githubIssueComments[0]?.providerCommentId).toBe("201");
      expect(repository.localCommentsCreated).toBe(0);
    });
  });
  ```

- [ ] **Step 2: Run tests to verify failure**

  Run:

  ```bash
  npm run test --workspace @the-platform/web -- apps/web/src/server/github/issues/service.test.ts
  ```

  Expected: fails because webhook projection functions are missing.

- [ ] **Step 3: Accept new webhook event names**

  In `apps/web/src/server/github/webhooks.ts`, update `isSupportedGithubWebhookEvent`:

  ```ts
  return (
    value === "pull_request" ||
    value === "check_run" ||
    value === "check_suite" ||
    value === "deployment" ||
    value === "deployment_status" ||
    value === "issues" ||
    value === "issue_comment"
  );
  ```

- [ ] **Step 4: Implement issue webhook projection service**

  In `issues/service.ts`, add `projectGithubIssueWebhookEvent(repository, githubRepository, eventName, payload, receivedAt)`:
  - for `issues`, parse `payload.issue`, ignore PR issue payloads, upsert issue, create or find linked work item, apply conflict-safe field sync;
  - for `issue_comment`, parse `payload.issue` and `payload.comment`, ignore PR comments unless linked issue exists, upsert parent issue, upsert or soft-delete comment based on action;
  - return a typed result `{ ignored: boolean; reason?: string }` for tests and observability.

- [ ] **Step 5: Route from existing GitHub service**

  In `apps/web/src/server/github/service.ts`, import the issue webhook function and route:

  ```ts
  if (eventName === "issues" || eventName === "issue_comment") {
    await projectGithubIssueWebhookEvent(
      repository,
      githubRepository,
      eventName,
      payload,
      receivedAt
    );
    return;
  }
  ```

  Extend `GithubConnectionRepository` in `types.ts` with the issue repository methods needed by both existing GitHub service and issue service, or compose an issue repository in the route-level dependency if that keeps interfaces cleaner.

- [ ] **Step 6: Run focused tests**

  Run:

  ```bash
  npm run test --workspace @the-platform/web -- apps/web/src/server/github/issues/service.test.ts
  npm run test --workspace @the-platform/web -- apps/web/src/server/github
  npm run typecheck --workspace @the-platform/web
  ```

  Expected: all pass.

- [ ] **Step 7: Commit**

  ```bash
  git add apps/web/src/server/github/webhooks.ts apps/web/src/server/github/service.ts apps/web/src/server/github/types.ts apps/web/src/server/github/issues/service.ts apps/web/src/server/github/issues/service.test.ts
  git commit -m "feat: project github issue webhooks"
  ```

---

### Task 6: Outbound Title, Body, And State Sync

**Files:**

- Modify: `apps/web/src/server/github/issues/service.ts`
- Modify: `apps/web/src/server/github/issues/service.test.ts`
- Modify: `apps/web/src/server/work-items/service.ts`
- Modify: `apps/web/src/server/work-items/types.ts`
- Modify: `apps/web/src/server/api/detail-handlers.ts`

- [ ] **Step 1: Write failing outbound sync tests**

  In `issues/service.test.ts`, cover:

  ```ts
  describe("syncWorkItemGithubOwnedFields", () => {
    it("writes title edits to GitHub when title sync is enabled", async () => {
      await syncWorkItemGithubOwnedFields(repository, client, {
        actorId: "henry",
        projectId: "project-1",
        workItemId: "item-1",
        changedFields: { title: "Platform title" },
      });

      expect(client.updatedIssues[0]).toMatchObject({
        issueNumber: 7,
        input: { title: "Platform title" },
      });
      expect(repository.operations[0]?.status).toBe("succeeded");
    });

    it("does not write priority or workflow movement to GitHub", async () => {
      await syncWorkItemGithubOwnedFields(repository, client, {
        actorId: "henry",
        projectId: "project-1",
        workItemId: "item-1",
        changedFields: { priority: "urgent", workflowStateId: "state-done" },
      });

      expect(client.updatedIssues).toHaveLength(0);
    });

    it("marks sync error when GitHub update fails", async () => {
      client.failNextUpdate = true;
      await syncWorkItemGithubOwnedFields(repository, client, {
        actorId: "henry",
        projectId: "project-1",
        workItemId: "item-1",
        changedFields: { body: "New body" },
      });

      expect(repository.links[0]?.syncStatus).toBe("error");
      expect(repository.operations[0]?.status).toBe("failed");
    });
  });
  ```

- [ ] **Step 2: Run tests to verify failure**

  Run:

  ```bash
  npm run test --workspace @the-platform/web -- apps/web/src/server/github/issues/service.test.ts
  ```

  Expected: fails because outbound function does not exist.

- [ ] **Step 3: Implement outbound operation service**

  Add `syncWorkItemGithubOwnedFields(repository, client, input)`:
  - load work item link and issue projection;
  - respect `syncEnabled`, `syncTitle`, `syncBody`, `syncState`;
  - create `github_issue_sync_operations` row with stable `operationKey`;
  - call `client.updateIssue`;
  - on success, update issue projection, link baseline, link status `synced`, operation `succeeded`;
  - on failure, set operation `failed`, link `error`, sanitized `errorMessage`.

- [ ] **Step 4: Thread optional dependency into work item service**

  Extend `WorkItemNotificationDependencies` or add `WorkItemIntegrationDependencies`:

  ```ts
  export interface WorkItemIntegrationDependencies extends WorkItemNotificationDependencies {
    githubIssueSync?: {
      syncWorkItemFields(input: {
        actorId: string;
        projectId: string;
        workItemId: string;
        changedFields: Record<string, unknown>;
      }): Promise<void>;
    };
  }
  ```

  After successful explicit user title/status update in `updateWorkItemForUser`, call `githubIssueSync.syncWorkItemFields` with only fields present in the user patch.

- [ ] **Step 5: Thread description body sync**

  In `detail-handlers.ts`, after `updateDescriptionForUser` succeeds, call the issue sync dependency with:

  ```ts
  changedFields: {
    body: workItem.description;
  }
  ```

  Keep this dependency optional so existing route tests continue to use in-memory repositories without GitHub setup.

- [ ] **Step 6: Run focused tests**

  Run:

  ```bash
  npm run test --workspace @the-platform/web -- apps/web/src/server/github/issues/service.test.ts
  npm run test --workspace @the-platform/web -- apps/web/src/server/work-items/service.test.ts
  npm run typecheck --workspace @the-platform/web
  ```

  Expected: all pass.

- [ ] **Step 7: Commit**

  ```bash
  git add apps/web/src/server/github/issues/service.ts apps/web/src/server/github/issues/service.test.ts apps/web/src/server/work-items/service.ts apps/web/src/server/work-items/types.ts apps/web/src/server/api/detail-handlers.ts
  git commit -m "feat: sync platform issue edits to github"
  ```

---

### Task 7: Timeline External Comments And Detail Sync UI

**Files:**

- Modify: `apps/web/src/server/comments/types.ts`
- Modify: `apps/web/src/server/comments/service.ts`
- Modify: `apps/web/src/components/timeline.tsx`
- Modify: `apps/web/src/components/detail-panel.tsx`
- Modify: `apps/web/src/app/workspaces/[slug]/projects/[key]/project-detail-content.tsx`
- Modify: `apps/web/src/features/board/__tests__/issue-detail.test.tsx`

- [ ] **Step 1: Write failing UI tests**

  In `issue-detail.test.tsx`, add:

  ```tsx
  it("renders GitHub issue sync status and external comments", () => {
    render(
      <DetailPanel
        workspaceSlug="platform-ops"
        projectKey="OPS"
        basePath="/workspaces/platform-ops/projects/OPS"
        item={item}
        comments={comments}
        versions={versions}
        timeline={[
          {
            kind: "github_issue_comment",
            createdAt: "2026-04-20T14:00:00.000Z",
            comment: {
              id: "gh-comment-1",
              providerCommentId: "201",
              body: "GitHub side comment",
              url: "https://github.com/acme/platform/issues/7#issuecomment-201",
              authorLogin: "mona",
              githubCreatedAt: "2026-04-20T14:00:00.000Z",
              githubUpdatedAt: "2026-04-20T14:00:00.000Z",
            },
          },
        ]}
        members={members}
        states={states}
        sessionUserId="henry"
        membershipRole="owner"
        githubIssueSync={{
          status: "synced",
          issueNumber: 7,
          issueUrl: "https://github.com/acme/platform/issues/7",
          repositoryFullName: "acme/platform",
          conflictFields: [],
          errorMessage: null,
          syncEnabled: true,
        }}
      />
    );

    expect(screen.getByText("GitHub issue #7")).toBeInTheDocument();
    expect(screen.getByText("Synced")).toBeInTheDocument();
    expect(screen.getByText("GitHub comment")).toBeInTheDocument();
    expect(screen.getByText("mona")).toBeInTheDocument();
    expect(screen.getByText("GitHub side comment")).toBeInTheDocument();
  });
  ```

  Add conflict/error variants:

  ```tsx
  expect(screen.getByText("Sync conflict")).toBeInTheDocument();
  expect(screen.getByText("title")).toBeInTheDocument();
  expect(screen.getByText("Sync failed")).toBeInTheDocument();
  ```

- [ ] **Step 2: Run UI tests to verify failure**

  Run:

  ```bash
  npm run test --workspace @the-platform/web -- apps/web/src/features/board/__tests__/issue-detail.test.tsx
  ```

  Expected: fails because timeline and detail props do not support GitHub issue sync yet.

- [ ] **Step 3: Extend timeline types and service**

  In `comments/types.ts`, add:

  ```ts
  export interface GithubIssueTimelineComment {
    id: string;
    providerCommentId: string;
    body: string;
    url: string;
    authorLogin: string | null;
    githubCreatedAt: string;
    githubUpdatedAt: string;
  }
  ```

  Extend `WorkItemTimelineEntry`:

  ```ts
  | {
      kind: "github_issue_comment";
      createdAt: string;
      comment: GithubIssueTimelineComment;
    }
  ```

  Add an optional timeline dependency `githubIssueRepository` with `listGithubIssueCommentsForWorkItem(workItem.id)`.

- [ ] **Step 4: Render GitHub comments**

  In `timeline.tsx`, add the union branch:

  ```tsx
  {
    entry.kind === "github_issue_comment" ? (
      <div className="prose prose-invert mt-3 max-w-none text-sm prose-p:my-2">
        <div className="mb-2 flex items-center gap-2 text-xs text-planka-text-muted">
          <span>GitHub comment</span>
          <span>{entry.comment.authorLogin ?? "unknown"}</span>
          <a
            href={entry.comment.url}
            target="_blank"
            rel="noreferrer"
            className="text-planka-accent"
          >
            Open on GitHub
          </a>
        </div>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {entry.comment.body}
        </ReactMarkdown>
      </div>
    ) : null;
  }
  ```

- [ ] **Step 5: Render detail sync status**

  Add `githubIssueSync?: GithubIssueSyncView | null` to `DetailPanelProps`.

  Render a compact card near engineering context:

  ```tsx
  {
    githubIssueSync ? (
      <section className="rounded-3xl border border-white/8 bg-black/15 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-planka-accent">
          GitHub issue
        </p>
        <a
          href={githubIssueSync.issueUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex text-sm font-semibold text-planka-text"
        >
          GitHub issue #{githubIssueSync.issueNumber}
        </a>
        <p className="mt-2 text-sm text-planka-text-muted">
          {githubIssueSync.repositoryFullName}
        </p>
        <p className="mt-3 text-sm font-semibold text-planka-text">
          {githubIssueSync.status === "synced"
            ? "Synced"
            : githubIssueSync.status === "conflict"
              ? "Sync conflict"
              : githubIssueSync.status === "error"
                ? "Sync failed"
                : githubIssueSync.status}
        </p>
        {githubIssueSync.conflictFields.length > 0 ? (
          <p className="mt-2 text-xs text-planka-text-muted">
            Fields: {githubIssueSync.conflictFields.join(", ")}
          </p>
        ) : null}
        {githubIssueSync.errorMessage ? (
          <p className="mt-2 text-xs text-red-200">
            {githubIssueSync.errorMessage}
          </p>
        ) : null}
      </section>
    ) : null;
  }
  ```

- [ ] **Step 6: Load sync status in project detail page**

  In `project-detail-content.tsx`, create the issue repository and pass:
  - `githubIssueRepository` to `listWorkItemTimelineForUser`;
  - selected work item sync view to `ViewToggle` and `DetailPanel`.

  Keep `null` when no GitHub issue link exists.

- [ ] **Step 7: Run UI tests**

  Run:

  ```bash
  npm run test --workspace @the-platform/web -- apps/web/src/features/board/__tests__/issue-detail.test.tsx
  npm run typecheck --workspace @the-platform/web
  ```

  Expected: all pass.

- [ ] **Step 8: Commit**

  ```bash
  git add apps/web/src/server/comments/types.ts apps/web/src/server/comments/service.ts apps/web/src/components/timeline.tsx apps/web/src/components/detail-panel.tsx apps/web/src/app/workspaces/'[slug]'/projects/'[key]'/project-detail-content.tsx apps/web/src/features/board/__tests__/issue-detail.test.tsx
  git commit -m "feat: show github issue sync in detail timeline"
  ```

---

### Task 8: Import/Settings API, UI, And Product Docs

**Files:**

- Create: `apps/web/src/app/api/workspaces/[slug]/projects/[key]/github/issues/import/route.ts`
- Create: `apps/web/src/app/api/workspaces/[slug]/projects/[key]/github/issues/settings/route.ts`
- Modify: `apps/web/src/features/github-import/github-import-panel.tsx`
- Modify: `apps/web/src/features/github-import/__tests__/github-import-panel.test.tsx`
- Modify: `docs/product/idea-brief.md`
- Modify: `docs/product/decision-brief.md`
- Modify: `docs/product/prd.md`

- [ ] **Step 1: Write failing API/UI tests**

  Add UI test expectations:

  ```tsx
  expect(
    screen.getByRole("button", { name: /Import GitHub issues/i })
  ).toBeInTheDocument();
  expect(screen.getByLabelText("Sync issue title and body")).toBeChecked();
  expect(screen.getByLabelText("Sync open and closed state")).toBeChecked();
  ```

  Keep route logic thin and rely on Task 3 service tests for admin authorization. Add a small component test assertion that clicking "Import GitHub issues" sends `POST /api/workspaces/acme/projects/OPS/github/issues/import`.

- [ ] **Step 2: Run tests to verify failure**

  Run:

  ```bash
  npm run test --workspace @the-platform/web -- apps/web/src/features/github-import/__tests__/github-import-panel.test.tsx
  ```

  Expected: fails because UI controls do not exist.

- [ ] **Step 3: Implement import API route**

  In `import/route.ts`:

  ```ts
  export async function POST(
    request: Request,
    { params }: { params: Promise<{ slug: string; key: string }> }
  ) {
    const session = await getAppSession();
    if (!session) {
      return Response.json(
        { error: "authentication required." },
        { status: 401 }
      );
    }

    const { slug, key } = await params;
    const repository = createGithubIssueSyncRepository();
    const client = createGithubIssuesClient();
    const summary = await importGithubIssuesForProject(
      repository,
      session,
      slug,
      key,
      client
    );
    return Response.json({ summary });
  }
  ```

  Match existing session helper names and imports from neighboring API routes.

- [ ] **Step 4: Implement settings API route**

  In `settings/route.ts`, support `PATCH` for admin-only settings update:

  ```ts
  {
    issueSyncEnabled: boolean;
    syncTitle: boolean;
    syncBody: boolean;
    syncState: boolean;
    importClosedIssues: boolean;
    closedWorkflowStateId: string | null;
    reopenedWorkflowStateId: string | null;
  }
  ```

  Validate booleans explicitly and reject malformed values with `400`.

- [ ] **Step 5: Add UI controls**

  In `github-import-panel.tsx`, add a connected-repo section:
  - "GitHub Issues sync";
  - toggles for title/body and open/closed state;
  - checkbox for importing closed issues;
  - "Import GitHub issues" button;
  - summary copy for created/updated/skipped/conflicted/failed counts;
  - error copy: "Issue import failed. Check GitHub App permissions and try again."

- [ ] **Step 6: Update product docs**

  Update docs with current Phase 14 positioning:
  - `idea-brief.md`: product now bridges project execution and GitHub issues.
  - `decision-brief.md`: Phase 14 decision is conservative issue sync with field ownership.
  - `prd.md`: Phase 14 PRD includes issue import, bidirectional title/body/state sync, conflict visibility, GitHub comments inbound, and Phase 15 non-goals.

- [ ] **Step 7: Run focused tests**

  Run:

  ```bash
  npm run test --workspace @the-platform/web -- apps/web/src/features/github-import/__tests__/github-import-panel.test.tsx
  npm run typecheck --workspace @the-platform/web
  /Users/henry/Documents/project-tracker/node_modules/.bin/prettier --check docs/product/idea-brief.md docs/product/decision-brief.md docs/product/prd.md
  ```

  Expected: all pass.

- [ ] **Step 8: Commit**

  ```bash
  git add apps/web/src/app/api/workspaces/'[slug]'/projects/'[key]'/github/issues/import/route.ts apps/web/src/app/api/workspaces/'[slug]'/projects/'[key]'/github/issues/settings/route.ts apps/web/src/features/github-import/github-import-panel.tsx apps/web/src/features/github-import/__tests__/github-import-panel.test.tsx docs/product/idea-brief.md docs/product/decision-brief.md docs/product/prd.md
  git commit -m "feat: add github issues import controls"
  ```

---

### Task 9: Final Verification, Browser Smoke, And PR Readiness

**Files:**

- Modify only files needed to fix verification failures discovered in this task.

- [ ] **Step 1: Run full automated verification**

  Run:

  ```bash
  npm run lint
  npm run typecheck
  npm test
  npm run build
  ```

  Expected: all pass.

- [ ] **Step 2: Start local app for browser smoke**

  If ports are already occupied, stop only the project dev processes using those ports:

  ```bash
  for port in 3000 3001 3002; do
    pids=$(lsof -ti "tcp:${port}" || true)
    if [ -n "$pids" ]; then
      kill $pids
    fi
  done
  npm run dev
  ```

  Expected: Next reports a local URL, usually `http://localhost:3000` or the next free port.

- [ ] **Step 3: Browser smoke path**

  In the in-app browser:
  1. open the local URL;
  2. navigate to a connected project;
  3. verify the GitHub import panel shows issue sync controls;
  4. trigger issue import against a test repository or mocked local fixture if the app is running in demo mode;
  5. open an imported work item detail panel;
  6. verify GitHub issue status card renders;
  7. verify GitHub external comment renders in timeline;
  8. edit a platform title and confirm UI does not error;
  9. verify platform comments remain local and do not show as GitHub writeback.

- [ ] **Step 4: Review data protection manually**

  Check the implementation for:
  - no persisted GitHub user access tokens;
  - no platform comment outbound path;
  - no automatic writeback from import/projection;
  - conflict paths do not overwrite both sides;
  - GitHub API errors are sanitized before persistence.

- [ ] **Step 5: Clean up and prepare PR**

  Run:

  ```bash
  git status --porcelain=v1 --branch
  git log --oneline origin/main..HEAD
  ```

  Expected: branch contains only Phase 14 commits and no unstaged changes.

- [ ] **Step 6: Commit verification fixes if any**

  If Step 1 or Step 3 required fixes:

  ```bash
  git add apps packages docs
  git commit -m "fix: stabilize github issues sync verification"
  ```

- [ ] **Step 7: Request review**

  Use the repository review process:
  - run a code review gate;
  - address findings with targeted commits;
  - rerun full verification;
  - push branch and create/update PR.

## Plan Self-Review

Spec coverage:

- Schema, constants, and durable status/conflict model are covered in Task 1.
- GitHub issue import and PR filtering are covered in Tasks 2 and 3.
- Worker backfill/reconcile is covered in Task 4.
- `issues` and `issue_comment` webhooks are covered in Task 5.
- Bidirectional title/body/state sync and loop-prevention operations are covered in Task 6.
- GitHub comments inbound and timeline rendering are covered in Task 7.
- Settings, import UI, and product docs are covered in Task 8.
- Full verification and browser smoke are covered in Task 9.

Scope guard:

- Platform comment outbound, comment edit/delete bidirectional lifecycle, GitHub labels, milestones, assignees, dependencies, and GitHub Projects sync remain excluded.

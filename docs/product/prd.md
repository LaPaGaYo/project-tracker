# PRD: Phase 14 - GitHub Issues Sync

## Overview

Phase 14 adds conservative GitHub Issues sync to the project workspace. Teams can import GitHub issues into platform work items, sync title/body/state when field ownership allows it, see conflicts in the detail UI, and read inbound GitHub comments in the work item timeline.

## Scope Sections

### 14.1 Issue Schema And Projections

**Requirements:**

- Store normalized GitHub issue projections per repository.
- Store one work item to one GitHub issue links.
- Track sync status, field ownership, baselines, conflict fields, and errors.
- Store inbound GitHub issue comments separately from local platform comments.

### 14.2 Issue Import

**Requirements:**

- Add an admin-triggered import for the connected project repository.
- Fetch GitHub issues through the existing GitHub App installation.
- Skip pull requests returned by the issues API.
- Create work items for unlinked issues.
- Update linked work items only when sync settings and link field ownership allow it.
- Return created, updated, skipped, conflicted, and failed counts.

### 14.3 Bidirectional Field Sync

**Requirements:**

- Sync GitHub issue title to and from work item title when title sync is enabled.
- Sync GitHub issue body to and from work item description when body sync is enabled.
- Sync GitHub open/closed state to and from work item completion state when state sync is enabled.
- Allow optional workflow-state mappings for closed and reopened issues.
- Keep automatic issue sync disabled by default at the project connection level.

### 14.4 Conflict Visibility

**Requirements:**

- Detect changed-on-both-sides title/body/state updates.
- Mark the issue link as `conflict` and record conflict fields.
- Avoid unsafe overwrites while a conflict is present.
- Show sync status, conflict fields, and errors in the work item detail UI.

### 14.5 GitHub Comments Inbound

**Requirements:**

- Project issue comment webhooks into `github_issue_comments`.
- Update edited comments and mark deleted comments as deleted.
- Show inbound GitHub comments in the work item detail timeline.
- Do not create local platform comments for GitHub comments.

### 14.6 Import And Settings UI

**Requirements:**

- Preserve the existing GitHub repository onboarding form.
- Show GitHub Issues sync controls when a connected project context is available.
- Include controls for title/body sync, open/closed state sync, and importing closed issues.
- Add an `Import GitHub issues` action that calls the project import API.
- Show import summary counts and safe failure copy.

### 14.7 API

**Requirements:**

- Add `POST /api/workspaces/[slug]/projects/[key]/github/issues/import`.
- Add `PATCH /api/workspaces/[slug]/projects/[key]/github/issues/settings`.
- Require an authenticated session.
- Require admin authorization for import and settings updates.
- Validate malformed JSON and non-boolean settings safely.
- Return `WorkspaceError` responses with their intended status.

### 14.8 Data Model

`project_github_connections` stores durable issue sync settings:

- `issue_sync_enabled`
- `issue_import_closed`
- `issue_sync_title`
- `issue_sync_body`
- `issue_sync_state`
- `issue_closed_workflow_state_id`
- `issue_reopened_workflow_state_id`

The setting defaults are conservative: automatic sync and closed issue import are disabled; title, body, and state ownership default to enabled for links created when sync is enabled.

## Non-Goals

- GitHub Projects sync
- Multi-repository issue sync per project
- Labels, assignees, milestones, issue types, or custom GitHub fields
- Workflow mapping UX beyond nullable stored mappings
- Automated triage or AI-generated issue edits
- Bulk destructive reconciliation
- Phase 15 automation, richer metadata sync, and broad sync policy management

## Exit Criteria

- Import/settings API, UI controls, durable settings, and docs are implemented.
- Existing repository onboarding remains functional.
- Focused UI, service, DB, typecheck, docs formatting, and diff hygiene checks pass.

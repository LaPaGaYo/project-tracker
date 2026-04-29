# Decision Brief: Phase 14 - GitHub Issues Sync

## Context

The product direction remains: Jira-like execution structure, GitHub for engineering truth, and Notion-like lightness for collaboration.

Phase 14 connects that model to GitHub Issues. The decision is not to mirror every GitHub concept, but to provide a conservative bridge where teams can import issues, sync selected fields, and see conflicts clearly.

## Key Decisions

### 1. Use conservative issue sync with explicit field ownership

Title, body, and open/closed state are the only bidirectional fields in scope. Each can be disabled so teams can decide whether GitHub or the platform owns the field.

**Why:** Silent overwrites would make the integration hard to trust. Field ownership keeps sync explainable.

### 2. Persist settings on project GitHub connections

Issue sync settings live on `project_github_connections` instead of a separate settings table.

**Why:** Settings are project-level, tied to the single connected repository, and small enough to keep with the connection record.

### 3. Imports are explicit admin actions

Admins import GitHub issues from the connected repository through the project GitHub import/settings UI.

**Why:** Initial import can create many work items, so it should be deliberate and permission-gated.

### 4. Conflicts are visible execution state

When both sides change an owned field, the link records conflict fields and the detail UI shows the issue rather than overwriting.

**Why:** Conflict visibility is safer than either platform-winning or GitHub-winning behavior.

### 5. GitHub comments are inbound timeline context

GitHub issue comments are projected into work item detail timelines as external context.

**Why:** Project users need discussion context without confusing GitHub comments with local platform comments.

## Non-Goals

- GitHub Projects sync
- Multi-repository issue sync for one project
- Labels, assignees, milestones, issue types, or custom GitHub fields
- Automated triage or AI-generated issue edits
- Bulk destructive reconciliation
- Phase 15 workflow automation or richer mapping rules

## RBAC Rules

| Role          | View Issue Sync | Import Issues  | Update Sync Settings | View Conflicts |
| ------------- | --------------- | -------------- | -------------------- | -------------- |
| Viewer        | Yes             | No             | No                   | Yes            |
| Member        | Yes             | No             | No                   | Yes            |
| Admin         | Yes             | Yes            | Yes                  | Yes            |
| Owner         | Yes             | Yes            | Yes                  | Yes            |
| Worker/System | Sync jobs only  | Reconcile only | No UI access         | Writes status  |

## Success Criteria

1. GitHub issue import creates or updates linked work items without duplicating existing links.
2. Durable project settings control sync enablement, closed issue import, title/body sync, state sync, and optional workflow-state mappings.
3. Webhooks and worker reconciliation honor field ownership and conflict status.
4. Outbound platform edits update GitHub only for owned fields.
5. Inbound GitHub comments appear in work item timelines.
6. Existing repository onboarding remains intact.
7. Phase 14 docs keep Phase 15 non-goals explicit.

## Next Phase

Phase 15 should only expand the integration after conservative issue sync is validated. Candidate work includes richer metadata sync, workflow mapping UX, automation policies, and broader reconciliation controls.

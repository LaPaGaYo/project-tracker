# Idea Brief: Phase 14 - GitHub Issues Sync

## Problem

The project workspace now supports execution planning, local work items, comments, live GitHub engineering status, notifications, and readiness reporting. The remaining gap is that many engineering teams still manage day-to-day execution in GitHub Issues, while project leads need the platform workspace to stay readable, governed, and aligned.

Without issue sync, teams must manually copy issue titles, descriptions, state changes, and discussion context between GitHub and the project workspace. That creates duplicate work, stale plans, and unclear ownership of which system controls which fields.

## Goals

1. **Bridge project execution and GitHub Issues** - Import GitHub issues into project work items without replacing the project workspace.

2. **Conservative bidirectional sync** - Sync title, body, and open/closed state only when field ownership allows it.

3. **Visible conflict handling** - Surface conflicts rather than silently overwriting local or GitHub-owned edits.

4. **GitHub discussion context** - Bring inbound GitHub issue comments into the project detail timeline.

5. **Admin-controlled settings** - Store project-level sync settings on the GitHub project connection with safe defaults.

## Constraints

- GitHub Issues sync must build on the existing GitHub App installation and repository connection model.
- Project-local work items remain the platform execution record.
- Field ownership must stay explicit and conservative.
- Imports must skip pull requests and avoid duplicate work item links.
- Sync settings are project-level and default to disabled for automatic issue sync.

## Non-Goals

- Replacing GitHub Issues as an engineering tool
- Multi-repository issue sync per project
- GitHub Projects sync
- Labels, assignees, milestones, issue types, or custom fields
- Bulk destructive reconciliation
- Phase 15 workflow automation, smart triage, or AI-generated issue updates

## Decisions

1. **Project connection owns settings** - `project_github_connections` stores durable issue sync settings with conservative defaults.

2. **Import is admin-triggered** - Admins explicitly import GitHub issues after the repository is connected and authorized.

3. **Field ownership gates sync** - Title/body/state sync can be enabled independently, and conflicts pause unsafe overwrites.

4. **Comments are inbound context** - GitHub issue comments appear in the platform timeline but do not create local platform comments.

5. **Phase 15 remains out of scope** - Automation, deeper metadata sync, and richer mapping rules are deferred.

## Success Criteria

- Admins can import GitHub issues from a connected repository into project work items.
- Project settings persist issue sync enablement, closed issue import, title/body sync, state sync, and optional workflow-state mappings.
- Existing repository onboarding remains available and unchanged.
- Linked issue detail surfaces show sync status, conflicts, and inbound GitHub comments.
- Product docs clearly describe conservative issue sync, field ownership, and Phase 15 non-goals.

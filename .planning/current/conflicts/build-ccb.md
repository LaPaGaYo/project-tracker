# Nexus Conflict

Kind: backend_conflict

Message: Generator reported blocked build contract: Read the predecessor artifacts and confirmed the current governed contract is `Phase 4 - Views`. Inspected the repository state against that packet and found the contract is inconsistent with the worktree: the repo is still at the Phase 1 baseline, not the Phase 3 prerequisite baseline the packet requires. The named Phase 4 surfaces are absent (`apps/web/src/server/**`, `apps/web/src/app/api/workspaces/**`, project detail pages, Phase 4 contract tests, and `@dnd-kit` dependencies), so implementing Phase 4 here would require first adding missing earlier-phase infrastructure that the packet explicitly says is already complete and out of scope.

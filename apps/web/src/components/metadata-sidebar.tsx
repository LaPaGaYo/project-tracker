import type {
  PlanItemRecord,
  ProjectStageRecord,
  WorkspaceMemberRecord,
  WorkflowStateRecord,
  WorkItemRecord
} from "@the-platform/shared";

interface MetadataSidebarProps {
  item: WorkItemRecord;
  members: WorkspaceMemberRecord[];
  states: WorkflowStateRecord[];
  projectStages?: ProjectStageRecord[];
  planItems?: PlanItemRecord[];
  canEdit: boolean;
  disabled?: boolean;
  onFieldChange: (
    patch: Partial<
      Pick<
        WorkItemRecord,
        "assigneeId" | "priority" | "type" | "workflowStateId" | "stageId" | "planItemId"
      >
    >
  ) => void;
}

export function MetadataSidebar({
  item,
  members,
  states,
  projectStages = [],
  planItems = [],
  canEdit,
  disabled = false,
  onFieldChange
}: MetadataSidebarProps) {
  const availablePlanItems = item.stageId
    ? planItems.filter((planItem) => planItem.stageId === item.stageId)
    : [];

  return (
    <aside className="grid gap-6">
      <div className="rounded-[1.75rem] border border-white/8 bg-black/15 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-planka-accent">Identifier</p>
        <p className="mt-2 text-sm font-semibold text-planka-text">{item.identifier}</p>
      </div>

      <div className="grid gap-4 rounded-[1.75rem] border border-white/8 bg-black/15 p-5">
        <label className="grid gap-2 text-sm text-planka-text-muted">
          <span className="text-xs font-semibold uppercase tracking-[0.24em] text-planka-accent">Priority</span>
          <select
            value={item.priority}
            disabled={!canEdit || disabled}
            onChange={(event) => onFieldChange({ priority: event.target.value as WorkItemRecord["priority"] })}
            className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-planka-text outline-none transition focus:border-white/24 disabled:opacity-60"
          >
            <option value="urgent">urgent</option>
            <option value="high">high</option>
            <option value="medium">medium</option>
            <option value="low">low</option>
            <option value="none">none</option>
          </select>
        </label>

        <label className="grid gap-2 text-sm text-planka-text-muted">
          <span className="text-xs font-semibold uppercase tracking-[0.24em] text-planka-accent">Type</span>
          <select
            value={item.type}
            disabled={!canEdit || disabled}
            onChange={(event) => onFieldChange({ type: event.target.value as WorkItemRecord["type"] })}
            className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-planka-text outline-none transition focus:border-white/24 disabled:opacity-60"
          >
            <option value="epic">epic</option>
            <option value="task">task</option>
            <option value="subtask">subtask</option>
          </select>
        </label>

        <label className="grid gap-2 text-sm text-planka-text-muted">
          <span className="text-xs font-semibold uppercase tracking-[0.24em] text-planka-accent">State</span>
          <select
            value={item.workflowStateId ?? ""}
            disabled={!canEdit || disabled}
            onChange={(event) => onFieldChange({ workflowStateId: event.target.value || null })}
            className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-planka-text outline-none transition focus:border-white/24 disabled:opacity-60"
          >
            <option value="">No state</option>
            {states.map((state) => (
              <option key={state.id} value={state.id}>
                {state.name}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2 text-sm text-planka-text-muted">
          <span className="text-xs font-semibold uppercase tracking-[0.24em] text-planka-accent">Stage</span>
          <select
            value={item.stageId ?? ""}
            disabled={!canEdit || disabled}
            onChange={(event) => {
              const nextStageId = event.target.value || null;
              const nextPatch: Partial<Pick<WorkItemRecord, "stageId" | "planItemId">> = {
                stageId: nextStageId
              };

              if (
                item.planItemId &&
                !planItems.some((planItem) => planItem.id === item.planItemId && planItem.stageId === nextStageId)
              ) {
                nextPatch.planItemId = null;
              }

              onFieldChange(nextPatch);
            }}
            className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-planka-text outline-none transition focus:border-white/24 disabled:opacity-60"
          >
            <option value="">No stage</option>
            {projectStages.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.title}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2 text-sm text-planka-text-muted">
          <span className="text-xs font-semibold uppercase tracking-[0.24em] text-planka-accent">Plan item</span>
          <select
            value={item.planItemId ?? ""}
            disabled={!canEdit || disabled || (projectStages.length > 0 && !item.stageId)}
            onChange={(event) => {
              const nextPlanItemId = event.target.value || null;
              const nextPlanItem = planItems.find((planItem) => planItem.id === nextPlanItemId) ?? null;

              onFieldChange({
                planItemId: nextPlanItemId,
                ...(nextPlanItem && nextPlanItem.stageId !== item.stageId
                  ? { stageId: nextPlanItem.stageId }
                  : {})
              });
            }}
            className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-planka-text outline-none transition focus:border-white/24 disabled:opacity-60"
          >
            <option value="">No plan item</option>
            {availablePlanItems.map((planItem) => (
              <option key={planItem.id} value={planItem.id}>
                {planItem.title}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2 text-sm text-planka-text-muted">
          <span className="text-xs font-semibold uppercase tracking-[0.24em] text-planka-accent">Assignee</span>
          <select
            value={item.assigneeId ?? ""}
            disabled={!canEdit || disabled}
            onChange={(event) => onFieldChange({ assigneeId: event.target.value || null })}
            className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-planka-text outline-none transition focus:border-white/24 disabled:opacity-60"
          >
            <option value="">Unassigned</option>
            {members.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.userId}
              </option>
            ))}
          </select>
        </label>
      </div>
    </aside>
  );
}

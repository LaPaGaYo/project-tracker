"use client";

import type { WorkspaceMemberRecord, WorkflowStateRecord, WorkItemRecord } from "@the-platform/shared";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";

import { WorkItemCard } from "./work-item-card";

interface BoardColumnProps {
  state: WorkflowStateRecord;
  items: WorkItemRecord[];
  members: WorkspaceMemberRecord[];
  childCounts: Map<string, number>;
}

export function BoardColumn({ state, items, members, childCounts }: BoardColumnProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: `column:${state.id}`
  });
  const memberLabels = new Map(members.map((member) => [member.userId, member.userId]));

  return (
    <section
      ref={setNodeRef}
      className={`min-w-[18rem] rounded-[1.75rem] border p-4 transition ${
        isOver ? "border-planka-accent bg-black/25" : "border-white/8 bg-black/12"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-planka-accent">{state.category}</p>
          <h3 className="mt-2 text-lg font-semibold text-planka-text">{state.name}</h3>
        </div>
        <span className="rounded-full border border-white/12 px-3 py-1 text-xs uppercase tracking-[0.2em] text-planka-text-muted">
          {items.length}
        </span>
      </div>

      <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        <div className="mt-4 grid gap-3">
          {items.length > 0 ? (
            items.map((item) => (
              <WorkItemCard
                key={item.id}
                item={item}
                assigneeLabel={item.assigneeId ? memberLabels.get(item.assigneeId) ?? item.assigneeId : "unassigned"}
                subtaskCount={childCounts.get(item.id) ?? 0}
              />
            ))
          ) : (
            <div className="rounded-3xl border border-dashed border-white/12 px-4 py-10 text-center text-sm text-planka-text-muted">
              No items
            </div>
          )}
        </div>
      </SortableContext>
    </section>
  );
}

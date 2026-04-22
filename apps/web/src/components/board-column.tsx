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
  onOpenItem?: (identifier: string) => void;
}

export function BoardColumn({ state, items, members, childCounts, onOpenItem }: BoardColumnProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: `column:${state.id}`
  });
  const memberLabels = new Map(members.map((member) => [member.userId, member.userId]));
  const headingId = `board-column-${state.id}`;

  return (
    <section
      ref={setNodeRef}
      aria-labelledby={headingId}
      className={`min-w-[18rem] rounded-[1.75rem] border p-4 transition ${
        isOver ? "border-planka-accent bg-black/25" : "border-white/8 bg-black/12"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-planka-accent">{state.category}</p>
          <h3 id={headingId} className="mt-2 text-lg font-semibold text-planka-text">
            {state.name}
          </h3>
        </div>
        <span className="rounded-full border border-white/12 px-3 py-1 text-xs uppercase tracking-[0.2em] text-planka-text-muted">
          {items.length}
        </span>
      </div>

      <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        <div className="mt-4 grid min-h-[10rem] gap-3">
          {items.length > 0 ? (
            items.map((item) => (
              <WorkItemCard
                key={item.id}
                item={item}
                assigneeLabel={item.assigneeId ? memberLabels.get(item.assigneeId) ?? item.assigneeId : "unassigned"}
                subtaskCount={childCounts.get(item.id) ?? 0}
                {...(onOpenItem ? { onOpen: onOpenItem } : {})}
              />
            ))
          ) : (
            <div className="flex min-h-[10rem] flex-col items-center justify-center rounded-3xl border border-dashed border-white/12 px-4 py-10 text-center text-sm text-planka-text-muted">
              <span className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-xs font-semibold text-planka-text-muted">
                +
              </span>
              No items here yet
            </div>
          )}
        </div>
      </SortableContext>
    </section>
  );
}

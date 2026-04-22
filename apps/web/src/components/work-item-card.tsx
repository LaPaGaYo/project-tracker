"use client";

import type { WorkItemRecord } from "@the-platform/shared";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface WorkItemCardProps {
  item: WorkItemRecord;
  assigneeLabel: string;
  subtaskCount: number;
  onOpen?: (identifier: string) => void;
}

function initialsFromValue(value: string) {
  return value
    .split(/[^a-z0-9]+/i)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function WorkItemCard({ item, assigneeLabel, subtaskCount, onOpen }: WorkItemCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: item.id
  });

  return (
    <article
      ref={setNodeRef}
      onClick={() => {
        if (item.identifier && onOpen) {
          onOpen(item.identifier);
        }
      }}
      style={{
        transform: CSS.Transform.toString(transform),
        transition
      }}
      className={`cursor-pointer rounded-3xl border border-white/10 bg-black/20 p-4 shadow-[0_20px_45px_rgba(0,0,0,0.2)] transition ${
        isDragging ? "opacity-60 shadow-[0_24px_70px_rgba(0,0,0,0.32)]" : ""
      }`}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="rounded-full bg-planka-selected px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white">
          {item.identifier}
        </span>
        <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-planka-text-muted">
          <span className="h-2.5 w-2.5 rounded-full bg-planka-accent" />
          {item.priority}
        </span>
      </div>

      <h3 className="mt-4 text-base font-semibold text-planka-text">{item.title}</h3>
      {item.description ? (
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-planka-text-muted">{item.description}</p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-white/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-planka-text-muted">
            {item.type}
          </span>
          {subtaskCount > 0 ? (
            <span className="rounded-full border border-white/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-planka-text-muted">
              {subtaskCount} subtasks
            </span>
          ) : null}
        </div>
        <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-planka-accent text-xs font-semibold text-white">
          {initialsFromValue(assigneeLabel)}
        </div>
      </div>
    </article>
  );
}

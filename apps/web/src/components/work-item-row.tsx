import type { WorkItemRecord } from "@the-platform/shared";

interface WorkItemRowProps {
  item: WorkItemRecord;
}

export function WorkItemRow({ item }: WorkItemRowProps) {
  return (
    <div className="grid gap-3 rounded-3xl border border-white/8 bg-black/10 px-5 py-4 lg:grid-cols-[auto_1fr_auto_auto] lg:items-center">
      <div className="rounded-full bg-planka-selected px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white">
        {item.identifier}
      </div>
      <div>
        <p className="text-sm font-semibold text-planka-text">{item.title}</p>
        <p className="mt-1 text-sm text-planka-text-muted">{item.description || "No description yet."}</p>
      </div>
      <div className="flex flex-wrap gap-2 text-xs uppercase tracking-[0.2em] text-planka-text-muted">
        <span className="rounded-full border border-white/12 px-3 py-1">{item.type}</span>
        <span className="rounded-full border border-white/12 px-3 py-1">{item.priority}</span>
      </div>
      <div className="text-sm text-planka-text-muted">{item.assigneeId ?? "unassigned"}</div>
    </div>
  );
}

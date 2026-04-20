import type { WorkItemRecord } from "@the-platform/shared";

interface ListRowProps {
  item: WorkItemRecord;
  depth: number;
  hasChildren: boolean;
  isCollapsed: boolean;
  assigneeLabel: string;
  stateLabel: string;
  onToggle: () => void;
}

export function ListRow({
  item,
  depth,
  hasChildren,
  isCollapsed,
  assigneeLabel,
  stateLabel,
  onToggle
}: ListRowProps) {
  return (
    <tr className="border-t border-white/6">
      <td className="px-4 py-4 text-sm font-semibold text-planka-text">{item.identifier}</td>
      <td className="px-4 py-4 text-sm text-planka-text">
        <div className="flex items-start gap-3" style={{ paddingLeft: `${depth * 1.25}rem` }}>
          {hasChildren ? (
            <button
              type="button"
              onClick={onToggle}
              className="mt-0.5 rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-planka-text-muted transition hover:border-white/24 hover:text-planka-text"
            >
              {isCollapsed ? "+" : "-"}
            </button>
          ) : (
            <span className="mt-0.5 w-6 text-center text-xs text-planka-text-muted">•</span>
          )}
          <div>
            <p className="font-semibold text-planka-text">{item.title}</p>
            <p className="mt-1 text-xs text-planka-text-muted">{item.description || "No description yet."}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-4 text-sm text-planka-text-muted">
        <span className="rounded-full border border-white/12 px-3 py-1 text-xs uppercase tracking-[0.2em]">
          {item.type}
        </span>
      </td>
      <td className="px-4 py-4 text-sm text-planka-text-muted">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-planka-accent" />
          {item.priority}
        </span>
      </td>
      <td className="px-4 py-4 text-sm text-planka-text-muted">{assigneeLabel}</td>
      <td className="px-4 py-4 text-sm text-planka-text-muted">{stateLabel}</td>
      <td className="px-4 py-4 text-sm text-planka-text-muted">
        {new Date(item.createdAt).toLocaleDateString()}
      </td>
    </tr>
  );
}

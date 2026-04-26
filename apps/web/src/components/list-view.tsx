"use client";

import type { WorkspaceMemberRecord, WorkflowStateRecord, WorkItemRecord } from "@the-platform/shared";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Fragment, type ReactNode, useState, useTransition } from "react";

import type { ProjectWorkspaceEngineeringItemView } from "../features/workspace/project-workspace-view";
import { ListRow } from "./list-row";

interface ListViewProps {
  items: WorkItemRecord[];
  itemEngineering?: ProjectWorkspaceEngineeringItemView[];
  members: WorkspaceMemberRecord[];
  states: WorkflowStateRecord[];
  disableHooks?: boolean;
  onOpenItem?: (identifier: string) => void;
}

export function ListView({
  items,
  itemEngineering = [],
  members,
  states,
  disableHooks,
  onOpenItem
}: ListViewProps) {
  const pathname = disableHooks ? "/" : usePathname();
  const router = disableHooks ? null : useRouter();
  const searchParams = disableHooks ? new URLSearchParams() : useSearchParams();
  const [collapsedParents, setCollapsedParents] = useState<string[]>([]);
  const [isPending, startTransition] = disableHooks
    ? [false, (cb: () => void) => cb()]
    : useTransition();

  const stateNames = new Map(states.map((state) => [state.id, state.name]));
  const assigneeLabels = new Map(members.map((member) => [member.userId, member.userId]));
  const engineeringByTaskId = new Map(itemEngineering.map((entry) => [entry.taskId, entry]));
  const childrenByParent = new Map<string, WorkItemRecord[]>();
  const itemIds = new Set(items.map((item) => item.id));

  for (const item of items) {
    if (!item.parentId) {
      continue;
    }

    const currentChildren = childrenByParent.get(item.parentId) ?? [];
    currentChildren.push(item);
    childrenByParent.set(item.parentId, currentChildren);
  }

  function updateSort(field: "identifier" | "priority" | "created_at") {
    const nextParams = new URLSearchParams(searchParams.toString());
    const currentField = searchParams.get("sort");
    const currentOrder = searchParams.get("order");
    const nextOrder = currentField === field && currentOrder === "desc" ? "asc" : "desc";

    nextParams.set("sort", field);
    nextParams.set("order", nextOrder);

    startTransition(() => {
      if (router) {
        router.replace(`${pathname}?${nextParams.toString()}`, {
          scroll: false
        });
      }
    });
  }

  function toggleParent(itemId: string) {
    setCollapsedParents((current) =>
      current.includes(itemId) ? current.filter((entry) => entry !== itemId) : [...current, itemId]
    );
  }

  function renderRows(parentId: string | null, depth: number): ReactNode {
    const visibleItems = items.filter((item) => {
      if (parentId === null) {
        // In the root pass, include items with no parent OR items whose parent is not in the list (orphans)
        return !item.parentId || !itemIds.has(item.parentId);
      }
      return item.parentId === parentId;
    });

    return visibleItems.map((item) => {
      const children = childrenByParent.get(item.id) ?? [];
      const isCollapsed = collapsedParents.includes(item.id);

      return (
        <Fragment key={item.id}>
          <ListRow
            item={item}
            engineering={engineeringByTaskId.get(item.id) ?? null}
            depth={depth}
            hasChildren={children.length > 0}
            isCollapsed={isCollapsed}
            onToggle={() => toggleParent(item.id)}
            {...(item.identifier && onOpenItem ? { onOpen: () => onOpenItem(item.identifier!) } : {})}
            assigneeLabel={item.assigneeId ? assigneeLabels.get(item.assigneeId) ?? item.assigneeId : "unassigned"}
            stateLabel={item.workflowStateId ? stateNames.get(item.workflowStateId) ?? "Unknown" : "No state"}
          />
          {!isCollapsed ? renderRows(item.id, depth + 1) : null}
        </Fragment>
      );
    });
  }

  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-white/8 bg-planka-card/70 shadow-[0_32px_120px_rgba(0,0,0,0.24)]">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead className="bg-black/10">
            <tr className="text-left text-xs font-semibold uppercase tracking-[0.24em] text-planka-text-muted">
              <th className="px-4 py-4">
                <button
                  type="button"
                  onClick={() => updateSort("identifier")}
                  disabled={isPending}
                  className="transition hover:text-planka-text disabled:opacity-60"
                >
                  Identifier
                </button>
              </th>
              <th className="px-4 py-4">Title</th>
              <th className="px-4 py-4">Type</th>
              <th className="px-4 py-4">
                <button
                  type="button"
                  onClick={() => updateSort("priority")}
                  disabled={isPending}
                  className="transition hover:text-planka-text disabled:opacity-60"
                >
                  Priority
                </button>
              </th>
              <th className="px-4 py-4">Assignee</th>
              <th className="px-4 py-4">State</th>
              <th className="px-4 py-4">
                <button
                  type="button"
                  onClick={() => updateSort("created_at")}
                  disabled={isPending}
                  className="transition hover:text-planka-text disabled:opacity-60"
                >
                  Created
                </button>
              </th>
            </tr>
          </thead>
          <tbody>{renderRows(null, 0)}</tbody>
        </table>
      </div>
    </section>
  );
}

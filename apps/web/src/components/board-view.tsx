"use client";

import type { WorkspaceMemberRecord, WorkflowStateRecord, WorkItemRecord } from "@the-platform/shared";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { startTransition, useEffect, useState } from "react";

import type { ProjectWorkspaceEngineeringItemView } from "../features/workspace/project-workspace-view";
import { BoardColumn } from "./board-column";

interface BoardViewProps {
  workspaceSlug: string;
  projectKey: string;
  items: WorkItemRecord[];
  itemEngineering?: ProjectWorkspaceEngineeringItemView[];
  members: WorkspaceMemberRecord[];
  states: WorkflowStateRecord[];
  onOpenItem?: (identifier: string) => void;
}

function compareByPosition(left: WorkItemRecord, right: WorkItemRecord) {
  if (left.position !== right.position) {
    return left.position - right.position;
  }

  return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
}

function buildBoardColumns(items: WorkItemRecord[], states: WorkflowStateRecord[]) {
  return states.map((state) => ({
    state,
    items: items.filter((item) => item.workflowStateId === state.id).sort(compareByPosition)
  }));
}

function collectChangedItems(previousItems: WorkItemRecord[], nextItems: WorkItemRecord[]) {
  const previousById = new Map(previousItems.map((item) => [item.id, item]));

  return nextItems.filter((item) => {
    const previous = previousById.get(item.id);
    if (!previous) {
      return true;
    }

    return previous.position !== item.position || previous.workflowStateId !== item.workflowStateId;
  });
}

export function BoardView({
  workspaceSlug,
  projectKey,
  items,
  itemEngineering = [],
  members,
  states,
  onOpenItem
}: BoardViewProps) {
  const [localItems, setLocalItems] = useState(items);
  const engineeringByTaskId = new Map(itemEngineering.map((entry) => [entry.taskId, entry]));
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  useEffect(() => {
    setLocalItems(items);
  }, [items]);

  const childCounts = new Map<string, number>();
  for (const item of localItems) {
    if (!item.parentId) {
      continue;
    }

    childCounts.set(item.parentId, (childCounts.get(item.parentId) ?? 0) + 1);
  }

  async function persistMove(nextItem: WorkItemRecord, changedItems: WorkItemRecord[], previousItems: WorkItemRecord[]) {
    const response = await fetch(
      `/api/workspaces/${workspaceSlug}/projects/${projectKey}/items/${nextItem.identifier}/position`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          position: nextItem.position,
          workflowStateId: nextItem.workflowStateId,
          affectedItems: changedItems.map((item) => ({
            identifier: item.identifier,
            position: item.position,
            workflowStateId: item.workflowStateId
          }))
        })
      }
    );

    if (!response.ok) {
      setLocalItems(previousItems);
      return;
    }

    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object" || !("workItem" in payload)) {
      setLocalItems(previousItems);
      return;
    }

    const { workItem } = payload as { workItem: WorkItemRecord };
    setLocalItems((current) =>
      current.map((item) => (item.id === workItem.id ? workItem : item))
    );
  }

  function handleDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;

    if (!overId) {
      return;
    }

    const boardColumns = buildBoardColumns(localItems, states);
    const activeItem = boardColumns.flatMap((column) => column.items).find((item) => item.id === activeId);
    if (!activeItem) {
      return;
    }

    const sourceColumn = boardColumns.find((column) => column.state.id === activeItem.workflowStateId);
    if (!sourceColumn) {
      return;
    }

    const overItem = boardColumns.flatMap((column) => column.items).find((item) => item.id === overId);
    const targetStateId = overId.startsWith("column:") ? overId.slice("column:".length) : overItem?.workflowStateId;
    if (!targetStateId) {
      return;
    }

    const targetColumn = boardColumns.find((column) => column.state.id === targetStateId);
    if (!targetColumn) {
      return;
    }

    const sourceItems = sourceColumn.items.filter((item) => item.id !== activeItem.id);
    const targetItems =
      sourceColumn.state.id === targetColumn.state.id
        ? sourceItems
        : targetColumn.items.filter((item) => item.id !== activeItem.id);

    const targetIndex = overItem ? targetItems.findIndex((item) => item.id === overItem.id) : targetItems.length;
    const insertionIndex = targetIndex >= 0 ? targetIndex : targetItems.length;
    const nextTargetItems = [...targetItems];

    nextTargetItems.splice(insertionIndex, 0, {
      ...activeItem,
      workflowStateId: targetColumn.state.id
    });

    const nextColumns = boardColumns.map((column) => {
      if (column.state.id === sourceColumn.state.id && column.state.id === targetColumn.state.id) {
        return {
          ...column,
          items: nextTargetItems
        };
      }

      if (column.state.id === sourceColumn.state.id) {
        return {
          ...column,
          items: sourceItems
        };
      }

      if (column.state.id === targetColumn.state.id) {
        return {
          ...column,
          items: nextTargetItems
        };
      }

      return column;
    });

    const nextColumnItems = new Map<string, WorkItemRecord>();
    for (const column of nextColumns) {
      column.items.forEach((item, index) => {
        nextColumnItems.set(item.id, {
          ...item,
          workflowStateId: column.state.id,
          position: index * 1000
        });
      });
    }

    const previousItems = localItems;
    const nextItems = localItems.map((item) => nextColumnItems.get(item.id) ?? item);
    const movedItem = nextColumnItems.get(activeItem.id);

    if (!movedItem) {
      return;
    }

    const changedItems = collectChangedItems(previousItems, nextItems);

    setLocalItems(nextItems);
    startTransition(() => {
      void persistMove(movedItem, changedItems, previousItems);
    });
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
      <section className="overflow-x-auto pb-4">
        <div className="flex min-w-max gap-4">
          {buildBoardColumns(localItems, states).map((column) => (
            <BoardColumn
              key={column.state.id}
              state={column.state}
              items={column.items}
              engineeringByTaskId={engineeringByTaskId}
              members={members}
              childCounts={childCounts}
              {...(onOpenItem ? { onOpenItem } : {})}
            />
          ))}
        </div>
      </section>
    </DndContext>
  );
}

"use client";

import type { WorkspaceMemberRecord, WorkflowStateRecord, WorkItemRecord } from "@the-platform/shared";
import { useEffect, useState } from "react";

import { BoardView } from "./board-view";
import { FilterBar } from "./filter-bar";
import { ListView } from "./list-view";

interface ViewToggleProps {
  workspaceSlug: string;
  projectKey: string;
  items: WorkItemRecord[];
  members: WorkspaceMemberRecord[];
  states: WorkflowStateRecord[];
}

type ViewPreference = "board" | "list";

export function ViewToggle({ workspaceSlug, projectKey, items, members, states }: ViewToggleProps) {
  const [view, setView] = useState<ViewPreference>("board");

  useEffect(() => {
    const storedPreference = window.localStorage.getItem(`view-pref-${projectKey}`);
    if (storedPreference === "board" || storedPreference === "list") {
      setView(storedPreference);
    }
  }, [projectKey]);

  useEffect(() => {
    window.localStorage.setItem(`view-pref-${projectKey}`, view);
  }, [projectKey, view]);

  return (
    <div className="grid gap-5">
      <FilterBar members={members} states={states} />

      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-planka-accent">Project detail</p>
          <h2 className="mt-2 text-2xl font-semibold text-planka-text">Board and list views</h2>
        </div>
        <div className="inline-flex rounded-full border border-white/10 bg-black/15 p-1">
          {(["board", "list"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setView(option)}
              className={`rounded-full px-4 py-2 text-sm font-semibold uppercase tracking-[0.2em] transition ${
                view === option
                  ? "bg-planka-selected text-white"
                  : "text-planka-text-muted hover:text-planka-text"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {view === "board" ? (
        <BoardView
          workspaceSlug={workspaceSlug}
          projectKey={projectKey}
          items={items}
          members={members}
          states={states}
        />
      ) : (
        <ListView items={items} members={members} states={states} />
      )}
    </div>
  );
}

"use client";

import type {
  CommentRecord,
  DescriptionVersionRecord,
  WorkspaceMemberRecord,
  WorkspaceRole,
  WorkflowStateRecord,
  WorkItemRecord
} from "@the-platform/shared";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { BoardView } from "./board-view";
import { DetailPanel } from "./detail-panel";
import {
  buildDetailPanelOrigin,
  detailPanelOriginStorageKey
} from "./detail-panel-navigation";
import { FilterBar } from "./filter-bar";
import { ListView } from "./list-view";
import type { TimelineEntry } from "./timeline";

interface ViewToggleProps {
  workspaceSlug: string;
  projectKey: string;
  basePath: string;
  items: WorkItemRecord[];
  members: WorkspaceMemberRecord[];
  states: WorkflowStateRecord[];
  selectedItem?: WorkItemRecord | null;
  comments?: CommentRecord[];
  versions?: DescriptionVersionRecord[];
  timeline?: TimelineEntry[];
  sessionUserId: string;
  membershipRole: WorkspaceRole;
}

type ViewPreference = "board" | "list";

function buildViewHref(
  basePath: string,
  searchParams: ReturnType<typeof useSearchParams>,
  view: ViewPreference
) {
  const params = new URLSearchParams(searchParams.toString());
  params.set("view", view);

  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function ViewToggle({
  workspaceSlug,
  projectKey,
  basePath,
  items,
  members,
  states,
  selectedItem,
  comments = [],
  versions = [],
  timeline = [],
  sessionUserId,
  membershipRole
}: ViewToggleProps) {
  const [view, setView] = useState<ViewPreference>("board");
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const queryView = searchParams.get("view");

    if (queryView === "board") {
      setView("board");
      return;
    }

    if (queryView === "list") {
      setView("list");
      return;
    }

    const storedPreference = window.localStorage.getItem(`view-pref-${projectKey}`);
    if (storedPreference === "list") {
      setView(storedPreference);
      router.replace(buildViewHref(basePath, searchParams, "list"), { scroll: false });
      return;
    }

    setView("board");
  }, [basePath, projectKey, router, searchParams]);

  useEffect(() => {
    window.localStorage.setItem(`view-pref-${projectKey}`, view);
  }, [projectKey, view]);

  function setViewPreference(nextView: ViewPreference) {
    setView(nextView);
    router.replace(buildViewHref(basePath, searchParams, nextView), { scroll: false });
  }

  function openItem(identifier: string) {
    const queryString = searchParams.toString();
    window.sessionStorage.setItem(
      detailPanelOriginStorageKey,
      buildDetailPanelOrigin(basePath, queryString)
    );
    router.push(`${basePath}/items/${identifier}${queryString ? `?${queryString}` : ""}`);
  }

  return (
    <div className="grid gap-5">
      <FilterBar members={members} states={states} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-planka-accent">Project detail</p>
          <h2 className="mt-2 text-2xl font-semibold text-planka-text">Board and list views</h2>
        </div>
        <div className="inline-flex rounded-full border border-white/10 bg-black/20 p-1 shadow-inner">
          {(["board", "list"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setViewPreference(option)}
              className={`rounded-full px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition-all ${
                view === option
                  ? "bg-planka-selected text-white shadow-[0_10px_30px_rgba(43,108,217,0.3)]"
                  : "text-planka-text-muted hover:bg-white/6 hover:text-planka-text"
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
          onOpenItem={openItem}
        />
      ) : (
        <ListView items={items} members={members} states={states} onOpenItem={openItem} />
      )}

      {selectedItem ? (
        <DetailPanel
          workspaceSlug={workspaceSlug}
          projectKey={projectKey}
          basePath={basePath}
          item={selectedItem}
          comments={comments}
          versions={versions}
          timeline={timeline}
          members={members}
          states={states}
          sessionUserId={sessionUserId}
          membershipRole={membershipRole}
        />
      ) : null}
    </div>
  );
}

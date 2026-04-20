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
import { useEffect, useState, useTransition } from "react";

import { CommentInput } from "./comment-input";
import { CommentList } from "./comment-list";
import { DescriptionEditor } from "./description-editor";
import {
  buildDetailPanelOrigin,
  detailPanelOriginStorageKey,
  getDetailPanelCloseMode
} from "./detail-panel-navigation";
import { DiffViewer } from "./diff-viewer";
import { MetadataSidebar } from "./metadata-sidebar";
import { Timeline, type TimelineEntry } from "./timeline";

interface DetailPanelProps {
  workspaceSlug: string;
  projectKey: string;
  basePath: string;
  item: WorkItemRecord;
  comments: CommentRecord[];
  versions: DescriptionVersionRecord[];
  timeline: TimelineEntry[];
  members: WorkspaceMemberRecord[];
  states: WorkflowStateRecord[];
  sessionUserId: string;
  membershipRole: WorkspaceRole;
}

function canModerate(role: WorkspaceRole) {
  return role === "owner" || role === "admin";
}

export function DetailPanel({
  workspaceSlug,
  projectKey,
  basePath,
  item,
  comments,
  versions,
  timeline,
  members,
  states,
  sessionUserId,
  membershipRole
}: DetailPanelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [localItem, setLocalItem] = useState(item);
  const [localComments, setLocalComments] = useState(comments);
  const [titleDraft, setTitleDraft] = useState(item.title);
  const canEdit = membershipRole !== "viewer";

  useEffect(() => {
    setLocalItem(item);
    setLocalComments(comments);
    setTitleDraft(item.title);
  }, [comments, item]);

  function closePanel() {
    const expectedOrigin = buildDetailPanelOrigin(basePath, searchParams.toString());
    const recordedOrigin = window.sessionStorage.getItem(detailPanelOriginStorageKey);
    window.sessionStorage.removeItem(detailPanelOriginStorageKey);

    if (getDetailPanelCloseMode(recordedOrigin, expectedOrigin) === "back") {
      router.back();
      return;
    }

    router.replace(expectedOrigin);
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closePanel();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [basePath, router, searchParams]);

  useEffect(() => {
    if (!canEdit || titleDraft === localItem.title) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void patchWorkItem({ title: titleDraft });
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [canEdit, localItem.title, titleDraft]);

  async function patchWorkItem(
    patch: Partial<Pick<WorkItemRecord, "title" | "priority" | "type" | "workflowStateId" | "assigneeId">>
  ) {
    const previousItem = localItem;
    const optimisticItem = {
      ...localItem,
      ...patch
    };

    setLocalItem(optimisticItem);

    const response = await fetch(
      `/api/workspaces/${workspaceSlug}/projects/${projectKey}/items/${item.identifier}`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(patch)
      }
    );

    if (!response.ok) {
      setLocalItem(previousItem);
      setTitleDraft(previousItem.title);
      return;
    }

    const payload = (await response.json()) as { workItem: WorkItemRecord };
    setLocalItem(payload.workItem);
    setTitleDraft(payload.workItem.title);
    startTransition(() => {
      router.refresh();
    });
  }

  async function saveDescription(content: string) {
    const previousItem = localItem;
    setLocalItem((current) => ({
      ...current,
      description: content
    }));

    const response = await fetch(
      `/api/workspaces/${workspaceSlug}/projects/${projectKey}/items/${item.identifier}/description`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ content })
      }
    );

    if (!response.ok) {
      setLocalItem(previousItem);
      return;
    }

    const payload = (await response.json()) as { workItem: WorkItemRecord };
    setLocalItem(payload.workItem);
    startTransition(() => {
      router.refresh();
    });
  }

  async function createComment(content: string) {
    const response = await fetch(
      `/api/workspaces/${workspaceSlug}/projects/${projectKey}/items/${item.identifier}/comments`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ content })
      }
    );

    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as { comment: CommentRecord };
    setLocalComments((current) => [...current, payload.comment]);
    startTransition(() => {
      router.refresh();
    });
  }

  async function updateComment(commentId: string, content: string) {
    const response = await fetch(
      `/api/workspaces/${workspaceSlug}/projects/${projectKey}/items/${item.identifier}/comments/${commentId}`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ content })
      }
    );

    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as { comment: CommentRecord };
    setLocalComments((current) =>
      current.map((comment) => (comment.id === payload.comment.id ? payload.comment : comment))
    );
    startTransition(() => {
      router.refresh();
    });
  }

  async function deleteComment(commentId: string) {
    const response = await fetch(
      `/api/workspaces/${workspaceSlug}/projects/${projectKey}/items/${item.identifier}/comments/${commentId}`,
      {
        method: "DELETE"
      }
    );

    if (!response.ok) {
      return;
    }

    setLocalComments((current) => current.filter((comment) => comment.id !== commentId));
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close detail panel"
        onClick={closePanel}
        className="absolute inset-0 bg-black/65 backdrop-blur-sm"
      />

      <section className="relative z-10 flex h-full w-full max-w-[42rem] flex-col overflow-y-auto border-l border-white/10 bg-[#0f1728] shadow-[0_32px_120px_rgba(0,0,0,0.45)]">
        <header className="border-b border-white/8 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="grid gap-3">
              <span className="w-fit rounded-full bg-planka-selected px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white">
                {localItem.identifier}
              </span>
              <input
                value={titleDraft}
                onChange={(event) => setTitleDraft(event.target.value)}
                disabled={!canEdit || isPending}
                className="bg-transparent text-3xl font-semibold text-planka-text outline-none disabled:opacity-80"
              />
            </div>

            <button
              type="button"
              onClick={closePanel}
              className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-planka-text-muted transition hover:text-planka-text"
            >
              Close
            </button>
          </div>
        </header>

        <div className="grid gap-6 px-6 py-6 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="grid gap-6">
            <DescriptionEditor
              value={localItem.description}
              canEdit={canEdit}
              disabled={isPending}
              onSave={saveDescription}
            />

            <section className="grid gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-planka-accent">
                  Description history
                </p>
                <h3 className="mt-2 text-xl font-semibold text-planka-text">Inline diff view</h3>
              </div>
              <DiffViewer currentContent={localItem.description} versions={versions} />
            </section>

            <section className="grid gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-planka-accent">Comments</p>
                <h3 className="mt-2 text-xl font-semibold text-planka-text">Thread</h3>
              </div>
              <CommentInput canEdit={canEdit} disabled={isPending} onSubmit={createComment} />
              <CommentList
                comments={localComments}
                currentUserId={sessionUserId}
                canModerate={canModerate(membershipRole)}
                disabled={isPending}
                onUpdate={updateComment}
                onDelete={deleteComment}
              />
            </section>

            <section className="grid gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-planka-accent">Timeline</p>
                <h3 className="mt-2 text-xl font-semibold text-planka-text">Activity and comments</h3>
              </div>
              <Timeline entries={timeline} />
            </section>
          </div>

          <MetadataSidebar
            item={localItem}
            members={members}
            states={states}
            canEdit={canEdit}
            disabled={isPending}
            onFieldChange={(field, value) => {
              void patchWorkItem({
                [field]: value
              });
            }}
          />
        </div>
      </section>
    </div>
  );
}

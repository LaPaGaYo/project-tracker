"use client";

import type { CommentRecord } from "@the-platform/shared";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface CommentListProps {
  comments: CommentRecord[];
  currentUserId: string;
  canModerate: boolean;
  disabled?: boolean;
  onUpdate: (commentId: string, content: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString();
}

export function CommentList({
  comments,
  currentUserId,
  canModerate,
  disabled = false,
  onUpdate,
  onDelete
}: CommentListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    setDrafts(Object.fromEntries(comments.map((comment) => [comment.id, comment.content])));
  }, [comments]);

  if (comments.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-white/12 px-4 py-6 text-sm text-planka-text-muted">
        No comments yet.
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {comments.map((comment) => {
        const canEdit = canModerate || comment.authorId === currentUserId;
        const isEditing = editingId === comment.id;

        return (
          <article key={comment.id} className="rounded-3xl border border-white/8 bg-black/15 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-planka-accent">
                  {comment.authorId}
                </p>
                <p className="mt-1 text-xs text-planka-text-muted">{formatTimestamp(comment.createdAt)}</p>
              </div>

              {canEdit ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setEditingId((current) => (current === comment.id ? null : comment.id))}
                    className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-planka-text-muted transition hover:text-planka-text disabled:opacity-60"
                  >
                    {isEditing ? "Cancel" : "Edit"}
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      void onDelete(comment.id);
                    }}
                    className="rounded-full border border-rose-400/30 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-rose-200 transition disabled:opacity-60"
                  >
                    Delete
                  </button>
                </div>
              ) : null}
            </div>

            {isEditing ? (
              <div className="mt-4 grid gap-3">
                <textarea
                  value={drafts[comment.id] ?? comment.content}
                  onChange={(event) =>
                    setDrafts((current) => ({
                      ...current,
                      [comment.id]: event.target.value
                    }))
                  }
                  rows={4}
                  disabled={disabled}
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-planka-text outline-none transition focus:border-planka-accent disabled:opacity-60"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={disabled || (drafts[comment.id] ?? "").trim().length === 0}
                    onClick={() => {
                      void onUpdate(comment.id, (drafts[comment.id] ?? "").trim()).then(() => {
                        setEditingId(null);
                      });
                    }}
                    className="rounded-full bg-planka-selected px-4 py-2 text-sm font-semibold uppercase tracking-[0.2em] text-white transition disabled:opacity-60"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <div className="prose prose-invert mt-4 max-w-none text-sm prose-p:my-2">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{comment.content}</ReactMarkdown>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

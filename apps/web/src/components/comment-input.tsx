"use client";

import { useState } from "react";

interface CommentInputProps {
  canEdit: boolean;
  disabled?: boolean;
  onSubmit: (content: string) => Promise<void>;
}

export function CommentInput({ canEdit, disabled = false, onSubmit }: CommentInputProps) {
  const [content, setContent] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextContent = content.trim();
    if (!nextContent) {
      return;
    }

    await onSubmit(nextContent);
    setContent("");
  }

  if (!canEdit) {
    return (
      <div className="rounded-3xl border border-dashed border-white/12 px-4 py-6 text-sm text-planka-text-muted">
        Viewer access can read comments but cannot add them.
      </div>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        void handleSubmit(event);
      }}
      className="grid gap-3 rounded-3xl border border-white/8 bg-black/15 p-4"
    >
      <label className="text-xs font-semibold uppercase tracking-[0.24em] text-planka-accent">New comment</label>
      <textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        rows={4}
        disabled={disabled}
        placeholder="Write a markdown comment..."
        className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-planka-text outline-none transition placeholder:text-planka-text-muted focus:border-planka-accent disabled:opacity-60"
      />
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={disabled || content.trim().length === 0}
          className="rounded-full bg-planka-selected px-4 py-2 text-sm font-semibold uppercase tracking-[0.2em] text-white transition disabled:opacity-60"
        >
          Post comment
        </button>
      </div>
    </form>
  );
}

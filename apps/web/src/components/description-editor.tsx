"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface DescriptionEditorProps {
  value: string;
  canEdit: boolean;
  disabled?: boolean;
  onSave: (content: string) => Promise<void>;
}

type EditorMode = "write" | "preview";

export function DescriptionEditor({
  value,
  canEdit,
  disabled = false,
  onSave
}: DescriptionEditorProps) {
  const [mode, setMode] = useState<EditorMode>("write");
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <div className="grid gap-4 rounded-3xl border border-white/8 bg-black/15 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-planka-accent">Description</p>
        <div className="inline-flex rounded-full border border-white/10 bg-black/20 p-1">
          {(["write", "preview"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setMode(option)}
              className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] transition ${
                mode === option ? "bg-planka-selected text-white" : "text-planka-text-muted hover:text-planka-text"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {mode === "write" ? (
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          disabled={disabled || !canEdit}
          rows={10}
          className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-planka-text outline-none transition focus:border-planka-accent disabled:opacity-60"
        />
      ) : (
        <div className="prose prose-invert min-h-[12rem] max-w-none rounded-2xl border border-white/8 bg-black/20 px-4 py-3 prose-p:my-2">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {draft || "Nothing to preview yet."}
          </ReactMarkdown>
        </div>
      )}

      {canEdit ? (
        <div className="flex justify-end">
          <button
            type="button"
            disabled={disabled || draft === value}
            onClick={() => {
              void onSave(draft);
            }}
            className="rounded-full bg-planka-selected px-4 py-2 text-sm font-semibold uppercase tracking-[0.2em] text-white transition disabled:opacity-60"
          >
            Save description
          </button>
        </div>
      ) : null}
    </div>
  );
}

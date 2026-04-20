import type { ActivityLogRecord, CommentRecord } from "@the-platform/shared";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export type TimelineEntry =
  | {
      kind: "activity";
      createdAt: string;
      activity: ActivityLogRecord;
    }
  | {
      kind: "comment";
      createdAt: string;
      comment: CommentRecord;
    };

interface TimelineProps {
  entries: TimelineEntry[];
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString();
}

function describeActivity(entry: ActivityLogRecord) {
  if (entry.action === "assigned") {
    return "Assignment updated";
  }

  if (entry.action === "moved") {
    return "Position changed";
  }

  if (entry.action === "state_changed") {
    return "Workflow state changed";
  }

  if (entry.action === "deleted") {
    return "Item deleted";
  }

  if (entry.action === "updated") {
    return "Item updated";
  }

  return "Item created";
}

export function Timeline({ entries }: TimelineProps) {
  if (entries.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-white/12 px-4 py-6 text-sm text-planka-text-muted">
        No timeline activity yet.
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {entries.map((entry, index) => (
        <article key={`${entry.kind}-${index}-${entry.createdAt}`} className="rounded-3xl border border-white/8 bg-black/15 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-planka-accent">
              {entry.kind === "comment" ? "Comment" : describeActivity(entry.activity)}
            </p>
            <p className="text-xs text-planka-text-muted">{formatTimestamp(entry.createdAt)}</p>
          </div>

          {entry.kind === "comment" ? (
            <div className="prose prose-invert mt-3 max-w-none text-sm prose-p:my-2">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{entry.comment.content}</ReactMarkdown>
            </div>
          ) : (
            <pre className="mt-3 whitespace-pre-wrap text-sm leading-6 text-planka-text-muted">
              {JSON.stringify(entry.activity.metadata ?? {}, null, 2)}
            </pre>
          )}
        </article>
      ))}
    </div>
  );
}

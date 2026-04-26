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
  const metadata = entry.metadata ?? {};

  if (entry.action === "assigned") {
    const assigneeId =
      typeof metadata.after === "string"
        ? metadata.after
        : typeof metadata.assigneeId === "string"
          ? metadata.assigneeId
          : null;
    return `Assigned to ${assigneeId ?? "unassigned"}`;
  }

  if (entry.action === "moved") {
    return "Changed position on board";
  }

  if (entry.action === "state_changed") {
    const from =
      typeof metadata.before === "string"
        ? metadata.before
        : typeof metadata.from === "string"
          ? metadata.from
          : "none";
    const to =
      typeof metadata.after === "string"
        ? metadata.after
        : typeof metadata.to === "string"
          ? metadata.to
          : "none";
    return `Moved from ${from} to ${to}`;
  }

  if (entry.action === "deleted") {
    return "Deleted work item";
  }

  if (entry.action === "updated") {
    const fields = Object.keys(metadata).join(", ");
    return `Updated ${fields || "item"}`;
  }

  return "Created work item";
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
          ) : null}
        </article>
      ))}
    </div>
  );
}

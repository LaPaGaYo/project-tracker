import type { DescriptionVersionRecord } from "@the-platform/shared";
import { diffLines } from "diff";

interface DiffViewerProps {
  currentContent: string;
  versions: DescriptionVersionRecord[];
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString();
}

export function DiffViewer({ currentContent, versions }: DiffViewerProps) {
  if (versions.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-white/12 px-4 py-6 text-sm text-planka-text-muted">
        No prior description versions yet.
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {versions.slice(0, 3).map((version) => {
        const parts = diffLines(version.content, currentContent);

        return (
          <article key={version.id} className="rounded-3xl border border-white/8 bg-black/15 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-planka-accent">
              Compared with {formatTimestamp(version.createdAt)}
            </p>
            <div className="mt-4 whitespace-pre-wrap rounded-2xl border border-white/8 bg-black/20 p-4 text-sm leading-6">
              {parts.map((part, index) => (
                <span
                  key={`${version.id}-${index}`}
                  className={
                    part.added
                      ? "bg-emerald-500/20 text-emerald-100"
                      : part.removed
                        ? "bg-rose-500/20 text-rose-100 line-through"
                        : "text-planka-text-muted"
                  }
                >
                  {part.value}
                </span>
              ))}
            </div>
          </article>
        );
      })}
    </div>
  );
}

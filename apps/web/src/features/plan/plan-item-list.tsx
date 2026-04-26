import type { PlanItemViewModel } from "./types";

export function PlanItemList({ items }: { items: PlanItemViewModel[] }) {
  return (
    <section
      aria-label="Plan items"
      className="rounded-[2rem] border border-white/10 bg-planka-card/90 p-5 shadow-[0_18px_46px_rgba(0,0,0,0.18)]"
    >
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-planka-text-muted">Plan items</h2>
        <p className="mt-1 text-sm text-planka-text-muted">Keep stage outcomes and linked execution work aligned.</p>
      </div>

      <div className="mt-4 grid gap-4">
        {items.map((item) => (
          <article
            key={`${item.stageTitle}-${item.title}`}
            aria-label={item.title}
            className="rounded-[1.5rem] border border-white/10 bg-black/10 p-4"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-planka-text-muted">{item.stageTitle}</p>
            <h3 className="mt-2 text-lg font-semibold text-planka-text">{item.title}</h3>
            <p className="mt-3 text-sm leading-7 text-planka-text-muted">{item.description}</p>
            <p className="mt-4 text-sm text-planka-text">Linked issues: {item.linkedIssues.join(", ") || "None"}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

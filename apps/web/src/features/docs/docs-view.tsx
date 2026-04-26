import type { ProjectWorkspaceContent } from "../../lib/content/project-workspace";

type DocPage = ProjectWorkspaceContent["docs"][number];

export function DocsView({ docs }: { docs: readonly DocPage[] }) {
  const primaryDoc = docs[0];

  if (!primaryDoc) {
    return (
      <section className="rounded-[2rem] border border-white/10 bg-planka-card/90 p-6 shadow-[0_18px_46px_rgba(0,0,0,0.18)]">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-planka-text-muted">Docs</p>
        <h1 className="mt-1 text-3xl font-semibold text-planka-text">Light collaboration</h1>
        <p className="mt-4 text-sm leading-7 text-planka-text-muted">No workspace documents are available yet.</p>
      </section>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-[18rem_minmax(0,1fr)]">
      <aside className="rounded-[2rem] border border-white/10 bg-planka-card/90 p-5 shadow-[0_18px_46px_rgba(0,0,0,0.18)]">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-planka-text-muted">Docs</p>
        <h1 className="mt-1 text-2xl font-semibold text-planka-text">Light collaboration</h1>
        <div className="mt-5 space-y-3">
          {docs.map((doc) => (
            <div
              key={doc.slug}
              className="rounded-[1.5rem] border border-white/10 bg-black/10 px-4 py-4 text-sm font-medium text-planka-text"
            >
              {doc.title}
            </div>
          ))}
        </div>
      </aside>

      <article className="rounded-[2rem] border border-white/10 bg-planka-card/90 p-6 shadow-[0_18px_46px_rgba(0,0,0,0.18)]">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-planka-text-muted">Selected doc</p>
        <h2 className="mt-1 text-3xl font-semibold text-planka-text">{primaryDoc.title}</h2>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-planka-text-muted">{primaryDoc.body}</p>
      </article>
    </div>
  );
}

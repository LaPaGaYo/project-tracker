interface EngineeringViewModel {
  pullRequests: string;
  checks: string;
  deploys: string;
  issueSummary: string[];
}

export function EngineeringView({ engineering }: { engineering: EngineeringViewModel }) {
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <section className="rounded-[2rem] border border-white/10 bg-planka-card/90 p-5 shadow-[0_18px_46px_rgba(0,0,0,0.18)]">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-planka-text-muted">Pull requests</p>
        <p className="mt-2 text-2xl font-semibold text-planka-text">{engineering.pullRequests}</p>
      </section>
      <section className="rounded-[2rem] border border-white/10 bg-planka-card/90 p-5 shadow-[0_18px_46px_rgba(0,0,0,0.18)]">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-planka-text-muted">Checks</p>
        <p className="mt-2 text-2xl font-semibold text-planka-text">{engineering.checks}</p>
      </section>
      <section className="rounded-[2rem] border border-white/10 bg-planka-card/90 p-5 shadow-[0_18px_46px_rgba(0,0,0,0.18)]">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-planka-text-muted">Deploys</p>
        <p className="mt-2 text-2xl font-semibold text-planka-text">{engineering.deploys}</p>
      </section>
      <section className="rounded-[2rem] border border-white/10 bg-black/10 p-5 shadow-[0_18px_46px_rgba(0,0,0,0.18)] xl:col-span-3">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-planka-text-muted">Issue summary</p>
        <div className="mt-4 space-y-3">
          {engineering.issueSummary.map((item) => (
            <div key={item} className="rounded-[1.5rem] border border-white/10 bg-black/10 px-4 py-4 text-sm text-planka-text">
              {item}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

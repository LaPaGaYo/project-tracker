import type { ProjectWorkspaceEngineeringView } from "../workspace/project-workspace-view";

function renderAction(label: string, href: string | null) {
  if (!href) {
    return <span className="text-sm font-semibold text-planka-text">{label}</span>;
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-sm font-semibold text-planka-text transition hover:text-white"
    >
      {label}
    </a>
  );
}

export function EngineeringView({ engineering }: { engineering: ProjectWorkspaceEngineeringView }) {
  const linkedPullRequests = engineering.items.filter((item) => item.hasPullRequest);
  const failingChecks = engineering.items.filter((item) => item.hasFailingChecks);
  const deployments = engineering.items.filter((item) => item.hasDeploy);

  return (
    <div className="grid gap-4 xl:grid-cols-4">
      <section className="rounded-[2rem] border border-white/10 bg-planka-card/90 p-5 shadow-[0_18px_46px_rgba(0,0,0,0.18)]">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-planka-text-muted">Sync health</p>
        <p className="mt-2 text-sm font-semibold text-planka-text">{engineering.repository}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs uppercase tracking-[0.16em] text-planka-text-muted">
          <span className="rounded-full border border-white/10 px-3 py-1">{engineering.connectionStatus}</span>
          <span className="rounded-full border border-white/10 px-3 py-1">{engineering.defaultBranch ?? "no branch"}</span>
        </div>
        {engineering.connectionStatus === "Setup required" ? (
          <div className="mt-4 rounded-[1.5rem] border border-dashed border-white/15 bg-black/10 px-4 py-4 text-sm leading-6 text-planka-text-muted">
            Connect GitHub to populate engineering readiness signals.
          </div>
        ) : null}
      </section>
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

      <section className="rounded-[2rem] border border-white/10 bg-black/10 p-5 shadow-[0_18px_46px_rgba(0,0,0,0.18)] xl:col-span-2">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-planka-text-muted">Linked pull requests</p>
        <div className="mt-4 space-y-3">
          {linkedPullRequests.length > 0 ? (
            linkedPullRequests.map((item) => (
              <div key={item.taskId} className="rounded-[1.5rem] border border-white/10 bg-black/10 px-4 py-4 text-sm text-planka-text">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-planka-text">{item.identifier}</p>
                    <p className="mt-1 text-xs text-planka-text-muted">{item.title}</p>
                  </div>
                  {renderAction(item.pullRequestLabel, item.pullRequestUrl)}
                </div>
                <p className="mt-3 text-xs uppercase tracking-[0.16em] text-planka-text-muted">
                  {item.branchName ?? "No linked branch"}
                </p>
              </div>
            ))
          ) : (
            <div className="rounded-[1.5rem] border border-white/10 bg-black/10 px-4 py-4 text-sm text-planka-text-muted">
              No linked pull requests yet.
            </div>
          )}
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-black/10 p-5 shadow-[0_18px_46px_rgba(0,0,0,0.18)]">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-planka-text-muted">Failing checks</p>
        <div className="mt-4 space-y-3">
          {failingChecks.length > 0 ? (
            failingChecks.map((item) => (
              <div key={item.taskId} className="rounded-[1.5rem] border border-white/10 bg-black/10 px-4 py-4 text-sm text-planka-text">
                <p className="font-semibold text-planka-text">{item.identifier}</p>
                <div className="mt-2">{renderAction(item.checkLabel, item.checkUrl)}</div>
              </div>
            ))
          ) : (
            <div className="rounded-[1.5rem] border border-white/10 bg-black/10 px-4 py-4 text-sm text-planka-text-muted">
              No failing checks.
            </div>
          )}
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-black/10 p-5 shadow-[0_18px_46px_rgba(0,0,0,0.18)]">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-planka-text-muted">Deployments</p>
        <div className="mt-4 space-y-3">
          {deployments.length > 0 ? (
            deployments.map((item) => (
              <div key={item.taskId} className="rounded-[1.5rem] border border-white/10 bg-black/10 px-4 py-4 text-sm text-planka-text">
                <p className="font-semibold text-planka-text">{item.identifier}</p>
                <div className="mt-2">{renderAction(item.deployLabel, item.deployUrl)}</div>
                <p className="mt-2 text-xs uppercase tracking-[0.16em] text-planka-text-muted">
                  {item.deployEnvironment ?? "not deployed"}
                </p>
              </div>
            ))
          ) : (
            <div className="rounded-[1.5rem] border border-white/10 bg-black/10 px-4 py-4 text-sm text-planka-text-muted">
              No active deployments.
            </div>
          )}
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-black/10 p-5 shadow-[0_18px_46px_rgba(0,0,0,0.18)] xl:col-span-4">
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

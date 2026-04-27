import { importGithubProjectAction } from "@/app/actions";

interface GithubImportPanelProps {
  workspaceSlug: string;
  canImport: boolean;
}

export function GithubImportPanel({ canImport, workspaceSlug }: GithubImportPanelProps) {
  return (
    <section className="rounded-[2rem] border border-white/8 bg-black/15 p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-planka-accent">Repository onboarding</p>
      <h2 className="mt-4 text-2xl font-semibold text-planka-text">Import from GitHub</h2>
      <p className="mt-3 text-sm leading-7 text-planka-text-muted">
        Start a project from a selected GitHub App repository and connect engineering signals from the first day.
      </p>

      {!canImport ? (
        <div className="mt-5 rounded-3xl border border-dashed border-white/12 bg-black/10 px-5 py-5 text-sm leading-7 text-planka-text-muted">
          Workspace admin access is required to import GitHub projects.
        </div>
      ) : (
        <form action={importGithubProjectAction.bind(null, workspaceSlug)} className="mt-6 grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-2 text-sm text-planka-text">
              <span>Repository owner</span>
              <input
                required
                name="owner"
                placeholder="the-platform"
                className="rounded-2xl border border-white/10 bg-planka-bg px-4 py-3 outline-none placeholder:text-planka-text-muted"
              />
            </label>
            <label className="grid gap-2 text-sm text-planka-text">
              <span>Repository name</span>
              <input
                required
                name="name"
                placeholder="platform-ops"
                className="rounded-2xl border border-white/10 bg-planka-bg px-4 py-3 outline-none placeholder:text-planka-text-muted"
              />
            </label>
          </div>

          <label className="grid gap-2 text-sm text-planka-text">
            <span>Provider repository ID</span>
            <input
              required
              name="providerRepositoryId"
              placeholder="123456789"
              className="rounded-2xl border border-white/10 bg-planka-bg px-4 py-3 outline-none placeholder:text-planka-text-muted"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-2 text-sm text-planka-text">
              <span>Default branch</span>
              <input
                required
                name="defaultBranch"
                defaultValue="main"
                className="rounded-2xl border border-white/10 bg-planka-bg px-4 py-3 outline-none placeholder:text-planka-text-muted"
              />
            </label>
            <label className="grid gap-2 text-sm text-planka-text">
              <span>Installation ID</span>
              <input
                required
                name="installationId"
                placeholder="987654"
                className="rounded-2xl border border-white/10 bg-planka-bg px-4 py-3 outline-none placeholder:text-planka-text-muted"
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-2 text-sm text-planka-text">
              <span>Project name</span>
              <input
                name="projectName"
                placeholder="Platform Ops"
                className="rounded-2xl border border-white/10 bg-planka-bg px-4 py-3 outline-none placeholder:text-planka-text-muted"
              />
            </label>
            <label className="grid gap-2 text-sm text-planka-text">
              <span>Project key</span>
              <input
                name="key"
                maxLength={8}
                placeholder="OPS"
                className="rounded-2xl border border-white/10 bg-planka-bg px-4 py-3 uppercase outline-none placeholder:text-planka-text-muted"
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-2 text-sm text-planka-text">
              <span>Staging environment</span>
              <input
                name="stagingEnvironmentName"
                placeholder="staging"
                className="rounded-2xl border border-white/10 bg-planka-bg px-4 py-3 outline-none placeholder:text-planka-text-muted"
              />
            </label>
            <label className="grid gap-2 text-sm text-planka-text">
              <span>Production environment</span>
              <input
                name="productionEnvironmentName"
                placeholder="production"
                className="rounded-2xl border border-white/10 bg-planka-bg px-4 py-3 outline-none placeholder:text-planka-text-muted"
              />
            </label>
          </div>

          <p className="rounded-3xl border border-white/8 bg-black/10 px-4 py-3 text-xs leading-6 text-planka-text-muted">
            This form uses repository metadata only. GitHub installation access tokens stay server-side.
          </p>
          <button className="rounded-2xl bg-planka-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-planka-accent-hover">
            Import repository
          </button>
        </form>
      )}
    </section>
  );
}

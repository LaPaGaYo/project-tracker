import { createProjectAction } from "@/app/actions";

interface CreateProjectDialogProps {
  workspaceSlug: string;
  canCreate: boolean;
}

export function CreateProjectDialog({ workspaceSlug, canCreate }: CreateProjectDialogProps) {
  if (!canCreate) {
    return (
      <div className="rounded-3xl border border-dashed border-white/12 bg-black/10 px-5 py-5 text-sm text-planka-text-muted">
        Viewer access is read-only. Ask an owner, admin, or member to create projects.
      </div>
    );
  }

  return (
    <details className="rounded-3xl border border-white/8 bg-black/10 p-5">
      <summary className="cursor-pointer list-none text-sm font-semibold uppercase tracking-[0.2em] text-planka-accent">
        Create project
      </summary>
      <form action={createProjectAction.bind(null, workspaceSlug)} className="mt-5 grid gap-4">
        <label className="grid gap-2 text-sm text-planka-text">
          <span>Name</span>
          <input
            required
            name="name"
            placeholder="Platform Ops"
            className="rounded-2xl border border-white/10 bg-planka-bg px-4 py-3 outline-none placeholder:text-planka-text-muted"
          />
        </label>
        <label className="grid gap-2 text-sm text-planka-text">
          <span>Key</span>
          <input
            required
            name="key"
            maxLength={8}
            placeholder="OPS"
            className="rounded-2xl border border-white/10 bg-planka-bg px-4 py-3 uppercase outline-none placeholder:text-planka-text-muted"
          />
        </label>
        <label className="grid gap-2 text-sm text-planka-text">
          <span>Description</span>
          <textarea
            name="description"
            rows={4}
            placeholder="Operational control plane for the team."
            className="rounded-2xl border border-white/10 bg-planka-bg px-4 py-3 outline-none placeholder:text-planka-text-muted"
          />
        </label>
        <button className="rounded-2xl bg-planka-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-planka-accent-hover">
          Create project
        </button>
      </form>
    </details>
  );
}

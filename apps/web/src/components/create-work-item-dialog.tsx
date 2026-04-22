"use client";

import { useFormStatus } from "react-dom";
import type { WorkflowStateRecord } from "@the-platform/shared";

import { createWorkItemAction } from "@/app/actions";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      disabled={pending}
      className="rounded-2xl bg-planka-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-planka-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Creating..." : "Create work item"}
    </button>
  );
}

interface CreateWorkItemDialogProps {
  workspaceSlug: string;
  projectKey: string;
  states: WorkflowStateRecord[];
  canCreate: boolean;
}

export function CreateWorkItemDialog({
  workspaceSlug,
  projectKey,
  states,
  canCreate
}: CreateWorkItemDialogProps) {
  if (!canCreate) {
    return (
      <div className="rounded-3xl border border-dashed border-white/12 bg-black/10 px-5 py-5 text-sm text-planka-text-muted">
        Viewer access is read-only. Work items can be created by members, admins, and owners.
      </div>
    );
  }

  return (
    <details className="group rounded-3xl border border-white/8 bg-black/10 p-5">
      <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold uppercase tracking-[0.2em] text-planka-accent">
        <span>Create work item</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-5 w-5 transition-transform group-open:rotate-180"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
            clipRule="evenodd"
          />
        </svg>
      </summary>
      <form action={createWorkItemAction.bind(null, workspaceSlug, projectKey)} className="mt-5 grid gap-4">
        <label className="grid gap-2 text-sm text-planka-text">
          <span>Title</span>
          <input
            required
            name="title"
            placeholder="Harden OAuth callback flow"
            className="rounded-2xl border border-white/10 bg-planka-bg px-4 py-3 outline-none placeholder:text-planka-text-muted"
          />
        </label>
        <label className="grid gap-2 text-sm text-planka-text">
          <span>Description</span>
          <textarea
            name="description"
            rows={4}
            placeholder="Track the concrete implementation work."
            className="rounded-2xl border border-white/10 bg-planka-bg px-4 py-3 outline-none placeholder:text-planka-text-muted"
          />
        </label>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="grid gap-2 text-sm text-planka-text">
            <span>Type</span>
            <select
              name="type"
              defaultValue="task"
              className="rounded-2xl border border-white/10 bg-planka-bg px-4 py-3 outline-none"
            >
              <option value="epic">epic</option>
              <option value="task">task</option>
              <option value="subtask">subtask</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm text-planka-text">
            <span>Priority</span>
            <select
              name="priority"
              defaultValue="none"
              className="rounded-2xl border border-white/10 bg-planka-bg px-4 py-3 outline-none"
            >
              <option value="urgent">urgent</option>
              <option value="high">high</option>
              <option value="medium">medium</option>
              <option value="low">low</option>
              <option value="none">none</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm text-planka-text">
            <span>State</span>
            <select
              name="workflowStateId"
              defaultValue={states[0]?.id}
              className="rounded-2xl border border-white/10 bg-planka-bg px-4 py-3 outline-none"
            >
              {states.map((state) => (
                <option key={state.id} value={state.id}>
                  {state.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="grid gap-2 text-sm text-planka-text">
          <span>Labels</span>
          <input
            name="labels"
            placeholder="api, auth, urgent"
            className="rounded-2xl border border-white/10 bg-planka-bg px-4 py-3 outline-none placeholder:text-planka-text-muted"
          />
        </label>
        <SubmitButton />
      </form>
    </details>
  );
}

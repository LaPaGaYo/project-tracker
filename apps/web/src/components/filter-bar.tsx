"use client";

import type { WorkspaceMemberRecord, WorkflowStateRecord } from "@the-platform/shared";
import { usePathname, useRouter, useSearchParams, type ReadonlyURLSearchParams } from "next/navigation";
import { useTransition } from "react";

const workItemTypes = ["epic", "task", "subtask"] as const;
const priorities = ["urgent", "high", "medium", "low", "none"] as const;

function readList(searchParams: URLSearchParams | ReadonlyURLSearchParams, key: string) {
  return (searchParams.get(key) ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

interface FilterBarProps {
  members: WorkspaceMemberRecord[];
  states: WorkflowStateRecord[];
}

export function FilterBar({ members, states }: FilterBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const typeValues = readList(searchParams, "type");
  const priorityValues = readList(searchParams, "priority");
  const stateValues = readList(searchParams, "state");
  const assigneeValue = searchParams.get("assignee") ?? "";
  const activeCount = typeValues.length + priorityValues.length + stateValues.length + (assigneeValue ? 1 : 0);

  function updateSearch(mutator: (params: URLSearchParams) => void) {
    const nextParams = new URLSearchParams(searchParams.toString());
    mutator(nextParams);
    const query = nextParams.toString();

    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false
      });
    });
  }

  function toggleListValue(key: string, value: string) {
    updateSearch((params) => {
      const values = readList(params, key);
      const nextValues = values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value];

      if (nextValues.length > 0) {
        params.set(key, nextValues.join(","));
      } else {
        params.delete(key);
      }
    });
  }

  function setAssignee(value: string) {
    updateSearch((params) => {
      if (value) {
        params.set("assignee", value);
      } else {
        params.delete("assignee");
      }
    });
  }

  function clearFilters() {
    updateSearch((params) => {
      params.delete("type");
      params.delete("priority");
      params.delete("state");
      params.delete("assignee");
    });
  }

  return (
    <section className="rounded-[1.5rem] border border-white/8 bg-black/15 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-planka-accent">Views</p>
          <h2 className="mt-2 text-lg font-semibold text-planka-text">Filters</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full border border-white/12 px-3 py-1 text-xs uppercase tracking-[0.2em] text-planka-text-muted">
            {activeCount} active
          </span>
          <button
            type="button"
            onClick={clearFilters}
            disabled={isPending || activeCount === 0}
            className="rounded-full border border-white/12 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-planka-text transition hover:border-white/24 hover:bg-white/6 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Clear filters
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_1fr_1fr_16rem]">
        <div className="grid gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-planka-text-muted">Type</p>
          <div className="flex flex-wrap gap-2">
            {workItemTypes.map((value) => {
              const selected = typeValues.includes(value);
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => toggleListValue("type", value)}
                  disabled={isPending}
                  className={`rounded-full px-3 py-2 text-sm font-semibold transition ${
                    selected
                      ? "bg-planka-selected text-white"
                      : "border border-white/10 bg-black/10 text-planka-text-muted hover:border-white/24 hover:text-planka-text"
                  }`}
                >
                  {value}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-planka-text-muted">Priority</p>
          <div className="flex flex-wrap gap-2">
            {priorities.map((value) => {
              const selected = priorityValues.includes(value);
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => toggleListValue("priority", value)}
                  disabled={isPending}
                  className={`rounded-full px-3 py-2 text-sm font-semibold transition ${
                    selected
                      ? "bg-planka-selected text-white"
                      : "border border-white/10 bg-black/10 text-planka-text-muted hover:border-white/24 hover:text-planka-text"
                  }`}
                >
                  {value}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-planka-text-muted">State</p>
          <div className="flex flex-wrap gap-2">
            {states.map((state) => {
              const selected = stateValues.includes(state.id);
              return (
                <button
                  key={state.id}
                  type="button"
                  onClick={() => toggleListValue("state", state.id)}
                  disabled={isPending}
                  className={`rounded-full px-3 py-2 text-sm font-semibold transition ${
                    selected
                      ? "bg-planka-selected text-white"
                      : "border border-white/10 bg-black/10 text-planka-text-muted hover:border-white/24 hover:text-planka-text"
                  }`}
                >
                  {state.name}
                </button>
              );
            })}
          </div>
        </div>

        <label className="grid gap-3 text-sm text-planka-text">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-planka-text-muted">Assignee</span>
          <select
            value={assigneeValue}
            onChange={(event) => setAssignee(event.target.value)}
            disabled={isPending}
            className="rounded-2xl border border-white/10 bg-planka-bg px-4 py-3 outline-none"
          >
            <option value="">All members</option>
            {members.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.userId}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}

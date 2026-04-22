"use client";

import type { WorkspaceMemberRecord, WorkflowStateRecord } from "@the-platform/shared";
import { usePathname, useRouter, useSearchParams, type ReadonlyURLSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

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
  const [isExpanded, setIsExpanded] = useState(false);

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
        <button
          type="button"
          aria-label="Filters"
          aria-expanded={isExpanded}
          onClick={() => setIsExpanded((current) => !current)}
          className="flex items-center gap-3 text-left transition hover:text-planka-text"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-planka-accent">Views</p>
            <span className="mt-2 inline-flex items-center gap-2 text-lg font-semibold text-planka-text">
              Filters
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="currentColor"
                className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
          </div>
        </button>
        <div className="flex items-center gap-3">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
              activeCount > 0
                ? "bg-planka-selected text-white"
                : "border border-white/12 text-planka-text-muted"
            }`}
          >
            {activeCount} active
          </span>
          <button
            type="button"
            onClick={clearFilters}
            disabled={isPending || activeCount === 0}
            className="rounded-full border border-white/12 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-planka-text transition hover:border-white/24 hover:bg-white/6 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Clear
          </button>
        </div>
      </div>

      {isExpanded ? (
        <div className="mt-6 grid gap-5 border-t border-white/6 pt-6 xl:grid-cols-[1fr_1fr_1fr_16rem]">
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
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] transition ${
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
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] transition ${
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
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] transition ${
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
              className="rounded-2xl border border-white/10 bg-planka-bg px-4 py-2.5 text-sm outline-none transition focus:border-white/24"
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
      ) : null}
    </section>
  );
}

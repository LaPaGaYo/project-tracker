"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import type { ProjectSearchResult } from "@/server/projects/search";

export function ReadinessSearch({ workspaceSlug, projectKey }: { workspaceSlug: string; projectKey: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProjectSearchResult[]>([]);
  const [error, setError] = useState("");
  const [pendingQuery, setPendingQuery] = useState("");
  const requestIdRef = useRef(0);
  const latestQueryRef = useRef("");

  function updateQuery(value: string) {
    setQuery(value);
    setError("");

    const trimmedQuery = value.trim();
    latestQueryRef.current = trimmedQuery;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (trimmedQuery.length < 2) {
      setPendingQuery("");
      setResults([]);
      return;
    }

    setPendingQuery(trimmedQuery);
    setResults([]);

    function isCurrentRequest() {
      return requestIdRef.current === requestId && latestQueryRef.current === trimmedQuery;
    }

    void (async () => {
      try {
        const response = await fetch(
          `/api/workspaces/${workspaceSlug}/projects/${projectKey}/search?q=${encodeURIComponent(trimmedQuery)}`
        );

        if (!isCurrentRequest()) {
          return;
        }

        if (!response.ok) {
          setError("Search failed. Try again from the project overview.");
          setResults([]);
          return;
        }

        const body = (await response.json()) as { results?: unknown };
        const nextResults = Array.isArray(body.results) ? (body.results as ProjectSearchResult[]) : null;

        if (!isCurrentRequest()) {
          return;
        }

        if (!nextResults) {
          setError("Search failed. Try again from the project overview.");
          setResults([]);
          return;
        }

        setResults(nextResults);
      } catch {
        if (!isCurrentRequest()) {
          return;
        }

        setError("Search failed. Try again from the project overview.");
        setResults([]);
      } finally {
        if (isCurrentRequest()) {
          setPendingQuery("");
        }
      }
    })();
  }

  const trimmedQuery = query.trim();
  const isShortQuery = trimmedQuery.length < 2;
  const isSearching = pendingQuery === trimmedQuery && !isShortQuery;
  const showNoResults = trimmedQuery.length >= 2 && !isSearching && !error && results.length === 0;

  return (
    <section
      aria-labelledby="readiness-search-heading"
      className="rounded-[2rem] border border-white/10 bg-planka-card/90 p-5 shadow-[0_18px_46px_rgba(0,0,0,0.18)]"
      role="search"
    >
      <h2
        className="text-xs font-semibold uppercase tracking-[0.12em] text-planka-text-muted"
        id="readiness-search-heading"
      >
        Readiness search
      </h2>
      <input
        aria-labelledby="readiness-search-heading"
        className="mt-4 w-full rounded-[1rem] border border-white/10 bg-black/10 px-4 py-3 text-sm text-planka-text outline-none transition placeholder:text-planka-text-muted focus:border-planka-selected/70"
        onChange={(event) => updateQuery(event.target.value)}
        placeholder="Search blockers, PRs, comments..."
        type="search"
        value={query}
      />

      {isSearching ? <p className="mt-3 text-sm text-planka-text-muted">Searching readiness signals...</p> : null}
      {error ? <p className="mt-3 text-sm text-amber-100">{error}</p> : null}
      {isShortQuery ? (
        <p className="mt-3 text-sm text-planka-text-muted">
          Search across blockers, PRs, comments, plan items, and notifications.
        </p>
      ) : null}

      <div className="mt-4 space-y-3">
        {results.map((result) => (
          <Link
            className="block rounded-[1.25rem] border border-white/10 bg-black/10 px-4 py-3 transition hover:border-planka-selected/60 hover:bg-planka-selected/20"
            href={result.href}
            key={result.id}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold text-planka-text">{result.title}</p>
              <span className="shrink-0 rounded-full border border-white/10 px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-planka-text-muted">
                {result.chip}
              </span>
            </div>
            <p className="mt-2 text-sm leading-5 text-planka-text-muted">{result.snippet}</p>
          </Link>
        ))}
      </div>

      {showNoResults ? (
        <p className="mt-3 text-sm text-planka-text-muted">No readiness signals found for "{trimmedQuery}".</p>
      ) : null}
    </section>
  );
}

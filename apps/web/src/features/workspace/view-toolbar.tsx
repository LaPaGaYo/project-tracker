"use client";

import Link from "next/link";
import { useSearchParams, useSelectedLayoutSegment } from "next/navigation";

import { StatusPill } from "./status-pill";

type ViewSlug = "board" | "list" | "plan" | "overview" | "docs" | "engineering";

type ViewDefinition = {
  slug: ViewSlug;
  label: string;
  href: (workspaceSlug: string, projectKey: string) => string;
};

const views: ViewDefinition[] = [
  {
    slug: "board",
    label: "Board",
    href: (workspaceSlug, projectKey) => `/workspaces/${workspaceSlug}/projects/${projectKey}?view=board`
  },
  {
    slug: "list",
    label: "List",
    href: (workspaceSlug, projectKey) => `/workspaces/${workspaceSlug}/projects/${projectKey}?view=list`
  },
  {
    slug: "plan",
    label: "Plan",
    href: (workspaceSlug, projectKey) => `/workspaces/${workspaceSlug}/projects/${projectKey}/plan`
  },
  {
    slug: "overview",
    label: "Overview",
    href: (workspaceSlug, projectKey) => `/workspaces/${workspaceSlug}/projects/${projectKey}/overview`
  },
  {
    slug: "docs",
    label: "Docs",
    href: (workspaceSlug, projectKey) => `/workspaces/${workspaceSlug}/projects/${projectKey}/docs`
  },
  {
    slug: "engineering",
    label: "Engineering",
    href: (workspaceSlug, projectKey) => `/workspaces/${workspaceSlug}/projects/${projectKey}/engineering`
  }
];

function getSelectedView(
  routeSegment: ReturnType<typeof useSelectedLayoutSegment>,
  searchParams: URLSearchParams
): ViewSlug {
  if (routeSegment === "plan" || routeSegment === "overview" || routeSegment === "docs" || routeSegment === "engineering") {
    return routeSegment;
  }

  if (searchParams.get("view") === "board") {
    return "board";
  }

  return searchParams.get("view") === "list" ? "list" : "board";
}

interface ViewToolbarProps {
  workspaceSlug: string;
  projectKey: string;
}

export function ViewToolbar({ workspaceSlug, projectKey }: ViewToolbarProps) {
  const searchParams = useSearchParams();
  const routeSegment = useSelectedLayoutSegment();
  const selectedView = getSelectedView(routeSegment, new URLSearchParams(searchParams.toString()));

  return (
    <nav
      aria-label="Project views"
      className="rounded-[1.75rem] border border-white/10 bg-planka-card/80 px-3 py-3 shadow-[0_18px_46px_rgba(0,0,0,0.18)]"
    >
      <ul className="flex flex-wrap gap-2">
        {views.map((view) => (
          <li key={view.slug}>
            <Link
              aria-current={view.slug === selectedView ? "page" : undefined}
              className="inline-flex"
              href={view.href(workspaceSlug, projectKey)}
            >
              <StatusPill tone={view.slug === selectedView ? "accent" : "neutral"}>{view.label}</StatusPill>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { workItemPriorities, workItemTypes } from "@the-platform/shared";

import { AppShell } from "@/components/app-shell";
import { CreateWorkItemDialog } from "@/components/create-work-item-dialog";
import type { TimelineEntry } from "@/components/timeline";
import { ViewToggle } from "@/components/view-toggle";
import { createActivityRepository } from "@/server/activity/repository";
import { getAppSession, isClerkConfigured } from "@/server/auth";
import { createCommentRepository } from "@/server/comments/repository";
import {
  listCommentsForUser,
  listWorkItemTimelineForUser
} from "@/server/comments/service";
import { createProjectRepository } from "@/server/projects/repository";
import { getProjectForUser } from "@/server/projects/service";
import { createWorkItemRepository } from "@/server/work-items/repository";
import {
  getWorkItemForUser,
  listDescriptionVersionsForUser,
  listWorkItemsForUser
} from "@/server/work-items/service";
import { createWorkspaceRepository } from "@/server/workspaces/repository";
import { listWorkspacesForUser } from "@/server/workspaces/service";
import { WorkspaceError, requireWorkspaceMembership } from "@/server/workspaces/core";
import { createWorkflowStateRepository } from "@/server/workflow-states/repository";
import { listWorkflowStatesForUser } from "@/server/workflow-states/service";

function readSearchList(value: string | string[] | undefined) {
  const normalized = Array.isArray(value) ? value.join(",") : value ?? "";
  return normalized
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseTypeFilters(value: string | string[] | undefined) {
  return readSearchList(value).filter((entry): entry is (typeof workItemTypes)[number] =>
    workItemTypes.includes(entry as (typeof workItemTypes)[number])
  );
}

function parsePriorityFilters(value: string | string[] | undefined) {
  return readSearchList(value).filter((entry): entry is (typeof workItemPriorities)[number] =>
    workItemPriorities.includes(entry as (typeof workItemPriorities)[number])
  );
}

function parseSortField(
  value: string | string[] | undefined
): "identifier" | "priority" | "created_at" | "position" | undefined {
  const normalized = Array.isArray(value) ? value[0] : value;
  if (
    normalized === "identifier" ||
    normalized === "priority" ||
    normalized === "created_at" ||
    normalized === "position"
  ) {
    return normalized;
  }

  return undefined;
}

function parseSortOrder(value: string | string[] | undefined): "asc" | "desc" | undefined {
  const normalized = Array.isArray(value) ? value[0] : value;
  return normalized === "asc" || normalized === "desc" ? normalized : undefined;
}

export async function ProjectDetailContent({
  workspaceSlug,
  projectKey,
  query,
  selectedIdentifier
}: {
  workspaceSlug: string;
  projectKey: string;
  query: Record<string, string | string[] | undefined>;
  selectedIdentifier?: string;
}) {
  const session = await getAppSession();
  if (!session) {
    redirect("/sign-in");
  }

  const workspaceRepository = createWorkspaceRepository();
  const workItemRepository = createWorkItemRepository();
  const workflowStateRepository = createWorkflowStateRepository();
  const commentRepository = createCommentRepository();
  const activityRepository = createActivityRepository();
  const workspace = await workspaceRepository.findWorkspaceBySlug(workspaceSlug);

  if (!workspace) {
    notFound();
  }

  try {
    const membership = await requireWorkspaceMembership(workspaceRepository, session, workspace.id, "viewer");
    const types = parseTypeFilters(query.type);
    const priorities = parsePriorityFilters(query.priority);
    const workflowStateIds = readSearchList(query.state);
    const sortField = parseSortField(query.sort);
    const sortOrder = parseSortOrder(query.order);
    const filters = {
      ...(types.length > 0 ? { types } : {}),
      ...(priorities.length > 0 ? { priorities } : {}),
      ...(workflowStateIds.length > 0 ? { workflowStateIds } : {}),
      ...(typeof query.assignee === "string" && query.assignee ? { assigneeId: query.assignee } : {}),
      ...(sortField
        ? {
            sort: {
              field: sortField,
              ...(sortOrder ? { order: sortOrder } : {})
            }
          }
        : {})
    };

    const [workspaces, project, states, items] = await Promise.all([
      listWorkspacesForUser(workspaceRepository, session),
      getProjectForUser(createProjectRepository(), session, workspaceSlug, projectKey),
      listWorkflowStatesForUser(workflowStateRepository, session, workspaceSlug, projectKey),
      listWorkItemsForUser(workItemRepository, session, workspaceSlug, projectKey, filters)
    ]);
    const members = await workspaceRepository.listMembers(workspace.id);

    const selectedItem = selectedIdentifier
      ? await getWorkItemForUser(workItemRepository, session, workspaceSlug, projectKey, selectedIdentifier)
      : null;

    const [comments, versions, timeline] = selectedItem
      ? await Promise.all([
          listCommentsForUser(commentRepository, session, workspaceSlug, projectKey, selectedIdentifier!),
          listDescriptionVersionsForUser(workItemRepository, session, workspaceSlug, projectKey, selectedIdentifier!),
          listWorkItemTimelineForUser(
            {
              activityRepository,
              commentRepository,
              workItemRepository
            },
            session,
            workspaceSlug,
            projectKey,
            selectedIdentifier!
          ) as Promise<TimelineEntry[]>
        ])
      : [[], [], [] as TimelineEntry[]];

    const canCreate = membership.role !== "viewer";
    const basePath = `/workspaces/${workspaceSlug}/projects/${projectKey}`;

    return (
      <AppShell
        currentWorkspaceId={workspace.id}
        session={session}
        workspaces={workspaces}
        isClerkEnabled={isClerkConfigured()}
      >
        <div className="max-w-full overflow-hidden">
          <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
            <article className="grid min-w-0 gap-6">
            <section className="rounded-[2rem] border border-white/8 bg-planka-card/75 p-8 shadow-[0_32px_120px_rgba(0,0,0,0.24)] backdrop-blur">
              <Link href={`/workspaces/${workspaceSlug}/projects`} className="text-xs font-semibold uppercase tracking-[0.3em] text-planka-accent">
                Back to projects
              </Link>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-semibold text-planka-text">{project.title}</h1>
                <span className="rounded-full bg-planka-selected px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white">
                  {project.key}
                </span>
              </div>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-planka-text-muted">
                {project.description || "No project description yet."}
              </p>

              <div className="mt-6 grid gap-4 md:grid-cols-4">
                <div className="rounded-3xl border border-white/8 bg-black/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-planka-text-muted">Role</p>
                  <p className="mt-3 text-lg font-semibold text-planka-text">{membership.role}</p>
                </div>
                <div className="rounded-3xl border border-white/8 bg-black/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-planka-text-muted">States</p>
                  <p className="mt-3 text-lg font-semibold text-planka-text">{states.length}</p>
                </div>
                <div className="rounded-3xl border border-white/8 bg-black/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-planka-text-muted">Members</p>
                  <p className="mt-3 text-lg font-semibold text-planka-text">{members.length}</p>
                </div>
                <div className="rounded-3xl border border-white/8 bg-black/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-planka-text-muted">Visible items</p>
                  <p className="mt-3 text-lg font-semibold text-planka-text">{items.length}</p>
                </div>
              </div>
            </section>

            <ViewToggle
              workspaceSlug={workspaceSlug}
              projectKey={projectKey}
              basePath={basePath}
              items={items}
              members={members}
              states={states}
              selectedItem={selectedItem}
              comments={comments}
              versions={versions}
              timeline={timeline}
              sessionUserId={session.userId}
              membershipRole={membership.role}
            />
            </article>

            <aside className="grid gap-6 xl:content-start">
              <CreateWorkItemDialog
                workspaceSlug={workspaceSlug}
                projectKey={projectKey}
                states={states}
                canCreate={canCreate}
              />
              <div className="rounded-[2rem] border border-white/8 bg-black/15 p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-planka-accent">Project Summary</p>
                <div className="mt-5 grid gap-3 text-sm text-planka-text-muted">
                  <p>
                    Workspace:
                    <span className="ml-2 font-semibold text-planka-text">{workspace.name}</span>
                  </p>
                  <p>
                    Stage:
                    <span className="ml-2 font-semibold text-planka-text">{project.stage}</span>
                  </p>
                  <p>
                    Role:
                    <span className="ml-2 font-semibold text-planka-text">{membership.role}</span>
                  </p>
                  <p>
                    Total items:
                    <span className="ml-2 font-semibold text-planka-text">{project.itemCounter}</span>
                  </p>
                </div>
              </div>
            </aside>
          </section>
        </div>
      </AppShell>
    );
  } catch (error) {
    if (error instanceof WorkspaceError && error.status === 404) {
      notFound();
    }

    throw error;
  }
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { workItemPriorities, workItemTypes } from "@the-platform/shared";

import { AppShell } from "@/components/app-shell";
import { CreateWorkItemDialog } from "@/components/create-work-item-dialog";
import type { TimelineEntry } from "@/components/timeline";
import { ViewToggle } from "@/components/view-toggle";
import { ProjectShell } from "@/features/workspace/project-shell";
import { createActivityRepository } from "@/server/activity/repository";
import { createCommentRepository } from "@/server/comments/repository";
import {
  listCommentsForUser,
  listWorkItemTimelineForUser
} from "@/server/comments/service";
import { createWorkItemRepository } from "@/server/work-items/repository";
import {
  getWorkItemForUser,
  listDescriptionVersionsForUser,
  listWorkItemsForUser
} from "@/server/work-items/service";
import { createWorkspaceRepository } from "@/server/workspaces/repository";
import { WorkspaceError } from "@/server/workspaces/core";
import { createWorkflowStateRepository } from "@/server/workflow-states/repository";
import { listWorkflowStatesForUser } from "@/server/workflow-states/service";

import { loadProjectPageData } from "./project-page-data";

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
  const workspaceRepository = createWorkspaceRepository();
  const workItemRepository = createWorkItemRepository();
  const workflowStateRepository = createWorkflowStateRepository();
  const commentRepository = createCommentRepository();
  const activityRepository = createActivityRepository();
  try {
    const {
      canCreate,
      isClerkEnabled,
      membership,
      project,
      session,
      workspace,
      workspaces,
      workspaceView,
      projectStages,
      planItems
    } =
      await loadProjectPageData(workspaceSlug, projectKey);
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

    const [states, items] = await Promise.all([
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

    const basePath = `/workspaces/${workspaceSlug}/projects/${projectKey}`;

    return (
      <AppShell
        currentWorkspaceId={workspace.id}
        session={session}
        workspaces={workspaces}
        isClerkEnabled={isClerkEnabled}
      >
        <ProjectShell
          canCreate={canCreate}
          projectDescription={project.description}
          projectKey={project.key}
          projectTitle={project.title}
          stage={workspaceView.stage}
          workspaceSlug={workspaceSlug}
        >
          <div className="max-w-full">
            <div className="mb-4">
              <Link
                href={`/workspaces/${workspaceSlug}/projects`}
                className="text-xs font-semibold uppercase tracking-[0.3em] text-planka-accent"
              >
                Back to projects
              </Link>
            </div>
            <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
              <article className="grid min-w-0 gap-6">
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
                  projectStages={projectStages}
                  planItems={planItems}
                  sessionUserId={session.userId}
                  membershipRole={membership.role}
                />
              </article>

              <aside className="grid gap-6 xl:content-start">
                <div id="create-work-item">
                  <CreateWorkItemDialog
                    workspaceSlug={workspaceSlug}
                    projectKey={projectKey}
                    states={states}
                    projectStages={projectStages}
                    planItems={planItems}
                    canCreate={canCreate}
                  />
                </div>
                <div className="rounded-[2rem] border border-white/10 bg-black/15 p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-planka-accent">Workspace context</p>
                  <div className="mt-5 grid gap-3 text-sm text-planka-text-muted">
                    <p>
                      Workspace:
                      <span className="ml-2 font-semibold text-planka-text">{workspace.name}</span>
                    </p>
                    <p>
                      Role:
                      <span className="ml-2 font-semibold text-planka-text">{membership.role}</span>
                    </p>
                    <p>
                      Visible items:
                      <span className="ml-2 font-semibold text-planka-text">{items.length}</span>
                    </p>
                  </div>
                </div>
              </aside>
            </section>
          </div>
        </ProjectShell>
      </AppShell>
    );
  } catch (error) {
    if (error instanceof WorkspaceError && error.status === 404) {
      notFound();
    }

    throw error;
  }
}

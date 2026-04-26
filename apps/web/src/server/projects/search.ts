import { and, eq, ilike, isNull, or } from "drizzle-orm";

import {
  comments,
  db,
  githubPullRequests,
  planItems,
  projectStages,
  taskGithubStatus,
  tasks,
  workItemGithubLinks
} from "@the-platform/db";

import { resolveWorkspaceContext } from "../work-management/utils";
import { WorkspaceError } from "../workspaces/core";
import type { AppSession } from "../workspaces/types";
import type { ProjectRepository } from "./types";

export type ProjectSearchResultType = "work_item" | "plan" | "comment" | "engineering" | "notification";

export interface ProjectSearchResult {
  id: string;
  type: ProjectSearchResultType;
  title: string;
  snippet: string;
  href: string;
  chip: string;
  rank: number;
}

export interface ProjectSearchResponse {
  query: string;
  results: ProjectSearchResult[];
}

interface SearchProjectDependencies {
  projectRepository: Pick<ProjectRepository, "findWorkspaceBySlug" | "getMembership" | "getProjectByKey">;
}

function workItemTitle(item: { identifier: string | null; title: string }) {
  return `${item.identifier ?? "Work item"} ${item.title}`;
}

export async function searchProjectForUser(
  dependencies: SearchProjectDependencies,
  session: AppSession,
  workspaceSlug: string,
  projectKey: string,
  query: string
): Promise<ProjectSearchResponse> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return { query: trimmed, results: [] };
  }

  const { workspace } = await resolveWorkspaceContext(
    dependencies.projectRepository,
    session,
    workspaceSlug,
    "viewer"
  );
  const project = await dependencies.projectRepository.getProjectByKey(workspace.id, projectKey);

  if (!project) {
    throw new WorkspaceError(404, "project not found.");
  }

  const pattern = `%${trimmed}%`;
  const baseHref = `/workspaces/${workspace.slug}/projects/${project.key}`;

  const workItemRows = await db
    .select({
      id: tasks.id,
      identifier: tasks.identifier,
      title: tasks.title,
      description: tasks.description,
      status: tasks.status,
      priority: tasks.priority
    })
    .from(tasks)
    .where(
      and(
        eq(tasks.projectId, project.id),
        or(ilike(tasks.identifier, pattern), ilike(tasks.title, pattern), ilike(tasks.description, pattern))
      )
    );

  const commentRows = await db
    .select({
      id: comments.id,
      content: comments.content,
      taskId: tasks.id,
      identifier: tasks.identifier,
      title: tasks.title
    })
    .from(comments)
    .innerJoin(tasks, eq(comments.workItemId, tasks.id))
    .where(and(eq(tasks.projectId, project.id), isNull(comments.deletedAt), ilike(comments.content, pattern)));

  const planRows = await db
    .select({
      id: planItems.id,
      title: planItems.title,
      outcome: planItems.outcome,
      status: planItems.status,
      blocker: planItems.blocker,
      stageTitle: projectStages.title,
      stageGoal: projectStages.goal,
      gateStatus: projectStages.gateStatus
    })
    .from(planItems)
    .innerJoin(projectStages, eq(planItems.stageId, projectStages.id))
    .where(
      and(
        eq(projectStages.projectId, project.id),
        or(
          ilike(planItems.title, pattern),
          ilike(planItems.outcome, pattern),
          ilike(planItems.blocker, pattern),
          ilike(projectStages.title, pattern),
          ilike(projectStages.goal, pattern),
          ilike(projectStages.gateStatus, pattern)
        )
      )
    );

  const engineeringRows = await db
    .select({
      id: tasks.id,
      identifier: tasks.identifier,
      title: tasks.title,
      prTitle: githubPullRequests.title,
      headBranch: githubPullRequests.headBranch,
      branchName: workItemGithubLinks.branchName,
      prStatus: taskGithubStatus.prStatus,
      ciStatus: taskGithubStatus.ciStatus,
      deployStatus: taskGithubStatus.deployStatus
    })
    .from(tasks)
    .leftJoin(taskGithubStatus, eq(taskGithubStatus.taskId, tasks.id))
    .leftJoin(workItemGithubLinks, eq(workItemGithubLinks.workItemId, tasks.id))
    .leftJoin(githubPullRequests, eq(workItemGithubLinks.pullRequestId, githubPullRequests.id))
    .where(
      and(
        eq(tasks.projectId, project.id),
        or(
          ilike(tasks.identifier, pattern),
          ilike(tasks.title, pattern),
          ilike(githubPullRequests.title, pattern),
          ilike(githubPullRequests.headBranch, pattern)
        )
      )
    );

  const results: ProjectSearchResult[] = [
    ...workItemRows.map((item): ProjectSearchResult => {
      const selected = item.identifier ?? item.id;

      return {
        id: `work-item-${item.id}`,
        type: "work_item",
        title: workItemTitle(item),
        snippet: item.description || item.status,
        href: `${baseHref}?selected=${selected}`,
        chip: item.priority === "urgent" || item.status === "Blocked" ? "Risk" : item.status,
        rank: item.identifier?.toLowerCase() === trimmed.toLowerCase() ? 0 : 10
      };
    }),
    ...commentRows.map((comment): ProjectSearchResult => ({
      id: `comment-${comment.id}`,
      type: "comment",
      title: `${comment.identifier ?? "Work item"} comment`,
      snippet: comment.content,
      href: `${baseHref}?selected=${comment.identifier ?? comment.taskId}`,
      chip: "Comment",
      rank: 30
    })),
    ...planRows.map((plan): ProjectSearchResult => ({
      id: `plan-${plan.id}`,
      type: "plan",
      title: plan.title,
      snippet: plan.outcome || plan.stageGoal || plan.status,
      href: `${baseHref}/plan`,
      chip: plan.blocker ? "Blocked plan" : plan.gateStatus,
      rank: plan.blocker ? 20 : 40
    })),
    ...engineeringRows.map((engineering): ProjectSearchResult => {
      const branch = engineering.headBranch ?? engineering.branchName ?? "No branch";

      return {
        id: `engineering-${engineering.id}`,
        type: "engineering",
        title: engineering.prTitle ? `${engineering.identifier ?? "Work item"} ${engineering.prTitle}` : workItemTitle(engineering),
        snippet: `${branch} · ${engineering.prStatus ?? "No PR"} · ${engineering.ciStatus ?? "Unknown"}`,
        href: `${baseHref}/engineering`,
        chip: engineering.ciStatus === "Failing" ? "CI failing" : (engineering.deployStatus ?? engineering.prStatus ?? "Engineering"),
        rank: engineering.ciStatus === "Failing" ? 20 : 50
      };
    })
  ];

  return {
    query: trimmed,
    results: results.sort((left, right) => left.rank - right.rank || left.title.localeCompare(right.title)).slice(0, 20)
  };
}

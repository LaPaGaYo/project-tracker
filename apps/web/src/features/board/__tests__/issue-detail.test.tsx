import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import type {
  CommentRecord,
  DescriptionVersionRecord,
  WorkspaceMemberRecord,
  WorkflowStateRecord,
  WorkItemRecord
} from "@the-platform/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DetailPanel } from "../../../components/detail-panel";
import { render } from "../../../test/render";
import type { TimelineEntry } from "../../../components/timeline";
import type { GithubIssueSyncView } from "../../../server/github/issues/types";

const router = vi.hoisted(() => ({
  back: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn()
}));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams("view=board")
}));

const item: WorkItemRecord = {
  id: "item-1",
  projectId: "project-1",
  workspaceId: "workspace-1",
  identifier: "OPS-1",
  title: "Build board shell",
  description: "Keep create and edit flows alive while the shell changes.",
  status: "Todo",
  type: "task",
  parentId: null,
  assigneeId: "henry",
  priority: "high",
  labels: ["ui", "phase5"],
  workflowStateId: "state-active",
  stageId: null,
  planItemId: null,
  position: 1000,
  blockedReason: null,
  dueDate: null,
  completedAt: null,
  createdAt: "2026-04-20T12:00:00.000Z",
  updatedAt: "2026-04-20T12:00:00.000Z"
};

const members: WorkspaceMemberRecord[] = [
  {
    workspaceId: "workspace-1",
    userId: "henry",
    role: "owner",
    invitedAt: "2026-04-20T12:00:00.000Z",
    joinedAt: "2026-04-20T12:00:00.000Z"
  }
];

const states: WorkflowStateRecord[] = [
  {
    id: "state-backlog",
    projectId: "project-1",
    name: "Backlog",
    category: "backlog",
    position: 0,
    color: null,
    createdAt: "2026-04-20T12:00:00.000Z",
    updatedAt: "2026-04-20T12:00:00.000Z"
  },
  {
    id: "state-active",
    projectId: "project-1",
    name: "In Progress",
    category: "active",
    position: 1,
    color: null,
    createdAt: "2026-04-20T12:00:00.000Z",
    updatedAt: "2026-04-20T12:00:00.000Z"
  }
];

const comments: CommentRecord[] = [
  {
    id: "comment-1",
    workItemId: "item-1",
    authorId: "henry",
    content: "Pair with the CI owner before merging.",
    createdAt: "2026-04-20T13:00:00.000Z",
    updatedAt: "2026-04-20T13:00:00.000Z",
    deletedAt: null
  }
];

const versions: DescriptionVersionRecord[] = [
  {
    id: "version-1",
    workItemId: "item-1",
    content: "Keep create and edit flows alive.",
    authorId: "henry",
    createdAt: "2026-04-20T12:30:00.000Z"
  }
];

const timeline: TimelineEntry[] = [
  {
    kind: "activity",
    createdAt: "2026-04-20T12:45:00.000Z",
    activity: {
      id: "activity-1",
      workspaceId: "workspace-1",
      entityType: "work_item",
      entityId: "item-1",
      action: "assigned",
      actorId: "henry",
      metadata: {
        before: null,
        after: "henry"
      },
      createdAt: "2026-04-20T12:45:00.000Z"
    }
  }
];

const itemEngineering = {
  taskId: "item-1",
  identifier: "OPS-1",
  title: "Build board shell",
  repository: "the-platform/platform-ops",
  defaultBranch: "main",
  branchName: "ops-1-board-shell",
  pullRequestLabel: "PR Open",
  pullRequestUrl: "https://github.com/the-platform/platform-ops/pull/128",
  pullRequestNumber: 128,
  checkLabel: "CI Failing",
  checkUrl: "https://github.com/the-platform/platform-ops/actions/runs/128",
  deployLabel: "Deploy Staging",
  deployUrl: "https://staging.the-platform.dev",
  deployEnvironment: "staging",
  stageLabel: "Phase 2: Live Engineering",
  summary: "OPS-1 · open · failing · phase 2",
  hasPullRequest: true,
  hasFailingChecks: true,
  hasDeploy: true
};

const githubIssueSync: GithubIssueSyncView = {
  status: "synced",
  issueNumber: 42,
  issueUrl: "https://github.com/the-platform/platform-ops/issues/42",
  repositoryFullName: "the-platform/platform-ops",
  conflictFields: [],
  errorMessage: null,
  syncEnabled: true
};

const githubCommentTimeline: TimelineEntry[] = [
  {
    kind: "github_issue_comment",
    createdAt: "2026-04-20T14:00:00.000Z",
    comment: {
      id: "github-comment-1",
      providerCommentId: "123456",
      body: "GitHub says **ship it** after CI recovers.",
      url: "https://github.com/the-platform/platform-ops/issues/42#issuecomment-123456",
      authorLogin: "octocat",
      githubCreatedAt: "2026-04-20T14:00:00.000Z",
      githubUpdatedAt: "2026-04-20T14:05:00.000Z"
    }
  }
];

describe("DetailPanel", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the functional issue detail surface with metadata and comments", () => {
    render(
      <DetailPanel
        workspaceSlug="platform-ops"
        projectKey="OPS"
        basePath="/workspaces/platform-ops/projects/OPS"
        item={item}
        comments={comments}
        versions={versions}
        timeline={timeline}
        members={members}
        states={states}
        sessionUserId="henry"
        membershipRole="owner"
      />
    );

    expect(screen.getAllByText("OPS-1")).toHaveLength(2);
    expect(screen.getByRole("heading", { name: /Build board shell/i })).toBeInTheDocument();
    expect(screen.getByText("Description history")).toBeInTheDocument();
    expect(screen.getByText("Comments")).toBeInTheDocument();
    expect(screen.getByText("Timeline")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save description" })).toBeDisabled();
    expect(screen.getByLabelText("Priority")).toHaveValue("high");
    expect(screen.getByLabelText("Type")).toHaveValue("task");
    expect(screen.getByLabelText("State")).toHaveValue("state-active");
    expect(screen.getByLabelText("Stage")).toBeInTheDocument();
    expect(screen.getByLabelText("Plan item")).toBeInTheDocument();
    expect(screen.getByLabelText("Assignee")).toHaveValue("henry");
    expect(screen.getByText("Pair with the CI owner before merging.")).toBeInTheDocument();
    expect(screen.getByText("Assigned to henry")).toBeInTheDocument();
  });

  it("renders read-only engineering context for the selected issue", () => {
    render(
      <DetailPanel
        workspaceSlug="platform-ops"
        projectKey="OPS"
        basePath="/workspaces/platform-ops/projects/OPS"
        item={item}
        itemEngineering={itemEngineering}
        comments={comments}
        versions={versions}
        timeline={timeline}
        members={members}
        states={states}
        sessionUserId="henry"
        membershipRole="owner"
      />
    );

    expect(screen.getByText("Engineering context")).toBeInTheDocument();
    expect(screen.getByText("the-platform/platform-ops")).toBeInTheDocument();
    expect(screen.getByText("ops-1-board-shell")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "PR Open" })).toHaveAttribute(
      "href",
      "https://github.com/the-platform/platform-ops/pull/128"
    );
    expect(screen.getByRole("link", { name: "CI Failing" })).toHaveAttribute(
      "href",
      "https://github.com/the-platform/platform-ops/actions/runs/128"
    );
    expect(screen.getByRole("link", { name: "Deploy Staging" })).toHaveAttribute(
      "href",
      "https://staging.the-platform.dev"
    );
  });

  it("renders the GitHub issue sync card for a linked issue", () => {
    render(
      <DetailPanel
        workspaceSlug="platform-ops"
        projectKey="OPS"
        basePath="/workspaces/platform-ops/projects/OPS"
        item={item}
        githubIssueSync={githubIssueSync}
        comments={comments}
        versions={versions}
        timeline={timeline}
        members={members}
        states={states}
        sessionUserId="henry"
        membershipRole="owner"
      />
    );

    expect(screen.getByText("GitHub issue sync")).toBeInTheDocument();
    expect(screen.getByText("Synced")).toBeInTheDocument();
    expect(screen.getByText("the-platform/platform-ops")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "#42" })).toHaveAttribute(
      "href",
      "https://github.com/the-platform/platform-ops/issues/42"
    );
  });

  it.each([
    ["conflict", "Sync conflict", { conflictFields: ["title", "body"] as string[], errorMessage: null, syncEnabled: true }],
    ["error", "Sync failed", { conflictFields: [] as string[], errorMessage: "GitHub rate limit exceeded.", syncEnabled: true }],
    ["paused", "Sync paused", { conflictFields: [] as string[], errorMessage: null, syncEnabled: false }]
  ] as const)("renders %s GitHub sync status detail", (_status, label, overrides) => {
    render(
      <DetailPanel
        workspaceSlug="platform-ops"
        projectKey="OPS"
        basePath="/workspaces/platform-ops/projects/OPS"
        item={item}
        githubIssueSync={{
          ...githubIssueSync,
          status: _status,
          ...overrides
        }}
        comments={comments}
        versions={versions}
        timeline={timeline}
        members={members}
        states={states}
        sessionUserId="henry"
        membershipRole="owner"
      />
    );

    expect(screen.getByText(label)).toBeInTheDocument();
    if (overrides.conflictFields.length > 0) {
      expect(screen.getByText("Conflict fields: title, body")).toBeInTheDocument();
    }
    if (overrides.errorMessage) {
      expect(screen.getByText("GitHub rate limit exceeded.")).toBeInTheDocument();
    }
  });

  it("renders external GitHub issue comments in the timeline without local comment controls", () => {
    render(
      <DetailPanel
        workspaceSlug="platform-ops"
        projectKey="OPS"
        basePath="/workspaces/platform-ops/projects/OPS"
        item={item}
        comments={[]}
        versions={versions}
        timeline={githubCommentTimeline}
        members={members}
        states={states}
        sessionUserId="henry"
        membershipRole="owner"
      />
    );

    const githubComment = screen.getByText(/GitHub says/).closest("article");
    expect(githubComment).not.toBeNull();
    expect(within(githubComment!).getByText("GitHub comment")).toBeInTheDocument();
    expect(within(githubComment!).getByText("octocat")).toBeInTheDocument();
    expect(within(githubComment!).getByRole("link", { name: "Open on GitHub" })).toHaveAttribute(
      "href",
      "https://github.com/the-platform/platform-ops/issues/42#issuecomment-123456"
    );
    expect(within(githubComment!).queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(within(githubComment!).queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("lets editors switch the title into edit mode on demand", () => {
    render(
      <DetailPanel
        workspaceSlug="platform-ops"
        projectKey="OPS"
        basePath="/workspaces/platform-ops/projects/OPS"
        item={item}
        comments={comments}
        versions={versions}
        timeline={timeline}
        members={members}
        states={states}
        sessionUserId="henry"
        membershipRole="owner"
      />
    );

    expect(screen.queryByDisplayValue("Build board shell")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Build board shell/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Build board shell/i }));

    expect(screen.getByDisplayValue("Build board shell")).toBeInTheDocument();
  });

  it("commits a title change only once when Enter also blurs the input", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => ({
        workItem: {
          ...item,
          title: "Board shell v2"
        }
      })
    });

    vi.stubGlobal("fetch", fetchMock);

    render(
      <DetailPanel
        workspaceSlug="platform-ops"
        projectKey="OPS"
        basePath="/workspaces/platform-ops/projects/OPS"
        item={item}
        comments={comments}
        versions={versions}
        timeline={timeline}
        members={members}
        states={states}
        sessionUserId="henry"
        membershipRole="owner"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Build board shell/i }));

    const input = screen.getByDisplayValue("Build board shell");
    fireEvent.change(input, { target: { value: "Board shell v2" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});

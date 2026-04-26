export interface ProjectWorkspaceEngineeringItemView {
  taskId: string;
  identifier: string;
  title: string;
  repository: string | null;
  defaultBranch: string | null;
  branchName: string | null;
  pullRequestLabel: string;
  pullRequestUrl: string | null;
  pullRequestNumber: number | null;
  checkLabel: string;
  checkUrl: string | null;
  deployLabel: string;
  deployUrl: string | null;
  deployEnvironment: string | null;
  stageLabel: string;
  summary: string;
  hasPullRequest: boolean;
  hasFailingChecks: boolean;
  hasDeploy: boolean;
}

export interface ProjectWorkspaceEngineeringView {
  repository: string;
  connectionStatus: string;
  defaultBranch: string | null;
  pullRequests: string;
  checks: string;
  deploys: string;
  issueSummary: string[];
  items: ProjectWorkspaceEngineeringItemView[];
}

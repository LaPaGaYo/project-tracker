import assert from "node:assert/strict";
import test from "node:test";

import { getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";

import {
  githubCheckRollupStatuses,
  githubDeploymentEnvironments,
  githubDeploymentStatuses,
  githubIssueStates,
  githubIssueSyncOperationStatuses,
  githubIssueSyncOperationTypes,
  githubIssueSyncStatuses,
  githubPullRequestStates,
  githubRepositoryProviders,
  githubWebhookDeliveryStatuses,
  githubWebhookEventNames,
  workItemGithubLinkSources
} from "@the-platform/shared";

import {
  githubCheckRollups,
  githubCheckRollupStatusEnum,
  githubDeployments,
  githubDeploymentEnvironmentEnum,
  githubDeploymentStatusEnum,
  githubIssueComments,
  githubIssues,
  githubIssueStateEnum,
  githubIssueSyncOperationStatusEnum,
  githubIssueSyncOperations,
  githubIssueSyncOperationTypeEnum,
  githubIssueSyncStatusEnum,
  githubPullRequests,
  githubPullRequestStateEnum,
  githubRepositories,
  githubRepositoryProviderEnum,
  githubWebhookDeliveries,
  githubWebhookDeliveryStatusEnum,
  githubWebhookEventNameEnum,
  projectGithubConnections,
  schemaTableNames,
  taskGithubStatus,
  workItemGithubIssueLinks,
  workItemGithubLinks,
  workItemGithubLinkSourceEnum
} from "./schema";

function getIndexNames(table: Parameters<typeof getTableConfig>[0]): string[] {
  return getTableConfig(table)
    .indexes.map((index) => index.config.name)
    .filter((name): name is string => typeof name === "string");
}

void test("github schema adds normalized engineering tables without replacing task_github_status", () => {
  const githubTableNames: readonly string[] = [
    "task_github_status",
    "github_repositories",
    "project_github_connections",
    "github_pull_requests",
    "github_issues",
    "work_item_github_issue_links",
    "github_issue_sync_operations",
    "github_issue_comments",
    "github_check_rollups",
    "github_deployments",
    "work_item_github_links",
    "github_webhook_deliveries"
  ] as const;

  assert.deepEqual(
    schemaTableNames.filter((tableName) => githubTableNames.includes(tableName)),
    [...githubTableNames]
  );

  assert.equal(getTableName(taskGithubStatus), "task_github_status");
  assert.equal(getTableName(githubRepositories), "github_repositories");
  assert.equal(getTableName(projectGithubConnections), "project_github_connections");
  assert.equal(getTableName(githubPullRequests), "github_pull_requests");
  assert.equal(getTableName(githubIssues), "github_issues");
  assert.equal(getTableName(workItemGithubIssueLinks), "work_item_github_issue_links");
  assert.equal(getTableName(githubIssueSyncOperations), "github_issue_sync_operations");
  assert.equal(getTableName(githubIssueComments), "github_issue_comments");
  assert.equal(getTableName(githubCheckRollups), "github_check_rollups");
  assert.equal(getTableName(githubDeployments), "github_deployments");
  assert.equal(getTableName(workItemGithubLinks), "work_item_github_links");
  assert.equal(getTableName(githubWebhookDeliveries), "github_webhook_deliveries");
});

void test("github schema enums stay aligned with shared contracts", () => {
  assert.deepEqual(githubRepositoryProviderEnum.enumValues, githubRepositoryProviders);
  assert.deepEqual(githubPullRequestStateEnum.enumValues, githubPullRequestStates);
  assert.deepEqual(githubCheckRollupStatusEnum.enumValues, githubCheckRollupStatuses);
  assert.deepEqual(githubDeploymentEnvironmentEnum.enumValues, githubDeploymentEnvironments);
  assert.deepEqual(githubDeploymentStatusEnum.enumValues, githubDeploymentStatuses);
  assert.deepEqual(githubIssueStateEnum.enumValues, githubIssueStates);
  assert.deepEqual(githubIssueSyncStatusEnum.enumValues, githubIssueSyncStatuses);
  assert.deepEqual(githubIssueSyncOperationStatusEnum.enumValues, githubIssueSyncOperationStatuses);
  assert.deepEqual(githubIssueSyncOperationTypeEnum.enumValues, githubIssueSyncOperationTypes);
  assert.deepEqual(workItemGithubLinkSourceEnum.enumValues, workItemGithubLinkSources);
  assert.deepEqual(githubWebhookEventNameEnum.enumValues, githubWebhookEventNames);
  assert.deepEqual(githubWebhookDeliveryStatusEnum.enumValues, githubWebhookDeliveryStatuses);
});

void test("github schema defines the unique keys and replay indexes needed for live integration", () => {
  assert.deepEqual(getIndexNames(githubRepositories), [
    "github_repositories_workspace_idx",
    "github_repositories_full_name_idx",
    "github_repositories_provider_repo_unique"
  ]);
  assert.deepEqual(getIndexNames(projectGithubConnections), [
    "project_github_connections_project_unique",
    "project_github_connections_repository_unique"
  ]);
  assert.deepEqual(getIndexNames(githubPullRequests), [
    "github_pull_requests_head_sha_idx",
    "github_pull_requests_repository_number_unique",
    "github_pull_requests_repository_provider_pr_unique"
  ]);
  assert.deepEqual(getIndexNames(githubIssues), [
    "github_issues_repository_state_updated_idx",
    "github_issues_repository_number_unique",
    "github_issues_repository_provider_issue_unique"
  ]);
  assert.deepEqual(getIndexNames(workItemGithubIssueLinks), [
    "work_item_github_issue_links_repository_status_idx",
    "work_item_github_issue_links_work_item_unique",
    "work_item_github_issue_links_github_issue_unique"
  ]);
  assert.deepEqual(getIndexNames(githubIssueSyncOperations), [
    "github_issue_sync_operations_link_status_requested_idx",
    "github_issue_sync_operations_operation_key_unique"
  ]);
  assert.deepEqual(getIndexNames(githubIssueComments), [
    "github_issue_comments_issue_created_idx",
    "github_issue_comments_issue_provider_comment_unique"
  ]);
  assert.deepEqual(getIndexNames(githubCheckRollups), [
    "github_check_rollups_status_idx",
    "github_check_rollups_repository_head_sha_unique"
  ]);
  assert.deepEqual(getIndexNames(githubDeployments), [
    "github_deployments_head_sha_environment_idx",
    "github_deployments_repository_provider_deployment_unique"
  ]);
  assert.deepEqual(getIndexNames(workItemGithubLinks), [
    "work_item_github_links_work_item_idx",
    "work_item_github_links_pull_request_idx",
    "work_item_github_links_work_item_pull_request_unique"
  ]);
  assert.deepEqual(getIndexNames(githubWebhookDeliveries), [
    "github_webhook_deliveries_repository_status_idx",
    "github_webhook_deliveries_delivery_id_unique"
  ]);
});

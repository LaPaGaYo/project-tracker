import {
  githubCheckRollupStatuses,
  githubDeploymentEnvironments,
  githubDeploymentStatuses,
  githubPullRequestStates,
  githubRepositoryProviders,
  githubWebhookDeliveryStatuses,
  githubWebhookEventNames,
  notificationEventTypes,
  notificationPriorities,
  notificationRecipientReasons,
  notificationSourceTypes,
  workItemGithubLinkSources
} from "./constants";
import type {
  GithubCheckRollupStatus,
  GithubDeploymentEnvironment,
  GithubDeploymentStatus,
  GithubPullRequestState,
  GithubRepositoryProvider,
  GithubWebhookDeliveryStatus,
  GithubWebhookEventName,
  NotificationEventType,
  NotificationPriority,
  NotificationRecipientReason,
  NotificationSourceType,
  WorkItemGithubLinkSource
} from "./constants";
import type {
  GithubCheckRollupRecord,
  GithubDeploymentRecord,
  GithubPullRequestRecord,
  GithubRepositoryRecord,
  GithubWebhookDeliveryRecord,
  NotificationEventRecord,
  NotificationInboxItem,
  NotificationPreferenceRecord,
  NotificationRecipientRecord,
  ProjectGithubConnectionRecord,
  WorkItemGithubLinkRecord
} from "./types";

type Equal<Left, Right> = (
  (<Type>() => Type extends Left ? 1 : 2) extends <Type>() => Type extends Right ? 1 : 2 ? true : false
) extends true
  ? (<Type>() => Type extends Right ? 1 : 2) extends <Type>() => Type extends Left ? 1 : 2
    ? true
    : false
  : false;
type Expect<Type extends true> = Type;

export const sharedGithubContractValues = {
  githubCheckRollupStatuses,
  githubDeploymentEnvironments,
  githubDeploymentStatuses,
  githubPullRequestStates,
  githubRepositoryProviders,
  githubWebhookDeliveryStatuses,
  githubWebhookEventNames,
  notificationEventTypes,
  notificationPriorities,
  notificationRecipientReasons,
  notificationSourceTypes,
  workItemGithubLinkSources
} as const;

export type SharedGithubContractAssertions = [
  Expect<Equal<(typeof githubRepositoryProviders)[number], GithubRepositoryProvider>>,
  Expect<Equal<(typeof githubPullRequestStates)[number], GithubPullRequestState>>,
  Expect<Equal<(typeof githubCheckRollupStatuses)[number], GithubCheckRollupStatus>>,
  Expect<Equal<(typeof githubDeploymentEnvironments)[number], GithubDeploymentEnvironment>>,
  Expect<Equal<(typeof githubDeploymentStatuses)[number], GithubDeploymentStatus>>,
  Expect<Equal<(typeof workItemGithubLinkSources)[number], WorkItemGithubLinkSource>>,
  Expect<Equal<(typeof githubWebhookDeliveryStatuses)[number], GithubWebhookDeliveryStatus>>,
  Expect<Equal<(typeof githubWebhookEventNames)[number], GithubWebhookEventName>>,
  Expect<
    Equal<
      keyof GithubRepositoryRecord,
      | "id"
      | "workspaceId"
      | "provider"
      | "providerRepositoryId"
      | "owner"
      | "name"
      | "fullName"
      | "defaultBranch"
      | "installationId"
      | "isActive"
      | "createdAt"
      | "updatedAt"
    >
  >,
  Expect<Equal<GithubRepositoryRecord["provider"], GithubRepositoryProvider>>,
  Expect<
    Equal<
      keyof ProjectGithubConnectionRecord,
      | "id"
      | "projectId"
      | "repositoryId"
      | "stagingEnvironmentName"
      | "productionEnvironmentName"
      | "createdAt"
      | "updatedAt"
    >
  >,
  Expect<
    Equal<
      keyof GithubPullRequestRecord,
      | "id"
      | "repositoryId"
      | "providerPullRequestId"
      | "number"
      | "title"
      | "body"
      | "url"
      | "state"
      | "isDraft"
      | "authorLogin"
      | "baseBranch"
      | "headBranch"
      | "headSha"
      | "mergedAt"
      | "closedAt"
      | "createdAt"
      | "updatedAt"
    >
  >,
  Expect<Equal<GithubPullRequestRecord["state"], GithubPullRequestState>>,
  Expect<
    Equal<
      keyof GithubCheckRollupRecord,
      | "id"
      | "repositoryId"
      | "headSha"
      | "status"
      | "url"
      | "checkCount"
      | "completedAt"
      | "createdAt"
      | "updatedAt"
    >
  >,
  Expect<Equal<GithubCheckRollupRecord["status"], GithubCheckRollupStatus>>,
  Expect<
    Equal<
      keyof GithubDeploymentRecord,
      | "id"
      | "repositoryId"
      | "providerDeploymentId"
      | "headSha"
      | "environmentName"
      | "environment"
      | "status"
      | "url"
      | "createdAt"
      | "updatedAt"
    >
  >,
  Expect<Equal<GithubDeploymentRecord["environment"], GithubDeploymentEnvironment>>,
  Expect<Equal<GithubDeploymentRecord["status"], GithubDeploymentStatus>>,
  Expect<
    Equal<
      keyof WorkItemGithubLinkRecord,
      | "id"
      | "workItemId"
      | "repositoryId"
      | "pullRequestId"
      | "branchName"
      | "source"
      | "confidence"
      | "linkedAt"
    >
  >,
  Expect<Equal<WorkItemGithubLinkRecord["source"], WorkItemGithubLinkSource>>,
  Expect<
    Equal<
      keyof GithubWebhookDeliveryRecord,
      | "id"
      | "repositoryId"
      | "deliveryId"
      | "eventName"
      | "status"
      | "receivedAt"
      | "processedAt"
      | "errorMessage"
    >
  >,
  Expect<Equal<GithubWebhookDeliveryRecord["status"], GithubWebhookDeliveryStatus>>,
  Expect<Equal<GithubWebhookDeliveryRecord["eventName"], GithubWebhookEventName>>,
  Expect<Equal<(typeof notificationSourceTypes)[number], NotificationSourceType>>,
  Expect<Equal<(typeof notificationEventTypes)[number], NotificationEventType>>,
  Expect<Equal<(typeof notificationPriorities)[number], NotificationPriority>>,
  Expect<Equal<(typeof notificationRecipientReasons)[number], NotificationRecipientReason>>,
  Expect<
    Equal<
      keyof NotificationEventRecord,
      | "id"
      | "workspaceId"
      | "projectId"
      | "workItemId"
      | "sourceType"
      | "sourceId"
      | "eventType"
      | "actorId"
      | "priority"
      | "title"
      | "body"
      | "url"
      | "metadata"
      | "createdAt"
    >
  >,
  Expect<Equal<NotificationEventRecord["sourceType"], NotificationSourceType>>,
  Expect<Equal<NotificationEventRecord["eventType"], NotificationEventType>>,
  Expect<Equal<NotificationEventRecord["priority"], NotificationPriority>>,
  Expect<
    Equal<
      keyof NotificationRecipientRecord,
      | "id"
      | "eventId"
      | "workspaceId"
      | "recipientId"
      | "reason"
      | "readAt"
      | "dismissedAt"
      | "createdAt"
    >
  >,
  Expect<Equal<NotificationRecipientRecord["reason"], NotificationRecipientReason>>,
  Expect<
    Equal<
      keyof NotificationPreferenceRecord,
      | "workspaceId"
      | "userId"
      | "commentsEnabled"
      | "mentionsEnabled"
      | "assignmentsEnabled"
      | "githubEnabled"
      | "stateChangesEnabled"
      | "createdAt"
      | "updatedAt"
    >
  >,
  Expect<
    Equal<
      keyof NotificationInboxItem,
      | "event"
      | "recipient"
      | "workItemIdentifier"
      | "projectKey"
      | "workspaceSlug"
      | "isUnread"
    >
  >,
  Expect<Equal<NotificationInboxItem["event"], NotificationEventRecord>>,
  Expect<Equal<NotificationInboxItem["recipient"], NotificationRecipientRecord>>
];

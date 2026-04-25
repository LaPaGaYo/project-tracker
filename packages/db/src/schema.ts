import { relations, sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar
} from "drizzle-orm/pg-core";

import {
  githubCheckRollupStatuses,
  githubDeploymentEnvironments,
  githubDeploymentStatuses,
  githubPullRequestStates,
  githubRepositoryProviders,
  githubWebhookDeliveryStatuses,
  githubWebhookEventNames,
  invitationStatuses,
  notificationEventTypes,
  notificationPriorities,
  notificationRecipientReasons,
  notificationSourceTypes,
  planItemStatuses,
  projectStages as projectLifecycleStages,
  stageStatuses,
  taskGithubCiStatuses,
  taskGithubDeployStatuses,
  taskGithubPrStatuses,
  taskStatuses,
  workflowStateCategories,
  workspaceRoles,
  workItemGithubLinkSources,
  workItemPriorities,
  workItemTypes
} from "@the-platform/shared";

export const projectStageEnum = pgEnum("project_stage", projectLifecycleStages);
export const taskStatusEnum = pgEnum("task_status", taskStatuses);
export const stageStatusEnum = pgEnum("stage_status", stageStatuses);
export const planItemStatusEnum = pgEnum("plan_item_status", planItemStatuses);
export const taskGithubPrStatusEnum = pgEnum("task_github_pr_status", taskGithubPrStatuses);
export const taskGithubCiStatusEnum = pgEnum("task_github_ci_status", taskGithubCiStatuses);
export const taskGithubDeployStatusEnum = pgEnum("task_github_deploy_status", taskGithubDeployStatuses);
export const githubRepositoryProviderEnum = pgEnum("github_repository_provider", githubRepositoryProviders);
export const githubPullRequestStateEnum = pgEnum("github_pull_request_state", githubPullRequestStates);
export const githubCheckRollupStatusEnum = pgEnum("github_check_rollup_status", githubCheckRollupStatuses);
export const githubDeploymentEnvironmentEnum = pgEnum("github_deployment_environment", githubDeploymentEnvironments);
export const githubDeploymentStatusEnum = pgEnum("github_deployment_status", githubDeploymentStatuses);
export const workItemGithubLinkSourceEnum = pgEnum("work_item_github_link_source", workItemGithubLinkSources);
export const githubWebhookEventNameEnum = pgEnum("github_webhook_event_name", githubWebhookEventNames);
export const githubWebhookDeliveryStatusEnum = pgEnum("github_webhook_delivery_status", githubWebhookDeliveryStatuses);
export const notificationSourceTypeEnum = pgEnum("notification_source_type", notificationSourceTypes);
export const notificationEventTypeEnum = pgEnum("notification_event_type", notificationEventTypes);
export const notificationPriorityEnum = pgEnum("notification_priority", notificationPriorities);
export const notificationRecipientReasonEnum = pgEnum(
  "notification_recipient_reason",
  notificationRecipientReasons
);
export const workspaceRoleEnum = pgEnum("workspace_role", workspaceRoles);
export const invitationStatusEnum = pgEnum("invitation_status", invitationStatuses);
export const workItemTypeEnum = pgEnum("work_item_type", workItemTypes);
export const workItemPriorityEnum = pgEnum("work_item_priority", workItemPriorities);
export const workflowStateCategoryEnum = pgEnum("workflow_state_category", workflowStateCategories);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    key: varchar("key", { length: 8 }).notNull(),
    itemCounter: integer("item_counter").notNull().default(0),
    title: varchar("title", { length: 160 }).notNull(),
    description: text("description").notNull().default(""),
    stage: projectStageEnum("stage").notNull().default("Planning"),
    dueDate: timestamp("due_date", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    workspaceKeyIndex: uniqueIndex("projects_workspace_key_idx").on(table.workspaceId, table.key),
    stageIndex: index("projects_stage_idx").on(table.stage),
    createdAtIndex: index("projects_created_at_idx").on(table.createdAt),
    workspaceUpdatedIndex: index("projects_workspace_updated_idx").on(table.workspaceId, table.updatedAt)
  })
);

export const projectStages = pgTable(
  "project_stages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    slug: varchar("slug", { length: 80 }).notNull(),
    title: varchar("title", { length: 160 }).notNull(),
    goal: text("goal").notNull().default(""),
    status: stageStatusEnum("status").notNull().default("Planned"),
    gateStatus: varchar("gate_status", { length: 64 }).notNull().default("Pending"),
    sortOrder: integer("sort_order").notNull().default(0)
  },
  (table) => ({
    projectSortIndex: index("project_stages_project_sort_idx").on(table.projectId, table.sortOrder),
    slugUnique: uniqueIndex("project_stages_project_slug_unique").on(table.projectId, table.slug),
    projectStageKey: uniqueIndex("project_stages_project_id_id_unique").on(table.projectId, table.id)
  })
);

export const planItems = pgTable(
  "plan_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    stageId: uuid("stage_id")
      .notNull()
      .references(() => projectStages.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 160 }).notNull(),
    outcome: text("outcome").notNull().default(""),
    status: planItemStatusEnum("status").notNull().default("Todo"),
    blocker: text("blocker"),
    sortOrder: integer("sort_order").notNull().default(0)
  },
  (table) => ({
    stageIndex: index("plan_items_stage_idx").on(table.stageId, table.sortOrder),
    stagePlanItemKey: uniqueIndex("plan_items_stage_id_id_unique").on(table.stageId, table.id)
  })
);

export const workflowStates = pgTable(
  "workflow_states",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 60 }).notNull(),
    category: workflowStateCategoryEnum("category").notNull(),
    position: integer("position").notNull().default(0),
    color: varchar("color", { length: 7 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    projectPositionIndex: index("workflow_states_project_position_idx").on(table.projectId, table.position)
  })
);

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 160 }).notNull(),
    description: text("description").notNull().default(""),
    status: taskStatusEnum("status").notNull().default("Todo"),
    type: workItemTypeEnum("type").notNull().default("task"),
    parentId: uuid("parent_id").references((): AnyPgColumn => tasks.id, { onDelete: "cascade" }),
    assigneeId: varchar("assignee_id", { length: 255 }),
    identifier: varchar("identifier", { length: 20 }),
    priority: workItemPriorityEnum("priority").notNull().default("none"),
    labels: text("labels").array(),
    workflowStateId: uuid("workflow_state_id").references(() => workflowStates.id, { onDelete: "set null" }),
    stageId: uuid("stage_id").references(() => projectStages.id, { onDelete: "set null" }),
    planItemId: uuid("plan_item_id").references(() => planItems.id, { onDelete: "set null" }),
    position: integer("position").notNull().default(0),
    blockedReason: text("blocked_reason"),
    dueDate: timestamp("due_date", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    projectStatusIndex: index("tasks_project_status_idx").on(table.projectId, table.status),
    positionIndex: index("tasks_project_position_idx").on(table.projectId, table.position),
    identifierIndex: uniqueIndex("tasks_project_identifier_idx").on(table.projectId, table.identifier),
    workflowStateIndex: index("tasks_workflow_state_idx").on(table.workflowStateId),
    stageIndex: index("tasks_stage_idx").on(table.stageId),
    planItemIndex: index("tasks_plan_item_idx").on(table.planItemId),
    assigneeIndex: index("tasks_assignee_idx").on(table.assigneeId),
    parentIndex: index("tasks_parent_idx").on(table.parentId),
    projectStageReference: foreignKey({
      name: "tasks_project_stage_fk",
      columns: [table.projectId, table.stageId],
      foreignColumns: [projectStages.projectId, projectStages.id]
    }),
    stagePlanItemReference: foreignKey({
      name: "tasks_stage_plan_item_fk",
      columns: [table.stageId, table.planItemId],
      foreignColumns: [planItems.stageId, planItems.id]
    }),
    planItemRequiresStage: check(
      "tasks_plan_item_requires_stage_check",
      sql`"plan_item_id" IS NULL OR "stage_id" IS NOT NULL`
    )
  })
);

export const taskGithubStatus = pgTable(
  "task_github_status",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    prStatus: taskGithubPrStatusEnum("pr_status").notNull().default("No PR"),
    ciStatus: taskGithubCiStatusEnum("ci_status").notNull().default("Unknown"),
    deployStatus: taskGithubDeployStatusEnum("deploy_status").notNull().default("Not deployed")
  },
  (table) => ({
    taskUnique: uniqueIndex("task_github_status_task_id_unique").on(table.taskId)
  })
);

export const githubRepositories = pgTable(
  "github_repositories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    provider: githubRepositoryProviderEnum("provider").notNull().default("github"),
    providerRepositoryId: varchar("provider_repository_id", { length: 255 }).notNull(),
    owner: varchar("owner", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    fullName: varchar("full_name", { length: 255 }).notNull(),
    defaultBranch: varchar("default_branch", { length: 255 }).notNull(),
    installationId: varchar("installation_id", { length: 255 }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    workspaceIndex: index("github_repositories_workspace_idx").on(table.workspaceId),
    fullNameIndex: index("github_repositories_full_name_idx").on(table.fullName),
    providerRepositoryUnique: uniqueIndex("github_repositories_provider_repo_unique").on(
      table.provider,
      table.providerRepositoryId
    )
  })
);

export const projectGithubConnections = pgTable(
  "project_github_connections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    repositoryId: uuid("repository_id")
      .notNull()
      .references(() => githubRepositories.id, { onDelete: "cascade" }),
    stagingEnvironmentName: varchar("staging_environment_name", { length: 255 }),
    productionEnvironmentName: varchar("production_environment_name", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    projectUnique: uniqueIndex("project_github_connections_project_unique").on(table.projectId),
    repositoryUnique: uniqueIndex("project_github_connections_repository_unique").on(table.repositoryId)
  })
);

export const githubPullRequests = pgTable(
  "github_pull_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    repositoryId: uuid("repository_id")
      .notNull()
      .references(() => githubRepositories.id, { onDelete: "cascade" }),
    providerPullRequestId: varchar("provider_pull_request_id", { length: 255 }).notNull(),
    number: integer("number").notNull(),
    title: varchar("title", { length: 300 }).notNull(),
    body: text("body"),
    url: text("url").notNull(),
    state: githubPullRequestStateEnum("state").notNull().default("open"),
    isDraft: boolean("is_draft").notNull().default(false),
    authorLogin: varchar("author_login", { length: 255 }),
    baseBranch: varchar("base_branch", { length: 255 }).notNull(),
    headBranch: varchar("head_branch", { length: 255 }).notNull(),
    headSha: varchar("head_sha", { length: 64 }).notNull(),
    mergedAt: timestamp("merged_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    headShaIndex: index("github_pull_requests_head_sha_idx").on(table.repositoryId, table.headSha),
    repositoryNumberUnique: uniqueIndex("github_pull_requests_repository_number_unique").on(
      table.repositoryId,
      table.number
    ),
    repositoryProviderPrUnique: uniqueIndex("github_pull_requests_repository_provider_pr_unique").on(
      table.repositoryId,
      table.providerPullRequestId
    )
  })
);

export const githubCheckRollups = pgTable(
  "github_check_rollups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    repositoryId: uuid("repository_id")
      .notNull()
      .references(() => githubRepositories.id, { onDelete: "cascade" }),
    headSha: varchar("head_sha", { length: 64 }).notNull(),
    status: githubCheckRollupStatusEnum("status").notNull().default("unknown"),
    url: text("url"),
    checkCount: integer("check_count").notNull().default(0),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    statusIndex: index("github_check_rollups_status_idx").on(table.status),
    repositoryHeadShaUnique: uniqueIndex("github_check_rollups_repository_head_sha_unique").on(
      table.repositoryId,
      table.headSha
    )
  })
);

export const githubDeployments = pgTable(
  "github_deployments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    repositoryId: uuid("repository_id")
      .notNull()
      .references(() => githubRepositories.id, { onDelete: "cascade" }),
    providerDeploymentId: varchar("provider_deployment_id", { length: 255 }).notNull(),
    headSha: varchar("head_sha", { length: 64 }).notNull(),
    environmentName: varchar("environment_name", { length: 255 }),
    environment: githubDeploymentEnvironmentEnum("environment").notNull().default("other"),
    status: githubDeploymentStatusEnum("status").notNull().default("unknown"),
    url: text("url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    headShaEnvironmentIndex: index("github_deployments_head_sha_environment_idx").on(
      table.repositoryId,
      table.headSha,
      table.environment
    ),
    repositoryProviderDeploymentUnique: uniqueIndex("github_deployments_repository_provider_deployment_unique").on(
      table.repositoryId,
      table.providerDeploymentId
    )
  })
);

export const workItemGithubLinks = pgTable(
  "work_item_github_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workItemId: uuid("work_item_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    repositoryId: uuid("repository_id")
      .notNull()
      .references(() => githubRepositories.id, { onDelete: "cascade" }),
    pullRequestId: uuid("pull_request_id").references(() => githubPullRequests.id, { onDelete: "set null" }),
    branchName: varchar("branch_name", { length: 255 }),
    source: workItemGithubLinkSourceEnum("source").notNull().default("manual"),
    confidence: integer("confidence").notNull().default(100),
    linkedAt: timestamp("linked_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    workItemIndex: index("work_item_github_links_work_item_idx").on(table.workItemId),
    pullRequestIndex: index("work_item_github_links_pull_request_idx").on(table.pullRequestId),
    workItemPullRequestUnique: uniqueIndex("work_item_github_links_work_item_pull_request_unique").on(
      table.workItemId,
      table.pullRequestId
    )
  })
);

export const githubWebhookDeliveries = pgTable(
  "github_webhook_deliveries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    repositoryId: uuid("repository_id").references(() => githubRepositories.id, { onDelete: "set null" }),
    deliveryId: varchar("delivery_id", { length: 255 }).notNull(),
    eventName: githubWebhookEventNameEnum("event_name").notNull(),
    status: githubWebhookDeliveryStatusEnum("status").notNull().default("pending"),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    errorMessage: text("error_message")
  },
  (table) => ({
    repositoryStatusIndex: index("github_webhook_deliveries_repository_status_idx").on(
      table.repositoryId,
      table.status,
      table.receivedAt
    ),
    deliveryIdUnique: uniqueIndex("github_webhook_deliveries_delivery_id_unique").on(table.deliveryId)
  })
);

export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    slug: varchar("slug", { length: 120 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    slugIndex: uniqueIndex("workspaces_slug_idx").on(table.slug),
    createdAtIndex: index("workspaces_created_at_idx").on(table.createdAt)
  })
);

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 255 }).notNull(),
    role: workspaceRoleEnum("role").notNull().default("member"),
    invitedAt: timestamp("invited_at", { withTimezone: true }).notNull().defaultNow(),
    joinedAt: timestamp("joined_at", { withTimezone: true })
  },
  (table) => ({
    pk: primaryKey({ columns: [table.workspaceId, table.userId], name: "workspace_members_pk" }),
    userIndex: index("workspace_members_user_idx").on(table.userId),
    roleIndex: index("workspace_members_role_idx").on(table.workspaceId, table.role)
  })
);

export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 255 }).notNull(),
    role: workspaceRoleEnum("role").notNull().default("member"),
    status: invitationStatusEnum("status").notNull().default("pending"),
    invitedBy: varchar("invited_by", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    workspaceStatusIndex: index("invitations_workspace_status_idx").on(table.workspaceId, table.status),
    emailStatusIndex: index("invitations_email_status_idx").on(table.email, table.status)
  })
);

export const activityLog = pgTable(
  "activity_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    entityType: varchar("entity_type", { length: 30 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    action: varchar("action", { length: 30 }).notNull(),
    actorId: varchar("actor_id", { length: 255 }).notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    entityIndex: index("activity_log_entity_created_idx").on(table.entityType, table.entityId, table.createdAt),
    workspaceIndex: index("activity_log_workspace_created_idx").on(table.workspaceId, table.createdAt)
  })
);

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workItemId: uuid("work_item_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    authorId: varchar("author_id", { length: 255 }).notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true })
  },
  (table) => ({
    workItemCreatedIndex: index("comments_work_item_created_idx").on(table.workItemId, table.createdAt),
    authorIndex: index("comments_author_idx").on(table.authorId),
    deletedIndex: index("comments_deleted_idx").on(table.deletedAt)
  })
);

export const descriptionVersions = pgTable(
  "description_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workItemId: uuid("work_item_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    authorId: varchar("author_id", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    workItemCreatedIndex: index("description_versions_work_item_created_idx").on(table.workItemId, table.createdAt),
    authorIndex: index("description_versions_author_idx").on(table.authorId)
  })
);

export const notificationEvents = pgTable(
  "notification_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    workItemId: uuid("work_item_id").references(() => tasks.id, { onDelete: "set null" }),
    sourceType: notificationSourceTypeEnum("source_type").notNull(),
    sourceId: varchar("source_id", { length: 255 }).notNull(),
    eventType: notificationEventTypeEnum("event_type").notNull(),
    actorId: varchar("actor_id", { length: 255 }),
    priority: notificationPriorityEnum("priority").notNull().default("normal"),
    title: varchar("title", { length: 220 }).notNull(),
    body: text("body"),
    url: text("url").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    workspaceCreatedIndex: index("notification_events_workspace_created_idx").on(
      table.workspaceId,
      table.createdAt
    ),
    projectCreatedIndex: index("notification_events_project_created_idx").on(table.projectId, table.createdAt),
    workItemCreatedIndex: index("notification_events_work_item_created_idx").on(
      table.workItemId,
      table.createdAt
    ),
    workspaceSourceEventUnique: uniqueIndex("notification_events_workspace_source_event_unique").on(
      table.workspaceId,
      table.sourceType,
      table.sourceId,
      table.eventType
    )
  })
);

export const notificationRecipients = pgTable(
  "notification_recipients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => notificationEvents.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    recipientId: varchar("recipient_id", { length: 255 }).notNull(),
    reason: notificationRecipientReasonEnum("reason").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    workspaceRecipientReadCreatedIndex: index(
      "notification_recipients_workspace_recipient_read_created_idx"
    ).on(table.workspaceId, table.recipientId, table.readAt, table.createdAt),
    workspaceRecipientCreatedIndex: index("notification_recipients_workspace_recipient_created_idx").on(
      table.workspaceId,
      table.recipientId,
      table.createdAt
    ),
    eventRecipientReasonUnique: uniqueIndex("notification_recipients_event_recipient_reason_unique").on(
      table.eventId,
      table.recipientId,
      table.reason
    )
  })
);

export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 255 }).notNull(),
    commentsEnabled: boolean("comments_enabled").notNull().default(true),
    mentionsEnabled: boolean("mentions_enabled").notNull().default(true),
    assignmentsEnabled: boolean("assignments_enabled").notNull().default(true),
    githubEnabled: boolean("github_enabled").notNull().default(true),
    stateChangesEnabled: boolean("state_changes_enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    workspaceUserUnique: uniqueIndex("notification_preferences_workspace_user_unique").on(
      table.workspaceId,
      table.userId
    )
  })
);

export const projectRelations = relations(projects, ({ many, one }) => ({
  tasks: many(tasks),
  workflowStates: many(workflowStates),
  stages: many(projectStages),
  notificationEvents: many(notificationEvents),
  githubConnection: one(projectGithubConnections, {
    fields: [projects.id],
    references: [projectGithubConnections.projectId]
  })
}));

export const projectStageRelations = relations(projectStages, ({ many, one }) => ({
  project: one(projects, {
    fields: [projectStages.projectId],
    references: [projects.id]
  }),
  planItems: many(planItems),
  tasks: many(tasks)
}));

export const planItemRelations = relations(planItems, ({ many, one }) => ({
  stage: one(projectStages, {
    fields: [planItems.stageId],
    references: [projectStages.id]
  }),
  tasks: many(tasks)
}));

export const taskRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id]
  }),
  parent: one(tasks, {
    fields: [tasks.parentId],
    references: [tasks.id],
    relationName: "task_parent"
  }),
  children: many(tasks, {
    relationName: "task_parent"
  }),
  workflowState: one(workflowStates, {
    fields: [tasks.workflowStateId],
    references: [workflowStates.id]
  }),
  stage: one(projectStages, {
    fields: [tasks.stageId],
    references: [projectStages.id]
  }),
  planItem: one(planItems, {
    fields: [tasks.planItemId],
    references: [planItems.id]
  }),
  githubStatus: one(taskGithubStatus, {
    fields: [tasks.id],
    references: [taskGithubStatus.taskId]
  }),
  githubLinks: many(workItemGithubLinks),
  comments: many(comments),
  descriptionVersions: many(descriptionVersions),
  notificationEvents: many(notificationEvents)
}));

export const taskGithubStatusRelations = relations(taskGithubStatus, ({ one }) => ({
  task: one(tasks, {
    fields: [taskGithubStatus.taskId],
    references: [tasks.id]
  })
}));

export const githubRepositoryRelations = relations(githubRepositories, ({ many, one }) => ({
  workspace: one(workspaces, {
    fields: [githubRepositories.workspaceId],
    references: [workspaces.id]
  }),
  projectConnections: many(projectGithubConnections),
  pullRequests: many(githubPullRequests),
  checkRollups: many(githubCheckRollups),
  deployments: many(githubDeployments),
  workItemLinks: many(workItemGithubLinks),
  webhookDeliveries: many(githubWebhookDeliveries)
}));

export const projectGithubConnectionRelations = relations(projectGithubConnections, ({ one }) => ({
  project: one(projects, {
    fields: [projectGithubConnections.projectId],
    references: [projects.id]
  }),
  repository: one(githubRepositories, {
    fields: [projectGithubConnections.repositoryId],
    references: [githubRepositories.id]
  })
}));

export const githubPullRequestRelations = relations(githubPullRequests, ({ many, one }) => ({
  repository: one(githubRepositories, {
    fields: [githubPullRequests.repositoryId],
    references: [githubRepositories.id]
  }),
  workItemLinks: many(workItemGithubLinks)
}));

export const githubCheckRollupRelations = relations(githubCheckRollups, ({ one }) => ({
  repository: one(githubRepositories, {
    fields: [githubCheckRollups.repositoryId],
    references: [githubRepositories.id]
  })
}));

export const githubDeploymentRelations = relations(githubDeployments, ({ one }) => ({
  repository: one(githubRepositories, {
    fields: [githubDeployments.repositoryId],
    references: [githubRepositories.id]
  })
}));

export const workItemGithubLinkRelations = relations(workItemGithubLinks, ({ one }) => ({
  workItem: one(tasks, {
    fields: [workItemGithubLinks.workItemId],
    references: [tasks.id]
  }),
  repository: one(githubRepositories, {
    fields: [workItemGithubLinks.repositoryId],
    references: [githubRepositories.id]
  }),
  pullRequest: one(githubPullRequests, {
    fields: [workItemGithubLinks.pullRequestId],
    references: [githubPullRequests.id]
  })
}));

export const githubWebhookDeliveryRelations = relations(githubWebhookDeliveries, ({ one }) => ({
  repository: one(githubRepositories, {
    fields: [githubWebhookDeliveries.repositoryId],
    references: [githubRepositories.id]
  })
}));

export const workflowStateRelations = relations(workflowStates, ({ one, many }) => ({
  project: one(projects, {
    fields: [workflowStates.projectId],
    references: [projects.id]
  }),
  workItems: many(tasks)
}));

export const workspaceRelations = relations(workspaces, ({ many }) => ({
  invitations: many(invitations),
  members: many(workspaceMembers),
  projects: many(projects),
  githubRepositories: many(githubRepositories),
  activityEntries: many(activityLog),
  notificationEvents: many(notificationEvents),
  notificationRecipients: many(notificationRecipients),
  notificationPreferences: many(notificationPreferences)
}));

export const workspaceMemberRelations = relations(workspaceMembers, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [workspaceMembers.workspaceId],
    references: [workspaces.id]
  })
}));

export const invitationRelations = relations(invitations, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [invitations.workspaceId],
    references: [workspaces.id]
  })
}));

export const activityLogRelations = relations(activityLog, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [activityLog.workspaceId],
    references: [workspaces.id]
  })
}));

export const commentRelations = relations(comments, ({ one }) => ({
  workItem: one(tasks, {
    fields: [comments.workItemId],
    references: [tasks.id]
  })
}));

export const descriptionVersionRelations = relations(descriptionVersions, ({ one }) => ({
  workItem: one(tasks, {
    fields: [descriptionVersions.workItemId],
    references: [tasks.id]
  })
}));

export const notificationEventRelations = relations(notificationEvents, ({ many, one }) => ({
  workspace: one(workspaces, {
    fields: [notificationEvents.workspaceId],
    references: [workspaces.id]
  }),
  project: one(projects, {
    fields: [notificationEvents.projectId],
    references: [projects.id]
  }),
  workItem: one(tasks, {
    fields: [notificationEvents.workItemId],
    references: [tasks.id]
  }),
  recipients: many(notificationRecipients)
}));

export const notificationRecipientRelations = relations(notificationRecipients, ({ one }) => ({
  event: one(notificationEvents, {
    fields: [notificationRecipients.eventId],
    references: [notificationEvents.id]
  }),
  workspace: one(workspaces, {
    fields: [notificationRecipients.workspaceId],
    references: [workspaces.id]
  })
}));

export const notificationPreferenceRelations = relations(notificationPreferences, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [notificationPreferences.workspaceId],
    references: [workspaces.id]
  })
}));

export const schema = {
  activityLog,
  comments,
  descriptionVersions,
  githubCheckRollups,
  githubDeployments,
  githubPullRequests,
  githubRepositories,
  githubWebhookDeliveries,
  invitations,
  notificationEvents,
  notificationPreferences,
  notificationRecipients,
  planItems,
  projectGithubConnections,
  projects,
  projectStages,
  tasks,
  taskGithubStatus,
  workflowStates,
  workItemGithubLinks,
  workspaceMembers,
  workspaces
};

export const schemaTableNames = [
  "projects",
  "project_stages",
  "plan_items",
  "tasks",
  "workflow_states",
  "activity_log",
  "comments",
  "description_versions",
  "workspaces",
  "workspace_members",
  "invitations",
  "task_github_status",
  "github_repositories",
  "project_github_connections",
  "github_pull_requests",
  "github_check_rollups",
  "github_deployments",
  "work_item_github_links",
  "github_webhook_deliveries",
  "notification_events",
  "notification_recipients",
  "notification_preferences"
] as const;

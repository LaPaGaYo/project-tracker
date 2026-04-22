import { relations, sql } from "drizzle-orm";
import {
  type AnyPgColumn,
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
  invitationStatuses,
  planItemStatuses,
  projectStages as projectLifecycleStages,
  stageStatuses,
  taskGithubCiStatuses,
  taskGithubDeployStatuses,
  taskGithubPrStatuses,
  taskStatuses,
  workflowStateCategories,
  workspaceRoles,
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

export const projectRelations = relations(projects, ({ many }) => ({
  tasks: many(tasks),
  workflowStates: many(workflowStates),
  stages: many(projectStages)
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
  comments: many(comments),
  descriptionVersions: many(descriptionVersions)
}));

export const taskGithubStatusRelations = relations(taskGithubStatus, ({ one }) => ({
  task: one(tasks, {
    fields: [taskGithubStatus.taskId],
    references: [tasks.id]
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
  activityEntries: many(activityLog)
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

export const schema = {
  activityLog,
  comments,
  descriptionVersions,
  invitations,
  planItems,
  projects,
  projectStages,
  tasks,
  taskGithubStatus,
  workflowStates,
  workspaceMembers,
  workspaces
};

export const schemaTableNames = [
  "projects",
  "project_stages",
  "plan_items",
  "tasks",
  "task_github_status",
  "workflow_states",
  "activity_log",
  "comments",
  "description_versions",
  "workspaces",
  "workspace_members",
  "invitations"
] as const;

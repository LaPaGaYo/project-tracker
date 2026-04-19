import { relations } from "drizzle-orm";
import {
  type AnyPgColumn,
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
  projectStages,
  taskStatuses,
  workflowStateCategories,
  workspaceRoles,
  workItemPriorities,
  workItemTypes
} from "@the-platform/shared";

export const projectStageEnum = pgEnum("project_stage", projectStages);
export const taskStatusEnum = pgEnum("task_status", taskStatuses);
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
    assigneeIndex: index("tasks_assignee_idx").on(table.assigneeId),
    parentIndex: index("tasks_parent_idx").on(table.parentId)
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

export const projectRelations = relations(projects, ({ many }) => ({
  tasks: many(tasks),
  workflowStates: many(workflowStates)
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

export const schema = {
  activityLog,
  invitations,
  projects,
  tasks,
  workflowStates,
  workspaceMembers,
  workspaces
};

export const schemaTableNames = [
  "projects",
  "tasks",
  "workflow_states",
  "activity_log",
  "workspaces",
  "workspace_members",
  "invitations"
] as const;

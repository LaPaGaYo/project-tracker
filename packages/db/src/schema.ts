import { relations } from "drizzle-orm";
import { index, integer, pgEnum, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { projectStages, taskStatuses } from "@the-platform/shared";

export const projectStageEnum = pgEnum("project_stage", projectStages);
export const taskStatusEnum = pgEnum("task_status", taskStatuses);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: varchar("title", { length: 160 }).notNull(),
    description: text("description").notNull().default(""),
    stage: projectStageEnum("stage").notNull().default("Planning"),
    dueDate: timestamp("due_date", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    stageIndex: index("projects_stage_idx").on(table.stage),
    createdAtIndex: index("projects_created_at_idx").on(table.createdAt)
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
    position: integer("position").notNull().default(0),
    blockedReason: text("blocked_reason"),
    dueDate: timestamp("due_date", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    projectStatusIndex: index("tasks_project_status_idx").on(table.projectId, table.status),
    positionIndex: index("tasks_project_position_idx").on(table.projectId, table.position)
  })
);

export const projectRelations = relations(projects, ({ many }) => ({
  tasks: many(tasks)
}));

export const taskRelations = relations(tasks, ({ one }) => ({
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id]
  })
}));

export const schema = {
  projects,
  tasks
};

export const schemaTableNames = ["projects", "tasks"] as const;

CREATE TYPE "public"."work_item_priority" AS ENUM('urgent', 'high', 'medium', 'low', 'none');--> statement-breakpoint
CREATE TYPE "public"."work_item_type" AS ENUM('epic', 'task', 'subtask');--> statement-breakpoint
CREATE TYPE "public"."workflow_state_category" AS ENUM('backlog', 'active', 'done');--> statement-breakpoint
CREATE TABLE "activity_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"entity_type" varchar(30) NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" varchar(30) NOT NULL,
	"actor_id" varchar(255) NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(60) NOT NULL,
	"category" "workflow_state_category" NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"color" varchar(7),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "workspace_id" uuid;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "key" varchar(8);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "item_counter" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "type" "work_item_type" DEFAULT 'task' NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "parent_id" uuid;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "assignee_id" varchar(255);--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "identifier" varchar(20);--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "priority" "work_item_priority" DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "labels" text[];--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "workflow_state_id" uuid;--> statement-breakpoint
INSERT INTO "workspaces" ("name", "slug")
SELECT 'Phase 3 Legacy Projects', 'phase3-legacy-projects'
WHERE EXISTS (
	SELECT 1
	FROM "projects"
	WHERE "workspace_id" IS NULL
)
AND NOT EXISTS (
	SELECT 1
	FROM "workspaces"
	WHERE "slug" = 'phase3-legacy-projects'
);--> statement-breakpoint
WITH "legacy_workspace" AS (
	SELECT "id"
	FROM "workspaces"
	WHERE "slug" = 'phase3-legacy-projects'
	LIMIT 1
),
"numbered_projects" AS (
	SELECT
		"projects"."id",
		ROW_NUMBER() OVER (ORDER BY "projects"."created_at", "projects"."id") AS "row_number"
	FROM "projects"
	WHERE "projects"."workspace_id" IS NULL
)
UPDATE "projects"
SET
	"workspace_id" = (SELECT "id" FROM "legacy_workspace"),
	"key" = CONCAT('P', LPAD("numbered_projects"."row_number"::text, 7, '0')),
	"item_counter" = (
		SELECT COUNT(*)::integer
		FROM "tasks"
		WHERE "tasks"."project_id" = "projects"."id"
	)
FROM "numbered_projects"
WHERE "projects"."id" = "numbered_projects"."id";--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "key" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_states" ADD CONSTRAINT "workflow_states_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_log_entity_created_idx" ON "activity_log" USING btree ("entity_type","entity_id","created_at");--> statement-breakpoint
CREATE INDEX "activity_log_workspace_created_idx" ON "activity_log" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "workflow_states_project_position_idx" ON "workflow_states" USING btree ("project_id","position");--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parent_id_tasks_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_workflow_state_id_workflow_states_id_fk" FOREIGN KEY ("workflow_state_id") REFERENCES "public"."workflow_states"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "projects_workspace_key_idx" ON "projects" USING btree ("workspace_id","key");--> statement-breakpoint
CREATE INDEX "projects_workspace_updated_idx" ON "projects" USING btree ("workspace_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tasks_project_identifier_idx" ON "tasks" USING btree ("project_id","identifier");--> statement-breakpoint
CREATE INDEX "tasks_workflow_state_idx" ON "tasks" USING btree ("workflow_state_id");--> statement-breakpoint
CREATE INDEX "tasks_assignee_idx" ON "tasks" USING btree ("assignee_id");--> statement-breakpoint
CREATE INDEX "tasks_parent_idx" ON "tasks" USING btree ("parent_id");

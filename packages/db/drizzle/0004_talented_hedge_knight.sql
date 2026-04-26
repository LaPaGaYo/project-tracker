CREATE TYPE "public"."plan_item_status" AS ENUM('Todo', 'In Review', 'Blocked', 'Done');--> statement-breakpoint
CREATE TYPE "public"."stage_status" AS ENUM('Planned', 'In Progress', 'Blocked', 'Completed');--> statement-breakpoint
CREATE TABLE "plan_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stage_id" uuid NOT NULL,
	"title" varchar(160) NOT NULL,
	"outcome" text DEFAULT '' NOT NULL,
	"status" "plan_item_status" DEFAULT 'Todo' NOT NULL,
	"blocker" text
);
--> statement-breakpoint
CREATE TABLE "project_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"slug" varchar(80) NOT NULL,
	"title" varchar(160) NOT NULL,
	"goal" text DEFAULT '' NOT NULL,
	"status" "stage_status" DEFAULT 'Planned' NOT NULL,
	"gate_status" varchar(64) DEFAULT 'Pending' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_github_status" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"pr_status" varchar(80) DEFAULT 'No PR' NOT NULL,
	"ci_status" varchar(80) DEFAULT 'Unknown' NOT NULL,
	"deploy_status" varchar(80) DEFAULT 'Not deployed' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "stage_id" uuid;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "plan_item_id" uuid;--> statement-breakpoint
ALTER TABLE "plan_items" ADD CONSTRAINT "plan_items_stage_id_project_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."project_stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_stages" ADD CONSTRAINT "project_stages_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_github_status" ADD CONSTRAINT "task_github_status_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "plan_items_stage_idx" ON "plan_items" USING btree ("stage_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "plan_items_stage_id_id_unique" ON "plan_items" USING btree ("stage_id","id");--> statement-breakpoint
CREATE INDEX "project_stages_project_sort_idx" ON "project_stages" USING btree ("project_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "project_stages_project_slug_unique" ON "project_stages" USING btree ("project_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "project_stages_project_id_id_unique" ON "project_stages" USING btree ("project_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "task_github_status_task_id_unique" ON "task_github_status" USING btree ("task_id");--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_stage_id_project_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."project_stages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_plan_item_id_plan_items_id_fk" FOREIGN KEY ("plan_item_id") REFERENCES "public"."plan_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_stage_fk" FOREIGN KEY ("project_id","stage_id") REFERENCES "public"."project_stages"("project_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_stage_plan_item_fk" FOREIGN KEY ("stage_id","plan_item_id") REFERENCES "public"."plan_items"("stage_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tasks_stage_idx" ON "tasks" USING btree ("stage_id");--> statement-breakpoint
CREATE INDEX "tasks_plan_item_idx" ON "tasks" USING btree ("plan_item_id");--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_plan_item_requires_stage_check" CHECK ("plan_item_id" IS NULL OR "stage_id" IS NOT NULL);
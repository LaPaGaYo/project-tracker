CREATE TYPE "public"."notification_event_type" AS ENUM('comment_created', 'mention_created', 'assignment_changed', 'state_changed', 'priority_raised', 'github_pr_changed', 'github_check_changed', 'github_deploy_changed', 'github_webhook_failed');--> statement-breakpoint
CREATE TYPE "public"."notification_priority" AS ENUM('low', 'normal', 'high');--> statement-breakpoint
CREATE TYPE "public"."notification_recipient_reason" AS ENUM('mention', 'assigned', 'participant', 'owner', 'github', 'system');--> statement-breakpoint
CREATE TYPE "public"."notification_source_type" AS ENUM('comment', 'work_item', 'github', 'system');--> statement-breakpoint
CREATE TABLE "notification_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid,
	"work_item_id" uuid,
	"source_type" "notification_source_type" NOT NULL,
	"source_id" varchar(255) NOT NULL,
	"event_type" "notification_event_type" NOT NULL,
	"actor_id" varchar(255),
	"priority" "notification_priority" DEFAULT 'normal' NOT NULL,
	"title" varchar(220) NOT NULL,
	"body" text,
	"url" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"workspace_id" uuid NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"comments_enabled" boolean DEFAULT true NOT NULL,
	"mentions_enabled" boolean DEFAULT true NOT NULL,
	"assignments_enabled" boolean DEFAULT true NOT NULL,
	"github_enabled" boolean DEFAULT true NOT NULL,
	"state_changes_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"recipient_id" varchar(255) NOT NULL,
	"reason" "notification_recipient_reason" NOT NULL,
	"read_at" timestamp with time zone,
	"dismissed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_work_item_id_tasks_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_recipients" ADD CONSTRAINT "notification_recipients_event_id_notification_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."notification_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_recipients" ADD CONSTRAINT "notification_recipients_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notification_events_workspace_created_idx" ON "notification_events" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "notification_events_project_created_idx" ON "notification_events" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "notification_events_work_item_created_idx" ON "notification_events" USING btree ("work_item_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_events_workspace_source_event_unique" ON "notification_events" USING btree ("workspace_id","source_type","source_id","event_type");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_preferences_workspace_user_unique" ON "notification_preferences" USING btree ("workspace_id","user_id");--> statement-breakpoint
CREATE INDEX "notification_recipients_workspace_recipient_read_created_idx" ON "notification_recipients" USING btree ("workspace_id","recipient_id","read_at","created_at");--> statement-breakpoint
CREATE INDEX "notification_recipients_workspace_recipient_created_idx" ON "notification_recipients" USING btree ("workspace_id","recipient_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_recipients_event_recipient_reason_unique" ON "notification_recipients" USING btree ("event_id","recipient_id","reason");
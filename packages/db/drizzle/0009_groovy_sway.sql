ALTER TABLE "project_github_connections" ADD COLUMN "issue_sync_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "project_github_connections" ADD COLUMN "issue_import_closed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "project_github_connections" ADD COLUMN "issue_sync_title" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "project_github_connections" ADD COLUMN "issue_sync_body" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "project_github_connections" ADD COLUMN "issue_sync_state" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "project_github_connections" ADD COLUMN "issue_closed_workflow_state_id" uuid;--> statement-breakpoint
ALTER TABLE "project_github_connections" ADD COLUMN "issue_reopened_workflow_state_id" uuid;--> statement-breakpoint
ALTER TABLE "project_github_connections" ADD CONSTRAINT "project_github_connections_issue_closed_workflow_state_id_workflow_states_id_fk" FOREIGN KEY ("issue_closed_workflow_state_id") REFERENCES "public"."workflow_states"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_github_connections" ADD CONSTRAINT "project_github_connections_issue_reopened_workflow_state_id_workflow_states_id_fk" FOREIGN KEY ("issue_reopened_workflow_state_id") REFERENCES "public"."workflow_states"("id") ON DELETE set null ON UPDATE no action;
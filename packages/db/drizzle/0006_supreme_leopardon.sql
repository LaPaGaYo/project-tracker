CREATE TYPE "public"."github_check_rollup_status" AS ENUM('pending', 'passing', 'failing', 'cancelled', 'skipped', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."github_deployment_environment" AS ENUM('development', 'preview', 'staging', 'production', 'other');--> statement-breakpoint
CREATE TYPE "public"."github_deployment_status" AS ENUM('queued', 'in_progress', 'success', 'failure', 'inactive', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."github_pull_request_state" AS ENUM('open', 'closed', 'merged');--> statement-breakpoint
CREATE TYPE "public"."github_repository_provider" AS ENUM('github');--> statement-breakpoint
CREATE TYPE "public"."github_webhook_delivery_status" AS ENUM('pending', 'processed', 'ignored', 'failed');--> statement-breakpoint
CREATE TYPE "public"."github_webhook_event_name" AS ENUM('pull_request', 'check_run', 'check_suite', 'deployment', 'deployment_status');--> statement-breakpoint
CREATE TYPE "public"."work_item_github_link_source" AS ENUM('pr_title', 'pr_body', 'branch_name', 'manual');--> statement-breakpoint
CREATE TABLE "github_check_rollups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repository_id" uuid NOT NULL,
	"head_sha" varchar(64) NOT NULL,
	"status" "github_check_rollup_status" DEFAULT 'unknown' NOT NULL,
	"url" text,
	"check_count" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "github_deployments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repository_id" uuid NOT NULL,
	"provider_deployment_id" varchar(255) NOT NULL,
	"head_sha" varchar(64) NOT NULL,
	"environment_name" varchar(255),
	"environment" "github_deployment_environment" DEFAULT 'other' NOT NULL,
	"status" "github_deployment_status" DEFAULT 'unknown' NOT NULL,
	"url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "github_pull_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repository_id" uuid NOT NULL,
	"provider_pull_request_id" varchar(255) NOT NULL,
	"number" integer NOT NULL,
	"title" varchar(300) NOT NULL,
	"body" text,
	"url" text NOT NULL,
	"state" "github_pull_request_state" DEFAULT 'open' NOT NULL,
	"is_draft" boolean DEFAULT false NOT NULL,
	"author_login" varchar(255),
	"base_branch" varchar(255) NOT NULL,
	"head_branch" varchar(255) NOT NULL,
	"head_sha" varchar(64) NOT NULL,
	"merged_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "github_repositories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"provider" "github_repository_provider" DEFAULT 'github' NOT NULL,
	"provider_repository_id" varchar(255) NOT NULL,
	"owner" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"default_branch" varchar(255) NOT NULL,
	"installation_id" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "github_webhook_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repository_id" uuid,
	"delivery_id" varchar(255) NOT NULL,
	"event_name" "github_webhook_event_name" NOT NULL,
	"status" "github_webhook_delivery_status" DEFAULT 'pending' NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "project_github_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"repository_id" uuid NOT NULL,
	"staging_environment_name" varchar(255),
	"production_environment_name" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_item_github_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"work_item_id" uuid NOT NULL,
	"repository_id" uuid NOT NULL,
	"pull_request_id" uuid,
	"branch_name" varchar(255),
	"source" "work_item_github_link_source" DEFAULT 'manual' NOT NULL,
	"confidence" integer DEFAULT 100 NOT NULL,
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "github_check_rollups" ADD CONSTRAINT "github_check_rollups_repository_id_github_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."github_repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_deployments" ADD CONSTRAINT "github_deployments_repository_id_github_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."github_repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_pull_requests" ADD CONSTRAINT "github_pull_requests_repository_id_github_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."github_repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_repositories" ADD CONSTRAINT "github_repositories_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_webhook_deliveries" ADD CONSTRAINT "github_webhook_deliveries_repository_id_github_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."github_repositories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_github_connections" ADD CONSTRAINT "project_github_connections_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_github_connections" ADD CONSTRAINT "project_github_connections_repository_id_github_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."github_repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_item_github_links" ADD CONSTRAINT "work_item_github_links_work_item_id_tasks_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_item_github_links" ADD CONSTRAINT "work_item_github_links_repository_id_github_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."github_repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_item_github_links" ADD CONSTRAINT "work_item_github_links_pull_request_id_github_pull_requests_id_fk" FOREIGN KEY ("pull_request_id") REFERENCES "public"."github_pull_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "github_check_rollups_status_idx" ON "github_check_rollups" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "github_check_rollups_repository_head_sha_unique" ON "github_check_rollups" USING btree ("repository_id","head_sha");--> statement-breakpoint
CREATE INDEX "github_deployments_head_sha_environment_idx" ON "github_deployments" USING btree ("repository_id","head_sha","environment");--> statement-breakpoint
CREATE UNIQUE INDEX "github_deployments_repository_provider_deployment_unique" ON "github_deployments" USING btree ("repository_id","provider_deployment_id");--> statement-breakpoint
CREATE INDEX "github_pull_requests_head_sha_idx" ON "github_pull_requests" USING btree ("repository_id","head_sha");--> statement-breakpoint
CREATE UNIQUE INDEX "github_pull_requests_repository_number_unique" ON "github_pull_requests" USING btree ("repository_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "github_pull_requests_repository_provider_pr_unique" ON "github_pull_requests" USING btree ("repository_id","provider_pull_request_id");--> statement-breakpoint
CREATE INDEX "github_repositories_workspace_idx" ON "github_repositories" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "github_repositories_full_name_idx" ON "github_repositories" USING btree ("full_name");--> statement-breakpoint
CREATE UNIQUE INDEX "github_repositories_provider_repo_unique" ON "github_repositories" USING btree ("provider","provider_repository_id");--> statement-breakpoint
CREATE INDEX "github_webhook_deliveries_repository_status_idx" ON "github_webhook_deliveries" USING btree ("repository_id","status","received_at");--> statement-breakpoint
CREATE UNIQUE INDEX "github_webhook_deliveries_delivery_id_unique" ON "github_webhook_deliveries" USING btree ("delivery_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_github_connections_project_unique" ON "project_github_connections" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_github_connections_repository_unique" ON "project_github_connections" USING btree ("repository_id");--> statement-breakpoint
CREATE INDEX "work_item_github_links_work_item_idx" ON "work_item_github_links" USING btree ("work_item_id");--> statement-breakpoint
CREATE INDEX "work_item_github_links_pull_request_idx" ON "work_item_github_links" USING btree ("pull_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "work_item_github_links_work_item_pull_request_unique" ON "work_item_github_links" USING btree ("work_item_id","pull_request_id");
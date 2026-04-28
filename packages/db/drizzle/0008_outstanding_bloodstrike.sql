CREATE TYPE "public"."github_issue_state" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TYPE "public"."github_issue_sync_operation_status" AS ENUM('pending', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."github_issue_sync_operation_type" AS ENUM('update_issue');--> statement-breakpoint
CREATE TYPE "public"."github_issue_sync_status" AS ENUM('synced', 'pending_outbound', 'conflict', 'error', 'paused');--> statement-breakpoint
ALTER TYPE "public"."github_webhook_event_name" ADD VALUE 'issues';--> statement-breakpoint
ALTER TYPE "public"."github_webhook_event_name" ADD VALUE 'issue_comment';--> statement-breakpoint
CREATE TABLE "github_issue_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"github_issue_id" uuid NOT NULL,
	"provider_comment_id" varchar(255) NOT NULL,
	"body" text NOT NULL,
	"url" text NOT NULL,
	"author_login" varchar(255),
	"github_created_at" timestamp with time zone NOT NULL,
	"github_updated_at" timestamp with time zone NOT NULL,
	"github_deleted_at" timestamp with time zone,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "github_issue_sync_operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"link_id" uuid NOT NULL,
	"operation_key" varchar(255) NOT NULL,
	"operation_type" "github_issue_sync_operation_type" DEFAULT 'update_issue' NOT NULL,
	"status" "github_issue_sync_operation_status" DEFAULT 'pending' NOT NULL,
	"requested_by" varchar(255) NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"github_updated_at_before" timestamp with time zone,
	"target_fields" jsonb NOT NULL,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "github_issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repository_id" uuid NOT NULL,
	"provider_issue_id" varchar(255) NOT NULL,
	"number" integer NOT NULL,
	"title" varchar(300) NOT NULL,
	"body" text,
	"url" text NOT NULL,
	"state" "github_issue_state" DEFAULT 'open' NOT NULL,
	"author_login" varchar(255),
	"github_created_at" timestamp with time zone NOT NULL,
	"github_updated_at" timestamp with time zone NOT NULL,
	"github_closed_at" timestamp with time zone,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_item_github_issue_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"work_item_id" uuid NOT NULL,
	"repository_id" uuid NOT NULL,
	"github_issue_id" uuid NOT NULL,
	"source" varchar(40) DEFAULT 'initial_import' NOT NULL,
	"sync_status" "github_issue_sync_status" DEFAULT 'synced' NOT NULL,
	"sync_enabled" boolean DEFAULT true NOT NULL,
	"sync_title" boolean DEFAULT true NOT NULL,
	"sync_body" boolean DEFAULT true NOT NULL,
	"sync_state" boolean DEFAULT true NOT NULL,
	"last_synced_github_updated_at" timestamp with time zone,
	"last_synced_work_item_updated_at" timestamp with time zone,
	"last_synced_title_hash" varchar(64),
	"last_synced_body_hash" varchar(64),
	"last_synced_state" "github_issue_state",
	"conflict_fields" text[],
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "github_issue_comments" ADD CONSTRAINT "github_issue_comments_github_issue_id_github_issues_id_fk" FOREIGN KEY ("github_issue_id") REFERENCES "public"."github_issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_issue_sync_operations" ADD CONSTRAINT "github_issue_sync_operations_link_id_work_item_github_issue_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."work_item_github_issue_links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_issues" ADD CONSTRAINT "github_issues_repository_id_github_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."github_repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_item_github_issue_links" ADD CONSTRAINT "work_item_github_issue_links_work_item_id_tasks_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_item_github_issue_links" ADD CONSTRAINT "work_item_github_issue_links_repository_id_github_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."github_repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_item_github_issue_links" ADD CONSTRAINT "work_item_github_issue_links_github_issue_id_github_issues_id_fk" FOREIGN KEY ("github_issue_id") REFERENCES "public"."github_issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "github_issue_comments_issue_created_idx" ON "github_issue_comments" USING btree ("github_issue_id","github_created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "github_issue_comments_issue_provider_comment_unique" ON "github_issue_comments" USING btree ("github_issue_id","provider_comment_id");--> statement-breakpoint
CREATE INDEX "github_issue_sync_operations_link_status_requested_idx" ON "github_issue_sync_operations" USING btree ("link_id","status","requested_at");--> statement-breakpoint
CREATE UNIQUE INDEX "github_issue_sync_operations_operation_key_unique" ON "github_issue_sync_operations" USING btree ("operation_key");--> statement-breakpoint
CREATE INDEX "github_issues_repository_state_updated_idx" ON "github_issues" USING btree ("repository_id","state","github_updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "github_issues_repository_number_unique" ON "github_issues" USING btree ("repository_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "github_issues_repository_provider_issue_unique" ON "github_issues" USING btree ("repository_id","provider_issue_id");--> statement-breakpoint
CREATE INDEX "work_item_github_issue_links_repository_status_idx" ON "work_item_github_issue_links" USING btree ("repository_id","sync_status");--> statement-breakpoint
CREATE UNIQUE INDEX "work_item_github_issue_links_work_item_unique" ON "work_item_github_issue_links" USING btree ("work_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "work_item_github_issue_links_github_issue_unique" ON "work_item_github_issue_links" USING btree ("github_issue_id");
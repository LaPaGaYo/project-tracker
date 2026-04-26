CREATE TYPE "public"."task_github_ci_status" AS ENUM('Unknown', 'Passing', 'Failing');--> statement-breakpoint
CREATE TYPE "public"."task_github_deploy_status" AS ENUM('Not deployed', 'Staging', 'Production');--> statement-breakpoint
CREATE TYPE "public"."task_github_pr_status" AS ENUM('No PR', 'Open PR', 'Review requested', 'Merged');--> statement-breakpoint
DROP INDEX "plan_items_stage_idx";--> statement-breakpoint
ALTER TABLE "task_github_status" ALTER COLUMN "pr_status" SET DEFAULT 'No PR'::"public"."task_github_pr_status";--> statement-breakpoint
ALTER TABLE "task_github_status" ALTER COLUMN "pr_status" SET DATA TYPE "public"."task_github_pr_status" USING "pr_status"::"public"."task_github_pr_status";--> statement-breakpoint
ALTER TABLE "task_github_status" ALTER COLUMN "ci_status" SET DEFAULT 'Unknown'::"public"."task_github_ci_status";--> statement-breakpoint
ALTER TABLE "task_github_status" ALTER COLUMN "ci_status" SET DATA TYPE "public"."task_github_ci_status" USING "ci_status"::"public"."task_github_ci_status";--> statement-breakpoint
ALTER TABLE "task_github_status" ALTER COLUMN "deploy_status" SET DEFAULT 'Not deployed'::"public"."task_github_deploy_status";--> statement-breakpoint
ALTER TABLE "task_github_status" ALTER COLUMN "deploy_status" SET DATA TYPE "public"."task_github_deploy_status" USING "deploy_status"::"public"."task_github_deploy_status";--> statement-breakpoint
ALTER TABLE "plan_items" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "plan_items_stage_idx" ON "plan_items" USING btree ("stage_id","sort_order");
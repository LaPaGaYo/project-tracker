CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"work_item_id" uuid NOT NULL,
	"author_id" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "description_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"work_item_id" uuid NOT NULL,
	"content" text NOT NULL,
	"author_id" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_work_item_id_tasks_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "description_versions" ADD CONSTRAINT "description_versions_work_item_id_tasks_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comments_work_item_created_idx" ON "comments" USING btree ("work_item_id","created_at");--> statement-breakpoint
CREATE INDEX "comments_author_idx" ON "comments" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "comments_deleted_idx" ON "comments" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "description_versions_work_item_created_idx" ON "description_versions" USING btree ("work_item_id","created_at");--> statement-breakpoint
CREATE INDEX "description_versions_author_idx" ON "description_versions" USING btree ("author_id");
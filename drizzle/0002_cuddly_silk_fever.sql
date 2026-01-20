DROP INDEX "idx_issues_status";--> statement-breakpoint
CREATE INDEX "idx_issues_dashboard_lookup" ON "issues" USING btree ("status","severity","machine_initials");
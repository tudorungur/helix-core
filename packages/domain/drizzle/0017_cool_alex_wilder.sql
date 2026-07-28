ALTER TABLE "legal_entities" ADD COLUMN "first_name" varchar(100);--> statement-breakpoint
ALTER TABLE "legal_entities" ADD COLUMN "last_name" varchar(100);--> statement-breakpoint
-- Backfill the one existing PF row (dev test data) with its known-correct split — reported by the
-- user directly (Prenume "Tudor Vlad", Nume "Ungur") rather than re-deriving it with the same lossy
-- first-space heuristic that caused this bug in the first place.
UPDATE "legal_entities" SET "first_name" = 'Tudor Vlad', "last_name" = 'Ungur'
WHERE "id" = '1df95966-0c89-4439-a5c7-9514208ac87c';
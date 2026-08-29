-- Add error flag to messages so fallback/canned assistant replies are distinguishable from real answers
ALTER TABLE "messages" ADD COLUMN "error" BOOLEAN NOT NULL DEFAULT false;
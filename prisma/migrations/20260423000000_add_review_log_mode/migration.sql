-- AddColumn
ALTER TABLE "ReviewLog" ADD COLUMN IF NOT EXISTS "mode" TEXT NOT NULL DEFAULT 'recognize';

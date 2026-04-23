-- AlterTable
ALTER TABLE "Word" ADD COLUMN "contextClipIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Add resume metadata and uniqueness constraints without removing existing records.
ALTER TABLE "Resume"
ADD COLUMN "displayName" TEXT NOT NULL DEFAULT '',
ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "defaultSlot" TEXT;

UPDATE "Resume"
SET "displayName" = "fileName"
WHERE "displayName" = '';

ALTER TABLE "Resume"
ADD CONSTRAINT "Resume_defaultSlot_consistency_check"
CHECK (
    ("isDefault" = true AND "defaultSlot" = 'default')
    OR ("isDefault" = false AND "defaultSlot" IS NULL)
);

CREATE UNIQUE INDEX "Resume_userId_defaultSlot_key"
ON "Resume"("userId", "defaultSlot");

CREATE TABLE "ResumeRateLimit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResumeRateLimit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ResumeRateLimit_userId_bucket_windowStart_key"
ON "ResumeRateLimit"("userId", "bucket", "windowStart");

CREATE INDEX "ResumeRateLimit_windowStart_idx"
ON "ResumeRateLimit"("windowStart");

ALTER TABLE "ResumeRateLimit"
ADD CONSTRAINT "ResumeRateLimit_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

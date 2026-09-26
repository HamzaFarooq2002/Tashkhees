-- CreateEnum
CREATE TYPE "BandResolutionState" AS ENUM ('RESOLVED', 'UNRESOLVED');

-- AlterTable
ALTER TABLE "Band" ADD COLUMN     "note" TEXT,
ADD COLUMN     "resolutionState" "BandResolutionState" NOT NULL DEFAULT 'RESOLVED',
ADD COLUMN     "sourceLabel" TEXT,
ALTER COLUMN "multiplier" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ResultSnapshot" ADD COLUMN     "configHash" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "engineVersion" TEXT NOT NULL DEFAULT 'v0-unknown',
ADD COLUMN     "inputRevision" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "issues" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "RubricVersion" ADD COLUMN     "configHash" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "engineVersion" TEXT NOT NULL DEFAULT 'v0-unknown',
ADD COLUMN     "unresolvedRules" JSONB NOT NULL DEFAULT '[]';

-- CreateIndex
CREATE UNIQUE INDEX "RubricVersion_configHash_key" ON "RubricVersion"("configHash");

-- CheckConstraint: a band's multiplier and resolution state must agree —
-- RESOLVED bands must define a multiplier, UNRESOLVED bands must not (see
-- SCORING_DECISIONS.md and src/lib/rubric/rows.ts's checkBandCoverage for the
-- matching application-level validation that runs before every seed).
ALTER TABLE "Band" ADD CONSTRAINT "band_multiplier_resolution_check"
  CHECK (
    ("resolutionState" = 'RESOLVED'   AND "multiplier" IS NOT NULL) OR
    ("resolutionState" = 'UNRESOLVED' AND "multiplier" IS NULL)
  );

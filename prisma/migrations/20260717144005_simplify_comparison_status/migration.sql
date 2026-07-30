-- AlterEnum
BEGIN;
CREATE TYPE "ComparisonStatus_new" AS ENUM ('exact', 'needs_review');
ALTER TABLE "public"."ProductVariant" ALTER COLUMN "comparisonStatus" DROP DEFAULT;
ALTER TABLE "ProductVariant" ALTER COLUMN "comparisonStatus" TYPE "ComparisonStatus_new" USING ("comparisonStatus"::text::"ComparisonStatus_new");
ALTER TYPE "ComparisonStatus" RENAME TO "ComparisonStatus_old";
ALTER TYPE "ComparisonStatus_new" RENAME TO "ComparisonStatus";
DROP TYPE "public"."ComparisonStatus_old";
ALTER TABLE "ProductVariant" ALTER COLUMN "comparisonStatus" SET DEFAULT 'needs_review';
COMMIT;

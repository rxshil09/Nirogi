-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PrescriptionStatus" AS ENUM ('unknown', 'otc', 'prescription', 'restricted');

-- CreateEnum
CREATE TYPE "ComparisonStatus" AS ENUM ('exact', 'needs_review');

-- CreateEnum
CREATE TYPE "IntegrationMode" AS ENUM ('approved_api', 'approved_feed', 'manual_fixture', 'browser_collection');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('exact', 'candidate', 'needs_review', 'rejected');

-- CreateEnum
CREATE TYPE "Availability" AS ENUM ('in_stock', 'out_of_stock', 'not_for_sale', 'unknown');

-- CreateEnum
CREATE TYPE "SearchJobStatus" AS ENUM ('queued', 'running', 'partial', 'completed', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "ScrapeAttemptStatus" AS ENUM ('queued', 'running', 'succeeded', 'no_match', 'rate_limited', 'timed_out', 'failed');

-- CreateTable
CREATE TABLE "MedicineProduct" (
    "id" UUID NOT NULL,
    "displayName" TEXT NOT NULL,
    "brandName" TEXT,
    "genericName" TEXT,
    "composition" JSONB,
    "prescriptionStatus" "PrescriptionStatus" NOT NULL DEFAULT 'unknown',
    "searchAliases" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicineProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVariant" (
    "id" UUID NOT NULL,
    "medicineProductId" UUID NOT NULL,
    "strengthValue" TEXT,
    "strengthUnit" TEXT,
    "dosageForm" TEXT,
    "packQuantity" INTEGER,
    "packUnit" TEXT,
    "manufacturerName" TEXT,
    "normalisedKey" TEXT NOT NULL,
    "comparisonStatus" "ComparisonStatus" NOT NULL DEFAULT 'needs_review',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Retailer" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "integrationMode" "IntegrationMode" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "termsReviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Retailer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetailerListing" (
    "id" UUID NOT NULL,
    "retailerId" UUID NOT NULL,
    "retailerProductId" TEXT,
    "canonicalUrl" TEXT NOT NULL,
    "sourceTitle" TEXT NOT NULL,
    "productVariantId" UUID,
    "matchConfidence" DECIMAL(5,2),
    "matchStatus" "MatchStatus" NOT NULL DEFAULT 'candidate',
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetailerListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchJob" (
    "id" UUID NOT NULL,
    "query" TEXT NOT NULL,
    "pincode" TEXT,
    "cacheKey" TEXT NOT NULL,
    "productVariantId" UUID,
    "status" "SearchJobStatus" NOT NULL DEFAULT 'queued',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "SearchJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrapeAttempt" (
    "id" UUID NOT NULL,
    "searchJobId" UUID NOT NULL,
    "retailerId" UUID NOT NULL,
    "status" "ScrapeAttemptStatus" NOT NULL DEFAULT 'queued',
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "rawPayloadHash" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScrapeAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceObservation" (
    "id" UUID NOT NULL,
    "retailerListingId" UUID NOT NULL,
    "scrapeAttemptId" UUID NOT NULL,
    "locationKey" TEXT,
    "pricePaise" INTEGER,
    "mrpPaise" INTEGER,
    "currency" CHAR(3) NOT NULL DEFAULT 'INR',
    "availability" "Availability" NOT NULL DEFAULT 'unknown',
    "deliveryFeePaise" INTEGER,
    "tierUsed" TEXT,
    "sourceObservedAt" TIMESTAMP(3),
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rawPayloadHash" TEXT,

    CONSTRAINT "PriceObservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MedicineProduct_displayName_idx" ON "MedicineProduct"("displayName");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_normalisedKey_key" ON "ProductVariant"("normalisedKey");

-- CreateIndex
CREATE INDEX "ProductVariant_medicineProductId_idx" ON "ProductVariant"("medicineProductId");

-- CreateIndex
CREATE UNIQUE INDEX "Retailer_slug_key" ON "Retailer"("slug");

-- CreateIndex
CREATE INDEX "RetailerListing_productVariantId_idx" ON "RetailerListing"("productVariantId");

-- CreateIndex
CREATE UNIQUE INDEX "RetailerListing_retailerId_canonicalUrl_key" ON "RetailerListing"("retailerId", "canonicalUrl");

-- CreateIndex
CREATE UNIQUE INDEX "RetailerListing_retailerId_retailerProductId_key" ON "RetailerListing"("retailerId", "retailerProductId");

-- CreateIndex
CREATE INDEX "SearchJob_cacheKey_createdAt_idx" ON "SearchJob"("cacheKey", "createdAt");

-- CreateIndex
CREATE INDEX "SearchJob_status_createdAt_idx" ON "SearchJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ScrapeAttempt_searchJobId_idx" ON "ScrapeAttempt"("searchJobId");

-- CreateIndex
CREATE INDEX "ScrapeAttempt_retailerId_createdAt_idx" ON "ScrapeAttempt"("retailerId", "createdAt");

-- CreateIndex
CREATE INDEX "PriceObservation_retailerListingId_locationKey_collectedAt_idx" ON "PriceObservation"("retailerListingId", "locationKey", "collectedAt");

-- CreateIndex
CREATE INDEX "PriceObservation_collectedAt_idx" ON "PriceObservation"("collectedAt");

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_medicineProductId_fkey" FOREIGN KEY ("medicineProductId") REFERENCES "MedicineProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetailerListing" ADD CONSTRAINT "RetailerListing_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Retailer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetailerListing" ADD CONSTRAINT "RetailerListing_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchJob" ADD CONSTRAINT "SearchJob_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrapeAttempt" ADD CONSTRAINT "ScrapeAttempt_searchJobId_fkey" FOREIGN KEY ("searchJobId") REFERENCES "SearchJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrapeAttempt" ADD CONSTRAINT "ScrapeAttempt_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Retailer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceObservation" ADD CONSTRAINT "PriceObservation_retailerListingId_fkey" FOREIGN KEY ("retailerListingId") REFERENCES "RetailerListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceObservation" ADD CONSTRAINT "PriceObservation_scrapeAttemptId_fkey" FOREIGN KEY ("scrapeAttemptId") REFERENCES "ScrapeAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

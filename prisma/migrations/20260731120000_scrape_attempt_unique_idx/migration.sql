-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ScrapeAttempt_searchJobId_retailerId_key" ON "ScrapeAttempt"("searchJobId", "retailerId");

-- CreateEnum
CREATE TYPE "BalanceSource" AS ENUM ('INITIAL', 'CALCULATED', 'MANUAL_ADJUST');

-- CreateTable
CREATE TABLE "AccountBalance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "referenceDate" DATE NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "source" "BalanceSource" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountBalance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccountBalance_userId_referenceDate_idx" ON "AccountBalance"("userId", "referenceDate");

-- CreateIndex
CREATE UNIQUE INDEX "AccountBalance_userId_referenceDate_key" ON "AccountBalance"("userId", "referenceDate");

-- AddForeignKey
ALTER TABLE "AccountBalance" ADD CONSTRAINT "AccountBalance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

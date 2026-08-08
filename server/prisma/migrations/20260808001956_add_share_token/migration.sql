/*
  Warnings:

  - A unique constraint covering the columns `[shareToken]` on the table `Flight` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Flight" ADD COLUMN     "shareToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Flight_shareToken_key" ON "Flight"("shareToken");

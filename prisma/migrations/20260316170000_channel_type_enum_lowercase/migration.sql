-- CreateEnum
CREATE TYPE "ChannelType" AS ENUM ('web', 'facebook', 'telegram', 'whatsapp');

-- Normalize known channel type casing before enum cast
UPDATE "channels"
SET "type" = LOWER("type")
WHERE LOWER("type") IN ('web', 'facebook', 'telegram', 'whatsapp');

-- AlterTable
ALTER TABLE "channels"
ALTER COLUMN "type" TYPE "ChannelType"
USING ("type"::"ChannelType");

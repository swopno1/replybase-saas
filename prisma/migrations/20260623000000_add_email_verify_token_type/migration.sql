-- Add EMAIL_VERIFY value to UserTokenType enum (idempotent)
ALTER TYPE "UserTokenType" ADD VALUE IF NOT EXISTS 'EMAIL_VERIFY';

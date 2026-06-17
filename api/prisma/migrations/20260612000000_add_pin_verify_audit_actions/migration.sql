-- Phase E follow-up: PIN verify (brute-force lockout) audit actions.
-- Adds two new values to the AuditAction enum so verify-pin can record
-- successful verification and lockout events.

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'USER_PIN_VERIFIED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'USER_PIN_LOCKED';

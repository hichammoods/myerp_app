-- Migration: Add discount_rate field to contacts table
-- Version: 007
-- Description: Add discount rate field for contacts

ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS discount_rate DECIMAL(5,2) DEFAULT 0;

-- Add comment
COMMENT ON COLUMN contacts.discount_rate IS 'Discount rate percentage for this contact';

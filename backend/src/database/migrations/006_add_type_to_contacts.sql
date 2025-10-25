-- Migration: Add type field to contacts table
-- Version: 006
-- Description: Add contact type (client/supplier/partner/other) to complement customer_type

ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'client' CHECK (type IN ('client', 'supplier', 'partner', 'other'));

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_contacts_type ON contacts(type);

-- Add comment
COMMENT ON COLUMN contacts.type IS 'Business relationship type: client, supplier, partner, or other';
COMMENT ON COLUMN contacts.customer_type IS 'Legal entity type: individual or company';

-- Migration: Add missing fields to quotations table
-- Version: 005
-- Description: Add delivery_address, internal_notes, installation_cost fields

-- Add missing columns to quotations table
ALTER TABLE quotations
ADD COLUMN IF NOT EXISTS delivery_address TEXT,
ADD COLUMN IF NOT EXISTS internal_notes TEXT,
ADD COLUMN IF NOT EXISTS installation_cost DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS installation_included BOOLEAN DEFAULT false;

-- Add comment to document these fields
COMMENT ON COLUMN quotations.delivery_address IS 'Delivery address for this specific quotation (can differ from contact address)';
COMMENT ON COLUMN quotations.internal_notes IS 'Internal notes not visible to customer';
COMMENT ON COLUMN quotations.installation_cost IS 'Cost of installation service';
COMMENT ON COLUMN quotations.installation_included IS 'Whether installation is included in the quotation';

-- Migration: Add include_tax field to quotations table
-- Version: 009
-- Description: Add include_tax boolean to control whether tax is included in total

-- Add include_tax column to quotations table
ALTER TABLE quotations
ADD COLUMN IF NOT EXISTS include_tax BOOLEAN DEFAULT true;

-- Add comment to document this field
COMMENT ON COLUMN quotations.include_tax IS 'Whether tax should be included in the total amount (false for individuals, true for companies)';

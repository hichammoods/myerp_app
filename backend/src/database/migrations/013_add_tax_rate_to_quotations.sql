-- Migration: Add tax_rate column to quotations table
-- Version: 013
-- Description: Store the global tax rate for the quotation (used for calculating total tax)

-- Add tax_rate column to quotations table
ALTER TABLE quotations
ADD COLUMN IF NOT EXISTS tax_rate DECIMAL(5,2) DEFAULT 20.00;

-- Comment to document this field
COMMENT ON COLUMN quotations.tax_rate IS 'Global tax rate for the quotation (percentage). Applied to final amount (after discounts + shipping + installation) when include_tax is true.';

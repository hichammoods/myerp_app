-- Migration: Add default_cgv to company_settings
-- Version: 012
-- Description: Add default conditions générales de vente field to company settings

ALTER TABLE company_settings
ADD COLUMN IF NOT EXISTS default_cgv TEXT;

-- Add comment
COMMENT ON COLUMN company_settings.default_cgv IS 'Default Conditions Générales de Vente (Terms and Conditions) used in quotations';

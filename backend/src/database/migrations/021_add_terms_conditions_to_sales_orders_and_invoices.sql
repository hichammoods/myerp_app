-- Migration: Add terms_conditions to sales_orders and invoices
-- Description: Add CGV field to sales orders and invoices tables
-- Author: Claude Code
-- Date: 2025-10-31

-- Add terms_conditions to sales_orders table
ALTER TABLE sales_orders
ADD COLUMN IF NOT EXISTS terms_conditions TEXT;

-- Add comment
COMMENT ON COLUMN sales_orders.terms_conditions IS 'Conditions générales de vente (Terms and Conditions) for this sales order';

-- Add terms_conditions to invoices table
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS terms_conditions TEXT;

-- Add comment
COMMENT ON COLUMN invoices.terms_conditions IS 'Conditions générales de vente (Terms and Conditions) for this invoice';

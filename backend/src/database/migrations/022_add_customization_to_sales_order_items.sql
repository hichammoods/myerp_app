-- Migration: Add customization fields to sales_order_items and invoice_items
-- Description: Add is_customized, base_product_id, and custom_components to track product customizations in sales orders and invoices
-- Author: Claude Code
-- Date: 2025-11-01

-- Add customization fields to sales_order_items
ALTER TABLE sales_order_items
  ADD COLUMN IF NOT EXISTS is_customized BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS base_product_id UUID REFERENCES products(id),
  ADD COLUMN IF NOT EXISTS custom_components JSONB;

-- Add customization fields to invoice_items
ALTER TABLE invoice_items
  ADD COLUMN IF NOT EXISTS is_customized BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS base_product_id UUID REFERENCES products(id),
  ADD COLUMN IF NOT EXISTS custom_components JSONB;

-- Create indexes on custom_components for better query performance
CREATE INDEX IF NOT EXISTS idx_sales_order_items_custom_components ON sales_order_items USING gin(custom_components);
CREATE INDEX IF NOT EXISTS idx_invoice_items_custom_components ON invoice_items USING gin(custom_components);

-- Add comments
COMMENT ON COLUMN sales_order_items.is_customized IS 'Indicates if this item is a customized product';
COMMENT ON COLUMN sales_order_items.base_product_id IS 'Reference to the base product if this is a customization';
COMMENT ON COLUMN sales_order_items.custom_components IS 'JSON array of custom components with materials and finishes';

COMMENT ON COLUMN invoice_items.is_customized IS 'Indicates if this item is a customized product';
COMMENT ON COLUMN invoice_items.base_product_id IS 'Reference to the base product if this is a customization';
COMMENT ON COLUMN invoice_items.custom_components IS 'JSON array of custom components with materials and finishes';

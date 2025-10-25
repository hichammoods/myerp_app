-- Migration: Update quotations table for sales order integration
-- Description: Add sales_order_id reference and conversion timestamp to quotations
-- Author: Claude Code
-- Date: 2025-10-25

-- Add sales_order_id column to track which order was created from this quotation
ALTER TABLE quotations
ADD COLUMN IF NOT EXISTS sales_order_id UUID REFERENCES sales_orders(id);

-- Add timestamp to track when quotation was converted to order
ALTER TABLE quotations
ADD COLUMN IF NOT EXISTS converted_to_order_at TIMESTAMP;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_quotations_sales_order_id ON quotations(sales_order_id);

-- Add comment for documentation
COMMENT ON COLUMN quotations.sales_order_id IS 'Reference to the sales order created from this quotation';
COMMENT ON COLUMN quotations.converted_to_order_at IS 'Timestamp when quotation was converted to a sales order';

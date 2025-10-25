-- Migration: Fix quantity column types to DECIMAL
-- Description: Change quantity from INTEGER to DECIMAL in sales_order_items and invoice_items
-- Author: Claude Code
-- Date: 2025-10-25

-- Update sales_order_items quantity to DECIMAL
ALTER TABLE sales_order_items
ALTER COLUMN quantity TYPE DECIMAL(10,2);

-- Update the CHECK constraint
ALTER TABLE sales_order_items
DROP CONSTRAINT IF EXISTS sales_order_items_quantity_check;

ALTER TABLE sales_order_items
ADD CONSTRAINT sales_order_items_quantity_check CHECK (quantity > 0);

-- Update invoice_items quantity to DECIMAL
ALTER TABLE invoice_items
ALTER COLUMN quantity TYPE DECIMAL(10,2);

-- Update the CHECK constraint
ALTER TABLE invoice_items
DROP CONSTRAINT IF EXISTS invoice_items_quantity_check;

ALTER TABLE invoice_items
ADD CONSTRAINT invoice_items_quantity_check CHECK (quantity > 0);

-- Migration: Fix products stock_quantity to DECIMAL
-- Description: Change stock_quantity from INTEGER to DECIMAL in products table
-- Author: Claude Code
-- Date: 2025-10-25

-- Drop the view that depends on stock_quantity
DROP VIEW IF EXISTS v_product_availability;

-- Update products stock_quantity to DECIMAL
ALTER TABLE products
ALTER COLUMN stock_quantity TYPE DECIMAL(10,2);

-- Also update reserved_quantity to DECIMAL for consistency
ALTER TABLE products
ALTER COLUMN reserved_quantity TYPE DECIMAL(10,2);

-- Update min_stock_level to DECIMAL for consistency
ALTER TABLE products
ALTER COLUMN min_stock_level TYPE DECIMAL(10,2);

-- Update max_stock_level to DECIMAL for consistency
ALTER TABLE products
ALTER COLUMN max_stock_level TYPE DECIMAL(10,2);

-- Recreate the view with DECIMAL types
CREATE OR REPLACE VIEW v_product_availability AS
SELECT
  p.id,
  p.sku,
  p.name,
  p.stock_quantity,
  p.reserved_quantity,
  (p.stock_quantity - p.reserved_quantity) AS available_quantity,
  p.min_stock_level,
  CASE
    WHEN (p.stock_quantity - p.reserved_quantity) <= 0 THEN 'out_of_stock'
    WHEN (p.stock_quantity - p.reserved_quantity) <= p.min_stock_level THEN 'low_stock'
    ELSE 'in_stock'
  END AS stock_status
FROM products p
WHERE p.is_active = true
  AND p.track_inventory = true
  AND p.deleted_at IS NULL;

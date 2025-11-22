-- Migration: Add payments JSONB array to sales_orders table
-- Description: Enable multiple payments (acomptes) per sales order
-- Author: Claude Code
-- Date: 2025-11-22

-- Step 1: Add new payments JSONB column
ALTER TABLE sales_orders
ADD COLUMN IF NOT EXISTS payments JSONB DEFAULT '[]'::jsonb;

-- Step 2: Migrate existing down_payment data to payments array
-- Only for orders that have a down_payment_amount > 0 and don't already have payments
UPDATE sales_orders
SET payments = jsonb_build_array(
  jsonb_build_object(
    'id', gen_random_uuid()::text,
    'amount', down_payment_amount,
    'method', COALESCE(down_payment_method, 'especes'),
    'date', COALESCE(down_payment_date::text, order_date::text),
    'notes', COALESCE(down_payment_notes, '')
  )
)
WHERE down_payment_amount > 0
  AND (payments IS NULL OR payments = '[]'::jsonb);

-- Step 3: Set empty array for orders without down payments
UPDATE sales_orders
SET payments = '[]'::jsonb
WHERE payments IS NULL;

-- Step 4: Create index for JSONB queries (for performance)
CREATE INDEX IF NOT EXISTS idx_sales_orders_payments
ON sales_orders USING GIN (payments);

-- Step 5: Add comment for documentation
COMMENT ON COLUMN sales_orders.payments IS 'Array of payment objects: [{id, amount, method, date, notes}, ...]';

-- NOTE: We keep the old down_payment_* columns for backward compatibility
-- They can be removed in a future migration after confirming everything works

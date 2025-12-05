-- Migration: Fix invoice amount_due calculation to include down_payment_amount
-- Description: Add down_payment_amount to invoices and update trigger to calculate amount_due correctly
-- Author: Claude Code
-- Date: 2025-12-05

-- Add down_payment_amount column to invoices table
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS down_payment_amount DECIMAL(10,2) DEFAULT 0 CHECK (down_payment_amount >= 0);

COMMENT ON COLUMN invoices.down_payment_amount IS 'Montant de l''acompte versé (copié depuis la commande)';

-- Update the trigger function to include down_payment_amount in amount_due calculation
CREATE OR REPLACE FUNCTION calculate_invoice_amount_due()
RETURNS TRIGGER AS $$
BEGIN
  -- amount_due = total_amount - down_payment_amount - amount_paid
  NEW.amount_due := NEW.total_amount - COALESCE(NEW.down_payment_amount, 0) - COALESCE(NEW.amount_paid, 0);

  -- Ensure amount_due doesn't go negative (in case of overpayment)
  IF NEW.amount_due < 0 THEN
    NEW.amount_due := 0;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update existing invoices to copy down_payment_amount from their sales orders
-- and recalculate amount_due
UPDATE invoices i
SET
  down_payment_amount = COALESCE(so.down_payment_amount, 0),
  amount_due = i.total_amount - COALESCE(so.down_payment_amount, 0) - COALESCE(i.amount_paid, 0)
FROM sales_orders so
WHERE i.sales_order_id = so.id
  AND i.down_payment_amount = 0
  AND so.down_payment_amount > 0;

-- Create index for queries filtering by down_payment
CREATE INDEX IF NOT EXISTS idx_invoices_down_payment ON invoices(down_payment_amount) WHERE down_payment_amount > 0;

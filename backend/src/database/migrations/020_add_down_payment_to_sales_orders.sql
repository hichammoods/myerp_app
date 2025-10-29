-- Migration: Add down payment fields to sales_orders table
-- Description: Add down_payment_amount, down_payment_method, and down_payment_date for tracking advance payments
-- Author: Claude Code
-- Date: 2025-10-29

-- Add down payment columns to sales_orders table
ALTER TABLE sales_orders
ADD COLUMN IF NOT EXISTS down_payment_amount DECIMAL(10,2) DEFAULT 0 CHECK (down_payment_amount >= 0),
ADD COLUMN IF NOT EXISTS down_payment_method VARCHAR(50), -- especes, carte, virement, cheque
ADD COLUMN IF NOT EXISTS down_payment_date DATE,
ADD COLUMN IF NOT EXISTS down_payment_notes TEXT;

-- Add comment to explain the columns
COMMENT ON COLUMN sales_orders.down_payment_amount IS 'Montant de l''acompte versé à la commande';
COMMENT ON COLUMN sales_orders.down_payment_method IS 'Mode de paiement de l''acompte: especes, carte, virement, cheque';
COMMENT ON COLUMN sales_orders.down_payment_date IS 'Date de versement de l''acompte';
COMMENT ON COLUMN sales_orders.down_payment_notes IS 'Notes sur le paiement de l''acompte';

-- Create index for querying orders with down payment
CREATE INDEX IF NOT EXISTS idx_sales_orders_down_payment ON sales_orders(down_payment_amount) WHERE down_payment_amount > 0;

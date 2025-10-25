-- Migration: Create invoices and invoice_items tables
-- Description: Add tables for invoice management linked to sales orders
-- Author: Claude Code
-- Date: 2025-10-25

-- Create invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  sales_order_id UUID REFERENCES sales_orders(id) NOT NULL,
  quotation_id UUID REFERENCES quotations(id),
  contact_id UUID REFERENCES contacts(id) NOT NULL,

  -- Dates
  invoice_date DATE DEFAULT CURRENT_DATE,
  due_date DATE,
  payment_date DATE,

  -- Status: brouillon, envoyee, payee, en_retard, annulee
  status VARCHAR(50) DEFAULT 'brouillon',

  -- Financial
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  shipping_cost DECIMAL(10,2) DEFAULT 0,
  installation_cost DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  amount_paid DECIMAL(10,2) DEFAULT 0,
  amount_due DECIMAL(10,2) DEFAULT 0,

  -- Payment info
  payment_terms VARCHAR(100) DEFAULT '30 jours',
  payment_method VARCHAR(50), -- virement, cheque, carte, especes
  payment_reference VARCHAR(100),

  -- Additional info
  notes TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create invoice_items table
CREATE TABLE IF NOT EXISTS invoice_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id),
  product_name VARCHAR(255) NOT NULL,
  product_sku VARCHAR(100),
  description TEXT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount_percent DECIMAL(5,2) DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
  discount_amount DECIMAL(10,2) DEFAULT 0,
  tax_rate DECIMAL(5,2) DEFAULT 20 CHECK (tax_rate >= 0),
  tax_amount DECIMAL(10,2) DEFAULT 0,
  line_total DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_invoices_sales_order_id ON invoices(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_quotation_id ON invoices(quotation_id);
CREATE INDEX IF NOT EXISTS idx_invoices_contact_id ON invoices(contact_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_date ON invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_product_id ON invoice_items(product_id);

-- Add foreign key constraint to sales_orders.invoice_id now that invoices table exists
ALTER TABLE sales_orders
ADD CONSTRAINT fk_sales_orders_invoice_id
FOREIGN KEY (invoice_id) REFERENCES invoices(id);

-- Create function to generate invoice number
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
  new_number TEXT;
  counter INTEGER;
BEGIN
  -- Get current year
  SELECT COUNT(*) + 1 INTO counter
  FROM invoices
  WHERE EXTRACT(YEAR FROM invoice_date) = EXTRACT(YEAR FROM CURRENT_DATE);

  -- Format: FACT-YYYY-XXXX (e.g., FACT-2025-0001)
  new_number := 'FACT-' || EXTRACT(YEAR FROM CURRENT_DATE) || '-' || LPAD(counter::TEXT, 4, '0');

  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate invoice number
CREATE OR REPLACE FUNCTION set_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    NEW.invoice_number := generate_invoice_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_invoice_number
BEFORE INSERT ON invoices
FOR EACH ROW
EXECUTE FUNCTION set_invoice_number();

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_invoice_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_invoice_timestamp
BEFORE UPDATE ON invoices
FOR EACH ROW
EXECUTE FUNCTION update_invoice_updated_at();

-- Create trigger to automatically calculate amount_due
CREATE OR REPLACE FUNCTION calculate_invoice_amount_due()
RETURNS TRIGGER AS $$
BEGIN
  NEW.amount_due := NEW.total_amount - COALESCE(NEW.amount_paid, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_invoice_amount_due
BEFORE INSERT OR UPDATE ON invoices
FOR EACH ROW
EXECUTE FUNCTION calculate_invoice_amount_due();

-- Create trigger to automatically update status to 'en_retard' when past due date
CREATE OR REPLACE FUNCTION check_invoice_overdue()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'envoyee' AND NEW.due_date IS NOT NULL AND NEW.due_date < CURRENT_DATE THEN
    NEW.status := 'en_retard';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_invoice_overdue
BEFORE UPDATE ON invoices
FOR EACH ROW
EXECUTE FUNCTION check_invoice_overdue();

-- Migration: Create sales_orders and sales_order_items tables
-- Description: Add tables for sales order management with automatic stock deduction
-- Author: Claude Code
-- Date: 2025-10-25

-- Create sales_orders table
CREATE TABLE IF NOT EXISTS sales_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number VARCHAR(50) UNIQUE NOT NULL,
  quotation_id UUID REFERENCES quotations(id) NOT NULL,
  contact_id UUID REFERENCES contacts(id) NOT NULL,

  -- Dates
  order_date DATE DEFAULT CURRENT_DATE,
  expected_delivery_date DATE,
  shipped_date DATE,
  delivered_date DATE,

  -- Status: en_cours, en_preparation, expedie, livre, termine, annule
  status VARCHAR(50) DEFAULT 'en_cours',

  -- Financial
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  shipping_cost DECIMAL(10,2) DEFAULT 0,
  installation_cost DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,

  -- Delivery
  delivery_address TEXT,
  tracking_number VARCHAR(100),

  -- References
  invoice_id UUID, -- Will add FK after invoices table is created

  -- Additional info
  notes TEXT,
  payment_terms VARCHAR(100) DEFAULT '30 jours',
  delivery_terms VARCHAR(255) DEFAULT '2-4 semaines',

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create sales_order_items table
CREATE TABLE IF NOT EXISTS sales_order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sales_order_id UUID REFERENCES sales_orders(id) ON DELETE CASCADE NOT NULL,
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
CREATE INDEX IF NOT EXISTS idx_sales_orders_quotation_id ON sales_orders(quotation_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_contact_id ON sales_orders(contact_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON sales_orders(status);
CREATE INDEX IF NOT EXISTS idx_sales_orders_order_date ON sales_orders(order_date);
CREATE INDEX IF NOT EXISTS idx_sales_order_items_sales_order_id ON sales_order_items(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_sales_order_items_product_id ON sales_order_items(product_id);

-- Create function to generate order number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
  new_number TEXT;
  counter INTEGER;
BEGIN
  -- Get current year
  SELECT COUNT(*) + 1 INTO counter
  FROM sales_orders
  WHERE EXTRACT(YEAR FROM order_date) = EXTRACT(YEAR FROM CURRENT_DATE);

  -- Format: CMD-YYYY-XXXX (e.g., CMD-2025-0001)
  new_number := 'CMD-' || EXTRACT(YEAR FROM CURRENT_DATE) || '-' || LPAD(counter::TEXT, 4, '0');

  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate order number
CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := generate_order_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_order_number
BEFORE INSERT ON sales_orders
FOR EACH ROW
EXECUTE FUNCTION set_order_number();

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_sales_order_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_sales_order_timestamp
BEFORE UPDATE ON sales_orders
FOR EACH ROW
EXECUTE FUNCTION update_sales_order_updated_at();

-- Migration: Create sales_order_documents table
-- Description: Store document attachments (sketches, PDFs, etc.) for sales orders

CREATE TABLE IF NOT EXISTS sales_order_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sales_order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  original_file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups by sales order
CREATE INDEX idx_sales_order_documents_sales_order_id ON sales_order_documents(sales_order_id);

-- Create index for file searches
CREATE INDEX idx_sales_order_documents_file_name ON sales_order_documents(file_name);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_sales_order_document_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_sales_order_document_timestamp
BEFORE UPDATE ON sales_order_documents
FOR EACH ROW
EXECUTE FUNCTION update_sales_order_document_updated_at();

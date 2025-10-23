-- Migration: Create quotations and related tables
-- Version: 004
-- Description: Create tables for quotation management

-- Create quotations table
CREATE TABLE IF NOT EXISTS quotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_number VARCHAR(50) UNIQUE NOT NULL,

    -- Relationships
    contact_id UUID REFERENCES contacts(id) ON DELETE RESTRICT,
    sales_rep_id UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Status and dates
    status VARCHAR(20) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'expired', 'cancelled')),
    expiration_date DATE,
    delivery_date DATE,

    -- Terms
    payment_terms VARCHAR(200),
    delivery_terms VARCHAR(200),
    shipping_method VARCHAR(100),

    -- Financial
    currency VARCHAR(3) DEFAULT 'USD',
    exchange_rate DECIMAL(10,6) DEFAULT 1,
    subtotal DECIMAL(12,2) DEFAULT 0,
    tax_amount DECIMAL(12,2) DEFAULT 0,
    shipping_cost DECIMAL(12,2) DEFAULT 0,
    discount_percent DECIMAL(5,2) DEFAULT 0,
    discount_amount DECIMAL(12,2) DEFAULT 0,
    total_amount DECIMAL(12,2) DEFAULT 0,

    -- Content
    notes TEXT,
    internal_notes TEXT,
    terms_conditions TEXT,
    reference_number VARCHAR(100),

    -- Versioning
    version INTEGER DEFAULT 1,
    parent_quotation_id UUID REFERENCES quotations(id) ON DELETE SET NULL,

    -- Tracking
    sent_at TIMESTAMP,
    viewed_at TIMESTAMP,
    accepted_at TIMESTAMP,
    rejected_at TIMESTAMP,
    rejection_reason TEXT,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Create quotation sections table
CREATE TABLE IF NOT EXISTS quotation_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id UUID REFERENCES quotations(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    display_order INTEGER DEFAULT 0,
    subtotal DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create quotation lines table
CREATE TABLE IF NOT EXISTS quotation_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id UUID REFERENCES quotations(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    section_id UUID REFERENCES quotation_sections(id) ON DELETE SET NULL,

    -- Line details
    line_number INTEGER NOT NULL,
    product_sku VARCHAR(100),
    product_name VARCHAR(200) NOT NULL,
    description TEXT,

    -- Quantities and pricing
    quantity DECIMAL(10,3) NOT NULL,
    unit_price DECIMAL(12,2) NOT NULL,
    discount_percent DECIMAL(5,2) DEFAULT 0,
    discount_amount DECIMAL(12,2) DEFAULT 0,
    tax_rate DECIMAL(5,2) DEFAULT 0,
    tax_amount DECIMAL(12,2) DEFAULT 0,
    line_total DECIMAL(12,2) NOT NULL,
    cost_price DECIMAL(12,2),

    -- Additional
    notes TEXT,
    is_optional BOOLEAN DEFAULT false,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create quotation attachments table
CREATE TABLE IF NOT EXISTS quotation_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id UUID REFERENCES quotations(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_url VARCHAR(500) NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR(100),
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_quotations_number ON quotations(quotation_number);
CREATE INDEX idx_quotations_contact ON quotations(contact_id);
CREATE INDEX idx_quotations_sales_rep ON quotations(sales_rep_id);
CREATE INDEX idx_quotations_status ON quotations(status);
CREATE INDEX idx_quotations_expiration ON quotations(expiration_date);
CREATE INDEX idx_quotations_created ON quotations(created_at);
CREATE INDEX idx_quotations_deleted ON quotations(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_quotations_parent ON quotations(parent_quotation_id);

CREATE INDEX idx_quotation_sections_quotation ON quotation_sections(quotation_id);
CREATE INDEX idx_quotation_sections_order ON quotation_sections(quotation_id, display_order);

CREATE INDEX idx_quotation_lines_quotation ON quotation_lines(quotation_id);
CREATE INDEX idx_quotation_lines_product ON quotation_lines(product_id);
CREATE INDEX idx_quotation_lines_section ON quotation_lines(section_id);

CREATE INDEX idx_quotation_attachments_quotation ON quotation_attachments(quotation_id);

-- Create sequences for numbering
CREATE SEQUENCE IF NOT EXISTS quotation_number_seq START 1000;

-- Function to generate quotation number
CREATE OR REPLACE FUNCTION generate_quotation_number()
RETURNS VARCHAR AS $$
DECLARE
    year_month VARCHAR;
    seq_num INTEGER;
BEGIN
    year_month := TO_CHAR(CURRENT_DATE, 'YYYYMM');
    seq_num := NEXTVAL('quotation_number_seq');
    RETURN 'QT-' || year_month || '-' || LPAD(seq_num::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate quotation number
CREATE OR REPLACE FUNCTION set_quotation_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.quotation_number IS NULL THEN
        NEW.quotation_number := generate_quotation_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_quotation_number
    BEFORE INSERT ON quotations
    FOR EACH ROW
    EXECUTE FUNCTION set_quotation_number();

-- Function to calculate quotation totals
CREATE OR REPLACE FUNCTION calculate_quotation_totals()
RETURNS TRIGGER AS $$
DECLARE
    v_subtotal DECIMAL(12,2);
    v_tax_total DECIMAL(12,2);
    v_discount_total DECIMAL(12,2);
BEGIN
    -- Calculate subtotal, tax, and discount from lines
    SELECT
        COALESCE(SUM(quantity * unit_price), 0),
        COALESCE(SUM(tax_amount), 0),
        COALESCE(SUM(discount_amount), 0)
    INTO v_subtotal, v_tax_total, v_discount_total
    FROM quotation_lines
    WHERE quotation_id = COALESCE(NEW.quotation_id, OLD.quotation_id);

    -- Update quotation totals
    UPDATE quotations
    SET
        subtotal = v_subtotal,
        tax_amount = v_tax_total,
        discount_amount = v_discount_total + (v_subtotal * discount_percent / 100),
        total_amount = v_subtotal + v_tax_total + shipping_cost - (v_discount_total + (v_subtotal * discount_percent / 100))
    WHERE id = COALESCE(NEW.quotation_id, OLD.quotation_id);

    -- Update section subtotals if applicable
    IF NEW.section_id IS NOT NULL THEN
        UPDATE quotation_sections
        SET subtotal = (
            SELECT COALESCE(SUM(line_total), 0)
            FROM quotation_lines
            WHERE section_id = NEW.section_id
        )
        WHERE id = NEW.section_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_quotation_totals
    AFTER INSERT OR UPDATE OR DELETE ON quotation_lines
    FOR EACH ROW
    EXECUTE FUNCTION calculate_quotation_totals();

-- Update triggers
CREATE TRIGGER update_quotations_updated_at
    BEFORE UPDATE ON quotations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quotation_lines_updated_at
    BEFORE UPDATE ON quotation_lines
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
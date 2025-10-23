-- Migration: Create contacts table
-- Version: 002
-- Description: Create the contacts table for customer management

CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_code VARCHAR(50) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20),
    mobile VARCHAR(20),
    company_name VARCHAR(200),
    job_title VARCHAR(100),

    -- Address fields
    address_street VARCHAR(200),
    address_city VARCHAR(100),
    address_state VARCHAR(100),
    address_zip VARCHAR(20),
    address_country VARCHAR(100),

    -- Business fields
    tax_id VARCHAR(50),
    customer_type VARCHAR(20) DEFAULT 'individual' CHECK (customer_type IN ('individual', 'company')),
    credit_limit DECIMAL(12,2) DEFAULT 0,
    payment_terms INTEGER DEFAULT 30, -- days

    -- Additional fields
    notes TEXT,
    tags TEXT[], -- Array of tags

    -- Relationships
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Status and timestamps
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_company ON contacts(company_name);
CREATE INDEX idx_contacts_assigned ON contacts(assigned_to);
CREATE INDEX idx_contacts_code ON contacts(contact_code);
CREATE INDEX idx_contacts_tags ON contacts USING GIN(tags);
CREATE INDEX idx_contacts_deleted ON contacts(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_contacts_active ON contacts(is_active) WHERE is_active = true;

-- Create contact code sequence
CREATE SEQUENCE IF NOT EXISTS contact_code_seq START 1000;

-- Function to generate contact code
CREATE OR REPLACE FUNCTION generate_contact_code()
RETURNS VARCHAR AS $$
DECLARE
    new_code VARCHAR;
BEGIN
    new_code := 'CNT-' || LPAD(NEXTVAL('contact_code_seq')::TEXT, 6, '0');
    RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate contact code
CREATE OR REPLACE FUNCTION set_contact_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.contact_code IS NULL THEN
        NEW.contact_code := generate_contact_code();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_contact_code
    BEFORE INSERT ON contacts
    FOR EACH ROW
    EXECUTE FUNCTION set_contact_code();

-- Update trigger
CREATE TRIGGER update_contacts_updated_at
    BEFORE UPDATE ON contacts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
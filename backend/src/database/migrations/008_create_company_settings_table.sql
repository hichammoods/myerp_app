-- Migration: Create company_settings table
-- Version: 008
-- Description: Store company information for invoices and quotations

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS company_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  address VARCHAR(500),
  city VARCHAR(100),
  postal_code VARCHAR(20),
  country VARCHAR(100) DEFAULT 'France',
  phone VARCHAR(50),
  email VARCHAR(255),
  website VARCHAR(255),
  siret VARCHAR(50),
  tva VARCHAR(50),
  logo_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default company settings
INSERT INTO company_settings (name, address, city, postal_code, country, phone, email, website, siret, tva)
VALUES (
  'MyERP Furniture',
  '123 Rue de la République',
  'Paris',
  '75001',
  'France',
  '+33 1 23 45 67 89',
  'contact@myerp-furniture.fr',
  'www.myerp-furniture.fr',
  '123 456 789 00012',
  'FR 12 345678900'
) ON CONFLICT DO NOTHING;

-- Add comment
COMMENT ON TABLE company_settings IS 'Company information used in PDF generation and quotations';

-- Migration: Create products and categories tables
-- Version: 003
-- Description: Create tables for product and inventory management

-- Create categories table first
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    parent_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    description TEXT,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create products table
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,

    -- Category and classification
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,

    -- Pricing
    unit_price DECIMAL(12,2) NOT NULL,
    cost_price DECIMAL(12,2),

    -- Inventory
    quantity INTEGER DEFAULT 0,
    reserved_quantity INTEGER DEFAULT 0,
    min_stock_level INTEGER DEFAULT 0,
    max_stock_level INTEGER,
    unit_of_measure VARCHAR(20) DEFAULT 'piece',

    -- Physical attributes
    weight DECIMAL(8,3), -- in kg
    dimensions_length DECIMAL(8,2), -- in cm
    dimensions_width DECIMAL(8,2),
    dimensions_height DECIMAL(8,2),

    -- Tax and accounting
    tax_rate DECIMAL(5,2) DEFAULT 0,
    barcode VARCHAR(100),

    -- Supplier information
    supplier_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    lead_time_days INTEGER DEFAULT 0,

    -- Product settings
    is_active BOOLEAN DEFAULT true,
    is_service BOOLEAN DEFAULT false,
    track_inventory BOOLEAN DEFAULT true,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Create product images table
CREATE TABLE IF NOT EXISTS product_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    image_url VARCHAR(500) NOT NULL,
    thumbnail_url VARCHAR(500),
    display_order INTEGER DEFAULT 0,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create inventory movements table
CREATE TABLE IF NOT EXISTS inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    movement_type VARCHAR(20) NOT NULL CHECK (movement_type IN ('in', 'out', 'adjustment', 'transfer', 'return')),
    quantity DECIMAL(10,3) NOT NULL,
    quantity_before DECIMAL(10,3),
    quantity_after DECIMAL(10,3),
    unit_cost DECIMAL(12,2),
    reference_type VARCHAR(50),
    reference_id UUID,
    reference_number VARCHAR(100),
    location_from VARCHAR(100),
    location_to VARCHAR(100),
    reason VARCHAR(200),
    notes TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_supplier ON products(supplier_id);
CREATE INDEX idx_products_active ON products(is_active) WHERE is_active = true;
CREATE INDEX idx_products_deleted ON products(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_low_stock ON products(quantity, min_stock_level) WHERE track_inventory = true;

CREATE INDEX idx_categories_parent ON categories(parent_id);
CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_categories_active ON categories(is_active) WHERE is_active = true;

CREATE INDEX idx_product_images_product ON product_images(product_id);
CREATE INDEX idx_product_images_primary ON product_images(product_id, is_primary) WHERE is_primary = true;

CREATE INDEX idx_inventory_movements_product ON inventory_movements(product_id);
CREATE INDEX idx_inventory_movements_type ON inventory_movements(movement_type);
CREATE INDEX idx_inventory_movements_reference ON inventory_movements(reference_type, reference_id);
CREATE INDEX idx_inventory_movements_created ON inventory_movements(created_at);

-- Create triggers
CREATE TRIGGER update_categories_updated_at
    BEFORE UPDATE ON categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create view for product availability
CREATE OR REPLACE VIEW v_product_availability AS
SELECT
    p.id,
    p.sku,
    p.name,
    p.quantity as stock_quantity,
    p.reserved_quantity,
    (p.quantity - p.reserved_quantity) as available_quantity,
    p.min_stock_level,
    CASE
        WHEN (p.quantity - p.reserved_quantity) <= 0 THEN 'out_of_stock'
        WHEN (p.quantity - p.reserved_quantity) <= p.min_stock_level THEN 'low_stock'
        ELSE 'in_stock'
    END as stock_status
FROM products p
WHERE p.is_active = true AND p.track_inventory = true AND p.deleted_at IS NULL;

-- Insert default categories
INSERT INTO categories (name, slug, description, display_order) VALUES
    ('General', 'general', 'General products', 1),
    ('Services', 'services', 'Service items', 2),
    ('Hardware', 'hardware', 'Hardware products', 3),
    ('Software', 'software', 'Software products', 4);
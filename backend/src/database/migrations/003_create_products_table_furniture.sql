-- Migration: Create products and categories tables for FRENCH FURNITURE COMPANY
-- Version: 003
-- Description: Create tables for furniture product and inventory management (French company)

-- Create categories table for furniture types
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

-- Create materials table (wood types, fabrics, metals, etc.)
CREATE TABLE IF NOT EXISTS materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('bois', 'tissu', 'cuir', 'metal', 'mousse', 'verre', 'plastique', 'autre')),
    code VARCHAR(50) UNIQUE,
    description TEXT,
    cost_per_unit DECIMAL(12,2),
    unit_of_measure VARCHAR(20), -- metre, m2, kg, etc.
    supplier_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    stock_quantity DECIMAL(10,2) DEFAULT 0,
    min_stock_level DECIMAL(10,2) DEFAULT 0,
    lead_time_days INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create colors/finishes table
CREATE TABLE IF NOT EXISTS finishes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) CHECK (type IN ('couleur', 'finition_bois', 'motif_tissu', 'finition_metal')),
    code VARCHAR(50), -- Color code, RAL, Pantone, etc.
    hex_color VARCHAR(7), -- For digital representation
    image_url VARCHAR(500),
    extra_cost DECIMAL(12,2) DEFAULT 0, -- Additional cost for this finish
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Main products table for furniture
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,

    -- Category and classification
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    product_type VARCHAR(50) CHECK (product_type IN ('canape', 'lit', 'table', 'chaise', 'armoire', 'dressing', 'bureau', 'etagere', 'fauteuil', 'buffet', 'commode', 'autre')),
    collection_name VARCHAR(100), -- Product line/collection

    -- Dimensions (critical for furniture)
    dimensions_length DECIMAL(8,2) NOT NULL, -- in cm
    dimensions_width DECIMAL(8,2) NOT NULL,  -- in cm
    dimensions_height DECIMAL(8,2) NOT NULL, -- in cm
    dimensions_unit VARCHAR(10) DEFAULT 'cm',

    -- Additional dimensions for specific furniture
    seat_height DECIMAL(8,2), -- For chairs/sofas (hauteur assise)
    seat_depth DECIMAL(8,2),  -- For chairs/sofas (profondeur assise)
    bed_size VARCHAR(30), -- '90x190', '140x190', '160x200', '180x200', '200x200' (tailles françaises)
    table_shape VARCHAR(20), -- 'ronde', 'carree', 'rectangulaire', 'ovale'

    -- Weight and load capacity
    weight DECIMAL(8,2), -- in kg
    max_load_capacity DECIMAL(8,2), -- in kg

    -- Pricing (base price, customization adds to this)
    base_price DECIMAL(12,2) NOT NULL,
    cost_price DECIMAL(12,2),

    -- Manufacturing details
    is_customizable BOOLEAN DEFAULT true,
    is_made_to_order BOOLEAN DEFAULT false,
    production_time_days INTEGER DEFAULT 14, -- Lead time for custom orders
    min_order_quantity INTEGER DEFAULT 1,

    -- Stock (for standard, non-custom items)
    stock_quantity INTEGER DEFAULT 0,
    reserved_quantity INTEGER DEFAULT 0,
    display_in_showroom BOOLEAN DEFAULT false,

    -- Assembly and delivery
    requires_assembly BOOLEAN DEFAULT true,
    assembly_time_minutes INTEGER,
    assembly_difficulty VARCHAR(20) CHECK (assembly_difficulty IN ('facile', 'moyen', 'difficile', 'professionnel')),
    delivery_type VARCHAR(30) CHECK (delivery_type IN ('standard', 'gants_blancs', 'retrait_magasin')),
    can_be_disassembled BOOLEAN DEFAULT true, -- Important for delivery through doors

    -- Default materials (can be customized per order)
    default_material_id UUID REFERENCES materials(id) ON DELETE SET NULL,
    default_finish_id UUID REFERENCES finishes(id) ON DELETE SET NULL,

    -- Care and warranty
    care_instructions TEXT,
    warranty_months INTEGER DEFAULT 24, -- 2 years warranty (French/EU standard)

    -- Tax and accounting
    tax_rate DECIMAL(5,2) DEFAULT 20, -- French TVA 20%

    -- Product settings
    is_active BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    show_on_website BOOLEAN DEFAULT true,

    -- SEO and marketing
    slug VARCHAR(200),
    meta_description TEXT,
    tags TEXT[],

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Product customization options (what can be customized)
CREATE TABLE IF NOT EXISTS product_customizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    customization_type VARCHAR(50) NOT NULL CHECK (customization_type IN ('materiau', 'finition', 'dimensions', 'couleur', 'tissu', 'option')),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_required BOOLEAN DEFAULT false,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Available options for each customization
CREATE TABLE IF NOT EXISTS customization_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customization_id UUID REFERENCES product_customizations(id) ON DELETE CASCADE,
    material_id UUID REFERENCES materials(id) ON DELETE CASCADE,
    finish_id UUID REFERENCES finishes(id) ON DELETE CASCADE,
    option_name VARCHAR(100) NOT NULL,
    option_value VARCHAR(200),
    extra_cost DECIMAL(12,2) DEFAULT 0,
    extra_production_days INTEGER DEFAULT 0,
    is_default BOOLEAN DEFAULT false,
    is_available BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Product images table
CREATE TABLE IF NOT EXISTS product_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    image_url VARCHAR(500) NOT NULL,
    thumbnail_url VARCHAR(500),
    image_type VARCHAR(30) CHECK (image_type IN ('principale', 'angle', 'detail', 'dimensions', 'ambiance', 'matiere')),
    finish_id UUID REFERENCES finishes(id) ON DELETE SET NULL, -- Image for specific finish
    display_order INTEGER DEFAULT 0,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Product components (for modular furniture)
CREATE TABLE IF NOT EXISTS product_components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    component_product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    component_name VARCHAR(100),
    quantity INTEGER DEFAULT 1,
    is_optional BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inventory movements (adjusted for furniture)
CREATE TABLE IF NOT EXISTS inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    material_id UUID REFERENCES materials(id) ON DELETE CASCADE,
    movement_type VARCHAR(20) NOT NULL CHECK (movement_type IN ('entree', 'sortie', 'ajustement', 'transfert', 'retour', 'endommage', 'exposition')),
    quantity DECIMAL(10,3) NOT NULL,
    quantity_before DECIMAL(10,3),
    quantity_after DECIMAL(10,3),
    unit_cost DECIMAL(12,2),
    reference_type VARCHAR(50), -- commande, production, retour, etc.
    reference_id UUID,
    reference_number VARCHAR(100),
    warehouse_location VARCHAR(100),
    reason VARCHAR(200),
    notes TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_type ON products(product_type);
CREATE INDEX idx_products_collection ON products(collection_name);
CREATE INDEX idx_products_active ON products(is_active) WHERE is_active = true;
CREATE INDEX idx_products_featured ON products(is_featured) WHERE is_featured = true;
CREATE INDEX idx_products_customizable ON products(is_customizable) WHERE is_customizable = true;
CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_products_tags ON products USING GIN(tags);

CREATE INDEX idx_materials_type ON materials(type);
CREATE INDEX idx_materials_supplier ON materials(supplier_id);
CREATE INDEX idx_materials_code ON materials(code);

CREATE INDEX idx_finishes_type ON finishes(type);
CREATE INDEX idx_finishes_code ON finishes(code);

CREATE INDEX idx_product_customizations_product ON product_customizations(product_id);
CREATE INDEX idx_customization_options_customization ON customization_options(customization_id);

CREATE INDEX idx_product_images_product ON product_images(product_id);
CREATE INDEX idx_product_components_parent ON product_components(parent_product_id);

-- Create triggers
CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_materials_updated_at
    BEFORE UPDATE ON materials
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at
    BEFORE UPDATE ON categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create view for product availability with customization info
CREATE OR REPLACE VIEW v_product_catalog AS
SELECT
    p.id,
    p.sku,
    p.name,
    p.product_type,
    c.name as category_name,
    p.collection_name,
    p.dimensions_length || 'x' || p.dimensions_width || 'x' || p.dimensions_height || ' cm' as dimensions,
    p.base_price,
    p.is_customizable,
    p.is_made_to_order,
    p.production_time_days,
    p.stock_quantity,
    CASE
        WHEN p.is_made_to_order THEN 'sur_commande'
        WHEN p.stock_quantity > 0 THEN 'en_stock'
        WHEN p.stock_quantity = 0 AND p.is_customizable THEN 'disponible_sur_commande'
        ELSE 'rupture_stock'
    END as availability_status,
    array_agg(DISTINCT pc.customization_type) as customization_options
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
LEFT JOIN product_customizations pc ON p.id = pc.product_id
WHERE p.is_active = true AND p.deleted_at IS NULL
GROUP BY p.id, c.name;

-- Insert default categories for furniture (in French)
INSERT INTO categories (name, slug, description, display_order) VALUES
    ('Salon', 'salon', 'Canapés, tables basses, meubles TV et plus', 1),
    ('Chambre', 'chambre', 'Lits, armoires, commodes et tables de chevet', 2),
    ('Salle à manger', 'salle-a-manger', 'Tables à manger, chaises et buffets', 3),
    ('Bureau', 'bureau', 'Bureaux, fauteuils de bureau et rangements', 4),
    ('Rangement', 'rangement', 'Armoires, étagères et organisateurs', 5),
    ('Extérieur', 'exterieur', 'Mobilier de jardin et terrasse', 6),
    ('Entrée', 'entree', 'Consoles, porte-manteaux et meubles à chaussures', 7),
    ('Salle de bain', 'salle-de-bain', 'Meubles vasques, colonnes et miroirs', 8);

-- Insert subcategories (in French)
INSERT INTO categories (name, slug, parent_id, display_order)
SELECT 'Canapés', 'canapes', id, 1 FROM categories WHERE slug = 'salon';
INSERT INTO categories (name, slug, parent_id, display_order)
SELECT 'Fauteuils', 'fauteuils', id, 2 FROM categories WHERE slug = 'salon';
INSERT INTO categories (name, slug, parent_id, display_order)
SELECT 'Tables basses', 'tables-basses', id, 3 FROM categories WHERE slug = 'salon';
INSERT INTO categories (name, slug, parent_id, display_order)
SELECT 'Meubles TV', 'meubles-tv', id, 4 FROM categories WHERE slug = 'salon';

INSERT INTO categories (name, slug, parent_id, display_order)
SELECT 'Lits', 'lits', id, 1 FROM categories WHERE slug = 'chambre';
INSERT INTO categories (name, slug, parent_id, display_order)
SELECT 'Armoires', 'armoires', id, 2 FROM categories WHERE slug = 'chambre';
INSERT INTO categories (name, slug, parent_id, display_order)
SELECT 'Commodes', 'commodes', id, 3 FROM categories WHERE slug = 'chambre';
INSERT INTO categories (name, slug, parent_id, display_order)
SELECT 'Tables de chevet', 'tables-de-chevet', id, 4 FROM categories WHERE slug = 'chambre';

INSERT INTO categories (name, slug, parent_id, display_order)
SELECT 'Tables à manger', 'tables-a-manger', id, 1 FROM categories WHERE slug = 'salle-a-manger';
INSERT INTO categories (name, slug, parent_id, display_order)
SELECT 'Chaises', 'chaises', id, 2 FROM categories WHERE slug = 'salle-a-manger';
INSERT INTO categories (name, slug, parent_id, display_order)
SELECT 'Buffets', 'buffets', id, 3 FROM categories WHERE slug = 'salle-a-manger';

-- Insert sample materials (in French)
INSERT INTO materials (name, type, code, description, unit_of_measure) VALUES
    ('Chêne massif', 'bois', 'BOIS-CHENE', 'Bois de chêne massif français', 'm2'),
    ('Hêtre massif', 'bois', 'BOIS-HETRE', 'Bois de hêtre massif', 'm2'),
    ('Pin massif', 'bois', 'BOIS-PIN', 'Bois de pin massif', 'm2'),
    ('Noyer', 'bois', 'BOIS-NOYER', 'Bois de noyer', 'm2'),
    ('MDF', 'bois', 'BOIS-MDF', 'Panneau de fibres moyenne densité', 'm2'),

    ('Tissu coton', 'tissu', 'TIS-COT-001', '100% coton', 'metre'),
    ('Tissu lin', 'tissu', 'TIS-LIN-001', '100% lin français', 'metre'),
    ('Velours', 'tissu', 'TIS-VEL-001', 'Velours haute qualité', 'metre'),
    ('Tissu polyester', 'tissu', 'TIS-POL-001', 'Tissu polyester résistant', 'metre'),

    ('Cuir pleine fleur', 'cuir', 'CUIR-PF-001', 'Cuir de vachette pleine fleur', 'm2'),
    ('Cuir aniline', 'cuir', 'CUIR-ANI-001', 'Cuir aniline premium', 'm2'),
    ('Simili cuir', 'cuir', 'CUIR-SIM-001', 'Simili cuir haute qualité', 'm2'),

    ('Acier', 'metal', 'MET-ACIER', 'Acier brossé', 'kg'),
    ('Aluminium', 'metal', 'MET-ALU', 'Aluminium anodisé', 'kg'),
    ('Fer forgé', 'metal', 'MET-FER', 'Fer forgé artisanal', 'kg'),

    ('Mousse HR 35kg/m³', 'mousse', 'MOU-HR35', 'Mousse haute résilience 35kg/m³', 'm3'),
    ('Mousse mémoire de forme', 'mousse', 'MOU-MEM', 'Mousse à mémoire de forme', 'm3'),

    ('Verre trempé', 'verre', 'VER-TREMP', 'Verre trempé 8mm', 'm2'),
    ('Miroir', 'verre', 'VER-MIR', 'Miroir argenté 5mm', 'm2');

-- Insert sample finishes (in French)
INSERT INTO finishes (name, type, code, hex_color, extra_cost) VALUES
    -- Finitions bois
    ('Chêne naturel', 'finition_bois', 'FIN-CHENE-NAT', '#D2691E', 0),
    ('Chêne blanchi', 'finition_bois', 'FIN-CHENE-BLA', '#F5DEB3', 50),
    ('Chêne fumé', 'finition_bois', 'FIN-CHENE-FUM', '#8B4513', 75),
    ('Noyer foncé', 'finition_bois', 'FIN-NOY-FON', '#5D4E37', 100),
    ('Laqué blanc', 'finition_bois', 'FIN-LAQ-BLA', '#FFFFFF', 80),
    ('Laqué noir', 'finition_bois', 'FIN-LAQ-NOI', '#000000', 80),

    -- Couleurs tissus
    ('Gris anthracite', 'couleur', 'COL-ANTH', '#36454F', 0),
    ('Beige', 'couleur', 'COL-BEIGE', '#F5F5DC', 0),
    ('Bleu marine', 'couleur', 'COL-MARINE', '#000080', 0),
    ('Vert olive', 'couleur', 'COL-OLIVE', '#708238', 0),
    ('Terracotta', 'couleur', 'COL-TERRA', '#E2725B', 0),
    ('Blanc cassé', 'couleur', 'COL-BLANC', '#FFFDD0', 0),
    ('Taupe', 'couleur', 'COL-TAUPE', '#483C32', 0),

    -- Finitions métal
    ('Chrome', 'finition_metal', 'FIN-CHROME', '#C0C0C0', 30),
    ('Noir mat', 'finition_metal', 'FIN-NOIR-MAT', '#28282B', 20),
    ('Laiton brossé', 'finition_metal', 'FIN-LAITON', '#B87333', 50),
    ('Cuivre', 'finition_metal', 'FIN-CUIVRE', '#B87333', 60);
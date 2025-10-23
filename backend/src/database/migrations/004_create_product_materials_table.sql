-- Migration: Create product_materials junction table
-- This table links products with their materials and finishes
-- Allows a product to have multiple materials, each with its own finish

CREATE TABLE IF NOT EXISTS product_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES materials(id) ON DELETE RESTRICT,
  finish_id UUID REFERENCES finishes(id) ON DELETE SET NULL,

  -- Part description (e.g., "seat", "backrest", "frame", "legs")
  part_name VARCHAR(100) NOT NULL,
  part_description TEXT,

  -- Quantity of this material used (e.g., 2.5 meters of fabric)
  quantity DECIMAL(10, 3),
  unit_of_measure VARCHAR(20),

  -- Positioning or order (for display purposes)
  position INTEGER DEFAULT 0,

  -- Additional cost for this specific material-finish combination
  extra_cost DECIMAL(10, 2) DEFAULT 0,

  -- Notes about this specific material usage
  notes TEXT,

  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  -- Ensure unique combination of product, material, finish, and part
  CONSTRAINT unique_product_material_finish_part UNIQUE (product_id, material_id, finish_id, part_name)
);

-- Indexes for performance
CREATE INDEX idx_product_materials_product_id ON product_materials(product_id);
CREATE INDEX idx_product_materials_material_id ON product_materials(material_id);
CREATE INDEX idx_product_materials_finish_id ON product_materials(finish_id);

-- Update trigger for updated_at
CREATE TRIGGER update_product_materials_updated_at
  BEFORE UPDATE ON product_materials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add column to products table to indicate if custom materials are allowed
ALTER TABLE products
ADD COLUMN IF NOT EXISTS allows_custom_materials BOOLEAN DEFAULT true;

-- Example data for a chair
-- Chair frame: Oak wood with natural finish
-- Seat: Brown fabric
-- Backrest: Orange fabric

COMMENT ON TABLE product_materials IS 'Junction table linking products with their materials and finishes for each part';
COMMENT ON COLUMN product_materials.part_name IS 'Name of the product part (e.g., seat, backrest, frame)';
COMMENT ON COLUMN product_materials.quantity IS 'Amount of material used for this part';
COMMENT ON COLUMN product_materials.extra_cost IS 'Additional cost for this specific material-finish combination';
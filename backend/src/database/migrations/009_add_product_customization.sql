-- Migration 009: Add product customization support for quotations
-- This enables custom material/finish selection for products in quotations

-- 1. Add customization fields to quotation_lines
ALTER TABLE quotation_lines
ADD COLUMN IF NOT EXISTS is_customized BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS base_product_id UUID REFERENCES products(id) ON DELETE SET NULL;

-- 2. Create quotation_line_components table for detailed customization
CREATE TABLE IF NOT EXISTS quotation_line_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_line_id UUID NOT NULL REFERENCES quotation_lines(id) ON DELETE CASCADE,
  component_name VARCHAR(100) NOT NULL, -- 'assise', 'structure', 'pieds', 'dossier', etc.
  component_type VARCHAR(50) DEFAULT 'material', -- 'material', 'finish', 'hardware'
  material_id UUID REFERENCES materials(id) ON DELETE SET NULL,
  finish_id UUID REFERENCES finishes(id) ON DELETE SET NULL,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 1.0,
  unit_cost DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  upcharge_percentage DECIMAL(5,2) DEFAULT 0.00, -- % upcharge for this material vs standard
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Ensure at least one of material_id or finish_id is set
  CONSTRAINT check_component_reference CHECK (
    material_id IS NOT NULL OR finish_id IS NOT NULL
  )
);

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_quotation_line_components_line_id
  ON quotation_line_components(quotation_line_id);

CREATE INDEX IF NOT EXISTS idx_quotation_line_components_material_id
  ON quotation_line_components(material_id);

CREATE INDEX IF NOT EXISTS idx_quotation_line_components_finish_id
  ON quotation_line_components(finish_id);

-- 4. Add material upcharge percentage to materials table (for quick pricing)
ALTER TABLE materials
ADD COLUMN IF NOT EXISTS upcharge_percentage DECIMAL(5,2) DEFAULT 0.00;

-- 5. Add material upcharge percentage to finishes table
ALTER TABLE finishes
ADD COLUMN IF NOT EXISTS upcharge_percentage DECIMAL(5,2) DEFAULT 0.00;

-- 6. Add comments for documentation
COMMENT ON TABLE quotation_line_components IS 'Stores custom material/finish selections for quotation line items';
COMMENT ON COLUMN quotation_line_components.component_name IS 'Name of the component being customized (e.g., assise, structure, pieds)';
COMMENT ON COLUMN quotation_line_components.upcharge_percentage IS 'Percentage upcharge for using this material vs standard (can override material default)';
COMMENT ON COLUMN materials.upcharge_percentage IS 'Default percentage upcharge when this material is used as a substitution';
COMMENT ON COLUMN finishes.upcharge_percentage IS 'Default percentage upcharge when this finish is used as a substitution';

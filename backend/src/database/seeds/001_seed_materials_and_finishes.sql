-- Seed: Initial Materials and Finishes for Furniture ERP
-- This seed file populates common materials and finishes for French furniture business

-- ======================
-- MATERIALS
-- ======================
-- Schema: id, name, type, code, description, cost_per_unit, unit_of_measure, supplier_id (NULL for now), stock_quantity, min_stock_level, lead_time_days, is_active

INSERT INTO materials (name, type, code, description, cost_per_unit, unit_of_measure, stock_quantity, min_stock_level, lead_time_days, is_active) VALUES
-- WOOD Materials (type='bois')
('Chêne Massif', 'bois', 'B-CHE', 'Chêne massif de qualité supérieure', 45.00, 'm²', 100.00, 20.00, 15, true),
('Hêtre', 'bois', 'B-HET', 'Hêtre naturel pour meubles', 35.00, 'm²', 80.00, 15.00, 10, true),
('Noyer', 'bois', 'B-NOY', 'Noyer premium', 65.00, 'm²', 50.00, 10.00, 20, true),
('Pin', 'bois', 'B-PIN', 'Pin traité', 25.00, 'm²', 120.00, 25.00, 7, true),
('MDF', 'autre', 'P-MDF', 'Panneau de fibres moyenne densité', 15.00, 'm²', 200.00, 40.00, 5, true),
('Contreplaqué', 'autre', 'P-CTR', 'Contreplaqué multiplis', 22.00, 'm²', 150.00, 30.00, 5, true),

-- FABRIC Materials (type='tissu')
('Tissu Lin Naturel', 'tissu', 'T-LIN', 'Lin 100% naturel', 18.00, 'm', 200.00, 40.00, 14, true),
('Tissu Coton', 'tissu', 'T-COT', 'Coton résistant', 12.00, 'm', 250.00, 50.00, 10, true),
('Velours', 'tissu', 'T-VEL', 'Velours haute qualité', 35.00, 'm', 100.00, 20.00, 20, true),

-- LEATHER Materials (type='cuir')
('Cuir Véritable', 'cuir', 'C-VER', 'Cuir pleine fleur', 85.00, 'm²', 60.00, 12.00, 30, true),
('Simili Cuir', 'cuir', 'C-SIM', 'Similicuir aspect cuir', 28.00, 'm', 150.00, 30.00, 10, true),

-- METAL Materials (type='metal')
('Acier', 'metal', 'M-ACI', 'Acier standard', 8.50, 'kg', 500.00, 100.00, 7, true),
('Inox', 'metal', 'M-INX', 'Acier inoxydable', 15.00, 'kg', 200.00, 40.00, 10, true),
('Aluminium', 'metal', 'M-ALU', 'Aluminium léger', 12.00, 'kg', 300.00, 60.00, 7, true),
('Laiton', 'metal', 'M-LAI', 'Laiton décoratif', 18.00, 'kg', 100.00, 20.00, 14, true),

-- OTHER Materials
('Verre Trempé', 'verre', 'V-TMP', 'Verre sécurisé trempé', 45.00, 'm²', 40.00, 8.00, 15, true),
('Mousse Polyuréthane', 'mousse', 'MU-HR35', 'Mousse HR35 kg/m³', 25.00, 'm³', 80.00, 16.00, 10, true),
('Ressorts Ensachés', 'autre', 'R-ENS', 'Ressorts individuels ensachés', 120.00, 'unité', 150.00, 30.00, 14, true),
('Colle Bois D3', 'autre', 'Q-COL', 'Colle bi-composant', 8.50, 'L', 100.00, 20.00, 3, true),
('Vis Inox', 'autre', 'Q-VIS', 'Vis inox assortiment', 0.15, 'unité', 5000.00, 1000.00, 1, true),
('Roulettes Pivotantes', 'autre', 'Q-ROU', 'Roulettes diamètre 50mm', 3.50, 'unité', 500.00, 100.00, 5, true);

-- ======================
-- FINISHES
-- ======================
-- Schema: id, name, type, code, hex_color, image_url, extra_cost, is_active

INSERT INTO finishes (name, type, code, hex_color, extra_cost, is_active) VALUES
-- WOOD FINISHES (type='finition_bois')
('Naturel', 'finition_bois', 'FB-NAT', '#D4A574', 0.00, true),
('Vernis Mat', 'finition_bois', 'FB-VMA', '#C19A6B', 8.50, true),
('Vernis Satiné', 'finition_bois', 'FB-VSA', '#C19A6B', 8.50, true),
('Vernis Brillant', 'finition_bois', 'FB-VBR', '#C19A6B', 9.00, true),
('Teinture Noyer', 'finition_bois', 'FB-TNO', '#654321', 6.50, true),
('Teinture Chêne Clair', 'finition_bois', 'FB-TCL', '#D2B48C', 6.50, true),
('Teinture Wengé', 'finition_bois', 'FB-TWE', '#3B2F2F', 7.00, true),
('Huile Naturelle', 'finition_bois', 'FB-HUI', '#D4A574', 15.00, true),
('Cire', 'finition_bois', 'FB-CIR', '#C8A882', 10.00, true),

-- PAINTED FINISHES (type='couleur')
('Laque Blanche', 'couleur', 'C-BLA', '#FFFFFF', 12.00, true),
('Laque Noire', 'couleur', 'C-NOI', '#000000', 12.00, true),
('Laque Grise', 'couleur', 'C-GRI', '#808080', 12.00, true),
('Patiné Blanc', 'couleur', 'C-PBLA', '#F5F5DC', 14.00, true),
('Patiné Gris', 'couleur', 'C-PGRI', '#A9A9A9', 14.00, true),

-- METAL FINISHES (type='finition_metal')
('Chromé', 'finition_metal', 'FM-CHR', '#C0C0C0', 25.00, true),
('Brossé', 'finition_metal', 'FM-BRO', '#B8B8B8', 8.00, true),
('Noir Mat', 'finition_metal', 'FM-NMA', '#1C1C1C', 10.00, true),
('Doré', 'finition_metal', 'FM-DOR', '#FFD700', 18.00, true),
('Bronze', 'finition_metal', 'FM-BRZ', '#CD7F32', 18.00, true),

-- FABRIC PATTERNS (type='motif_tissu')
('Standard', 'motif_tissu', 'MT-STD', NULL, 0.00, true),
('Anti-taches', 'motif_tissu', 'MT-ANT', NULL, 5.00, true),
('Ignifugé', 'motif_tissu', 'MT-IGN', NULL, 8.00, true);

-- ======================
-- SUCCESS MESSAGE
-- ======================
DO $$
BEGIN
  RAISE NOTICE 'Seed completed: Materials and Finishes loaded successfully';
END $$;

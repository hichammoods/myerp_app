-- Add images JSONB column to products table
-- This allows storing multiple images as JSON array directly in the products table

ALTER TABLE products
ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;

-- Add index for better query performance on images
CREATE INDEX IF NOT EXISTS idx_products_images ON products USING gin (images);

-- Add comment
COMMENT ON COLUMN products.images IS 'Array of image objects stored as JSONB. Each object contains: url, filename, originalName, mimeType, size, isMain, uploadedAt';

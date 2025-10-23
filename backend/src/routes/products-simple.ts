import { Router, Request, Response } from 'express';
import { Client } from 'pg';
import { logger } from '../utils/logger';
import { upload, generateUniqueFilename } from '../middleware/upload';
import { minioClient, bucketName } from '../config/minio';

const router = Router();

// Create a direct PostgreSQL connection for each request
async function getDbConnection() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://myerp:myerp_password@localhost:5432/myerp_db'
  });
  await client.connect();
  return client;
}

// Safe client cleanup
async function closeClient(client: Client | undefined) {
  if (client) {
    try {
      await client.end();
    } catch (error) {
      // Ignore errors when closing - client might already be closed
      logger.debug('Client close error (ignored):', error);
    }
  }
}

// Test endpoint - direct database connection
router.get('/test-direct', async (req: Request, res: Response) => {
  let client;
  try {
    client = await getDbConnection();
    const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
    res.json({
      success: true,
      data: result.rows[0],
      message: 'Direct database connection working'
    });
  } catch (error: any) {
    logger.error('Direct DB test error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Direct database connection failed'
    });
  } finally {
    await closeClient(client);
  }
});

// GET all categories - no auth, no redis, direct db
router.get('/categories/all', async (req: Request, res: Response) => {
  let client;
  try {
    const { include_inactive } = req.query;
    client = await getDbConnection();

    const whereClause = include_inactive === 'true' ? '' : 'WHERE c.is_active = true';

    const result = await client.query(
      `SELECT
        c.*,
        COUNT(p.id) as products_count
       FROM categories c
       LEFT JOIN products p ON c.id = p.category_id
       ${whereClause}
       GROUP BY c.id
       ORDER BY c.display_order, c.name`
    );
    res.json({
      success: true,
      categories: result.rows
    });
  } catch (error: any) {
    logger.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    await closeClient(client);
  }
});

// CREATE category - no auth, no redis, direct db
router.post('/categories', async (req: Request, res: Response) => {
  let client;
  try {
    const { name, slug, description, parent_id, display_order, is_active } = req.body;

    if (!name || !slug) {
      return res.status(400).json({ error: 'Name and slug are required' });
    }

    client = await getDbConnection();

    // Check if slug already exists
    const existing = await client.query(
      'SELECT id FROM categories WHERE slug = $1',
      [slug]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Category with this slug already exists' });
    }

    // Insert new category
    const result = await client.query(
      `INSERT INTO categories (name, slug, description, parent_id, display_order, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING *`,
      [name, slug, description || null, parent_id || null, display_order || 0, is_active !== false]
    );

    res.status(201).json({
      success: true,
      category: result.rows[0],
      message: 'Category created successfully'
    });
  } catch (error: any) {
    logger.error('Create category error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    await closeClient(client);
  }
});

// UPDATE category
router.put('/categories/:id', async (req: Request, res: Response) => {
  let client;
  try {
    const { id } = req.params;
    const { name, slug, description, parent_id, display_order, is_active } = req.body;

    if (!name || !slug) {
      return res.status(400).json({ error: 'Name and slug are required' });
    }

    client = await getDbConnection();

    // Check if category exists
    const existing = await client.query(
      'SELECT id FROM categories WHERE id = $1',
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Update category
    const result = await client.query(
      `UPDATE categories
       SET name = $1, slug = $2, description = $3, parent_id = $4,
           display_order = $5, is_active = $6, updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [name, slug, description || null, parent_id || null, display_order || 0, is_active !== false, id]
    );

    res.json({
      success: true,
      category: result.rows[0],
      message: 'Category updated successfully'
    });
  } catch (error: any) {
    logger.error('Update category error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    await closeClient(client);
  }
});

// DELETE category
router.delete('/categories/:id', async (req: Request, res: Response) => {
  let client;
  try {
    const { id } = req.params;

    client = await getDbConnection();

    // Check if category has products
    const products = await client.query(
      'SELECT COUNT(*) as count FROM products WHERE category_id = $1',
      [id]
    );

    if (parseInt(products.rows[0].count) > 0) {
      return res.status(400).json({
        error: 'Cannot delete category with associated products'
      });
    }

    // Delete category
    const result = await client.query(
      'DELETE FROM categories WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error: any) {
    logger.error('Delete category error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    await closeClient(client);
  }
});

// GET all materials - no auth, no redis, direct db
router.get('/materials/all', async (req: Request, res: Response) => {
  let client;
  try {
    client = await getDbConnection();
    const result = await client.query(
      'SELECT * FROM materials ORDER BY name'
    );
    res.json({
      success: true,
      materials: result.rows
    });
  } catch (error: any) {
    logger.error('Get materials error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    await closeClient(client);
  }
});

// CREATE material
router.post('/materials', async (req: Request, res: Response) => {
  let client;
  try {
    const { name, type, code, description, cost_per_unit, stock_quantity, unit_of_measure, supplier, is_active } = req.body;

    if (!name || !code) {
      return res.status(400).json({ error: 'Name and code are required' });
    }

    client = await getDbConnection();

    // Check if code already exists
    const existing = await client.query(
      'SELECT id FROM materials WHERE code = $1',
      [code]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Material with this code already exists' });
    }

    // Insert new material
    const result = await client.query(
      `INSERT INTO materials (name, type, code, description, cost_per_unit, stock_quantity, unit_of_measure, supplier, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
       RETURNING *`,
      [
        name,
        type || 'autre',
        code,
        description || null,
        cost_per_unit ? parseFloat(cost_per_unit) : null,
        stock_quantity ? parseFloat(stock_quantity) : 0,
        unit_of_measure || 'm²',
        supplier || null,
        is_active !== false
      ]
    );

    res.status(201).json({
      success: true,
      material: result.rows[0],
      message: 'Material created successfully'
    });
  } catch (error: any) {
    logger.error('Create material error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    await closeClient(client);
  }
});

// UPDATE material
router.put('/materials/:id', async (req: Request, res: Response) => {
  let client;
  try {
    const { id } = req.params;
    const { name, type, code, description, cost_per_unit, stock_quantity, unit_of_measure, supplier, is_active } = req.body;

    if (!name || !code) {
      return res.status(400).json({ error: 'Name and code are required' });
    }

    client = await getDbConnection();

    // Check if material exists
    const existing = await client.query(
      'SELECT id FROM materials WHERE id = $1',
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Material not found' });
    }

    // Update material
    const result = await client.query(
      `UPDATE materials
       SET name = $1, type = $2, code = $3, description = $4,
           cost_per_unit = $5, stock_quantity = $6, unit_of_measure = $7,
           supplier = $8, is_active = $9, updated_at = NOW()
       WHERE id = $10
       RETURNING *`,
      [
        name,
        type || 'autre',
        code,
        description || null,
        cost_per_unit ? parseFloat(cost_per_unit) : null,
        stock_quantity ? parseFloat(stock_quantity) : 0,
        unit_of_measure || 'm²',
        supplier || null,
        is_active !== false,
        id
      ]
    );

    res.json({
      success: true,
      material: result.rows[0],
      message: 'Material updated successfully'
    });
  } catch (error: any) {
    logger.error('Update material error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    await closeClient(client);
  }
});

// DELETE material
router.delete('/materials/:id', async (req: Request, res: Response) => {
  let client;
  try {
    const { id } = req.params;

    client = await getDbConnection();

    // Delete material
    const result = await client.query(
      'DELETE FROM materials WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Material not found' });
    }

    res.json({
      success: true,
      message: 'Material deleted successfully'
    });
  } catch (error: any) {
    logger.error('Delete material error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    await closeClient(client);
  }
});

// GET all finishes - no auth, no redis, direct db
router.get('/finishes/all', async (req: Request, res: Response) => {
  let client;
  try {
    client = await getDbConnection();
    const result = await client.query(
      'SELECT * FROM finishes WHERE is_active = true ORDER BY name'
    );
    res.json({
      success: true,
      finishes: result.rows
    });
  } catch (error: any) {
    logger.error('Get finishes error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    await closeClient(client);
  }
});

// CREATE finish
router.post('/finishes', async (req: Request, res: Response) => {
  let client;
  try {
    const { name, type, code, hex_color, extra_cost, description, is_active } = req.body;

    if (!name || !code) {
      return res.status(400).json({ error: 'Name and code are required' });
    }

    client = await getDbConnection();

    // Check if code already exists
    const existing = await client.query(
      'SELECT id FROM finishes WHERE code = $1',
      [code]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Finish with this code already exists' });
    }

    // Insert new finish
    const result = await client.query(
      `INSERT INTO finishes (name, type, code, hex_color, extra_cost, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING *`,
      [name, type || 'couleur', code, hex_color || null, extra_cost || 0, is_active !== false]
    );

    res.status(201).json({
      success: true,
      finish: result.rows[0],
      message: 'Finish created successfully'
    });
  } catch (error: any) {
    logger.error('Create finish error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    await closeClient(client);
  }
});

// UPDATE finish
router.put('/finishes/:id', async (req: Request, res: Response) => {
  let client;
  try {
    const { id } = req.params;
    const { name, type, code, hex_color, extra_cost, description, is_active } = req.body;

    if (!name || !code) {
      return res.status(400).json({ error: 'Name and code are required' });
    }

    client = await getDbConnection();

    // Check if finish exists
    const existing = await client.query(
      'SELECT id FROM finishes WHERE id = $1',
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Finish not found' });
    }

    // Update finish
    const result = await client.query(
      `UPDATE finishes
       SET name = $1, type = $2, code = $3, hex_color = $4,
           extra_cost = $5, is_active = $6
       WHERE id = $7
       RETURNING *`,
      [
        name,
        type || 'couleur',
        code,
        hex_color || null,
        extra_cost || 0,
        is_active !== false,
        id
      ]
    );

    res.json({
      success: true,
      finish: result.rows[0],
      message: 'Finish updated successfully'
    });
  } catch (error: any) {
    logger.error('Update finish error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    await closeClient(client);
  }
});

// DELETE finish
router.delete('/finishes/:id', async (req: Request, res: Response) => {
  let client;
  try {
    const { id } = req.params;

    client = await getDbConnection();

    // Delete finish
    const result = await client.query(
      'DELETE FROM finishes WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Finish not found' });
    }

    res.json({
      success: true,
      message: 'Finish deleted successfully'
    });
  } catch (error: any) {
    logger.error('Delete finish error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    await closeClient(client);
  }
});

// GET all products - simplified with column mapping
router.get('/', async (req: Request, res: Response) => {
  let client;
  try {
    client = await getDbConnection();
    const result = await client.query(
      `SELECT
        p.*,
        p.unit_price as base_price,
        p.quantity as stock_quantity,
        c.name as category_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.is_active = true
       ORDER BY p.created_at DESC`
    );

    // Map database columns to frontend expected format
    const mappedProducts = result.rows.map(row => ({
      id: row.id,
      sku: row.sku,
      name: row.name,
      description: row.description,
      categoryId: row.category_id,
      categoryName: row.category_name,
      basePrice: row.unit_price,
      stockQuantity: row.quantity,
      weight: row.weight,
      allowsCustomMaterials: row.allows_custom_materials,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    res.json({
      success: true,
      products: mappedProducts,
      total: mappedProducts.length
    });
  } catch (error: any) {
    logger.error('Get products error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    await closeClient(client);
  }
});

// CREATE product
router.post('/', async (req: Request, res: Response) => {
  let client;
  try {
    logger.info('Received product creation request:', JSON.stringify(req.body));

    const {
      sku, name, description, category_id, categoryId,
      base_price, basePrice, dimensions, weight, stock_quantity, stockQuantity,
      type, isCustomizable, allowsCustomMaterials, isMadeToOrder, materials, images
    } = req.body;

    // Handle both camelCase and snake_case
    const finalSku = sku;
    const finalName = name;
    const finalDescription = description;
    const finalCategoryId = category_id || categoryId || null;
    const finalPrice = base_price || basePrice;
    const finalStockQty = stock_quantity ?? stockQuantity ?? 0;
    const finalWeight = weight || null;
    const finalAllowsCustom = allowsCustomMaterials ?? isCustomizable ?? true;

    if (!finalSku || !finalName || !finalPrice) {
      logger.error('Missing required fields:', { sku: finalSku, name: finalName, base_price: finalPrice });
      return res.status(400).json({ error: 'SKU, name, and base price are required' });
    }

    client = await getDbConnection();

    // Check if SKU already exists
    const existing = await client.query(
      'SELECT id FROM products WHERE sku = $1',
      [finalSku]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Product with this SKU already exists' });
    }

    // Insert new product - mapping to actual database columns
    const result = await client.query(
      `INSERT INTO products (
        sku, name, description, category_id, unit_price,
        weight, quantity, is_active, allows_custom_materials, images, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, $9, NOW(), NOW())
       RETURNING *`,
      [
        finalSku,
        finalName,
        finalDescription || null,
        finalCategoryId,
        finalPrice,
        finalWeight,
        finalStockQty,
        finalAllowsCustom,
        JSON.stringify(images || [])
      ]
    );

    const productId = result.rows[0].id;

    // Handle materials if provided
    if (materials && Array.isArray(materials) && materials.length > 0) {
      for (const material of materials) {
        if (material.materialId && material.partName) {
          await client.query(
            `INSERT INTO product_materials (
              product_id, material_id, finish_id, part_name, quantity,
              unit_of_measure, extra_cost, notes, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
            [
              productId,
              material.materialId,
              material.finishId || null,
              material.partName,
              material.quantity || null,
              material.unit || null,
              material.extraCost || 0,
              material.notes || null
            ]
          );
        }
      }
    }

    logger.info('Product created successfully:', productId);

    const createdProduct = result.rows[0];
    res.status(201).json({
      success: true,
      product: {
        id: createdProduct.id,
        sku: createdProduct.sku,
        name: createdProduct.name,
        description: createdProduct.description,
        categoryId: createdProduct.category_id,
        basePrice: createdProduct.unit_price,
        stockQuantity: createdProduct.quantity,
        weight: createdProduct.weight,
        allowsCustomMaterials: createdProduct.allows_custom_materials,
        isActive: createdProduct.is_active,
        createdAt: createdProduct.created_at,
        updatedAt: createdProduct.updated_at
      },
      message: 'Product created successfully'
    });
  } catch (error: any) {
    logger.error('Create product error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    await closeClient(client);
  }
});

// UPDATE product
router.put('/:id', async (req: Request, res: Response) => {
  let client;
  try {
    const { id } = req.params;
    const {
      sku, name, description, category_id, categoryId,
      base_price, basePrice, dimensions, weight, stock_quantity, stockQuantity,
      type, isCustomizable, allowsCustomMaterials, isMadeToOrder, materials, images
    } = req.body;

    // Handle both camelCase and snake_case
    const finalSku = sku;
    const finalName = name;
    const finalDescription = description;
    const finalCategoryId = category_id || categoryId || null;
    const finalPrice = base_price || basePrice;
    const finalStockQty = stock_quantity ?? stockQuantity ?? 0;
    const finalWeight = weight || null;
    const finalAllowsCustom = allowsCustomMaterials ?? isCustomizable ?? true;

    if (!finalSku || !finalName || !finalPrice) {
      return res.status(400).json({ error: 'SKU, name, and base price are required' });
    }

    client = await getDbConnection();

    // Check if product exists
    const existing = await client.query(
      'SELECT id FROM products WHERE id = $1',
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Check if SKU is being changed to one that already exists
    const skuCheck = await client.query(
      'SELECT id FROM products WHERE sku = $1 AND id != $2',
      [finalSku, id]
    );

    if (skuCheck.rows.length > 0) {
      return res.status(409).json({ error: 'Product with this SKU already exists' });
    }

    // Update product
    const result = await client.query(
      `UPDATE products
       SET sku = $1, name = $2, description = $3, category_id = $4,
           unit_price = $5, weight = $6, quantity = $7,
           allows_custom_materials = $8, images = $9, updated_at = NOW()
       WHERE id = $10
       RETURNING *`,
      [
        finalSku,
        finalName,
        finalDescription,
        finalCategoryId,
        finalPrice,
        finalWeight,
        finalStockQty,
        finalAllowsCustom,
        JSON.stringify(images || []),
        id
      ]
    );

    // Delete existing materials
    await client.query('DELETE FROM product_materials WHERE product_id = $1', [id]);

    // Add new materials if provided
    if (materials && Array.isArray(materials) && materials.length > 0) {
      for (const material of materials) {
        if (material.materialId && material.partName) {
          await client.query(
            `INSERT INTO product_materials (
              product_id, material_id, finish_id, part_name, quantity,
              unit_of_measure, extra_cost, notes, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
            [
              id,
              material.materialId,
              material.finishId || null,
              material.partName,
              material.quantity || null,
              material.unit || null,
              material.extraCost || 0,
              material.notes || null
            ]
          );
        }
      }
    }

    logger.info('Product updated successfully:', id);

    const updatedProduct = result.rows[0];
    res.json({
      success: true,
      product: {
        id: updatedProduct.id,
        sku: updatedProduct.sku,
        name: updatedProduct.name,
        description: updatedProduct.description,
        categoryId: updatedProduct.category_id,
        basePrice: updatedProduct.unit_price,
        stockQuantity: updatedProduct.quantity,
        weight: updatedProduct.weight,
        allowsCustomMaterials: updatedProduct.allows_custom_materials,
        isActive: updatedProduct.is_active,
        createdAt: updatedProduct.created_at,
        updatedAt: updatedProduct.updated_at
      },
      message: 'Product updated successfully'
    });
  } catch (error: any) {
    logger.error('Update product error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    await closeClient(client);
  }
});

// DELETE product
router.delete('/:id', async (req: Request, res: Response) => {
  let client;
  try {
    const { id } = req.params;

    client = await getDbConnection();

    // Delete product (materials will be cascade deleted)
    const result = await client.query(
      'DELETE FROM products WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    logger.info('Product deleted successfully:', id);

    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error: any) {
    logger.error('Delete product error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    await closeClient(client);
  }
});

// GET product by ID with materials
router.get('/:id', async (req: Request, res: Response) => {
  let client;
  try {
    const { id } = req.params;

    client = await getDbConnection();

    // Get product
    const productResult = await client.query(
      `SELECT p.*, p.unit_price as base_price, p.quantity as stock_quantity,
              c.name as category_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.id = $1`,
      [id]
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const product = productResult.rows[0];

    // Get materials for this product
    const materialsResult = await client.query(
      `SELECT pm.*, m.name as material_name, f.name as finish_name
       FROM product_materials pm
       LEFT JOIN materials m ON pm.material_id = m.id
       LEFT JOIN finishes f ON pm.finish_id = f.id
       WHERE pm.product_id = $1
       ORDER BY pm.position, pm.part_name`,
      [id]
    );

    product.materials = materialsResult.rows.map(m => ({
      id: m.id,
      partName: m.part_name,
      materialId: m.material_id,
      materialName: m.material_name,
      finishId: m.finish_id,
      finishName: m.finish_name,
      quantity: m.quantity,
      unit: m.unit_of_measure,
      extraCost: m.extra_cost,
      notes: m.notes
    }));

    // Map to frontend expected format
    const formattedProduct = {
      id: product.id,
      name: product.name,
      sku: product.sku,
      description: product.description,
      categoryId: product.category_id,
      categoryName: product.category_name,
      basePrice: product.base_price,
      stockQuantity: product.stock_quantity,
      dimensions: product.dimensions,
      weight: product.weight,
      leadTime: product.lead_time,
      allowsCustomMaterials: product.allows_custom_materials,
      materials: product.materials,
      isActive: product.is_active,
      createdAt: product.created_at,
      updatedAt: product.updated_at
    };

    res.json({
      success: true,
      product: formattedProduct
    });
  } catch (error: any) {
    logger.error('Get product error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    await closeClient(client);
  }
});

// UPLOAD product image
router.post('/:id/upload-image', upload.single('image'), async (req: Request, res: Response) => {
  let client;
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    client = await getDbConnection();

    // Check if product exists
    const productCheck = await client.query(
      'SELECT id FROM products WHERE id = $1',
      [id]
    );

    if (productCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Generate unique filename
    const filename = generateUniqueFilename(req.file.originalname);
    const objectName = `products/${id}/${filename}`;

    // Upload to MinIO
    await minioClient.putObject(
      bucketName,
      objectName,
      req.file.buffer,
      req.file.size,
      {
        'Content-Type': req.file.mimetype,
      }
    );

    // Get public URL for the image
    const imageUrl = `http://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT}/${bucketName}/${objectName}`;

    // Check if there are existing images
    const existingProduct = await client.query(
      'SELECT images FROM products WHERE id = $1',
      [id]
    );

    const currentImages = existingProduct.rows[0]?.images || [];
    const isMainImage = currentImages.length === 0;

    // Create image object
    const imageObject = {
      url: imageUrl,
      filename: filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      isMain: isMainImage,
      uploadedAt: new Date().toISOString(),
    };

    // Update product with new image
    const updatedImages = [...currentImages, imageObject];

    await client.query(
      'UPDATE products SET images = $1, updated_at = NOW() WHERE id = $2',
      [JSON.stringify(updatedImages), id]
    );

    res.json({
      success: true,
      image: imageObject,
      message: 'Image uploaded successfully',
    });
  } catch (error: any) {
    logger.error('Upload image error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  } finally {
    await closeClient(client);
  }
});

// DELETE product image
router.delete('/:id/images/:filename', async (req: Request, res: Response) => {
  let client;
  try {
    const { id, filename } = req.params;

    client = await getDbConnection();

    // Get current images
    const result = await client.query(
      'SELECT images FROM products WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const currentImages = result.rows[0].images || [];
    const imageToDelete = currentImages.find((img: any) => img.filename === filename);

    if (!imageToDelete) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Delete from MinIO
    const objectName = `products/${id}/${filename}`;
    await minioClient.removeObject(bucketName, objectName);

    // Remove from database
    const updatedImages = currentImages.filter((img: any) => img.filename !== filename);

    // If we deleted the main image and there are other images, set the first one as main
    if (imageToDelete.isMain && updatedImages.length > 0) {
      updatedImages[0].isMain = true;
    }

    await client.query(
      'UPDATE products SET images = $1, updated_at = NOW() WHERE id = $2',
      [JSON.stringify(updatedImages), id]
    );

    res.json({
      success: true,
      message: 'Image deleted successfully',
    });
  } catch (error: any) {
    logger.error('Delete image error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  } finally {
    await closeClient(client);
  }
});

// SET main product image
router.patch('/:id/images/:filename/set-main', async (req: Request, res: Response) => {
  let client;
  try {
    const { id, filename } = req.params;

    client = await getDbConnection();

    // Get current images
    const result = await client.query(
      'SELECT images FROM products WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const currentImages = result.rows[0].images || [];

    // Set all images to not main, and set the selected one as main
    const updatedImages = currentImages.map((img: any) => ({
      ...img,
      isMain: img.filename === filename,
    }));

    await client.query(
      'UPDATE products SET images = $1, updated_at = NOW() WHERE id = $2',
      [JSON.stringify(updatedImages), id]
    );

    res.json({
      success: true,
      message: 'Main image updated successfully',
    });
  } catch (error: any) {
    logger.error('Set main image error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  } finally {
    await closeClient(client);
  }
});

export default router;
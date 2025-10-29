import { Router, Request, Response } from 'express';
import { Client } from 'pg';
import { logger } from '../utils/logger';
import { authenticateToken, authorizeRole } from '../middleware/auth';

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
      logger.debug('Client close error (ignored):', error);
    }
  }
}

// GET all stock items (products + materials combined)
router.get('/stock', async (req: Request, res: Response) => {
  let client;
  try {
    const { search, category, status } = req.query;

    client = await getDbConnection();

    // Get products stock
    let productsQuery = `
      SELECT
        p.id,
        'product' as type,
        p.name,
        p.sku as code,
        CAST(p.stock_quantity as DOUBLE PRECISION) as current_stock,
        CAST(COALESCE(p.min_stock_level, 0) as DOUBLE PRECISION) as min_stock,
        CAST(COALESCE(p.max_stock_level, 0) as DOUBLE PRECISION) as max_stock,
        'pièce' as unit,
        CAST(p.unit_price as DOUBLE PRECISION) as value_per_unit,
        CAST((p.stock_quantity * p.unit_price) as DOUBLE PRECISION) as total_value,
        p.updated_at as last_movement,
        c.name as category,
        NULL as supplier,
        NULL as location,
        CASE
          WHEN p.min_stock_level > 0 AND p.stock_quantity <= p.min_stock_level THEN 'low'
          WHEN p.max_stock_level > 0 AND p.stock_quantity > p.max_stock_level THEN 'overstocked'
          ELSE 'normal'
        END as status
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = true
    `;

    // Get materials stock (if materials table exists with proper schema)
    let materialsQuery = `
      SELECT
        m.id,
        'material' as type,
        m.name,
        m.code,
        CAST(m.stock_quantity as DOUBLE PRECISION) as current_stock,
        CAST(COALESCE(m.min_stock_level, 10) as DOUBLE PRECISION) as min_stock,
        CAST(500 as DOUBLE PRECISION) as max_stock,
        m.unit_of_measure as unit,
        CAST(COALESCE(m.cost_per_unit, 0) as DOUBLE PRECISION) as value_per_unit,
        CAST((m.stock_quantity * COALESCE(m.cost_per_unit, 0)) as DOUBLE PRECISION) as total_value,
        m.updated_at as last_movement,
        m.type as category,
        m.supplier,
        NULL as location,
        CASE
          WHEN m.stock_quantity <= m.min_stock_level THEN 'low'
          WHEN m.stock_quantity > 500 THEN 'overstocked'
          ELSE 'normal'
        END as status
      FROM materials m
      WHERE m.is_active = true
    `;

    // Combine products and materials
    const combinedQuery = `
      WITH combined_stock AS (
        ${productsQuery}
        UNION ALL
        ${materialsQuery}
      )
      SELECT * FROM combined_stock
      ORDER BY status DESC, name ASC
    `;

    const result = await client.query(combinedQuery);

    // Apply filters
    let filteredItems = result.rows;

    if (search) {
      const searchLower = (search as string).toLowerCase();
      filteredItems = filteredItems.filter(item =>
        item.name.toLowerCase().includes(searchLower) ||
        item.code.toLowerCase().includes(searchLower)
      );
    }

    if (category && category !== 'all') {
      filteredItems = filteredItems.filter(item => item.category === category);
    }

    if (status && status !== 'all') {
      filteredItems = filteredItems.filter(item => item.status === status);
    }

    res.json({
      success: true,
      items: filteredItems,
      total: filteredItems.length
    });
  } catch (error: any) {
    logger.error('Get stock error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    await closeClient(client);
  }
});

// GET stock movements history
router.get('/movements', async (req: Request, res: Response) => {
  let client;
  try {
    const { limit = 50 } = req.query;

    client = await getDbConnection();

    const query = `
      SELECT
        im.id,
        COALESCE(im.product_id, im.material_id) as item_id,
        CASE
          WHEN im.product_id IS NOT NULL THEN p.name
          WHEN im.material_id IS NOT NULL THEN m.name
        END as item_name,
        im.movement_type as type,
        im.quantity,
        im.quantity_before as before_stock,
        im.quantity_after as after_stock,
        COALESCE(im.reason, 'Non spécifié') as reason,
        im.reference_number as reference,
        COALESCE(CONCAT(u.first_name, ' ', u.last_name), 'Système') as user,
        im.created_at as date,
        im.notes
      FROM inventory_movements im
      LEFT JOIN products p ON im.product_id = p.id
      LEFT JOIN materials m ON im.material_id = m.id
      LEFT JOIN users u ON im.created_by = u.id
      ORDER BY im.created_at DESC
      LIMIT $1
    `;

    const result = await client.query(query, [limit]);

    res.json({
      success: true,
      movements: result.rows
    });
  } catch (error: any) {
    logger.error('Get movements error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    await closeClient(client);
  }
});

// POST stock adjustment (admin and inventory_manager)
router.post('/movements', authenticateToken, authorizeRole('admin', 'inventory_manager'), async (req: Request, res: Response) => {
  let client;
  try {
    const { item_id, item_type, adjustment_type, quantity, reason, notes } = req.body;

    if (!item_id || !item_type || !adjustment_type || !quantity || !reason) {
      return res.status(400).json({
        error: 'Missing required fields: item_id, item_type, adjustment_type, quantity, reason'
      });
    }

    client = await getDbConnection();

    // Start transaction
    await client.query('BEGIN');

    // Get current stock
    let currentStock = 0;
    if (item_type === 'product') {
      const result = await client.query(
        'SELECT stock_quantity FROM products WHERE id = $1',
        [item_id]
      );
      if (result.rows.length === 0) {
        throw new Error('Product not found');
      }
      currentStock = parseFloat(result.rows[0].stock_quantity) || 0;
    } else if (item_type === 'material') {
      const result = await client.query(
        'SELECT stock_quantity FROM materials WHERE id = $1',
        [item_id]
      );
      if (result.rows.length === 0) {
        throw new Error('Material not found');
      }
      currentStock = parseFloat(result.rows[0].stock_quantity) || 0;
    }

    // Calculate new stock
    let newStock = currentStock;
    let adjustmentQty = parseFloat(quantity);

    switch (adjustment_type) {
      case 'add':
        newStock = currentStock + adjustmentQty;
        break;
      case 'remove':
        newStock = currentStock - adjustmentQty;
        adjustmentQty = -adjustmentQty; // Make negative for movement record
        break;
      case 'set':
        newStock = adjustmentQty;
        adjustmentQty = adjustmentQty - currentStock; // Difference
        break;
    }

    // Prevent negative stock
    if (newStock < 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Stock cannot be negative' });
    }

    // Update stock in respective table
    if (item_type === 'product') {
      await client.query(
        'UPDATE products SET stock_quantity = $1, updated_at = NOW() WHERE id = $2',
        [newStock, item_id]
      );
    } else if (item_type === 'material') {
      await client.query(
        'UPDATE materials SET stock_quantity = $1, updated_at = NOW() WHERE id = $2',
        [newStock, item_id]
      );
    }

    // Map movement type to database values
    let movementType = 'adjustment';
    if (adjustmentQty > 0) movementType = 'in';
    else if (adjustmentQty < 0) movementType = 'out';

    // Record movement
    const movementResult = await client.query(
      `INSERT INTO inventory_movements (
        ${item_type === 'product' ? 'product_id' : 'material_id'},
        movement_type, quantity, quantity_before, quantity_after,
        reason, notes, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING id`,
      [
        item_id,
        movementType,
        adjustmentQty,  // Keep the sign: positive for 'in', negative for 'out'
        currentStock,
        newStock,
        reason,
        notes || null
      ]
    );

    // Commit transaction
    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Stock adjusted successfully',
      movement_id: movementResult.rows[0].id,
      old_stock: currentStock,
      new_stock: newStock
    });
  } catch (error: any) {
    if (client) {
      await client.query('ROLLBACK');
    }
    logger.error('Stock adjustment error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    await closeClient(client);
  }
});

// GET stock alerts
router.get('/alerts', async (req: Request, res: Response) => {
  let client;
  try {
    client = await getDbConnection();

    const query = `
      WITH stock_alerts AS (
        -- Low product stock
        SELECT
          p.id as item_id,
          p.name as item_name,
          'low' as type,
          'Stock faible: ' || p.stock_quantity || ' pièces restantes (min: ' || COALESCE(p.min_stock_level, 0) || ')' as message,
          p.updated_at as created_at,
          false as resolved
        FROM products p
        WHERE p.is_active = true
          AND p.min_stock_level > 0
          AND p.stock_quantity <= p.min_stock_level

        UNION ALL

        -- Low material stock
        SELECT
          m.id as item_id,
          m.name as item_name,
          'low' as type,
          'Stock faible: ' || m.stock_quantity || ' ' || m.unit_of_measure || ' restants (min: ' || m.min_stock_level || ')' as message,
          m.updated_at as created_at,
          false as resolved
        FROM materials m
        WHERE m.is_active = true
          AND m.stock_quantity <= m.min_stock_level

        UNION ALL

        -- Overstocked products
        SELECT
          p.id as item_id,
          p.name as item_name,
          'overstock' as type,
          'Surstock: ' || p.stock_quantity || ' pièces en stock (max recommandé: ' || COALESCE(p.max_stock_level, 0) || ')' as message,
          p.updated_at as created_at,
          false as resolved
        FROM products p
        WHERE p.is_active = true
          AND p.max_stock_level > 0
          AND p.stock_quantity > p.max_stock_level

        UNION ALL

        -- Overstocked materials
        SELECT
          m.id as item_id,
          m.name as item_name,
          'overstock' as type,
          'Surstock: ' || m.stock_quantity || ' ' || m.unit_of_measure || ' en stock (max recommandé: 500)' as message,
          m.updated_at as created_at,
          false as resolved
        FROM materials m
        WHERE m.is_active = true
          AND m.stock_quantity > 500
      )
      SELECT
        gen_random_uuid() as id,
        item_id,
        item_name,
        type,
        message,
        created_at,
        resolved
      FROM stock_alerts
      ORDER BY
        CASE type
          WHEN 'low' THEN 1
          WHEN 'overstock' THEN 2
          ELSE 3
        END,
        created_at DESC
    `;

    const result = await client.query(query);

    res.json({
      success: true,
      alerts: result.rows
    });
  } catch (error: any) {
    logger.error('Get alerts error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    await closeClient(client);
  }
});

// GET stock statistics
router.get('/stats', async (req: Request, res: Response) => {
  let client;
  try {
    client = await getDbConnection();

    const query = `
      SELECT
        (SELECT COUNT(*) FROM products WHERE is_active = true) as total_products,
        (SELECT COUNT(*) FROM materials WHERE is_active = true) as total_materials,
        (SELECT COUNT(*) FROM products WHERE is_active = true AND min_stock_level > 0 AND stock_quantity <= min_stock_level) as low_products,
        (SELECT COUNT(*) FROM materials WHERE is_active = true AND stock_quantity <= min_stock_level) as low_materials,
        (SELECT COALESCE(SUM(stock_quantity * unit_price), 0) FROM products WHERE is_active = true) as products_value,
        (SELECT COALESCE(SUM(stock_quantity * cost_per_unit), 0) FROM materials WHERE is_active = true) as materials_value,
        (SELECT COUNT(*) FROM inventory_movements WHERE DATE(created_at) = CURRENT_DATE) as today_movements
    `;

    const result = await client.query(query);
    const stats = result.rows[0];

    res.json({
      success: true,
      stats: {
        total_items: parseInt(stats.total_products) + parseInt(stats.total_materials),
        total_products: parseInt(stats.total_products),
        total_materials: parseInt(stats.total_materials),
        critical_alerts: parseInt(stats.low_products) + parseInt(stats.low_materials),
        total_value: parseFloat(stats.products_value) + parseFloat(stats.materials_value),
        products_value: parseFloat(stats.products_value),
        materials_value: parseFloat(stats.materials_value),
        today_movements: parseInt(stats.today_movements)
      }
    });
  } catch (error: any) {
    logger.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    await closeClient(client);
  }
});

export default router;

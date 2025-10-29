import { Router, Request, Response } from 'express';
import { db } from '../database/connection';
import { logger } from '../utils/logger';
import { redisClient } from '../database/redis';
import { authenticateToken, authorizeRole } from '../middleware/auth';
import { body, validationResult, query } from 'express-validator';

const router = Router();

// Cache keys
const CACHE_KEYS = {
  ALL_ORDERS: 'sales_orders:all',
  ORDER_PREFIX: 'sales_order:',
};

// Clear cache helper
const clearOrderCache = async () => {
  try {
    const keys = await redisClient.keys('sales_orders:*');
    const orderKeys = await redisClient.keys('sales_order:*');
    if (keys.length > 0) await redisClient.del(...keys);
    if (orderKeys.length > 0) await redisClient.del(...orderKeys);
  } catch (error) {
    logger.error('Error clearing sales order cache:', error);
  }
};

// GET all sales orders with pagination and filters
router.get('/', authenticateToken, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['en_cours', 'en_preparation', 'expedie', 'livre', 'termine', 'annule']),
  query('contact_id').optional().isUUID(),
  query('search').optional().isString(),
  query('from_date').optional().isISO8601(),
  query('to_date').optional().isISO8601(),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const status = req.query.status as string;
    const contact_id = req.query.contact_id as string;
    const search = req.query.search as string;
    const from_date = req.query.from_date as string;
    const to_date = req.query.to_date as string;

    // Build query
    let queryStr = `
      SELECT
        so.*,
        c.first_name || ' ' || c.last_name as contact_name,
        c.company_name,
        c.email as contact_email,
        c.phone as contact_phone,
        q.quotation_number,
        i.invoice_number,
        COUNT(DISTINCT soi.id) as items_count
      FROM sales_orders so
      LEFT JOIN contacts c ON so.contact_id = c.id
      LEFT JOIN quotations q ON so.quotation_id = q.id
      LEFT JOIN invoices i ON so.invoice_id = i.id
      LEFT JOIN sales_order_items soi ON so.id = soi.sales_order_id
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      queryStr += ` AND so.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (contact_id) {
      queryStr += ` AND so.contact_id = $${paramIndex}`;
      params.push(contact_id);
      paramIndex++;
    }

    if (search) {
      queryStr += ` AND (
        so.order_number ILIKE $${paramIndex} OR
        so.notes ILIKE $${paramIndex} OR
        c.first_name ILIKE $${paramIndex} OR
        c.last_name ILIKE $${paramIndex} OR
        c.company_name ILIKE $${paramIndex}
      )`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (from_date) {
      queryStr += ` AND so.order_date >= $${paramIndex}`;
      params.push(from_date);
      paramIndex++;
    }

    if (to_date) {
      queryStr += ` AND so.order_date <= $${paramIndex}`;
      params.push(to_date);
      paramIndex++;
    }

    queryStr += ` GROUP BY so.id, c.id, q.id, i.id ORDER BY so.created_at DESC`;

    // Get total count
    const countQuery = `
      SELECT COUNT(DISTINCT so.id) as total
      FROM sales_orders so
      LEFT JOIN contacts c ON so.contact_id = c.id
      WHERE 1=1
    ` + queryStr.split('WHERE 1=1')[1].split('GROUP BY')[0];

    const countResult = await db.query(countQuery, params);
    const total = parseInt(countResult.rows[0]?.total || '0');

    // Add pagination
    queryStr += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    // Check cache
    const cacheKey = `sales_orders:${JSON.stringify({ page, limit, status, contact_id, search, from_date, to_date })}`;
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    const result = await db.query(queryStr, params);

    const response = {
      sales_orders: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };

    // Cache for 5 minutes
    await redisClient.setex(cacheKey, 300, JSON.stringify(response));

    res.json(response);
  } catch (error) {
    logger.error('Error fetching sales orders:', error);
    res.status(500).json({ error: 'Failed to fetch sales orders' });
  }
});

// GET single sales order by ID
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check cache
    const cacheKey = `${CACHE_KEYS.ORDER_PREFIX}${id}`;
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    const query = `
      SELECT
        so.*,
        c.first_name || ' ' || c.last_name as contact_name,
        c.company_name,
        c.email as contact_email,
        c.phone as contact_phone,
        c.address_street as contact_address,
        c.address_city as contact_city,
        c.address_zip as contact_postal_code,
        c.address_country as contact_country,
        q.quotation_number,
        u.first_name || ' ' || u.last_name as created_by,
        u.email as created_by_email,
        i.invoice_number,
        json_agg(
          jsonb_build_object(
            'id', soi.id,
            'product_id', soi.product_id,
            'product_name', soi.product_name,
            'product_sku', soi.product_sku,
            'description', soi.description,
            'quantity', soi.quantity,
            'unit_price', soi.unit_price,
            'discount_percent', soi.discount_percent,
            'discount_amount', soi.discount_amount,
            'tax_rate', soi.tax_rate,
            'tax_amount', soi.tax_amount,
            'line_total', soi.line_total
          ) ORDER BY soi.created_at
        ) FILTER (WHERE soi.id IS NOT NULL) as items
      FROM sales_orders so
      LEFT JOIN contacts c ON so.contact_id = c.id
      LEFT JOIN quotations q ON so.quotation_id = q.id
      LEFT JOIN users u ON q.sales_rep_id = u.id
      LEFT JOIN invoices i ON so.invoice_id = i.id
      LEFT JOIN sales_order_items soi ON so.id = soi.sales_order_id
      WHERE so.id = $1
      GROUP BY so.id, c.id, q.id, u.id, i.id
    `;

    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Sales order not found' });
    }

    // Cache for 10 minutes
    await redisClient.setex(cacheKey, 600, JSON.stringify(result.rows[0]));

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error fetching sales order:', error);
    res.status(500).json({ error: 'Failed to fetch sales order' });
  }
});

// CREATE sales order from quotation
router.post('/', authenticateToken, [
  body('quotation_id').notEmpty().isUUID().withMessage('Valid quotation ID is required'),
  body('expected_delivery_date').optional().isISO8601(),
  body('delivery_address').optional().isString(),
  body('notes').optional().isString(),
  body('down_payment_amount').optional().isNumeric().withMessage('Down payment must be a number'),
  body('down_payment_method').optional().isIn(['especes', 'carte', 'virement', 'cheque']).withMessage('Invalid payment method'),
  body('down_payment_date').optional().isISO8601(),
  body('down_payment_notes').optional().isString(),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      quotation_id,
      expected_delivery_date,
      delivery_address,
      notes,
      down_payment_amount,
      down_payment_method,
      down_payment_date,
      down_payment_notes,
    } = req.body;

    const result = await db.transaction(async (client) => {
      // Get quotation details
      const quotationResult = await client.query(`
        SELECT q.*, c.id as contact_id
        FROM quotations q
        LEFT JOIN contacts c ON q.contact_id = c.id
        WHERE q.id = $1
      `, [quotation_id]);

      if (quotationResult.rows.length === 0) {
        throw new Error('Quotation not found');
      }

      const quotation = quotationResult.rows[0];

      // Check if quotation is accepted
      if (quotation.status !== 'accepted') {
        throw new Error('Only accepted quotations can be converted to sales orders');
      }

      // Check if quotation already has a sales order
      if (quotation.sales_order_id) {
        throw new Error('This quotation has already been converted to a sales order');
      }

      // Get quotation line items
      const linesResult = await client.query(`
        SELECT * FROM quotation_lines
        WHERE quotation_id = $1
        ORDER BY line_number
      `, [quotation_id]);

      // Check stock availability for all products
      const stockIssues: string[] = [];
      for (const line of linesResult.rows) {
        if (line.product_id) {
          const stockResult = await client.query(
            'SELECT stock_quantity FROM products WHERE id = $1',
            [line.product_id]
          );

          if (stockResult.rows.length > 0) {
            const availableStock = stockResult.rows[0].stock_quantity;
            if (availableStock < line.quantity) {
              stockIssues.push(`${line.product_name}: ${availableStock} available, ${line.quantity} needed`);
            }
          }
        }
      }

      if (stockIssues.length > 0) {
        throw new Error(`Insufficient stock: ${stockIssues.join('; ')}`);
      }

      // Insert sales order (order_number will be auto-generated by trigger)
      const orderResult = await client.query(
        `INSERT INTO sales_orders (
          quotation_id, contact_id, order_date, expected_delivery_date,
          status, subtotal, discount_amount, tax_amount,
          shipping_cost, installation_cost, total_amount,
          delivery_address, notes, payment_terms, delivery_terms,
          down_payment_amount, down_payment_method, down_payment_date, down_payment_notes
        ) VALUES ($1, $2, CURRENT_DATE, $3, 'en_cours', $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        RETURNING *`,
        [
          quotation_id,
          quotation.contact_id,
          expected_delivery_date || null,
          quotation.subtotal,
          quotation.discount_amount,
          quotation.tax_amount,
          quotation.shipping_cost || 0,
          quotation.installation_cost || 0,
          quotation.total_amount,
          delivery_address || quotation.delivery_address,
          notes || quotation.notes,
          quotation.payment_terms || '30 jours',
          quotation.delivery_terms || '2-4 semaines',
          down_payment_amount || 0,
          down_payment_method || null,
          down_payment_date || null,
          down_payment_notes || null,
        ]
      );

      const salesOrder = orderResult.rows[0];

      // Insert sales order items
      for (const line of linesResult.rows) {
        await client.query(
          `INSERT INTO sales_order_items (
            sales_order_id, product_id, product_name, product_sku,
            description, quantity, unit_price, discount_percent,
            discount_amount, tax_rate, tax_amount, line_total
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            salesOrder.id,
            line.product_id,
            line.product_name,
            line.product_sku,
            line.description,
            line.quantity,
            line.unit_price,
            line.discount_percent,
            line.discount_amount,
            line.tax_rate,
            line.tax_amount,
            line.line_total,
          ]
        );

        // Deduct stock for products and record movement
        if (line.product_id) {
          // Ensure quantity is a proper number (remove any formatting)
          const movementQuantity = typeof line.quantity === 'string'
            ? parseFloat(line.quantity.replace(/[^\d.-]/g, ''))
            : parseFloat(line.quantity);

          // Get current stock before update
          const stockBeforeResult = await client.query(
            'SELECT stock_quantity FROM products WHERE id = $1',
            [line.product_id]
          );
          const stockBefore = parseFloat(stockBeforeResult.rows[0]?.stock_quantity || 0);
          const stockAfter = stockBefore - movementQuantity;

          // Update stock
          await client.query(
            `UPDATE products
             SET stock_quantity = stock_quantity - $1
             WHERE id = $2`,
            [movementQuantity, line.product_id]
          );

          await client.query(
            `INSERT INTO inventory_movements (
              product_id, movement_type, quantity, quantity_before, quantity_after,
              reason, reference_number, notes, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
            [
              line.product_id,
              'out',
              -movementQuantity,  // Negative for outgoing movements
              stockBefore,
              stockAfter,
              'Sales Order',
              salesOrder.order_number,
              `Sortie pour commande ${salesOrder.order_number} - ${line.product_name}`,
            ]
          );
        }
      }

      // Update quotation with sales_order_id and conversion timestamp
      await client.query(
        `UPDATE quotations
         SET sales_order_id = $1, converted_to_order_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [salesOrder.id, quotation_id]
      );

      return salesOrder;
    });

    // Clear caches
    await clearOrderCache();
    await redisClient.del('quotations:*');
    await redisClient.del(`quotation:${quotation_id}`);

    res.status(201).json(result);
  } catch (error: any) {
    logger.error('Error creating sales order:', error);
    res.status(500).json({ error: error.message || 'Failed to create sales order' });
  }
});

// UPDATE sales order status
router.patch('/:id/status', authenticateToken, [
  body('status').isIn(['en_cours', 'en_preparation', 'expedie', 'livre', 'termine', 'annule']),
  body('shipped_date').optional().isISO8601(),
  body('delivered_date').optional().isISO8601(),
  body('tracking_number').optional().isString(),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { status, shipped_date, delivered_date, tracking_number } = req.body;

    const result = await db.transaction(async (client) => {
      // Get current order status
      const currentOrder = await client.query(
        'SELECT status FROM sales_orders WHERE id = $1',
        [id]
      );

      if (currentOrder.rows.length === 0) {
        throw new Error('Sales order not found');
      }

      const previousStatus = currentOrder.rows[0].status;

      // Update sales order
      const updateQuery = `
        UPDATE sales_orders
        SET status = $1,
            shipped_date = COALESCE($2, shipped_date),
            delivered_date = COALESCE($3, delivered_date),
            tracking_number = COALESCE($4, tracking_number),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $5
        RETURNING *
      `;

      const orderResult = await client.query(updateQuery, [
        status,
        shipped_date || null,
        delivered_date || null,
        tracking_number || null,
        id,
      ]);

      return orderResult.rows[0];
    });

    // Clear cache
    await clearOrderCache();
    await redisClient.del(`${CACHE_KEYS.ORDER_PREFIX}${id}`);

    res.json(result);
  } catch (error: any) {
    logger.error('Error updating sales order status:', error);
    res.status(500).json({ error: error.message || 'Failed to update sales order status' });
  }
});

// CANCEL sales order (restore stock)
router.post('/:id/cancel', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await db.transaction(async (client) => {
      // Get sales order
      const orderResult = await client.query(
        'SELECT * FROM sales_orders WHERE id = $1',
        [id]
      );

      if (orderResult.rows.length === 0) {
        throw new Error('Sales order not found');
      }

      const order = orderResult.rows[0];

      // Check if order can be cancelled
      if (order.status === 'annule') {
        throw new Error('Sales order is already cancelled');
      }

      if (order.status === 'termine') {
        throw new Error('Cannot cancel a completed order');
      }

      // Get order items
      const itemsResult = await client.query(
        'SELECT * FROM sales_order_items WHERE sales_order_id = $1',
        [id]
      );

      // Restore stock for all products and record movements
      for (const item of itemsResult.rows) {
        if (item.product_id) {
          // Ensure quantity is a proper number (remove any formatting)
          const movementQuantity = typeof item.quantity === 'string'
            ? parseFloat(item.quantity.replace(/[^\d.-]/g, ''))
            : parseFloat(item.quantity);

          // Get current stock before update
          const stockBeforeResult = await client.query(
            'SELECT stock_quantity FROM products WHERE id = $1',
            [item.product_id]
          );
          const stockBefore = parseFloat(stockBeforeResult.rows[0]?.stock_quantity || 0);
          const stockAfter = stockBefore + movementQuantity;

          // Restore stock
          await client.query(
            `UPDATE products
             SET stock_quantity = stock_quantity + $1
             WHERE id = $2`,
            [movementQuantity, item.product_id]
          );

          await client.query(
            `INSERT INTO inventory_movements (
              product_id, movement_type, quantity, quantity_before, quantity_after,
              reason, reference_number, notes, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
            [
              item.product_id,
              'in',
              movementQuantity,
              stockBefore,
              stockAfter,
              'Sales Order Cancelled',
              order.order_number,
              `Retour suite annulation commande ${order.order_number} - ${item.product_name}`,
            ]
          );
        }
      }

      // Update order status to cancelled
      const cancelResult = await client.query(
        `UPDATE sales_orders
         SET status = 'annule', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [id]
      );

      return cancelResult.rows[0];
    });

    // Clear cache
    await clearOrderCache();
    await redisClient.del(`${CACHE_KEYS.ORDER_PREFIX}${id}`);

    res.json(result);
  } catch (error: any) {
    logger.error('Error cancelling sales order:', error);
    res.status(500).json({ error: error.message || 'Failed to cancel sales order' });
  }
});

// DELETE sales order (admin only - should restore stock)
router.delete('/:id', authenticateToken, authorizeRole('admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await db.transaction(async (client) => {
      // Get order details first
      const orderResult = await client.query(
        'SELECT * FROM sales_orders WHERE id = $1',
        [id]
      );

      if (orderResult.rows.length === 0) {
        throw new Error('Sales order not found');
      }

      const order = orderResult.rows[0];

      // Get order items
      const itemsResult = await client.query(
        'SELECT * FROM sales_order_items WHERE sales_order_id = $1',
        [id]
      );

      // Restore stock and record movements
      for (const item of itemsResult.rows) {
        if (item.product_id) {
          // Ensure quantity is a proper number (remove any formatting)
          const movementQuantity = typeof item.quantity === 'string'
            ? parseFloat(item.quantity.replace(/[^\d.-]/g, ''))
            : parseFloat(item.quantity);

          // Get current stock before update
          const stockBeforeResult = await client.query(
            'SELECT stock_quantity FROM products WHERE id = $1',
            [item.product_id]
          );
          const stockBefore = parseFloat(stockBeforeResult.rows[0]?.stock_quantity || 0);
          const stockAfter = stockBefore + movementQuantity;

          // Restore stock
          await client.query(
            `UPDATE products
             SET stock_quantity = stock_quantity + $1
             WHERE id = $2`,
            [movementQuantity, item.product_id]
          );

          await client.query(
            `INSERT INTO inventory_movements (
              product_id, movement_type, quantity, quantity_before, quantity_after,
              reason, reference_number, notes, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
            [
              item.product_id,
              'in',
              movementQuantity,
              stockBefore,
              stockAfter,
              'Sales Order Deleted',
              order.order_number,
              `Retour suite suppression commande ${order.order_number} - ${item.product_name}`,
            ]
          );
        }
      }

      // Delete the order (items will cascade delete)
      await client.query(
        'DELETE FROM sales_orders WHERE id = $1',
        [id]
      );
    });

    // Clear cache
    await clearOrderCache();

    res.json({ message: 'Sales order deleted successfully' });
  } catch (error: any) {
    logger.error('Error deleting sales order:', error);
    res.status(500).json({ error: error.message || 'Failed to delete sales order' });
  }
});

// GET sales order statistics
router.get('/stats/overview', authenticateToken, async (req: Request, res: Response) => {
  try {
    const stats = await db.query(`
      SELECT
        COUNT(*) as total_orders,
        COUNT(CASE WHEN status = 'en_cours' THEN 1 END) as in_progress_count,
        COUNT(CASE WHEN status = 'en_preparation' THEN 1 END) as preparing_count,
        COUNT(CASE WHEN status = 'expedie' THEN 1 END) as shipped_count,
        COUNT(CASE WHEN status = 'livre' THEN 1 END) as delivered_count,
        COUNT(CASE WHEN status = 'termine' THEN 1 END) as completed_count,
        COUNT(CASE WHEN status = 'annule' THEN 1 END) as cancelled_count,
        SUM(CASE WHEN status != 'annule' THEN total_amount ELSE 0 END) as active_revenue,
        SUM(CASE WHEN status = 'termine' THEN total_amount ELSE 0 END) as completed_revenue,
        AVG(total_amount) as average_order_value
      FROM sales_orders
      WHERE order_date >= CURRENT_DATE - INTERVAL '30 days'
    `);

    res.json(stats.rows[0]);
  } catch (error) {
    logger.error('Error fetching sales order statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

export default router;

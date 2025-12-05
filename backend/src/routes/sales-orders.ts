import { Router, Request, Response } from 'express';
import { db } from '../database/connection';
import { logger } from '../utils/logger';
import { redisClient } from '../database/redis';
import { authenticateToken, authorizeRole } from '../middleware/auth';
import { body, validationResult, query } from 'express-validator';
import { uploadDocument, generateUniqueFilename } from '../middleware/upload';
import { minioClient } from '../config/minio';
import { notifyAllUsers } from './notifications';

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
    if (keys.length > 0) await redisClient.del(keys as any);
    if (orderKeys.length > 0) await redisClient.del(orderKeys as any);
  } catch (error) {
    logger.error('Error clearing sales order cache:', error);
  }
};

// GET all sales orders with pagination and filters
router.get('/', authenticateToken, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 10000 }),
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
        COALESCE(c.mobile, c.phone) as contact_phone,
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
        COALESCE(c.mobile, c.phone) as contact_phone,
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

      // Check stock availability for all products (warnings only, don't block order)
      const stockWarnings: string[] = [];
      for (const line of linesResult.rows) {
        if (line.product_id) {
          const stockResult = await client.query(
            'SELECT stock_quantity FROM products WHERE id = $1',
            [line.product_id]
          );

          if (stockResult.rows.length > 0) {
            const availableStock = parseFloat(stockResult.rows[0].stock_quantity) || 0;
            const requiredQuantity = parseFloat(line.quantity) || 0;
            if (availableStock < requiredQuantity) {
              stockWarnings.push(`${line.product_name}: ${availableStock} disponible(s), ${requiredQuantity} nécessaire(s)`);
            }
          }
        }

        // Check material stock for customized products
        if (line.is_customized) {
          const customComponentsResult = await client.query(
            `SELECT qlc.*, m.name as material_name, m.stock_quantity as material_stock, m.unit_of_measure
             FROM quotation_line_components qlc
             LEFT JOIN materials m ON qlc.material_id = m.id
             WHERE qlc.quotation_line_id = $1 AND qlc.material_id IS NOT NULL`,
            [line.id]
          );

          for (const component of customComponentsResult.rows) {
            const requiredQuantity = parseFloat(component.quantity) * parseFloat(line.quantity);
            const availableStock = parseFloat(component.material_stock || 0);

            if (availableStock < requiredQuantity) {
              stockWarnings.push(
                `Matériau "${component.material_name}" pour ${line.product_name}: ` +
                `${availableStock} ${component.unit_of_measure || 'unités'} disponible(s), ` +
                `${requiredQuantity} nécessaire(s)`
              );
            }
          }
        }
      }

      // Note: We continue with order creation even if stock is insufficient
      // Stock can go negative to track backorders

      // Build initial payments array if down payment is provided
      let initialPayments: any[] = [];
      if (down_payment_amount && parseFloat(down_payment_amount) > 0) {
        initialPayments = [{
          id: `payment_${Date.now()}`,
          amount: parseFloat(down_payment_amount),
          method: down_payment_method || 'especes',
          date: down_payment_date || new Date().toISOString().split('T')[0],
          notes: down_payment_notes || ''
        }];
      }

      // Insert sales order (order_number will be auto-generated by trigger)
      const orderResult = await client.query(
        `INSERT INTO sales_orders (
          quotation_id, contact_id, order_date, expected_delivery_date,
          status, subtotal, discount_amount, tax_amount,
          shipping_cost, installation_cost, total_amount,
          delivery_address, notes, payment_terms, delivery_terms,
          down_payment_amount, down_payment_method, down_payment_date, down_payment_notes,
          terms_conditions, payments
        ) VALUES ($1, $2, CURRENT_DATE, $3, 'en_cours', $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
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
          quotation.terms_conditions || null,
          JSON.stringify(initialPayments)
        ]
      );

      const salesOrder = orderResult.rows[0];

      // Insert sales order items (without customization columns that don't exist in production)
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
            line.line_total
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

        // Deduct material stock for customized products
        if (line.is_customized) {
          const customComponentsResult = await client.query(
            `SELECT qlc.*, m.name as material_name, m.unit_of_measure
             FROM quotation_line_components qlc
             LEFT JOIN materials m ON qlc.material_id = m.id
             WHERE qlc.quotation_line_id = $1 AND qlc.material_id IS NOT NULL`,
            [line.id]
          );

          for (const component of customComponentsResult.rows) {
            const materialQuantity = parseFloat(component.quantity) * parseFloat(line.quantity);

            // Get current material stock before update
            const materialStockBeforeResult = await client.query(
              'SELECT stock_quantity FROM materials WHERE id = $1',
              [component.material_id]
            );
            const materialStockBefore = parseFloat(materialStockBeforeResult.rows[0]?.stock_quantity || 0);
            const materialStockAfter = materialStockBefore - materialQuantity;

            // Update material stock
            await client.query(
              `UPDATE materials
               SET stock_quantity = stock_quantity - $1
               WHERE id = $2`,
              [materialQuantity, component.material_id]
            );

            // Create inventory movement for material
            await client.query(
              `INSERT INTO inventory_movements (
                material_id, movement_type, quantity, quantity_before, quantity_after,
                reason, reference_number, notes, created_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
              [
                component.material_id,
                'out',
                -materialQuantity,
                materialStockBefore,
                materialStockAfter,
                'Sales Order - Custom Product',
                salesOrder.order_number,
                `Sortie matériau "${component.material_name}" pour ${line.product_name} (${component.component_name}) - Commande ${salesOrder.order_number}`,
              ]
            );
          }
        }
      }

      // Update quotation with sales_order_id and conversion timestamp
      await client.query(
        `UPDATE quotations
         SET sales_order_id = $1, converted_to_order_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [salesOrder.id, quotation_id]
      );

      return { salesOrder, stockWarnings };
    });

    // Notify all users about the new sales order
    try {
      // JWT token stores name as a single field (see auth.ts line 23)
      const creatorName = (req as any).user?.name || 'Un utilisateur';

      await notifyAllUsers({
        type: 'sales_order_created',
        title: 'Nouvelle commande créée',
        message: `${creatorName} a créé la commande N°${result.salesOrder.order_number}`,
        relatedEntityType: 'sales_order',
        relatedEntityId: result.salesOrder.id,
        excludeUserId: (req as any).user?.id
      });
    } catch (notifError) {
      logger.error('Error sending notifications:', notifError);
      // Don't fail the request if notifications fail
    }

    // Clear caches
    await clearOrderCache();
    await redisClient.del('quotations:*');
    await redisClient.del(`quotation:${quotation_id}`);

    // Return the sales order with any stock warnings
    res.status(201).json({
      ...result.salesOrder,
      stockWarnings: result.stockWarnings
    });
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

        // Restore material stock for customized products
        if (order.quotation_id && item.product_id) {
          // Find the matching quotation line to check if it's customized
          const quotationLineResult = await client.query(
            `SELECT id, is_customized, product_id
             FROM quotation_lines
             WHERE quotation_id = $1 AND product_id = $2
             LIMIT 1`,
            [order.quotation_id, item.product_id]
          );

          if (quotationLineResult.rows.length > 0 && quotationLineResult.rows[0].is_customized) {
            // Get custom components with materials
            const customComponentsResult = await client.query(
              `SELECT qlc.*, m.name as material_name, m.unit_of_measure
               FROM quotation_line_components qlc
               LEFT JOIN materials m ON qlc.material_id = m.id
               WHERE qlc.quotation_line_id = $1 AND qlc.material_id IS NOT NULL`,
              [quotationLineResult.rows[0].id]
            );

            // Restore material stock for each component
            for (const component of customComponentsResult.rows) {
              const materialQuantity = parseFloat(component.quantity) * parseFloat(item.quantity);

              // Get current material stock before update
              const materialStockBeforeResult = await client.query(
                'SELECT stock_quantity FROM materials WHERE id = $1',
                [component.material_id]
              );
              const materialStockBefore = parseFloat(materialStockBeforeResult.rows[0]?.stock_quantity || 0);
              const materialStockAfter = materialStockBefore + materialQuantity;

              // Restore material stock
              await client.query(
                `UPDATE materials
                 SET stock_quantity = stock_quantity + $1
                 WHERE id = $2`,
                [materialQuantity, component.material_id]
              );

              // Create inventory movement for material restoration
              await client.query(
                `INSERT INTO inventory_movements (
                  material_id, movement_type, quantity, quantity_before, quantity_after,
                  reason, reference_number, notes, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
                [
                  component.material_id,
                  'in',
                  materialQuantity,
                  materialStockBefore,
                  materialStockAfter,
                  'Sales Order Cancelled',
                  order.order_number,
                  `Retour matériau "${component.material_name}" suite annulation commande ${order.order_number} - ${item.product_name} (${component.component_name})`,
                ]
              );
            }
          }
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

        // Restore material stock for customized products
        if (order.quotation_id && item.product_id) {
          // Find the matching quotation line to check if it's customized
          const quotationLineResult = await client.query(
            `SELECT id, is_customized, product_id
             FROM quotation_lines
             WHERE quotation_id = $1 AND product_id = $2
             LIMIT 1`,
            [order.quotation_id, item.product_id]
          );

          if (quotationLineResult.rows.length > 0 && quotationLineResult.rows[0].is_customized) {
            // Get custom components with materials
            const customComponentsResult = await client.query(
              `SELECT qlc.*, m.name as material_name, m.unit_of_measure
               FROM quotation_line_components qlc
               LEFT JOIN materials m ON qlc.material_id = m.id
               WHERE qlc.quotation_line_id = $1 AND qlc.material_id IS NOT NULL`,
              [quotationLineResult.rows[0].id]
            );

            // Restore material stock for each component
            for (const component of customComponentsResult.rows) {
              const materialQuantity = parseFloat(component.quantity) * parseFloat(item.quantity);

              // Get current material stock before update
              const materialStockBeforeResult = await client.query(
                'SELECT stock_quantity FROM materials WHERE id = $1',
                [component.material_id]
              );
              const materialStockBefore = parseFloat(materialStockBeforeResult.rows[0]?.stock_quantity || 0);
              const materialStockAfter = materialStockBefore + materialQuantity;

              // Restore material stock
              await client.query(
                `UPDATE materials
                 SET stock_quantity = stock_quantity + $1
                 WHERE id = $2`,
                [materialQuantity, component.material_id]
              );

              // Create inventory movement for material restoration
              await client.query(
                `INSERT INTO inventory_movements (
                  material_id, movement_type, quantity, quantity_before, quantity_after,
                  reason, reference_number, notes, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
                [
                  component.material_id,
                  'in',
                  materialQuantity,
                  materialStockBefore,
                  materialStockAfter,
                  'Sales Order Deleted',
                  order.order_number,
                  `Retour matériau "${component.material_name}" suite suppression commande ${order.order_number} - ${item.product_name} (${component.component_name})`,
                ]
              );
            }
          }
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

// ============================================================================
// PAYMENT MANAGEMENT ENDPOINTS
// ============================================================================

// ADD payment to sales order
router.post('/:id/payments', authenticateToken, [
  body('amount').isNumeric().withMessage('Amount must be a number'),
  body('amount').custom((value) => value > 0).withMessage('Amount must be positive'),
  body('method').isIn(['especes', 'carte', 'virement', 'cheque']).withMessage('Invalid payment method'),
  body('date').isISO8601().withMessage('Invalid date format'),
  body('notes').optional().isString()
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { amount, method, date, notes } = req.body;

    // Check if order exists and is not cancelled
    const orderCheck = await db.query(
      'SELECT id, status, total_amount, payments FROM sales_orders WHERE id = $1',
      [id]
    );

    if (orderCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Sales order not found' });
    }

    if (orderCheck.rows[0].status === 'annule') {
      return res.status(400).json({ error: 'Cannot add payment to cancelled order' });
    }

    // Create new payment object
    const newPayment = {
      id: require('crypto').randomUUID(),
      amount: parseFloat(amount),
      method,
      date,
      notes: notes || ''
    };

    // Add payment to array
    const currentPayments = orderCheck.rows[0].payments || [];
    const updatedPayments = [...currentPayments, newPayment];

    // Calculate total paid for backward compatibility
    const totalPaid = updatedPayments.reduce((sum: number, p: any) => sum + parseFloat(p.amount), 0);

    // Update order
    await db.query(
      `UPDATE sales_orders
       SET payments = $1::jsonb,
           down_payment_amount = $2,
           down_payment_method = $3,
           down_payment_date = $4,
           down_payment_notes = $5,
           updated_at = NOW()
       WHERE id = $6`,
      [
        JSON.stringify(updatedPayments),
        totalPaid,
        updatedPayments[0]?.method || null,
        updatedPayments[0]?.date || null,
        updatedPayments[0]?.notes || null,
        id
      ]
    );

    // Clear cache
    await clearOrderCache();

    // Return updated order
    const updatedOrder = await db.query('SELECT * FROM sales_orders WHERE id = $1', [id]);
    res.status(201).json(updatedOrder.rows[0]);
  } catch (error) {
    logger.error('Error adding payment:', error);
    res.status(500).json({ error: 'Failed to add payment' });
  }
});

// UPDATE payment in sales order
router.put('/:id/payments/:paymentId', authenticateToken, [
  body('amount').optional().isNumeric().withMessage('Amount must be a number'),
  body('method').optional().isIn(['especes', 'carte', 'virement', 'cheque']).withMessage('Invalid payment method'),
  body('date').optional().isISO8601().withMessage('Invalid date format'),
  body('notes').optional().isString()
], async (req: Request, res: Response) => {
  try {
    const { id, paymentId } = req.params;
    const { amount, method, date, notes } = req.body;

    // Get current order
    const orderCheck = await db.query(
      'SELECT id, status, payments FROM sales_orders WHERE id = $1',
      [id]
    );

    if (orderCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Sales order not found' });
    }

    if (orderCheck.rows[0].status === 'annule') {
      return res.status(400).json({ error: 'Cannot modify payment on cancelled order' });
    }

    const currentPayments = orderCheck.rows[0].payments || [];
    const paymentIndex = currentPayments.findIndex((p: any) => p.id === paymentId);

    if (paymentIndex === -1) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Update payment
    if (amount !== undefined) currentPayments[paymentIndex].amount = parseFloat(amount);
    if (method !== undefined) currentPayments[paymentIndex].method = method;
    if (date !== undefined) currentPayments[paymentIndex].date = date;
    if (notes !== undefined) currentPayments[paymentIndex].notes = notes;

    // Calculate total paid for backward compatibility
    const totalPaid = currentPayments.reduce((sum: number, p: any) => sum + parseFloat(p.amount), 0);

    // Update order
    await db.query(
      `UPDATE sales_orders
       SET payments = $1::jsonb,
           down_payment_amount = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [JSON.stringify(currentPayments), totalPaid, id]
    );

    // Clear cache
    await clearOrderCache();

    // Return updated order
    const updatedOrder = await db.query('SELECT * FROM sales_orders WHERE id = $1', [id]);
    res.json(updatedOrder.rows[0]);
  } catch (error) {
    logger.error('Error updating payment:', error);
    res.status(500).json({ error: 'Failed to update payment' });
  }
});

// DELETE payment from sales order
router.delete('/:id/payments/:paymentId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id, paymentId } = req.params;

    // Get current order
    const orderCheck = await db.query(
      'SELECT id, status, payments FROM sales_orders WHERE id = $1',
      [id]
    );

    if (orderCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Sales order not found' });
    }

    if (orderCheck.rows[0].status === 'annule') {
      return res.status(400).json({ error: 'Cannot delete payment from cancelled order' });
    }

    const currentPayments = orderCheck.rows[0].payments || [];
    const paymentIndex = currentPayments.findIndex((p: any) => p.id === paymentId);

    if (paymentIndex === -1) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Remove payment
    currentPayments.splice(paymentIndex, 1);

    // Calculate total paid for backward compatibility
    const totalPaid = currentPayments.reduce((sum: number, p: any) => sum + parseFloat(p.amount), 0);

    // Update order
    await db.query(
      `UPDATE sales_orders
       SET payments = $1::jsonb,
           down_payment_amount = $2,
           down_payment_method = CASE WHEN $3 = 0 THEN NULL ELSE down_payment_method END,
           down_payment_date = CASE WHEN $3 = 0 THEN NULL ELSE down_payment_date END,
           down_payment_notes = CASE WHEN $3 = 0 THEN NULL ELSE down_payment_notes END,
           updated_at = NOW()
       WHERE id = $4`,
      [JSON.stringify(currentPayments), totalPaid, currentPayments.length, id]
    );

    // Clear cache
    await clearOrderCache();

    // Return updated order
    const updatedOrder = await db.query('SELECT * FROM sales_orders WHERE id = $1', [id]);
    res.json(updatedOrder.rows[0]);
  } catch (error) {
    logger.error('Error deleting payment:', error);
    res.status(500).json({ error: 'Failed to delete payment' });
  }
});

// ============================================================================
// STATISTICS
// ============================================================================

// GET sales order statistics
router.get('/stats/overview', authenticateToken, async (req: Request, res: Response) => {
  try {
    // Calculate stats for all orders
    // CA Actif = total des commandes en cours (non terminées, non annulées)
    // CA Réalisé = total des factures payées + acomptes from orders without paid invoices
    const orderStats = await db.query(`
      SELECT
        COUNT(*) as total_orders,
        COUNT(CASE WHEN status = 'en_cours' THEN 1 END) as in_progress_count,
        COUNT(CASE WHEN status = 'en_preparation' THEN 1 END) as preparing_count,
        COUNT(CASE WHEN status = 'expedie' THEN 1 END) as shipped_count,
        COUNT(CASE WHEN status = 'livre' THEN 1 END) as delivered_count,
        COUNT(CASE WHEN status = 'termine' THEN 1 END) as completed_count,
        COUNT(CASE WHEN status = 'annule' THEN 1 END) as cancelled_count,
        COALESCE(SUM(CASE
          WHEN status NOT IN ('termine', 'annule') THEN total_amount
          ELSE 0
        END), 0) as active_revenue,
        COALESCE(SUM(CASE WHEN status = 'termine' THEN total_amount ELSE 0 END), 0) as completed_revenue,
        COALESCE(AVG(total_amount), 0) as average_order_value
      FROM sales_orders
    `);

    // Get CA Réalisé using the same logic as invoices stats endpoint
    // CA Réalisé = paid invoices total + acomptes from orders without paid invoices
    const paidInvoicesResult = await db.query(`
      SELECT COALESCE(SUM(CASE WHEN status = 'payee' THEN total_amount ELSE 0 END), 0) as paid_invoices_total
      FROM invoices
    `);

    const acomptesResult = await db.query(`
      SELECT
        COALESCE(SUM(CASE WHEN so.invoice_id IS NULL OR i.status != 'payee' THEN so.down_payment_amount ELSE 0 END), 0) as acomptes_not_in_paid_invoices
      FROM sales_orders so
      LEFT JOIN invoices i ON so.invoice_id = i.id
      WHERE so.status != 'annule'
        AND so.down_payment_amount > 0
    `);

    const paidInvoicesTotal = parseFloat(paidInvoicesResult.rows[0].paid_invoices_total || 0);
    const acomptesNotInPaidInvoices = parseFloat(acomptesResult.rows[0].acomptes_not_in_paid_invoices || 0);
    const realizedRevenue = paidInvoicesTotal + acomptesNotInPaidInvoices;

    res.json({
      ...orderStats.rows[0],
      realized_revenue: realizedRevenue,
      acomptes_received: acomptesNotInPaidInvoices
    });
  } catch (error) {
    logger.error('Error fetching sales order statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// ========== DOCUMENT MANAGEMENT ENDPOINTS ==========

// UPLOAD document for sales order
router.post('/:id/documents', authenticateToken, uploadDocument.single('file'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const file = req.file;
    const userId = (req as any).user?.id;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Generate unique filename
    const uniqueFilename = generateUniqueFilename(file.originalname);
    const filePath = `sales-orders/${id}/${uniqueFilename}`;

    // Upload to MinIO
    await minioClient.putObject(
      process.env.MINIO_BUCKET_NAME || 'myerp-uploads',
      filePath,
      file.buffer,
      file.size,
      {
        'Content-Type': file.mimetype,
        'Original-Filename': file.originalname
      }
    );

    // Save document metadata to database
    const result = await db.query(
      `INSERT INTO sales_order_documents
       (sales_order_id, file_name, original_file_name, file_path, file_size, mime_type, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [id, uniqueFilename, file.originalname, filePath, file.size, file.mimetype, userId]
    );

    logger.info(`Document uploaded for sales order ${id}: ${uniqueFilename}`);
    await clearOrderCache();

    res.status(201).json({
      message: 'Document uploaded successfully',
      document: result.rows[0]
    });
  } catch (error) {
    logger.error('Error uploading document:', error);
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

// GET all documents for a sales order
router.get('/:id/documents', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT d.*, u.email as uploaded_by_email
       FROM sales_order_documents d
       LEFT JOIN users u ON d.uploaded_by = u.id
       WHERE d.sales_order_id = $1
       ORDER BY d.created_at DESC`,
      [id]
    );

    res.json({ documents: result.rows });
  } catch (error) {
    logger.error('Error fetching documents:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// DOWNLOAD document
router.get('/:id/documents/:docId/download', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id, docId } = req.params;

    // Get document metadata
    const result = await db.query(
      'SELECT * FROM sales_order_documents WHERE id = $1 AND sales_order_id = $2',
      [docId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const document = result.rows[0];

    // Get file from MinIO
    const dataStream = await minioClient.getObject(
      process.env.MINIO_BUCKET_NAME || 'myerp-uploads',
      document.file_path
    );

    // Set headers for download
    res.setHeader('Content-Type', document.mime_type);
    res.setHeader('Content-Disposition', `attachment; filename="${document.original_file_name}"`);
    res.setHeader('Content-Length', document.file_size);

    // Pipe the stream to response
    dataStream.pipe(res);
  } catch (error) {
    logger.error('Error downloading document:', error);
    res.status(500).json({ error: 'Failed to download document' });
  }
});

// DELETE document
router.delete('/:id/documents/:docId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id, docId } = req.params;

    // Get document metadata
    const result = await db.query(
      'SELECT * FROM sales_order_documents WHERE id = $1 AND sales_order_id = $2',
      [docId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const document = result.rows[0];

    // Delete from MinIO
    await minioClient.removeObject(
      process.env.MINIO_BUCKET_NAME || 'myerp-uploads',
      document.file_path
    );

    // Delete from database
    await db.query('DELETE FROM sales_order_documents WHERE id = $1', [docId]);

    logger.info(`Document deleted: ${document.file_name}`);
    await clearOrderCache();

    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    logger.error('Error deleting document:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

export default router;

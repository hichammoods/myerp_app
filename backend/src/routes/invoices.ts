import { Router, Request, Response } from 'express';
import { db } from '../database/connection';
import { logger } from '../utils/logger';
import { redisClient } from '../database/redis';
import { authenticateToken, authorizeRole } from '../middleware/auth';
import { body, validationResult, query } from 'express-validator';
import { notifyAllUsers } from './notifications';

const router = Router();

// Cache keys
const CACHE_KEYS = {
  ALL_INVOICES: 'invoices:all',
  INVOICE_PREFIX: 'invoice:',
};

// Clear cache helper
const clearInvoiceCache = async () => {
  try {
    const keys = await redisClient.keys('invoices:*');
    const invoiceKeys = await redisClient.keys('invoice:*');
    if (keys.length > 0) await redisClient.del(keys as any);
    if (invoiceKeys.length > 0) await redisClient.del(invoiceKeys as any);
  } catch (error) {
    logger.error('Error clearing invoice cache:', error);
  }
};

// GET all invoices with pagination and filters
router.get('/', authenticateToken, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 10000 }),
  query('status').optional().isIn(['brouillon', 'envoyee', 'payee', 'en_retard', 'annulee']),
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
        i.*,
        c.first_name || ' ' || c.last_name as contact_name,
        c.company_name,
        c.email as contact_email,
        COALESCE(c.mobile, c.phone) as contact_phone,
        so.order_number,
        q.quotation_number,
        COUNT(DISTINCT ii.id) as items_count
      FROM invoices i
      LEFT JOIN contacts c ON i.contact_id = c.id
      LEFT JOIN sales_orders so ON i.sales_order_id = so.id
      LEFT JOIN quotations q ON i.quotation_id = q.id
      LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      queryStr += ` AND i.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (contact_id) {
      queryStr += ` AND i.contact_id = $${paramIndex}`;
      params.push(contact_id);
      paramIndex++;
    }

    if (search) {
      queryStr += ` AND (
        i.invoice_number ILIKE $${paramIndex} OR
        i.notes ILIKE $${paramIndex} OR
        c.first_name ILIKE $${paramIndex} OR
        c.last_name ILIKE $${paramIndex} OR
        c.company_name ILIKE $${paramIndex}
      )`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (from_date) {
      queryStr += ` AND i.invoice_date >= $${paramIndex}`;
      params.push(from_date);
      paramIndex++;
    }

    if (to_date) {
      queryStr += ` AND i.invoice_date <= $${paramIndex}`;
      params.push(to_date);
      paramIndex++;
    }

    queryStr += ` GROUP BY i.id, c.id, so.id, q.id ORDER BY i.created_at DESC`;

    // Get total count
    const countQuery = `
      SELECT COUNT(DISTINCT i.id) as total
      FROM invoices i
      LEFT JOIN contacts c ON i.contact_id = c.id
      WHERE 1=1
    ` + queryStr.split('WHERE 1=1')[1].split('GROUP BY')[0];

    const countResult = await db.query(countQuery, params);
    const total = parseInt(countResult.rows[0]?.total || '0');

    // Add pagination
    queryStr += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    // Check cache
    const cacheKey = `invoices:${JSON.stringify({ page, limit, status, contact_id, search, from_date, to_date })}`;
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    const result = await db.query(queryStr, params);

    const response = {
      invoices: result.rows,
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
    logger.error('Error fetching invoices:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

// GET single invoice by ID
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check cache
    const cacheKey = `${CACHE_KEYS.INVOICE_PREFIX}${id}`;
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    // First get the invoice basic info
    const invoiceQuery = `
      SELECT
        i.*,
        c.first_name || ' ' || c.last_name as contact_name,
        c.company_name,
        c.email as contact_email,
        COALESCE(c.mobile, c.phone) as contact_phone,
        c.address_street as contact_address,
        c.address_city as contact_city,
        c.address_zip as contact_postal_code,
        c.address_country as contact_country,
        so.order_number,
        so.down_payment_method,
        so.down_payment_date,
        so.down_payment_notes,
        q.quotation_number
      FROM invoices i
      LEFT JOIN contacts c ON i.contact_id = c.id
      LEFT JOIN sales_orders so ON i.sales_order_id = so.id
      LEFT JOIN quotations q ON i.quotation_id = q.id
      WHERE i.id = $1
    `;

    const invoiceResult = await db.query(invoiceQuery, [id]);

    if (invoiceResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const invoice = invoiceResult.rows[0];

    // Get payments from sales order if exists
    let payments = [];
    if (invoice.sales_order_id) {
      try {
        const paymentsQuery = `SELECT payments FROM sales_orders WHERE id = $1`;
        const paymentsResult = await db.query(paymentsQuery, [invoice.sales_order_id]);
        if (paymentsResult.rows.length > 0 && paymentsResult.rows[0].payments) {
          payments = paymentsResult.rows[0].payments;
        }
      } catch (err) {
        logger.debug('Could not fetch payments:', err);
      }
    }

    // Get invoice items separately - only select columns that exist in production
    const itemsQuery = `
      SELECT
        ii.id,
        ii.product_id,
        ii.product_name,
        ii.product_sku,
        ii.description,
        ii.quantity,
        ii.unit_price,
        ii.discount_percent,
        ii.discount_amount,
        ii.tax_rate,
        ii.tax_amount,
        ii.line_total
      FROM invoice_items ii
      WHERE ii.invoice_id = $1
      ORDER BY ii.created_at
    `;

    const itemsResult = await db.query(itemsQuery, [id]);

    const result = {
      ...invoice,
      payments,
      items: itemsResult.rows
    };

    // Cache for 10 minutes
    await redisClient.setex(cacheKey, 600, JSON.stringify(result));

    res.json(result);
  } catch (error) {
    logger.error('Error fetching invoice:', error);
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
});

// CREATE invoice from sales order
router.post('/', authenticateToken, [
  body('sales_order_id').notEmpty().isUUID().withMessage('Valid sales order ID is required'),
  body('due_date').optional().isISO8601(),
  body('payment_terms').optional().isString(),
  body('notes').optional().isString(),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      sales_order_id,
      due_date,
      payment_terms,
      notes,
    } = req.body;

    const result = await db.transaction(async (client) => {
      // Get sales order details
      const orderResult = await client.query(`
        SELECT so.*, q.id as quotation_id
        FROM sales_orders so
        LEFT JOIN quotations q ON so.quotation_id = q.id
        WHERE so.id = $1
      `, [sales_order_id]);

      if (orderResult.rows.length === 0) {
        throw new Error('Sales order not found');
      }

      const salesOrder = orderResult.rows[0];

      // Check if sales order already has an invoice
      if (salesOrder.invoice_id) {
        throw new Error('This sales order already has an invoice');
      }

      // Get sales order items
      const itemsResult = await client.query(`
        SELECT * FROM sales_order_items
        WHERE sales_order_id = $1
        ORDER BY created_at
      `, [sales_order_id]);

      // Calculate due date (default: 30 days from invoice date)
      const calculatedDueDate = due_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      // Get down payment amount from sales order
      const downPaymentAmount = parseFloat(salesOrder.down_payment_amount || 0);

      // Insert invoice (invoice_number will be auto-generated by trigger)
      // amount_due will be calculated by trigger: total_amount - down_payment_amount - amount_paid
      const invoiceResult = await client.query(
        `INSERT INTO invoices (
          sales_order_id, quotation_id, contact_id,
          invoice_date, due_date, status,
          subtotal, discount_amount, tax_amount,
          shipping_cost, installation_cost, total_amount,
          down_payment_amount, amount_paid,
          payment_terms, notes, terms_conditions
        ) VALUES ($1, $2, $3, CURRENT_DATE, $4, 'brouillon', $5, $6, $7, $8, $9, $10, $11, 0, $12, $13, $14)
        RETURNING *`,
        [
          sales_order_id,
          salesOrder.quotation_id,
          salesOrder.contact_id,
          calculatedDueDate,
          salesOrder.subtotal,
          salesOrder.discount_amount,
          salesOrder.tax_amount,
          salesOrder.shipping_cost || 0,
          salesOrder.installation_cost || 0,
          salesOrder.total_amount,
          downPaymentAmount,
          payment_terms || salesOrder.payment_terms || '30 jours',
          notes || salesOrder.notes,
          salesOrder.terms_conditions || null,
        ]
      );

      const invoice = invoiceResult.rows[0];

      // Insert invoice items from sales order items (without customization columns that don't exist in production)
      for (const item of itemsResult.rows) {
        await client.query(
          `INSERT INTO invoice_items (
            invoice_id, product_id, product_name, product_sku,
            description, quantity, unit_price, discount_percent,
            discount_amount, tax_rate, tax_amount, line_total
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            invoice.id,
            item.product_id,
            item.product_name,
            item.product_sku,
            item.description,
            item.quantity,
            item.unit_price,
            item.discount_percent,
            item.discount_amount,
            item.tax_rate,
            item.tax_amount,
            item.line_total
          ]
        );
      }

      // Update sales order with invoice_id
      await client.query(
        `UPDATE sales_orders
         SET invoice_id = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [invoice.id, sales_order_id]
      );

      return invoice;
    });

    // Clear caches
    await clearInvoiceCache();
    await redisClient.del('sales_orders:*');
    await redisClient.del(`sales_order:${sales_order_id}`);

    // Notify all users about the new invoice
    try {
      const creatorName = (req as any).user?.name || 'Un utilisateur';
      await notifyAllUsers({
        type: 'invoice_created',
        title: 'Nouvelle facture créée',
        message: `${creatorName} a créé la facture N°${result.invoice_number}`,
        relatedEntityType: 'invoice',
        relatedEntityId: result.id,
        excludeUserId: (req as any).user?.id
      });
    } catch (notifError) {
      logger.error('Error sending notifications:', notifError);
    }

    res.status(201).json(result);
  } catch (error: any) {
    logger.error('Error creating invoice:', error);
    res.status(500).json({ error: error.message || 'Failed to create invoice' });
  }
});

// UPDATE invoice status
router.patch('/:id/status', authenticateToken, [
  body('status').isIn(['brouillon', 'envoyee', 'payee', 'en_retard', 'annulee']),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { status } = req.body;

    const result = await db.query(
      `UPDATE invoices
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Clear cache
    await clearInvoiceCache();
    await redisClient.del(`${CACHE_KEYS.INVOICE_PREFIX}${id}`);

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error updating invoice status:', error);
    res.status(500).json({ error: 'Failed to update invoice status' });
  }
});

// RECORD payment
router.patch('/:id/payment', authenticateToken, [
  body('amount_paid').isFloat({ min: 0 }).withMessage('Valid payment amount is required'),
  body('payment_method').optional().isIn(['virement', 'cheque', 'carte', 'especes']),
  body('payment_reference').optional().isString(),
  body('payment_date').optional().isISO8601(),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const {
      amount_paid,
      payment_method,
      payment_reference,
      payment_date,
    } = req.body;

    const result = await db.transaction(async (client) => {
      // Get current invoice (down_payment_amount is now stored on invoice itself)
      const currentInvoice = await client.query(
        `SELECT * FROM invoices WHERE id = $1`,
        [id]
      );

      if (currentInvoice.rows.length === 0) {
        throw new Error('Invoice not found');
      }

      const invoice = currentInvoice.rows[0];

      // Get down payment amount (stored on invoice)
      const downPaymentAmount = parseFloat(invoice.down_payment_amount || 0);

      // Calculate new total paid (existing payments + new payment)
      const existingAmountPaid = parseFloat(invoice.amount_paid || 0);
      const newPaymentAmount = parseFloat(amount_paid);
      const totalAmountPaid = existingAmountPaid + newPaymentAmount;

      // Calculate new amount due: total - down_payment - all payments
      const newAmountDue = parseFloat(invoice.total_amount) - downPaymentAmount - totalAmountPaid;

      // Determine new status
      let newStatus = invoice.status;
      if (newAmountDue <= 0.01) { // Allow for small rounding differences
        newStatus = 'payee';
      } else if (newStatus === 'brouillon') {
        newStatus = 'envoyee';
      }

      // Update invoice with total amount paid
      // The trigger will recalculate amount_due = total_amount - down_payment_amount - amount_paid
      const updateResult = await client.query(
        `UPDATE invoices
         SET amount_paid = $1,
             status = $2,
             payment_method = COALESCE($3, payment_method),
             payment_reference = COALESCE($4, payment_reference),
             payment_date = COALESCE($5, payment_date),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $6
         RETURNING *`,
        [
          totalAmountPaid,  // Store cumulative amount paid (not including down payment)
          newStatus,
          payment_method || null,
          payment_reference || null,
          payment_date || (newAmountDue <= 0.01 ? new Date().toISOString() : null),
          id,
        ]
      );

      return updateResult.rows[0];
    });

    // Clear cache
    await clearInvoiceCache();
    await redisClient.del(`${CACHE_KEYS.INVOICE_PREFIX}${id}`);

    res.json(result);
  } catch (error: any) {
    logger.error('Error recording payment:', error);
    res.status(500).json({ error: error.message || 'Failed to record payment' });
  }
});

// DELETE invoice (admin only)
router.delete('/:id', authenticateToken, authorizeRole('admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await db.transaction(async (client) => {
      // Get invoice to find associated sales order
      const invoiceResult = await client.query(
        'SELECT sales_order_id FROM invoices WHERE id = $1',
        [id]
      );

      if (invoiceResult.rows.length === 0) {
        throw new Error('Invoice not found');
      }

      const salesOrderId = invoiceResult.rows[0].sales_order_id;

      // Delete the invoice (items will cascade delete)
      await client.query('DELETE FROM invoices WHERE id = $1', [id]);

      // Update sales order to remove invoice reference
      if (salesOrderId) {
        await client.query(
          'UPDATE sales_orders SET invoice_id = NULL WHERE id = $1',
          [salesOrderId]
        );
      }
    });

    // Clear caches
    await clearInvoiceCache();
    await redisClient.del('sales_orders:*');

    res.json({ message: 'Invoice deleted successfully' });
  } catch (error: any) {
    logger.error('Error deleting invoice:', error);
    res.status(500).json({ error: error.message || 'Failed to delete invoice' });
  }
});

// GET invoice statistics
router.get('/stats/overview', authenticateToken, async (req: Request, res: Response) => {
  try {
    // Get invoice stats
    const invoiceStats = await db.query(`
      SELECT
        COUNT(*) as total_invoices,
        COUNT(CASE WHEN status = 'brouillon' THEN 1 END) as draft_count,
        COUNT(CASE WHEN status = 'envoyee' THEN 1 END) as sent_count,
        COUNT(CASE WHEN status = 'payee' THEN 1 END) as paid_count,
        COUNT(CASE WHEN status = 'en_retard' THEN 1 END) as overdue_count,
        COUNT(CASE WHEN status = 'annulee' THEN 1 END) as cancelled_count,
        COALESCE(SUM(CASE WHEN status = 'payee' THEN total_amount ELSE 0 END), 0) as paid_invoices_total,
        COALESCE(SUM(CASE WHEN status IN ('envoyee', 'en_retard') THEN amount_due ELSE 0 END), 0) as outstanding_amount,
        COALESCE(SUM(total_amount), 0) as total_revenue,
        COALESCE(AVG(total_amount), 0) as average_invoice_value,
        COALESCE(SUM(CASE WHEN status = 'payee' THEN down_payment_amount ELSE 0 END), 0) as paid_invoices_down_payments,
        COALESCE(SUM(CASE WHEN status = 'payee' THEN amount_paid ELSE 0 END), 0) as paid_invoices_payments
      FROM invoices
    `);

    // Get acomptes from sales orders that don't have paid invoices yet
    // This captures acomptes received before the invoice is fully paid
    const acomptesStats = await db.query(`
      SELECT
        COALESCE(SUM(CASE WHEN so.invoice_id IS NULL OR i.status != 'payee' THEN so.down_payment_amount ELSE 0 END), 0) as acomptes_not_in_paid_invoices
      FROM sales_orders so
      LEFT JOIN invoices i ON so.invoice_id = i.id
      WHERE so.status != 'annule'
        AND so.down_payment_amount > 0
    `);

    const invoiceData = invoiceStats.rows[0];
    const acomptesData = acomptesStats.rows[0];

    // CA Réalisé = paid invoices total + acomptes from non-paid-invoice orders
    // For paid invoices, the down_payment_amount is already included in total_amount
    // So we just add acomptes from orders that don't have paid invoices
    const paidInvoicesTotal = parseFloat(invoiceData.paid_invoices_total || 0);
    const acomptesNotInPaidInvoices = parseFloat(acomptesData.acomptes_not_in_paid_invoices || 0);
    const paidRevenue = paidInvoicesTotal + acomptesNotInPaidInvoices;

    res.json({
      ...invoiceData,
      paid_revenue: paidRevenue,
      acomptes_received: acomptesNotInPaidInvoices // For transparency
    });
  } catch (error) {
    logger.error('Error fetching invoice statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

export default router;

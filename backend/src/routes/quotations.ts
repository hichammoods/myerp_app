import { Router, Request, Response } from 'express';
import { db } from '../database/connection';
import { logger } from '../utils/logger';
import { redisClient } from '../database/redis';
import { authenticateToken, authorizeRole } from '../middleware/auth';
import { body, validationResult, query } from 'express-validator';

const router = Router();

// Cache keys
const CACHE_KEYS = {
  ALL_QUOTATIONS: 'quotations:all',
  QUOTATION_PREFIX: 'quotation:',
};

// Clear cache helper
const clearQuotationCache = async () => {
  try {
    const keys = await redisClient.keys('quotations:*');
    const quotationKeys = await redisClient.keys('quotation:*');
    if (keys.length > 0) await redisClient.del(keys as any);
    if (quotationKeys.length > 0) await redisClient.del(quotationKeys as any);
  } catch (error) {
    logger.error('Error clearing quotation cache:', error);
  }
};

// Generate quotation number
const generateQuotationNumber = async (): Promise<string> => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');

  // Get the last quotation number for this month
  const result = await db.query(
    `SELECT quotation_number FROM quotations
     WHERE quotation_number LIKE $1
     ORDER BY created_at DESC LIMIT 1`,
    [`DEV-${year}${month}-%`]
  );

  let sequence = 1;
  if (result.rows.length > 0) {
    const lastNumber = result.rows[0].quotation_number;
    const lastSequence = parseInt(lastNumber.split('-').pop() || '0');
    sequence = lastSequence + 1;
  }

  return `DEV-${year}${month}-${String(sequence).padStart(3, '0')}`;
};

// GET all quotations with pagination and filters
router.get('/', authenticateToken, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['draft', 'sent', 'accepted', 'rejected', 'expired']),
  query('contact_id').optional().isUUID(),
  query('sales_rep_id').optional().isUUID(),
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
    const sales_rep_id = req.query.sales_rep_id as string;
    const search = req.query.search as string;
    const from_date = req.query.from_date as string;
    const to_date = req.query.to_date as string;

    // Build query
    let queryStr = `
      SELECT
        q.*,
        c.first_name || ' ' || c.last_name as contact_name,
        c.company_name,
        c.email as contact_email,
        c.phone as contact_phone,
        u.first_name || ' ' || u.last_name as sales_rep_name,
        u.email as sales_rep_email,
        COUNT(DISTINCT ql.id) as line_items_count
      FROM quotations q
      LEFT JOIN contacts c ON q.contact_id = c.id
      LEFT JOIN users u ON q.sales_rep_id = u.id
      LEFT JOIN quotation_lines ql ON q.id = ql.quotation_id
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      queryStr += ` AND q.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (contact_id) {
      queryStr += ` AND q.contact_id = $${paramIndex}`;
      params.push(contact_id);
      paramIndex++;
    }

    if (sales_rep_id) {
      queryStr += ` AND q.sales_rep_id = $${paramIndex}`;
      params.push(sales_rep_id);
      paramIndex++;
    }

    if (search) {
      queryStr += ` AND (
        q.quotation_number ILIKE $${paramIndex} OR
        q.notes ILIKE $${paramIndex} OR
        c.first_name ILIKE $${paramIndex} OR
        c.last_name ILIKE $${paramIndex} OR
        c.company_name ILIKE $${paramIndex}
      )`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (from_date) {
      queryStr += ` AND q.created_at >= $${paramIndex}`;
      params.push(from_date);
      paramIndex++;
    }

    if (to_date) {
      queryStr += ` AND q.created_at <= $${paramIndex}`;
      params.push(to_date);
      paramIndex++;
    }

    // Check for expired quotations
    queryStr += ` AND (q.status != 'sent' OR q.expiration_date >= CURRENT_DATE OR q.status = 'expired')`;

    queryStr += ` GROUP BY q.id, c.id, u.id ORDER BY q.created_at DESC`;

    // Get total count
    const countQuery = `
      SELECT COUNT(DISTINCT q.id) as total
      FROM quotations q
      LEFT JOIN contacts c ON q.contact_id = c.id
      WHERE 1=1
    ` + queryStr.split('WHERE 1=1')[1].split('GROUP BY')[0];

    const countResult = await db.query(countQuery, params);
    const total = parseInt(countResult.rows[0]?.total || '0');

    // Add pagination
    queryStr += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    // Check cache
    const cacheKey = `quotations:${JSON.stringify({ page, limit, status, contact_id, search, from_date, to_date })}`;
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    const result = await db.query(queryStr, params);

    // Update expired quotations
    await db.query(
      `UPDATE quotations
       SET status = 'expired'
       WHERE status = 'sent'
       AND expiration_date < CURRENT_DATE`
    );

    const response = {
      quotations: result.rows,
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
    logger.error('Error fetching quotations:', error);
    res.status(500).json({ error: 'Failed to fetch quotations' });
  }
});

// GET single quotation by ID
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check cache
    const cacheKey = `${CACHE_KEYS.QUOTATION_PREFIX}${id}`;
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    const query = `
      SELECT
        q.*,
        c.first_name || ' ' || c.last_name as contact_name,
        c.company_name,
        c.email as contact_email,
        c.phone as contact_phone,
        c.address_street as contact_address,
        c.address_city as contact_city,
        c.address_zip as contact_postal_code,
        c.address_country as contact_country,
        u.first_name || ' ' || u.last_name as sales_rep_name,
        u.email as sales_rep_email,
        json_agg(
          jsonb_build_object(
            'id', ql.id,
            'product_id', ql.product_id,
            'product_name', ql.product_name,
            'product_sku', ql.product_sku,
            'description', ql.description,
            'quantity', ql.quantity,
            'unit_price', ql.unit_price,
            'discount_percent', ql.discount_percent,
            'discount_amount', ql.discount_amount,
            'tax_rate', ql.tax_rate,
            'tax_amount', ql.tax_amount,
            'line_total', ql.line_total,
            'notes', ql.notes,
            'is_optional', ql.is_optional,
            'is_customized', ql.is_customized,
            'base_product_id', ql.base_product_id,
            'custom_components', (
              SELECT COALESCE(json_agg(
                jsonb_build_object(
                  'id', qlc.id,
                  'component_name', qlc.component_name,
                  'component_type', qlc.component_type,
                  'material_id', qlc.material_id,
                  'material_name', m.name,
                  'finish_id', qlc.finish_id,
                  'finish_name', f.name,
                  'quantity', qlc.quantity,
                  'unit_cost', qlc.unit_cost,
                  'upcharge_percentage', qlc.upcharge_percentage,
                  'notes', qlc.notes
                )
              ), '[]'::json)
              FROM quotation_line_components qlc
              LEFT JOIN materials m ON qlc.material_id = m.id
              LEFT JOIN finishes f ON qlc.finish_id = f.id
              WHERE qlc.quotation_line_id = ql.id
            )
          ) ORDER BY ql.line_number
        ) FILTER (WHERE ql.id IS NOT NULL) as line_items
      FROM quotations q
      LEFT JOIN contacts c ON q.contact_id = c.id
      LEFT JOIN users u ON q.sales_rep_id = u.id
      LEFT JOIN quotation_lines ql ON q.id = ql.quotation_id
      WHERE q.id = $1
      GROUP BY q.id, c.id, u.id
    `;

    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Quotation not found' });
    }

    // Cache for 10 minutes
    await redisClient.setex(cacheKey, 600, JSON.stringify(result.rows[0]));

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error fetching quotation:', error);
    res.status(500).json({ error: 'Failed to fetch quotation' });
  }
});

// CREATE new quotation
router.post('/', authenticateToken, [
  body('contact_id').notEmpty().isUUID(),
  body('validity_days').optional().isInt({ min: 1, max: 365 }),
  body('line_items').isArray({ min: 1 }),
  body('line_items.*.product_name').notEmpty(),
  body('line_items.*.quantity').isFloat({ min: 0.01 }),
  body('line_items.*.unit_price').isFloat({ min: 0 }),
  body('discount_type').optional().isIn(['percent', 'amount']),
  body('discount_value').optional().isFloat({ min: 0 }),
  body('notes').optional().isString(),
  body('terms_conditions').optional().isString(),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      contact_id,
      validity_days = 30,
      line_items,
      discount_type = 'amount',
      discount_value = 0,
      shipping_cost = 0,
      installation_cost = 0,
      tax_rate = 20,
      include_tax = false,  // Default to FALSE - frontend will send TRUE for companies
      notes,
      terms_conditions,
    } = req.body;

    const result = await db.transaction(async (client) => {
      // Generate quotation number
      const quotation_number = await generateQuotationNumber();

      // Calculate validity date
      const expiration_date = new Date();
      expiration_date.setDate(expiration_date.getDate() + validity_days);

      // Helper function to round to 2 decimals
      const round = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;

      // Calculate totals - CLEAN LOGIC
      let subtotal = 0;

      // Step 1: Calculate line items (always HT - before tax)
      for (const item of line_items) {
        const line_subtotal = round(item.quantity * item.unit_price);
        let line_discount_amount = 0;
        let line_discount_percent = 0;
        let line_total = line_subtotal;

        // Apply line discount
        if (item.discount_type === 'percent') {
          line_discount_percent = item.discount_value || 0;
          line_discount_amount = round(line_subtotal * line_discount_percent / 100);
          line_total = round(line_subtotal - line_discount_amount);
        } else if (item.discount_type === 'amount') {
          line_discount_amount = item.discount_value || 0;
          line_total = round(line_subtotal - line_discount_amount);
        }

        // Calculate tax amount for reference (line-level tax for display)
        const tax_amount = round(line_total * (item.tax_rate || tax_rate) / 100);

        subtotal += line_total;
        item.discount_percent = line_discount_percent;
        item.discount_amount = line_discount_amount;
        item.line_total = line_total;  // Always HT
        item.tax_amount = tax_amount;  // Stored for reference
      }

      // Step 2: Round accumulated totals
      subtotal = round(subtotal);

      // Step 3: Apply global discount
      let discount_amount = 0;
      if (discount_type === 'percent') {
        discount_amount = round(subtotal * discount_value / 100);
      } else {
        discount_amount = round(discount_value || 0);
      }

      // Step 4: Calculate tax on FINAL amount (after discount + shipping + installation)
      const subtotal_after_discount = round(subtotal - discount_amount);
      const base_for_tax = round(subtotal_after_discount + shipping_cost + installation_cost);
      const total_tax = include_tax ? round(base_for_tax * tax_rate / 100) : 0;
      const total_amount = round(base_for_tax + total_tax);

      // DEBUG: Log the calculation
      console.log('CREATE Quotation Calculation:', {
        subtotal,
        discount_amount,
        subtotal_after_discount,
        shipping_cost,
        installation_cost,
        base_for_tax,
        tax_rate,
        total_tax,
        include_tax,
        total_amount
      });

      // Insert quotation
      const discount_percent = discount_type === 'percent' ? discount_value : 0;

      // DEBUG: Log the exact values being inserted
      console.log('INSERT VALUES:', {
        quotation_number,
        contact_id,
        expiration_date,
        subtotal,
        discount_percent,
        discount_amount,
        tax_rate,
        tax_amount: total_tax,
        shipping_cost,
        installation_cost,
        include_tax,
        total_amount,
        notes,
        terms_conditions
      });

      const quotationResult = await client.query(
        `INSERT INTO quotations (
          quotation_number, contact_id, sales_rep_id, status, expiration_date,
          subtotal, discount_percent, discount_amount,
          tax_rate, tax_amount, shipping_cost, installation_cost, include_tax, total_amount, currency,
          notes, terms_conditions
        ) VALUES ($1, $2, $3, 'draft', $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'EUR', $14, $15)
        RETURNING *`,
        [
          quotation_number, contact_id, req.user?.id, expiration_date,
          subtotal, discount_percent, discount_amount,
          tax_rate, total_tax, shipping_cost, installation_cost, include_tax, total_amount,
          notes, terms_conditions
        ]
      );

      const quotation = quotationResult.rows[0];

      // Insert line items
      for (let i = 0; i < line_items.length; i++) {
        const item = line_items[i];
        const line_discount_percent = item.discount_percent || 0;
        const line_discount_amount = item.discount_amount || 0;

        // Insert quotation line with customization fields
        const lineResult = await client.query(
          `INSERT INTO quotation_lines (
            quotation_id, product_id, product_name, product_sku, description,
            quantity, unit_price, discount_percent, discount_amount,
            tax_rate, tax_amount, line_total, notes, line_number,
            is_customized, base_product_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          RETURNING id`,
          [
            quotation.id,
            item.product_id || null,
            item.product_name,
            item.product_sku || '',
            item.description || '',
            item.quantity,
            item.unit_price,
            line_discount_percent,
            line_discount_amount,
            item.tax_rate || 0,
            item.tax_amount || 0,
            item.line_total,
            item.notes || null,
            i + 1,
            item.is_customized || false,
            item.base_product_id || null
          ]
        );

        const quotationLineId = lineResult.rows[0].id;

        // Insert custom components if this is a customized product
        if (item.is_customized && item.custom_components && Array.isArray(item.custom_components)) {
          for (const component of item.custom_components) {
            await client.query(
              `INSERT INTO quotation_line_components (
                quotation_line_id, component_name, component_type,
                material_id, finish_id, quantity, unit_cost, upcharge_percentage, notes
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
              [
                quotationLineId,
                component.component_name || '',
                component.component_type || 'material',
                component.material_id || null,
                component.finish_id || null,
                component.quantity || 1.0,
                component.unit_cost || 0,
                component.upcharge_percentage || 0,
                component.notes || null
              ]
            );
          }
        }
      }

      return quotation;
    });

    // Clear cache
    await clearQuotationCache();

    res.status(201).json(result);
  } catch (error) {
    logger.error('Error creating quotation:', error);
    res.status(500).json({ error: 'Failed to create quotation' });
  }
});

// UPDATE quotation
router.put('/:id', authenticateToken, [
  body('contact_id').isUUID().withMessage('Valid contact ID is required'),
  body('line_items').isArray({ min: 1 }).withMessage('At least one line item is required')
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const {
      contact_id,
      expiration_date,
      delivery_date,
      delivery_address,
      payment_terms,
      delivery_terms,
      shipping_method,
      installation_included,
      line_items,
      discount_type = 'percent',
      discount_value = 0,
      tax_rate = 20,
      include_tax = false,  // Default to FALSE - frontend will send TRUE for companies
      notes = '',
      internal_notes = '',
      terms_conditions = ''
    } = req.body;

    // Parse numeric values from request body
    const shipping_cost = parseFloat(req.body.shipping_cost) || 0;
    const installation_cost = parseFloat(req.body.installation_cost) || 0;

    const result = await db.transaction(async (client) => {
      // Check if quotation exists
      const checkResult = await client.query('SELECT id, status FROM quotations WHERE id = $1', [id]);
      if (checkResult.rows.length === 0) {
        throw new Error('Quotation not found');
      }

      // Helper function to round to 2 decimals
      const round = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;

      // Calculate totals - CLEAN LOGIC
      let subtotal = 0;

      // Step 1: Calculate line items (always HT - before tax)
      for (const item of line_items) {
        const line_subtotal = round(item.quantity * item.unit_price);
        let line_discount_amount = 0;
        let line_discount_percent = 0;
        let line_total = line_subtotal;

        // Apply line discount
        if (item.discount_type === 'percent') {
          line_discount_percent = item.discount_value || 0;
          line_discount_amount = round(line_subtotal * line_discount_percent / 100);
          line_total = round(line_subtotal - line_discount_amount);
        } else if (item.discount_type === 'amount') {
          line_discount_amount = item.discount_value || 0;
          line_total = round(line_subtotal - line_discount_amount);
        }

        // Calculate tax amount for reference (line-level tax for display)
        const tax_amount = round(line_total * (item.tax_rate || tax_rate) / 100);

        subtotal += line_total;
        item.discount_percent = line_discount_percent;
        item.discount_amount = line_discount_amount;
        item.line_total = line_total;  // Always HT
        item.tax_amount = tax_amount;  // Stored for reference
      }

      // Step 2: Round accumulated totals
      subtotal = round(subtotal);

      // Step 3: Apply global discount
      let discount_amount = 0;
      if (discount_type === 'percent') {
        discount_amount = round(subtotal * discount_value / 100);
      } else {
        discount_amount = round(discount_value || 0);
      }

      // Step 4: Calculate tax on FINAL amount (after discount + shipping + installation)
      const subtotal_after_discount = round(subtotal - discount_amount);
      const base_for_tax = round(subtotal_after_discount + shipping_cost + installation_cost);
      const total_tax = include_tax ? round(base_for_tax * tax_rate / 100) : 0;
      const total_amount = round(base_for_tax + total_tax);

      // DEBUG: Log the calculation
      console.log('UPDATE Quotation Calculation:', {
        quotation_id: id,
        subtotal,
        discount_amount,
        subtotal_after_discount,
        shipping_cost,
        installation_cost,
        tax_rate,
        base_for_tax,
        total_tax,
        include_tax,
        total_amount
      });

      // Update quotation
      const discount_percent = discount_type === 'percent' ? discount_value : 0;

      // DEBUG: Log the exact values being updated
      const paramsArray = [
        contact_id, expiration_date, delivery_date, delivery_address,
        payment_terms, delivery_terms, shipping_method, installation_included,
        subtotal, discount_percent, discount_amount,
        tax_rate, total_tax, shipping_cost, installation_cost, include_tax, total_amount,
        notes, internal_notes, terms_conditions, id
      ];

      console.log('UPDATE VALUES:', {
        id,
        contact_id,
        expiration_date,
        delivery_date,
        delivery_address,
        payment_terms,
        delivery_terms,
        shipping_method,
        installation_included,
        subtotal,
        discount_percent,
        discount_amount,
        tax_rate,
        tax_amount: total_tax,
        shipping_cost,
        installation_cost,
        include_tax,
        total_amount,
        notes,
        internal_notes,
        terms_conditions
      });

      const quotationResult = await client.query(
        `UPDATE quotations SET
          contact_id = $1,
          expiration_date = $2,
          delivery_date = $3,
          delivery_address = $4,
          payment_terms = $5,
          delivery_terms = $6,
          shipping_method = $7,
          installation_included = $8,
          subtotal = $9,
          discount_percent = $10,
          discount_amount = $11,
          tax_rate = $12,
          tax_amount = $13,
          shipping_cost = $14,
          installation_cost = $15,
          include_tax = $16,
          total_amount = $17,
          notes = $18,
          internal_notes = $19,
          terms_conditions = $20,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $21
        RETURNING *`,
        paramsArray
      );

      const quotation = quotationResult.rows[0];

      // DEBUG: Log what was actually saved to database
      console.log('RETURNED FROM DB:', {
        id: quotation.id,
        subtotal: quotation.subtotal,
        shipping_cost: quotation.shipping_cost,
        installation_cost: quotation.installation_cost,
        tax_amount: quotation.tax_amount,
        total_amount: quotation.total_amount
      });

      // Delete existing line items (CASCADE will delete quotation_line_components)
      await client.query('DELETE FROM quotation_lines WHERE quotation_id = $1', [id]);

      // Insert updated line items
      for (let i = 0; i < line_items.length; i++) {
        const item = line_items[i];

        // Insert quotation line with customization fields
        const lineResult = await client.query(
          `INSERT INTO quotation_lines (
            quotation_id, product_id, product_name, product_sku, description,
            quantity, unit_price, discount_percent, discount_amount,
            tax_rate, tax_amount, line_total, notes, line_number,
            is_customized, base_product_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          RETURNING id`,
          [
            quotation.id,
            item.product_id || null,
            item.product_name,
            item.product_sku || '',
            item.description || '',
            item.quantity,
            item.unit_price,
            item.discount_percent || 0,
            item.discount_amount || 0,
            item.tax_rate || 0,
            item.tax_amount || 0,
            item.line_total,
            item.notes || null,
            i + 1,
            item.is_customized || false,
            item.base_product_id || null
          ]
        );

        const quotationLineId = lineResult.rows[0].id;

        // Insert custom components if this is a customized product
        if (item.is_customized && item.custom_components && Array.isArray(item.custom_components)) {
          for (const component of item.custom_components) {
            await client.query(
              `INSERT INTO quotation_line_components (
                quotation_line_id, component_name, component_type,
                material_id, finish_id, quantity, unit_cost, upcharge_percentage, notes
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
              [
                quotationLineId,
                component.component_name || '',
                component.component_type || 'material',
                component.material_id || null,
                component.finish_id || null,
                component.quantity || 1.0,
                component.unit_cost || 0,
                component.upcharge_percentage || 0,
                component.notes || null
              ]
            );
          }
        }
      }

      return quotation;
    });

    // Clear cache
    await clearQuotationCache();
    await redisClient.del(`${CACHE_KEYS.QUOTATION_PREFIX}${id}`);

    res.json(result);
  } catch (error: any) {
    logger.error('Error updating quotation:', error);
    res.status(500).json({ error: error.message || 'Failed to update quotation' });
  }
});

// UPDATE quotation status
router.patch('/:id/status', authenticateToken, [
  body('status').isIn(['draft', 'sent', 'accepted', 'rejected', 'expired']),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { status } = req.body;

    const result = await db.query(
      `UPDATE quotations
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Quotation not found' });
    }

    // Clear cache
    await clearQuotationCache();

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error updating quotation status:', error);
    res.status(500).json({ error: 'Failed to update quotation status' });
  }
});

// DUPLICATE quotation
router.post('/:id/duplicate', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await db.transaction(async (client) => {
      // Get original quotation
      const originalResult = await client.query(
        `SELECT * FROM quotations WHERE id = $1`,
        [id]
      );

      if (originalResult.rows.length === 0) {
        throw new Error('Quotation not found');
      }

      const original = originalResult.rows[0];

      // Generate new quotation number
      const quotation_number = await generateQuotationNumber();

      // Calculate new validity date
      const expiration_date = new Date();
      expiration_date.setDate(expiration_date.getDate() + 30);

      // Insert duplicate quotation
      const quotationResult = await client.query(
        `INSERT INTO quotations (
          quotation_number, contact_id, sales_rep_id, status, expiration_date,
          subtotal, discount_type, discount_value, discount_amount,
          tax_amount, shipping_cost, total_amount, currency,
          notes, terms_conditions
        ) VALUES ($1, $2, $3, 'draft', $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *`,
        [
          quotation_number, original.contact_id, req.user?.id, expiration_date,
          original.subtotal, original.discount_type, original.discount_value,
          original.discount_amount, original.tax_amount, original.shipping_cost,
          original.total_amount, original.currency,
          original.notes, original.terms_conditions
        ]
      );

      const newQuotation = quotationResult.rows[0];

      // Duplicate line items
      const linesResult = await client.query(
        `SELECT * FROM quotation_lines WHERE quotation_id = $1 ORDER BY display_order`,
        [id]
      );

      for (const line of linesResult.rows) {
        await client.query(
          `INSERT INTO quotation_lines (
            quotation_id, type, product_id, product_name, description,
            quantity, unit_price, discount_type, discount_value,
            tax_rate, line_total, notes, display_order
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [
            newQuotation.id,
            line.type, line.product_id, line.product_name, line.description,
            line.quantity, line.unit_price, line.discount_type, line.discount_value,
            line.tax_rate, line.line_total, line.notes, line.display_order
          ]
        );
      }

      return newQuotation;
    });

    // Clear cache
    await clearQuotationCache();

    res.status(201).json(result);
  } catch (error: any) {
    logger.error('Error duplicating quotation:', error);
    if (error.message === 'Quotation not found') {
      return res.status(404).json({ error: 'Quotation not found' });
    }
    res.status(500).json({ error: 'Failed to duplicate quotation' });
  }
});

// DELETE quotation (admin only)
router.delete('/:id', authenticateToken, authorizeRole('admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'DELETE FROM quotations WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Quotation not found' });
    }

    // Clear cache
    await clearQuotationCache();

    res.json({ message: 'Quotation deleted successfully' });
  } catch (error) {
    logger.error('Error deleting quotation:', error);
    res.status(500).json({ error: 'Failed to delete quotation' });
  }
});

// GET quotation statistics
router.get('/stats/overview', authenticateToken, async (req: Request, res: Response) => {
  try {
    // Get all-time stats (removed 30 days filter for accurate totals)
    const stats = await db.query(`
      SELECT
        COUNT(*) as total_quotations,
        COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_count,
        COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent_count,
        COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted_count,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_count,
        COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired_count,
        COALESCE(SUM(CASE WHEN status = 'accepted' THEN total_amount ELSE 0 END), 0) as accepted_revenue,
        COALESCE(SUM(CASE WHEN status IN ('draft', 'sent') THEN total_amount ELSE 0 END), 0) as potential_revenue,
        COALESCE(AVG(total_amount), 0) as average_quotation_value,
        COALESCE(
          (COUNT(CASE WHEN status = 'accepted' THEN 1 END)::float /
           NULLIF(COUNT(CASE WHEN status IN ('accepted', 'rejected') THEN 1 END), 0) * 100),
          0
        ) as conversion_rate
      FROM quotations
      WHERE deleted_at IS NULL
    `);

    res.json(stats.rows[0]);
  } catch (error) {
    logger.error('Error fetching quotation statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

export default router;
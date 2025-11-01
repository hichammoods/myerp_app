import { Router, Request, Response } from 'express';
import { db } from '../database/connection';
import { logger } from '../utils/logger';
import { authenticateToken, authorizeRole } from '../middleware/auth';
import { body, validationResult, query } from 'express-validator';

const router = Router();

// GET all contacts with pagination and filters
router.get('/', authenticateToken, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('type').optional().isIn(['client', 'supplier', 'partner', 'other']),
  query('search').optional().isString(),
  query('is_active').optional().isString().isIn(['true', 'false']),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const type = req.query.type as string;
    const search = req.query.search as string;
    const is_active = req.query.is_active as string;

    // Build query
    let queryStr = `
      SELECT
        c.*,
        COUNT(DISTINCT q.id) FILTER (WHERE q.id IS NOT NULL) as quotation_count,
        COALESCE((
          SELECT SUM(inv.total_amount)
          FROM invoices inv
          JOIN sales_orders so ON inv.sales_order_id = so.id
          WHERE so.contact_id = c.id
            AND inv.status = 'payee'
            AND so.status != 'annule'
        ), 0) as total_revenue,
        COALESCE(SUM(DISTINCT CASE WHEN q.status IN ('sent', 'draft') THEN q.total_amount ELSE 0 END), 0) as potential_revenue,
        CASE
          WHEN EXISTS (
            SELECT 1 FROM quotations q2
            WHERE q2.contact_id = c.id
              AND q2.status IN ('draft', 'sent')
          ) THEN true
          WHEN EXISTS (
            SELECT 1 FROM sales_orders so2
            WHERE so2.contact_id = c.id
              AND so2.status IN ('en_cours', 'en_preparation', 'expedie', 'livre')
          ) THEN true
          WHEN EXISTS (
            SELECT 1 FROM invoices inv2
            JOIN sales_orders so3 ON inv2.sales_order_id = so3.id
            WHERE so3.contact_id = c.id
              AND inv2.status IN ('brouillon', 'envoyee', 'en_retard')
          ) THEN true
          ELSE false
        END as has_active_business
      FROM contacts c
      LEFT JOIN quotations q ON c.id = q.contact_id
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (type) {
      queryStr += ` AND c.type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    if (is_active !== undefined) {
      queryStr += ` AND c.is_active = $${paramIndex}`;
      params.push(is_active === 'true');
      paramIndex++;
    }

    if (search) {
      queryStr += ` AND (
        c.first_name ILIKE $${paramIndex} OR
        c.last_name ILIKE $${paramIndex} OR
        c.company_name ILIKE $${paramIndex} OR
        c.email ILIKE $${paramIndex} OR
        c.phone ILIKE $${paramIndex} OR
        c.address_city ILIKE $${paramIndex} OR
        c.address_street ILIKE $${paramIndex}
      )`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    queryStr += ` GROUP BY c.id ORDER BY c.created_at DESC`;

    // Get total count
    const countQuery = `
      SELECT COUNT(DISTINCT c.id) as total
      FROM contacts c
      WHERE 1=1
    ` + queryStr.split('WHERE 1=1')[1].split('GROUP BY')[0];

    const countResult = await db.query(countQuery, params);
    const total = parseInt(countResult.rows[0]?.total || '0');

    // Add pagination
    queryStr += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await db.query(queryStr, params);

    // Debug: Check Youssef and Salma
    for (const contact of result.rows) {
      if ((contact.first_name === 'Youssef' || contact.first_name === 'Salma') && contact.is_active) {
        logger.info(`DEBUG: ${contact.first_name} ${contact.last_name} is showing as ACTIVE`, {
          contact_id: contact.id,
          is_active: contact.is_active
        });

        // Get detailed breakdown
        const debugQuery = `
          SELECT 'quotation' as type, q.quotation_number as number, q.status, q.created_at
          FROM quotations q
          WHERE q.contact_id = $1
          UNION ALL
          SELECT 'sales_order' as type, so.order_number as number, so.status, so.created_at
          FROM sales_orders so
          WHERE so.contact_id = $1
          UNION ALL
          SELECT 'invoice' as type, inv.invoice_number as number, inv.status, inv.created_at
          FROM invoices inv
          JOIN sales_orders so ON inv.sales_order_id = so.id
          WHERE so.contact_id = $1
          ORDER BY created_at DESC
        `;
        const debugResult = await db.query(debugQuery, [contact.id]);
        logger.info(`DEBUG: ${contact.first_name}'s activity:`, debugResult.rows);
      }
    }

    const response = {
      contacts: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };

    res.json(response);
  } catch (error) {
    logger.error('Error fetching contacts:', error);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

// GET single contact by ID
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT
        c.*,
        COUNT(DISTINCT q.id) as quotation_count,
        COALESCE((
          SELECT SUM(inv.total_amount)
          FROM invoices inv
          JOIN sales_orders so ON inv.sales_order_id = so.id
          WHERE so.contact_id = c.id
            AND inv.status = 'payee'
            AND so.status != 'annule'
        ), 0) as total_revenue,
        COALESCE(SUM(DISTINCT CASE WHEN q.status IN ('sent', 'draft') THEN q.total_amount ELSE 0 END), 0) as potential_revenue,
        CASE
          WHEN EXISTS (
            SELECT 1 FROM quotations q2
            WHERE q2.contact_id = c.id
              AND q2.status IN ('draft', 'sent')
          ) THEN true
          WHEN EXISTS (
            SELECT 1 FROM sales_orders so2
            WHERE so2.contact_id = c.id
              AND so2.status IN ('en_cours', 'en_preparation', 'expedie', 'livre')
          ) THEN true
          WHEN EXISTS (
            SELECT 1 FROM invoices inv2
            JOIN sales_orders so3 ON inv2.sales_order_id = so3.id
            WHERE so3.contact_id = c.id
              AND inv2.status IN ('brouillon', 'envoyee', 'en_retard')
          ) THEN true
          ELSE false
        END as has_active_business,
        json_agg(
          DISTINCT jsonb_build_object(
            'id', q.id,
            'quotation_number', q.quotation_number,
            'date', q.created_at,
            'status', q.status,
            'total', q.total_amount
          ) ORDER BY q.created_at DESC
        ) FILTER (WHERE q.id IS NOT NULL) as recent_quotations
      FROM contacts c
      LEFT JOIN quotations q ON c.id = q.contact_id
      WHERE c.id = $1
      GROUP BY c.id
    `;

    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error fetching contact:', error);
    res.status(500).json({ error: 'Failed to fetch contact' });
  }
});

// CREATE new contact
router.post('/', authenticateToken, [
  body('first_name').optional().isString(),
  body('last_name').optional().isString(),
  body('email').optional({ checkFalsy: true }).isEmail(),
  body('type').optional().isIn(['client', 'supplier', 'partner', 'other']),
  body('customer_type').optional().isIn(['individual', 'company']),
  body('phone').optional({ checkFalsy: true }).isString(),
  body('mobile').optional({ checkFalsy: true }).isString(),
  body('company_name').optional().isString(),
  body('job_title').optional().isString(),
  body('address_street').optional().isString(),
  body('address_city').optional().isString(),
  body('address_state').optional().isString(),
  body('address_zip').optional().isString(),
  body('address_country').optional().isString(),
  body('tax_id').optional().isString(),
  body('credit_limit').optional().isNumeric(),
  body('payment_terms').optional().isInt(),
  body('notes').optional().isString(),
  body('tags').optional().isArray(),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.error('Validation errors:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      first_name,
      last_name,
      email,
      phone,
      mobile,
      type = 'client',
      customer_type = 'individual',
      company_name,
      job_title,
      address_street,
      address_city,
      address_state,
      address_zip,
      address_country,
      tax_id,
      credit_limit = 0,
      payment_terms = 30,
      notes,
      tags = [],
      assigned_to,
    } = req.body;

    logger.info('Contact creation data:', {
      first_name,
      last_name,
      email: email || 'EMPTY',
      phone: phone || 'EMPTY',
      mobile: mobile || 'EMPTY',
      company_name: company_name || 'EMPTY'
    });

    // Custom validation: Either company_name OR (first_name AND last_name) is required
    if (!company_name && (!first_name || !last_name)) {
      logger.error('Failed validation: Missing company_name or first_name/last_name');
      return res.status(400).json({
        error: 'Either company_name or both first_name and last_name are required'
      });
    }

    // At least one contact method is required (email, phone, or mobile)
    if (!email && !phone && !mobile) {
      logger.error('Failed validation: No contact method provided');
      return res.status(400).json({
        error: 'At least one contact method (email, phone, or mobile) is required'
      });
    }

    // Check if email already exists (only if provided)
    if (email) {
      const emailCheck = await db.query(
        'SELECT id FROM contacts WHERE email = $1',
        [email]
      );

      if (emailCheck.rows.length > 0) {
        return res.status(409).json({ error: 'Email already exists' });
      }
    }

    const result = await db.query(
      `INSERT INTO contacts (
        first_name, last_name, email, phone, mobile, type, customer_type,
        company_name, job_title, address_street, address_city, address_state,
        address_zip, address_country, tax_id, credit_limit, payment_terms,
        notes, tags, assigned_to, created_by, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, true)
      RETURNING *`,
      [
        first_name, last_name, email, phone, mobile, type, customer_type,
        company_name, job_title, address_street, address_city, address_state,
        address_zip, address_country, tax_id, credit_limit, payment_terms,
        notes, tags, assigned_to || req.user?.id, req.user?.id
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    logger.error('Error creating contact:', error);
    res.status(500).json({ error: 'Failed to create contact' });
  }
});

// UPDATE contact
router.put('/:id', authenticateToken, [
  body('first_name').optional().isString(),
  body('last_name').optional().isString(),
  body('email').optional().isEmail(),
  body('type').optional().isIn(['client', 'supplier', 'partner', 'other']),
  body('phone').optional().isString(),
  body('company_name').optional().isString(),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const updates = req.body;

    // If email is being updated, check for duplicates
    if (updates.email) {
      const emailCheck = await db.query(
        'SELECT id FROM contacts WHERE email = $1 AND id != $2',
        [updates.email, id]
      );

      if (emailCheck.rows.length > 0) {
        return res.status(409).json({ error: 'Email already exists' });
      }
    }

    // Build update query
    const fields = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      fields.push(`${key} = $${paramIndex}`);
      values.push(value);  // pg driver handles arrays and JSON automatically
      paramIndex++;
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const query = `
      UPDATE contacts
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error updating contact:', error);
    res.status(500).json({ error: 'Failed to update contact' });
  }
});

// DELETE contact (soft delete - admin only)
router.delete('/:id', authenticateToken, authorizeRole('admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'UPDATE contacts SET is_active = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id',
      [false, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    res.json({ message: 'Contact deactivated successfully' });
  } catch (error) {
    logger.error('Error deleting contact:', error);
    res.status(500).json({ error: 'Failed to delete contact' });
  }
});

// GET contact activity history
router.get('/:id/activity', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;

    const query = `
      SELECT
        'quotation' as type,
        q.id,
        q.quotation_number as reference,
        q.status,
        q.total_amount as amount,
        q.created_at as date,
        'Devis créé' as description
      FROM quotations q
      WHERE q.contact_id = $1

      UNION ALL

      SELECT
        'communication' as type,
        c.id,
        c.subject as reference,
        c.type as status,
        NULL as amount,
        c.date,
        c.notes as description
      FROM communications c
      WHERE c.contact_id = $1

      ORDER BY date DESC
      LIMIT $2
    `;

    const result = await db.query(query, [id, limit]);

    res.json(result.rows);
  } catch (error) {
    logger.error('Error fetching contact activity:', error);
    res.status(500).json({ error: 'Failed to fetch contact activity' });
  }
});

// Bulk import contacts
router.post('/import', authenticateToken, [
  body('contacts').isArray(),
  body('contacts.*.first_name').notEmpty(),
  body('contacts.*.last_name').notEmpty(),
  body('contacts.*.email').isEmail(),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { contacts } = req.body;
    const results = {
      imported: [],
      failed: [],
    };

    for (const contact of contacts) {
      try {
        // Check if email exists
        const emailCheck = await db.query(
          'SELECT id FROM contacts WHERE email = $1',
          [contact.email]
        );

        if (emailCheck.rows.length > 0) {
          results.failed.push({
            email: contact.email,
            reason: 'Email already exists',
          });
          continue;
        }

        const result = await db.query(
          `INSERT INTO contacts (
            first_name, last_name, email, phone, type, company_name,
            job_title, address_street, address_city, address_zip, address_country, is_active
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)
          RETURNING id, email`,
          [
            contact.first_name,
            contact.last_name,
            contact.email,
            contact.phone || null,
            contact.type || 'client',
            contact.company_name || null,
            contact.job_title || null,
            contact.address_street || null,
            contact.address_city || null,
            contact.address_zip || null,
            contact.address_country || 'France',
          ]
        );

        results.imported.push(result.rows[0]);
      } catch (error) {
        results.failed.push({
          email: contact.email,
          reason: 'Import failed',
        });
      }
    }

    res.json({
      message: `Imported ${results.imported.length} contacts`,
      results,
    });
  } catch (error) {
    logger.error('Error importing contacts:', error);
    res.status(500).json({ error: 'Failed to import contacts' });
  }
});

// GET contacts statistics
router.get('/stats/overview', authenticateToken, async (req: Request, res: Response) => {
  try {
    const stats = await db.query(`
      SELECT
        COUNT(*) as total_contacts,
        COUNT(CASE
          WHEN EXISTS (
            SELECT 1 FROM quotations q2
            WHERE q2.contact_id = c.id
              AND q2.status IN ('draft', 'sent')
          )
          OR EXISTS (
            SELECT 1 FROM sales_orders so2
            WHERE so2.contact_id = c.id
              AND so2.status IN ('en_cours', 'en_preparation', 'expedie', 'livre')
          )
          OR EXISTS (
            SELECT 1 FROM invoices inv2
            JOIN sales_orders so3 ON inv2.sales_order_id = so3.id
            WHERE so3.contact_id = c.id
              AND inv2.status IN ('brouillon', 'envoyee', 'en_retard')
          )
          THEN 1
        END) as active_contacts,
        COUNT(CASE WHEN type = 'client' THEN 1 END) as clients_count,
        COUNT(CASE WHEN type = 'supplier' THEN 1 END) as suppliers_count,
        COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as new_this_month
      FROM contacts c
      WHERE c.deleted_at IS NULL
    `);

    res.json(stats.rows[0]);
  } catch (error) {
    logger.error('Error fetching contact statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

export default router;
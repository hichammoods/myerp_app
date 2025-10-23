import { Router, Request, Response } from 'express';
import { db } from '../database/connection';
import { logger } from '../utils/logger';
import { redisClient } from '../database/redis';
import { authenticateToken } from '../middleware/auth';
import { body, validationResult, query } from 'express-validator';

const router = Router();

// Cache keys
const CACHE_KEYS = {
  ALL_CONTACTS: 'contacts:all',
  CONTACT_PREFIX: 'contact:',
};

// Clear cache helper
const clearContactCache = async () => {
  try {
    const keys = await redisClient.keys('contacts:*');
    const contactKeys = await redisClient.keys('contact:*');
    if (keys.length > 0) await redisClient.del(...keys);
    if (contactKeys.length > 0) await redisClient.del(...contactKeys);
  } catch (error) {
    logger.error('Error clearing contact cache:', error);
  }
};

// GET all contacts with pagination and filters
router.get('/', authenticateToken, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('type').optional().isIn(['client', 'supplier', 'partner', 'other']),
  query('search').optional().isString(),
  query('status').optional().isIn(['active', 'inactive']),
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
    const status = req.query.status as string;

    // Build query
    let queryStr = `
      SELECT
        c.*,
        COUNT(DISTINCT q.id) as quotation_count,
        SUM(CASE WHEN q.status = 'accepted' THEN q.total_amount ELSE 0 END) as total_revenue
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

    if (status) {
      queryStr += ` AND c.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (search) {
      queryStr += ` AND (
        c.first_name ILIKE $${paramIndex} OR
        c.last_name ILIKE $${paramIndex} OR
        c.company_name ILIKE $${paramIndex} OR
        c.email ILIKE $${paramIndex} OR
        c.phone ILIKE $${paramIndex}
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

    // Check cache
    const cacheKey = `contacts:${JSON.stringify({ page, limit, type, search, status })}`;
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    const result = await db.query(queryStr, params);

    const response = {
      contacts: result.rows,
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
    logger.error('Error fetching contacts:', error);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

// GET single contact by ID
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check cache
    const cacheKey = `${CACHE_KEYS.CONTACT_PREFIX}${id}`;
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    const query = `
      SELECT
        c.*,
        COUNT(DISTINCT q.id) as quotation_count,
        SUM(CASE WHEN q.status = 'accepted' THEN q.total_amount ELSE 0 END) as total_revenue,
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

    // Cache for 10 minutes
    await redisClient.setex(cacheKey, 600, JSON.stringify(result.rows[0]));

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error fetching contact:', error);
    res.status(500).json({ error: 'Failed to fetch contact' });
  }
});

// CREATE new contact
router.post('/', authenticateToken, [
  body('first_name').notEmpty().isString(),
  body('last_name').notEmpty().isString(),
  body('email').notEmpty().isEmail(),
  body('type').isIn(['client', 'supplier', 'partner', 'other']),
  body('phone').optional().isString(),
  body('company_name').optional().isString(),
  body('job_title').optional().isString(),
  body('address').optional().isString(),
  body('city').optional().isString(),
  body('postal_code').optional().isString(),
  body('country').optional().isString(),
  body('notes').optional().isString(),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      first_name,
      last_name,
      email,
      phone,
      type = 'client',
      company_name,
      job_title,
      address,
      city,
      postal_code,
      country = 'France',
      tax_id,
      website,
      notes,
      tags = [],
      preferences = {},
    } = req.body;

    // Check if email already exists
    const emailCheck = await db.query(
      'SELECT id FROM contacts WHERE email = $1',
      [email]
    );

    if (emailCheck.rows.length > 0) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    const result = await db.query(
      `INSERT INTO contacts (
        first_name, last_name, email, phone, type, company_name,
        job_title, address, city, postal_code, country, tax_id,
        website, notes, tags, preferences, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'active')
      RETURNING *`,
      [
        first_name, last_name, email, phone, type, company_name,
        job_title, address, city, postal_code, country, tax_id,
        website, notes, JSON.stringify(tags), JSON.stringify(preferences)
      ]
    );

    // Clear cache
    await clearContactCache();

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
      if (key === 'tags' || key === 'preferences') {
        fields.push(`${key} = $${paramIndex}`);
        values.push(JSON.stringify(value));
      } else {
        fields.push(`${key} = $${paramIndex}`);
        values.push(value);
      }
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

    // Clear cache
    await clearContactCache();

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error updating contact:', error);
    res.status(500).json({ error: 'Failed to update contact' });
  }
});

// DELETE contact (soft delete)
router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'UPDATE contacts SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id',
      ['inactive', id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    // Clear cache
    await clearContactCache();

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
            job_title, address, city, postal_code, country, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'active')
          RETURNING id, email`,
          [
            contact.first_name,
            contact.last_name,
            contact.email,
            contact.phone || null,
            contact.type || 'client',
            contact.company_name || null,
            contact.job_title || null,
            contact.address || null,
            contact.city || null,
            contact.postal_code || null,
            contact.country || 'France',
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

    // Clear cache
    await clearContactCache();

    res.json({
      message: `Imported ${results.imported.length} contacts`,
      results,
    });
  } catch (error) {
    logger.error('Error importing contacts:', error);
    res.status(500).json({ error: 'Failed to import contacts' });
  }
});

export default router;
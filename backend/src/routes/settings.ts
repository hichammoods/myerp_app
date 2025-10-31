import { Router, Request, Response } from 'express';
import { db } from '../database/connection';
import { logger } from '../utils/logger';
import { authenticateToken } from '../middleware/auth';
import { body, validationResult } from 'express-validator';

const router = Router();

// GET company settings
router.get('/company', authenticateToken, async (req: Request, res: Response) => {
  try {
    const result = await db.query(`
      SELECT * FROM company_settings
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Company settings not found'
      });
    }

    res.json({
      success: true,
      company: result.rows[0]
    });
  } catch (error: any) {
    logger.error('Error fetching company settings:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching company settings',
      error: error.message
    });
  }
});

// PUT update company settings
router.put('/company', authenticateToken, [
  body('name').optional().isString().trim(),
  body('address').optional().isString().trim(),
  body('city').optional().isString().trim(),
  body('postal_code').optional().isString().trim(),
  body('country').optional().isString().trim(),
  body('phone').optional().isString().trim(),
  body('email').optional().isEmail(),
  body('website').optional().isString().trim(),
  body('siret').optional().isString().trim(),
  body('tva').optional().isString().trim(),
  body('logo_url').optional().isString().trim(),
  body('default_cgv').optional().isString(),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const {
      name,
      address,
      city,
      postal_code,
      country,
      phone,
      email,
      website,
      siret,
      tva,
      logo_url,
      default_cgv
    } = req.body;

    // Check if company settings exist
    const existing = await db.query('SELECT id FROM company_settings LIMIT 1');

    let result;
    if (existing.rows.length === 0) {
      // Insert new company settings
      result = await db.query(`
        INSERT INTO company_settings (
          name, address, city, postal_code, country,
          phone, email, website, siret, tva, logo_url, default_cgv
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `, [name, address, city, postal_code, country, phone, email, website, siret, tva, logo_url, default_cgv]);
    } else {
      // Update existing company settings
      const updateFields: string[] = [];
      const updateValues: any[] = [];
      let paramIndex = 1;

      const fieldsToUpdate = {
        name, address, city, postal_code, country,
        phone, email, website, siret, tva, logo_url, default_cgv
      };

      Object.entries(fieldsToUpdate).forEach(([key, value]) => {
        if (value !== undefined) {
          updateFields.push(`${key} = $${paramIndex}`);
          updateValues.push(value);
          paramIndex++;
        }
      });

      if (updateFields.length > 0) {
        updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

        result = await db.query(`
          UPDATE company_settings
          SET ${updateFields.join(', ')}
          WHERE id = $${paramIndex}
          RETURNING *
        `, [...updateValues, existing.rows[0].id]);
      } else {
        result = existing;
      }
    }

    logger.info('Company settings updated successfully');

    res.json({
      success: true,
      message: 'Company settings updated successfully',
      company: result.rows[0]
    });
  } catch (error: any) {
    logger.error('Error updating company settings:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating company settings',
      error: error.message
    });
  }
});

export default router;

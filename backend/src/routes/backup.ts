import express, { Request, Response, NextFunction } from 'express';
import { authenticateToken, authorizeRole } from '../middleware/auth';
import {
  createDatabaseBackup,
  restoreDatabaseBackup,
  listBackups,
  deleteBackup,
  getBackupStats,
  exportDataToCSV,
} from '../utils/backup';
import { logger } from '../utils/logger';
import db from '../database';

const router = express.Router();

// Debug middleware to log user role
router.use((req: Request, res: Response, next: NextFunction) => {
  logger.info('Backup route accessed:', {
    user: req.user,
    headers: req.headers.authorization?.substring(0, 20) + '...'
  });
  next();
});

// All backup routes require admin role (case-insensitive)
router.use(authenticateToken, (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const userRole = req.user.role.toLowerCase();
  if (userRole !== 'admin') {
    logger.warn(`Access denied for user ${req.user.email} with role: ${req.user.role}`);
    return res.status(403).json({ error: 'Admin role required' });
  }

  next();
});

/**
 * Create a new database backup
 * POST /api/backup/create
 */
router.post('/create', async (req: Request, res: Response) => {
  try {
    logger.info('Manual backup requested by user');
    const result = await createDatabaseBackup();

    if (result.success) {
      res.json({
        success: true,
        message: 'Backup created successfully',
        backup: {
          filename: result.filename,
          size: result.size,
          sizeMB: ((result.size || 0) / (1024 * 1024)).toFixed(2),
        },
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Backup failed',
      });
    }
  } catch (error: any) {
    logger.error('Backup creation error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create backup',
    });
  }
});

/**
 * List all available backups
 * GET /api/backup/list
 */
router.get('/list', async (req: Request, res: Response) => {
  try {
    const backups = await listBackups();
    const stats = await getBackupStats();

    res.json({
      success: true,
      backups: backups.map(b => ({
        filename: b.filename,
        size: b.size,
        sizeMB: (b.size / (1024 * 1024)).toFixed(2),
        createdAt: b.createdAt,
      })),
      stats,
    });
  } catch (error: any) {
    logger.error('Failed to list backups:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to list backups',
    });
  }
});

/**
 * Restore database from a backup
 * POST /api/backup/restore
 */
router.post('/restore', async (req: Request, res: Response) => {
  try {
    const { filename } = req.body;

    if (!filename) {
      return res.status(400).json({
        success: false,
        error: 'Filename is required',
      });
    }

    logger.warn(`Database restore requested: ${filename}`);

    const result = await restoreDatabaseBackup(filename);

    if (result.success) {
      res.json({
        success: true,
        message: 'Database restored successfully',
        filename: result.filename,
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Restore failed',
      });
    }
  } catch (error: any) {
    logger.error('Restore error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to restore database',
    });
  }
});

/**
 * Delete a backup file
 * DELETE /api/backup/:filename
 */
router.delete('/:filename', async (req: Request, res: Response) => {
  try {
    const { filename } = req.params;

    const success = await deleteBackup(filename);

    if (success) {
      res.json({
        success: true,
        message: 'Backup deleted successfully',
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to delete backup',
      });
    }
  } catch (error: any) {
    logger.error('Delete backup error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete backup',
    });
  }
});

/**
 * Export contacts to CSV
 * GET /api/backup/export/contacts
 */
router.get('/export/contacts', async (req: Request, res: Response) => {
  try {
    const query = `
      SELECT
        first_name, last_name, email, phone, mobile,
        company_name, address_street, address_city, address_zip,
        address_country, type, discount_rate,
        created_at, updated_at
      FROM contacts
      WHERE is_active = true
      ORDER BY created_at DESC
    `;

    const result = await exportDataToCSV('contacts', query);

    if (result.success && result.filepath) {
      res.download(result.filepath, result.filename);
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Export failed',
      });
    }
  } catch (error: any) {
    logger.error('Export contacts error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to export contacts',
    });
  }
});

/**
 * Export products to CSV
 * GET /api/backup/export/products
 */
router.get('/export/products', async (req: Request, res: Response) => {
  try {
    const query = `
      SELECT
        p.name, p.sku, p.description, p.category,
        p.price, p.stock_quantity, p.reorder_point,
        p.supplier, p.is_active,
        c.name as category_name,
        p.created_at, p.updated_at
      FROM products p
      LEFT JOIN categories c ON p.category = c.id
      ORDER BY p.created_at DESC
    `;

    const result = await exportDataToCSV('products', query);

    if (result.success && result.filepath) {
      res.download(result.filepath, result.filename);
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Export failed',
      });
    }
  } catch (error: any) {
    logger.error('Export products error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to export products',
    });
  }
});

/**
 * Export quotations to CSV
 * GET /api/backup/export/quotations
 */
router.get('/export/quotations', async (req: Request, res: Response) => {
  try {
    const query = `
      SELECT
        q.quotation_number, q.status,
        c.first_name || ' ' || c.last_name as contact_name,
        c.company_name,
        q.subtotal, q.discount_amount, q.tax_amount, q.total_amount,
        q.quotation_date, q.expiration_date,
        q.created_at, q.updated_at
      FROM quotations q
      LEFT JOIN contacts c ON q.contact_id = c.id
      ORDER BY q.created_at DESC
    `;

    const result = await exportDataToCSV('quotations', query);

    if (result.success && result.filepath) {
      res.download(result.filepath, result.filename);
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Export failed',
      });
    }
  } catch (error: any) {
    logger.error('Export quotations error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to export quotations',
    });
  }
});

/**
 * Export sales orders to CSV
 * GET /api/backup/export/sales-orders
 */
router.get('/export/sales-orders', async (req: Request, res: Response) => {
  try {
    const query = `
      SELECT
        so.order_number, so.status,
        c.first_name || ' ' || c.last_name as contact_name,
        c.company_name,
        so.subtotal, so.discount_amount, so.tax_amount, so.total_amount,
        so.down_payment_amount, so.down_payment_method, so.down_payment_date,
        so.order_date, so.expected_delivery_date,
        so.created_at, so.updated_at
      FROM sales_orders so
      LEFT JOIN contacts c ON so.contact_id = c.id
      ORDER BY so.created_at DESC
    `;

    const result = await exportDataToCSV('sales_orders', query);

    if (result.success && result.filepath) {
      res.download(result.filepath, result.filename);
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Export failed',
      });
    }
  } catch (error: any) {
    logger.error('Export sales orders error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to export sales orders',
    });
  }
});

/**
 * Export invoices to CSV
 * GET /api/backup/export/invoices
 */
router.get('/export/invoices', async (req: Request, res: Response) => {
  try {
    const query = `
      SELECT
        i.invoice_number, i.status,
        c.first_name || ' ' || c.last_name as contact_name,
        c.company_name,
        i.subtotal, i.discount_amount, i.tax_amount, i.total_amount,
        i.amount_paid, i.amount_due,
        i.invoice_date, i.due_date, i.payment_date,
        i.payment_method,
        i.created_at, i.updated_at
      FROM invoices i
      LEFT JOIN contacts c ON i.contact_id = c.id
      ORDER BY i.created_at DESC
    `;

    const result = await exportDataToCSV('invoices', query);

    if (result.success && result.filepath) {
      res.download(result.filepath, result.filename);
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Export failed',
      });
    }
  } catch (error: any) {
    logger.error('Export invoices error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to export invoices',
    });
  }
});

export default router;

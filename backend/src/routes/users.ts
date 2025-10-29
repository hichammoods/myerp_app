import { Router, Request, Response } from 'express';
import { db } from '../database/connection';
import { authenticateToken, authorizeRole, hashPassword } from '../middleware/auth';
import { logger } from '../utils/logger';
import crypto from 'crypto';

const router = Router();

// Helper function to generate random password
const generateRandomPassword = (length: number = 12): string => {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  const randomBytes = crypto.randomBytes(length);

  for (let i = 0; i < length; i++) {
    password += charset[randomBytes[i] % charset.length];
  }

  return password;
};

// Get all users (admin only)
router.get('/', authenticateToken, authorizeRole('admin'), async (req: Request, res: Response) => {
  try {
    const { search, role, status } = req.query;

    let query = `
      SELECT
        u.id, u.email, u.first_name, u.last_name, u.role,
        u.is_active, u.suspended, u.suspended_at, u.suspended_by,
        u.phone, u.avatar_url, u.last_login, u.must_change_password,
        u.created_at, u.updated_at,
        suspender.first_name as suspended_by_first_name,
        suspender.last_name as suspended_by_last_name
      FROM users u
      LEFT JOIN users suspender ON u.suspended_by = suspender.id
      WHERE u.is_active = true
    `;

    const params: any[] = [];
    let paramCount = 0;

    if (search) {
      paramCount++;
      query += ` AND (u.email ILIKE $${paramCount} OR u.first_name ILIKE $${paramCount} OR u.last_name ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    if (role) {
      paramCount++;
      query += ` AND u.role = $${paramCount}`;
      params.push(role);
    }

    if (status === 'suspended') {
      query += ` AND u.suspended = true`;
    } else if (status === 'active') {
      query += ` AND u.suspended = false`;
    }

    query += ` ORDER BY u.created_at DESC`;

    const result = await db.query(query, params);

    res.json({
      users: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    logger.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get single user (admin only)
router.get('/:id', authenticateToken, authorizeRole('admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT
        u.id, u.email, u.first_name, u.last_name, u.role,
        u.is_active, u.suspended, u.suspended_at, u.suspended_by,
        u.phone, u.avatar_url, u.last_login, u.must_change_password,
        u.created_at, u.updated_at,
        suspender.first_name as suspended_by_first_name,
        suspender.last_name as suspended_by_last_name
      FROM users u
      LEFT JOIN users suspender ON u.suspended_by = suspender.id
      WHERE u.id = $1 AND u.is_active = true`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Create user (admin only)
router.post('/', authenticateToken, authorizeRole('admin'), async (req: Request, res: Response) => {
  try {
    const {
      email,
      first_name,
      last_name,
      role,
      phone,
      generate_password = true,
      password,
    } = req.body;

    // Validate required fields
    if (!email || !first_name || !last_name || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate role
    if (!['admin', 'sales', 'inventory_manager'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Check if email already exists
    const existingUser = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    // Generate or use provided password
    const plainPassword = generate_password ? generateRandomPassword() : password;
    if (!plainPassword) {
      return res.status(400).json({ error: 'Password is required' });
    }

    const passwordHash = await hashPassword(plainPassword);

    // Insert user
    const result = await db.query(
      `INSERT INTO users (
        email, password_hash, first_name, last_name, role, phone,
        is_active, suspended, must_change_password
      ) VALUES ($1, $2, $3, $4, $5, $6, true, false, $7)
      RETURNING id, email, first_name, last_name, role, phone, is_active,
                suspended, must_change_password, created_at`,
      [email, passwordHash, first_name, last_name, role, phone || null, generate_password]
    );

    logger.info(`User created: ${email} by ${req.user?.email}`);

    res.status(201).json({
      user: result.rows[0],
      // Only return password if it was generated
      ...(generate_password && { generated_password: plainPassword }),
    });
  } catch (error) {
    logger.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Update user (admin only)
router.put('/:id', authenticateToken, authorizeRole('admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { email, first_name, last_name, role, phone } = req.body;

    // Validate role if provided
    if (role && !['admin', 'sales', 'inventory_manager'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Check if user exists
    const existingUser = await db.query(
      'SELECT id FROM users WHERE id = $1 AND is_active = true',
      [id]
    );
    if (existingUser.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if email is taken by another user
    if (email) {
      const emailCheck = await db.query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email, id]
      );
      if (emailCheck.rows.length > 0) {
        return res.status(400).json({ error: 'Email already exists' });
      }
    }

    // Build update query
    const updates: string[] = [];
    const params: any[] = [];
    let paramCount = 0;

    if (email) {
      paramCount++;
      updates.push(`email = $${paramCount}`);
      params.push(email);
    }
    if (first_name) {
      paramCount++;
      updates.push(`first_name = $${paramCount}`);
      params.push(first_name);
    }
    if (last_name) {
      paramCount++;
      updates.push(`last_name = $${paramCount}`);
      params.push(last_name);
    }
    if (role) {
      paramCount++;
      updates.push(`role = $${paramCount}`);
      params.push(role);
    }
    if (phone !== undefined) {
      paramCount++;
      updates.push(`phone = $${paramCount}`);
      params.push(phone || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    paramCount++;
    params.push(id);

    const query = `
      UPDATE users
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE id = $${paramCount}
      RETURNING id, email, first_name, last_name, role, phone, is_active,
                suspended, must_change_password, updated_at
    `;

    const result = await db.query(query, params);

    logger.info(`User updated: ${id} by ${req.user?.email}`);

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Suspend user (admin only)
router.post('/:id/suspend', authenticateToken, authorizeRole('admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Cannot suspend yourself
    if (id === req.user?.id) {
      return res.status(400).json({ error: 'Cannot suspend yourself' });
    }

    const result = await db.query(
      `UPDATE users
       SET suspended = true, suspended_at = NOW(), suspended_by = $1, updated_at = NOW()
       WHERE id = $2 AND is_active = true
       RETURNING id, email, first_name, last_name, suspended, suspended_at`,
      [req.user?.id, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    logger.info(`User suspended: ${id} by ${req.user?.email}`);

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error suspending user:', error);
    res.status(500).json({ error: 'Failed to suspend user' });
  }
});

// Unsuspend user (admin only)
router.post('/:id/unsuspend', authenticateToken, authorizeRole('admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `UPDATE users
       SET suspended = false, suspended_at = NULL, suspended_by = NULL, updated_at = NOW()
       WHERE id = $1 AND is_active = true
       RETURNING id, email, first_name, last_name, suspended`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    logger.info(`User unsuspended: ${id} by ${req.user?.email}`);

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error unsuspending user:', error);
    res.status(500).json({ error: 'Failed to unsuspend user' });
  }
});

// Delete user (admin only - soft delete)
router.delete('/:id', authenticateToken, authorizeRole('admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Cannot delete yourself
    if (id === req.user?.id) {
      return res.status(400).json({ error: 'Cannot delete yourself' });
    }

    const result = await db.query(
      `UPDATE users
       SET is_active = false, deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND is_active = true
       RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    logger.info(`User deleted: ${id} by ${req.user?.email}`);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    logger.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Reset password (admin only)
router.post('/:id/reset-password', authenticateToken, authorizeRole('admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { password, generate_password = true } = req.body;

    // Generate or use provided password
    const plainPassword = generate_password ? generateRandomPassword() : password;
    if (!plainPassword) {
      return res.status(400).json({ error: 'Password is required' });
    }

    const passwordHash = await hashPassword(plainPassword);

    const result = await db.query(
      `UPDATE users
       SET password_hash = $1, must_change_password = true, updated_at = NOW()
       WHERE id = $2 AND is_active = true
       RETURNING id, email, first_name, last_name`,
      [passwordHash, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    logger.info(`Password reset for user: ${id} by ${req.user?.email}`);

    res.json({
      message: 'Password reset successfully',
      generated_password: generate_password ? plainPassword : undefined,
    });
  } catch (error) {
    logger.error('Error resetting password:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Get available roles
router.get('/meta/roles', authenticateToken, async (req: Request, res: Response) => {
  res.json({
    roles: [
      {
        value: 'admin',
        label: 'Administrateur',
        description: 'Accès complet à toutes les fonctionnalités',
        permissions: ['all'],
      },
      {
        value: 'sales',
        label: 'Commercial',
        description: 'Accès à toutes les sections sauf Paramètres (création et édition uniquement)',
        permissions: ['contacts', 'quotations', 'sales_orders', 'invoices', 'products', 'inventory'],
        restrictions: ['no_delete', 'no_settings'],
      },
      {
        value: 'inventory_manager',
        label: 'Gestionnaire de Stock',
        description: 'Accès uniquement aux produits et au stock',
        permissions: ['products', 'inventory'],
      },
    ],
  });
});

export default router;

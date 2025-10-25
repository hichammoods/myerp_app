import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { db } from '../database/connection';
import { logger } from '../utils/logger';
import {
  generateTokens,
  hashPassword,
  comparePassword,
  authenticateToken,
  refreshAccessToken,
  logout,
  createSession,
  clearUserSessions
} from '../middleware/auth';

const router = Router();

// Register new user
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).matches(/^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]/),
  body('first_name').notEmpty().trim(),
  body('last_name').notEmpty().trim(),
  body('phone').optional().isMobilePhone('any'),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, first_name, last_name, phone } = req.body;

    // Check if user exists
    const existingUser = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const result = await db.query(
      `INSERT INTO users (
        email, password_hash, first_name, last_name, phone,
        role, is_active, email_verified
      ) VALUES ($1, $2, $3, $4, $5, 'sales', true, false)
      RETURNING id, email, first_name, last_name, role`,
      [email, hashedPassword, first_name, last_name, phone]
    );

    const user = result.rows[0];

    // Generate tokens
    const tokens = generateTokens(user);

    // Create session
    const sessionId = await createSession(user.id, {
      userAgent: req.headers['user-agent'],
      ip: req.ip
    });

    logger.info(`New user registered: ${email}`);

    res.status(201).json({
      message: 'Registration successful',
      user: {
        id: user.id,
        email: user.email,
        name: `${user.first_name} ${user.last_name}`,
        role: user.role
      },
      ...tokens,
      sessionId
    });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// Login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Get user
    const result = await db.query(
      `SELECT id, email, password_hash, first_name, last_name, role, is_active
       FROM users WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];

    // Check if user is active
    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is not active' });
    }

    // Verify password
    const isValid = await comparePassword(password, user.password_hash);
    if (!isValid) {
      // Log failed attempt (table doesn't exist yet)
      // await db.query(
      //   `INSERT INTO login_attempts (user_id, ip_address, success)
      //    VALUES ($1, $2, false)`,
      //   [user.id, req.ip]
      // );
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Update last login
    await db.query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    // Log successful login (table doesn't exist yet)
    // await db.query(
    //   `INSERT INTO login_attempts (user_id, ip_address, success)
    //    VALUES ($1, $2, true)`,
    //   [user.id, req.ip]
    // );

    // Clear old sessions if needed
    await clearUserSessions(user.id);

    // Generate tokens
    const tokens = generateTokens(user);

    // Create new session
    const sessionId = await createSession(user.id, {
      userAgent: req.headers['user-agent'],
      ip: req.ip
    });

    logger.info(`User logged in: ${email}`);

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: `${user.first_name} ${user.last_name}`,
        role: user.role
      },
      ...tokens,
      sessionId
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

// Refresh token
router.post('/refresh', refreshAccessToken);

// Logout
router.post('/logout', authenticateToken, logout);

// Get current user
router.get('/me', authenticateToken, async (req: Request, res: Response) => {
  try {
    const result = await db.query(
      `SELECT id, email, first_name, last_name, phone, role,
              created_at, last_login, email_verified
       FROM users WHERE id = $1`,
      [req.user!.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    res.json({
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      phone: user.phone,
      role: user.role,
      createdAt: user.created_at,
      lastLogin: user.last_login,
      emailVerified: user.email_verified
    });
  } catch (error) {
    logger.error('Get current user error:', error);
    res.status(500).json({ error: 'Failed to fetch user data' });
  }
});

// Update password
router.post('/change-password', authenticateToken, [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 8 }).matches(/^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]/),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { currentPassword, newPassword } = req.body;

    // Get user's current password hash
    const result = await db.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user!.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isValid = await comparePassword(currentPassword, result.rows[0].password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password
    await db.query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [hashedPassword, req.user!.id]
    );

    // Clear all sessions for security
    await clearUserSessions(req.user!.id);

    logger.info(`Password changed for user: ${req.user!.email}`);

    res.json({ message: 'Password changed successfully. Please login again.' });
  } catch (error) {
    logger.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Request password reset
router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail(),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email } = req.body;

    // Check if user exists
    const result = await db.query(
      'SELECT id, first_name FROM users WHERE email = $1 AND is_active = $2',
      [email, true]
    );

    // Always return success to prevent email enumeration
    if (result.rows.length > 0) {
      const user = result.rows[0];

      // Generate reset token (you would normally send this via email)
      const resetToken = require('crypto').randomBytes(32).toString('hex');
      const resetExpiry = new Date(Date.now() + 3600000); // 1 hour

      // Store reset token
      await db.query(
        `UPDATE users
         SET reset_token = $1, reset_token_expiry = $2
         WHERE id = $3`,
        [resetToken, resetExpiry, user.id]
      );

      // TODO: Send email with reset link
      logger.info(`Password reset requested for: ${email}`);

      // In development, return the token (remove in production!)
      if (process.env.NODE_ENV === 'development') {
        return res.json({
          message: 'Password reset email sent',
          resetToken // Remove this in production!
        });
      }
    }

    res.json({ message: 'If the email exists, a password reset link has been sent.' });
  } catch (error) {
    logger.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process password reset request' });
  }
});

// Reset password
router.post('/reset-password', [
  body('token').notEmpty(),
  body('newPassword').isLength({ min: 8 }).matches(/^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]/),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { token, newPassword } = req.body;

    // Find user with valid reset token
    const result = await db.query(
      `SELECT id FROM users
       WHERE reset_token = $1
       AND reset_token_expiry > CURRENT_TIMESTAMP`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const userId = result.rows[0].id;

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password and clear reset token
    await db.query(
      `UPDATE users
       SET password_hash = $1,
           reset_token = NULL,
           reset_token_expiry = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [hashedPassword, userId]
    );

    // Clear all sessions
    await clearUserSessions(userId);

    logger.info(`Password reset completed for user ID: ${userId}`);

    res.json({ message: 'Password reset successful. Please login with your new password.' });
  } catch (error) {
    logger.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Verify email
router.get('/verify-email/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    const result = await db.query(
      `UPDATE users
       SET email_verified = true,
           email_verification_token = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE email_verification_token = $1
       RETURNING id, email`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid verification token' });
    }

    logger.info(`Email verified for: ${result.rows[0].email}`);

    res.json({ message: 'Email verified successfully' });
  } catch (error) {
    logger.error('Email verification error:', error);
    res.status(500).json({ error: 'Failed to verify email' });
  }
});

export default router;
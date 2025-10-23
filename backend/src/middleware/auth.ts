import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db } from '../database/connection';
import { redisClient } from '../database/redis';
import { logger } from '../utils/logger';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
        name: string;
      };
    }
  }
}

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';
const REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || '7d';

// Token blacklist in Redis
const BLACKLIST_PREFIX = 'blacklist:token:';

// Generate tokens
export const generateTokens = (user: any) => {
  const accessToken = jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      name: `${user.first_name} ${user.last_name}`
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );

  const refreshToken = jwt.sign(
    { id: user.id, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );

  return { accessToken, refreshToken };
};

// Hash password
export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

// Compare password
export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

// Authenticate token middleware
export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    // Check if token is blacklisted (with timeout)
    try {
      const isBlacklisted = await Promise.race([
        redisClient.get(`${BLACKLIST_PREFIX}${token}`),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Redis timeout')), 1000))
      ]);
      if (isBlacklisted) {
        return res.status(401).json({ error: 'Token has been revoked' });
      }
    } catch (redisError) {
      logger.warn('Redis check failed, continuing without blacklist check:', redisError);
      // Continue without blacklist check if Redis fails
    }

    // Verify token
    jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
      if (err) {
        if (err.name === 'TokenExpiredError') {
          return res.status(401).json({ error: 'Token expired' });
        }
        return res.status(403).json({ error: 'Invalid token' });
      }

      req.user = decoded;
      next();
    });
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

// Authorize role middleware
export const authorizeRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

// Refresh token
export const refreshAccessToken = async (
  req: Request,
  res: Response
) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required' });
    }

    // Verify refresh token
    jwt.verify(refreshToken, JWT_SECRET, async (err: any, decoded: any) => {
      if (err || decoded.type !== 'refresh') {
        return res.status(403).json({ error: 'Invalid refresh token' });
      }

      // Get user from database
      const result = await db.query(
        'SELECT id, email, role, first_name, last_name FROM users WHERE id = $1 AND status = $2',
        [decoded.id, 'active']
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found or inactive' });
      }

      const user = result.rows[0];
      const tokens = generateTokens(user);

      res.json(tokens);
    });
  } catch (error) {
    logger.error('Refresh token error:', error);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
};

// Logout (blacklist token)
export const logout = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      // Decode token to get expiry
      const decoded: any = jwt.decode(token);
      if (decoded && decoded.exp) {
        const ttl = decoded.exp - Math.floor(Date.now() / 1000);
        if (ttl > 0) {
          // Add token to blacklist with TTL
          await redisClient.setex(`${BLACKLIST_PREFIX}${token}`, ttl, 'true');
        }
      }
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({ error: 'Failed to logout' });
  }
};

// Rate limiting middleware
export const rateLimiter = (maxRequests: number = 100, windowMs: number = 60000) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const identifier = req.user?.id || req.ip;
      const key = `rate_limit:${identifier}`;

      const current = await redisClient.incr(key);

      if (current === 1) {
        // Set expiry on first request
        await redisClient.expire(key, Math.ceil(windowMs / 1000));
      }

      if (current > maxRequests) {
        return res.status(429).json({
          error: 'Too many requests',
          retryAfter: Math.ceil(windowMs / 1000)
        });
      }

      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit', maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - current).toString());

      next();
    } catch (error) {
      logger.error('Rate limiting error:', error);
      // Continue even if rate limiting fails
      next();
    }
  };
};

// Session management
export const createSession = async (userId: string, deviceInfo: any) => {
  const sessionId = `session:${userId}:${Date.now()}`;
  const sessionData = {
    userId,
    deviceInfo,
    createdAt: new Date().toISOString(),
    lastActivity: new Date().toISOString()
  };

  // Store session for 7 days
  await redisClient.setex(sessionId, 7 * 24 * 60 * 60, JSON.stringify(sessionData));

  return sessionId;
};

// Update session activity
export const updateSessionActivity = async (sessionId: string) => {
  const sessionData = await redisClient.get(sessionId);
  if (sessionData) {
    const data = JSON.parse(sessionData);
    data.lastActivity = new Date().toISOString();
    await redisClient.setex(sessionId, 7 * 24 * 60 * 60, JSON.stringify(data));
  }
};

// Validate session
export const validateSession = async (sessionId: string): Promise<boolean> => {
  const sessionData = await redisClient.get(sessionId);
  return !!sessionData;
};

// Clear user sessions
export const clearUserSessions = async (userId: string) => {
  const keys = await redisClient.keys(`session:${userId}:*`);
  if (keys.length > 0) {
    await redisClient.del(...keys);
  }
};
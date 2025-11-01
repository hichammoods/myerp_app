import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticationError, AuthorizationError } from './error.middleware';
import { redis } from '../database/redis';
import { logger } from '../utils/logger';

export interface JWTPayload {
  id: string;
  email: string;
  role: 'admin' | 'sales' | 'viewer';
  name?: string;
  iat?: number;
  exp?: number;
}

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
      token?: string;
    }
  }
}

/**
 * Verify JWT token and attach user to request
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('No token provided');
    }

    const token = authHeader.substring(7);

    // Check if token is blacklisted (for logout functionality)
    const isBlacklisted = await redis.exists(`blacklist:${token}`);
    if (isBlacklisted) {
      throw new AuthenticationError('Token has been revoked');
    }

    // Verify token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    ) as JWTPayload;

    // Check if user session exists in Redis (optional additional security)
    if (process.env.USE_SESSION_VALIDATION === 'true') {
      const session = await redis.getSession(decoded.id);
      if (!session) {
        throw new AuthenticationError('Session expired');
      }
    }

    // Attach user to request
    req.user = decoded;
    req.token = token;

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      next(new AuthenticationError('Token expired'));
    } else if (error instanceof jwt.JsonWebTokenError) {
      next(new AuthenticationError('Invalid token'));
    } else if (error instanceof AuthenticationError) {
      next(error);
    } else {
      logger.error('Authentication error:', error);
      next(new AuthenticationError('Authentication failed'));
    }
  }
};

/**
 * Optional authentication - doesn't fail if no token provided
 */
export const authenticateOptional = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token provided, continue without user
      return next();
    }

    const token = authHeader.substring(7);

    // Check if token is blacklisted
    const isBlacklisted = await redis.exists(`blacklist:${token}`);
    if (isBlacklisted) {
      return next();
    }

    // Try to verify token
    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET as string
      ) as JWTPayload;

      req.user = decoded;
      req.token = token;
    } catch {
      // Invalid token, continue without user
    }

    next();
  } catch (error) {
    logger.error('Optional authentication error:', error);
    next();
  }
};

/**
 * Check if user has required role(s)
 */
export const authorize = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AuthenticationError('Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AuthorizationError(
          `Access denied. Required roles: ${allowedRoles.join(', ')}`
        )
      );
    }

    next();
  };
};

/**
 * Check if user is admin
 */
export const adminOnly = authorize('admin');

/**
 * Check if user is admin or sales
 */
export const salesOrAdmin = authorize('admin', 'sales');

/**
 * Check if user owns the resource or is admin
 */
export const ownerOrAdmin = (userIdField: string = 'userId') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AuthenticationError('Authentication required'));
    }

    const resourceUserId = req.params[userIdField] || req.body[userIdField];

    if (req.user.role === 'admin' || req.user.id === resourceUserId) {
      return next();
    }

    next(new AuthorizationError('Access denied'));
  };
};

/**
 * Refresh token validation
 */
export const validateRefreshToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new AuthenticationError('Refresh token required');
    }

    // Check if refresh token is blacklisted
    const isBlacklisted = await redis.exists(`blacklist:refresh:${refreshToken}`);
    if (isBlacklisted) {
      throw new AuthenticationError('Refresh token has been revoked');
    }

    // Verify refresh token
    const decoded = jwt.verify(
      refreshToken,
      process.env.REFRESH_TOKEN_SECRET as string
    ) as JWTPayload;

    // Attach decoded data to request
    req.user = decoded;
    req.token = refreshToken;

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      next(new AuthenticationError('Refresh token expired'));
    } else if (error instanceof jwt.JsonWebTokenError) {
      next(new AuthenticationError('Invalid refresh token'));
    } else if (error instanceof AuthenticationError) {
      next(error);
    } else {
      logger.error('Refresh token validation error:', error);
      next(new AuthenticationError('Refresh token validation failed'));
    }
  }
};

/**
 * API Key authentication for external services
 */
export const authenticateApiKey = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const apiKey = req.headers['x-api-key'] as string;

    if (!apiKey) {
      throw new AuthenticationError('API key required');
    }

    // Validate API key (in production, check against database)
    const validApiKeys = (process.env.VALID_API_KEYS || '').split(',');

    if (!validApiKeys.includes(apiKey)) {
      throw new AuthenticationError('Invalid API key');
    }

    // You might want to attach API key owner information to request
    req.user = {
      id: 'api-key-user',
      email: 'api@myerp.com',
      role: 'admin', // Or specific role for API keys
    };

    next();
  } catch (error) {
    if (error instanceof AuthenticationError) {
      next(error);
    } else {
      logger.error('API key authentication error:', error);
      next(new AuthenticationError('API key authentication failed'));
    }
  }
};
import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { RedisConnection } from '../database/redis';
import { RateLimitError } from './error.middleware';

// Create a custom store using Redis for distributed rate limiting
class RedisStore {
  private prefix: string = 'rate_limit:';

  async incr(key: string): Promise<{ current: number; ttl: number }> {
    const redisKey = this.prefix + key;
    const client = RedisConnection.getClient();

    const multi = client.multi();
    multi.incr(redisKey);
    multi.ttl(redisKey);

    const results = await multi.exec();

    if (!results) {
      throw new Error('Redis transaction failed');
    }

    const current = results[0][1] as number;
    const ttl = results[1][1] as number;

    return { current, ttl };
  }

  async decrement(key: string): Promise<void> {
    const redisKey = this.prefix + key;
    await RedisConnection.getClient().decr(redisKey);
  }

  async resetKey(key: string): Promise<void> {
    const redisKey = this.prefix + key;
    await RedisConnection.getClient().del(redisKey);
  }

  async setExpiry(key: string, windowMs: number): Promise<void> {
    const redisKey = this.prefix + key;
    const ttlSeconds = Math.ceil(windowMs / 1000);
    await RedisConnection.getClient().expire(redisKey, ttlSeconds);
  }
}

// Create different rate limiters for different endpoints
export const rateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '15') * 60 * 1000, // 15 minutes default
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // 100 requests per window
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false, // Disable X-RateLimit headers
  skipSuccessfulRequests: false,
  skipFailedRequests: false,

  // Use Redis store if available, otherwise use memory store
  store: process.env.REDIS_URL || process.env.REDIS_HOST
    ? {
        incr: async (key: string) => {
          const store = new RedisStore();
          const result = await store.incr(key);

          // Set expiry on first request
          if (result.current === 1 || result.ttl === -1) {
            await store.setExpiry(key, parseInt(process.env.RATE_LIMIT_WINDOW || '15') * 60 * 1000);
          }

          return result.current;
        },
        decrement: async (key: string) => {
          const store = new RedisStore();
          await store.decrement(key);
        },
        resetKey: async (key: string) => {
          const store = new RedisStore();
          await store.resetKey(key);
        },
      }
    : undefined,

  keyGenerator: (req: Request): string => {
    // Use IP address as default key
    // Can be customized to include user ID for authenticated requests
    const userId = (req as any).user?.id;
    const ip = req.ip || req.connection.remoteAddress || 'unknown';

    if (userId) {
      return `user:${userId}`;
    }

    return `ip:${ip}`;
  },

  handler: (req: Request, res: Response) => {
    throw new RateLimitError('Too many requests, please try again later');
  },
});

// Strict rate limiter for authentication endpoints
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests

  keyGenerator: (req: Request): string => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    return `auth:${ip}`;
  },
});

// Relaxed rate limiter for read operations
export const readRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  message: 'Too many requests, please slow down',
  standardHeaders: true,
  legacyHeaders: false,

  keyGenerator: (req: Request): string => {
    const userId = (req as any).user?.id;
    const ip = req.ip || req.connection.remoteAddress || 'unknown';

    if (userId) {
      return `read:user:${userId}`;
    }

    return `read:ip:${ip}`;
  },
});

// Strict rate limiter for write operations
export const writeRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20, // 20 requests per minute
  message: 'Too many write operations, please slow down',
  standardHeaders: true,
  legacyHeaders: false,

  keyGenerator: (req: Request): string => {
    const userId = (req as any).user?.id;
    const ip = req.ip || req.connection.remoteAddress || 'unknown';

    if (userId) {
      return `write:user:${userId}`;
    }

    return `write:ip:${ip}`;
  },
});

// File upload rate limiter
export const uploadRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 uploads per hour
  message: 'Too many file uploads, please try again later',
  standardHeaders: true,
  legacyHeaders: false,

  keyGenerator: (req: Request): string => {
    const userId = (req as any).user?.id;
    const ip = req.ip || req.connection.remoteAddress || 'unknown';

    if (userId) {
      return `upload:user:${userId}`;
    }

    return `upload:ip:${ip}`;
  },
});
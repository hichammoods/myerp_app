import Redis from 'ioredis';
import { logger } from '../utils/logger';

class RedisConnectionManager {
  private client: Redis | null = null;
  private subscriber: Redis | null = null;
  private publisher: Redis | null = null;

  private getConfig() {
    const redisUrl = process.env.REDIS_URL;

    if (redisUrl) {
      return redisUrl;
    }

    return {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || 'myerp_redis_password',
      db: parseInt(process.env.REDIS_DB || '0'),
      retryStrategy: (times: number) => {
        if (times > 3) {
          logger.error('Redis connection failed after 3 attempts - disabling Redis');
          return null; // Stop retrying
        }
        return Math.min(times * 100, 3000);
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true, // Don't connect immediately
      reconnectOnError: false,
    };
  }

  async initialize(): Promise<void> {
    try {
      const config = this.getConfig();

      // Main client for general operations
      this.client = new Redis(config as any);

      // Set up event handlers but don't let them crash the app
      this.setupEventHandlers(this.client, 'main');

      // Try to connect
      await this.client.connect();

      // Test the connection
      await this.client.ping();

      // Separate clients for pub/sub if needed
      if (process.env.ENABLE_PUBSUB === 'true') {
        this.subscriber = new Redis(config as any);
        this.publisher = new Redis(config as any);
      }

    } catch (error) {
      logger.error('Failed to initialize Redis connection:', error);
      // Don't throw - let app run without Redis
      this.client = null;
      this.subscriber = null;
      this.publisher = null;
    }
  }

  private setupEventHandlers(client: Redis, name: string): void {
    client.on('connect', () => {
      logger.info(`Redis ${name} client connected`);
    });

    client.on('ready', () => {
      logger.debug(`Redis ${name} client ready`);
    });

    client.on('error', (error) => {
      // Don't spam logs with connection errors
      if (!error.message?.includes('ECONNREFUSED')) {
        logger.error(`Redis ${name} client error:`, error);
      }
    });

    client.on('close', () => {
      logger.warn(`Redis ${name} client connection closed`);
    });

    client.on('reconnecting', () => {
      logger.info(`Redis ${name} client reconnecting...`);
    });
  }

  getClient(): Redis | null {
    return this.client;
  }

  getSubscriber(): Redis | null {
    return this.subscriber;
  }

  getPublisher(): Redis | null {
    return this.publisher;
  }

  async close(): Promise<void> {
    const clients = [this.client, this.subscriber, this.publisher].filter(Boolean);

    await Promise.all(
      clients.map(client => client?.quit())
    );

    this.client = null;
    this.subscriber = null;
    this.publisher = null;

    logger.info('Redis connections closed');
  }

  async isHealthy(): Promise<boolean> {
    try {
      if (!this.client) return false;
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  // Session management helpers
  async setSession(sessionId: string, data: any, ttl: number = 3600): Promise<void> {
    if (!this.client) {
      logger.debug('Redis not available - session not stored');
      return;
    }
    await this.client.setex(`session:${sessionId}`, ttl, JSON.stringify(data));
  }

  async getSession(sessionId: string): Promise<any | null> {
    if (!this.client) {
      logger.debug('Redis not available - session not retrieved');
      return null;
    }
    const data = await this.client.get(`session:${sessionId}`);
    return data ? JSON.parse(data) : null;
  }

  async deleteSession(sessionId: string): Promise<void> {
    if (!this.client) {
      logger.debug('Redis not available - session not deleted');
      return;
    }
    await this.client.del(`session:${sessionId}`);
  }

  // Cache helpers
  async setCache(key: string, value: any, ttl: number = 300): Promise<void> {
    if (!this.client) {
      logger.debug('Redis not available - cache not stored');
      return;
    }
    await this.client.setex(`cache:${key}`, ttl, JSON.stringify(value));
  }

  async getCache(key: string): Promise<any | null> {
    if (!this.client) {
      logger.debug('Redis not available - cache not retrieved');
      return null;
    }
    const data = await this.client.get(`cache:${key}`);
    return data ? JSON.parse(data) : null;
  }

  async invalidateCache(pattern: string): Promise<void> {
    if (!this.client) {
      logger.debug('Redis not available - cache not invalidated');
      return;
    }
    const keys = await this.client.keys(`cache:${pattern}`);
    if (keys.length > 0) {
      await this.client.del(...keys);
    }
  }

  // Rate limiting helpers
  async incrementRateLimit(identifier: string, windowSeconds: number = 60): Promise<number> {
    if (!this.client) {
      // If Redis is not available, allow all requests (no rate limiting)
      return 0;
    }
    const key = `rate_limit:${identifier}:${Math.floor(Date.now() / (windowSeconds * 1000))}`;
    const result = await this.client.incr(key);
    await this.client.expire(key, windowSeconds);
    return result;
  }
}

// Export singleton instance
export const RedisConnection = new RedisConnectionManager();

// Export helper functions
export const redis = {
  get: (key: string) => {
    const client = RedisConnection.getClient();
    return client ? client.get(key) : Promise.resolve(null);
  },
  set: (key: string, value: string, ttl?: number) => {
    const client = RedisConnection.getClient();
    if (!client) return Promise.resolve(null);
    if (ttl) {
      return client.setex(key, ttl, value);
    }
    return client.set(key, value);
  },
  del: (key: string) => {
    const client = RedisConnection.getClient();
    return client ? client.del(key) : Promise.resolve(0);
  },
  exists: (key: string) => {
    const client = RedisConnection.getClient();
    return client ? client.exists(key) : Promise.resolve(0);
  },
  expire: (key: string, seconds: number) => {
    const client = RedisConnection.getClient();
    return client ? client.expire(key, seconds) : Promise.resolve(0);
  },
  ttl: (key: string) => {
    const client = RedisConnection.getClient();
    return client ? client.ttl(key) : Promise.resolve(-2);
  },
  setex: (key: string, seconds: number, value: string) => {
    const client = RedisConnection.getClient();
    return client ? client.setex(key, seconds, value) : Promise.resolve(null);
  },
  incr: (key: string) => {
    const client = RedisConnection.getClient();
    return client ? client.incr(key) : Promise.resolve(0);
  },
  keys: (pattern: string) => {
    const client = RedisConnection.getClient();
    return client ? client.keys(pattern) : Promise.resolve([]);
  },

  // Session helpers
  setSession: (sessionId: string, data: any, ttl?: number) =>
    RedisConnection.setSession(sessionId, data, ttl),
  getSession: (sessionId: string) => RedisConnection.getSession(sessionId),
  deleteSession: (sessionId: string) => RedisConnection.deleteSession(sessionId),

  // Cache helpers
  setCache: (key: string, value: any, ttl?: number) =>
    RedisConnection.setCache(key, value, ttl),
  getCache: (key: string) => RedisConnection.getCache(key),
  invalidateCache: (pattern: string) => RedisConnection.invalidateCache(pattern),
};

// Export as redisClient for backwards compatibility
export const redisClient = redis;
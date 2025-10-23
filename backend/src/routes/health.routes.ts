import { Router, Request, Response } from 'express';
import { DatabaseConnection } from '../database/connection';
import { RedisConnection } from '../database/redis';

const router = Router();

/**
 * Health check endpoint
 * Returns the health status of the application and its dependencies
 */
router.get('/', async (req: Request, res: Response) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'MyERP API',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV,
    checks: {
      database: false,
      redis: false,
      memory: false,
    },
  };

  let isHealthy = true;

  // Check database connection
  try {
    const dbHealthy = await DatabaseConnection.isHealthy();
    health.checks.database = dbHealthy;
    if (!dbHealthy) isHealthy = false;
  } catch (error) {
    health.checks.database = false;
    isHealthy = false;
  }

  // Check Redis connection
  try {
    const redisHealthy = await RedisConnection.isHealthy();
    health.checks.redis = redisHealthy;
    if (!redisHealthy) isHealthy = false;
  } catch (error) {
    health.checks.redis = false;
    isHealthy = false;
  }

  // Check memory usage
  const memUsage = process.memoryUsage();
  const heapUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
  health.checks.memory = heapUsedPercent < 90; // Alert if memory usage is above 90%

  if (heapUsedPercent >= 90) {
    isHealthy = false;
  }

  // Overall status
  health.status = isHealthy ? 'healthy' : 'unhealthy';

  // Return appropriate status code
  res.status(isHealthy ? 200 : 503).json(health);
});

/**
 * Simple ping endpoint for basic availability check
 */
router.get('/ping', (req: Request, res: Response) => {
  res.json({ pong: true, timestamp: new Date().toISOString() });
});

export { router as healthRouter };
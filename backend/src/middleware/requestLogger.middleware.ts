import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();

  // Log request
  logger.http(`${req.method} ${req.path}`, {
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    userId: (req as any).user?.id,
  });

  // Capture the original end function
  const originalEnd = res.end;

  // Override the end function
  res.end = function (...args: any[]): Response {
    // Calculate response time
    const responseTime = Date.now() - start;

    // Log response
    logger.http(`Response sent`, {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      userId: (req as any).user?.id,
    });

    // Call the original end function
    originalEnd.apply(res, args);
    return res;
  };

  next();
};
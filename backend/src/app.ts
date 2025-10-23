import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import 'express-async-errors';

import { errorHandler } from './middleware/error.middleware';
// import { rateLimiter } from './middleware/rateLimiter.middleware'; // Removed - was causing Redis issues
import { requestLogger } from './middleware/requestLogger.middleware';
import { notFoundHandler } from './middleware/notFound.middleware';

// Import routes
import authRouter from './routes/auth';
import contactRouter from './routes/contacts';
// import productRouter from './routes/products';
import productRouter from './routes/products-simple'; // Using simplified version without pooling
import quotationRouter from './routes/quotations';
import testRouter from './routes/test-simple'; // Ultra-simple test routes

export class App {
  public express: Application;

  constructor() {
    this.express = express();
    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeMiddleware(): void {
    // Security middleware
    this.express.use(helmet({
      contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
      crossOriginEmbedderPolicy: false,
    }));

    // CORS configuration
    this.express.use(cors({
      origin: process.env.FRONTEND_URL?.split(',') || ['http://localhost:3000'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    }));

    // Compression middleware
    this.express.use(compression());

    // Body parsing middleware
    this.express.use(express.json({ limit: '10mb' }));
    this.express.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Logging middleware
    if (process.env.NODE_ENV === 'development') {
      this.express.use(morgan('dev'));
    } else {
      this.express.use(requestLogger);
    }

    // Rate limiting - DISABLED temporarily due to Redis issues
    // this.express.use('/api/', rateLimiter);

    // Trust proxy
    if (process.env.TRUST_PROXY === 'true') {
      this.express.set('trust proxy', 1);
    }

    // Static files (for uploaded files if needed)
    this.express.use('/uploads', express.static('uploads'));
  }

  private initializeRoutes(): void {
    // Health check route (no auth required)
    this.express.get('/health', (req: Request, res: Response) => {
      res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    });

    // API routes
    this.express.use('/api/test', testRouter); // Test routes FIRST (no auth)
    this.express.use('/api/auth', authRouter);
    this.express.use('/api/contacts', contactRouter);
    this.express.use('/api/products', productRouter);
    this.express.use('/api/quotations', quotationRouter);

    // API documentation (only in development)
    if (process.env.NODE_ENV === 'development') {
      // Swagger documentation will be added here
      this.express.get('/api-docs', (req: Request, res: Response) => {
        res.json({
          message: 'API Documentation will be available here',
          endpoints: {
            health: '/health',
            auth: '/api/auth/*',
            contacts: '/api/contacts/*',
            products: '/api/products/*',
            quotations: '/api/quotations/*'
          }
        });
      });
    }

    // Welcome route
    this.express.get('/', (req: Request, res: Response) => {
      res.json({
        name: 'MyERP API',
        version: '1.0.0',
        status: 'running',
        timestamp: new Date().toISOString()
      });
    });
  }

  private initializeErrorHandling(): void {
    // 404 handler
    this.express.use(notFoundHandler);

    // Global error handler (must be last)
    this.express.use(errorHandler);
  }
}
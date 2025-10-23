import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import 'express-async-errors';

import { errorHandler } from './middleware/error.middleware';
import { rateLimiter } from './middleware/rateLimiter.middleware';
import { requestLogger } from './middleware/requestLogger.middleware';
import { notFoundHandler } from './middleware/notFound.middleware';

// Import routes
import { authRouter } from './routes/auth.routes';
import { userRouter } from './routes/user.routes';
import { contactRouter } from './routes/contact.routes';
import { productRouter } from './routes/product.routes';
import { quotationRouter } from './routes/quotation.routes';
import { orderRouter } from './routes/order.routes';
import { dashboardRouter } from './routes/dashboard.routes';
import { healthRouter } from './routes/health.routes';

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

    // Rate limiting
    this.express.use('/api/', rateLimiter);

    // Trust proxy
    if (process.env.TRUST_PROXY === 'true') {
      this.express.set('trust proxy', 1);
    }

    // Static files (for uploaded files if needed)
    this.express.use('/uploads', express.static('uploads'));
  }

  private initializeRoutes(): void {
    // Health check route (no auth required)
    this.express.use('/health', healthRouter);

    // API routes
    this.express.use('/api/auth', authRouter);
    this.express.use('/api/users', userRouter);
    this.express.use('/api/contacts', contactRouter);
    this.express.use('/api/products', productRouter);
    this.express.use('/api/quotations', quotationRouter);
    this.express.use('/api/orders', orderRouter);
    this.express.use('/api/dashboard', dashboardRouter);

    // API documentation (only in development)
    if (process.env.NODE_ENV === 'development') {
      // Swagger documentation will be added here
      this.express.get('/api-docs', (req: Request, res: Response) => {
        res.json({
          message: 'API Documentation will be available here',
          endpoints: {
            health: '/health',
            auth: '/api/auth/*',
            users: '/api/users/*',
            contacts: '/api/contacts/*',
            products: '/api/products/*',
            quotations: '/api/quotations/*',
            orders: '/api/orders/*',
            dashboard: '/api/dashboard/*'
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
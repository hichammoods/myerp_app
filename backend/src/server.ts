import 'dotenv/config';
import express from 'express';
import http from 'http';
import { App } from './app';
import { logger } from './utils/logger';
import { DatabaseConnection } from './database/connection';
import { RedisConnection } from './database/redis';
import { validateEnv } from './config/env.validation';

// Validate environment variables
validateEnv();

const PORT = process.env.API_PORT || 4000;

async function startServer() {
  try {
    // Initialize database connection
    logger.info('Connecting to PostgreSQL...');
    await DatabaseConnection.initialize();
    logger.info('PostgreSQL connected successfully');

    // Initialize Redis connection
    logger.info('Connecting to Redis...');
    await RedisConnection.initialize();
    logger.info('Redis connected successfully');

    // Create Express app
    const app = new App();
    const server = http.createServer(app.express);

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully...');
      server.close(async () => {
        await DatabaseConnection.close();
        await RedisConnection.close();
        process.exit(0);
      });
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT received, shutting down gracefully...');
      server.close(async () => {
        await DatabaseConnection.close();
        await RedisConnection.close();
        process.exit(0);
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });

    // Start server
    server.listen(PORT, () => {
      logger.info(`🚀 Server is running on http://localhost:${PORT}`);
      logger.info(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
      logger.info(`🔥 Environment: ${process.env.NODE_ENV}`);
      logger.info(`💪 Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import express from 'express';
import http from 'http';
import { App } from './app';
import { logger } from './utils/logger';
import { DatabaseConnection } from './database/connection';
import { RedisConnection } from './database/redis';
import { validateEnv, setDefaults } from './config/env.validation';
import { initializeMinio } from './config/minio';
import { initializeBackupScheduler } from './services/backupScheduler';

// Set default environment variables first
setDefaults();

// Validate environment variables
validateEnv();

const PORT = process.env.API_PORT || 4000;

async function startServer() {
  try {
    // Try to connect to database, but don't fail if it's not available
    try {
      logger.info('Attempting to connect to PostgreSQL...');
      await DatabaseConnection.initialize();
      logger.info('PostgreSQL connected successfully');
    } catch (dbError) {
      logger.warn('PostgreSQL connection failed - running without database');
      logger.warn('Make sure Docker is running and execute: docker-compose -f docker-compose.simple.yml up -d');
    }

    // Try to connect to Redis, but don't fail if it's not available
    try {
      logger.info('Attempting to connect to Redis...');
      await RedisConnection.initialize();
      logger.info('Redis connected successfully');
    } catch (redisError) {
      logger.warn('Redis connection failed - running without cache');
      logger.warn('Some features like session management may not work properly');
    }

    // Try to initialize MinIO, but don't fail if it's not available
    try {
      logger.info('Attempting to connect to MinIO...');
      await initializeMinio();
      logger.info('MinIO initialized successfully');
    } catch (minioError) {
      logger.warn('MinIO initialization failed - file uploads may not work');
      logger.warn('Make sure Docker is running and MinIO service is started');
    }

    // Create Express app
    const app = new App();
    const server = http.createServer(app.express);

    // Initialize automated backup scheduler
    if (process.env.ENABLE_AUTO_BACKUP !== 'false') {
      try {
        initializeBackupScheduler();
      } catch (error) {
        logger.warn('Failed to initialize backup scheduler:', error);
      }
    }

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
      logger.error('Unhandled Rejection at:', { reason, promise: promise.toString() });
      // Don't exit immediately, let the process continue
      // process.exit(1);
    });

    // Start server
    server.listen(PORT, () => {
      logger.info(`🚀 Server is running on http://localhost:${PORT}`);
      logger.info(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
      logger.info(`🔥 Environment: ${process.env.NODE_ENV}`);
      logger.info(`💪 Health check: http://localhost:${PORT}/health`);

      if (!DatabaseConnection.getPool()) {
        logger.warn('⚠️  Database not connected - Please start Docker Desktop and run:');
        logger.warn('   docker-compose -f docker-compose.simple.yml up -d');
      }
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
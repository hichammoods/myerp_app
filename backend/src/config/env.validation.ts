import { logger } from '../utils/logger';

interface RequiredEnvVars {
  required: string[];
  optional: string[];
}

const envVars: RequiredEnvVars = {
  required: [
    'NODE_ENV',
    'JWT_SECRET',
    'JWT_EXPIRY',
    'REFRESH_TOKEN_SECRET',
    'REFRESH_TOKEN_EXPIRY',
  ],
  optional: [
    'API_PORT',
    'DATABASE_URL',
    'DB_HOST',
    'DB_PORT',
    'DB_NAME',
    'DB_USER',
    'DB_PASSWORD',
    'REDIS_URL',
    'REDIS_HOST',
    'REDIS_PORT',
    'REDIS_PASSWORD',
    'MINIO_ENDPOINT',
    'MINIO_PORT',
    'MINIO_ACCESS_KEY',
    'MINIO_SECRET_KEY',
    'MINIO_BUCKET_NAME',
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_USER',
    'SMTP_PASS',
    'EMAIL_FROM',
    'EMAIL_FROM_NAME',
    'FRONTEND_URL',
    'LOG_LEVEL',
    'LOG_DIR',
    'RATE_LIMIT_WINDOW',
    'RATE_LIMIT_MAX_REQUESTS',
    'BCRYPT_ROUNDS',
    'SESSION_SECRET',
    'SESSION_MAX_AGE',
    'TRUST_PROXY',
  ],
};

export function validateEnv(): void {
  const missingVars: string[] = [];

  // Check required environment variables
  for (const varName of envVars.required) {
    if (!process.env[varName]) {
      missingVars.push(varName);
    }
  }

  // Log missing required variables and exit
  if (missingVars.length > 0) {
    logger.error(`Missing required environment variables: ${missingVars.join(', ')}`);
    logger.error('Please set these variables in your .env file or environment');
    process.exit(1);
  }

  // Warn about missing optional variables
  const missingOptional: string[] = [];
  for (const varName of envVars.optional) {
    if (!process.env[varName]) {
      missingOptional.push(varName);
    }
  }

  if (missingOptional.length > 0 && process.env.NODE_ENV === 'development') {
    logger.warn(`Missing optional environment variables: ${missingOptional.join(', ')}`);
    logger.warn('Default values will be used for these variables');
  }

  // Validate specific environment variable values
  validateNodeEnv();
  validatePorts();
  validateNumbers();
  validateUrls();

  logger.info('Environment variables validated successfully');
}

function validateNodeEnv(): void {
  const validEnvironments = ['development', 'test', 'production', 'staging'];
  const nodeEnv = process.env.NODE_ENV;

  if (nodeEnv && !validEnvironments.includes(nodeEnv)) {
    logger.warn(`Invalid NODE_ENV: ${nodeEnv}. Using 'development' as default.`);
    process.env.NODE_ENV = 'development';
  }
}

function validatePorts(): void {
  const ports = [
    { name: 'API_PORT', value: process.env.API_PORT },
    { name: 'DB_PORT', value: process.env.DB_PORT },
    { name: 'REDIS_PORT', value: process.env.REDIS_PORT },
    { name: 'MINIO_PORT', value: process.env.MINIO_PORT },
    { name: 'SMTP_PORT', value: process.env.SMTP_PORT },
  ];

  for (const { name, value } of ports) {
    if (value) {
      const port = parseInt(value);
      if (isNaN(port) || port < 1 || port > 65535) {
        logger.error(`Invalid port value for ${name}: ${value}`);
        process.exit(1);
      }
    }
  }
}

function validateNumbers(): void {
  const numbers = [
    { name: 'BCRYPT_ROUNDS', value: process.env.BCRYPT_ROUNDS, min: 1, max: 20 },
    { name: 'RATE_LIMIT_WINDOW', value: process.env.RATE_LIMIT_WINDOW, min: 1, max: 3600 },
    { name: 'RATE_LIMIT_MAX_REQUESTS', value: process.env.RATE_LIMIT_MAX_REQUESTS, min: 1, max: 10000 },
    { name: 'DATABASE_POOL_MAX', value: process.env.DATABASE_POOL_MAX, min: 1, max: 100 },
  ];

  for (const { name, value, min, max } of numbers) {
    if (value) {
      const num = parseInt(value);
      if (isNaN(num) || num < min || num > max) {
        logger.error(`Invalid number value for ${name}: ${value} (must be between ${min} and ${max})`);
        process.exit(1);
      }
    }
  }
}

function validateUrls(): void {
  const urls = [
    { name: 'DATABASE_URL', value: process.env.DATABASE_URL, pattern: /^postgres(ql)?:\/\// },
    { name: 'REDIS_URL', value: process.env.REDIS_URL, pattern: /^redis:\/\// },
    { name: 'FRONTEND_URL', value: process.env.FRONTEND_URL, pattern: /^https?:\/\// },
  ];

  for (const { name, value, pattern } of urls) {
    if (value && !pattern.test(value)) {
      logger.warn(`Invalid URL format for ${name}: ${value}`);
    }
  }
}

// Set default values for optional environment variables
export function setDefaults(): void {
  const defaults: Record<string, string> = {
    NODE_ENV: 'development',
    API_PORT: '4000',
    DB_HOST: 'localhost',
    DB_PORT: '5432',
    DB_NAME: 'myerp_db',
    DB_USER: 'myerp',
    DB_PASSWORD: 'myerp_password',
    REDIS_HOST: 'localhost',
    REDIS_PORT: '6379',
    REDIS_PASSWORD: 'myerp_redis_password',
    REDIS_DB: '0',
    MINIO_ENDPOINT: 'localhost',
    MINIO_PORT: '9000',
    MINIO_ACCESS_KEY: 'minioadmin',
    MINIO_SECRET_KEY: 'minioadmin',
    MINIO_BUCKET_NAME: 'myerp-uploads',
    MINIO_USE_SSL: 'false',
    SMTP_HOST: 'localhost',
    SMTP_PORT: '1025',
    SMTP_SECURE: 'false',
    EMAIL_FROM: 'noreply@myerp.local',
    EMAIL_FROM_NAME: 'MyERP System',
    FRONTEND_URL: 'http://localhost:3000',
    LOG_LEVEL: 'info',
    LOG_DIR: './logs',
    RATE_LIMIT_WINDOW: '15',
    RATE_LIMIT_MAX_REQUESTS: '100',
    BCRYPT_ROUNDS: '10',
    SESSION_MAX_AGE: '86400000',
    TRUST_PROXY: 'false',
    DATABASE_POOL_MAX: '20',
    DATABASE_POOL_MIN: '2',
    DATABASE_SSL: 'false',
    MAX_FILE_SIZE: '10485760',
    ALLOWED_FILE_TYPES: 'image/jpeg,image/png,image/gif,application/pdf',
  };

  for (const [key, value] of Object.entries(defaults)) {
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}
import { Client } from 'minio';
import { logger } from '../utils/logger';

const minioClient = new Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT || '9000'),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
});

const bucketName = process.env.MINIO_BUCKET_NAME || 'myerp-uploads';

// Initialize bucket
export async function initializeMinio() {
  try {
    const bucketExists = await minioClient.bucketExists(bucketName);

    if (!bucketExists) {
      await minioClient.makeBucket(bucketName, 'us-east-1');
      logger.info(`MinIO bucket '${bucketName}' created successfully`);

      // Set bucket policy to allow public read access for product images
      const policy = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${bucketName}/*`],
          },
        ],
      };

      await minioClient.setBucketPolicy(bucketName, JSON.stringify(policy));
      logger.info(`MinIO bucket policy set for '${bucketName}'`);
    } else {
      logger.info(`MinIO bucket '${bucketName}' already exists`);
    }
  } catch (error) {
    logger.error('Error initializing MinIO:', error);
    throw error;
  }
}

export { minioClient, bucketName };

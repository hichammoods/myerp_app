import cron from 'node-cron';
import { createDatabaseBackup } from '../utils/backup';
import { logger } from '../utils/logger';

/**
 * Initialize automated backup scheduler
 * Runs daily at 2:00 AM
 */
export function initializeBackupScheduler() {
  // Schedule backup daily at 2:00 AM
  // Cron pattern: '0 2 * * *' = At 02:00 every day
  const cronSchedule = process.env.BACKUP_CRON_SCHEDULE || '0 2 * * *';

  logger.info(`Initializing automated backup scheduler: ${cronSchedule}`);

  const task = cron.schedule(cronSchedule, async () => {
    logger.info('🔄 Starting automated daily backup...');

    try {
      const result = await createDatabaseBackup();

      if (result.success) {
        const sizeMB = ((result.size || 0) / (1024 * 1024)).toFixed(2);
        logger.info(`✅ Automated backup completed successfully: ${result.filename} (${sizeMB} MB)`);
      } else {
        logger.error(`❌ Automated backup failed: ${result.error}`);
        // You could send an alert email here
      }
    } catch (error: any) {
      logger.error('❌ Automated backup error:', error);
      // You could send an alert email here
    }
  }, {
    scheduled: true,
    timezone: process.env.TZ || 'Europe/Paris', // Default to Paris timezone
  });

  logger.info('✅ Backup scheduler initialized successfully');
  logger.info(`   Schedule: ${cronSchedule} (${process.env.TZ || 'Europe/Paris'})`);
  logger.info('   Next backup will run at 2:00 AM');

  return task;
}

/**
 * Run a manual backup immediately (for testing)
 */
export async function runManualBackup() {
  logger.info('Running manual backup...');
  return await createDatabaseBackup();
}

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from './logger';

const execAsync = promisify(exec);

const BACKUP_DIR = path.join(__dirname, '../../backups/database');
const EXPORT_DIR = path.join(__dirname, '../../backups/exports');
const MAX_BACKUPS = 30; // Keep 30 days of backups

interface BackupResult {
  success: boolean;
  filename?: string;
  filepath?: string;
  size?: number;
  error?: string;
}

/**
 * Create a database backup using pg_dump
 */
export async function createDatabaseBackup(): Promise<BackupResult> {
  try {
    // Ensure backup directory exists
    await fs.mkdir(BACKUP_DIR, { recursive: true });

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `myerp_backup_${timestamp}.sql`;
    const filepath = path.join(BACKUP_DIR, filename);

    // Database connection details from environment
    const dbUrl = process.env.DATABASE_URL || 'postgresql://myerp:myerp_password@localhost:5432/myerp_db';

    logger.info(`Creating database backup: ${filename}`);

    // Use Docker to run pg_dump (since pg_dump may not be installed locally)
    const containerName = 'myerp_postgres';
    const dbName = 'myerp_db';
    const dbUser = 'myerp';

    // Execute pg_dump via Docker
    const { stdout, stderr } = await execAsync(
      `docker exec ${containerName} pg_dump -U ${dbUser} ${dbName} > "${filepath}"`,
      { maxBuffer: 1024 * 1024 * 100 } // 100MB buffer
    );

    if (stderr && !stderr.includes('Warning')) {
      logger.warn(`Backup warnings: ${stderr}`);
    }

    // Get file size
    const stats = await fs.stat(filepath);
    const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

    logger.info(`Backup created successfully: ${filename} (${sizeInMB} MB)`);

    // Clean old backups
    await cleanOldBackups();

    return {
      success: true,
      filename,
      filepath,
      size: stats.size,
    };
  } catch (error: any) {
    logger.error('Database backup failed:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Restore database from a backup file
 */
export async function restoreDatabaseBackup(filename: string): Promise<BackupResult> {
  try {
    const filepath = path.join(BACKUP_DIR, filename);

    // Check if backup file exists
    try {
      await fs.access(filepath);
    } catch {
      throw new Error('Backup file not found');
    }

    // Database connection details
    const dbUrl = process.env.DATABASE_URL || 'postgresql://myerp:myerp_password@localhost:5432/myerp_db';

    logger.info(`Restoring database from backup: ${filename}`);
    logger.warn('⚠️  This will overwrite the current database!');

    // Use Docker to run psql (since psql may not be installed locally)
    const containerName = 'myerp_postgres';
    const dbName = 'myerp_db';
    const dbUser = 'myerp';

    // First, copy the backup file into the container
    await execAsync(`docker cp "${filepath}" ${containerName}:/tmp/restore.sql`);

    // Execute psql to restore via Docker
    const { stdout, stderr } = await execAsync(
      `docker exec ${containerName} psql -U ${dbUser} ${dbName} < /tmp/restore.sql`,
      { maxBuffer: 1024 * 1024 * 100 } // 100MB buffer
    );

    // Clean up the temp file in container
    await execAsync(`docker exec ${containerName} rm /tmp/restore.sql`);

    if (stderr && !stderr.includes('Warning') && !stderr.includes('NOTICE')) {
      logger.warn(`Restore warnings: ${stderr}`);
    }

    logger.info(`Database restored successfully from: ${filename}`);

    return {
      success: true,
      filename,
      filepath,
    };
  } catch (error: any) {
    logger.error('Database restore failed:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * List all available backups
 */
export async function listBackups(): Promise<Array<{
  filename: string;
  filepath: string;
  size: number;
  createdAt: Date;
}>> {
  try {
    await fs.mkdir(BACKUP_DIR, { recursive: true });

    const files = await fs.readdir(BACKUP_DIR);
    const backups = await Promise.all(
      files
        .filter(file => file.endsWith('.sql'))
        .map(async (file) => {
          const filepath = path.join(BACKUP_DIR, file);
          const stats = await fs.stat(filepath);
          return {
            filename: file,
            filepath,
            size: stats.size,
            createdAt: stats.mtime,
          };
        })
    );

    // Sort by creation date, newest first
    return backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } catch (error: any) {
    logger.error('Failed to list backups:', error);
    return [];
  }
}

/**
 * Delete a specific backup file
 */
export async function deleteBackup(filename: string): Promise<boolean> {
  try {
    const filepath = path.join(BACKUP_DIR, filename);
    await fs.unlink(filepath);
    logger.info(`Backup deleted: ${filename}`);
    return true;
  } catch (error: any) {
    logger.error(`Failed to delete backup ${filename}:`, error);
    return false;
  }
}

/**
 * Clean old backups, keeping only the most recent MAX_BACKUPS
 */
export async function cleanOldBackups(): Promise<number> {
  try {
    const backups = await listBackups();

    if (backups.length <= MAX_BACKUPS) {
      return 0;
    }

    // Delete old backups
    const toDelete = backups.slice(MAX_BACKUPS);
    let deletedCount = 0;

    for (const backup of toDelete) {
      const deleted = await deleteBackup(backup.filename);
      if (deleted) deletedCount++;
    }

    logger.info(`Cleaned ${deletedCount} old backups`);
    return deletedCount;
  } catch (error: any) {
    logger.error('Failed to clean old backups:', error);
    return 0;
  }
}

/**
 * Export data to CSV format
 */
export async function exportDataToCSV(tableName: string, query: string): Promise<BackupResult> {
  try {
    await fs.mkdir(EXPORT_DIR, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `${tableName}_export_${timestamp}.csv`;
    const filepath = path.join(EXPORT_DIR, filename);

    const dbUrl = process.env.DATABASE_URL || 'postgresql://myerp:myerp_password@localhost:5432/myerp_db';

    // Use Docker to run psql with COPY command
    const containerName = 'myerp_postgres';
    const dbName = 'myerp_db';
    const dbUser = 'myerp';

    // Use COPY command to export to CSV
    const copyCommand = `COPY (${query}) TO STDOUT WITH CSV HEADER`;

    await execAsync(
      `docker exec ${containerName} psql -U ${dbUser} ${dbName} -c "${copyCommand}" > "${filepath}"`,
      { maxBuffer: 1024 * 1024 * 50 } // 50MB buffer
    );

    const stats = await fs.stat(filepath);

    logger.info(`Data exported to CSV: ${filename}`);

    return {
      success: true,
      filename,
      filepath,
      size: stats.size,
    };
  } catch (error: any) {
    logger.error(`Failed to export ${tableName}:`, error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Get backup statistics
 */
export async function getBackupStats() {
  const backups = await listBackups();
  const totalSize = backups.reduce((sum, b) => sum + b.size, 0);

  return {
    count: backups.length,
    totalSize,
    totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
    oldestBackup: backups[backups.length - 1]?.createdAt,
    newestBackup: backups[0]?.createdAt,
  };
}

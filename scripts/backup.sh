#!/bin/sh
set -e

# Configuration
BACKUP_DIR="/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="myerp_db_backup_${TIMESTAMP}.sql.gz"
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}

# Create backup directory if it doesn't exist
mkdir -p ${BACKUP_DIR}

# Perform backup
echo "Starting database backup at $(date)"
PGPASSWORD=${POSTGRES_PASSWORD} pg_dump -h postgres -U ${POSTGRES_USER} ${POSTGRES_DB} | gzip > ${BACKUP_DIR}/${BACKUP_FILE}

# Check if backup was successful
if [ $? -eq 0 ]; then
    echo "Backup completed successfully: ${BACKUP_FILE}"

    # Remove old backups
    echo "Cleaning up backups older than ${RETENTION_DAYS} days"
    find ${BACKUP_DIR} -name "myerp_db_backup_*.sql.gz" -type f -mtime +${RETENTION_DAYS} -delete

    echo "Backup cleanup completed"
else
    echo "Backup failed!"
    exit 1
fi

# Optional: Upload to S3 or remote storage
# if [ -n "${AWS_ACCESS_KEY_ID}" ]; then
#     echo "Uploading backup to S3..."
#     aws s3 cp ${BACKUP_DIR}/${BACKUP_FILE} s3://${BACKUP_S3_BUCKET}/${BACKUP_FILE}
# fi

echo "Backup process finished at $(date)"

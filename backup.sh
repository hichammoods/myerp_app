#!/bin/bash

# MyERP Backup Script
# Backs up database and uploaded files

set -e

echo "💾 MyERP Backup Script"
echo "====================="

# Configuration
BACKUP_DIR="./backups"
DATE=$(date +%Y%m%d_%H%M%S)
DB_BACKUP_FILE="$BACKUP_DIR/database_$DATE.sql"
MINIO_BACKUP_FILE="$BACKUP_DIR/uploads_$DATE.tar.gz"

# Create backup directory
mkdir -p $BACKUP_DIR

echo "📊 Backing up PostgreSQL database..."
docker-compose -f docker-compose.production.yml exec -T postgres pg_dump -U myerp myerp_db > $DB_BACKUP_FILE

if [ $? -eq 0 ]; then
    echo "✅ Database backup complete: $DB_BACKUP_FILE"
    gzip $DB_BACKUP_FILE
    echo "🗜️  Compressed to: ${DB_BACKUP_FILE}.gz"
else
    echo "❌ Database backup failed"
    exit 1
fi

echo ""
echo "📁 Backing up uploaded files..."
docker run --rm \
    --volumes-from myerp-minio \
    -v $(pwd)/$BACKUP_DIR:/backup \
    alpine tar czf /backup/uploads_$DATE.tar.gz /data

if [ $? -eq 0 ]; then
    echo "✅ Files backup complete: $MINIO_BACKUP_FILE"
else
    echo "❌ Files backup failed"
    exit 1
fi

echo ""
echo "🧹 Cleaning old backups (keeping last 7 days)..."
find $BACKUP_DIR -name "database_*.sql.gz" -mtime +7 -delete
find $BACKUP_DIR -name "uploads_*.tar.gz" -mtime +7 -delete

echo ""
echo "✅ Backup complete!"
echo "Database: ${DB_BACKUP_FILE}.gz"
echo "Files: $MINIO_BACKUP_FILE"
echo ""
echo "💡 To restore database:"
echo "  gunzip ${DB_BACKUP_FILE}.gz"
echo "  cat $DB_BACKUP_FILE | docker-compose -f docker-compose.production.yml exec -T postgres psql -U myerp myerp_db"


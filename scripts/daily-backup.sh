#!/bin/bash

################################################################################
# MyERP Daily Backup Script
#
# This script performs daily backups of:
# - PostgreSQL database
# - MinIO object storage (uploaded files)
# - Redis data
#
# Usage: ./scripts/daily-backup.sh
# Recommended: Run via cron at 2 AM daily
################################################################################

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_BASE_DIR="${PROJECT_DIR}/backups"
DATE=$(date +%Y%m%d_%H%M%S)
DATE_FOLDER=$(date +%Y-%m-%d)
BACKUP_DIR="${BACKUP_BASE_DIR}/${DATE_FOLDER}"
RETENTION_DAYS=30
COMPOSE_FILE="${PROJECT_DIR}/docker-compose.production.yml"
ENV_FILE="${PROJECT_DIR}/.env.production"

# Backup file paths
DB_BACKUP_FILE="${BACKUP_DIR}/postgres_${DATE}.sql"
MINIO_BACKUP_FILE="${BACKUP_DIR}/minio_${DATE}.tar.gz"
REDIS_BACKUP_FILE="${BACKUP_DIR}/redis_${DATE}.tar.gz"

# Log file
LOG_FILE="${BACKUP_BASE_DIR}/backup.log"

# Create backup directory
mkdir -p "${BACKUP_DIR}"

# Logging function
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "${LOG_FILE}"
}

log_success() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] ✅ $1${NC}" | tee -a "${LOG_FILE}"
}

log_error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ❌ $1${NC}" | tee -a "${LOG_FILE}"
}

log_warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️  $1${NC}" | tee -a "${LOG_FILE}"
}

echo ""
log "═══════════════════════════════════════════════════════════"
log "            MyERP Daily Backup - Starting"
log "═══════════════════════════════════════════════════════════"
echo ""

# Check if Docker is running
if ! docker ps > /dev/null 2>&1; then
    log_error "Docker is not running!"
    exit 1
fi

################################################################################
# 1. BACKUP POSTGRESQL DATABASE
################################################################################
echo ""
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "1/3 Backing up PostgreSQL database..."
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if docker-compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" exec -T postgres \
    pg_dump -U myerp myerp_db > "${DB_BACKUP_FILE}" 2>> "${LOG_FILE}"; then

    # Compress the backup
    gzip "${DB_BACKUP_FILE}"

    # Calculate size
    SIZE=$(du -h "${DB_BACKUP_FILE}.gz" | cut -f1)
    log_success "Database backup complete: $(basename ${DB_BACKUP_FILE}.gz) (${SIZE})"
else
    log_error "Database backup failed!"
    exit 1
fi

################################################################################
# 2. BACKUP MINIO DATA (Uploaded Files)
################################################################################
echo ""
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "2/3 Backing up MinIO object storage..."
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if docker run --rm \
    --volumes-from myerp-minio \
    -v "${BACKUP_DIR}:/backup" \
    alpine tar czf "/backup/$(basename ${MINIO_BACKUP_FILE})" -C /data . 2>> "${LOG_FILE}"; then

    SIZE=$(du -h "${MINIO_BACKUP_FILE}" | cut -f1)
    log_success "MinIO backup complete: $(basename ${MINIO_BACKUP_FILE}) (${SIZE})"
else
    log_error "MinIO backup failed!"
    exit 1
fi

################################################################################
# 3. BACKUP REDIS DATA
################################################################################
echo ""
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "3/3 Backing up Redis data..."
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if docker run --rm \
    --volumes-from myerp-redis \
    -v "${BACKUP_DIR}:/backup" \
    alpine tar czf "/backup/$(basename ${REDIS_BACKUP_FILE})" -C /data . 2>> "${LOG_FILE}"; then

    SIZE=$(du -h "${REDIS_BACKUP_FILE}" | cut -f1)
    log_success "Redis backup complete: $(basename ${REDIS_BACKUP_FILE}) (${SIZE})"
else
    log_warning "Redis backup failed (non-critical)"
fi

################################################################################
# 4. CREATE BACKUP MANIFEST
################################################################################
echo ""
log "Creating backup manifest..."

cat > "${BACKUP_DIR}/BACKUP_INFO.txt" <<EOF
MyERP Backup Information
========================
Backup Date: $(date '+%Y-%m-%d %H:%M:%S')
Backup ID: ${DATE}

Files:
------
- PostgreSQL: $(basename ${DB_BACKUP_FILE}.gz) ($(du -h ${DB_BACKUP_FILE}.gz | cut -f1))
- MinIO: $(basename ${MINIO_BACKUP_FILE}) ($(du -h ${MINIO_BACKUP_FILE} | cut -f1))
- Redis: $(basename ${REDIS_BACKUP_FILE}) ($(du -h ${REDIS_BACKUP_FILE} 2>/dev/null | cut -f1 || echo "N/A"))

Restore Instructions:
--------------------
To restore this backup, run:
  ./scripts/restore-backup.sh ${DATE_FOLDER}

EOF

log_success "Backup manifest created"

################################################################################
# 5. CLEANUP OLD BACKUPS
################################################################################
echo ""
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "Cleaning up old backups (retention: ${RETENTION_DAYS} days)..."
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

DELETED_COUNT=0
while IFS= read -r dir; do
    if [ -d "$dir" ]; then
        rm -rf "$dir"
        DELETED_COUNT=$((DELETED_COUNT + 1))
        log "Deleted old backup: $(basename $dir)"
    fi
done < <(find "${BACKUP_BASE_DIR}" -maxdepth 1 -type d -name "20*" -mtime +${RETENTION_DAYS})

if [ ${DELETED_COUNT} -gt 0 ]; then
    log_success "Removed ${DELETED_COUNT} old backup(s)"
else
    log "No old backups to remove"
fi

################################################################################
# 6. BACKUP SUMMARY
################################################################################
echo ""
log "═══════════════════════════════════════════════════════════"
log "            Backup Complete - Summary"
log "═══════════════════════════════════════════════════════════"
echo ""
log_success "Backup ID: ${DATE}"
log_success "Backup Location: ${BACKUP_DIR}"
echo ""
log "Files:"
log "  📊 Database:  ${DB_BACKUP_FILE}.gz"
log "  📁 Files:     ${MINIO_BACKUP_FILE}"
log "  🔴 Redis:     ${REDIS_BACKUP_FILE}"
echo ""
log "Total Backup Size: $(du -sh ${BACKUP_DIR} | cut -f1)"
log "Available Disk Space: $(df -h ${BACKUP_BASE_DIR} | tail -1 | awk '{print $4}')"
echo ""
log_success "All backups completed successfully!"
log "View backup manifest: cat ${BACKUP_DIR}/BACKUP_INFO.txt"
echo ""

exit 0

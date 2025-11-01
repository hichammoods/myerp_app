#!/bin/bash

################################################################################
# MyERP Tiered Backup Script
#
# Implements grandfather-father-son backup rotation:
# - Daily backups: Keep for 7 days
# - Weekly backups: Keep for 4 weeks (every Sunday)
# - Monthly backups: Keep for 12 months (last day of month)
#
# Usage: ./scripts/tiered-backup.sh
# Recommended: Run via cron daily at 2 AM
################################################################################

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_BASE_DIR="${PROJECT_DIR}/backups"
DATE=$(date +%Y%m%d_%H%M%S)
TODAY=$(date +%Y-%m-%d)
DAY_OF_WEEK=$(date +%u)  # 1=Monday, 7=Sunday
DAY_OF_MONTH=$(date +%d)
LAST_DAY_OF_MONTH=$(date -d "$(date +%Y-%m-01) +1 month -1 day" +%d)

COMPOSE_FILE="${PROJECT_DIR}/docker-compose.production.yml"
ENV_FILE="${PROJECT_DIR}/.env.production"

# Backup type directories
DAILY_DIR="${BACKUP_BASE_DIR}/daily"
WEEKLY_DIR="${BACKUP_BASE_DIR}/weekly"
MONTHLY_DIR="${BACKUP_BASE_DIR}/monthly"

# Retention periods
DAILY_RETENTION=7      # Keep daily backups for 7 days
WEEKLY_RETENTION=28    # Keep weekly backups for 4 weeks
MONTHLY_RETENTION=365  # Keep monthly backups for 12 months

# Log file
LOG_FILE="${BACKUP_BASE_DIR}/backup.log"

# Create backup directories
mkdir -p "${DAILY_DIR}" "${WEEKLY_DIR}" "${MONTHLY_DIR}"

# Logging functions
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

log_info() {
    echo -e "${CYAN}[$(date '+%Y-%m-%d %H:%M:%S')] ℹ️  $1${NC}" | tee -a "${LOG_FILE}"
}

echo ""
log "═══════════════════════════════════════════════════════════"
log "            MyERP Tiered Backup - Starting"
log "═══════════════════════════════════════════════════════════"
echo ""

# Determine backup type
BACKUP_TYPE="daily"
if [ "$DAY_OF_WEEK" -eq 7 ]; then
    BACKUP_TYPE="weekly"
    log_info "🗓️  Today is Sunday - Creating WEEKLY backup"
fi
if [ "$DAY_OF_MONTH" -eq "$LAST_DAY_OF_MONTH" ]; then
    BACKUP_TYPE="monthly"
    log_info "📅 Last day of month - Creating MONTHLY backup"
fi

# Set backup directory based on type
if [ "$BACKUP_TYPE" == "monthly" ]; then
    BACKUP_DIR="${MONTHLY_DIR}/${TODAY}"
elif [ "$BACKUP_TYPE" == "weekly" ]; then
    BACKUP_DIR="${WEEKLY_DIR}/${TODAY}"
else
    BACKUP_DIR="${DAILY_DIR}/${TODAY}"
fi

mkdir -p "${BACKUP_DIR}"

log_info "Backup type: ${BACKUP_TYPE^^}"
log_info "Backup location: ${BACKUP_DIR}"

# Backup file paths
DB_BACKUP_FILE="${BACKUP_DIR}/postgres_${DATE}.sql"
MINIO_BACKUP_FILE="${BACKUP_DIR}/minio_${DATE}.tar.gz"
REDIS_BACKUP_FILE="${BACKUP_DIR}/redis_${DATE}.tar.gz"

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
# 2. BACKUP MINIO DATA
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
MyERP Tiered Backup Information
================================
Backup Type: ${BACKUP_TYPE^^}
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
  ./scripts/restore-backup.sh $(basename $(dirname ${BACKUP_DIR}))/$(basename ${BACKUP_DIR})

EOF

log_success "Backup manifest created"

################################################################################
# 5. CLEANUP OLD BACKUPS
################################################################################
echo ""
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "Cleaning up old backups..."
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Cleanup daily backups (older than 7 days)
DAILY_DELETED=0
if [ -d "${DAILY_DIR}" ]; then
    while IFS= read -r dir; do
        if [ -d "$dir" ]; then
            rm -rf "$dir"
            DAILY_DELETED=$((DAILY_DELETED + 1))
            log "Deleted old daily backup: $(basename $dir)"
        fi
    done < <(find "${DAILY_DIR}" -maxdepth 1 -type d -name "20*" -mtime +${DAILY_RETENTION})
fi

# Cleanup weekly backups (older than 4 weeks)
WEEKLY_DELETED=0
if [ -d "${WEEKLY_DIR}" ]; then
    while IFS= read -r dir; do
        if [ -d "$dir" ]; then
            rm -rf "$dir"
            WEEKLY_DELETED=$((WEEKLY_DELETED + 1))
            log "Deleted old weekly backup: $(basename $dir)"
        fi
    done < <(find "${WEEKLY_DIR}" -maxdepth 1 -type d -name "20*" -mtime +${WEEKLY_RETENTION})
fi

# Cleanup monthly backups (older than 12 months)
MONTHLY_DELETED=0
if [ -d "${MONTHLY_DIR}" ]; then
    while IFS= read -r dir; do
        if [ -d "$dir" ]; then
            rm -rf "$dir"
            MONTHLY_DELETED=$((MONTHLY_DELETED + 1))
            log "Deleted old monthly backup: $(basename $dir)"
        fi
    done < <(find "${MONTHLY_DIR}" -maxdepth 1 -type d -name "20*" -mtime +${MONTHLY_RETENTION})
fi

TOTAL_DELETED=$((DAILY_DELETED + WEEKLY_DELETED + MONTHLY_DELETED))
if [ ${TOTAL_DELETED} -gt 0 ]; then
    log_success "Removed ${TOTAL_DELETED} old backup(s) (Daily: ${DAILY_DELETED}, Weekly: ${WEEKLY_DELETED}, Monthly: ${MONTHLY_DELETED})"
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

# Count backups
DAILY_COUNT=$(find "${DAILY_DIR}" -maxdepth 1 -type d -name "20*" 2>/dev/null | wc -l || echo 0)
WEEKLY_COUNT=$(find "${WEEKLY_DIR}" -maxdepth 1 -type d -name "20*" 2>/dev/null | wc -l || echo 0)
MONTHLY_COUNT=$(find "${MONTHLY_DIR}" -maxdepth 1 -type d -name "20*" 2>/dev/null | wc -l || echo 0)

log_success "Backup Type: ${BACKUP_TYPE^^}"
log_success "Backup ID: ${DATE}"
log_success "Backup Location: ${BACKUP_DIR}"
echo ""
log "Files:"
log "  📊 Database:  ${DB_BACKUP_FILE}.gz"
log "  📁 Files:     ${MINIO_BACKUP_FILE}"
log "  🔴 Redis:     ${REDIS_BACKUP_FILE}"
echo ""
log "Backup Inventory:"
log "  📅 Daily backups:   ${DAILY_COUNT} (retention: ${DAILY_RETENTION} days)"
log "  🗓️  Weekly backups:  ${WEEKLY_COUNT} (retention: ${WEEKLY_RETENTION} days)"
log "  📆 Monthly backups: ${MONTHLY_COUNT} (retention: ${MONTHLY_RETENTION} days)"
echo ""
log "Disk Usage:"
DAILY_SIZE=$(du -sh "${DAILY_DIR}" 2>/dev/null | cut -f1 || echo "0")
WEEKLY_SIZE=$(du -sh "${WEEKLY_DIR}" 2>/dev/null | cut -f1 || echo "0")
MONTHLY_SIZE=$(du -sh "${MONTHLY_DIR}" 2>/dev/null | cut -f1 || echo "0")
TOTAL_SIZE=$(du -sh "${BACKUP_BASE_DIR}" 2>/dev/null | cut -f1 || echo "0")
log "  Daily:   ${DAILY_SIZE}"
log "  Weekly:  ${WEEKLY_SIZE}"
log "  Monthly: ${MONTHLY_SIZE}"
log "  Total:   ${TOTAL_SIZE}"
echo ""
log "Available Disk Space: $(df -h ${BACKUP_BASE_DIR} | tail -1 | awk '{print $4}')"
echo ""
log_success "Tiered backup completed successfully!"
log "View backup manifest: cat ${BACKUP_DIR}/BACKUP_INFO.txt"
echo ""

exit 0

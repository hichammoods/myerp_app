#!/bin/bash

################################################################################
# MyERP Restore Backup Script
#
# This script restores backups created by daily-backup.sh
#
# Usage: ./scripts/restore-backup.sh [BACKUP_FOLDER]
# Example: ./scripts/restore-backup.sh 2025-11-01
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
COMPOSE_FILE="${PROJECT_DIR}/docker-compose.production.yml"
ENV_FILE="${PROJECT_DIR}/.env.production"

# Logging function
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] ✅ $1${NC}"
}

log_error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ❌ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️  $1${NC}"
}

# Check arguments
if [ $# -eq 0 ]; then
    echo ""
    log_error "No backup folder specified!"
    echo ""
    echo "Usage: $0 [BACKUP_FOLDER]"
    echo ""
    echo "Available backups:"
    ls -1 "${BACKUP_BASE_DIR}" | grep "^20" || echo "  No backups found"
    echo ""
    exit 1
fi

BACKUP_FOLDER=$1
BACKUP_DIR="${BACKUP_BASE_DIR}/${BACKUP_FOLDER}"

# Check if backup exists
if [ ! -d "${BACKUP_DIR}" ]; then
    log_error "Backup folder not found: ${BACKUP_DIR}"
    echo ""
    echo "Available backups:"
    ls -1 "${BACKUP_BASE_DIR}" | grep "^20" || echo "  No backups found"
    echo ""
    exit 1
fi

echo ""
log "═══════════════════════════════════════════════════════════"
log "            MyERP Backup Restore"
log "═══════════════════════════════════════════════════════════"
echo ""
log "Backup folder: ${BACKUP_FOLDER}"
log "Backup location: ${BACKUP_DIR}"
echo ""

# Show backup info if available
if [ -f "${BACKUP_DIR}/BACKUP_INFO.txt" ]; then
    log "Backup Information:"
    cat "${BACKUP_DIR}/BACKUP_INFO.txt"
    echo ""
fi

# Confirmation prompt
log_warning "⚠️  WARNING: This will REPLACE your current database and files!"
log_warning "⚠️  Make sure you have a backup of your current data!"
echo ""
read -p "Are you sure you want to continue? (yes/no): " -r
echo ""
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    log "Restore cancelled by user"
    exit 0
fi

################################################################################
# 1. RESTORE POSTGRESQL DATABASE
################################################################################
echo ""
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "1/3 Restoring PostgreSQL database..."
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Find the database backup file
DB_BACKUP=$(find "${BACKUP_DIR}" -name "postgres_*.sql.gz" | head -1)

if [ -z "${DB_BACKUP}" ]; then
    log_error "No database backup found in ${BACKUP_DIR}"
    exit 1
fi

log "Found database backup: $(basename ${DB_BACKUP})"

# Decompress
DB_BACKUP_SQL="${DB_BACKUP%.gz}"
gunzip -c "${DB_BACKUP}" > "${DB_BACKUP_SQL}"

# Stop applications to prevent connections
log "Stopping API containers..."
docker-compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" stop api

# Drop existing database and recreate
log "Dropping existing database..."
docker-compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" exec -T postgres psql -U myerp -c "DROP DATABASE IF EXISTS myerp_db;"
docker-compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" exec -T postgres psql -U myerp -c "CREATE DATABASE myerp_db;"

# Restore database
log "Restoring database..."
cat "${DB_BACKUP_SQL}" | docker-compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" exec -T postgres psql -U myerp myerp_db

# Clean up decompressed file
rm "${DB_BACKUP_SQL}"

log_success "Database restored successfully"

################################################################################
# 2. RESTORE MINIO DATA
################################################################################
echo ""
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "2/3 Restoring MinIO data..."
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Find the MinIO backup file
MINIO_BACKUP=$(find "${BACKUP_DIR}" -name "minio_*.tar.gz" | head -1)

if [ -z "${MINIO_BACKUP}" ]; then
    log_warning "No MinIO backup found in ${BACKUP_DIR}"
else
    log "Found MinIO backup: $(basename ${MINIO_BACKUP})"

    # Stop MinIO
    log "Stopping MinIO container..."
    docker-compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" stop minio

    # Restore MinIO data
    log "Restoring MinIO data..."
    docker run --rm \
        --volumes-from myerp-minio \
        -v "${BACKUP_DIR}:/backup" \
        alpine sh -c "rm -rf /data/* && tar xzf /backup/$(basename ${MINIO_BACKUP}) -C /"

    log_success "MinIO data restored successfully"
fi

################################################################################
# 3. RESTORE REDIS DATA (Optional)
################################################################################
echo ""
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "3/3 Restoring Redis data..."
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Find the Redis backup file
REDIS_BACKUP=$(find "${BACKUP_DIR}" -name "redis_*.tar.gz" | head -1)

if [ -z "${REDIS_BACKUP}" ]; then
    log_warning "No Redis backup found in ${BACKUP_DIR}"
else
    log "Found Redis backup: $(basename ${REDIS_BACKUP})"

    # Stop Redis
    log "Stopping Redis container..."
    docker-compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" stop redis

    # Restore Redis data
    log "Restoring Redis data..."
    docker run --rm \
        --volumes-from myerp-redis \
        -v "${BACKUP_DIR}:/backup" \
        alpine sh -c "rm -rf /data/* && tar xzf /backup/$(basename ${REDIS_BACKUP}) -C /"

    log_success "Redis data restored successfully"
fi

################################################################################
# 4. RESTART SERVICES
################################################################################
echo ""
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "Restarting all services..."
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

docker-compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" up -d

# Wait for services to be healthy
log "Waiting for services to start..."
sleep 10

################################################################################
# 5. VERIFY RESTORATION
################################################################################
echo ""
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "Verifying restoration..."
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check database
TABLE_COUNT=$(docker-compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" exec -T postgres \
    psql -U myerp myerp_db -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';" | tr -d ' ')

log "Database tables found: ${TABLE_COUNT}"

# Check containers
log "Container status:"
docker-compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" ps

echo ""
log "═══════════════════════════════════════════════════════════"
log_success "Restore Complete!"
log "═══════════════════════════════════════════════════════════"
echo ""
log "✅ Database restored from: $(basename ${DB_BACKUP})"
log "✅ Files restored from: $(basename ${MINIO_BACKUP})"
log "✅ All services restarted"
echo ""
log "Please verify your application is working correctly."
echo ""

exit 0

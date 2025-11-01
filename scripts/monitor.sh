#!/bin/bash

################################################################################
# MyERP System Monitor Script
#
# Displays current resource usage for all Docker containers
# Shows: CPU, Memory, Disk, Network, Container status
#
# Usage: ./scripts/monitor.sh
################################################################################

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
COMPOSE_FILE="${PROJECT_DIR}/docker-compose.production.yml"
ENV_FILE="${PROJECT_DIR}/.env.production"

# Header
clear
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║${NC}              ${CYAN}MyERP System Resource Monitor${NC}                      ${BLUE}║${NC}"
echo -e "${BLUE}║${NC}              $(date '+%Y-%m-%d %H:%M:%S')                          ${BLUE}║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════════╝${NC}"
echo ""

################################################################################
# 1. SYSTEM OVERVIEW
################################################################################
echo -e "${MAGENTA}┌─────────────────────────────────────────────────────────────────────┐${NC}"
echo -e "${MAGENTA}│${NC} ${CYAN}SYSTEM OVERVIEW${NC}                                                     ${MAGENTA}│${NC}"
echo -e "${MAGENTA}└─────────────────────────────────────────────────────────────────────┘${NC}"
echo ""

# CPU Info
CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1 || echo "N/A")
CPU_CORES=$(nproc || echo "N/A")
echo -e "  ${CYAN}CPU:${NC}"
echo -e "    Cores: ${GREEN}${CPU_CORES}${NC}"
echo -e "    Usage: ${YELLOW}${CPU_USAGE}%${NC}"
echo ""

# Memory Info
MEMORY_TOTAL=$(free -h | awk '/^Mem:/ {print $2}')
MEMORY_USED=$(free -h | awk '/^Mem:/ {print $3}')
MEMORY_FREE=$(free -h | awk '/^Mem:/ {print $4}')
MEMORY_PERCENT=$(free | awk '/^Mem:/ {printf "%.1f", ($3/$2) * 100}')
echo -e "  ${CYAN}MEMORY:${NC}"
echo -e "    Total: ${GREEN}${MEMORY_TOTAL}${NC}"
echo -e "    Used:  ${YELLOW}${MEMORY_USED}${NC} (${MEMORY_PERCENT}%)"
echo -e "    Free:  ${GREEN}${MEMORY_FREE}${NC}"
echo ""

# Disk Info
DISK_TOTAL=$(df -h / | awk 'NR==2 {print $2}')
DISK_USED=$(df -h / | awk 'NR==2 {print $3}')
DISK_AVAIL=$(df -h / | awk 'NR==2 {print $4}')
DISK_PERCENT=$(df -h / | awk 'NR==2 {print $5}')
echo -e "  ${CYAN}DISK (Root):${NC}"
echo -e "    Total: ${GREEN}${DISK_TOTAL}${NC}"
echo -e "    Used:  ${YELLOW}${DISK_USED}${NC} (${DISK_PERCENT})"
echo -e "    Free:  ${GREEN}${DISK_AVAIL}${NC}"
echo ""

################################################################################
# 2. DOCKER CONTAINER STATUS
################################################################################
echo -e "${MAGENTA}┌─────────────────────────────────────────────────────────────────────┐${NC}"
echo -e "${MAGENTA}│${NC} ${CYAN}CONTAINER STATUS${NC}                                                    ${MAGENTA}│${NC}"
echo -e "${MAGENTA}└─────────────────────────────────────────────────────────────────────┘${NC}"
echo ""

# Container list with status
docker-compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || \
docker ps --filter "name=myerp" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""

################################################################################
# 3. CONTAINER RESOURCE USAGE
################################################################################
echo -e "${MAGENTA}┌─────────────────────────────────────────────────────────────────────┐${NC}"
echo -e "${MAGENTA}│${NC} ${CYAN}CONTAINER RESOURCES${NC}                                                 ${MAGENTA}│${NC}"
echo -e "${MAGENTA}└─────────────────────────────────────────────────────────────────────┘${NC}"
echo ""

# Docker stats (one-time snapshot)
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}\t{{.BlockIO}}" \
    --filter "name=myerp" 2>/dev/null || \
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}\t{{.BlockIO}}"

echo ""

################################################################################
# 4. DOCKER VOLUMES
################################################################################
echo -e "${MAGENTA}┌─────────────────────────────────────────────────────────────────────┐${NC}"
echo -e "${MAGENTA}│${NC} ${CYAN}DOCKER VOLUMES${NC}                                                      ${MAGENTA}│${NC}"
echo -e "${MAGENTA}└─────────────────────────────────────────────────────────────────────┘${NC}"
echo ""

# Get volumes and their sizes
echo -e "  ${CYAN}Volume Name${NC}                                ${CYAN}Size${NC}"
echo -e "  ────────────────────────────────────────────────────────"
for volume in $(docker volume ls --filter "name=myerp" -q); do
    SIZE=$(docker system df -v | grep "$volume" | awk '{print $(NF-1), $NF}' | head -1)
    if [ -z "$SIZE" ]; then
        SIZE="N/A"
    fi
    printf "  %-45s %s\n" "$volume" "$SIZE"
done

echo ""

################################################################################
# 5. CONTAINER HEALTH STATUS
################################################################################
echo -e "${MAGENTA}┌─────────────────────────────────────────────────────────────────────┐${NC}"
echo -e "${MAGENTA}│${NC} ${CYAN}HEALTH CHECKS${NC}                                                       ${MAGENTA}│${NC}"
echo -e "${MAGENTA}└─────────────────────────────────────────────────────────────────────┘${NC}"
echo ""

# Check health status of each container
CONTAINERS=$(docker ps --filter "name=myerp" --format "{{.Names}}")

for container in $CONTAINERS; do
    HEALTH=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "no healthcheck")

    if [ "$HEALTH" == "healthy" ]; then
        echo -e "  ${GREEN}✓${NC} $container: ${GREEN}healthy${NC}"
    elif [ "$HEALTH" == "unhealthy" ]; then
        echo -e "  ${RED}✗${NC} $container: ${RED}unhealthy${NC}"
    elif [ "$HEALTH" == "starting" ]; then
        echo -e "  ${YELLOW}⋯${NC} $container: ${YELLOW}starting${NC}"
    else
        # Check if running
        STATUS=$(docker inspect --format='{{.State.Status}}' "$container")
        if [ "$STATUS" == "running" ]; then
            echo -e "  ${GREEN}✓${NC} $container: ${GREEN}running${NC} (no healthcheck)"
        else
            echo -e "  ${RED}✗${NC} $container: ${RED}${STATUS}${NC}"
        fi
    fi
done

echo ""

################################################################################
# 6. NETWORK STATISTICS
################################################################################
echo -e "${MAGENTA}┌─────────────────────────────────────────────────────────────────────┐${NC}"
echo -e "${MAGENTA}│${NC} ${CYAN}NETWORK STATISTICS${NC}                                                  ${MAGENTA}│${NC}"
echo -e "${MAGENTA}└─────────────────────────────────────────────────────────────────────┘${NC}"
echo ""

# Network info per container
docker stats --no-stream --format "table {{.Name}}\t{{.NetIO}}" --filter "name=myerp" 2>/dev/null

echo ""

################################################################################
# 7. RECENT LOGS (ERRORS ONLY)
################################################################################
echo -e "${MAGENTA}┌─────────────────────────────────────────────────────────────────────┐${NC}"
echo -e "${MAGENTA}│${NC} ${CYAN}RECENT ERRORS (Last 10 lines)${NC}                                      ${MAGENTA}│${NC}"
echo -e "${MAGENTA}└─────────────────────────────────────────────────────────────────────┘${NC}"
echo ""

for container in $CONTAINERS; do
    ERRORS=$(docker logs "$container" --tail 100 2>&1 | grep -i "error\|exception\|fatal" | tail -3)
    if [ ! -z "$ERRORS" ]; then
        echo -e "  ${RED}${container}:${NC}"
        echo "$ERRORS" | while read line; do
            echo -e "    ${YELLOW}→${NC} $line"
        done
        echo ""
    fi
done

################################################################################
# 8. BACKUP STATUS
################################################################################
echo -e "${MAGENTA}┌─────────────────────────────────────────────────────────────────────┐${NC}"
echo -e "${MAGENTA}│${NC} ${CYAN}BACKUP STATUS${NC}                                                       ${MAGENTA}│${NC}"
echo -e "${MAGENTA}└─────────────────────────────────────────────────────────────────────┘${NC}"
echo ""

BACKUP_DIR="${PROJECT_DIR}/backups"
if [ -d "$BACKUP_DIR" ]; then
    LATEST_BACKUP=$(ls -t "$BACKUP_DIR" | grep "^20" | head -1)
    if [ ! -z "$LATEST_BACKUP" ]; then
        BACKUP_SIZE=$(du -sh "$BACKUP_DIR/$LATEST_BACKUP" | cut -f1)
        echo -e "  Latest backup: ${GREEN}${LATEST_BACKUP}${NC} (${BACKUP_SIZE})"

        # Count total backups
        TOTAL_BACKUPS=$(ls -1 "$BACKUP_DIR" | grep "^20" | wc -l)
        TOTAL_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)
        echo -e "  Total backups: ${CYAN}${TOTAL_BACKUPS}${NC} backups using ${YELLOW}${TOTAL_SIZE}${NC}"
    else
        echo -e "  ${YELLOW}No backups found${NC}"
    fi
else
    echo -e "  ${YELLOW}Backup directory not found${NC}"
fi

echo ""

################################################################################
# FOOTER
################################################################################
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║${NC}  ${GREEN}Monitoring complete${NC}                                               ${BLUE}║${NC}"
echo -e "${BLUE}║${NC}  Run this script again to refresh stats                           ${BLUE}║${NC}"
echo -e "${BLUE}║${NC}  For live stats: ${CYAN}docker stats${NC}                                      ${BLUE}║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════════╝${NC}"
echo ""

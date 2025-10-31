#!/bin/bash

# MyERP Deployment Script
# This script handles initial deployment and updates

set -e

echo "🚀 MyERP Deployment Script"
echo "=========================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env.production exists
if [ ! -f .env.production ]; then
    echo -e "${RED}Error: .env.production file not found!${NC}"
    echo "Please create .env.production with your production configuration"
    exit 1
fi

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo "📋 Checking prerequisites..."
if ! command_exists docker; then
    echo -e "${RED}Docker is not installed!${NC}"
    exit 1
fi

if ! command_exists docker-compose; then
    echo -e "${RED}Docker Compose is not installed!${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Prerequisites met${NC}"

# Pull latest code
echo ""
echo "📥 Pulling latest code from repository..."
git pull origin main

# Build and start services
echo ""
echo "🏗️  Building Docker images..."
docker-compose -f docker-compose.production.yml build --no-cache

echo ""
echo "🔄 Starting services..."
docker-compose -f docker-compose.production.yml up -d

# Wait for services to be healthy
echo ""
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check service health
echo ""
echo "🏥 Checking service health..."
docker-compose -f docker-compose.production.yml ps

# Run database migrations
echo ""
echo "🗄️  Running database migrations..."
docker-compose -f docker-compose.production.yml exec -T api npm run migrate

# Show logs
echo ""
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo "📊 View logs with:"
echo "  docker-compose -f docker-compose.production.yml logs -f"
echo ""
echo "🔍 Check service status:"
echo "  docker-compose -f docker-compose.production.yml ps"
echo ""
echo "🛑 Stop services:"
echo "  docker-compose -f docker-compose.production.yml down"


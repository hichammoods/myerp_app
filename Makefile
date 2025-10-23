# MyERP Makefile
# Simplifies common development and deployment tasks

.PHONY: help up down restart logs build clean migrate seed test backup restore

# Colors for output
RED=\033[0;31m
GREEN=\033[0;32m
YELLOW=\033[1;33m
NC=\033[0m # No Color

# Default target
.DEFAULT_GOAL := help

help: ## Show this help message
	@echo "${GREEN}MyERP - Available Commands${NC}"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "${YELLOW}%-20s${NC} %s\n", $$1, $$2}'

# Docker Compose Commands
up: ## Start all services
	@echo "${GREEN}Starting MyERP services...${NC}"
	docker-compose up -d
	@echo "${GREEN}Services started! Access the app at http://localhost:3000${NC}"

down: ## Stop all services
	@echo "${YELLOW}Stopping MyERP services...${NC}"
	docker-compose down

restart: ## Restart all services
	@echo "${YELLOW}Restarting MyERP services...${NC}"
	docker-compose restart

logs: ## View logs from all services
	docker-compose logs -f

logs-backend: ## View backend logs
	docker-compose logs -f backend

logs-frontend: ## View frontend logs
	docker-compose logs -f frontend

logs-db: ## View database logs
	docker-compose logs -f postgres

logs-error: ## View error logs only
	docker-compose logs -f | grep -i error

ps: ## Show running services
	docker-compose ps

# Build Commands
build: ## Build all Docker images
	@echo "${GREEN}Building Docker images...${NC}"
	docker-compose build

build-backend: ## Build backend image
	docker-compose build backend

build-frontend: ## Build frontend image
	docker-compose build frontend

rebuild: ## Rebuild and restart all services
	@echo "${GREEN}Rebuilding and restarting services...${NC}"
	docker-compose down
	docker-compose build --no-cache
	docker-compose up -d

# Database Commands
db-create: ## Create database
	docker-compose exec postgres createdb -U myerp myerp_db

db-drop: ## Drop database (WARNING: Destructive)
	@echo "${RED}WARNING: This will delete all data!${NC}"
	@read -p "Are you sure? (y/N) " confirm && [ "$$confirm" = "y" ] && \
		docker-compose exec postgres dropdb -U myerp myerp_db || echo "Cancelled"

db-reset: db-drop db-create migrate seed ## Reset database completely

db-shell: ## Access PostgreSQL shell
	docker-compose exec postgres psql -U myerp -d myerp_db

db-backup: ## Create database backup
	@echo "${GREEN}Creating database backup...${NC}"
	@mkdir -p backups
	docker-compose exec postgres pg_dump -U myerp myerp_db > backups/backup_$$(date +%Y%m%d_%H%M%S).sql
	@echo "${GREEN}Backup created in backups/ directory${NC}"

db-restore: ## Restore database from backup (usage: make db-restore file=backup.sql)
	@if [ -z "$(file)" ]; then \
		echo "${RED}Please specify a backup file: make db-restore file=backup.sql${NC}"; \
		exit 1; \
	fi
	@echo "${YELLOW}Restoring database from $(file)...${NC}"
	docker-compose exec -T postgres psql -U myerp myerp_db < $(file)
	@echo "${GREEN}Database restored successfully${NC}"

db-health: ## Check database health
	docker-compose exec postgres pg_isready -U myerp -d myerp_db

migrate: ## Run database migrations
	@echo "${GREEN}Running database migrations...${NC}"
	docker-compose exec backend npm run migrate:up

migrate-down: ## Rollback last migration
	@echo "${YELLOW}Rolling back last migration...${NC}"
	docker-compose exec backend npm run migrate:down

migrate-create: ## Create new migration (usage: make migrate-create name=migration_name)
	@if [ -z "$(name)" ]; then \
		echo "${RED}Please specify migration name: make migrate-create name=migration_name${NC}"; \
		exit 1; \
	fi
	docker-compose exec backend npm run migrate:create -- --name $(name)

seed: ## Seed database with sample data
	@echo "${GREEN}Seeding database...${NC}"
	docker-compose exec backend npm run seed

# Development Commands
dev: ## Start services in development mode
	@echo "${GREEN}Starting development environment...${NC}"
	docker-compose -f docker-compose.yml up -d
	@echo "${GREEN}Development environment ready!${NC}"
	@echo "Frontend: http://localhost:3000"
	@echo "Backend API: http://localhost:4000"
	@echo "MinIO: http://localhost:9001"
	@echo "Mailhog: http://localhost:8025"

install: ## Install dependencies
	@echo "${GREEN}Installing dependencies...${NC}"
	cd backend && npm install
	cd frontend && npm install

shell-backend: ## Access backend container shell
	docker-compose exec backend /bin/sh

shell-frontend: ## Access frontend container shell
	docker-compose exec frontend /bin/sh

shell-postgres: ## Access PostgreSQL container shell
	docker-compose exec postgres /bin/bash

shell-redis: ## Access Redis CLI
	docker-compose exec redis redis-cli -a myerp_redis_password

# Testing Commands
test: ## Run all tests
	@echo "${GREEN}Running tests...${NC}"
	docker-compose exec backend npm test
	docker-compose exec frontend npm test

test-backend: ## Run backend tests
	docker-compose exec backend npm test

test-frontend: ## Run frontend tests
	docker-compose exec frontend npm test

test-e2e: ## Run end-to-end tests
	docker-compose exec backend npm run test:e2e

test-coverage: ## Run tests with coverage
	docker-compose exec backend npm run test:coverage

lint: ## Run linting
	@echo "${GREEN}Running linters...${NC}"
	docker-compose exec backend npm run lint
	docker-compose exec frontend npm run lint

lint-fix: ## Fix linting issues
	docker-compose exec backend npm run lint:fix
	docker-compose exec frontend npm run lint:fix

# Production Commands
prod-build: ## Build for production
	@echo "${GREEN}Building for production...${NC}"
	docker-compose -f docker-compose.prod.yml build

prod-up: ## Start production services
	docker-compose -f docker-compose.prod.yml up -d

prod-down: ## Stop production services
	docker-compose -f docker-compose.prod.yml down

deploy: ## Deploy to production
	@echo "${GREEN}Deploying to production...${NC}"
	./scripts/deploy.sh

# Monitoring Commands
monitor: ## Open monitoring dashboard
	@echo "${GREEN}Opening monitoring dashboards...${NC}"
	@echo "Grafana: http://localhost:3001 (admin/admin)"
	@echo "Prometheus: http://localhost:9090"

health-check: ## Check health of all services
	@echo "${GREEN}Checking service health...${NC}"
	@docker-compose ps
	@curl -s http://localhost:4000/health > /dev/null && echo "✓ Backend API: Healthy" || echo "✗ Backend API: Unhealthy"
	@curl -s http://localhost:3000 > /dev/null && echo "✓ Frontend: Healthy" || echo "✗ Frontend: Unhealthy"
	@docker-compose exec postgres pg_isready -U myerp > /dev/null 2>&1 && echo "✓ Database: Healthy" || echo "✗ Database: Unhealthy"
	@docker-compose exec redis redis-cli -a myerp_redis_password ping > /dev/null 2>&1 && echo "✓ Redis: Healthy" || echo "✗ Redis: Unhealthy"
	@curl -s http://localhost:9000/minio/health/live > /dev/null && echo "✓ MinIO: Healthy" || echo "✗ MinIO: Unhealthy"

metrics: ## View application metrics
	curl http://localhost:4000/metrics

# Cleanup Commands
clean: ## Remove all containers and volumes (WARNING: Deletes all data)
	@echo "${RED}WARNING: This will delete all containers, volumes, and data!${NC}"
	@read -p "Are you sure? (y/N) " confirm && [ "$$confirm" = "y" ] && \
		docker-compose down -v --remove-orphans || echo "Cancelled"

clean-logs: ## Clean up log files
	@echo "${YELLOW}Cleaning log files...${NC}"
	rm -rf backend/logs/*
	rm -rf frontend/logs/*

clean-temp: ## Clean temporary files
	@echo "${YELLOW}Cleaning temporary files...${NC}"
	find . -name "*.tmp" -delete
	find . -name ".DS_Store" -delete
	rm -rf backend/tmp/*
	rm -rf frontend/tmp/*

prune: ## Prune Docker system
	@echo "${YELLOW}Pruning Docker system...${NC}"
	docker system prune -af --volumes

# Backup Commands
backup-all: ## Create full system backup
	@echo "${GREEN}Creating full system backup...${NC}"
	@mkdir -p backups
	@make db-backup
	@docker-compose exec minio mc mirror minio/myerp-uploads backups/minio_$$(date +%Y%m%d_%H%M%S)/
	@echo "${GREEN}Full backup completed${NC}"

backup-schedule: ## Show backup schedule
	@echo "${GREEN}Current backup schedule:${NC}"
	@docker-compose exec backup crontab -l

restore-all: ## Restore full system (usage: make restore-all date=20240101)
	@if [ -z "$(date)" ]; then \
		echo "${RED}Please specify backup date: make restore-all date=20240101${NC}"; \
		exit 1; \
	fi
	@echo "${YELLOW}Restoring full system from $(date)...${NC}"
	@make db-restore file=backups/backup_$(date)*.sql
	@docker-compose exec minio mc mirror backups/minio_$(date) minio/myerp-uploads
	@echo "${GREEN}Full restore completed${NC}"

# Utility Commands
env-copy: ## Copy example environment file
	cp .env.example .env
	@echo "${GREEN}.env file created. Please edit with your configuration.${NC}"

generate-secret: ## Generate secure secret key
	@echo "${GREEN}Generated secret key:${NC}"
	@openssl rand -hex 32

ports: ## Show used ports
	@echo "${GREEN}MyERP Port Mappings:${NC}"
	@echo "Frontend: 3000"
	@echo "Backend API: 4000"
	@echo "PostgreSQL: 5432"
	@echo "Redis: 6379"
	@echo "MinIO: 9000 (API), 9001 (Console)"
	@echo "Prometheus: 9090"
	@echo "Grafana: 3001"
	@echo "Mailhog: 1025 (SMTP), 8025 (Web UI)"

info: ## Show project information
	@echo "${GREEN}MyERP - Sales Order Management System${NC}"
	@echo "Version: 1.0.0"
	@echo "Environment: $(shell grep NODE_ENV .env | cut -d '=' -f2)"
	@echo ""
	@make ports
	@echo ""
	@make health-check

update: ## Update dependencies
	@echo "${GREEN}Updating dependencies...${NC}"
	cd backend && npm update
	cd frontend && npm update

version: ## Show versions
	@echo "${GREEN}Component Versions:${NC}"
	@docker-compose exec backend node --version | xargs echo "Node.js:"
	@docker-compose exec backend npm --version | xargs echo "npm:"
	@docker-compose exec postgres psql --version | head -n1
	@docker-compose exec redis redis-server --version | head -n1
	@docker --version
	@docker-compose --version

# Git Commands
git-setup: ## Set up git hooks
	@echo "${GREEN}Setting up git hooks...${NC}"
	npm install -g husky
	husky install

# Documentation Commands
docs: ## Generate documentation
	@echo "${GREEN}Generating documentation...${NC}"
	docker-compose exec backend npm run docs:generate

docs-serve: ## Serve documentation locally
	@echo "${GREEN}Serving documentation at http://localhost:8080${NC}"
	python3 -m http.server 8080 --directory docs

# Performance Commands
benchmark: ## Run performance benchmarks
	@echo "${GREEN}Running performance benchmarks...${NC}"
	docker-compose exec backend npm run benchmark

analyze: ## Analyze bundle size
	cd frontend && npm run analyze
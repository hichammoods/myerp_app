# MyERP - OVH Deployment Guide

This guide provides step-by-step instructions for deploying MyERP on an OVH server.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Server Requirements](#server-requirements)
- [Initial Server Setup](#initial-server-setup)
- [Installation](#installation)
- [Configuration](#configuration)
- [Deployment](#deployment)
- [SSL/TLS Setup](#ssltls-setup)
- [Monitoring & Maintenance](#monitoring--maintenance)
- [Backup & Recovery](#backup--recovery)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### OVH Server Requirements
- **Recommended VPS Plan**: VPS Value or higher
- **OS**: Ubuntu 22.04 LTS or Debian 12
- **CPU**: Minimum 2 vCPUs (4 vCPUs recommended)
- **RAM**: Minimum 4GB (8GB recommended)
- **Storage**: Minimum 40GB SSD (80GB+ recommended)
- **Network**: Public IP address
- **Domain**: A registered domain name pointing to your server IP

### Local Requirements
- SSH access to your OVH server
- Git installed locally
- Basic knowledge of Linux command line

---

## Initial Server Setup

### 1. Connect to Your OVH Server

```bash
ssh root@your-server-ip
```

### 2. Update System Packages

```bash
apt update && apt upgrade -y
```

### 3. Create a Non-Root User

```bash
# Create user
adduser myerp

# Add to sudo group
usermod -aG sudo myerp

# Switch to new user
su - myerp
```

### 4. Configure Firewall

```bash
# Install UFW
sudo apt install ufw -y

# Allow SSH
sudo ufw allow OpenSSH

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

### 5. Install Docker & Docker Compose

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add current user to docker group
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt install docker-compose -y

# Verify installations
docker --version
docker-compose --version

# Log out and back in for group changes to take effect
exit
su - myerp
```

---

## Installation

### 1. Clone the Repository

```bash
# Create application directory
mkdir -p ~/apps
cd ~/apps

# Clone from your Git repository
git clone https://github.com/yourusername/myerp_app.git
cd myerp_app
```

### 2. Verify File Structure

```bash
# Check that all necessary files exist
ls -la
# Should see: backend/, frontend/, nginx/, scripts/, docker-compose.prod.yml, etc.
```

---

## Configuration

### 1. Configure Production Environment Variables

```bash
# Copy production environment template
cp .env.production.example .env.production

# Edit environment file
nano .env.production
```

**IMPORTANT**: Update the following values in `.env.production`:

```env
# Domain Configuration
DOMAIN=your-domain.com
FRONTEND_URL=https://your-domain.com
CORS_ORIGINS=https://your-domain.com

# Database Password (CHANGE THIS!)
POSTGRES_PASSWORD=your_very_secure_password_here

# Redis Password (CHANGE THIS!)
REDIS_PASSWORD=your_redis_password_here

# MinIO Credentials (CHANGE THIS!)
MINIO_ACCESS_KEY=your_minio_access_key
MINIO_SECRET_KEY=your_very_secure_minio_secret_key

# JWT Secrets (GENERATE RANDOM STRINGS!)
JWT_SECRET=your_very_long_random_jwt_secret_at_least_32_characters
REFRESH_TOKEN_SECRET=your_very_long_refresh_token_secret_at_least_32_characters
SESSION_SECRET=your_very_long_session_secret_at_least_32_characters

# Grafana Admin Password (CHANGE THIS!)
GRAFANA_ADMIN_PASSWORD=your_grafana_admin_password

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=noreply@your-domain.com

# Backup Configuration
BACKUP_RETENTION_DAYS=30
```

**Generate Secure Random Secrets:**
```bash
# Generate JWT_SECRET
openssl rand -base64 64

# Generate REFRESH_TOKEN_SECRET
openssl rand -base64 64

# Generate SESSION_SECRET
openssl rand -base64 64
```

### 2. Update Nginx Configuration for Your Domain

```bash
# Edit nginx configuration
nano nginx/conf.d/myerp.conf
```

Update the `server_name` directive:
```nginx
server_name your-domain.com www.your-domain.com;
```

### 3. Create Required Directories

```bash
# Create SSL directory for certificates
mkdir -p nginx/ssl

# Create backup directory
mkdir -p backups

# Make backup script executable
chmod +x scripts/backup.sh
```

---

## Deployment

### 1. Build and Start Services

```bash
# Build all Docker images
docker-compose -f docker-compose.prod.yml build

# Start all services in detached mode
docker-compose -f docker-compose.prod.yml up -d

# Check that all services are running
docker-compose -f docker-compose.prod.yml ps
```

Expected output:
```
NAME                    STATUS              PORTS
myerp-postgres-prod     Up (healthy)        5432/tcp
myerp-redis-prod        Up (healthy)        6379/tcp
myerp-minio-prod        Up (healthy)        9000-9001/tcp
myerp-backend-prod      Up (healthy)
myerp-frontend-prod     Up (healthy)
myerp-nginx-prod        Up (healthy)        80/tcp, 443/tcp
myerp-prometheus-prod   Up                  9090/tcp
myerp-grafana-prod      Up                  3001/tcp
myerp-backup-prod       Up
```

### 2. Initialize Database

```bash
# Run database migrations
docker-compose -f docker-compose.prod.yml exec backend node dist/database/migrations/run-migrations.js

# Verify database connection
docker-compose -f docker-compose.prod.yml exec backend node -e "
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  pool.query('SELECT NOW()', (err, res) => {
    console.log(err ? err : 'Database connected: ' + res.rows[0].now);
    pool.end();
  });
"
```

### 3. Initialize MinIO Bucket

```bash
# Access MinIO container
docker-compose -f docker-compose.prod.yml exec minio sh

# Create bucket (inside container)
mc alias set local http://localhost:9000 $MINIO_ROOT_USER $MINIO_ROOT_PASSWORD
mc mb local/myerp-uploads
mc policy set public local/myerp-uploads
exit
```

### 4. Verify Application is Running

```bash
# Check backend health
curl http://localhost/api/health

# Should return: {"status":"ok","timestamp":"..."}

# Check frontend
curl -I http://localhost/

# Should return: HTTP/1.1 200 OK
```

### 5. View Logs

```bash
# View all logs
docker-compose -f docker-compose.prod.yml logs -f

# View specific service logs
docker-compose -f docker-compose.prod.yml logs -f backend
docker-compose -f docker-compose.prod.yml logs -f frontend
docker-compose -f docker-compose.prod.yml logs -f nginx
```

---

## SSL/TLS Setup

### Option 1: Let's Encrypt (Recommended - FREE)

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx -y

# Stop nginx temporarily
docker-compose -f docker-compose.prod.yml stop nginx

# Obtain certificate
sudo certbot certonly --standalone -d your-domain.com -d www.your-domain.com

# Certificates will be saved to:
# /etc/letsencrypt/live/your-domain.com/fullchain.pem
# /etc/letsencrypt/live/your-domain.com/privkey.pem

# Copy certificates to nginx/ssl directory
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem nginx/ssl/
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem nginx/ssl/
sudo chown -R $USER:$USER nginx/ssl/

# Update nginx configuration
nano nginx/conf.d/myerp.conf
```

Uncomment the HTTPS server block in `nginx/conf.d/myerp.conf` and update:
```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    # ... rest of configuration
}
```

Also uncomment the HTTP to HTTPS redirect:
```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    return 301 https://$server_name$request_uri;
}
```

```bash
# Restart nginx
docker-compose -f docker-compose.prod.yml restart nginx

# Set up auto-renewal
sudo certbot renew --dry-run

# Add renewal cron job
(crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --post-hook 'cp /etc/letsencrypt/live/your-domain.com/*.pem ~/apps/myerp_app/nginx/ssl/ && docker-compose -f ~/apps/myerp_app/docker-compose.prod.yml restart nginx'") | crontab -
```

### Option 2: OVH SSL Certificate

Follow OVH documentation to obtain and configure SSL certificate for your domain.

---

## Monitoring & Maintenance

### Access Monitoring Dashboards

**Grafana:**
```
URL: http://your-domain.com:3001
Username: admin
Password: (from GRAFANA_ADMIN_PASSWORD in .env.production)
```

**Prometheus:**
```
URL: http://your-domain.com:9090
```

**MinIO Console:**
```
URL: http://your-domain.com:9001
Username: (from MINIO_ACCESS_KEY in .env.production)
Password: (from MINIO_SECRET_KEY in .env.production)
```

### Regular Maintenance Tasks

```bash
# View container resource usage
docker stats

# Clean up old Docker images
docker system prune -a

# Update application (when new version is available)
cd ~/apps/myerp_app
git pull
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d

# Restart all services
docker-compose -f docker-compose.prod.yml restart

# Stop all services
docker-compose -f docker-compose.prod.yml down

# Start all services
docker-compose -f docker-compose.prod.yml up -d
```

---

## Backup & Recovery

### Automatic Backups

Backups are configured to run automatically at 2 AM daily (configurable via `BACKUP_SCHEDULE`).

**Check backup status:**
```bash
ls -lh backups/
```

### Manual Backup

```bash
# Database backup
docker-compose -f docker-compose.prod.yml exec postgres pg_dump -U myerp myerp_db | gzip > backups/manual_backup_$(date +%Y%m%d_%H%M%S).sql.gz

# MinIO data backup
docker-compose -f docker-compose.prod.yml exec minio mc mirror local/myerp-uploads /backups/minio-$(date +%Y%m%d)/
```

### Restore from Backup

```bash
# Restore database
gunzip -c backups/myerp_db_backup_20240125_020000.sql.gz | docker-compose -f docker-compose.prod.yml exec -T postgres psql -U myerp myerp_db

# Restart backend to apply changes
docker-compose -f docker-compose.prod.yml restart backend
```

### Off-Site Backup (Recommended)

Set up automated backups to OVH Object Storage or another remote location:

```bash
# Install rclone
curl https://rclone.org/install.sh | sudo bash

# Configure rclone for OVH Object Storage
rclone config

# Add to crontab for daily off-site backup
echo "0 4 * * * rclone sync ~/apps/myerp_app/backups/ ovh:myerp-backups/" | crontab -
```

---

## Troubleshooting

### Check Service Health

```bash
# Check all containers
docker-compose -f docker-compose.prod.yml ps

# Check specific service health
docker-compose -f docker-compose.prod.yml exec backend curl http://localhost:4000/health
```

### Common Issues

#### 1. Database Connection Error

```bash
# Check PostgreSQL logs
docker-compose -f docker-compose.prod.yml logs postgres

# Verify DATABASE_URL in .env.production
docker-compose -f docker-compose.prod.yml exec backend env | grep DATABASE

# Restart postgres and backend
docker-compose -f docker-compose.prod.yml restart postgres backend
```

#### 2. Redis Connection Error

```bash
# Check Redis logs
docker-compose -f docker-compose.prod.yml logs redis

# Test Redis connection
docker-compose -f docker-compose.prod.yml exec redis redis-cli -a your_redis_password ping
# Should return: PONG
```

#### 3. MinIO Bucket Not Found

```bash
# List buckets
docker-compose -f docker-compose.prod.yml exec minio mc ls local/

# Create bucket if missing
docker-compose -f docker-compose.prod.yml exec minio mc mb local/myerp-uploads
docker-compose -f docker-compose.prod.yml exec minio mc policy set public local/myerp-uploads
```

#### 4. Frontend Not Loading

```bash
# Check frontend logs
docker-compose -f docker-compose.prod.yml logs frontend

# Check nginx logs
docker-compose -f docker-compose.prod.yml logs nginx

# Rebuild frontend
docker-compose -f docker-compose.prod.yml build frontend
docker-compose -f docker-compose.prod.yml up -d frontend
```

#### 5. SSL Certificate Issues

```bash
# Verify certificate files exist
ls -la nginx/ssl/

# Check nginx configuration
docker-compose -f docker-compose.prod.yml exec nginx nginx -t

# Renew Let's Encrypt certificate
sudo certbot renew --force-renewal
sudo cp /etc/letsencrypt/live/your-domain.com/*.pem ~/apps/myerp_app/nginx/ssl/
docker-compose -f docker-compose.prod.yml restart nginx
```

#### 6. Port Already in Use

```bash
# Find process using port 80
sudo lsof -i :80

# Kill process if needed
sudo kill -9 <PID>

# Or change port in docker-compose.prod.yml
```

### View Application Logs

```bash
# Backend logs
docker-compose -f docker-compose.prod.yml logs -f backend

# Frontend logs
docker-compose -f docker-compose.prod.yml logs -f frontend

# All logs with timestamps
docker-compose -f docker-compose.prod.yml logs -f --timestamps

# Last 100 lines
docker-compose -f docker-compose.prod.yml logs --tail=100
```

### Emergency Recovery

```bash
# Stop all services
docker-compose -f docker-compose.prod.yml down

# Remove all containers and volumes (WARNING: DATA LOSS)
docker-compose -f docker-compose.prod.yml down -v

# Restore from backup and restart
# (Follow restore procedures above)
docker-compose -f docker-compose.prod.yml up -d
```

---

## Performance Optimization

### Database Optimization

```bash
# Access PostgreSQL
docker-compose -f docker-compose.prod.yml exec postgres psql -U myerp myerp_db

# Run VACUUM to optimize
VACUUM ANALYZE;

# Check database size
SELECT pg_size_pretty(pg_database_size('myerp_db'));
```

### Resource Limits

Edit `docker-compose.prod.yml` to add resource limits:

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
```

### Nginx Caching

Add to `nginx/conf.d/myerp.conf`:

```nginx
# Cache static assets
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=static_cache:10m max_size=100m inactive=60m use_temp_path=off;

location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
    proxy_cache static_cache;
    proxy_cache_valid 200 1h;
    add_header X-Cache-Status $upstream_cache_status;
}
```

---

## Security Checklist

- [ ] Changed all default passwords in `.env.production`
- [ ] Generated secure random strings for JWT secrets
- [ ] Configured SSL/TLS certificates
- [ ] Enabled UFW firewall
- [ ] Configured automatic security updates
- [ ] Set up automated backups with off-site storage
- [ ] Configured monitoring and alerting
- [ ] Restricted database access to backend only
- [ ] Enabled CORS with specific origins
- [ ] Reviewed and hardened nginx configuration
- [ ] Set up log rotation
- [ ] Configured fail2ban (optional but recommended)

---

## Support & Maintenance Contract

For production support, maintenance contracts, or custom development:
- Email: support@myerp.com
- Documentation: See CLAUDE.md in project root

---

## Appendix: Useful Commands

```bash
# Quick restart
docker-compose -f docker-compose.prod.yml restart

# Update and restart specific service
docker-compose -f docker-compose.prod.yml up -d --build backend

# Execute command in container
docker-compose -f docker-compose.prod.yml exec backend sh

# Copy files from container
docker cp myerp-backend-prod:/app/logs/error.log ./

# Monitor resource usage in real-time
docker stats

# Clean up Docker system
docker system prune -a --volumes

# Export database schema
docker-compose -f docker-compose.prod.yml exec postgres pg_dump -U myerp -s myerp_db > schema.sql
```

---

**Deployment Date**: _______________
**Deployed By**: _______________
**Server IP**: _______________
**Domain**: _______________

---

*This deployment guide is maintained as part of the MyERP project. Please update this document when making infrastructure changes.*

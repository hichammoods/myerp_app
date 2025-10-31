# MyERP Production Deployment Guide

This guide walks you through deploying MyERP on an OVHcloud VPS2 (or similar).

## Prerequisites

- OVHcloud VPS2 (2 vCPU, 4GB RAM, 80GB SSD)
- Domain name pointed to your VPS IP
- SSH access to your VPS
- Basic Linux command line knowledge

## Table of Contents

1. [VPS Initial Setup](#1-vps-initial-setup)
2. [Install Docker & Dependencies](#2-install-docker--dependencies)
3. [Clone and Configure Application](#3-clone-and-configure-application)
4. [Deploy Application](#4-deploy-application)
5. [Setup SSL Certificate](#5-setup-ssl-certificate)
6. [Post-Deployment](#6-post-deployment)
7. [Maintenance](#7-maintenance)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. VPS Initial Setup

### 1.1 Purchase OVHcloud VPS2

1. Go to [ovhcloud.com](https://www.ovhcloud.com)
2. Select **VPS → VPS2**
3. Choose **Ubuntu 22.04 LTS** as operating system
4. Select location (Gravelines/France recommended for Europe)
5. Complete purchase
6. Wait for email with access credentials

### 1.2 Initial SSH Connection

```bash
# Connect as root (use credentials from email)
ssh root@your-vps-ip
```

### 1.3 Create Non-Root User

```bash
# Update system
apt update && apt upgrade -y

# Create new user (replace 'myerp' with your username)
adduser myerp
usermod -aG sudo myerp

# Switch to new user
su - myerp
```

### 1.4 Setup SSH Key Authentication

**On your local machine:**
```bash
# Generate SSH key (if you don't have one)
ssh-keygen -t ed25519 -C "your_email@example.com"

# Copy key to server
ssh-copy-id myerp@your-vps-ip
```

**On VPS:**
```bash
# Disable password authentication (as root)
sudo nano /etc/ssh/sshd_config

# Set these values:
PasswordAuthentication no
PermitRootLogin no
PubkeyAuthentication yes

# Restart SSH
sudo systemctl restart sshd
```

### 1.5 Configure Firewall

```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
sudo ufw status
```

---

## 2. Install Docker & Dependencies

### 2.1 Install Docker

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add current user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Verify installation
docker --version
```

### 2.2 Install Docker Compose

```bash
sudo apt install docker-compose -y
docker-compose --version
```

### 2.3 Install Additional Tools

```bash
sudo apt install -y git nginx-light certbot python3-certbot-nginx
```

---

## 3. Clone and Configure Application

### 3.1 Clone Repository

```bash
cd ~
git clone https://github.com/hichammoods/myerp_app.git
cd myerp_app
```

### 3.2 Create Environment File

```bash
nano .env.production
```

**Paste the following (replace values with secure credentials):**

```env
# Database
DATABASE_URL=postgresql://myerp:CHANGE_DB_PASSWORD@postgres:5432/myerp_db
DATABASE_PASSWORD=CHANGE_DB_PASSWORD
DATABASE_POOL_SIZE=20

# Redis
REDIS_URL=redis://:CHANGE_REDIS_PASSWORD@redis:6379
REDIS_PASSWORD=CHANGE_REDIS_PASSWORD

# MinIO
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=CHANGE_MINIO_ACCESS_KEY
MINIO_SECRET_KEY=CHANGE_MINIO_SECRET_KEY
MINIO_BUCKET=myerp-uploads
MINIO_USE_SSL=false

# JWT
JWT_SECRET=CHANGE_THIS_TO_RANDOM_64_CHAR_STRING
JWT_EXPIRY=1h
REFRESH_TOKEN_EXPIRY=7d

# Application
NODE_ENV=production
API_PORT=4000
FRONTEND_URL=https://yourdomain.com
API_URL=https://yourdomain.com/api

# Email (optional - configure later)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=noreply@yourdomain.com
```

### 3.3 Generate Secure Secrets

```bash
# Generate JWT secret
openssl rand -base64 48

# Generate database password
openssl rand -base64 32

# Generate Redis password
openssl rand -base64 32

# Generate MinIO access key
openssl rand -base64 24

# Generate MinIO secret key
openssl rand -base64 32
```

**Copy these values into `.env.production`**

### 3.4 Update Domain in Nginx Config

```bash
# Edit nginx config
nano nginx/nginx.conf

# Replace 'yourdomain.com' with your actual domain
```

---

## 4. Deploy Application

### 4.1 Run Deployment Script

```bash
chmod +x deploy.sh
./deploy.sh
```

This script will:
- Build Docker images
- Start all services
- Run database migrations
- Show service status

### 4.2 Verify Services

```bash
# Check all services are running
docker-compose -f docker-compose.production.yml ps

# Check logs
docker-compose -f docker-compose.production.yml logs -f

# Test API
curl http://localhost/api/health
```

### 4.3 Create First Admin User

```bash
# Connect to API container
docker-compose -f docker-compose.production.yml exec api sh

# Run inside container
node -e "
const bcrypt = require('bcryptjs');
const { Client } = require('pg');

const client = new Client({ connectionString: process.env.DATABASE_URL });

client.connect().then(async () => {
  const hash = await bcrypt.hash('admin123', 10);
  await client.query(
    'INSERT INTO users (email, password, role, first_name, last_name) VALUES ($1, $2, $3, $4, $5)',
    ['admin@myerp.com', hash, 'admin', 'Admin', 'User']
  );
  console.log('Admin user created!');
  process.exit(0);
});
"
```

---

## 5. Setup SSL Certificate

### 5.1 Point Domain to VPS

Before setting up SSL, ensure your domain's A record points to your VPS IP:

```
Type: A
Name: @ (or subdomain)
Value: your-vps-ip
TTL: 3600
```

Wait 5-10 minutes for DNS propagation.

### 5.2 Obtain Let's Encrypt Certificate

```bash
# Run SSL setup script
./setup-ssl.sh yourdomain.com your-email@example.com
```

### 5.3 Update Nginx for HTTPS

```bash
# Edit nginx config
nano nginx/nginx.conf

# Uncomment the HTTPS server block (lines with #)
# Replace 'yourdomain.com' with your actual domain
# Update HTTP server to redirect to HTTPS

# Restart nginx
docker-compose -f docker-compose.production.yml restart nginx
```

### 5.4 Test SSL

```bash
# Test HTTPS
curl https://yourdomain.com

# Check SSL grade
# Visit: https://www.ssllabs.com/ssltest/analyze.html?d=yourdomain.com
```

---

## 6. Post-Deployment

### 6.1 Setup Automatic Backups

```bash
# Test backup script
./backup.sh

# Add to crontab for daily backups at 2 AM
crontab -e

# Add this line:
0 2 * * * /home/myerp/myerp_app/backup.sh >> /home/myerp/myerp_app/backup.log 2>&1
```

### 6.2 Configure Email (Optional)

For Gmail SMTP:
1. Enable 2FA on your Google account
2. Generate an App Password: https://myaccount.google.com/apppasswords
3. Update `.env.production` with credentials
4. Restart services: `docker-compose -f docker-compose.production.yml restart api`

### 6.3 Setup Monitoring (Optional)

Consider using:
- **Uptime monitoring**: UptimeRobot (free)
- **Server monitoring**: Netdata (free, self-hosted)
- **Error tracking**: Sentry (free tier)

---

## 7. Maintenance

### 7.1 Update Application

```bash
cd ~/myerp_app
git pull origin main
./deploy.sh
```

### 7.2 View Logs

```bash
# All services
docker-compose -f docker-compose.production.yml logs -f

# Specific service
docker-compose -f docker-compose.production.yml logs -f api

# Last 100 lines
docker-compose -f docker-compose.production.yml logs --tail=100 api
```

### 7.3 Restart Services

```bash
# Restart all
docker-compose -f docker-compose.production.yml restart

# Restart specific service
docker-compose -f docker-compose.production.yml restart api
```

### 7.4 Database Migrations

```bash
# Run migrations
docker-compose -f docker-compose.production.yml exec api npm run migrate
```

### 7.5 Scale Services (if needed)

```bash
# Scale API to 2 instances
docker-compose -f docker-compose.production.yml up -d --scale api=2
```

---

## 8. Troubleshooting

### 8.1 Service Won't Start

```bash
# Check logs
docker-compose -f docker-compose.production.yml logs [service_name]

# Check service status
docker-compose -f docker-compose.production.yml ps

# Rebuild and restart
docker-compose -f docker-compose.production.yml up -d --build --force-recreate
```

### 8.2 Database Connection Issues

```bash
# Check PostgreSQL logs
docker-compose -f docker-compose.production.yml logs postgres

# Connect to database manually
docker-compose -f docker-compose.production.yml exec postgres psql -U myerp myerp_db
```

### 8.3 Out of Memory

```bash
# Check memory usage
docker stats

# Check system memory
free -h

# Restart services to free memory
docker-compose -f docker-compose.production.yml restart
```

### 8.4 Disk Space Issues

```bash
# Check disk usage
df -h

# Clean Docker system
docker system prune -a

# Clean old images
docker image prune -a

# Clean logs
sudo journalctl --vacuum-size=100M
```

### 8.5 SSL Certificate Renewal

Certificates auto-renew via Certbot container. To manually renew:

```bash
docker-compose -f docker-compose.production.yml exec certbot certbot renew
docker-compose -f docker-compose.production.yml restart nginx
```

---

## Performance Optimization

### For 4GB RAM VPS:

1. **Limit container memory:**

```yaml
# Add to docker-compose.production.yml under each service
services:
  postgres:
    mem_limit: 1g
    mem_reservation: 512m
  
  api:
    mem_limit: 512m
    mem_reservation: 256m
```

2. **Enable swap:**

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

3. **Optimize PostgreSQL:**

```bash
# Edit postgresql.conf
docker-compose -f docker-compose.production.yml exec postgres sh
vi /var/lib/postgresql/data/postgresql.conf

# Set these values:
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
work_mem = 4MB
max_connections = 100
```

---

## Security Checklist

- [x] SSH key authentication enabled
- [x] Password authentication disabled
- [x] Root login disabled
- [x] Firewall configured (UFW)
- [x] SSL/TLS certificate installed
- [x] Strong passwords for all services
- [x] Regular backups configured
- [ ] Fail2ban installed (optional)
- [ ] Monitoring setup (optional)
- [ ] Offsite backup location (optional)

---

## Support

For issues or questions:
- Check logs: `docker-compose -f docker-compose.production.yml logs`
- GitHub Issues: https://github.com/hichammoods/myerp_app/issues
- Email: support@yourcompany.com

---

## Costs Estimate

**OVHcloud VPS2:**
- VPS2: €7-8/month
- Domain: €10/year
- SSL: Free (Let's Encrypt)
- **Total: ~€10/month**

**Cheaper alternative: Contabo VPS S**
- 4 vCPU, 8GB RAM, 200GB SSD: €5.99/month
- Better specs but mixed reputation


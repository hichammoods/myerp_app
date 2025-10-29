# MyERP - Quick Deployment Reference Card

## 🚀 One-Page Deployment Guide for OVH

### Prerequisites Checklist
- [ ] OVH VPS (4GB RAM minimum)
- [ ] Ubuntu 22.04 LTS installed
- [ ] Domain pointing to server IP
- [ ] SSH access configured

---

## Step 1: Server Setup (10 minutes)

```bash
# Connect to server
ssh root@your-server-ip

# Update system
apt update && apt upgrade -y

# Create user
adduser myerp
usermod -aG sudo myerp

# Configure firewall
apt install ufw -y
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
usermod -aG docker myerp
apt install docker-compose -y

# Switch to myerp user
su - myerp
```

---

## Step 2: Install Application (5 minutes)

```bash
# Clone repository
mkdir -p ~/apps && cd ~/apps
git clone <your-repo-url> myerp_app
cd myerp_app

# Create directories
mkdir -p nginx/ssl backups
chmod +x scripts/backup.sh
```

---

## Step 3: Configure Environment (15 minutes)

```bash
# Copy environment file
cp .env.production.example .env.production

# Generate secrets
openssl rand -base64 64  # Copy for JWT_SECRET
openssl rand -base64 64  # Copy for REFRESH_TOKEN_SECRET
openssl rand -base64 64  # Copy for SESSION_SECRET

# Edit configuration
nano .env.production
```

**Required Changes in .env.production:**
```env
DOMAIN=your-domain.com
FRONTEND_URL=https://your-domain.com

POSTGRES_PASSWORD=<strong-password>
REDIS_PASSWORD=<strong-password>
MINIO_ACCESS_KEY=<access-key>
MINIO_SECRET_KEY=<secret-key>

JWT_SECRET=<generated-secret-1>
REFRESH_TOKEN_SECRET=<generated-secret-2>
SESSION_SECRET=<generated-secret-3>

GRAFANA_ADMIN_PASSWORD=<admin-password>

SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=noreply@your-domain.com
```

**Update domain in Nginx:**
```bash
nano nginx/conf.d/myerp.conf
# Change: server_name your-domain.com www.your-domain.com;
```

---

## Step 4: Deploy (10 minutes)

```bash
# Build images
docker-compose -f docker-compose.prod.yml build

# Start services
docker-compose -f docker-compose.prod.yml up -d

# Check status (wait for all to show "healthy")
docker-compose -f docker-compose.prod.yml ps

# Initialize MinIO bucket
docker-compose -f docker-compose.prod.yml exec minio sh -c "
  mc alias set local http://localhost:9000 \$MINIO_ROOT_USER \$MINIO_ROOT_PASSWORD &&
  mc mb local/myerp-uploads &&
  mc policy set public local/myerp-uploads
"

# Test application
curl http://localhost/api/health
# Should return: {"status":"ok","timestamp":"..."}
```

---

## Step 5: SSL Setup (10 minutes)

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx -y

# Stop nginx temporarily
docker-compose -f docker-compose.prod.yml stop nginx

# Obtain certificate
sudo certbot certonly --standalone -d your-domain.com -d www.your-domain.com

# Copy certificates
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem nginx/ssl/
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem nginx/ssl/
sudo chown -R $USER:$USER nginx/ssl/

# Enable HTTPS in Nginx config
nano nginx/conf.d/myerp.conf
# Uncomment HTTPS server block
# Uncomment HTTP to HTTPS redirect

# Restart nginx
docker-compose -f docker-compose.prod.yml up -d nginx

# Test HTTPS
curl -I https://your-domain.com
```

**Setup Auto-Renewal:**
```bash
# Add cron job for certificate renewal
(crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --post-hook 'cp /etc/letsencrypt/live/your-domain.com/*.pem ~/apps/myerp_app/nginx/ssl/ && cd ~/apps/myerp_app && docker-compose -f docker-compose.prod.yml restart nginx' >> /var/log/certbot-renew.log 2>&1") | crontab -
```

---

## Step 6: Verify Deployment (5 minutes)

```bash
# Check all services
docker-compose -f docker-compose.prod.yml ps

# Check logs
docker-compose -f docker-compose.prod.yml logs -f

# Access application
https://your-domain.com  # Should load application
https://your-domain.com/api/health  # Should return status ok

# Access monitoring
http://your-domain.com:3001  # Grafana (admin / your-password)
http://your-domain.com:9090  # Prometheus
```

---

## Common Commands Reference

### Service Management
```bash
# View status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f [service_name]

# Restart all services
docker-compose -f docker-compose.prod.yml restart

# Restart specific service
docker-compose -f docker-compose.prod.yml restart backend

# Stop all services
docker-compose -f docker-compose.prod.yml down

# Start all services
docker-compose -f docker-compose.prod.yml up -d

# Rebuild and restart
docker-compose -f docker-compose.prod.yml up -d --build [service_name]
```

### Monitoring
```bash
# Resource usage
docker stats

# Disk usage
df -h
docker system df

# Service health
curl http://localhost/api/health
```

### Backups
```bash
# Manual backup
docker-compose -f docker-compose.prod.yml exec postgres pg_dump -U myerp myerp_db | gzip > backups/manual_$(date +%Y%m%d_%H%M%S).sql.gz

# List backups
ls -lh backups/

# Restore backup
gunzip -c backups/your_backup.sql.gz | docker-compose -f docker-compose.prod.yml exec -T postgres psql -U myerp myerp_db
```

### Updates
```bash
# Pull latest code
git pull

# Rebuild and restart
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d
```

---

## Troubleshooting Quick Fixes

### Service won't start
```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs [service_name]

# Remove and recreate
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d
```

### Database connection error
```bash
# Check PostgreSQL
docker-compose -f docker-compose.prod.yml logs postgres
docker-compose -f docker-compose.prod.yml restart postgres backend
```

### Port already in use
```bash
# Find process
sudo lsof -i :80

# Kill process
sudo kill -9 <PID>
```

### Clean Docker system
```bash
# Remove unused containers, networks, images
docker system prune -a
```

---

## Emergency Contacts

- **OVH Support**: https://www.ovh.com/support
- **Documentation**: See DEPLOYMENT_OVH.md for detailed guide

---

## Security Reminders

✅ All default passwords changed
✅ Firewall enabled (UFW)
✅ SSL/TLS configured
✅ Backups enabled
✅ Monitoring active

---

**Total Deployment Time**: ~1 hour

**For detailed instructions, see**: `DEPLOYMENT_OVH.md`

**For deployment checklist, see**: `DEPLOYMENT_CHECKLIST.md`

# MyERP Production Deployment Checklist

## Pre-Deployment

### Server Setup
- [ ] OVH VPS provisioned (minimum 4GB RAM, 2 vCPUs)
- [ ] Ubuntu 22.04 LTS or Debian 12 installed
- [ ] Domain name configured and DNS pointing to server IP
- [ ] SSH access configured with key-based authentication
- [ ] Non-root user created with sudo privileges
- [ ] Firewall (UFW) installed and configured
  - [ ] SSH port allowed
  - [ ] HTTP (80) allowed
  - [ ] HTTPS (443) allowed
- [ ] Docker installed
- [ ] Docker Compose installed
- [ ] User added to docker group

### Repository & Code
- [ ] Application code committed to Git repository
- [ ] All sensitive data removed from codebase
- [ ] `.gitignore` properly configured
- [ ] Latest stable version tagged in Git

### Configuration Files
- [ ] `.env.production` created from `.env.production.example`
- [ ] All passwords changed from defaults
- [ ] JWT secrets generated (minimum 32 characters)
- [ ] SMTP credentials configured
- [ ] Domain names updated in all configuration files
- [ ] CORS origins configured correctly
- [ ] Database credentials set
- [ ] Redis password set
- [ ] MinIO credentials configured

### Security
- [ ] Generated secure random strings for:
  - [ ] POSTGRES_PASSWORD
  - [ ] REDIS_PASSWORD
  - [ ] MINIO_ACCESS_KEY
  - [ ] MINIO_SECRET_KEY
  - [ ] JWT_SECRET
  - [ ] REFRESH_TOKEN_SECRET
  - [ ] SESSION_SECRET
  - [ ] GRAFANA_ADMIN_PASSWORD
- [ ] Reviewed all exposed ports
- [ ] Planned SSL/TLS certificate strategy (Let's Encrypt)

---

## Deployment Steps

### Initial Deployment
- [ ] Connected to server via SSH
- [ ] Cloned repository to server
- [ ] Copied and configured `.env.production`
- [ ] Created required directories:
  - [ ] `nginx/ssl`
  - [ ] `backups`
  - [ ] `monitoring`
- [ ] Made backup script executable: `chmod +x scripts/backup.sh`
- [ ] Built Docker images: `docker-compose -f docker-compose.prod.yml build`
- [ ] Started all services: `docker-compose -f docker-compose.prod.yml up -d`

### Service Verification
- [ ] All containers started successfully
- [ ] All containers show "healthy" status
- [ ] PostgreSQL accessible and healthy
- [ ] Redis accessible and healthy
- [ ] MinIO accessible and healthy
- [ ] Backend API responding on port 4000
- [ ] Frontend serving on port 80
- [ ] Nginx reverse proxy working

### Database Setup
- [ ] Database migrations executed successfully
- [ ] Database connection tested from backend
- [ ] Initial admin user created (if applicable)
- [ ] Sample data loaded (if needed)

### MinIO Setup
- [ ] MinIO bucket created: `myerp-uploads`
- [ ] Bucket permissions set to public read
- [ ] Test file upload successful
- [ ] MinIO console accessible

### SSL/TLS Configuration
- [ ] Let's Encrypt certbot installed
- [ ] SSL certificates obtained for domain
- [ ] Certificates copied to `nginx/ssl/`
- [ ] Nginx HTTPS configuration enabled
- [ ] HTTP to HTTPS redirect configured
- [ ] SSL certificate auto-renewal configured
- [ ] Tested HTTPS access to application

---

## Post-Deployment

### Functional Testing
- [ ] Application accessible via domain (HTTPS)
- [ ] Login functionality working
- [ ] Contact management working
- [ ] Product management working
- [ ] Quotation creation working
- [ ] Sales order creation working
- [ ] Invoice generation working
- [ ] PDF generation working
- [ ] Image upload working
- [ ] User permissions working correctly

### Monitoring Setup
- [ ] Grafana accessible at domain:3001
- [ ] Grafana admin login working
- [ ] Prometheus collecting metrics
- [ ] Backend metrics visible in Prometheus
- [ ] Basic dashboards configured in Grafana
- [ ] Alerts configured (optional)

### Backup Configuration
- [ ] Backup script tested manually
- [ ] Automated backup cron job working
- [ ] Backup files being created in `/backups`
- [ ] Backup retention policy working
- [ ] Off-site backup configured (recommended)
- [ ] Restore procedure tested

### Performance & Optimization
- [ ] Application response time acceptable (< 2 seconds)
- [ ] Database queries optimized
- [ ] Static assets cached properly
- [ ] Gzip compression enabled
- [ ] Resource usage monitored (CPU, RAM, Disk)

### Security Hardening
- [ ] Firewall rules verified
- [ ] All default passwords changed
- [ ] SSH login with password disabled (key-only)
- [ ] Fail2ban installed and configured (optional)
- [ ] Security headers configured in Nginx
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] Audit logging enabled

### Documentation
- [ ] Server details documented (IP, credentials location)
- [ ] Deployment date and version recorded
- [ ] Access credentials stored securely (password manager)
- [ ] Monitoring dashboard URLs documented
- [ ] Backup locations documented
- [ ] Recovery procedures documented

---

## Maintenance Setup

### Automated Tasks
- [ ] Database backups scheduled (daily 2 AM)
- [ ] SSL certificate renewal (certbot cron)
- [ ] Off-site backup sync (if configured)
- [ ] Docker image cleanup scheduled
- [ ] Log rotation configured

### Monitoring & Alerts
- [ ] Disk space monitoring
- [ ] Memory usage monitoring
- [ ] CPU usage monitoring
- [ ] Service uptime monitoring
- [ ] Database connection monitoring
- [ ] Backup success monitoring
- [ ] SSL certificate expiry monitoring (30 days before)

### Update Procedures
- [ ] Git pull procedure documented
- [ ] Container rebuild procedure documented
- [ ] Database migration procedure documented
- [ ] Rollback procedure documented
- [ ] Zero-downtime update strategy planned (if needed)

---

## Go-Live Checklist

### Final Verification (Day Before)
- [ ] All stakeholders notified of go-live date
- [ ] Backup created and verified
- [ ] Rollback plan prepared
- [ ] Support team briefed
- [ ] Communication plan ready

### Go-Live (Launch Day)
- [ ] Final backup created
- [ ] DNS propagation verified
- [ ] SSL certificate verified
- [ ] Full application test completed
- [ ] Performance test completed
- [ ] All services monitored for 2-4 hours
- [ ] No critical errors in logs
- [ ] Team notified of successful launch

### Post Go-Live (First Week)
- [ ] Daily log review
- [ ] Daily backup verification
- [ ] Performance monitoring
- [ ] User feedback collection
- [ ] Issue tracking and resolution
- [ ] Documentation updates based on issues

---

## Emergency Contacts

| Role | Name | Contact | Availability |
|------|------|---------|-------------|
| System Administrator | _________ | _________ | _________ |
| Lead Developer | _________ | _________ | _________ |
| Database Admin | _________ | _________ | _________ |
| OVH Support | OVH | https://www.ovh.com/support | 24/7 |

---

## Rollback Plan

If deployment fails or critical issues arise:

1. **Immediate Actions**
   ```bash
   # Stop all services
   docker-compose -f docker-compose.prod.yml down

   # Restore previous database backup
   gunzip -c backups/latest_backup.sql.gz | docker exec -i myerp-postgres-prod psql -U myerp myerp_db

   # Checkout previous Git version
   git checkout <previous-version-tag>

   # Rebuild and restart
   docker-compose -f docker-compose.prod.yml build
   docker-compose -f docker-compose.prod.yml up -d
   ```

2. **Verify Rollback**
   - [ ] Application accessible
   - [ ] Database data intact
   - [ ] All services healthy

3. **Communicate**
   - [ ] Notify stakeholders
   - [ ] Document issues
   - [ ] Plan corrective actions

---

## Sign-Off

| Stage | Name | Signature | Date |
|-------|------|-----------|------|
| **Pre-Deployment Verified** | _________ | _________ | _____ |
| **Deployment Completed** | _________ | _________ | _____ |
| **Testing Completed** | _________ | _________ | _____ |
| **Production Approved** | _________ | _________ | _____ |

---

**Notes:**
- Check off items as completed
- Document any deviations from the plan
- Keep this checklist for audit and future reference
- Update checklist based on lessons learned

**Last Updated**: _______________

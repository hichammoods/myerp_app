# MyERP - Cloudflare Deployment Guide

Complete guide for deploying MyERP with Cloudflare for enhanced security, performance, and DDoS protection.

## Table of Contents
- [Why Use Cloudflare?](#why-use-cloudflare)
- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Step-by-Step Deployment](#step-by-step-deployment)
- [SSL/TLS Configuration](#ssltls-configuration)
- [Security Settings](#security-settings)
- [Performance Optimization](#performance-optimization)
- [Troubleshooting](#troubleshooting)

---

## Why Use Cloudflare?

### Benefits (All FREE on Free Plan)
- ✅ **DDoS Protection** - Protect against attacks that could take your server down
- ✅ **Global CDN** - Faster loading times worldwide (cached assets)
- ✅ **SSL/TLS** - Free SSL certificates, automatic renewal
- ✅ **Web Application Firewall (WAF)** - Block malicious traffic
- ✅ **Bot Protection** - Filter out bad bots
- ✅ **Analytics** - Traffic insights and threat monitoring
- ✅ **Zero Downtime SSL** - No certificate renewal downtime
- ✅ **IPv6 Support** - Future-proof your application
- ✅ **Always Online** - Cached version if server goes down

### What You Need
- Domain name (purchased on OVH or elsewhere)
- OVH VPS server
- Free Cloudflare account

---

## Architecture Overview

```
Internet Users
      ↓
[Cloudflare Network]
  • DDoS Protection
  • CDN Caching
  • SSL/TLS Termination
  • WAF Filtering
  • Bot Management
      ↓
[Your OVH Server]
  • Nginx Reverse Proxy
  • Backend API (Node.js)
  • Frontend (React)
  • PostgreSQL, Redis, MinIO
```

**Traffic Flow:**
1. User → Cloudflare (HTTPS)
2. Cloudflare → Your Server (HTTP or HTTPS with Origin Certificate)
3. Nginx → Backend/Frontend containers
4. Response path reversed

---

## Prerequisites

### Required
- [ ] OVH VPS provisioned (4GB RAM minimum)
- [ ] Ubuntu 22.04 LTS installed
- [ ] Domain name (OVH, Namecheap, or Cloudflare Registrar)
- [ ] Free Cloudflare account (sign up at cloudflare.com)
- [ ] MyERP application code cloned on server

### Recommended Knowledge
- Basic DNS concepts
- SSH access to server
- Command line familiarity

---

## Step-by-Step Deployment

### Phase 1: Domain Setup (15 minutes)

#### 1. Purchase Domain
**Option A: Buy on OVH** (Recommended for simplicity)
```
1. Visit ovhcloud.com/domains
2. Search for your domain (e.g., myerp-company.com)
3. Add to cart and purchase (~€10-15/year)
4. Wait 5-10 minutes for activation
```

**Option B: Buy on Cloudflare Registrar** (Cheapest)
```
1. Create Cloudflare account
2. Go to Domain Registration
3. Search and purchase at-cost pricing (~$9-10/year)
```

**Option C: Use Existing Domain**
```
If you already have a domain, proceed to next step
```

#### 2. Create Cloudflare Account
```
1. Go to https://cloudflare.com
2. Click "Sign Up" (FREE forever)
3. Enter email and create password
4. Verify email address
```

#### 3. Add Domain to Cloudflare
```
1. Log in to Cloudflare dashboard
2. Click "Add a Site"
3. Enter your domain name (e.g., myerp-company.com)
4. Click "Add site"
5. Select "Free" plan
6. Click "Continue"
```

#### 4. Cloudflare will scan your DNS records
```
Wait 30-60 seconds while Cloudflare scans existing DNS records
```

#### 5. Update Nameservers at Your Registrar

**If you bought on OVH:**
```
1. Log in to OVH control panel
2. Go to "Web Cloud" → "Domain names"
3. Click your domain name
4. Go to "DNS servers" tab
5. Click "Modify DNS servers"
6. Replace with Cloudflare nameservers (provided in Cloudflare dashboard):
   Example:
   - Primary: clark.ns.cloudflare.com
   - Secondary: roxy.ns.cloudflare.com
7. Click "Apply configuration"
8. Wait 1-24 hours for propagation (usually 1-2 hours)
```

**If you bought elsewhere:**
Follow your registrar's documentation to change nameservers to Cloudflare's.

#### 6. Verify Nameservers
```
In Cloudflare dashboard:
- Status will change from "Pending" to "Active" when nameservers update
- You'll receive email confirmation
- This can take 1-24 hours (usually within 2 hours)
```

---

### Phase 2: DNS Configuration (5 minutes)

#### Configure DNS Records in Cloudflare

```
1. In Cloudflare dashboard, go to "DNS" → "Records"
2. Delete any existing A records if present
3. Add A record for root domain:
   - Type: A
   - Name: @ (or leave blank for root)
   - IPv4 address: YOUR_OVH_SERVER_IP
   - Proxy status: ☁️ Proxied (orange cloud icon)
   - TTL: Auto
   - Click "Save"

4. Add A record for www subdomain:
   - Type: A
   - Name: www
   - IPv4 address: YOUR_OVH_SERVER_IP
   - Proxy status: ☁️ Proxied (orange cloud icon)
   - TTL: Auto
   - Click "Save"
```

**Important:** Make sure the cloud icon is **ORANGE** (Proxied), not gray!

**Optional Records:**
```
# If you want email (later)
- Type: MX
- Name: @
- Priority: 10
- Mail server: mail.your-domain.com

# If you need subdomains
- Type: A
- Name: api (for api.your-domain.com)
- IPv4: YOUR_OVH_SERVER_IP
- Proxied
```

---

### Phase 3: SSL/TLS Configuration (10 minutes)

#### Choose SSL/TLS Mode

```
1. In Cloudflare dashboard, go to "SSL/TLS"
2. Select encryption mode:
```

**Recommended: "Full" Mode** (Simple, no certificate needed on server)
```
- Cloudflare → Your Server: HTTP (unencrypted)
- User → Cloudflare: HTTPS (encrypted)
- Good for: Quick deployment, testing
- Configuration: Use nginx/conf.d/myerp-cloudflare.conf as-is
```

**Best: "Full (Strict)" Mode** (Most secure, requires Origin Certificate)
```
- Cloudflare → Your Server: HTTPS with verified certificate
- User → Cloudflare: HTTPS
- Good for: Production, maximum security
- Configuration: Follow steps below
```

#### Option 1: Full Mode (Simpler)
```
1. Select "Full" in SSL/TLS settings
2. Enable "Always Use HTTPS"
3. Enable "Automatic HTTPS Rewrites"
4. Done! No server certificate needed.
```

#### Option 2: Full (Strict) Mode (Recommended for Production)

**Generate Cloudflare Origin Certificate:**
```
1. In Cloudflare dashboard: SSL/TLS → Origin Server
2. Click "Create Certificate"
3. Select:
   - Let Cloudflare generate a private key and CSR: ✓
   - Certificate Validity: 15 years
   - Hostnames:
     * your-domain.com
     * *.your-domain.com (wildcard for subdomains)
4. Click "Create"
5. Copy the certificate and private key (keep browser open!)
```

**Save Certificates on Your Server:**
```bash
# SSH into your OVH server
ssh myerp@your-server-ip

# Navigate to app directory
cd ~/apps/myerp_app

# Create SSL directory if not exists
mkdir -p nginx/ssl

# Create origin certificate file
nano nginx/ssl/cloudflare-origin-cert.pem
# Paste the certificate (including -----BEGIN CERTIFICATE----- and -----END CERTIFICATE-----)
# Save with Ctrl+X, Y, Enter

# Create origin key file
nano nginx/ssl/cloudflare-origin-key.pem
# Paste the private key (including -----BEGIN PRIVATE KEY----- and -----END PRIVATE KEY-----)
# Save with Ctrl+X, Y, Enter

# Set proper permissions
chmod 600 nginx/ssl/cloudflare-origin-key.pem
chmod 644 nginx/ssl/cloudflare-origin-cert.pem
```

**Update Nginx Configuration:**
```bash
# Use the Cloudflare-specific config
cd ~/apps/myerp_app

# Remove or rename the default config
mv nginx/conf.d/myerp.conf nginx/conf.d/myerp.conf.backup

# Copy the Cloudflare config
cp nginx/conf.d/myerp-cloudflare.conf nginx/conf.d/myerp.conf

# Edit to uncomment HTTPS section
nano nginx/conf.d/myerp.conf

# Uncomment the entire "HTTPS Server" block (lines starting with #)
# Update: server_name your-domain.com www.your-domain.com;

# Save and exit
```

**Set Cloudflare to Full (Strict):**
```
1. In Cloudflare: SSL/TLS → Overview
2. Select "Full (strict)"
3. Enable "Always Use HTTPS"
4. Enable "Automatic HTTPS Rewrites"
```

---

### Phase 4: Server Deployment (30 minutes)

#### 1. Deploy Application

Follow the standard deployment process from `DEPLOYMENT_OVH.md`:

```bash
# On your OVH server
cd ~/apps/myerp_app

# Configure environment
cp .env.production.example .env.production
nano .env.production
```

**Important: Update these values for Cloudflare:**
```env
# Domain Configuration
DOMAIN=your-domain.com
FRONTEND_URL=https://your-domain.com
CORS_ORIGINS=https://your-domain.com

# Security - IMPORTANT for Cloudflare
TRUST_PROXY=true
SECURE_COOKIES=true
USE_CLOUDFLARE=true

# ... rest of configuration (passwords, secrets, etc.)
```

#### 2. Update Nginx Config
```bash
# Edit the Cloudflare nginx config
nano nginx/conf.d/myerp.conf

# Update server_name:
server_name your-domain.com www.your-domain.com;

# If using Full (Strict) mode, uncomment HTTPS server block
```

#### 3. Build and Start Services
```bash
# Build Docker images
docker-compose -f docker-compose.prod.yml build

# Start all services
docker-compose -f docker-compose.prod.yml up -d

# Check status
docker-compose -f docker-compose.prod.yml ps

# Check logs
docker-compose -f docker-compose.prod.yml logs -f nginx
```

#### 4. Initialize MinIO
```bash
docker-compose -f docker-compose.prod.yml exec minio sh -c "
  mc alias set local http://localhost:9000 \$MINIO_ROOT_USER \$MINIO_ROOT_PASSWORD &&
  mc mb local/myerp-uploads &&
  mc policy set public local/myerp-uploads
"
```

#### 5. Test Application
```bash
# Test from server (should work)
curl http://localhost/api/health

# Test from browser (wait 5 minutes for DNS)
https://your-domain.com/api/health
```

---

## Security Settings

### Enable Additional Cloudflare Security Features

#### 1. Firewall Rules (Optional)
```
Cloudflare Dashboard → Security → WAF
- Enable "OWASP Core Ruleset"
- Set sensitivity: Medium or High
```

#### 2. Rate Limiting (Free tier: 1 rule)
```
Security → Rate limiting rules
Create rule to protect login:
- URL: /api/auth/login
- Requests: 5 per 1 minute
- Action: Block for 1 hour
```

#### 3. Bot Fight Mode
```
Security → Bots
- Enable "Bot Fight Mode" (Free)
```

#### 4. Security Level
```
Security → Settings
- Security Level: Medium (or High for production)
```

#### 5. Browser Integrity Check
```
Security → Settings
- Browser Integrity Check: Enable
```

---

## Performance Optimization

### Caching Configuration

#### 1. Page Rules (Free tier: 3 rules)
```
Rules → Page Rules

Rule 1: Cache API health check
- URL: *your-domain.com/api/health
- Cache Level: Cache Everything
- Edge Cache TTL: 5 minutes

Rule 2: Don't cache API
- URL: *your-domain.com/api/*
- Cache Level: Bypass

Rule 3: Cache static assets
- URL: *your-domain.com/static/*
- Cache Level: Cache Everything
- Edge Cache TTL: 1 month
```

#### 2. Auto Minify
```
Speed → Optimization
- Auto Minify: Enable JavaScript, CSS, HTML
```

#### 3. Brotli Compression
```
Speed → Optimization
- Brotli: Enable
```

#### 4. Early Hints
```
Speed → Optimization
- Early Hints: Enable
```

#### 5. HTTP/3
```
Network → HTTP/3 (with QUIC): Enable
```

---

## Monitoring & Analytics

### View Cloudflare Analytics
```
Analytics → Traffic
- See bandwidth usage
- Request counts
- Cached vs uncached
- Threats blocked
- Geographic distribution
```

### Security Events
```
Security → Events
- View blocked requests
- Challenge logs
- Rate limit triggers
```

---

## Troubleshooting

### Issue 1: "Too Many Redirects" Error

**Cause:** Cloudflare SSL mode mismatch

**Solution:**
```
1. Go to Cloudflare: SSL/TLS → Overview
2. Change to "Full" (not "Flexible" or "Full Strict")
3. OR ensure your nginx HTTPS is properly configured for "Full Strict"
4. Clear browser cache
```

### Issue 2: Website Not Loading

**Check DNS:**
```bash
# From your local computer
nslookup your-domain.com

# Should show Cloudflare IPs (104.x.x.x or similar)
```

**Check Cloudflare Status:**
```
1. Cloudflare dashboard → Overview
2. Status should be "Active"
3. DNS records should show orange cloud (Proxied)
```

**Check Server:**
```bash
# SSH to server
curl http://localhost/api/health
# Should return: {"status":"healthy",...}

# Check nginx
docker-compose -f docker-compose.prod.yml logs nginx
```

### Issue 3: Real IP Shows Cloudflare IP

**Cause:** Nginx not configured to restore real IP

**Solution:**
```bash
# Verify you're using myerp-cloudflare.conf
cat nginx/conf.d/myerp.conf | grep "set_real_ip_from"

# Should show Cloudflare IP ranges

# Check backend TRUST_PROXY
grep TRUST_PROXY .env.production
# Should be: TRUST_PROXY=true

# Restart nginx
docker-compose -f docker-compose.prod.yml restart nginx backend
```

### Issue 4: MinIO/API Not Working

**Cause:** Cloudflare blocks certain ports or paths

**Solution:**
```
1. Don't proxy MinIO through Cloudflare (direct to server IP:9000)
2. OR use subdomain: minio.your-domain.com (set to DNS only - gray cloud)
3. API should work fine through Cloudflare
```

### Issue 5: SSL Certificate Errors with Origin Certificate

**Check Certificate:**
```bash
# On server
cd ~/apps/myerp_app
cat nginx/ssl/cloudflare-origin-cert.pem

# Should start with: -----BEGIN CERTIFICATE-----

# Check nginx config
docker-compose -f docker-compose.prod.yml exec nginx nginx -t
```

**Recreate Certificate:**
```
1. Cloudflare: SSL/TLS → Origin Server
2. Revoke old certificate
3. Create new certificate
4. Update files on server
5. Restart nginx
```

---

## Testing Checklist

After deployment, verify:

- [ ] Domain resolves to Cloudflare IPs
- [ ] HTTPS works (green padlock in browser)
- [ ] Application loads: https://your-domain.com
- [ ] API works: https://your-domain.com/api/health
- [ ] Login functionality works
- [ ] Cloudflare dashboard shows traffic
- [ ] Real visitor IPs logged correctly (not Cloudflare IPs)
- [ ] File uploads work (MinIO)
- [ ] PDF generation works

---

## Cloudflare Dashboard Quick Reference

| Feature | Location | Recommendation |
|---------|----------|----------------|
| DNS Records | DNS → Records | Proxied (orange) |
| SSL Mode | SSL/TLS → Overview | Full or Full (Strict) |
| Firewall | Security → WAF | Enable OWASP |
| Rate Limiting | Security → Rate limiting | Protect /api/auth/login |
| Caching | Caching → Configuration | Default settings OK |
| Analytics | Analytics → Traffic | Monitor regularly |

---

## Cost Summary

| Item | Cost |
|------|------|
| **Domain (OVH)** | €10-15/year |
| **OVH VPS** | €70-200/year |
| **Cloudflare** | €0 (FREE!) |
| **SSL Certificates** | €0 (FREE!) |
| **DDoS Protection** | €0 (FREE!) |
| **CDN** | €0 (FREE!) |
| **Total** | ~€80-215/year |

---

## Additional Resources

- **Cloudflare Documentation**: https://developers.cloudflare.com/
- **Cloudflare Community**: https://community.cloudflare.com/
- **Status Page**: https://www.cloudflarestatus.com/
- **Support**: https://support.cloudflare.com/

---

## Summary

### What You Get With Cloudflare (FREE)
- ✅ DDoS protection
- ✅ Global CDN (faster worldwide)
- ✅ Free SSL/TLS certificates
- ✅ Web Application Firewall
- ✅ Bot protection
- ✅ Analytics
- ✅ IPv6 support
- ✅ Always Online (cached fallback)

### Setup Time
- **DNS Propagation**: 1-24 hours (usually 1-2 hours)
- **Cloudflare Setup**: 15-20 minutes
- **Server Configuration**: 30-45 minutes
- **Total**: 2-25 hours (mostly waiting)

### Maintenance
- **SSL Renewal**: Automatic (Cloudflare handles it)
- **Security Updates**: Automatic (Cloudflare WAF)
- **Monitoring**: Via Cloudflare dashboard

---

**Your MyERP application is now protected by Cloudflare's global network!**

For standard deployment without Cloudflare, see `DEPLOYMENT_OVH.md`.

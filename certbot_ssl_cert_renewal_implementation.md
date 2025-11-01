# SSL Certificate Auto-Renewal Implementation Guide

**Application:** MyERP Internal Application
**Domain:** madecodesign.fr / www.madecodesign.fr
**Certificate Provider:** Let's Encrypt (via Certbot)
**Current Status:** Certificates exist but auto-renewal is NOT configured
**Deadline:** January 30, 2026 (certificate expiry)

---

## 📊 Current Situation

### What's Working ✅
- SSL certificates are installed and valid
- HTTPS is working for your site
- Certificate expires: **January 30, 2026** (90 days from Nov 1, 2025)
- Nginx can read certificates

### What's Broken ❌
- Certbot cannot see the certificates
- Auto-renewal will NOT work
- Certificates will expire and need manual renewal

### Evidence
```bash
# Test shows no certificates found by certbot
$ docker-compose -f docker-compose.production.yml --env-file .env.production exec certbot certbot certificates
No certificates found.

# Test shows no renewals attempted
$ docker-compose -f docker-compose.production.yml --env-file .env.production exec certbot certbot renew --dry-run
No simulated renewals were attempted.
```

---

## 🔍 Root Cause Analysis

### Why This Happened

**Likely scenario:**
1. You manually obtained SSL certificates (before Docker setup)
2. Certificates were placed in `/etc/letsencrypt/` on the host
3. Docker containers mount these certificates
4. Nginx can read them (volume mount works)
5. **BUT**: Certbot container has an empty volume
6. Certbot doesn't know these certificates exist
7. Auto-renewal fails silently

### Technical Details

**Your docker-compose.production.yml has:**
```yaml
nginx:
  volumes:
    - certbot_data:/etc/letsencrypt  # Shared volume

certbot:
  volumes:
    - certbot_data:/etc/letsencrypt  # Same volume (should be shared)
```

**Problem:**
- The `certbot_data` volume is currently empty
- Existing certificates are on the host system, not in the Docker volume
- Nginx might be reading from a different location

---

## 🎯 Solution Options

### Option 1: Re-obtain Certificates via Certbot (RECOMMENDED)

**Pros:**
- ✅ Clean solution
- ✅ Guaranteed auto-renewal
- ✅ Proper certbot management
- ✅ Takes 5 minutes

**Cons:**
- ⏱️ 2-3 minutes downtime
- 🔄 Need to restart containers

**Best for:** Permanent fix, set it and forget it

---

### Option 2: Manual Renewal Cron Job (WORKAROUND)

**Pros:**
- ✅ Quick setup (2 minutes)
- ✅ No downtime
- ✅ Works with current setup

**Cons:**
- ⚠️ Not ideal long-term
- ⚠️ More complex maintenance
- ⚠️ Requires stopping nginx for renewal

**Best for:** Temporary solution or if you can't restart containers now

---

### Option 3: Import Existing Certificates (ADVANCED)

**Pros:**
- ✅ Keeps current certificates
- ✅ No re-obtaining needed

**Cons:**
- ⚠️ Complex
- ⚠️ Might not work
- ⚠️ Requires manual volume manipulation

**Best for:** Advanced users only

---

## 📋 Implementation Plan: Option 1 (Recommended)

### Prerequisites

**Before you start:**
- [ ] SSH access to VPS
- [ ] Your email address for Let's Encrypt notifications
- [ ] Confirm domain DNS is pointing to your VPS
- [ ] Backup current setup (optional but recommended)

### Step-by-Step Implementation

#### Step 1: Backup Current Setup (Optional but Recommended)

```bash
# On VPS
cd ~/myerp_app

# Backup certificates (if accessible)
sudo cp -r /etc/letsencrypt /etc/letsencrypt.backup.$(date +%Y%m%d) 2>/dev/null || echo "No host certs to backup"

# Backup docker volumes
docker run --rm -v myerp_app_certbot_data:/data -v $(pwd):/backup \
  alpine tar czf /backup/certbot_volume_backup.tar.gz /data 2>/dev/null || echo "Volume empty"
```

#### Step 2: Stop All Containers

```bash
cd ~/myerp_app

# Stop all services
docker-compose -f docker-compose.production.yml --env-file .env.production down

# Verify all stopped
docker ps | grep myerp
# Should show nothing
```

**Expected downtime starts here:** ~2-3 minutes

#### Step 3: Remove Old Certbot Volume

```bash
# Remove the empty/broken certbot volume
docker volume rm myerp_app_certbot_data 2>/dev/null || true

# Verify it's removed
docker volume ls | grep certbot
# Should show nothing
```

#### Step 4: Start All Containers

```bash
cd ~/myerp_app

# Start all services (this creates fresh certbot volume)
docker-compose -f docker-compose.production.yml --env-file .env.production up -d

# Wait for containers to be fully ready
echo "Waiting 30 seconds for containers to start..."
sleep 30

# Verify all containers are running
docker-compose -f docker-compose.production.yml --env-file .env.production ps
```

**Expected output:**
```
NAME                STATUS
myerp-postgres      Up
myerp-redis         Up
myerp-minio         Up
myerp-api           Up
myerp-frontend      Up
myerp-nginx         Up
myerp-certbot       Up
```

#### Step 5: Obtain SSL Certificates

**IMPORTANT:** Replace `your-email@example.com` with your actual email!

```bash
# Obtain certificates via certbot
docker-compose -f docker-compose.production.yml --env-file .env.production exec certbot \
  certbot certonly --webroot -w /var/www/certbot \
  -d madecodesign.fr -d www.madecodesign.fr \
  --email YOUR-EMAIL@example.com \
  --agree-tos \
  --non-interactive
```

**Expected output:**
```
Requesting a certificate for madecodesign.fr and www.madecodesign.fr

Successfully received certificate.
Certificate is saved at: /etc/letsencrypt/live/madecodesign.fr/fullchain.pem
Key is saved at:         /etc/letsencrypt/live/madecodesign.fr/privkey.pem
This certificate expires on 2026-01-30.
These files will be updated when the certificate renews.

NEXT STEPS:
- The certificate will need to be renewed before it expires. Certbot can automatically renew the certificate in the background.
```

**If you see errors:**
- Check DNS is pointing to your server
- Verify nginx is running and can serve `.well-known` path
- Make sure port 80 is accessible from internet

#### Step 6: Reload Nginx

```bash
# Reload nginx to use new certificates
docker-compose -f docker-compose.production.yml --env-file .env.production exec nginx nginx -s reload
```

**Expected downtime ends here** - Site should be accessible again

#### Step 7: Verify Certificates Work

```bash
# Test HTTPS works
curl -I https://madecodesign.fr

# Should show: HTTP/2 200
```

**Test in browser:**
- Open https://madecodesign.fr
- Check for padlock icon (secure)
- Click padlock → Certificate should show valid

#### Step 8: Verify Auto-Renewal is Configured

```bash
# Check certbot can see certificates
docker-compose -f docker-compose.production.yml --env-file .env.production exec certbot \
  certbot certificates
```

**Expected output:**
```
Found the following certs:
  Certificate Name: madecodesign.fr
    Serial Number: [long number]
    Key Type: RSA
    Domains: madecodesign.fr www.madecodesign.fr
    Expiry Date: 2026-01-30 [time] (VALID: 89 days)
    Certificate Path: /etc/letsencrypt/live/madecodesign.fr/fullchain.pem
    Private Key Path: /etc/letsencrypt/live/madecodesign.fr/privkey.pem
```

#### Step 9: Test Auto-Renewal (Dry Run)

```bash
# Test renewal WITHOUT actually renewing (safe to run anytime)
docker-compose -f docker-compose.production.yml --env-file .env.production exec certbot \
  certbot renew --dry-run
```

**Expected output:**
```
Saving debug log to /var/log/letsencrypt/letsencrypt.log

- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
Processing /etc/letsencrypt/renewal/madecodesign.fr.conf
- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
Account registered.
Simulating renewal of an existing certificate for madecodesign.fr and www.madecodesign.fr

- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
Congratulations, all simulated renewals succeeded:
  /etc/letsencrypt/live/madecodesign.fr/fullchain.pem (success)
- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
```

✅ **If you see "Congratulations, all simulated renewals succeeded" - YOU'RE DONE!**

---

## 📋 Implementation Plan: Option 2 (Manual Cron Workaround)

### When to Use This

**Use if:**
- Can't restart containers right now
- Want a quick safety net
- Plan to do proper fix later

### Step-by-Step Implementation

#### Step 1: Create Manual Renewal Script

```bash
# On VPS
nano ~/renew-ssl-manual.sh
```

**Paste this content:**

```bash
#!/bin/bash

################################################################################
# Manual SSL Renewal Script for madecodesign.fr
#
# This script manually renews SSL certificates using certbot standalone mode
# Requires stopping nginx temporarily
################################################################################

LOG_FILE="/home/madeco/ssl-renewal.log"
DATE=$(date '+%Y-%m-%d %H:%M:%S')

echo "[$DATE] Starting SSL renewal..." | tee -a "$LOG_FILE"

cd /home/madeco/myerp_app

# Stop nginx to free port 80/443
echo "[$DATE] Stopping nginx..." | tee -a "$LOG_FILE"
docker-compose -f docker-compose.production.yml --env-file .env.production stop nginx

# Wait for nginx to stop
sleep 5

# Renew certificates using standalone mode
echo "[$DATE] Renewing certificates..." | tee -a "$LOG_FILE"
docker run --rm \
  -v myerp_app_certbot_data:/etc/letsencrypt \
  -p 80:80 -p 443:443 \
  certbot/certbot certonly --standalone \
  -d madecodesign.fr -d www.madecodesign.fr \
  --email YOUR-EMAIL@example.com \
  --agree-tos \
  --non-interactive \
  --keep-until-expiring >> "$LOG_FILE" 2>&1

RESULT=$?

# Start nginx again
echo "[$DATE] Starting nginx..." | tee -a "$LOG_FILE"
docker-compose -f docker-compose.production.yml --env-file .env.production start nginx

# Wait for nginx to start
sleep 5

if [ $RESULT -eq 0 ]; then
    echo "[$DATE] ✅ SSL renewal completed successfully" | tee -a "$LOG_FILE"
else
    echo "[$DATE] ❌ SSL renewal failed! Check log." | tee -a "$LOG_FILE"
fi

echo "[$DATE] Finished SSL renewal process" | tee -a "$LOG_FILE"
echo "----------------------------------------" | tee -a "$LOG_FILE"
```

**Don't forget to replace `YOUR-EMAIL@example.com`!**

#### Step 2: Make Script Executable

```bash
chmod +x ~/renew-ssl-manual.sh
```

#### Step 3: Test the Script

```bash
# Test it manually first
~/renew-ssl-manual.sh

# Check the log
cat ~/ssl-renewal.log
```

#### Step 4: Add to Crontab

```bash
crontab -e
```

**Add this line:**

```cron
# Renew SSL certificates on the 1st of every month at 3 AM
0 3 1 * * /home/madeco/renew-ssl-manual.sh
```

**Save and exit**

#### Step 5: Verify Cron Job

```bash
# Check crontab
crontab -l

# Should show your SSL renewal job
```

---

## 🧪 Testing & Verification

### Test 1: Check Certificate Expiry

```bash
# Check when certificate expires
echo | openssl s_client -servername madecodesign.fr -connect madecodesign.fr:443 2>/dev/null | \
  openssl x509 -noout -dates
```

**Expected:**
```
notBefore=[date]
notAfter=2026-01-30 (or 90 days from renewal)
```

### Test 2: Verify HTTPS

```bash
# Test HTTPS connection
curl -I https://madecodesign.fr

# Should return HTTP/2 200
```

### Test 3: Browser Check

1. Open https://madecodesign.fr
2. Click padlock icon
3. View certificate
4. Verify:
   - Issued by: Let's Encrypt
   - Valid until: [90 days from now]
   - Domains: madecodesign.fr, www.madecodesign.fr

---

## 📊 Monitoring & Maintenance

### Create SSL Status Check Script

```bash
# On VPS
nano ~/check-ssl-status.sh
```

**Paste:**

```bash
#!/bin/bash

echo "🔒 SSL Certificate Status for madecodesign.fr"
echo "=============================================="
echo ""

# Get certificate expiry
EXPIRY=$(echo | openssl s_client -servername madecodesign.fr -connect madecodesign.fr:443 2>/dev/null | \
  openssl x509 -noout -enddate | cut -d= -f2)

# Calculate days until expiry
EXPIRY_EPOCH=$(date -d "$EXPIRY" +%s 2>/dev/null || date -j -f "%b %d %T %Y %Z" "$EXPIRY" +%s)
NOW_EPOCH=$(date +%s)
DAYS_UNTIL_EXPIRY=$(( ($EXPIRY_EPOCH - $NOW_EPOCH) / 86400 ))

echo "📅 Certificate expires: $EXPIRY"
echo "⏰ Days until expiry: $DAYS_UNTIL_EXPIRY"
echo ""

if [ $DAYS_UNTIL_EXPIRY -lt 14 ]; then
    echo "🚨 CRITICAL: Certificate expires in less than 14 days!"
    echo "   Action required immediately!"
elif [ $DAYS_UNTIL_EXPIRY -lt 30 ]; then
    echo "⚠️  WARNING: Certificate expires in less than 30 days!"
    echo "   Auto-renewal should trigger soon."
else
    echo "✅ Certificate is valid and healthy"
fi

echo ""
echo "🐳 Certbot container status:"
docker ps --filter "name=certbot" --format "table {{.Names}}\t{{.Status}}"

echo ""
echo "📋 Certbot certificates:"
docker-compose -f ~/myerp_app/docker-compose.production.yml --env-file ~/myerp_app/.env.production exec -T certbot \
  certbot certificates 2>&1 | grep -A 5 "Certificate Name" || echo "   Unable to fetch certificate details"
```

**Make executable:**

```bash
chmod +x ~/check-ssl-status.sh
```

### Monthly Check

**Run this monthly:**

```bash
~/check-ssl-status.sh
```

**Or add to crontab for email alerts:**

```bash
crontab -e
```

**Add:**

```cron
# Check SSL status monthly
0 9 1 * * /home/madeco/check-ssl-status.sh | tee /tmp/ssl-status.txt
```

---

## 🔧 Troubleshooting

### Problem 1: Certificate Renewal Fails

**Symptoms:**
```
Attempting to renew cert (madecodesign.fr) from /etc/letsencrypt/renewal/madecodesign.fr.conf produced an unexpected error
```

**Possible causes:**
1. Port 80 not accessible from internet
2. DNS not pointing to server
3. Nginx not serving `.well-known` path
4. Firewall blocking connections

**Solutions:**

```bash
# Check port 80 is open
curl -I http://madecodesign.fr/.well-known/acme-challenge/test

# Check DNS
dig madecodesign.fr +short
# Should show your VPS IP

# Check nginx config
docker-compose -f docker-compose.production.yml --env-file .env.production exec nginx \
  nginx -t

# Check firewall
sudo ufw status
# Port 80 and 443 should be allowed
```

### Problem 2: Certificate Not Found After Renewal

**Symptoms:**
```
certbot certificates
No certificates found.
```

**Solution:**

```bash
# Check if files exist
docker-compose -f docker-compose.production.yml --env-file .env.production exec certbot \
  ls -la /etc/letsencrypt/live/

# Check renewal config
docker-compose -f docker-compose.production.yml --env-file .env.production exec certbot \
  ls -la /etc/letsencrypt/renewal/

# If files exist but certbot doesn't see them, restart certbot
docker-compose -f docker-compose.production.yml --env-file .env.production restart certbot
```

### Problem 3: Site Shows "Not Secure" After Renewal

**Symptoms:**
- Browser shows "Not Secure"
- Certificate is expired

**Solution:**

```bash
# Reload nginx to use new certificates
docker-compose -f docker-compose.production.yml --env-file .env.production exec nginx \
  nginx -s reload

# If that doesn't work, restart nginx
docker-compose -f docker-compose.production.yml --env-file .env.production restart nginx

# Clear browser cache and try again
```

### Problem 4: Auto-Renewal Not Triggering

**Symptoms:**
- Certificate expires
- No automatic renewal happened

**Diagnosis:**

```bash
# Check certbot container is running
docker ps | grep certbot

# Check certbot logs
docker-compose -f docker-compose.production.yml --env-file .env.production logs certbot | tail -50

# Test dry-run
docker-compose -f docker-compose.production.yml --env-file .env.production exec certbot \
  certbot renew --dry-run
```

**Solution:**

If dry-run fails, you likely need to re-implement Option 1 properly.

---

## 📅 Certificate Lifecycle

### Let's Encrypt Certificate Details

**Certificate properties:**
- **Validity:** 90 days
- **Auto-renewal window:** 30 days before expiry (60 days into lifecycle)
- **Certbot check frequency:** Every 12 hours (configured in your docker-compose)
- **Renewal trigger:** When < 30 days remaining

**Timeline example:**

```
Day 0:   Certificate issued
Day 1-59: Valid, no renewal needed
Day 60:  Renewal window opens (30 days remaining)
         Certbot attempts renewal on next check
Day 61:  Certificate renewed (new 90-day cert issued)
Day 90:  Old certificate would expire (but already renewed)
```

### Your Certbot Container Configuration

**From docker-compose.production.yml:**

```yaml
certbot:
  image: certbot/certbot
  entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done;'"
```

**What this means:**
- Checks for renewal every 12 hours
- Runs `certbot renew` command
- Automatically renews when certificate has < 30 days left

---

## 📋 Checklist After Implementation

### Immediate Verification (After Setup)

- [ ] Certbot container is running
- [ ] `certbot certificates` shows your certificate
- [ ] `certbot renew --dry-run` succeeds
- [ ] HTTPS site loads without warnings
- [ ] Certificate is valid for 90 days

### Weekly Checks (Optional)

- [ ] Check certbot container status: `docker ps | grep certbot`
- [ ] Verify site still loads with HTTPS

### Monthly Checks (Recommended)

- [ ] Run `~/check-ssl-status.sh`
- [ ] Verify certificate has > 30 days remaining
- [ ] Check renewal logs if approaching expiry

### Before Expiry (< 30 days)

- [ ] Certbot should auto-renew
- [ ] Monitor for successful renewal
- [ ] Verify new certificate has 90 days validity

---

## 🎯 Quick Reference Commands

### Check Certificate Status

```bash
# Quick status check
~/check-ssl-status.sh

# Detailed certificate info
docker-compose -f docker-compose.production.yml --env-file .env.production exec certbot \
  certbot certificates

# Check expiry from outside
echo | openssl s_client -servername madecodesign.fr -connect madecodesign.fr:443 2>/dev/null | \
  openssl x509 -noout -dates
```

### Test Renewal

```bash
# Dry run (safe, doesn't actually renew)
docker-compose -f docker-compose.production.yml --env-file .env.production exec certbot \
  certbot renew --dry-run
```

### Force Renewal (Emergency)

```bash
# Only use if certificate expired or about to expire
docker-compose -f docker-compose.production.yml --env-file .env.production exec certbot \
  certbot renew --force-renewal

# Then reload nginx
docker-compose -f docker-compose.production.yml --env-file .env.production exec nginx \
  nginx -s reload
```

### Check Logs

```bash
# Certbot logs
docker-compose -f docker-compose.production.yml --env-file .env.production logs certbot --tail 100

# Nginx logs
docker-compose -f docker-compose.production.yml --env-file .env.production logs nginx --tail 100

# Renewal log (if using Option 2)
cat ~/ssl-renewal.log
```

---

## 🆘 Emergency Procedures

### If Certificate Has Expired

**Symptoms:**
- Site shows "Your connection is not private"
- Browser warning about expired certificate

**Emergency fix (5 minutes):**

```bash
cd ~/myerp_app

# Option A: If certbot is configured (Option 1)
docker-compose -f docker-compose.production.yml --env-file .env.production exec certbot \
  certbot renew --force-renewal
docker-compose -f docker-compose.production.yml --env-file .env.production exec nginx \
  nginx -s reload

# Option B: If using manual renewal (Option 2)
~/renew-ssl-manual.sh

# Verify
curl -I https://madecodesign.fr
# Should return HTTP/2 200
```

### If Renewal Completely Broken

**Nuclear option (re-do everything):**

```bash
# 1. Stop containers
docker-compose -f docker-compose.production.yml --env-file .env.production down

# 2. Delete certbot volume
docker volume rm myerp_app_certbot_data

# 3. Start containers
docker-compose -f docker-compose.production.yml --env-file .env.production up -d

# 4. Wait 30 seconds
sleep 30

# 5. Obtain new certificates
docker-compose -f docker-compose.production.yml --env-file .env.production exec certbot \
  certbot certonly --webroot -w /var/www/certbot \
  -d madecodesign.fr -d www.madecodesign.fr \
  --email YOUR-EMAIL@example.com \
  --agree-tos \
  --non-interactive

# 6. Reload nginx
docker-compose -f docker-compose.production.yml --env-file .env.production exec nginx \
  nginx -s reload
```

---

## 📚 Additional Resources

### Let's Encrypt Documentation
- Main site: https://letsencrypt.org/
- How it works: https://letsencrypt.org/how-it-works/
- Rate limits: https://letsencrypt.org/docs/rate-limits/

### Certbot Documentation
- Official docs: https://eff-certbot.readthedocs.io/
- Docker setup: https://eff-certbot.readthedocs.io/en/stable/install.html#running-with-docker
- Renewal: https://eff-certbot.readthedocs.io/en/stable/using.html#renewal

### Testing Tools
- SSL Labs Test: https://www.ssllabs.com/ssltest/
- Check expiry: https://www.sslshopper.com/ssl-checker.html
- Let's Debug: https://letsdebug.net/

---

## 📝 Notes

### For Internal Applications

Since this is an **internal company application**, the severity of SSL expiry is lower:

- ❌ Won't affect customers (internal only)
- ⚠️ Will cause browser warnings for employees
- ✅ Can be fixed during business hours
- ✅ Not a critical emergency

**However, still recommended to fix because:**
- Good security practice
- Prevents interruptions to employees
- One less thing to remember
- Takes only 5 minutes to set up properly

### Recommended Implementation Timeline

**For internal app:**
- **Best:** Implement now (while fresh in mind)
- **Good:** Before end of December 2025
- **Acceptable:** Before mid-January 2026 (2 weeks buffer)
- **Not recommended:** After January 20, 2026 (too close to expiry)

---

## ✅ Summary

**Problem:** SSL certificates won't auto-renew, will expire Jan 30, 2026

**Solution Options:**
1. **Option 1 (Best):** Re-obtain via certbot - 5 min setup, automatic forever
2. **Option 2 (OK):** Manual renewal cron - 2 min setup, works but less ideal
3. **Option 3 (Advanced):** Import existing - complex, not recommended

**Recommendation:**
- Implement **Option 1** when you have 5 minutes
- Deadline: Mid-January 2026 (internal app, not urgent)
- Set calendar reminder if waiting

**After implementation:**
- Run monthly check: `~/check-ssl-status.sh`
- Verify auto-renewal works
- Never worry about SSL again ✅

---

**End of Guide**

*Last updated: 2025-11-01*
*Next review: Before 2026-01-15*

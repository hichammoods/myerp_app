# VPS Setup Guide - Backup & Monitoring

This guide shows you how to set up automated backups and monitoring for your MyERP application on the VPS.

---

## 📋 What You'll Set Up

1. **Daily Automated Backups** (PostgreSQL + MinIO + Redis)
2. **Restore Script** (Easy restoration from backups)
3. **Monitoring Script** (View resource usage in terminal)
4. **Cron Job** (Run backups automatically at 2 AM daily)

---

## 🚀 Step-by-Step VPS Setup

### Step 1: Upload Scripts to VPS

On your **local machine**, upload the scripts to your VPS:

```bash
# From your local myerp_app directory
scp scripts/daily-backup.sh user@your-vps-ip:/path/to/myerp_app/scripts/
scp scripts/restore-backup.sh user@your-vps-ip:/path/to/myerp_app/scripts/
scp scripts/monitor.sh user@your-vps-ip:/path/to/myerp_app/scripts/
```

**Replace:**
- `user` with your VPS username
- `your-vps-ip` with your VPS IP address
- `/path/to/myerp_app` with the actual path on VPS

---

### Step 2: SSH into VPS and Set Permissions

```bash
# SSH into your VPS
ssh user@your-vps-ip

# Navigate to your project
cd /path/to/myerp_app

# Make scripts executable
chmod +x scripts/daily-backup.sh
chmod +x scripts/restore-backup.sh
chmod +x scripts/monitor.sh

# Create backups directory
mkdir -p backups
```

---

### Step 3: Test Backup Script

Run the backup script manually to make sure it works:

```bash
# Run backup
./scripts/daily-backup.sh
```

**Expected output:**
```
═══════════════════════════════════════════════════════════
            MyERP Daily Backup - Starting
═══════════════════════════════════════════════════════════

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1/3 Backing up PostgreSQL database...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Database backup complete: postgres_20251101_020000.sql.gz (2.5M)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2/3 Backing up MinIO object storage...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ MinIO backup complete: minio_20251101_020000.tar.gz (150M)

...
✅ All backups completed successfully!
```

Check that backups were created:

```bash
ls -lh backups/
```

---

### Step 4: Test Monitor Script

Run the monitoring script to see resource usage:

```bash
./scripts/monitor.sh
```

**Expected output:**
```
╔════════════════════════════════════════════════════════════════════╗
║              MyERP System Resource Monitor                         ║
║              2025-11-01 14:30:00                                   ║
╚════════════════════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────────────────────────┐
│ SYSTEM OVERVIEW                                                     │
└─────────────────────────────────────────────────────────────────────┘

  CPU:
    Cores: 4
    Usage: 15.2%

  MEMORY:
    Total: 8.0G
    Used:  3.2G (40.0%)
    Free:  4.8G

  DISK (Root):
    Total: 80G
    Used:  25G (32%)
    Free:  55G

┌─────────────────────────────────────────────────────────────────────┐
│ CONTAINER STATUS                                                    │
└─────────────────────────────────────────────────────────────────────┘

NAME                STATUS              PORTS
myerp-postgres      Up 2 hours          5432/tcp
myerp-redis         Up 2 hours          6379/tcp
myerp-minio         Up 2 hours          9000-9001/tcp
myerp-api           Up 2 hours          4000/tcp
myerp-frontend      Up 2 hours          3000/tcp
myerp-nginx         Up 2 hours          0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp

┌─────────────────────────────────────────────────────────────────────┐
│ CONTAINER RESOURCES                                                 │
└─────────────────────────────────────────────────────────────────────┘

NAME                CPU %     MEM USAGE / LIMIT     MEM %     NET I/O           BLOCK I/O
myerp-postgres      2.5%      150MiB / 8GiB        1.88%     1.2MB / 850KB     50MB / 120MB
myerp-redis         0.5%      10MiB / 8GiB         0.13%     500KB / 200KB     5MB / 2MB
myerp-minio         1.2%      80MiB / 8GiB         1.00%     2MB / 1.5MB       100MB / 50MB
myerp-api           5.8%      200MiB / 8GiB        2.50%     5MB / 3MB         20MB / 10MB
myerp-frontend      0.1%      50MiB / 8GiB         0.63%     1MB / 500KB       5MB / 2MB
myerp-nginx         0.3%      20MiB / 8GiB         0.25%     10MB / 8MB        2MB / 1MB
```

---

### Step 5: Set Up Automated Daily Backups (Cron)

Open crontab editor:

```bash
crontab -e
```

Add this line to run backups **every day at 2:00 AM**:

```cron
0 2 * * * /path/to/myerp_app/scripts/daily-backup.sh >> /path/to/myerp_app/backups/cron.log 2>&1
```

**Replace `/path/to/myerp_app` with your actual path!**

**Example:**
```cron
0 2 * * * /home/ubuntu/myerp_app/scripts/daily-backup.sh >> /home/ubuntu/myerp_app/backups/cron.log 2>&1
```

Save and exit (in vim: press `Esc`, then type `:wq` and press Enter).

Verify cron job was added:

```bash
crontab -l
```

---

## 📖 Usage Instructions

### Running Backups Manually

```bash
cd /path/to/myerp_app
./scripts/daily-backup.sh
```

### Checking Backup Status

```bash
# List all backups
ls -lh backups/

# View latest backup info
cat backups/$(ls -t backups/ | grep "^20" | head -1)/BACKUP_INFO.txt
```

### Monitoring System Resources

```bash
cd /path/to/myerp_app
./scripts/monitor.sh
```

**Run anytime** to see:
- CPU usage
- Memory usage
- Disk space
- Container status
- Container resource consumption
- Health checks
- Recent errors
- Backup status

### Restoring from Backup

```bash
cd /path/to/myerp_app

# List available backups
ls -1 backups/ | grep "^20"

# Restore specific backup
./scripts/restore-backup.sh 2025-11-01

# Follow the prompts (you'll be asked to confirm)
```

**⚠️ WARNING:** Restore will REPLACE your current database and files!

---

## 🔧 Configuration Options

### Change Backup Retention Period

Edit `scripts/daily-backup.sh`:

```bash
nano scripts/daily-backup.sh
```

Find this line (around line 23):
```bash
RETENTION_DAYS=30
```

Change `30` to your desired number of days. Save and exit.

### Change Backup Time

Edit crontab:
```bash
crontab -e
```

Cron format: `minute hour day month weekday`

**Examples:**
- `0 2 * * *` - Every day at 2:00 AM (current)
- `0 3 * * *` - Every day at 3:00 AM
- `0 2 * * 0` - Every Sunday at 2:00 AM
- `0 */6 * * *` - Every 6 hours

---

## 📊 Backup Schedule

With the default setup:

- **Backup Time:** 2:00 AM daily
- **Retention:** 30 days (older backups auto-deleted)
- **Location:** `/path/to/myerp_app/backups/YYYY-MM-DD/`
- **Log File:** `/path/to/myerp_app/backups/backup.log`

**Each backup includes:**
- PostgreSQL database dump (compressed .sql.gz)
- MinIO uploaded files (.tar.gz)
- Redis data (.tar.gz)
- Backup manifest with restore instructions

---

## 🔍 Troubleshooting

### Backup Script Fails

Check the log:
```bash
cat backups/backup.log
```

Common issues:
- Docker not running: `docker ps`
- Insufficient disk space: `df -h`
- Permission denied: `chmod +x scripts/*.sh`

### Cron Job Not Running

Check cron logs:
```bash
# Ubuntu/Debian
grep CRON /var/log/syslog

# CentOS/RHEL
grep CRON /var/log/cron

# Or check your custom log
tail -f backups/cron.log
```

Verify cron job exists:
```bash
crontab -l
```

### Monitor Script Shows Wrong Path

Edit the script and update paths:
```bash
nano scripts/monitor.sh
```

Update lines 18-20:
```bash
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="${PROJECT_DIR}/docker-compose.production.yml"
ENV_FILE="${PROJECT_DIR}/.env.production"
```

---

## 📦 What Gets Backed Up

### PostgreSQL Database
- All tables
- All data
- Schema structure
- Compressed with gzip

### MinIO Object Storage
- All uploaded product images
- All files in `/data` volume
- Compressed archive

### Redis
- Session data
- Cache data
- Compressed archive

---

## ⚡ Quick Commands Cheat Sheet

```bash
# Manual backup
./scripts/daily-backup.sh

# View system resources
./scripts/monitor.sh

# List backups
ls -lh backups/

# Restore backup
./scripts/restore-backup.sh 2025-11-01

# View backup log
tail -f backups/backup.log

# Check cron jobs
crontab -l

# Edit cron jobs
crontab -e

# Check disk space
df -h

# Check Docker volumes size
docker system df -v
```

---

## 🎯 Next Steps

1. ✅ Upload scripts to VPS
2. ✅ Set permissions
3. ✅ Test backup manually
4. ✅ Test monitoring script
5. ✅ Set up cron job
6. ✅ Wait 24h and verify first automatic backup
7. ✅ Test restore on a test environment (optional but recommended)

---

## 💡 Best Practices

1. **Test restores regularly** - Make sure your backups actually work
2. **Monitor disk space** - Run `./scripts/monitor.sh` weekly
3. **Keep backups offsite** - Consider copying to another server or S3
4. **Check logs** - Review `backups/backup.log` monthly
5. **Update retention** - Adjust based on your disk space

---

## 🆘 Support

If you encounter issues:

1. Check `backups/backup.log` for errors
2. Run `./scripts/monitor.sh` to check system health
3. Verify Docker containers are running: `docker ps`
4. Check disk space: `df -h`

---

**That's it! Your VPS now has automated backups and monitoring! 🎉**

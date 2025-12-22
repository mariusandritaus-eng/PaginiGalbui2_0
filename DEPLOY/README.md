# Pagini Galbui - Deployment Guide

## Network Access Configuration

**Local IP**: `10.2.38.171`  
**Hostname**: `paginigalbui`

This deployment package allows you to run the Forensic Intelligence Database application on your local network and access it from other devices.

## Prerequisites

1. **Docker & Docker Compose** installed
2. **Network Configuration** - Machine has IP 10.2.38.171
3. **System Requirements** - 4GB RAM, 10GB disk space

## Quick Start

### Step 1: Configure Hostname

```bash
cd /app/DEPLOY
sudo ./setup-hostname.sh
```

### Step 2: Deploy

```bash
./start.sh
```

### Step 3: Access

Open browser: `http://paginigalbui` or `http://10.2.38.171`

## ⚠️ IMPORTANT: Dynamic IP Configuration (Recommended)

This deployment now uses **relative URLs** that work with ANY IP address automatically!

### First-Time Setup or Network Issues

If you get "failed to load data" or upload errors, run:

```bash
cd /app/DEPLOY
./fix-network-issue-dynamic.sh
```

**This script**:
- ✅ Automatically detects your server IP
- ✅ Configures frontend with relative URLs (`/api` instead of hardcoded IP)
- ✅ Rebuilds containers
- ✅ Works on ANY IP address - no rebuild needed when IP changes!

See [DYNAMIC_IP_GUIDE.md](DYNAMIC_IP_GUIDE.md) for detailed explanation.

### Alternative: Hardcoded IP Fix (Not Recommended)

If you need hardcoded IP for some reason:
```bash
./fix-network-issue.sh
```

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for manual configuration.

## Service Architecture

- **MongoDB** (internal) - Database
- **Backend** (internal) - FastAPI on port 8001
- **Frontend** (internal) - React + Nginx
- **Nginx Proxy** (port 80) - Routes all traffic

## Management Commands

```bash
# Start
./start.sh

# Stop
./stop.sh

# View logs
docker-compose logs -f

# Restart
docker-compose restart

# Status
docker-compose ps
```

## Network Configuration for Other Devices

Add to hosts file:
- **Windows**: `C:\Windows\System32\drivers\etc\hosts`
- **Linux/Mac**: `/etc/hosts`
- **Line**: `10.2.38.171 paginigalbui`

## Troubleshooting

### Cannot access from other devices?

```bash
# Allow port 80
sudo ufw allow 80/tcp

# Verify IP
ip addr show

# Test locally first
curl http://localhost/health
```

### Services not starting?

```bash
# Check logs
docker-compose logs backend
docker-compose logs frontend

# Restart
docker-compose restart
```

## Data Backup

```bash
# Backup MongoDB
docker exec paginigalbui_mongodb mongodump --out=/dump
docker cp paginigalbui_mongodb:/dump ./backup-$(date +%Y%m%d)

# Backup uploads
tar -czf uploads-backup-$(date +%Y%m%d).tar.gz ../uploads
```

## Security

1. Change default passwords in `.env`
2. Enable HTTPS for production
3. Restrict CORS origins
4. Keep Docker updated

For detailed information, see the deployment files in this directory.

# Ubuntu Server Deployment Guide - Pagini Galbui
## Forensic Intelligence Database

This guide will help you deploy the Pagini Galbui application on an Ubuntu server on your local network.

---

## 📋 Table of Contents
1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Step-by-Step Installation](#step-by-step-installation)
4. [Configuration](#configuration)
5. [Starting the Application](#starting-the-application)
6. [Accessing the Application](#accessing-the-application)
7. [Troubleshooting](#troubleshooting)
8. [Maintenance](#maintenance)

---

## Prerequisites

### System Requirements
- **OS**: Ubuntu 20.04 LTS or newer
- **CPU**: 2+ cores recommended
- **RAM**: 4GB minimum, 8GB recommended
- **Disk**: 20GB free space minimum
- **Network**: Connected to local network (internet required for initial setup only)

### Required Software
- Docker Engine 24.0+
- Docker Compose V2+
- Git (optional, for easier updates)

---

## Quick Start

If you already have Docker installed:

```bash
# 1. Navigate to deployment directory
cd /app/DEPLOY

# 2. Start all services
docker-compose up -d

# 3. Check status
docker-compose ps

# 4. Access the application
# Open browser: http://your-server-ip
```

That's it! The application should be running.

---

## Step-by-Step Installation

### Step 1: Install Docker Engine

```bash
# Update package list
sudo apt-get update

# Install required packages
sudo apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release

# Add Docker's official GPG key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Set up the repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Verify installation
sudo docker --version
sudo docker compose version
```

### Step 2: Configure Docker (Optional but Recommended)

```bash
# Add your user to docker group to run docker without sudo
sudo usermod -aG docker $USER

# Log out and log back in for group changes to take effect
# OR run: newgrp docker

# Verify you can run docker without sudo
docker ps
```

### Step 3: Set Up the Application

```bash
# Navigate to the project directory
cd /app/DEPLOY

# Verify all required files are present
ls -la
# You should see:
# - docker-compose.yml
# - nginx-proxy.conf
# - start.sh
# - stop.sh
# - etc.

# Review docker-compose.yml (optional)
cat docker-compose.yml
```

### Step 4: Build and Start Services

```bash
# Build and start all containers
docker-compose up -d

# Expected output:
# Creating network "paginigalbui_network"
# Creating paginigalbui_mongodb ... done
# Creating paginigalbui_backend ... done
# Creating paginigalbui_frontend ... done
# Creating paginigalbui_nginx ... done
```

### Step 5: Verify Deployment

```bash
# Check container status
docker-compose ps

# All containers should show "Up" status:
# NAME                     STATUS          PORTS
# paginigalbui_backend     Up (healthy)    8001/tcp
# paginigalbui_frontend    Up              80/tcp
# paginigalbui_mongodb     Up (healthy)    27017/tcp
# paginigalbui_nginx       Up              0.0.0.0:80->80/tcp

# Check backend health
curl http://localhost/api/stats
# Should return: {"contacts":0,"passwords":0,"user_accounts":0,"total":0}

# Check nginx health
curl http://localhost/health
# Should return: healthy
```

---

## Configuration

### Network Configuration

The application is configured to work on **any IP address** automatically using relative URLs.

**No configuration needed!** The app will work on:
- `http://localhost` (from the server itself)
- `http://192.168.x.x` (from other computers on the network)
- `http://hostname` (if you set up a hostname)

### Port Configuration

**Default Port**: 80 (HTTP)

The application uses port 80 by default. Make sure:
1. No other service is using port 80
2. Firewall allows port 80 access

```bash
# Check if port 80 is available
sudo netstat -tlnp | grep :80

# If another service is using port 80, stop it or change the app port
# To change app port, edit docker-compose.yml:
# Change: "80:80" to "8080:80" (for example)
```

### Firewall Configuration

```bash
# Allow port 80 through firewall
sudo ufw allow 80/tcp

# Verify firewall status
sudo ufw status
```

### Set Hostname (Optional)

For easier access, you can set a hostname:

```bash
cd /app/DEPLOY
sudo ./setup-hostname.sh paginigalbui

# Now you can access the app at:
# http://paginigalbui
```

---

## Starting the Application

### Using Docker Compose

```bash
cd /app/DEPLOY

# Start all services
docker-compose up -d

# Start specific service
docker-compose up -d backend

# Restart all services
docker-compose restart

# Restart specific service
docker-compose restart backend
```

### Using Convenience Scripts

```bash
cd /app/DEPLOY

# Start services
./start.sh

# Stop services
./stop.sh
```

### Auto-Start on Boot (Optional)

To start the application automatically when the server boots:

```bash
# Create systemd service
sudo nano /etc/systemd/system/paginigalbui.service

# Add this content:
[Unit]
Description=Pagini Galbui Forensic Database
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/app/DEPLOY
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target

# Save and exit (Ctrl+X, Y, Enter)

# Enable the service
sudo systemctl daemon-reload
sudo systemctl enable paginigalbui
sudo systemctl start paginigalbui

# Check status
sudo systemctl status paginigalbui
```

---

## Accessing the Application

### From the Server Itself
```
http://localhost
```

### From Other Computers on the Network
```
http://SERVER_IP_ADDRESS
```

To find your server's IP address:
```bash
ip addr show | grep "inet " | grep -v 127.0.0.1
```

### Using Hostname (if configured)
```
http://paginigalbui
```

### First Access

1. Open your web browser
2. Navigate to `http://SERVER_IP`
3. You should see the Pagini Galbui dashboard
4. Upload a Cellebrite forensic dump ZIP file to start analyzing data

---

## Troubleshooting

### Application Not Starting

**Check Docker service:**
```bash
sudo systemctl status docker
sudo systemctl start docker
```

**Check container logs:**
```bash
cd /app/DEPLOY
docker-compose logs -f

# Or check specific service:
docker-compose logs backend
docker-compose logs frontend
docker-compose logs mongodb
docker-compose logs nginx
```

### Cannot Access from Other Computers

**Check firewall:**
```bash
sudo ufw status
sudo ufw allow 80/tcp
```

**Verify nginx is listening:**
```bash
sudo netstat -tlnp | grep :80
# Should show: 0.0.0.0:80 or :::80
```

**Test from server:**
```bash
curl http://localhost/api/stats
```

### Images Not Displaying (404 Errors)

This is the **double /api/api bug**. To fix:

```bash
cd /app/DEPLOY
./apply-image-fix.sh
```

Or follow the manual fix in [FIX_IMAGE_BUG.md](FIX_IMAGE_BUG.md)

**After fixing:**
1. Clear browser cache
2. Clear database: `curl -X DELETE http://localhost/api/clear-database`
3. Re-upload forensic dumps

### Database Issues

**Reset database:**
```bash
cd /app/DEPLOY
docker-compose down -v
docker-compose up -d
```

**Access MongoDB directly:**
```bash
docker exec -it paginigalbui_mongodb mongosh
# In mongosh:
use forensics_db
db.contacts.countDocuments()
db.passwords.countDocuments()
exit
```

### Backend API Not Responding

**Check backend logs:**
```bash
docker-compose logs -f backend
```

**Restart backend:**
```bash
docker-compose restart backend
```

**Rebuild backend:**
```bash
docker-compose build --no-cache backend
docker-compose up -d backend
```

### Port Already in Use

**Find what's using port 80:**
```bash
sudo lsof -i :80
```

**Stop the conflicting service or change app port:**
```bash
# Edit docker-compose.yml
nano docker-compose.yml

# Change nginx ports line:
# From: "80:80"
# To:   "8080:80"  # Or any available port

# Restart
docker-compose down
docker-compose up -d
```

### Detailed Troubleshooting

For more troubleshooting steps, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

---

## Maintenance

### View Logs

```bash
cd /app/DEPLOY

# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f mongodb
docker-compose logs -f nginx

# Last 100 lines
docker-compose logs --tail=100 backend
```

### Check Service Status

```bash
docker-compose ps
docker-compose top
```

### Update Application

If you have git access:
```bash
cd /app
git pull origin ubuntu-deploy
cd DEPLOY
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Backup Database

```bash
# Create backup directory
mkdir -p /backups/paginigalbui

# Export MongoDB data
docker exec paginigalbui_mongodb mongodump --archive=/data/backup.archive --gzip

# Copy backup from container
docker cp paginigalbui_mongodb:/data/backup.archive /backups/paginigalbui/backup-$(date +%Y%m%d).archive
```

### Restore Database

```bash
# Copy backup to container
docker cp /backups/paginigalbui/backup-YYYYMMDD.archive paginigalbui_mongodb:/data/restore.archive

# Restore data
docker exec paginigalbui_mongodb mongorestore --archive=/data/restore.archive --gzip --drop
```

### Clean Up Disk Space

```bash
# Remove unused Docker images and containers
docker system prune -a

# Remove only stopped containers and unused images
docker system prune
```

### Monitor Resource Usage

```bash
# Real-time resource usage
docker stats

# Disk usage
docker system df

# Container resource limits
docker-compose config
```

### Update Docker

```bash
sudo apt-get update
sudo apt-get install --only-upgrade docker-ce docker-ce-cli containerd.io docker-compose-plugin
```

---

## Security Recommendations

### For Production Use

1. **Use HTTPS**: Set up SSL/TLS certificates
2. **Change Default Ports**: Don't use port 80 for production
3. **Firewall Rules**: Restrict access to specific IP ranges
4. **Database Security**: Set MongoDB authentication
5. **Regular Updates**: Keep Docker and system packages updated
6. **Backup Strategy**: Implement automated backups
7. **Access Control**: Use VPN or authentication for remote access

### Firewall Configuration

```bash
# Allow only specific network
sudo ufw allow from 192.168.1.0/24 to any port 80

# Or allow specific IP
sudo ufw allow from 192.168.1.100 to any port 80
```

---

## Performance Tuning

### For Large Forensic Dumps

Edit `docker-compose.yml` to increase resources:

```yaml
backend:
  deploy:
    resources:
      limits:
        cpus: '2.0'
        memory: 4G
      reservations:
        cpus: '1.0'
        memory: 2G

mongodb:
  deploy:
    resources:
      limits:
        cpus: '2.0'
        memory: 4G
      reservations:
        cpus: '1.0'
        memory: 2G
```

---

## Support and Documentation

- **Main README**: `/app/README.md`
- **Deployment README**: `/app/DEPLOY/README.md`
- **Quick Start**: `/app/DEPLOY/QUICK_START.md`
- **Troubleshooting**: `/app/DEPLOY/TROUBLESHOOTING.md`
- **Dynamic IP Guide**: `/app/DEPLOY/DYNAMIC_IP_GUIDE.md`
- **Image Bug Fix**: `/app/DEPLOY/FIX_IMAGE_BUG.md`
- **AI Context Log**: `/app/AI_AGENT_CONTEXT.md`

---

## Quick Reference Commands

```bash
# Start application
cd /app/DEPLOY && docker-compose up -d

# Stop application
cd /app/DEPLOY && docker-compose down

# Restart application
cd /app/DEPLOY && docker-compose restart

# View logs
cd /app/DEPLOY && docker-compose logs -f

# Check status
cd /app/DEPLOY && docker-compose ps

# Rebuild after code changes
cd /app/DEPLOY && docker-compose build --no-cache && docker-compose up -d

# Fix image bug
cd /app/DEPLOY && ./apply-image-fix.sh

# Clear database
curl -X DELETE http://localhost/api/clear-database

# Test API
curl http://localhost/api/stats

# Check disk usage
docker system df

# Clean up
docker system prune
```

---

## Next Steps

1. ✅ Deploy the application following this guide
2. ✅ Test access from the server and network computers
3. ✅ Upload a test forensic dump to verify functionality
4. ✅ Apply the image fix if needed
5. ✅ Set up regular backups
6. ✅ Configure auto-start on boot (optional)
7. ✅ Review security settings for production use

---

**Deployment Branch**: `ubuntu-deploy`  
**Last Updated**: December 2025  
**Status**: Ready for deployment ✅

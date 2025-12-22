# 🌐 Offline Deployment Guide
# Pagini Galbui - Running Without Internet Access

---

## Overview

This guide explains how to deploy and run **Pagini Galbui** on a completely isolated local network with **NO internet access**. After the initial deployment with internet (for downloading Docker images), the app will run completely offline.

---

## ✅ What Works Offline

After initial deployment, these features work WITHOUT internet:

- ✅ **Web Interface**: Full React frontend served locally
- ✅ **API Backend**: FastAPI server running in Docker
- ✅ **Database**: MongoDB running in Docker container
- ✅ **File Uploads**: Upload and process Cellebrite forensic dumps
- ✅ **Data Analysis**: All password analysis and filtering
- ✅ **Image Viewing**: All extracted images served locally
- ✅ **Network Access**: Access from any computer on local network

---

## 🚀 Initial Deployment (Requires Internet)

**Step 1: Run deployment script with internet connected**

```bash
cd /app/DEPLOY
./fix-api-double-prefix.sh
```

This will:
- Pull Docker images from Docker Hub (requires internet)
- Build frontend and backend containers
- Start all services
- Configure for local network operation

**Step 2: Verify deployment works**

```bash
# Test from server
curl http://localhost/api/stats

# Get your server IP
hostname -I

# Test from another computer (replace with your IP)
curl http://192.168.1.138/api/stats
```

**Step 3: Disconnect from internet (optional)**

Once deployment is complete and verified, you can disconnect the server from the internet. The app will continue to work on your local network.

---

## 🔌 Offline Operation

### How It Works

```
┌─────────────────────────────────────────────┐
│  Local Network (NO Internet Required)      │
│                                             │
│  ┌──────────────┐      ┌──────────────┐   │
│  │  Client PC   │──────▶│ Server PC    │   │
│  │  Browser     │      │ Ubuntu/Docker │   │
│  └──────────────┘      └──────────────┘   │
│                              │              │
│                         Docker Containers   │
│                         ├─ Nginx (Port 80)  │
│                         ├─ Frontend         │
│                         ├─ Backend          │
│                         └─ MongoDB          │
└─────────────────────────────────────────────┘
```

### Network Configuration

**Server Requirements:**
- Ubuntu Server with Docker installed
- Static IP address on local network (e.g., 192.168.1.138)
- Port 80 open (for web access)

**Client Requirements:**
- Any computer on the same local network
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Network access to server IP

### Access Points

After deployment, access the app from any client on the network:

**Option 1: IP Address**
```
http://192.168.1.138
```

**Option 2: Hostname (if configured)**
```
http://paginigalbui
```

**Option 3: Localhost (from server itself)**
```
http://localhost
```

---

## 🛠️ Management Commands

### Check Status

```bash
cd /app/DEPLOY
docker-compose ps
```

Expected output (all should show "Up"):
```
NAME                      STATUS          PORTS
paginigalbui_backend      Up (healthy)    8001/tcp
paginigalbui_frontend     Up              80/tcp
paginigalbui_mongodb      Up (healthy)    27017/tcp
paginigalbui_nginx        Up              0.0.0.0:80->80/tcp
```

### Start/Stop Services

```bash
# Start all services
cd /app/DEPLOY
docker-compose up -d

# Stop all services
docker-compose stop

# Restart all services
docker-compose restart

# Stop and remove all (preserves data)
docker-compose down
```

### View Logs

```bash
cd /app/DEPLOY

# All logs
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f nginx
docker-compose logs -f mongodb
```

### Test API

```bash
# Stats endpoint
curl http://localhost/api/stats

# Health check
curl http://localhost/health

# From another computer (replace IP)
curl http://192.168.1.138/api/stats
```

---

## 📊 Data Persistence

### Where Data Is Stored

**MongoDB Data**: Stored in Docker volume
```bash
# List volumes
docker volume ls | grep mongodb

# Volume names:
# - deploy_mongodb_data (database files)
# - deploy_mongodb_config (configuration)
```

**Uploaded Images**: Stored in bind mount
```bash
# Location: /app/uploads/
ls -lh /app/uploads/
```

### Backup Data

```bash
# Backup MongoDB
cd /app/DEPLOY
docker-compose exec -T mongodb mongodump --archive > backup_$(date +%Y%m%d).archive

# Backup uploads
tar -czf uploads_backup_$(date +%Y%m%d).tar.gz /app/uploads/
```

### Restore Data

```bash
# Restore MongoDB
cd /app/DEPLOY
docker-compose exec -T mongodb mongorestore --archive < backup_20241217.archive

# Restore uploads
tar -xzf uploads_backup_20241217.tar.gz -C /
```

---

## 🔧 Troubleshooting Offline Issues

### Issue 1: "Failed to load data" from client computers

**Symptoms**: Frontend loads but shows "Failed to load data"

**Diagnosis**:
```bash
# From server
curl http://localhost/api/stats

# From client (replace IP)
curl http://192.168.1.138/api/stats
```

**Solutions**:
1. **Check backend API is running**:
   ```bash
   cd /app/DEPLOY
   docker-compose ps backend
   docker-compose logs backend | tail -20
   ```

2. **Verify nginx routing**:
   ```bash
   docker-compose logs nginx | grep "/api/"
   ```

3. **Clear browser cache on client**:
   - Chrome: Ctrl+Shift+Delete → Clear cached images and files
   - Or use Incognito/Private mode

4. **Rebuild frontend if needed**:
   ```bash
   cd /app/DEPLOY
   ./fix-api-double-prefix.sh
   ```

### Issue 2: Cannot access from client computers

**Symptoms**: Browser shows "Cannot connect" or "Connection refused"

**Solutions**:
1. **Check server IP**:
   ```bash
   hostname -I
   # Use the first IP shown
   ```

2. **Check nginx is listening**:
   ```bash
   sudo netstat -tlnp | grep :80
   # Should show: 0.0.0.0:80 or :::80
   ```

3. **Check firewall**:
   ```bash
   sudo ufw status
   sudo ufw allow 80/tcp
   sudo ufw reload
   ```

4. **Verify Docker network**:
   ```bash
   cd /app/DEPLOY
   docker network ls | grep paginigalbui
   docker network inspect deploy_paginigalbui_network
   ```

5. **Test from server first**:
   ```bash
   curl http://localhost/health
   curl http://localhost/api/stats
   ```

### Issue 3: Upload fails

**Symptoms**: File upload shows error or fails silently

**Solutions**:
1. **Check backend logs**:
   ```bash
   cd /app/DEPLOY
   docker-compose logs backend | grep -i error
   docker-compose logs backend | grep -i upload
   ```

2. **Check file size limits**:
   - Current limit: 100MB (configured in nginx)
   - For larger files, edit `/app/DEPLOY/nginx-proxy.conf`
   - Change: `client_max_body_size 100M;` to higher value
   - Rebuild: `docker-compose restart nginx`

3. **Check disk space**:
   ```bash
   df -h /
   df -h /var/lib/docker
   ```

4. **Verify file format**:
   - Must be ZIP file
   - Must contain XML files (Contacts.xml, Passwords.xml, etc.)
   - Or single main XML file with sections

### Issue 4: Services won't start

**Symptoms**: Containers exit or show "Exited" status

**Solutions**:
1. **Check logs for errors**:
   ```bash
   cd /app/DEPLOY
   docker-compose logs backend
   docker-compose logs frontend
   docker-compose logs mongodb
   ```

2. **Check for port conflicts**:
   ```bash
   sudo netstat -tlnp | grep -E ":(80|8001|27017)"
   ```

3. **Clean restart**:
   ```bash
   cd /app/DEPLOY
   docker-compose down
   docker-compose up -d
   ```

4. **Nuclear option (preserves data)**:
   ```bash
   cd /app/DEPLOY
   docker-compose down
   docker-compose build --no-cache
   docker-compose up -d
   ```

---

## 🔒 Security Considerations

### For Isolated Networks

Since the app runs on an isolated network without internet:

**Advantages**:
- ✅ No external attack vectors
- ✅ Data cannot leak to internet
- ✅ Forensic data stays local
- ✅ Controlled access via network isolation

**Recommendations**:
1. **Use firewall on server**:
   ```bash
   sudo ufw enable
   sudo ufw allow 80/tcp
   sudo ufw allow from 192.168.1.0/24  # Allow local network only
   ```

2. **Add authentication (optional)**:
   - Current version has no authentication
   - For production, consider adding login system
   - Can be implemented in future version

3. **MongoDB access**:
   - Currently accessible only within Docker network
   - Not exposed to host or network (secure by default)

4. **Regular backups**:
   - Backup data regularly (see Data Persistence section)
   - Store backups on separate media
   - Test restore procedures

---

## 📋 Maintenance Checklist

### Daily
- [ ] Check service status: `docker-compose ps`
- [ ] Verify web interface accessible from clients
- [ ] Check disk space: `df -h`

### Weekly
- [ ] Review logs for errors: `docker-compose logs --tail=100`
- [ ] Backup database and uploads
- [ ] Test upload functionality

### Monthly
- [ ] Full system backup (with internet)
- [ ] Update Docker images (requires internet)
- [ ] Test disaster recovery procedures

---

## 🆘 Emergency Procedures

### Complete Reset (Preserves Data)

```bash
cd /app/DEPLOY

# Stop everything
docker-compose down

# Rebuild everything
docker-compose build --no-cache

# Start everything
docker-compose up -d

# Wait and check
sleep 15
docker-compose ps
curl http://localhost/api/stats
```

### Complete Reset (Removes All Data)

⚠️ **WARNING**: This deletes ALL data including database and uploads!

```bash
cd /app/DEPLOY

# Backup first!
docker-compose exec -T mongodb mongodump --archive > emergency_backup.archive
tar -czf uploads_emergency.tar.gz /app/uploads/

# Nuclear reset
docker-compose down -v
rm -rf /app/uploads/*

# Rebuild and start fresh
docker-compose build --no-cache
docker-compose up -d
```

---

## 📞 Quick Reference

### Essential Commands

```bash
# Navigate to deployment folder
cd /app/DEPLOY

# Check status
docker-compose ps

# View logs
docker-compose logs -f

# Restart everything
docker-compose restart

# Test API
curl http://localhost/api/stats

# Get server IP
hostname -I

# Check firewall
sudo ufw status
```

### Important Files

```
/app/DEPLOY/
├── docker-compose.yml          # Container configuration
├── nginx-proxy.conf            # Reverse proxy config
├── fix-api-double-prefix.sh    # Fix deployment script
├── OFFLINE_DEPLOYMENT_GUIDE.md # This file
├── TROUBLESHOOTING.md          # General troubleshooting
└── QUICK_START.md              # Quick start guide

/app/uploads/                   # Uploaded forensic images
/app/AI_AGENT_CONTEXT.md        # Technical documentation
```

### Network URLs

```
Server IP:     http://192.168.1.138     (replace with your IP)
Hostname:      http://paginigalbui      (if configured)
Localhost:     http://localhost         (from server)
API Endpoint:  http://SERVER_IP/api/stats
Health Check:  http://SERVER_IP/health
```

---

## ✅ Success Checklist

After deployment, verify these items:

### From Server
- [ ] `docker-compose ps` shows all services "Up"
- [ ] `curl http://localhost/health` returns "healthy"
- [ ] `curl http://localhost/api/stats` returns JSON
- [ ] `ls /app/uploads/` shows directory exists

### From Client Computer
- [ ] Open `http://SERVER_IP` in browser → Frontend loads
- [ ] Dashboard shows statistics (may be 0 if no data uploaded)
- [ ] Can switch between tabs (Contacts, Credentials, etc.)
- [ ] Upload dialog opens when clicking Upload button

### With Internet Disconnected
- [ ] Frontend still loads from client
- [ ] API calls still work
- [ ] Can upload files
- [ ] Can view data
- [ ] All features functional

---

## 🎓 Understanding the System

### Component Communication (Offline)

```
Client Browser (192.168.1.130)
    │
    │ HTTP Request: http://192.168.1.138/
    ▼
Nginx Proxy (Port 80)
    │
    ├─▶ Frontend Container (Static Files)
    │   └─▶ React App served to browser
    │
    │ HTTP Request: /api/stats
    ▼
    └─▶ Backend Container (Port 8001)
        └─▶ FastAPI Server
            │
            ▼
        MongoDB Container (Port 27017)
            └─▶ Database Storage

All within Docker network - NO internet needed!
```

### Why It Works Offline

1. **Docker Images**: Pulled once during initial deployment, stored locally
2. **Frontend Build**: React app compiled to static files, served by nginx
3. **Backend API**: Python code runs in container, no external dependencies
4. **Database**: MongoDB runs entirely in container, data stored in volumes
5. **Network**: All communication via Docker internal network or LAN

### What Happens When You Deploy

```
Initial Deployment (WITH Internet):
1. Docker pulls base images from Docker Hub
2. Frontend builds React app with all dependencies
3. Backend installs Python packages
4. Containers start with local networking

Offline Operation (WITHOUT Internet):
1. Docker uses locally stored images
2. Frontend serves pre-built static files
3. Backend runs with installed dependencies
4. All communication stays within local network
5. No external calls or dependencies
```

---

## 📖 Related Documentation

- **Quick Start**: `/app/DEPLOY/QUICK_START.md`
- **Troubleshooting**: `/app/DEPLOY/TROUBLESHOOTING.md`
- **Technical Docs**: `/app/AI_AGENT_CONTEXT.md`
- **Dynamic IP Guide**: `/app/DEPLOY/DYNAMIC_IP_GUIDE.md`

---

**Last Updated**: December 17, 2025  
**Version**: 1.0  
**Status**: ✅ Tested and Working Offline

# 🚀 Emergent Quick Setup Guide - PaginiGalbui

## ⚡ Super Fast Setup (One Command)

```bash
cd /app && \
mkdir -p /app/uploads && chmod 755 /app/uploads && \
cat > /app/backend/.env << 'EOF'
MONGO_URL=mongodb://localhost:27017
DB_NAME=forensics_db
CORS_ORIGINS=*
ADMIN_USERNAME=admin
ADMIN_PASSWORD=dcco2024
EOF
cat > /app/frontend/.env << 'EOF'
REACT_APP_BACKEND_URL=/api
EOF
cd /app/backend && pip install -r requirements.txt && \
cd /app/frontend && yarn install && \
sudo supervisorctl restart all
```

**Wait 30-40 seconds for frontend to compile, then verify:**
```bash
curl http://localhost:8001/api/stats && curl -I http://localhost:3000
```

---

## 📝 Step-by-Step Setup (If Needed)

### 1. Create Environment Files (10 seconds)
```bash
# Backend .env
cat > /app/backend/.env << 'EOF'
MONGO_URL=mongodb://localhost:27017
DB_NAME=forensics_db
CORS_ORIGINS=*
ADMIN_USERNAME=admin
ADMIN_PASSWORD=dcco2024
EOF

# Frontend .env
cat > /app/frontend/.env << 'EOF'
REACT_APP_BACKEND_URL=/api
EOF
```

### 2. Install Dependencies (2 minutes)
```bash
# Backend
cd /app/backend && pip install -r requirements.txt

# Frontend
cd /app/frontend && yarn install
```

### 3. Create Upload Directory
```bash
mkdir -p /app/uploads && chmod 755 /app/uploads
```

### 4. Start All Services
```bash
sudo supervisorctl restart all
```

### 5. Verify (After 30-40 seconds)
```bash
# Check services
sudo supervisorctl status

# Test backend
curl http://localhost:8001/api/
curl http://localhost:8001/api/stats

# Test frontend
curl -I http://localhost:3000
```

---

## 🔧 Daily Operations

### Check Status
```bash
sudo supervisorctl status
```

### Restart Services
```bash
# Restart all
sudo supervisorctl restart all

# Restart individual
sudo supervisorctl restart backend
sudo supervisorctl restart frontend
sudo supervisorctl restart mongodb
```

### View Logs
```bash
# Backend logs
tail -f /var/log/supervisor/backend.err.log

# Frontend logs
tail -f /var/log/supervisor/frontend.out.log

# Last 50 lines
tail -50 /var/log/supervisor/backend.err.log
```

### Test API
```bash
# Health check
curl http://localhost:8001/api/

# Database stats
curl http://localhost:8001/api/stats

# List cases
curl http://localhost:8001/api/cases

# Admin login (get token)
curl -X POST "http://localhost:8001/api/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"dcco2024"}'
```

---

## 🗂️ File Structure Reference

```
/app/
├── backend/
│   ├── server.py          # Main FastAPI application
│   ├── requirements.txt   # Python dependencies
│   └── .env              # Backend config
├── frontend/
│   ├── src/
│   │   ├── App.js        # Main React component
│   │   ├── LandingPage.js
│   │   └── AdminPanel.js
│   ├── package.json      # Node dependencies
│   └── .env              # Frontend config
└── uploads/              # Uploaded files storage
```

---

## 🐛 Quick Troubleshooting

### Backend Not Starting
```bash
# Check logs
tail -50 /var/log/supervisor/backend.err.log

# Check if port is in use
lsof -i :8001

# Restart
sudo supervisorctl restart backend
```

### Frontend Not Loading
```bash
# Check logs
tail -50 /var/log/supervisor/frontend.out.log

# Wait for compilation (takes 30-40 seconds)
# Check if compiled
curl -I http://localhost:3000
```

### MongoDB Issues
```bash
# Check if running
sudo supervisorctl status mongodb

# Restart
sudo supervisorctl restart mongodb

# Test connection
mongosh --eval "db.adminCommand('ping')"
```

### Clear All Data
```bash
# Login and get token first, then:
curl -X DELETE "http://localhost:8001/api/admin/cases/CASE_NUMBER"

# Or use admin panel: Click DCCO logo → Login → Delete case
```

---

## 📊 Access Points

| Service | URL | Purpose |
|---------|-----|---------|
| Frontend | http://localhost:3000 | Main UI |
| Backend API | http://localhost:8001/api/ | API endpoints |
| API Docs | http://localhost:8001/docs | Interactive API documentation |
| Admin Panel | Click DCCO logo (bottom right) | Database management |

---

## 🔐 Default Credentials

**Admin Panel:**
- Username: `admin`
- Password: `dcco2024`

To change: Edit `/app/backend/.env` and restart backend

---

## ⚠️ Important Notes

1. **Hot Reload Enabled**: Backend and frontend auto-reload on code changes
2. **Only Restart When**:
   - Installing new packages
   - Changing .env files
   - Services crashed

3. **Environment Variables** (NEVER MODIFY):
   - `MONGO_URL=mongodb://localhost:27017`
   - `REACT_APP_BACKEND_URL=/api`

4. **All API routes must use `/api` prefix** for Kubernetes ingress routing

---

## 💾 Backup & Data Management

### Backup Database
```bash
mongodump --db forensics_db --out /app/backup_$(date +%Y%m%d)
```

### Restore Database
```bash
mongorestore --db forensics_db /app/backup_YYYYMMDD/forensics_db
```

### Check Database Size
```bash
mongosh forensics_db --eval "db.stats()"
```

### List All Cases
```bash
curl http://localhost:8001/api/cases | jq
```

---

## 🎯 Common Tasks

### Upload New ZIP File
1. Go to http://localhost:3000
2. Use upload interface
3. Wait for processing
4. Check appropriate tabs (Contacts, Credentials, Suspects, WhatsApp Groups)

### Search for Person/Number
1. Use global search bar at top
2. Type name or phone number
3. Results appear across all tabs in real-time

### Delete Case
1. Click DCCO logo (bottom right)
2. Login with admin credentials
3. Find case in list
4. Click Delete → Confirm

### View Case Details
```bash
# Get suspect profiles
curl http://localhost:8001/api/suspect-profile | jq

# Get contacts for a case
curl "http://localhost:8001/api/contacts?case_number=CASE_NUMBER" | jq

# Get statistics
curl http://localhost:8001/api/stats | jq
```

---

## 🔄 Update Application

```bash
# Pull latest changes
cd /app && git pull

# Install new dependencies if any
cd /app/backend && pip install -r requirements.txt
cd /app/frontend && yarn install

# Restart services
sudo supervisorctl restart all
```

---

## 📱 Features Overview

- ✅ Forensic data extraction from Cellebrite ZIP files
- ✅ Contact deduplication with phone normalization
- ✅ Rich metadata extraction (bios, DOBs, occupations)
- ✅ WhatsApp group analysis with member search
- ✅ Social media account detection (12 platforms)
- ✅ Real-time search with accent-insensitive support
- ✅ Admin panel with password protection
- ✅ Case-by-case deletion
- ✅ Device name extraction from XML
- ✅ Landing page with animated counters

---

## 🆘 Emergency Commands

### Complete Reset
```bash
# Stop all services
sudo supervisorctl stop all

# Clear database
mongosh forensics_db --eval "db.dropDatabase()"

# Clear uploads
rm -rf /app/uploads/*

# Restart
sudo supervisorctl start all
```

### Check Disk Space
```bash
df -h /app
du -sh /app/uploads
```

### Check Memory Usage
```bash
free -h
ps aux | grep -E "(python|node)" | head -10
```

---

**Last Updated**: December 24, 2024  
**Environment**: Emergent Kubernetes with Supervisor

# Troubleshooting Guide - Pagini Galbui Network Deployment

## Problem: "Failed to load data" and cannot upload ZIP files

### Root Cause

The React frontend was built with the wrong backend URL. When React builds, it **bakes** environment variables into the JavaScript bundle. If it was built with a cloud URL or localhost URL, it will always try to connect there, even when accessed from the network.

## Quick Fix

Run the automatic fix script:

```bash
cd /app/DEPLOY
./fix-network-issue.sh
```

This script will:
1. Stop all containers
2. Remove conflicting .env files
3. Rebuild frontend with correct backend URL
4. Rebuild backend
5. Start all services
6. Run health checks

## Manual Fix

If the automatic script doesn't work, follow these steps:

### Step 1: Stop Everything
```bash
cd /app/DEPLOY
docker-compose down -v
```

### Step 2: Remove Frontend .env (Causes Conflicts)
```bash
rm -f ../frontend/.env
```

### Step 3: Rebuild Frontend with Correct URL
```bash
docker-compose build --no-cache --build-arg REACT_APP_BACKEND_URL=http://10.2.38.171/api frontend
```

### Step 4: Rebuild Backend
```bash
docker-compose build --no-cache backend
```

### Step 5: Start Services
```bash
docker-compose up -d
```

### Step 6: Wait and Verify
```bash
# Wait 30 seconds for services to start
sleep 30

# Check all services are running
docker-compose ps

# Test backend API
curl http://localhost/api/stats

# Test from network IP
curl http://10.2.38.171/api/stats
```

## Verification Tests

### Test 1: Nginx Health Check
```bash
curl http://localhost/health
# Expected: "healthy"
```

### Test 2: Backend API
```bash
curl http://localhost/api/stats
# Expected: {"contacts":0,"passwords":0,"user_accounts":0,"total":0}
```

### Test 3: Frontend Loading
```bash
curl -I http://localhost/
# Expected: HTTP/1.1 200 OK
```

### Test 4: Service Status
```bash
docker-compose ps
# Expected: All services show "Up"
```

### Test 5: Network Access
From another computer on the network:
```bash
curl http://10.2.38.171/api/stats
# Should return JSON
```

## Common Issues and Solutions

### Issue 1: Still Getting "Failed to load data"

**Cause**: Browser has cached the old frontend code

**Solution**:
1. Clear browser cache (Ctrl+Shift+Delete)
2. Or use Incognito/Private mode
3. Or hard refresh (Ctrl+F5)

### Issue 2: Cannot Access from Other Computers

**Cause**: Firewall blocking port 80

**Solution**:
```bash
# Check firewall
sudo ufw status

# Allow port 80
sudo ufw allow 80/tcp

# Verify port is listening
sudo netstat -tlnp | grep :80
```

### Issue 3: "Cannot upload ZIP" / Upload Fails

**Causes**:
1. Frontend trying to upload to wrong backend URL
2. File size too large
3. Backend not processing uploads

**Solutions**:

A. Verify frontend is using correct backend URL:
```bash
# Check built frontend code
docker exec paginigalbui_nginx grep -r "10.2.38.171" /usr/share/nginx/html/static/js/

# Should find the IP address in the JavaScript files
```

B. Check backend logs during upload:
```bash
docker-compose logs -f backend
# Then try to upload, watch for errors
```

C. Test upload with curl:
```bash
# Create test file
echo "test" > test.txt
zip test.zip test.txt

# Upload
curl -X POST \
  -F "file=@test.zip" \
  -F "case_number=TEST-001" \
  -F "person_name=Test User" \
  http://localhost/api/upload

# Should return: {"contacts":0,"passwords":0,"user_accounts":0,...}
```

### Issue 4: Services Not Starting

**Solution**:
```bash
# Check logs
docker-compose logs backend
docker-compose logs frontend

# Check for port conflicts
sudo netstat -tlnp | grep -E ':(80|8001|27017)'

# Restart with verbose output
docker-compose up
```

### Issue 5: Backend Database Connection Failed

**Cause**: MongoDB not ready when backend starts

**Solution**:
```bash
# Restart backend after mongodb is up
docker-compose restart backend

# Check mongodb logs
docker-compose logs mongodb
```

## Advanced Debugging

### Check Frontend Build Configuration

```bash
# View the built frontend environment
docker exec paginigalbui_frontend cat /usr/share/nginx/html/index.html | grep -o 'REACT_APP_BACKEND_URL[^"]*'
```

### Check Backend Environment

```bash
# View backend environment variables
docker exec paginigalbui_backend env | grep -E '(MONGO|CORS)'
```

### Check Network Connectivity Between Containers

```bash
# Frontend can reach backend
docker exec paginigalbui_frontend ping -c 2 backend

# Backend can reach mongodb
docker exec paginigalbui_backend ping -c 2 mongodb

# Nginx can reach frontend
docker exec paginigalbui_nginx ping -c 2 frontend
```

### View Real-Time Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend

# Last 50 lines
docker-compose logs --tail=50 backend
```

## Network Configuration

### For Client Computers to Access by Hostname

Add to hosts file on **each client computer**:

**Windows**:
1. Open Notepad as Administrator
2. Open: `C:\Windows\System32\drivers\etc\hosts`
3. Add line: `10.2.38.171 paginigalbui`
4. Save and restart browser

**Mac/Linux**:
```bash
sudo nano /etc/hosts
# Add: 10.2.38.171 paginigalbui
# Save: Ctrl+O, Enter, Ctrl+X
```

### Verify DNS Resolution

```bash
ping paginigalbui
# Should ping 10.2.38.171
```

## Performance Issues

### If App is Slow

```bash
# Check container resource usage
docker stats

# Check system resources
top
df -h

# Check network latency
ping 10.2.38.171
```

### If Upload is Slow

The nginx.conf is configured for 100MB max upload size. For larger files:

1. Edit `/app/DEPLOY/nginx-proxy.conf`
2. Change line 33: `client_max_body_size 100M;` to desired size (e.g., `500M`)
3. Restart: `docker-compose restart nginx`

## Complete Reset

If nothing works, complete reset:

```bash
cd /app/DEPLOY

# Stop and remove everything
docker-compose down -v

# Remove all images
docker-compose rm -f
docker images | grep paginigalbui | awk '{print $3}' | xargs docker rmi -f

# Rebuild from scratch
docker-compose build --no-cache

# Start fresh
docker-compose up -d

# Wait and test
sleep 30
curl http://localhost/api/stats
```

## Data Backup Before Reset

```bash
# Backup MongoDB data
docker exec paginigalbui_mongodb mongodump --out=/dump
docker cp paginigalbui_mongodb:/dump ./mongodb-backup-$(date +%Y%m%d-%H%M%S)

# Backup uploads
tar -czf uploads-backup-$(date +%Y%m%d-%H%M%S).tar.gz ../uploads
```

## Getting Help

If you still have issues, collect this information:

```bash
# System information
uname -a
docker --version
docker-compose --version

# Service status
docker-compose ps

# Recent logs
docker-compose logs --tail=100 > deployment-logs.txt

# Network configuration
ip addr show
sudo netstat -tlnp | grep -E ':(80|8001|27017)'
sudo ufw status
```

## Success Indicators

You know it's working when:

1. ✅ `docker-compose ps` shows all services "Up"
2. ✅ `curl http://localhost/health` returns "healthy"
3. ✅ `curl http://localhost/api/stats` returns JSON
4. ✅ Browser at `http://10.2.38.171` shows the application
5. ✅ Can upload a ZIP file successfully
6. ✅ Can see data in contacts/credentials tabs after upload
7. ✅ Other computers on network can access the app

## Prevention

To avoid this issue in future deployments:

1. **Always rebuild with --no-cache** when deploying
2. **Never copy .env files from development** to production
3. **Use build args explicitly** in docker-compose build
4. **Test from another computer** before declaring success
5. **Document the server IP** in deployment files

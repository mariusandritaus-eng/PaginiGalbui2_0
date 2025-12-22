# Dynamic IP Configuration Guide

## Problem with Hardcoded IPs

When you hardcode an IP address like `http://10.2.38.171/api` in the frontend:

❌ **Issues**:
- Breaks if server IP changes (DHCP)
- Can't move to another server
- Must rebuild frontend for each new IP
- Not portable across networks

## Solution: Relative URLs

Instead of absolute URLs, use **relative URLs** that adapt automatically!

### How It Works

```
User accesses:     http://10.2.38.171/
Frontend needs:    Backend API
Relative URL:      /api
Resolved to:       http://10.2.38.171/api  ← Same domain!

User accesses:     http://192.168.1.100/
Frontend needs:    Backend API  
Relative URL:      /api
Resolved to:       http://192.168.1.100/api  ← Automatically uses new IP!
```

### Architecture

```
Client Request → http://SERVER_IP/ or http://SERVER_IP/api/
       ↓
  Nginx Proxy (Port 80)
       ↓
    Routing:
    - /api/*  → Backend Container (port 8001)
    - /*      → Frontend Container (port 80)
```

Since Nginx handles all routing on the same domain, the frontend just uses `/api` and it automatically works!

## Implementation

### Option 1: Automated Fix Script (Recommended)

```bash
cd /app/DEPLOY
./fix-network-issue-dynamic.sh
```

This script:
1. ✅ Detects your current IP automatically
2. ✅ Configures frontend with relative URL `/api`
3. ✅ Rebuilds all containers
4. ✅ Starts services
5. ✅ Tests everything

### Option 2: Manual Configuration

#### Step 1: Update docker-compose.yml

Edit `/app/DEPLOY/docker-compose.yml`, find the frontend section and change:

```yaml
# Before (hardcoded IP):
args:
  - REACT_APP_BACKEND_URL=http://10.2.38.171/api

# After (relative URL):
args:
  - REACT_APP_BACKEND_URL=/api
```

#### Step 2: Remove Frontend .env

```bash
rm -f ../frontend/.env
```

#### Step 3: Create Production .env

```bash
cat > ../frontend/.env.production << 'EOF'
REACT_APP_BACKEND_URL=/api
EOF
```

#### Step 4: Rebuild and Start

```bash
cd /app/DEPLOY
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```

## Verification

### Test on Server Itself

```bash
# Get your current IP
hostname -I | awk '{print $1}'

# Test with localhost
curl http://localhost/api/stats

# Test with IP (replace with your IP)
curl http://YOUR_IP/api/stats
```

### Test from Another Computer

```bash
# Replace YOUR_IP with server's IP
curl http://YOUR_IP/api/stats

# Or open browser
http://YOUR_IP/
```

### Upload Test

```bash
# Create test file
echo "test" > test.txt
zip test.zip test.txt

# Upload using server IP
curl -X POST \
  -F "file=@test.zip" \
  -F "case_number=TEST-001" \
  -F "person_name=Test User" \
  http://YOUR_IP/api/upload
```

## Benefits of Relative URLs

✅ **Automatic IP Adaptation**
- Works with any IP address
- No rebuild when IP changes
- No configuration changes needed

✅ **Multi-Environment Support**
- Works on localhost
- Works on LAN IP
- Works with hostname
- Works with domain name

✅ **Portability**
- Move to any server
- Works on different networks
- Same container works everywhere

✅ **Maintenance-Free**
- Set once, works forever
- No IP tracking needed
- DHCP-friendly

## How the Frontend Code Works

When you build React with `REACT_APP_BACKEND_URL=/api`:

```javascript
// In your React code:
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL; // "/api"

// When making requests:
fetch(`${BACKEND_URL}/stats`)  // Becomes: fetch("/api/stats")

// Browser resolves relative URL to:
// http://current-domain/api/stats
```

If user accesses `http://10.2.38.171`:
- Request goes to: `http://10.2.38.171/api/stats`

If user accesses `http://192.168.1.50`:
- Request goes to: `http://192.168.1.50/api/stats`

**It just works!** 🎉

## Nginx Configuration

The nginx proxy configuration (already correct in `/app/DEPLOY/nginx-proxy.conf`):

```nginx
# Backend API routes
location /api/ {
    proxy_pass http://backend_server/api/;
    # ... proxy headers ...
}

# Frontend application
location / {
    proxy_pass http://frontend_server;
    # ... proxy headers ...
}
```

This routing is what makes relative URLs work seamlessly!

## Comparison

### Hardcoded IP Approach ❌

```yaml
# docker-compose.yml
REACT_APP_BACKEND_URL=http://10.2.38.171/api
```

**Pros**: None really
**Cons**: 
- Must know IP in advance
- Must rebuild if IP changes
- Can't move to another server
- Not portable

### Relative URL Approach ✅

```yaml
# docker-compose.yml
REACT_APP_BACKEND_URL=/api
```

**Pros**:
- Works with any IP automatically
- No rebuild when IP changes
- Fully portable
- One deployment works everywhere

**Cons**: None!

## Advanced: Hostname with mDNS (Bonus)

For extra convenience, use `.local` mDNS hostname:

```bash
# Your server automatically broadcasts as:
hostname-of-server.local

# Access from any device on LAN:
http://ubuntu-server.local/
http://your-hostname.local/
```

This works without editing hosts files! Just needs:
- Avahi/Bonjour (usually installed by default)
- Same local network

## Troubleshooting

### Issue: Still using old backend URL

**Cause**: Browser cache or old Docker image

**Solution**:
```bash
# Rebuild with no cache
docker-compose build --no-cache frontend

# Clear browser cache
# Or use Incognito/Private mode
```

### Issue: "Backend not reachable"

**Cause**: Nginx proxy not routing correctly

**Solution**:
```bash
# Check nginx logs
docker-compose logs nginx

# Verify nginx config
docker exec paginigalbui_nginx cat /etc/nginx/nginx.conf

# Test direct backend access
docker exec paginigalbui_nginx curl http://backend:8001/api/stats
```

### Issue: CORS errors in browser console

**Cause**: Backend CORS not allowing requests

**Solution**:
```bash
# Check backend CORS setting
docker exec paginigalbui_backend env | grep CORS

# Should show: CORS_ORIGINS=*

# If not, it's set in docker-compose.yml environment section
```

## IP Change Scenario

**Scenario**: Your server IP changes from `10.2.38.171` to `192.168.1.50`

### With Hardcoded IP ❌
1. Frontend still tries to connect to `10.2.38.171/api`
2. Fails to reach backend
3. Must edit docker-compose.yml
4. Must rebuild frontend
5. Must restart containers
6. Downtime during rebuild

### With Relative URL ✅
1. Frontend uses `/api` (relative)
2. Browser resolves to `192.168.1.50/api` automatically
3. Everything works immediately
4. No rebuild needed
5. No configuration changes
6. Zero downtime!

## Best Practices

1. ✅ **Always use relative URLs** for same-domain APIs
2. ✅ **Let nginx handle routing** - don't hardcode in app
3. ✅ **Build once, deploy anywhere** - portable containers
4. ✅ **Test on different IPs** before declaring success
5. ✅ **Document the approach** for future maintainers

## Summary

| Approach | Hardcoded IP | Relative URL |
|----------|-------------|--------------|
| Portability | ❌ Low | ✅ High |
| IP Change | ❌ Rebuild needed | ✅ Auto-adapts |
| Maintenance | ❌ High | ✅ Low |
| Setup | 😐 Medium | ✅ Easy |
| Flexibility | ❌ None | ✅ Complete |
| Recommended | ❌ No | ✅ Yes! |

**The relative URL approach is the correct solution for network deployments!**

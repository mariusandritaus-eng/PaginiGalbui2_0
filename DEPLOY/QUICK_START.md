# 🚀 Quick Start - Pagini Galbui

## 3-Step Deployment (Dynamic IP - Works on Any Network!)

### Step 1: Setup Hostname (Optional)
```bash
cd /app/DEPLOY
sudo ./setup-hostname.sh
```

### Step 2: Deploy with Dynamic IP
```bash
./fix-network-issue-dynamic.sh
```

This automatically:
- Detects your server IP
- Configures app to work on ANY IP
- Builds and starts all services
- Runs health checks

### Step 3: Access
Open browser and use YOUR server's IP:
```bash
# Find your IP first
hostname -I

# Then access (example IPs):
http://YOUR_SERVER_IP/
http://10.2.38.171/
http://192.168.1.50/
http://paginigalbui/
```

**Works on any IP automatically - no rebuild needed when IP changes!** 🎉

## Access from Other Devices

### Windows
1. Run Notepad as Administrator
2. Open: `C:\Windows\System32\drivers\etc\hosts`
3. Add: `10.2.38.171 paginigalbui`
4. Save and access: `http://paginigalbui`

### Mac/Linux
```bash
sudo nano /etc/hosts
# Add: 10.2.38.171 paginigalbui
```

## Common Commands

```bash
./start.sh              # Start services
./stop.sh               # Stop services
docker-compose logs -f  # View logs
docker-compose ps       # Check status
```

## Test Health

```bash
curl http://paginigalbui/health
curl http://paginigalbui/api/stats
```

## Troubleshooting

**Cannot access?**
```bash
sudo ufw allow 80/tcp  # Open firewall
curl http://localhost  # Test locally
```

**Services not starting?**
```bash
docker-compose logs backend
docker-compose restart
```

Ready to deploy! 🎉

#!/bin/bash

# Pagini Galbui - Export for Offline Deployment
# Run this script on a machine WITH internet connection
# It will create a package that can be transferred to an offline machine

set -e  # Exit on error

echo "=============================================================="
echo "Pagini Galbui - Offline Deployment Export"
echo "=============================================================="
echo ""
echo "This script prepares everything needed for offline deployment."
echo "Run this on a machine WITH internet connection."
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
EXPORT_DIR="paginigalbui-offline"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
PACKAGE_NAME="paginigalbui-offline-${TIMESTAMP}"

# Check if running from correct directory
if [ ! -f "docker-compose.yml" ]; then
    echo -e "${RED}Error: Please run this script from /app/DEPLOY directory${NC}"
    echo "Usage: cd /app/DEPLOY && ./1-export-for-offline.sh"
    exit 1
fi

echo -e "${YELLOW}Step 1: Creating export directory...${NC}"
rm -rf ${EXPORT_DIR}
mkdir -p ${EXPORT_DIR}/images
mkdir -p ${EXPORT_DIR}/deployment
echo -e "${GREEN}✓ Directories created${NC}"
echo ""

echo -e "${YELLOW}Step 2: Building Docker images...${NC}"
echo "This may take several minutes..."
docker-compose build --no-cache
echo -e "${GREEN}✓ Images built${NC}"
echo ""

echo -e "${YELLOW}Step 3: Pulling required base images...${NC}"
echo "Pulling MongoDB image..."
docker pull mongo:7.0
echo "Pulling Nginx image..."
docker pull nginx:alpine
echo -e "${GREEN}✓ Base images pulled${NC}"
echo ""

echo -e "${YELLOW}Step 4: Saving Docker images to tar files...${NC}"
echo "This will take a while and create large files..."

# Get image names from docker-compose
FRONTEND_IMAGE=$(docker images --filter=reference='*frontend*' --format "{{.Repository}}:{{.Tag}}" | grep deploy | head -n 1)
BACKEND_IMAGE=$(docker images --filter=reference='*backend*' --format "{{.Repository}}:{{.Tag}}" | grep deploy | head -n 1)

echo "Saving MongoDB image..."
docker save mongo:7.0 | gzip > ${EXPORT_DIR}/images/mongodb.tar.gz

echo "Saving Nginx image..."
docker save nginx:alpine | gzip > ${EXPORT_DIR}/images/nginx.tar.gz

echo "Saving Backend image..."
docker save ${BACKEND_IMAGE} | gzip > ${EXPORT_DIR}/images/backend.tar.gz

echo "Saving Frontend image..."
docker save ${FRONTEND_IMAGE} | gzip > ${EXPORT_DIR}/images/frontend.tar.gz

echo -e "${GREEN}✓ All images saved${NC}"
echo ""

echo -e "${YELLOW}Step 5: Copying deployment files...${NC}"

# Copy all necessary files
cp docker-compose.yml ${EXPORT_DIR}/deployment/
cp nginx-proxy.conf ${EXPORT_DIR}/deployment/
cp *.sh ${EXPORT_DIR}/deployment/ 2>/dev/null || true
cp *.md ${EXPORT_DIR}/deployment/ 2>/dev/null || true

# Copy backend and frontend source if needed for reference
echo "Copying application source..."
mkdir -p ${EXPORT_DIR}/reference
cp -r ../backend ${EXPORT_DIR}/reference/ 2>/dev/null || true
cp -r ../frontend ${EXPORT_DIR}/reference/ 2>/dev/null || true

echo -e "${GREEN}✓ Files copied${NC}"
echo ""

echo -e "${YELLOW}Step 6: Creating import script for offline machine...${NC}"
cat > ${EXPORT_DIR}/2-import-and-deploy.sh << 'OFFLINE_SCRIPT'
#!/bin/bash

# Pagini Galbui - Import and Deploy (Offline)
# Run this script on the offline machine

set -e

echo "=============================================================="
echo "Pagini Galbui - Offline Deployment Import"
echo "=============================================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed${NC}"
    echo "Please install Docker first:"
    echo "  sudo apt update"
    echo "  sudo apt install docker.io docker-compose"
    exit 1
fi

echo -e "${YELLOW}Step 1: Loading Docker images...${NC}"
echo "This will take several minutes..."

if [ ! -d "images" ]; then
    echo -e "${RED}Error: images directory not found${NC}"
    echo "Make sure you're running this from the extracted package directory"
    exit 1
fi

echo "Loading MongoDB image..."
docker load < images/mongodb.tar.gz

echo "Loading Nginx image..."
docker load < images/nginx.tar.gz

echo "Loading Backend image..."
docker load < images/backend.tar.gz

echo "Loading Frontend image..."
docker load < images/frontend.tar.gz

echo -e "${GREEN}✓ All images loaded${NC}"
echo ""

echo -e "${YELLOW}Step 2: Setting up deployment directory...${NC}"
cd deployment
echo -e "${GREEN}✓ Ready to deploy${NC}"
echo ""

echo -e "${YELLOW}Step 3: Detecting server IP...${NC}"
SERVER_IP=$(hostname -I | awk '{print $1}')
echo -e "${BLUE}Detected IP: ${SERVER_IP}${NC}"
echo ""

echo -e "${YELLOW}Step 4: Starting services...${NC}"
docker-compose up -d
echo -e "${GREEN}✓ Services started${NC}"
echo ""

echo -e "${YELLOW}Step 5: Waiting for services (30 seconds)...${NC}"
sleep 30
echo ""

echo -e "${YELLOW}Step 6: Checking service status...${NC}"
docker-compose ps
echo ""

echo -e "${YELLOW}Step 7: Testing deployment...${NC}"
echo "Testing backend API..."
if curl -s -f http://localhost/api/stats > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend is working!${NC}"
else
    echo -e "${RED}⚠ Backend test failed (this is normal if curl not installed)${NC}"
fi
echo ""

echo "=============================================================="
echo -e "${GREEN}Offline Deployment Complete!${NC}"
echo "=============================================================="
echo ""
echo "Access the application:"
echo "  From this server:   http://localhost/"
echo "  From network:       http://${SERVER_IP}/"
echo ""
echo "Management commands:"
echo "  View logs:    docker-compose logs -f"
echo "  Stop:         docker-compose stop"
echo "  Start:        docker-compose start"
echo "  Restart:      docker-compose restart"
echo "  Status:       docker-compose ps"
echo ""
OFFLINE_SCRIPT

chmod +x ${EXPORT_DIR}/2-import-and-deploy.sh
echo -e "${GREEN}✓ Import script created${NC}"
echo ""

echo -e "${YELLOW}Step 7: Creating README for offline deployment...${NC}"
cat > ${EXPORT_DIR}/README-OFFLINE.md << 'OFFLINE_README'
# Pagini Galbui - Offline Deployment Package

This package contains everything needed to deploy Pagini Galbui on a computer **without internet access**.

## Package Contents

```
paginigalbui-offline/
├── images/                          # Docker images (compressed)
│   ├── mongodb.tar.gz              # MongoDB database
│   ├── nginx.tar.gz                # Nginx proxy
│   ├── backend.tar.gz              # FastAPI backend
│   └── frontend.tar.gz             # React frontend
├── deployment/                      # Deployment configuration
│   ├── docker-compose.yml          # Service orchestration
│   ├── nginx-proxy.conf            # Nginx configuration
│   └── *.sh, *.md                  # Scripts and documentation
├── reference/                       # Source code (for reference)
│   ├── backend/
│   └── frontend/
├── 2-import-and-deploy.sh          # Automated deployment script
└── README-OFFLINE.md               # This file
```

## System Requirements

### Offline Machine Requirements

- **OS**: Ubuntu 20.04+ or similar Linux
- **RAM**: 4GB minimum, 8GB recommended
- **Disk**: 10GB free space
- **Docker**: Version 20.10+
- **Docker Compose**: Version 1.29+

### Install Docker on Offline Machine

If Docker is not installed, you'll need to install it. You have two options:

#### Option A: Use Installation Media

Prepare on internet-connected machine:
```bash
# Download Docker packages
mkdir docker-offline-packages
cd docker-offline-packages
apt-get download docker.io docker-compose containerd runc
# Copy this folder to offline machine along with the deployment package
```

On offline machine:
```bash
cd docker-offline-packages
sudo dpkg -i *.deb
sudo systemctl start docker
sudo systemctl enable docker
```

#### Option B: Use Snap (if available offline)

If you have snap packages available:
```bash
sudo snap install docker
```

## Deployment Steps

### Step 1: Transfer Package to Offline Machine

Transfer the entire `paginigalbui-offline` folder using:
- USB drive
- External hard drive
- Network file share
- Any other method

**Package Size**: Approximately 1-2 GB (compressed images)

### Step 2: Extract (if compressed)

If transferred as archive:
```bash
tar -xzf paginigalbui-offline-YYYYMMDD-HHMMSS.tar.gz
cd paginigalbui-offline
```

### Step 3: Run Deployment Script

```bash
chmod +x 2-import-and-deploy.sh
sudo ./2-import-and-deploy.sh
```

The script will:
1. Load all Docker images
2. Detect your server IP
3. Start all services
4. Run health checks
5. Display access URLs

### Step 4: Access the Application

Open a web browser and navigate to:
- `http://localhost/` (on the server itself)
- `http://SERVER_IP/` (from other computers on network)

Replace `SERVER_IP` with the IP shown by the deployment script.

## Manual Deployment (Alternative)

If the automated script fails, deploy manually:

```bash
cd deployment

# Load images
docker load < ../images/mongodb.tar.gz
docker load < ../images/nginx.tar.gz
docker load < ../images/backend.tar.gz
docker load < ../images/frontend.tar.gz

# Start services
docker-compose up -d

# Check status
docker-compose ps
```

## Configuration

### Change Server Hostname

Edit `/etc/hosts` on the server:
```bash
sudo nano /etc/hosts
# Add: 127.0.0.1 paginigalbui
```

### Access from Other Computers

On client computers, add to their hosts file:

**Windows** (`C:\Windows\System32\drivers\etc\hosts`):
```
SERVER_IP paginigalbui
```

**Linux/Mac** (`/etc/hosts`):
```
SERVER_IP paginigalbui
```

Replace `SERVER_IP` with your server's IP address.

### Firewall Configuration

If you can't access from other computers:
```bash
# Allow port 80
sudo ufw allow 80/tcp
sudo ufw reload

# Verify
sudo ufw status
```

## Management Commands

```bash
# Navigate to deployment directory
cd deployment

# View logs (all services)
docker-compose logs -f

# View logs (specific service)
docker-compose logs -f backend

# Check service status
docker-compose ps

# Stop all services
docker-compose stop

# Start all services
docker-compose start

# Restart all services
docker-compose restart

# Stop and remove containers (preserves data)
docker-compose down

# Complete cleanup (WARNING: deletes data!)
docker-compose down -v
```

## Troubleshooting

### Services Not Starting

```bash
# Check logs
docker-compose logs

# Check if ports are available
sudo netstat -tlnp | grep -E ':(80|8001|27017)'

# Restart services
docker-compose restart
```

### Backend API Not Responding

```bash
# Check backend logs
docker-compose logs backend

# Test backend directly
docker exec paginigalbui_backend curl http://localhost:8001/api/stats
```

### Cannot Access from Network

```bash
# Check firewall
sudo ufw status

# Allow port 80
sudo ufw allow 80/tcp

# Check if nginx is listening
sudo netstat -tlnp | grep :80
```

### Upload Fails

```bash
# Check backend logs during upload
docker-compose logs -f backend

# Verify uploads directory
docker exec paginigalbui_backend ls -la /app/uploads

# Check disk space
df -h
```

## Data Backup

### Backup MongoDB Data

```bash
# Backup
docker exec paginigalbui_mongodb mongodump --out=/dump
docker cp paginigalbui_mongodb:/dump ./mongodb-backup-$(date +%Y%m%d)

# Restore
docker cp ./mongodb-backup-YYYYMMDD paginigalbui_mongodb:/restore
docker exec paginigalbui_mongodb mongorestore /restore
```

### Backup Uploaded Files

```bash
# Navigate to deployment directory
cd deployment

# Backup
tar -czf uploads-backup-$(date +%Y%m%d).tar.gz ../uploads

# Restore
tar -xzf uploads-backup-YYYYMMDD.tar.gz
```

## Updating the Application

To update to a newer version:

1. Export new offline package from internet-connected machine
2. Transfer to offline machine
3. Stop current deployment:
   ```bash
   docker-compose down
   ```
4. Backup your data (see above)
5. Load new images:
   ```bash
   docker load < new-images/backend.tar.gz
   docker load < new-images/frontend.tar.gz
   ```
6. Start with new images:
   ```bash
   docker-compose up -d
   ```

## Security Notes

For offline/air-gapped deployments:

1. **Change default passwords** in configuration files
2. **Restrict network access** to authorized users only
3. **Keep audit logs** of all access
4. **Regular backups** to external media
5. **Physical security** of the server

## Support

For issues with offline deployment:

1. Check logs: `docker-compose logs`
2. Review troubleshooting section above
3. Consult `deployment/TROUBLESHOOTING.md`
4. Check Docker status: `sudo systemctl status docker`

## Package Information

This offline deployment package was created to enable deployment on air-gapped or internet-restricted systems. All necessary Docker images and configuration files are included.

**No internet connection required after deployment!**
OFFLINE_README

echo -e "${GREEN}✓ README created${NC}"
echo ""

echo -e "${YELLOW}Step 8: Calculating package size...${NC}"
PACKAGE_SIZE=$(du -sh ${EXPORT_DIR} | awk '{print $1}')
echo -e "${BLUE}Package size: ${PACKAGE_SIZE}${NC}"
echo ""

echo -e "${YELLOW}Step 9: Creating compressed package...${NC}"
tar -czf ${PACKAGE_NAME}.tar.gz ${EXPORT_DIR}
ARCHIVE_SIZE=$(du -sh ${PACKAGE_NAME}.tar.gz | awk '{print $1}')
echo -e "${GREEN}✓ Compressed package created: ${PACKAGE_NAME}.tar.gz${NC}"
echo -e "${BLUE}Archive size: ${ARCHIVE_SIZE}${NC}"
echo ""

echo -e "${YELLOW}Step 10: Creating checksums...${NC}"
sha256sum ${PACKAGE_NAME}.tar.gz > ${PACKAGE_NAME}.sha256
echo -e "${GREEN}✓ Checksum created: ${PACKAGE_NAME}.sha256${NC}"
echo ""

echo "=============================================================="
echo -e "${GREEN}Export Complete!${NC}"
echo "=============================================================="
echo ""
echo "Package created: ${PACKAGE_NAME}.tar.gz"
echo "Package size:    ${ARCHIVE_SIZE}"
echo "Checksum file:   ${PACKAGE_NAME}.sha256"
echo ""
echo "Next steps:"
echo "1. Transfer ${PACKAGE_NAME}.tar.gz to offline machine"
echo "2. Transfer ${PACKAGE_NAME}.sha256 to offline machine"
echo "3. On offline machine, verify checksum:"
echo "   sha256sum -c ${PACKAGE_NAME}.sha256"
echo "4. Extract package:"
echo "   tar -xzf ${PACKAGE_NAME}.tar.gz"
echo "5. Run deployment:"
echo "   cd ${EXPORT_DIR}"
echo "   sudo ./2-import-and-deploy.sh"
echo ""
echo "Transfer methods:"
echo "  - USB drive"
echo "  - External hard drive"
echo "  - Network file share"
echo "  - Optical media (DVD/Blu-ray)"
echo ""

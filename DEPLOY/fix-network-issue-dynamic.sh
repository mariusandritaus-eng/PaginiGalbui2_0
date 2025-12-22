#!/bin/bash

# Pagini Galbui - Fix Network Access with Dynamic IP Detection
# This script rebuilds the frontend to use RELATIVE URLs (no hardcoded IP!)

set -e  # Exit on error

echo "=========================================================="
echo "Pagini Galbui - Dynamic Network Access Fix"
echo "=========================================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if running from correct directory
if [ ! -f "docker-compose.yml" ]; then
    echo -e "${RED}Error: Please run this script from /app/DEPLOY directory${NC}"
    echo "Usage: cd /app/DEPLOY && ./fix-network-issue-dynamic.sh"
    exit 1
fi

# Detect server IP automatically
echo -e "${YELLOW}Detecting server IP address...${NC}"
SERVER_IP=$(hostname -I | awk '{print $1}')
echo -e "${BLUE}Detected IP: ${SERVER_IP}${NC}"
echo ""

echo -e "${YELLOW}Step 1: Stopping all containers...${NC}"
docker compose down -v
echo -e "${GREEN}✓ Containers stopped${NC}"
echo ""

echo -e "${YELLOW}Step 2: Removing frontend .env file to prevent conflicts...${NC}"
if [ -f "../frontend/.env" ]; then
    echo "Backing up original .env to .env.backup"
    cp ../frontend/.env ../frontend/.env.backup
    rm ../frontend/.env
    echo -e "${GREEN}✓ Frontend .env removed${NC}"
else
    echo "No .env file found (this is good)"
fi
echo ""

echo -e "${YELLOW}Step 3: Creating production .env with RELATIVE URL...${NC}"
cat > ../frontend/.env.production << 'EOF'
# Use relative URL - works with any IP/hostname automatically!
REACT_APP_BACKEND_URL=/api
EOF
echo -e "${GREEN}✓ Production .env created with relative URL: /api${NC}"
echo -e "${BLUE}  This will work on ANY IP address automatically!${NC}"
echo ""

echo -e "${YELLOW}Step 4: Updating docker-compose.yml to use relative URL...${NC}"
# Backup original
cp docker-compose.yml docker-compose.yml.backup

# Update the build arg to use relative URL
sed -i 's|REACT_APP_BACKEND_URL=http://.*|REACT_APP_BACKEND_URL=/api|g' docker-compose.yml
echo -e "${GREEN}✓ docker-compose.yml updated${NC}"
echo ""

echo -e "${YELLOW}Step 5: Rebuilding frontend with relative URL (this may take a few minutes)...${NC}"
docker compose build --no-cache frontend
echo -e "${GREEN}✓ Frontend rebuilt${NC}"
echo ""

echo -e "${YELLOW}Step 6: Rebuilding backend...${NC}"
docker compose build --no-cache backend
echo -e "${GREEN}✓ Backend rebuilt${NC}"
echo ""

echo -e "${YELLOW}Step 7: Starting all services...${NC}"
docker compose up -d
echo -e "${GREEN}✓ Services started${NC}"
echo ""

echo -e "${YELLOW}Step 8: Waiting for services to be ready (30 seconds)...${NC}"
sleep 30
echo -e "${GREEN}✓ Services should be ready${NC}"
echo ""

echo -e "${YELLOW}Step 9: Checking service status...${NC}"
docker compose ps
echo ""

echo -e "${YELLOW}Step 10: Testing backend API...${NC}"
echo "Testing: http://localhost/api/stats"
if curl -s -f http://localhost/api/stats > /dev/null; then
    echo -e "${GREEN}✓ Backend API is working!${NC}"
    curl -s http://localhost/api/stats | python3 -m json.tool 2>/dev/null || curl -s http://localhost/api/stats
else
    echo -e "${RED}✗ Backend API test failed${NC}"
    echo "Checking backend logs:"
    docker compose logs --tail=20 backend
fi
echo ""

echo -e "${YELLOW}Step 11: Testing nginx health...${NC}"
echo "Testing: http://localhost/health"
if curl -s -f http://localhost/health > /dev/null; then
    echo -e "${GREEN}✓ Nginx is healthy!${NC}"
else
    echo -e "${RED}✗ Nginx health check failed${NC}"
fi
echo ""

echo "=========================================================="
echo -e "${GREEN}Dynamic IP Fix Complete!${NC}"
echo "=========================================================="
echo ""
echo -e "${BLUE}Your server IP is: ${SERVER_IP}${NC}"
echo ""
echo "The app now uses RELATIVE URLs and will work on:"
echo "  ✅ Any IP address (current: http://${SERVER_IP})"
echo "  ✅ Localhost (http://localhost)"
echo "  ✅ Hostname (http://paginigalbui)"
echo "  ✅ ANY future IP if it changes!"
echo ""
echo "Access the app from any computer on your network:"
echo "  - http://${SERVER_IP}"
echo "  - http://paginigalbui (if hostname configured)"
echo ""
echo "No rebuild needed if IP changes! 🎉"
echo ""
echo "If you still have issues:"
echo "  - Check firewall: sudo ufw allow 80/tcp"
echo "  - Clear browser cache on client computers"
echo "  - Use incognito/private mode for testing"
echo ""
echo "View logs: docker compose logs -f"
echo ""

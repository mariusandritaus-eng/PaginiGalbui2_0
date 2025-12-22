#!/bin/bash

# Pagini Galbui - Fix Network Access Issue
# This script rebuilds the frontend with the correct backend URL

set -e  # Exit on error

echo "=================================================="
echo "Pagini Galbui - Network Access Fix"
echo "=================================================="
echo ""

# Configuration
BACKEND_URL="http://10.2.38.171/api"
DEPLOY_DIR="/app/DEPLOY"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running from correct directory
if [ ! -f "docker-compose.yml" ]; then
    echo -e "${RED}Error: Please run this script from /app/DEPLOY directory${NC}"
    echo "Usage: cd /app/DEPLOY && ./fix-network-issue.sh"
    exit 1
fi

echo -e "${YELLOW}Step 1: Stopping all containers...${NC}"
docker-compose down -v
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

echo -e "${YELLOW}Step 3: Creating production .env file...${NC}"
cat > ../frontend/.env.production << EOF
REACT_APP_BACKEND_URL=${BACKEND_URL}
EOF
echo -e "${GREEN}✓ Production .env created${NC}"
echo ""

echo -e "${YELLOW}Step 4: Rebuilding frontend (this may take a few minutes)...${NC}"
docker-compose build --no-cache --build-arg REACT_APP_BACKEND_URL=${BACKEND_URL} frontend
echo -e "${GREEN}✓ Frontend rebuilt${NC}"
echo ""

echo -e "${YELLOW}Step 5: Rebuilding backend...${NC}"
docker-compose build --no-cache backend
echo -e "${GREEN}✓ Backend rebuilt${NC}"
echo ""

echo -e "${YELLOW}Step 6: Starting all services...${NC}"
docker-compose up -d
echo -e "${GREEN}✓ Services started${NC}"
echo ""

echo -e "${YELLOW}Step 7: Waiting for services to be ready (30 seconds)...${NC}"
sleep 30
echo -e "${GREEN}✓ Services should be ready${NC}"
echo ""

echo -e "${YELLOW}Step 8: Checking service status...${NC}"
docker-compose ps
echo ""

echo -e "${YELLOW}Step 9: Testing backend API...${NC}"
echo "Testing: http://localhost/api/stats"
if curl -s -f http://localhost/api/stats > /dev/null; then
    echo -e "${GREEN}✓ Backend API is working!${NC}"
    curl -s http://localhost/api/stats | python3 -m json.tool 2>/dev/null || curl -s http://localhost/api/stats
else
    echo -e "${RED}✗ Backend API test failed${NC}"
    echo "Checking backend logs:"
    docker-compose logs --tail=20 backend
fi
echo ""

echo -e "${YELLOW}Step 10: Testing nginx health...${NC}"
echo "Testing: http://localhost/health"
if curl -s -f http://localhost/health > /dev/null; then
    echo -e "${GREEN}✓ Nginx is healthy!${NC}"
else
    echo -e "${RED}✗ Nginx health check failed${NC}"
fi
echo ""

echo "=================================================="
echo -e "${GREEN}Fix complete!${NC}"
echo "=================================================="
echo ""
echo "Next steps:"
echo "1. Test from this server: http://localhost"
echo "2. Test from network:     http://10.2.38.171"
echo "3. Test from hostname:    http://paginigalbui"
echo ""
echo "If you still have issues:"
echo "- Check firewall: sudo ufw allow 80/tcp"
echo "- Clear browser cache on client computers"
echo "- Use incognito/private mode for testing"
echo ""
echo "View logs: docker-compose logs -f"
echo ""

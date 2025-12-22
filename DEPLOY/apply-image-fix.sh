#!/bin/bash

# Automated script to fix the double /api/api image path bug
# Author: AI Agent
# Date: December 2025

set -e  # Exit on error

echo "========================================="
echo "Fixing Double /api/api Image Path Bug"
echo "========================================="
echo ""

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if we're in the DEPLOY directory
if [ ! -f "docker-compose.yml" ]; then
    echo -e "${RED}Error: docker-compose.yml not found${NC}"
    echo "Please run this script from /app/DEPLOY directory"
    exit 1
fi

echo -e "${YELLOW}Step 1: Backing up current server.py...${NC}"
cp ../backend/server.py ../backend/server.py.backup.$(date +%Y%m%d_%H%M%S)
echo -e "${GREEN}✓ Backup created${NC}"
echo ""

echo -e "${YELLOW}Step 2: Applying fixes to server.py...${NC}"

# Fix 1: Line 911 - contact photo paths
sed -i 's|contact_dict\['"'"'photo_path'"'"'\] = f"/api/images/{img_filename}"|contact_dict['"'"'photo_path'"'"'] = f"/images/{img_filename}"|g' ../backend/server.py

# Fix 2: Line 1061 - suspect profile image paths
sed -i 's|me_jpg_path = f"/api/suspect-image/|me_jpg_path = f"/suspect-image/|g' ../backend/server.py

echo -e "${GREEN}✓ Fixes applied${NC}"
echo ""

echo -e "${YELLOW}Step 3: Verifying fixes...${NC}"
PHOTO_FIX=$(grep -c 'photo_path.*= f"/images/' ../backend/server.py || true)
SUSPECT_FIX=$(grep -c 'me_jpg_path = f"/suspect-image/' ../backend/server.py || true)

if [ "$PHOTO_FIX" -eq 1 ] && [ "$SUSPECT_FIX" -eq 1 ]; then
    echo -e "${GREEN}✓ All fixes verified${NC}"
else
    echo -e "${RED}✗ Fix verification failed!${NC}"
    echo "Photo path fix count: $PHOTO_FIX (expected: 1)"
    echo "Suspect image fix count: $SUSPECT_FIX (expected: 1)"
    echo -e "${YELLOW}Restoring backup...${NC}"
    cp ../backend/server.py.backup.* ../backend/server.py 2>/dev/null || true
    exit 1
fi
echo ""

echo -e "${YELLOW}Step 4: Rebuilding backend container...${NC}"
docker-compose build --no-cache backend
echo -e "${GREEN}✓ Backend rebuilt${NC}"
echo ""

echo -e "${YELLOW}Step 5: Restarting backend service...${NC}"
docker-compose up -d backend
echo -e "${GREEN}✓ Backend restarted${NC}"
echo ""

echo -e "${YELLOW}Step 6: Waiting for backend to be ready...${NC}"
sleep 5
for i in {1..10}; do
    if curl -s http://localhost/api/ > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Backend is ready${NC}"
        break
    fi
    echo "Waiting... ($i/10)"
    sleep 2
done
echo ""

echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}Fix Applied Successfully!${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Clear your browser cache or use Incognito mode"
echo "2. Clear database (optional but recommended):"
echo "   curl -X DELETE http://localhost/api/clear-database"
echo "3. Re-upload your forensic dumps"
echo "4. Verify images display correctly"
echo ""
echo -e "${YELLOW}To check backend logs:${NC}"
echo "docker-compose logs -f backend"
echo ""
echo -e "${YELLOW}To verify the fix:${NC}"
echo "docker-compose logs backend | grep 'GET /api/images'"
echo "You should see: 'GET /api/images/xxx.jpg HTTP/1.1\" 200 OK'"
echo "NOT: 'GET /api/api/images/xxx.jpg HTTP/1.1\" 404 Not Found'"
echo ""

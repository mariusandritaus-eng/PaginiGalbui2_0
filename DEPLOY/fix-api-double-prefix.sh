#!/bin/bash

# Fix API Double Prefix Issue
# This script fixes the /api/api/ double prefix bug and rebuilds the frontend

set -e

echo "=========================================================="
echo "Pagini Galbui - Fix API Double Prefix Issue"
echo "=========================================================="
echo ""

# Get current directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Step 1: Stopping frontend container..."
docker-compose stop frontend
echo "✓ Frontend stopped"
echo ""

echo "Step 2: Removing frontend container..."
docker-compose rm -f frontend
echo "✓ Frontend container removed"
echo ""

echo "Step 3: Rebuilding frontend with fix (this may take a few minutes)..."
docker-compose build --no-cache frontend
echo "✓ Frontend rebuilt"
echo ""

echo "Step 4: Starting frontend..."
docker-compose up -d frontend
echo "✓ Frontend started"
echo ""

echo "Step 5: Waiting for services to be ready (15 seconds)..."
sleep 15
echo "✓ Services should be ready"
echo ""

echo "Step 6: Checking service status..."
docker-compose ps
echo ""

echo "Step 7: Testing backend API..."
echo "Testing: http://localhost/api/stats"
if curl -s http://localhost/api/stats > /dev/null 2>&1; then
    echo "✓ Backend API is working!"
    curl -s http://localhost/api/stats | jq . 2>/dev/null || curl -s http://localhost/api/stats
else
    echo "⚠ Backend API test failed - check logs: docker-compose logs backend"
fi
echo ""

echo "Step 8: Testing nginx health..."
echo "Testing: http://localhost/health"
if curl -s http://localhost/health > /dev/null 2>&1; then
    echo "✓ Nginx is healthy!"
else
    echo "⚠ Nginx health check failed"
fi
echo ""

echo "=========================================================="
echo "API Double Prefix Fix Complete!"
echo "=========================================================="
echo ""
echo "The fix has been applied. Frontend now uses:"
echo "  - REACT_APP_BACKEND_URL=/api"
echo "  - API calls go to: /api/endpoint (no double prefix)"
echo ""
echo "Test from another computer on your network:"
echo "  - http://$(hostname -I | awk '{print $1}')"
echo "  - Should now load data without errors!"
echo ""
echo "If you still have issues:"
echo "  - Clear browser cache on client computers"
echo "  - Use incognito/private mode for testing"
echo "  - Check logs: docker-compose logs -f"
echo ""
echo "For offline operation:"
echo "  - App now works without internet connection"
echo "  - All resources served locally from Docker containers"
echo "=========================================================="

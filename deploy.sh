#!/bin/bash

# Pagini Galbui - Docker Deployment Script

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}  Pagini Galbui - Docker Deployment${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed${NC}"
    echo "Please install Docker first: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${RED}Error: Docker Compose is not installed${NC}"
    echo "Please install Docker Compose: https://docs.docker.com/compose/install/"
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}Warning: .env file not found${NC}"
    echo "Copying .env.example to .env..."
    cp .env.example .env
    echo -e "${YELLOW}Please edit .env file with your configuration before running again${NC}"
    exit 1
fi

# Parse command line arguments
MODE=${1:-dev}

if [ "$MODE" = "prod" ] || [ "$MODE" = "production" ]; then
    COMPOSE_FILE="docker compose.prod.yml"
    echo -e "${GREEN}Deploying in PRODUCTION mode${NC}"
else
    COMPOSE_FILE="docker compose.yml"
    echo -e "${GREEN}Deploying in DEVELOPMENT mode${NC}"
fi

echo ""
echo -e "${BLUE}Step 1: Stopping existing containers${NC}"
docker compose -f $COMPOSE_FILE down

echo ""
echo -e "${BLUE}Step 2: Building images${NC}"
docker compose -f $COMPOSE_FILE build --no-cache

echo ""
echo -e "${BLUE}Step 3: Starting services${NC}"
docker compose -f $COMPOSE_FILE up -d

echo ""
echo -e "${BLUE}Step 4: Waiting for services to be ready${NC}"
sleep 10

echo ""
echo -e "${BLUE}Step 5: Checking service status${NC}"
docker compose -f $COMPOSE_FILE ps

echo ""
echo -e "${BLUE}Step 6: Checking service health${NC}"

# Check MongoDB
if docker compose -f $COMPOSE_FILE exec -T mongodb mongosh --eval "db.version()" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ MongoDB is running${NC}"
else
    echo -e "${YELLOW}⚠ MongoDB may still be starting...${NC}"
fi

# Check Backend
if curl -sf http://localhost:8001/api/ > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend API is responding${NC}"
else
    echo -e "${YELLOW}⚠ Backend API may still be starting...${NC}"
fi

# Check Frontend
if curl -sf http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Frontend is responding${NC}"
else
    echo -e "${YELLOW}⚠ Frontend may still be starting...${NC}"
fi

echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}  Deployment Complete!${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""
echo "Access URLs:"
echo -e "  Frontend: ${BLUE}http://localhost:3000${NC}"
echo -e "  Backend:  ${BLUE}http://localhost:8001/api/${NC}"
echo -e "  API Docs: ${BLUE}http://localhost:8001/docs${NC}"
echo ""
echo "Useful commands:"
echo "  View logs:           docker compose -f $COMPOSE_FILE logs -f"
echo "  Stop services:       docker compose -f $COMPOSE_FILE down"
echo "  Restart services:    docker compose -f $COMPOSE_FILE restart"
echo "  View status:         docker compose -f $COMPOSE_FILE ps"
echo ""
echo "For production deployment, run: ./deploy.sh prod"
echo ""

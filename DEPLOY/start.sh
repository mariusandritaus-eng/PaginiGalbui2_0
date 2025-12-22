#!/bin/bash

# Pagini Galbui - Deployment Start Script (Docker Compose V2)

set -e

echo "========================================"
echo "  Pagini Galbui - Starting Deployment"
echo "========================================"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed"
    echo "Please install Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker Compose V2 is installed (subcommand)
if ! docker compose version &> /dev/null; then
    echo "Error: Docker Compose V2 is not installed"
    echo "Please install the Compose plugin: https://docs.docker.com/compose/install/"
    exit 1
fi

echo "Docker and Docker Compose V2 are installed"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "Warning: .env file not found"
    echo "Creating .env from .env.example..."
    cp .env.example .env
    echo "Created .env file"
    echo "Please edit .env and update passwords before production use!"
    echo ""
fi

# Stop any running services
echo "Stopping existing services..."
docker compose down 2>/dev/null || true
echo "Stopped existing services"
echo ""

# Build and start services
echo "Building and starting services..."
echo "This may take several minutes on first run..."
echo ""
docker compose up -d --build

# Wait for services to be healthy
echo ""
echo "Waiting for services to start..."
sleep 10

# Check service status
echo ""
echo "Service Status:"
docker compose ps

# Test backend API
echo ""
echo "Testing backend API..."
for i in {1..10}; do
    if curl -f -s http://localhost/api/stats > /dev/null 2>&1; then
        echo "Backend API is responding"
        break
    fi
    if [ $i -eq 10 ]; then
        echo "Backend API is not responding after 10 attempts"
        echo "Check logs: docker compose logs backend"
    fi
    echo "Waiting for backend... ($i/10)"
    sleep 3
done

# Display access information
echo ""
echo "========================================"
echo "  Deployment Complete!"
echo "========================================"
echo ""
echo "Access the application at:"
echo "  - http://paginigalbui (if hostname configured)"
echo "  - http://localhost (from this machine)"
echo ""
echo "Management Commands:"
echo "  View logs:    docker compose logs -f"
echo "  Stop:         docker compose down"
echo "  Restart:      docker compose restart"
echo "  Status:       docker compose ps"
echo ""
echo "For more information, see README.md"
echo "========================================"
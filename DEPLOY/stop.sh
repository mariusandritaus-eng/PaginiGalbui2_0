#!/bin/bash

# Pagini Galbui - Stop Deployment Script (Docker Compose V2)

set -e

echo "========================================"
echo "  Pagini Galbui - Stopping Services"
echo "========================================"
echo ""

echo "Stopping all services..."
docker compose down

echo ""
echo "All services stopped"
echo ""
echo "To remove data volumes, run:"
echo "  docker compose down -v"
echo ""
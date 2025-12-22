#!/bin/bash

# Pagini Galbui - Prerequisites Installer
# Based on UBUNTU_DEPLOYMENT_GUIDE.md

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}  Pagini Galbui - System Setup & Prerequisites  ${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Check if running as root
if [ "$EUID" -eq 0 ]; then
  echo -e "${RED}Please run this script as a normal user with sudo privileges, not as root.${NC}"
  exit 1
fi

echo -e "${BLUE}[1/5] Updating package lists...${NC}"
sudo apt-get update

echo -e "${BLUE}[2/5] Installing required system packages...${NC}"
sudo apt-get install -y ca-certificates curl gnupg lsb-release git

echo -e "${BLUE}[3/5] Setting up Docker repository...${NC}"
# Create keyring directory
sudo mkdir -p /etc/apt/keyrings
# Add Docker's official GPG key (if not exists)
if [ ! -f /etc/apt/keyrings/docker.gpg ]; then
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
fi

# Set up the repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

echo -e "${BLUE}[4/5] Installing Docker Engine and Compose V2...${NC}"
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

echo -e "${BLUE}[5/5] Configuring user permissions...${NC}"
# Add current user to docker group
sudo usermod -aG docker $USER

echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}  Installation Complete!${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""
echo -e "Versions installed:"
docker --version
docker compose version
echo ""
echo -e "${RED}IMPORTANT: You must LOG OUT and LOG BACK IN for the group changes to take effect.${NC}"
echo -e "Alternatively, run this command now: ${GREEN}newgrp docker${NC}"
echo ""
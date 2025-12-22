#!/bin/bash

# Pagini Galbui - Hostname Setup Script

set -e

HOSTNAME="paginigalbui"
IP_ADDRESS="10.2.38.171"
HOSTS_FILE="/etc/hosts"

echo "========================================"
echo "  Hostname Configuration for Pagini Galbui"
echo "========================================"
echo ""
echo "This script will add the following entry to $HOSTS_FILE:"
echo "  $IP_ADDRESS $HOSTNAME"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Error: This script must be run as root"
    echo "Please run: sudo bash setup-hostname.sh"
    exit 1
fi

# Check if entry already exists
if grep -q "$HOSTNAME" "$HOSTS_FILE"; then
    echo "Warning: Entry for '$HOSTNAME' already exists in $HOSTS_FILE"
    echo "Current entry:"
    grep "$HOSTNAME" "$HOSTS_FILE"
    echo ""
    read -p "Do you want to update it? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 0
    fi
    # Remove old entry
    sed -i.bak "/$HOSTNAME/d" "$HOSTS_FILE"
    echo "Removed old entry"
fi

# Add new entry
echo "$IP_ADDRESS $HOSTNAME" >> "$HOSTS_FILE"
echo "Added entry to $HOSTS_FILE"

# Verify
echo ""
echo "Current hostname configuration:"
grep "$HOSTNAME" "$HOSTS_FILE"

# Test resolution
echo ""
echo "Testing hostname resolution..."
if ping -c 1 "$HOSTNAME" &> /dev/null; then
    echo "Hostname '$HOSTNAME' resolves correctly"
else
    echo "Warning: Cannot ping '$HOSTNAME'"
    echo "This is normal if the service is not running yet"
fi

echo ""
echo "========================================"
echo "  Hostname Configuration Complete"
echo "========================================"
echo ""
echo "You can now access the application at:"
echo "  http://$HOSTNAME"
echo ""
echo "Note: Other devices on your network need the same"
echo "configuration in their hosts file to use the hostname."
echo ""
echo "For other devices:"
echo "  - Windows: C:\\Windows\\System32\\drivers\\etc\\hosts"
echo "  - Linux/Mac: /etc/hosts"
echo "  - Add line: $IP_ADDRESS $HOSTNAME"
echo ""

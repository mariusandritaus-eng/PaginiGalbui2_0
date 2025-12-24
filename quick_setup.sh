#!/bin/bash
# PaginiGalbui - Quick Setup Script for Emergent Environment
# Usage: bash /app/quick_setup.sh

set -e  # Exit on error

echo "🚀 Starting PaginiGalbui Quick Setup..."
echo ""

# Step 1: Create upload directory
echo "📁 Creating upload directory..."
mkdir -p /app/uploads
chmod 755 /app/uploads
echo "✅ Upload directory created"
echo ""

# Step 2: Create backend .env
echo "⚙️  Creating backend .env file..."
cat > /app/backend/.env << 'EOF'
MONGO_URL=mongodb://localhost:27017
DB_NAME=forensics_db
CORS_ORIGINS=*
ADMIN_USERNAME=admin
ADMIN_PASSWORD=dcco2024
EOF
echo "✅ Backend .env created"
echo ""

# Step 3: Create frontend .env
echo "⚙️  Creating frontend .env file..."
cat > /app/frontend/.env << 'EOF'
REACT_APP_BACKEND_URL=/api
EOF
echo "✅ Frontend .env created"
echo ""

# Step 4: Install backend dependencies
echo "📦 Installing backend dependencies..."
cd /app/backend
pip install -r requirements.txt > /dev/null 2>&1
echo "✅ Backend dependencies installed"
echo ""

# Step 5: Install frontend dependencies
echo "📦 Installing frontend dependencies (this may take 1-2 minutes)..."
cd /app/frontend
yarn install > /dev/null 2>&1
echo "✅ Frontend dependencies installed"
echo ""

# Step 6: Restart all services
echo "🔄 Restarting all services..."
sudo supervisorctl restart all > /dev/null 2>&1
echo "✅ Services restarted"
echo ""

# Step 7: Wait for services to start
echo "⏳ Waiting for services to start (30 seconds)..."
sleep 30
echo ""

# Step 8: Check status
echo "🔍 Checking services status..."
sudo supervisorctl status
echo ""

# Step 9: Test backend
echo "🧪 Testing backend API..."
BACKEND_TEST=$(curl -s http://localhost:8001/api/)
if [[ $BACKEND_TEST == *"Intelligence Database API"* ]]; then
    echo "✅ Backend API is running"
else
    echo "⚠️  Backend API may still be starting..."
fi
echo ""

# Step 10: Test database
echo "🧪 Testing database connection..."
DB_STATS=$(curl -s http://localhost:8001/api/stats)
echo "Database stats: $DB_STATS"
echo ""

echo "✨ Setup Complete!"
echo ""
echo "📍 Access Points:"
echo "   - Frontend: http://localhost:3000"
echo "   - Backend API: http://localhost:8001/api/"
echo "   - API Docs: http://localhost:8001/docs"
echo ""
echo "🔐 Admin Credentials:"
echo "   - Username: admin"
echo "   - Password: dcco2024"
echo ""
echo "📖 Full documentation: /app/EMERGENT_QUICK_SETUP.md"
echo ""
echo "⚡ Frontend may take an additional 10-20 seconds to fully compile."
echo "   Check with: curl -I http://localhost:3000"

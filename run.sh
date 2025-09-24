#!/bin/bash

echo "🚀 Aegis Support - Quick Start"
echo "============================="
echo

echo "1. Installing dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo
echo "2. Starting Docker services..."
docker-compose up -d
if [ $? -ne 0 ]; then
    echo "❌ Failed to start Docker services"
    exit 1
fi

echo
echo "3. Waiting for services to start..."
sleep 30

echo
echo "4. Seeding database (small dataset)..."
npm run seed-small
if [ $? -ne 0 ]; then
    echo "⚠️  Database seeding failed, but continuing..."
fi

echo
echo "5. Starting development servers..."
echo
echo "✅ Setup completed! Starting development servers..."
echo
echo "📱 Frontend: http://localhost:3000"
echo "🔧 Backend: http://localhost:3001"
echo "🏥 Health: http://localhost:3001/health"
echo
echo "Press Ctrl+C to stop the servers"
echo

npm run dev

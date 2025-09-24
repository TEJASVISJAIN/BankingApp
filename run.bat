@echo off
echo 🚀 Aegis Support - Quick Start
echo =============================
echo.

echo 1. Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo 2. Starting Docker services...
call docker-compose up -d
if %errorlevel% neq 0 (
    echo ❌ Failed to start Docker services
    pause
    exit /b 1
)

echo.
echo 3. Waiting for services to start...
timeout /t 30 /nobreak > nul

echo.
echo 4. Seeding database (small dataset)...
call npm run seed-small
if %errorlevel% neq 0 (
    echo ⚠️  Database seeding failed, but continuing...
)

echo.
echo 5. Starting development servers...
echo.
echo ✅ Setup completed! Starting development servers...
echo.
echo 📱 Frontend: http://localhost:3000
echo 🔧 Backend: http://localhost:3001
echo 🏥 Health: http://localhost:3001/health
echo.
echo Press Ctrl+C to stop the servers
echo.

call npm run dev

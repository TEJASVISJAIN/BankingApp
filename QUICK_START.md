# 🚀 Aegis Support - Quick Start Guide

## Windows Setup (3 Commands)

### Option 1: Automated Setup
```cmd
# Run the automated setup script
run.bat
```

### Option 2: Manual Setup
```cmd
# 1. Install dependencies
npm install

# 2. Start services
docker-compose up -d

# 3. Start development
npm run dev
```

## Step-by-Step Manual Setup

### Prerequisites Check
Make sure you have:
- ✅ Node.js 18+ installed
- ✅ Docker Desktop installed and running
- ✅ Git installed

### Step 1: Install Dependencies
```cmd
# Install all dependencies
npm install

# This will install dependencies for:
# - Root project
# - Backend (Express.js + TypeScript)
# - Frontend (React + TypeScript)
# - Scripts (Data generation)
```

### Step 2: Start Infrastructure
```cmd
# Start PostgreSQL and Redis
docker-compose up -d

# Wait for services to be ready (30 seconds)
timeout /t 30
```

### Step 3: Seed Database
```cmd
# Quick seed (10K transactions - recommended for testing)
npm run seed-small

# OR full seed (1M transactions - takes longer)
npm run seed
```

### Step 4: Start Development
```cmd
# Start both backend and frontend
npm run dev

# OR start individually:
# Backend: cd backend && npm run dev
# Frontend: cd frontend && npm run dev
```

## Access Points

Once running, you can access:

- **🎯 Frontend Dashboard**: http://localhost:3000
- **🔧 Backend API**: http://localhost:3001
- **🏥 Health Check**: http://localhost:3001/health
- **📊 Metrics**: http://localhost:3001/metrics
- **🗄️ Database**: localhost:5432 (aegis_support/aegis_user/aegis_password)

## Testing the System

### Test API Endpoints
```cmd
# Test all API endpoints
npm run test-api
```

### Test Database
```cmd
# Connect to database
psql -h localhost -p 5432 -U aegis_user -d aegis_support

# Check transaction count
SELECT COUNT(*) FROM transactions;
```

## Troubleshooting

### Common Issues

#### 1. Docker Not Running
```cmd
# Check if Docker is running
docker --version
docker-compose --version

# If not installed, download Docker Desktop from:
# https://www.docker.com/products/docker-desktop
```

#### 2. Port Conflicts
If ports 3000, 3001, or 5432 are in use:
- Change ports in `docker-compose.yml`
- Update `frontend/vite.config.ts` for frontend port
- Update `backend/src/config.ts` for backend port

#### 3. Database Connection Issues
```cmd
# Check Docker services
docker-compose ps

# View logs
docker-compose logs postgres

# Restart services
docker-compose restart
```

#### 4. Memory Issues
If seeding fails due to memory:
```cmd
# Use smaller dataset
npm run seed-small
```

### Reset Everything
```cmd
# Stop all services
docker-compose down

# Remove volumes (WARNING: This deletes all data)
docker-compose down -v

# Start fresh
docker-compose up -d
npm run seed-small
npm run dev
```

## Development Workflow

### Backend Development
```cmd
cd backend
npm run dev
# API available at http://localhost:3001
```

### Frontend Development
```cmd
cd frontend
npm run dev
# Frontend available at http://localhost:3000
```

### Database Management
```cmd
# Connect to database
psql -h localhost -p 5432 -U aegis_user -d aegis_support

# Useful commands:
\dt                    # List tables
SELECT COUNT(*) FROM transactions;  # Count transactions
\q                     # Quit
```

## What You'll See

### Frontend Dashboard
- 📊 KPIs: Total spend, risk alerts, disputes
- 🚨 Fraud Triage Queue: Real-time alerts
- 👥 Customer Pages: Transaction history and insights
- 📈 Charts: Spend trends and category breakdowns

### Backend API
- 🔐 Authentication: API key-based
- 📊 Insights: Customer spend analysis
- 🗄️ Transactions: Paginated transaction history
- 🏥 Health: Service monitoring

## Next Steps

1. **Explore the Dashboard**: Navigate through different pages
2. **Test Customer Pages**: Click on customer IDs to view details
3. **Check API Endpoints**: Use the health and metrics endpoints
4. **Review Code**: Examine the backend and frontend code structure

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review the logs: `docker-compose logs`
3. Ensure all prerequisites are installed
4. Try the reset procedure if needed

Happy coding! 🎉

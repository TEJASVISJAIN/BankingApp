# Aegis Support - Setup Guide

## Prerequisites
- Node.js 18+ 
- Docker and Docker Compose
- Git

## Quick Start (3 Commands)

```bash
# 1. Install dependencies
npm install

# 2. Start services
docker-compose up -d

# 3. Start development
npm run dev
```

## Detailed Setup

### Step 1: Install Dependencies
```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend && npm install && cd ..

# Install frontend dependencies  
cd frontend && npm install && cd ..

# Install scripts dependencies
cd scripts && npm install && cd ..
```

### Step 2: Start Infrastructure
```bash
# Start PostgreSQL and Redis
docker-compose up -d

# Wait for services to be ready (30 seconds)
sleep 30
```

### Step 3: Seed Database
```bash
# Generate and seed 1M transactions
npm run seed
```

### Step 4: Start Development Servers
```bash
# Start both backend and frontend
npm run dev

# Or start individually:
# Backend: cd backend && npm run dev
# Frontend: cd frontend && npm run dev
```

## Access Points

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **Health Check**: http://localhost:3001/health
- **Metrics**: http://localhost:3001/metrics
- **Database**: localhost:5432 (aegis_support/aegis_user/aegis_password)
- **Redis**: localhost:6379

## Testing

```bash
# Test API endpoints
npm run test-api

# Run evaluations
npm run eval
```

## Troubleshooting

### Database Connection Issues
```bash
# Check if PostgreSQL is running
docker-compose ps

# View logs
docker-compose logs postgres

# Restart services
docker-compose restart
```

### Port Conflicts
- Backend (3001): Change in backend/src/config.ts
- Frontend (3000): Change in frontend/vite.config.ts
- Database (5432): Change in docker-compose.yml

### Memory Issues
- Reduce transaction count in seed script
- Use smaller batch sizes in scripts/src/seed.ts

## Development

### Backend Development
```bash
cd backend
npm run dev
```

### Frontend Development
```bash
cd frontend
npm run dev
```

### Database Management
```bash
# Connect to database
psql -h localhost -p 5432 -U aegis_user -d aegis_support

# View tables
\dt

# Check transaction count
SELECT COUNT(*) FROM transactions;
```

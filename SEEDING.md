# Database Seeding Guide

This guide explains how to seed the database with test data for the Banking App.

## Quick Start

### 1. Start the Services
```bash
# Start all services (PostgreSQL, Redis, Backend, Frontend)
docker-compose up -d

# Or start individual services
docker-compose up -d postgres redis
```

### 2. Install Script Dependencies
```bash
cd scripts
npm install
```

### 3. Seed the Database

#### Option A: Quick Seed (Fastest - Recommended for development)
```bash
# From project root
npm run seed-quick

# Or directly from scripts directory
cd scripts
npm run seed-quick
```

#### Option B: Full Seed with Fixtures (Clears database first)
```bash
# From project root
npm run seed

# Or directly from scripts directory
cd scripts
npm run seed-fixtures
```

#### Option C: Seed with Generated Data
```bash
# Small dataset (1000 records)
npm run seed-small

# Large dataset (1M+ records) - takes longer
npm run seed-large
```

## Seeding Options

### 1. Quick Seed (`npm run seed-quick`) ⚡ **RECOMMENDED**
- **Best for**: Development, quick testing, demos
- **Data source**: `/fixtures/*.json` files
- **Records**: ~5 customers, ~5 transactions (from fixtures)
- **Time**: ~5 seconds
- **Features**: 
  - **No database clearing** - super fast!
  - Uses predefined test data
  - Perfect for development iteration
  - Safe to run multiple times

### 2. Full Fixtures Seeding (`npm run seed`)
- **Best for**: Clean slate, demos, testing
- **Data source**: `/fixtures/*.json` files
- **Records**: ~5 customers, ~5 transactions
- **Time**: ~10 seconds
- **Features**: 
  - **Clears database first** - clean start
  - Uses predefined test data
  - Consistent results across runs
  - Perfect for demos and testing

### 3. Small Generated Data (`npm run seed-small`)
- **Best for**: Quick testing with more data
- **Data source**: Faker.js generated data
- **Records**: ~1000 customers, ~10,000 transactions
- **Time**: ~1 minute
- **Features**:
  - Random but realistic data
  - Good for testing edge cases
  - Smaller dataset for quick iteration

### 4. Large Generated Data (`npm run seed-large`)
- **Best for**: Performance testing, production-like data
- **Data source**: Faker.js generated data
- **Records**: ~100,000 customers, ~1,000,000 transactions
- **Time**: ~10-15 minutes
- **Features**:
  - Production-scale dataset
  - Realistic data distribution
  - Good for performance testing

## Data Structure

### Fixtures Data (`/fixtures/`)
- `customers.json` - Customer profiles with risk flags
- `cards.json` - Credit/debit cards linked to customers
- `transactions.json` - Transaction history with geo data
- `devices.json` - Device information for fraud detection
- `chargebacks.json` - Past dispute records
- `kb_docs.json` - Knowledge base documents for AI agents
- `evals/` - Evaluation test cases for AI system

### Generated Data
- Random but realistic Indian banking data
- Proper MCC codes, merchant names, locations
- Time-series data with realistic patterns
- Risk flags and fraud indicators

## Database Schema

The seeding process populates these tables:
- `customers` - Customer profiles
- `cards` - Payment cards
- `transactions` - Transaction history (partitioned by month)
- `devices` - Device information
- `chargebacks` - Dispute records
- `kb_documents` - Knowledge base

## Troubleshooting

### Clear Database
```bash
# Stop services and remove volumes
docker-compose down -v

# Restart services
docker-compose up -d

# Re-seed
npm run seed
```

### Check Data
```bash
# Connect to database
docker exec -it bankingapp-postgres-1 psql -U aegis_user -d aegis_support

# Check record counts
SELECT 'customers' as table_name, COUNT(*) FROM customers
UNION ALL
SELECT 'transactions', COUNT(*) FROM transactions
UNION ALL
SELECT 'cards', COUNT(*) FROM cards;
```

### Performance Issues
- Use `npm run seed-small` for faster iteration
- Use `npm run seed` (fixtures) for consistent results
- Only use `npm run seed-large` for performance testing

## Environment Variables

The seeding scripts use these environment variables:
```bash
DB_HOST=localhost
DB_PORT=5432
DB_NAME=aegis_support
DB_USER=aegis_user
DB_PASSWORD=aegis_password
```

These are set automatically in the Docker environment.

## Verification

After seeding, verify the data:
1. Check the dashboard at `http://localhost:3000`
2. Look for customers with realistic transaction counts
3. Test the triage analysis on a customer
4. Verify the knowledge base search works

## Next Steps

1. **Start the application**: `docker-compose up -d`
2. **Seed the database**: `npm run seed`
3. **Open the dashboard**: `http://localhost:3000`
4. **Test the triage system**: Click on a customer to run fraud analysis
5. **Explore the data**: Check different customers and their transaction patterns

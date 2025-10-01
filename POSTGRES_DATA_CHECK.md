# How to Check Data in PostgreSQL Docker Container

## 🐳 Quick Access Methods

### Method 1: Direct Docker Exec (Recommended)
```bash
# Connect to the PostgreSQL container
docker exec -it aegis-postgres psql -U aegis_user -d aegis_support

# Once connected, you can run SQL queries
\dt                    # List all tables
\d transactions        # Describe transactions table
SELECT COUNT(*) FROM transactions;  # Count transactions
\q                     # Quit
```

### Method 2: Using Docker Compose
```bash
# If using docker-compose
docker-compose exec postgres psql -U aegis_user -d aegis_support
```

### Method 3: From Host Machine
```bash
# Connect from your host machine (if ports are exposed)
psql -h localhost -p 5432 -U aegis_user -d aegis_support
```

## 📊 Useful SQL Queries for Your Banking App

### Check Database Status
```sql
-- Check if database is running
SELECT version();

-- Check current database
SELECT current_database();

-- Check current user
SELECT current_user;
```

### Check Table Structure
```sql
-- List all tables
\dt

-- Describe specific tables
\d customers
\d transactions
\d cards
\d devices
\d chargebacks
\d actions
\d kb_documents
\d agent_traces
```

### Check Data Counts
```sql
-- Count records in each table
SELECT 'customers' as table_name, COUNT(*) FROM customers
UNION ALL
SELECT 'transactions', COUNT(*) FROM transactions
UNION ALL
SELECT 'cards', COUNT(*) FROM cards
UNION ALL
SELECT 'devices', COUNT(*) FROM devices
UNION ALL
SELECT 'chargebacks', COUNT(*) FROM chargebacks
UNION ALL
SELECT 'actions', COUNT(*) FROM actions
UNION ALL
SELECT 'kb_documents', COUNT(*) FROM kb_documents
UNION ALL
SELECT 'agent_traces', COUNT(*) FROM agent_traces;
```

### Check Transactions Data
```sql
-- Check recent transactions
SELECT 
    id,
    customer_id,
    amount,
    merchant,
    ts,
    mcc
FROM transactions 
ORDER BY ts DESC 
LIMIT 10;

-- Check transactions by customer
SELECT 
    customer_id,
    COUNT(*) as transaction_count,
    SUM(amount) as total_amount,
    MIN(ts) as first_transaction,
    MAX(ts) as last_transaction
FROM transactions 
GROUP BY customer_id 
ORDER BY transaction_count DESC 
LIMIT 10;

-- Check transactions by merchant
SELECT 
    merchant,
    COUNT(*) as transaction_count,
    SUM(amount) as total_amount
FROM transactions 
GROUP BY merchant 
ORDER BY transaction_count DESC 
LIMIT 10;
```

### Check Customer Data
```sql
-- Check customer profiles
SELECT 
    id,
    name,
    email_masked,
    risk_flags,
    created_at
FROM customers 
LIMIT 10;

-- Check customer cards
SELECT 
    c.id as customer_id,
    c.name,
    card.id as card_id,
    card.lastFour,
    card.brand,
    card.status
FROM customers c
JOIN cards card ON c.id = card.customer_id
LIMIT 10;
```

### Check Performance
```sql
-- Check table sizes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check indexes
SELECT 
    indexname,
    tablename,
    indexdef
FROM pg_indexes 
WHERE schemaname = 'public'
ORDER BY tablename;
```

### Check Partitioning
```sql
-- Check transaction partitions
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE tablename LIKE 'transactions_%'
ORDER BY tablename;

-- Check partition data distribution
SELECT 
    table_name,
    partition_name,
    partition_expression
FROM information_schema.table_partitions 
WHERE table_name = 'transactions';
```

## 🔍 Troubleshooting Commands

### Check Container Status
```bash
# Check if container is running
docker ps | grep postgres

# Check container logs
docker logs aegis-postgres

# Check container health
docker inspect aegis-postgres | grep -A 10 "Health"
```

### Check Database Connections
```sql
-- Check active connections
SELECT 
    pid,
    usename,
    application_name,
    client_addr,
    state,
    query_start,
    query
FROM pg_stat_activity 
WHERE datname = 'aegis_support';
```

### Check Database Performance
```sql
-- Check slow queries
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    rows
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;

-- Check table statistics
SELECT 
    schemaname,
    tablename,
    n_tup_ins as inserts,
    n_tup_upd as updates,
    n_tup_del as deletes,
    n_live_tup as live_tuples,
    n_dead_tup as dead_tuples
FROM pg_stat_user_tables 
ORDER BY n_live_tup DESC;
```

## 🚀 Quick Data Verification Script

### Create a verification script
```bash
# Create a script to check all data
cat > check_data.sql << 'EOF'
-- Database status
SELECT 'Database Status' as check_type, current_database() as result;

-- Table counts
SELECT 'Table Counts' as check_type, 
       'customers: ' || COUNT(*) as result FROM customers
UNION ALL
SELECT 'Table Counts', 'transactions: ' || COUNT(*) FROM transactions
UNION ALL
SELECT 'Table Counts', 'cards: ' || COUNT(*) FROM cards
UNION ALL
SELECT 'Table Counts', 'devices: ' || COUNT(*) FROM devices
UNION ALL
SELECT 'Table Counts', 'chargebacks: ' || COUNT(*) FROM chargebacks
UNION ALL
SELECT 'Table Counts', 'actions: ' || COUNT(*) FROM actions
UNION ALL
SELECT 'Table Counts', 'kb_documents: ' || COUNT(*) FROM kb_documents
UNION ALL
SELECT 'Table Counts', 'agent_traces: ' || COUNT(*) FROM agent_traces;

-- Recent transactions
SELECT 'Recent Transactions' as check_type, 
       id || ' - ' || customer_id || ' - ₹' || (amount/100) || ' - ' || merchant as result
FROM transactions 
ORDER BY ts DESC 
LIMIT 5;

-- Customer summary
SELECT 'Customer Summary' as check_type,
       id || ' - ' || name || ' - ' || email_masked as result
FROM customers 
LIMIT 5;
EOF

# Run the verification script
docker exec -i aegis-postgres psql -U aegis_user -d aegis_support < check_data.sql
```

## 📱 Using pgAdmin (Optional)

### Install pgAdmin
```bash
# Add pgAdmin to your docker-compose.yml
services:
  pgadmin:
    image: dpage/pgadmin4
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@admin.com
      PGADMIN_DEFAULT_PASSWORD: admin
    ports:
      - "5050:80"
    depends_on:
      - postgres
```

### Connect to pgAdmin
1. Open http://localhost:5050
2. Login with admin@admin.com / admin
3. Add server:
   - Host: postgres
   - Port: 5432
   - Username: aegis_user
   - Password: aegis_password
   - Database: aegis_support

## 🎯 Common Use Cases

### Check if data was seeded
```bash
# Quick check if data exists
docker exec -it aegis-postgres psql -U aegis_user -d aegis_support -c "SELECT COUNT(*) FROM transactions;"
```

### Check specific customer data
```bash
# Check customer transactions
docker exec -it aegis-postgres psql -U aegis_user -d aegis_support -c "SELECT * FROM transactions WHERE customer_id = 'cust_001' LIMIT 5;"
```

### Check database health
```bash
# Check database health
docker exec -it aegis-postgres psql -U aegis_user -d aegis_support -c "SELECT 'Database is healthy' as status;"
```

### Export data for analysis
```bash
# Export transactions to CSV
docker exec -it aegis-postgres psql -U aegis_user -d aegis_support -c "COPY (SELECT * FROM transactions LIMIT 1000) TO STDOUT WITH CSV HEADER;" > transactions.csv
```

## 🔧 Troubleshooting

### If container is not running
```bash
# Start the container
docker-compose up -d postgres

# Check container status
docker-compose ps
```

### If connection fails
```bash
# Check container logs
docker logs aegis-postgres

# Restart the container
docker-compose restart postgres
```

### If data is missing
```bash
# Re-seed the database
npm run seed-quick

# Or full seed
npm run seed
```

## 📊 Monitoring Commands

### Real-time monitoring
```bash
# Monitor database activity
docker exec -it aegis-postgres psql -U aegis_user -d aegis_support -c "SELECT * FROM pg_stat_activity WHERE state = 'active';"
```

### Check database size
```bash
# Check database size
docker exec -it aegis-postgres psql -U aegis_user -d aegis_support -c "SELECT pg_size_pretty(pg_database_size('aegis_support'));"
```

### Check table sizes
```bash
# Check table sizes
docker exec -it aegis-postgres psql -U aegis_user -d aegis_support -c "SELECT tablename, pg_size_pretty(pg_total_relation_size(tablename)) as size FROM pg_tables WHERE schemaname = 'public' ORDER BY pg_total_relation_size(tablename) DESC;"
```

These commands will help you thoroughly check and monitor your PostgreSQL data in the Docker container for your banking application project!

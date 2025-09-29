#!/usr/bin/env ts-node

import { Pool } from 'pg';

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'aegis_support',
  user: process.env.DB_USER || 'aegis_user',
  password: process.env.DB_PASSWORD || 'aegis_password',
});

export async function setupPartitioning() {
  console.log('🔧 Setting up transaction table partitioning...');
  
  const client = await pool.connect();
  try {
    // Check if transactions table exists and is already partitioned
    const tableCheck = await client.query(`
      SELECT table_name, 
             CASE WHEN relkind = 'p' THEN 'YES' ELSE 'NO' END as is_partitioned
      FROM information_schema.tables t
      LEFT JOIN pg_class c ON c.relname = t.table_name
      WHERE t.table_name = 'transactions' AND t.table_schema = 'public'
    `);
    
    if (tableCheck.rows.length === 0) {
      console.log('📋 Creating partitioned transactions table...');
      
      // Create partitioned transactions table
      await client.query(`
        CREATE TABLE transactions (
          id VARCHAR(50) NOT NULL,
          customer_id VARCHAR(50) NOT NULL,
          card_id VARCHAR(50) NOT NULL,
          mcc VARCHAR(10) NOT NULL,
          merchant VARCHAR(255) NOT NULL,
          amount INTEGER NOT NULL,
          currency VARCHAR(3) NOT NULL DEFAULT 'INR',
          ts TIMESTAMP WITH TIME ZONE NOT NULL,
          device_id VARCHAR(50),
          geo JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          PRIMARY KEY (id, ts)
        ) PARTITION BY RANGE (ts)
      `);
      
      console.log('✅ Created partitioned transactions table');
    } else if (tableCheck.rows[0].is_partitioned === 'NO') {
      console.log('⚠️  Transactions table exists but is not partitioned. Migrating to partitioned table...');
      
      // Create temporary partitioned table
      await client.query(`
        CREATE TABLE transactions_partitioned (
          id VARCHAR(50) NOT NULL,
          customer_id VARCHAR(50) NOT NULL,
          card_id VARCHAR(50) NOT NULL,
          mcc VARCHAR(10) NOT NULL,
          merchant VARCHAR(255) NOT NULL,
          amount INTEGER NOT NULL,
          currency VARCHAR(3) NOT NULL DEFAULT 'INR',
          ts TIMESTAMP WITH TIME ZONE NOT NULL,
          device_id VARCHAR(50),
          geo JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          PRIMARY KEY (id, ts)
        ) PARTITION BY RANGE (ts)
      `);
      
      // Migrate existing data
      await client.query(`
        INSERT INTO transactions_partitioned 
        SELECT id, customer_id, card_id, mcc, merchant, amount, currency, ts, device_id, geo, created_at
        FROM transactions
      `);
      
      // Drop old table and rename
      await client.query('DROP TABLE transactions CASCADE');
      await client.query('ALTER TABLE transactions_partitioned RENAME TO transactions');
      
      console.log('✅ Migrated to partitioned transactions table');
    } else {
      console.log('✅ Transactions table is already partitioned');
    }
    
    // Create monthly partitions for 2024-2025
    console.log('📅 Creating monthly partitions...');
    
    const partitions = [
      { name: 'transactions_2024_01', start: '2024-01-01', end: '2024-02-01' },
      { name: 'transactions_2024_02', start: '2024-02-01', end: '2024-03-01' },
      { name: 'transactions_2024_03', start: '2024-03-01', end: '2024-04-01' },
      { name: 'transactions_2024_04', start: '2024-04-01', end: '2024-05-01' },
      { name: 'transactions_2024_05', start: '2024-05-01', end: '2024-06-01' },
      { name: 'transactions_2024_06', start: '2024-06-01', end: '2024-07-01' },
      { name: 'transactions_2024_07', start: '2024-07-01', end: '2024-08-01' },
      { name: 'transactions_2024_08', start: '2024-08-01', end: '2024-09-01' },
      { name: 'transactions_2024_09', start: '2024-09-01', end: '2024-10-01' },
      { name: 'transactions_2024_10', start: '2024-10-01', end: '2024-11-01' },
      { name: 'transactions_2024_11', start: '2024-11-01', end: '2024-12-01' },
      { name: 'transactions_2024_12', start: '2024-12-01', end: '2025-01-01' },
      { name: 'transactions_2025_01', start: '2025-01-01', end: '2025-02-01' },
      { name: 'transactions_2025_02', start: '2025-02-01', end: '2025-03-01' },
      { name: 'transactions_2025_03', start: '2025-03-01', end: '2025-04-01' },
      { name: 'transactions_2025_04', start: '2025-04-01', end: '2025-05-01' },
      { name: 'transactions_2025_05', start: '2025-05-01', end: '2025-06-01' },
      { name: 'transactions_2025_06', start: '2025-06-01', end: '2025-07-01' },
      { name: 'transactions_2025_07', start: '2025-07-01', end: '2025-08-01' },
      { name: 'transactions_2025_08', start: '2025-08-01', end: '2025-09-01' },
      { name: 'transactions_2025_09', start: '2025-09-01', end: '2025-10-01' },
      { name: 'transactions_2025_10', start: '2025-10-01', end: '2025-11-01' },
      { name: 'transactions_2025_11', start: '2025-11-01', end: '2025-12-01' },
      { name: 'transactions_2025_12', start: '2025-12-01', end: '2026-01-01' }
    ];
    
    for (const partition of partitions) {
      try {
        await client.query(`
          CREATE TABLE IF NOT EXISTS ${partition.name} PARTITION OF transactions
          FOR VALUES FROM ('${partition.start}') TO ('${partition.end}')
        `);
      } catch (error) {
        // Partition might already exist, continue
        console.log(`⚠️  Partition ${partition.name} might already exist`);
      }
    }
    
    console.log('✅ Created monthly partitions');
    
    // Create essential indexes
    console.log('📊 Creating essential indexes...');
    
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_transactions_customer_ts ON transactions (customer_id, ts DESC)',
      'CREATE INDEX IF NOT EXISTS idx_transactions_merchant ON transactions (merchant)',
      'CREATE INDEX IF NOT EXISTS idx_transactions_mcc ON transactions (mcc)',
      'CREATE INDEX IF NOT EXISTS idx_transactions_customer_card ON transactions (customer_id, card_id, ts DESC)',
      'CREATE INDEX IF NOT EXISTS idx_transactions_ts ON transactions (ts DESC)'
    ];
    
    for (const indexQuery of indexes) {
      try {
        await client.query(indexQuery);
      } catch (error) {
        console.log(`⚠️  Index might already exist: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    console.log('✅ Created essential indexes');
    console.log('🎉 Partitioning setup completed successfully!');
    
  } catch (error) {
    console.error('❌ Error setting up partitioning:', error);
    throw error;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  setupPartitioning()
    .then(() => {
      console.log('✅ Partitioning setup completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Partitioning setup failed:', error);
      process.exit(1);
    });
}

#!/usr/bin/env ts-node

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'aegis_support',
  user: process.env.DB_USER || 'aegis_user',
  password: process.env.DB_PASSWORD || 'aegis_password',
});

const FIXTURES_DIR = path.join(__dirname, '../../fixtures');

async function loadFixtureData(filename: string): Promise<any[]> {
  const filePath = path.join(FIXTURES_DIR, filename);
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  Fixture file not found: ${filename}`);
    return [];
  }
  
  const data = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(data);
}

async function seedCustomers() {
  console.log('👥 Seeding customers...');
  const customers = await loadFixtureData('customers.json');
  
  if (customers.length === 0) {
    console.log('⚠️  No customer data found');
    return;
  }

  for (const customer of customers) {
    await pool.query(`
      INSERT INTO customers (id, name, email_masked, risk_flags, created_at, updated_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        email_masked = EXCLUDED.email_masked,
        risk_flags = EXCLUDED.risk_flags,
        updated_at = NOW()
    `, [
      customer.id,
      customer.name,
      customer.email_masked,
      JSON.stringify(customer.risk_flags || [])
    ]);
  }
  
  console.log(`✅ Seeded ${customers.length} customers`);
}

async function seedCards() {
  console.log('💳 Seeding cards...');
  const cards = await loadFixtureData('cards.json');
  
  if (cards.length === 0) {
    console.log('⚠️  No card data found');
    return;
  }

  for (const card of cards) {
    await pool.query(`
      INSERT INTO cards (id, customer_id, last4, status, network, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        customer_id = EXCLUDED.customer_id,
        last4 = EXCLUDED.last4,
        status = EXCLUDED.status,
        network = EXCLUDED.network,
        updated_at = NOW()
    `, [
      card.id,
      card.customerId,
      card.last4,
      card.status,
      card.network
    ]);
  }
  
  console.log(`✅ Seeded ${cards.length} cards`);
}

async function seedDevices() {
  console.log('📱 Seeding devices...');
  const devices = await loadFixtureData('devices.json');
  
  if (devices.length === 0) {
    console.log('⚠️  No device data found');
    return;
  }

  for (const device of devices) {
    await pool.query(`
      INSERT INTO devices (id, customer_id, device_info, last_seen, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (id) DO UPDATE SET
        customer_id = EXCLUDED.customer_id,
        device_info = EXCLUDED.device_info,
        last_seen = EXCLUDED.last_seen
    `, [
      device.id,
      device.customerId,
      JSON.stringify(device.deviceInfo || {}),
      device.lastSeen || new Date().toISOString()
    ]);
  }
  
  console.log(`✅ Seeded ${devices.length} devices`);
}

async function seedTransactions() {
  console.log('💸 Seeding transactions...');
  const transactions = await loadFixtureData('transactions.json');
  
  if (transactions.length === 0) {
    console.log('⚠️  No transaction data found');
    return;
  }

  // Use batch insert for better performance
  const batchSize = 500;
  let processed = 0;
  
  for (let i = 0; i < transactions.length; i += batchSize) {
    const batch = transactions.slice(i, i + batchSize);
    
    // Prepare batch values
    const values = batch.map(txn => [
      txn.id,
      txn.customerId,
      txn.cardId,
      txn.mcc,
      txn.merchant,
      txn.amount,
      txn.ts,
      txn.deviceId,
      JSON.stringify(txn.geo || {})
    ]);
    
    // Create batch insert query
    const placeholders = batch.map((_, index) => {
      const base = index * 9;
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9})`;
    }).join(', ');
    
    const query = `
      INSERT INTO transactions (id, customer_id, card_id, mcc, merchant, amount, ts, device_id, geo)
      VALUES ${placeholders}
      ON CONFLICT (id) DO UPDATE SET
        customer_id = EXCLUDED.customer_id,
        card_id = EXCLUDED.card_id,
        mcc = EXCLUDED.mcc,
        merchant = EXCLUDED.merchant,
        amount = EXCLUDED.amount,
        ts = EXCLUDED.ts,
        device_id = EXCLUDED.device_id,
        geo = EXCLUDED.geo
    `;
    
    await pool.query(query, values.flat());
    
    processed += batch.length;
    console.log(`📊 Processed ${processed}/${transactions.length} transactions...`);
  }
  
  console.log(`✅ Seeded ${transactions.length} transactions`);
}

async function seedChargebacks() {
  console.log('⚖️  Seeding chargebacks...');
  const chargebacks = await loadFixtureData('chargebacks.json');
  
  if (chargebacks.length === 0) {
    console.log('⚠️  No chargeback data found');
    return;
  }

  for (const cb of chargebacks) {
    await pool.query(`
      INSERT INTO chargebacks (id, customer_id, transaction_id, amount, reason_code, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        customer_id = EXCLUDED.customer_id,
        transaction_id = EXCLUDED.transaction_id,
        amount = EXCLUDED.amount,
        reason_code = EXCLUDED.reason_code,
        status = EXCLUDED.status,
        updated_at = NOW()
    `, [
      cb.id,
      cb.customerId,
      cb.transactionId,
      cb.amount,
      cb.reason,
      cb.status
    ]);
  }
  
  console.log(`✅ Seeded ${chargebacks.length} chargebacks`);
}

async function seedKnowledgeBase() {
  console.log('📚 Seeding knowledge base...');
  const kbDocs = await loadFixtureData('kb_docs.json');
  
  if (kbDocs.length === 0) {
    console.log('⚠️  No knowledge base data found');
    return;
  }

  for (const doc of kbDocs) {
    // Concatenate chunks into content
    const content = doc.chunks ? doc.chunks.join('\n\n') : '';
    
    await pool.query(`
      INSERT INTO kb_documents (id, title, content, anchor, chunks, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        content = EXCLUDED.content,
        anchor = EXCLUDED.anchor,
        chunks = EXCLUDED.chunks,
        updated_at = NOW()
    `, [
      doc.id,
      doc.title,
      content,
      doc.anchor || '',
      JSON.stringify(doc.chunks || [])
    ]);
  }
  
  console.log(`✅ Seeded ${kbDocs.length} knowledge base documents`);
}

async function main() {
  try {
    console.log('🚀 Quick database seeding (no clearing)...');
    
    // Seed in dependency order (no clearing)
    await seedCustomers();
    await seedCards();
    await seedDevices();
    await seedTransactions();
    await seedChargebacks();
    await seedKnowledgeBase();
    
    console.log('🎉 Quick seeding completed successfully!');
    
    // Show summary
    const customerCount = await pool.query('SELECT COUNT(*) FROM customers');
    const transactionCount = await pool.query('SELECT COUNT(*) FROM transactions');
    const cardCount = await pool.query('SELECT COUNT(*) FROM cards');
    
    console.log('\n📊 Database Summary:');
    console.log(`👥 Customers: ${customerCount.rows[0].count}`);
    console.log(`💳 Cards: ${cardCount.rows[0].count}`);
    console.log(`💸 Transactions: ${transactionCount.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();

#!/usr/bin/env ts-node

import { Pool } from 'pg';
import { faker } from '@faker-js/faker';
import { v4 as uuidv4 } from 'uuid';
import { setupPartitioning } from './setup-partitioning';

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'aegis_support',
  user: process.env.DB_USER || 'aegis_user',
  password: process.env.DB_PASSWORD || 'aegis_password',
});

// MCC codes for different merchant categories
const MCC_CODES = [
  '5411', // Grocery stores
  '5812', // Restaurants
  '5541', // Gas stations
  '5311', // Department stores
  '5999', // Miscellaneous retail
  '6011', // ATM withdrawals
  '6012', // Financial institutions
  '7011', // Hotels
  '4111', // Transportation
  '5814', // Fast food
];

// Indian cities with coordinates
const INDIAN_CITIES = [
  { name: 'Mumbai', lat: 19.0760, lon: 72.8777 },
  { name: 'Delhi', lat: 28.7041, lon: 77.1025 },
  { name: 'Bangalore', lat: 12.9716, lon: 77.5946 },
  { name: 'Chennai', lat: 13.0827, lon: 80.2707 },
  { name: 'Kolkata', lat: 22.5726, lon: 88.3639 },
  { name: 'Hyderabad', lat: 17.3850, lon: 78.4867 },
  { name: 'Pune', lat: 18.5204, lon: 73.8567 },
  { name: 'Ahmedabad', lat: 23.0225, lon: 72.5714 },
  { name: 'Jaipur', lat: 26.9124, lon: 75.7873 },
  { name: 'Surat', lat: 21.1702, lon: 72.8311 },
];

// Popular Indian merchants
const MERCHANTS = [
  'Reliance Digital', 'Croma', 'Vijay Sales', 'Spencer\'s', 'Big Bazaar',
  'Pizza Hut', 'Domino\'s', 'KFC', 'McDonald\'s', 'Subway', 'Taco Bell',
  'Swiggy', 'Zomato', 'Ola', 'Uber', 'Netflix', 'Spotify', 'Amazon',
  'Flipkart', 'Myntra', 'Paytm', 'PhonePe', 'Google Pay', 'Marriott',
  'ITC Hotels', 'Taj Hotels', 'Indian Oil', 'HP', 'Bharat Petroleum',
  'NEFT', 'IMPS', 'UPI', 'Cash Withdrawal', 'Bus', 'Train', 'Metro',
  'Pantaloons', 'Dunkin\'', 'Starbucks', 'Cafe Coffee Day'
];

async function createCustomers(count: number) {
  console.log(`Creating ${count} customers...`);
  const client = await pool.connect();
  try {
    const customers = [];
    for (let i = 0; i < count; i++) {
        const customer = {
          id: `cust_${String(i + 1).padStart(3, '0')}`,
          name: faker.person.fullName(),
          email_masked: faker.internet.email().replace(/(.{2}).*(@.*)/, '$1***$2'),
          risk_flags: JSON.stringify(faker.helpers.arrayElements(['high_velocity', 'new_merchant', 'geo_anomaly', 'device_change'], { min: 0, max: 3 })),
          created_at: faker.date.past({ years: 2 }),
          updated_at: new Date(),
        };
      customers.push(customer);
    }

    await client.query(`
      INSERT INTO customers (id, name, email_masked, risk_flags, created_at, updated_at)
      VALUES ${customers.map((_, i) => `($${i * 6 + 1}, $${i * 6 + 2}, $${i * 6 + 3}, $${i * 6 + 4}, $${i * 6 + 5}, $${i * 6 + 6})`).join(', ')}
      ON CONFLICT (id) DO NOTHING
    `, customers.flatMap(c => [c.id, c.name, c.email_masked, c.risk_flags, c.created_at, c.updated_at]));

    console.log(`✅ Created ${count} customers`);
  } finally {
    client.release();
  }
}

async function createCards(customerCount: number, cardsPerCustomer: number) {
  console.log(`Creating ${customerCount * cardsPerCustomer} cards...`);
  const client = await pool.connect();
  try {
    const cards = [];
    for (let i = 0; i < customerCount; i++) {
      for (let j = 0; j < cardsPerCustomer; j++) {
        const card = {
          id: `card_${String(i + 1).padStart(3, '0')}_${j + 1}`,
          customer_id: `cust_${String(i + 1).padStart(3, '0')}`,
          card_number: faker.finance.creditCardNumber().replace(/\D/g, '').slice(0, 16),
          expiry_month: faker.number.int({ min: 1, max: 12 }),
          expiry_year: faker.number.int({ min: 2025, max: 2030 }),
          cvv: faker.finance.creditCardCVV(),
          card_type: faker.helpers.arrayElement(['Visa', 'Mastercard', 'RuPay']),
          status: faker.helpers.arrayElement(['active', 'blocked', 'expired']),
          created_at: faker.date.past({ years: 2 }),
          updated_at: new Date(),
        };
        cards.push(card);
      }
    }

    await client.query(`
      INSERT INTO cards (id, customer_id, card_number, expiry_month, expiry_year, cvv, card_type, status, created_at, updated_at)
      VALUES ${cards.map((_, i) => `($${i * 10 + 1}, $${i * 10 + 2}, $${i * 10 + 3}, $${i * 10 + 4}, $${i * 10 + 5}, $${i * 10 + 6}, $${i * 10 + 7}, $${i * 10 + 8}, $${i * 10 + 9}, $${i * 10 + 10})`).join(', ')}
      ON CONFLICT (id) DO NOTHING
    `, cards.flatMap(c => [c.id, c.customer_id, c.card_number, c.expiry_month, c.expiry_year, c.cvv, c.card_type, c.status, c.created_at, c.updated_at]));

    console.log(`✅ Created ${cards.length} cards`);
  } finally {
    client.release();
  }
}

async function createDevices(customerCount: number) {
  console.log(`Creating devices for ${customerCount} customers...`);
  const client = await pool.connect();
  try {
    const devices = [];
    for (let i = 0; i < customerCount; i++) {
      const deviceCount = faker.number.int({ min: 1, max: 3 });
      for (let j = 0; j < deviceCount; j++) {
        const device = {
          id: `device_${String(i + 1).padStart(3, '0')}_${j + 1}`,
          customer_id: `cust_${String(i + 1).padStart(3, '0')}`,
          device_type: faker.helpers.arrayElement(['mobile', 'laptop', 'tablet', 'desktop']),
          os: faker.helpers.arrayElement(['Android', 'iOS', 'Windows', 'macOS', 'Linux']),
          browser: faker.helpers.arrayElement(['Chrome', 'Safari', 'Firefox', 'Edge']),
          ip_address: faker.internet.ip(),
          user_agent: faker.internet.userAgent(),
          created_at: faker.date.past({ years: 2 }),
          updated_at: new Date(),
        };
        devices.push(device);
      }
    }

    await client.query(`
      INSERT INTO devices (id, customer_id, device_type, os, browser, ip_address, user_agent, created_at, updated_at)
      VALUES ${devices.map((_, i) => `($${i * 9 + 1}, $${i * 9 + 2}, $${i * 9 + 3}, $${i * 9 + 4}, $${i * 9 + 5}, $${i * 9 + 6}, $${i * 9 + 7}, $${i * 9 + 8}, $${i * 9 + 9})`).join(', ')}
      ON CONFLICT (id) DO NOTHING
    `, devices.flatMap(d => [d.id, d.customer_id, d.device_type, d.os, d.browser, d.ip_address, d.user_agent, d.created_at, d.updated_at]));

    console.log(`✅ Created ${devices.length} devices`);
  } finally {
    client.release();
  }
}

async function createKnowledgeBase() {
  console.log('Creating knowledge base documents...');
  const client = await pool.connect();
  try {
    const kbDocs = [
      {
        id: 'kb_001',
        title: 'Fraud Detection Guidelines',
        content: 'Comprehensive guidelines for detecting and preventing fraud in banking transactions.',
        category: 'fraud_prevention',
        tags: ['fraud', 'detection', 'prevention'],
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 'kb_002',
        title: 'Customer Verification Process',
        content: 'Step-by-step process for verifying customer identity and transaction authenticity.',
        category: 'verification',
        tags: ['verification', 'identity', 'customer'],
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 'kb_003',
        title: 'Risk Assessment Framework',
        content: 'Framework for assessing and managing risk in financial transactions.',
        category: 'risk_management',
        tags: ['risk', 'assessment', 'management'],
        created_at: new Date(),
        updated_at: new Date(),
      },
    ];

    await client.query(`
      INSERT INTO kb_documents (id, title, content, category, tags, created_at, updated_at)
      VALUES ${kbDocs.map((_, i) => `($${i * 7 + 1}, $${i * 7 + 2}, $${i * 7 + 3}, $${i * 7 + 4}, $${i * 7 + 5}, $${i * 7 + 6}, $${i * 7 + 7})`).join(', ')}
      ON CONFLICT (id) DO NOTHING
    `, kbDocs.flatMap(doc => [doc.id, doc.title, doc.content, doc.category, doc.tags, doc.created_at, doc.updated_at]));

    console.log('✅ Created 3 knowledge base documents');
  } finally {
    client.release();
  }
}

async function createTransactions(count: number) {
  console.log(`Creating ${count} transactions...`);
  const client = await pool.connect();
  try {
    const batchSize = 1000;
    const totalBatches = Math.ceil(count / batchSize);
    
    for (let batch = 0; batch < totalBatches; batch++) {
      const currentBatchSize = Math.min(batchSize, count - batch * batchSize);
      const transactions = [];
      
      for (let i = 0; i < currentBatchSize; i++) {
        const customerId = `cust_${String(faker.number.int({ min: 1, max: 100 })).padStart(3, '0')}`;
        const cardId = `card_${customerId}_${faker.number.int({ min: 1, max: 2 })}`;
        const deviceId = `device_${customerId}_${faker.number.int({ min: 1, max: 3 })}`;
        const city = faker.helpers.arrayElement(INDIAN_CITIES);
        const merchant = faker.helpers.arrayElement(MERCHANTS);
        const mcc = faker.helpers.arrayElement(MCC_CODES);
        
        // Generate transaction amount (in paise)
        const amount = faker.number.int({ min: 100, max: 1000000 }); // ₹1 to ₹10,000
        
        const transaction = {
          id: `txn_${String(batch * batchSize + i + 1).padStart(5, '0')}`,
          customer_id: customerId,
          card_id: cardId,
          mcc: mcc,
          merchant: merchant,
          amount: amount,
          currency: 'INR',
          ts: faker.date.between({ from: '2024-01-01', to: '2025-09-29' }),
          device_id: deviceId,
          geo: {
            lat: city.lat + (faker.number.float({ min: -0.1, max: 0.1 })),
            lon: city.lon + (faker.number.float({ min: -0.1, max: 0.1 })),
            country: 'IN',
            city: city.name,
          },
          created_at: new Date(),
        };
        transactions.push(transaction);
      }

      await client.query(`
        INSERT INTO transactions (id, customer_id, card_id, mcc, merchant, amount, currency, ts, device_id, geo, created_at)
        VALUES ${transactions.map((_, i) => `($${i * 11 + 1}, $${i * 11 + 2}, $${i * 11 + 3}, $${i * 11 + 4}, $${i * 11 + 5}, $${i * 11 + 6}, $${i * 11 + 7}, $${i * 11 + 8}, $${i * 11 + 9}, $${i * 11 + 10}, $${i * 11 + 11})`).join(', ')}
        ON CONFLICT (id, ts) DO NOTHING
      `, transactions.flatMap(t => [t.id, t.customer_id, t.card_id, t.mcc, t.merchant, t.amount, t.currency, t.ts, t.device_id, JSON.stringify(t.geo), t.created_at]));

      console.log(`Processing batch ${batch + 1}/${totalBatches} (${currentBatchSize} transactions)`);
    }

    console.log(`✅ Created ${count} transactions`);
  } finally {
    client.release();
  }
}

async function main() {
  try {
    console.log('🌱 Starting database seeding (100K transactions)...');
    console.log('📊 Total records to be created:');
    console.log('   • 100 customers');
    console.log('   • 200 cards (2 per customer)');
    console.log('   • ~200 devices (1-3 per customer)');
    console.log('   • 100,000 transactions');
    console.log('   • 3 knowledge base documents');
    console.log('');
    
    // Setup partitioning first
    await setupPartitioning();
    
    const startTime = Date.now();
    let step = 1;
    const totalSteps = 5;
    
    // Create base data
    console.log(`[${step}/${totalSteps}] Creating customers...`);
    await createCustomers(100);
    step++;
    
    console.log(`[${step}/${totalSteps}] Creating cards...`);
    await createCards(100, 2);
    step++;
    
    console.log(`[${step}/${totalSteps}] Creating devices...`);
    await createDevices(100);
    step++;
    
    console.log(`[${step}/${totalSteps}] Creating knowledge base...`);
    await createKnowledgeBase();
    step++;
    
    console.log(`[${step}/${totalSteps}] Creating transactions...`);
    await createTransactions(100000);
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    console.log('✅ Database seeding completed successfully!');
    console.log(`⏱️  Total time: ${duration.toFixed(2)} seconds`);
    console.log('\n📊 Summary:');
    console.log('- 100 customers');
    console.log('- 200 cards');
    console.log('- ~200 devices');
    console.log('- 100,000 transactions');
    console.log('- 3 knowledge base documents');
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the seeding
if (require.main === module) {
  main().catch(console.error);
}

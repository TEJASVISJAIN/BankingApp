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
  { name: 'Delhi', lat: 28.6139, lon: 77.2090 },
  { name: 'Bangalore', lat: 12.9716, lon: 77.5946 },
  { name: 'Chennai', lat: 13.0827, lon: 80.2707 },
  { name: 'Kolkata', lat: 22.5726, lon: 88.3639 },
  { name: 'Hyderabad', lat: 17.3850, lon: 78.4867 },
  { name: 'Pune', lat: 18.5204, lon: 73.8567 },
  { name: 'Ahmedabad', lat: 23.0225, lon: 72.5714 },
];

// Merchant names by category
const MERCHANT_CATEGORIES = {
  '5411': ['Big Bazaar', 'Reliance Fresh', 'DMart', 'More', 'Spencer\'s'],
  '5812': ['McDonald\'s', 'KFC', 'Domino\'s', 'Pizza Hut', 'Subway'],
  '5541': ['Indian Oil', 'HP', 'Bharat Petroleum', 'Shell'],
  '5311': ['Shoppers Stop', 'Lifestyle', 'Pantaloons', 'Westside'],
  '5999': ['Amazon', 'Flipkart', 'Myntra', 'Nykaa'],
  '6011': ['ATM Withdrawal', 'Cash Withdrawal'],
  '6012': ['Bank Transfer', 'UPI Payment', 'NEFT'],
  '7011': ['Taj Hotels', 'Oberoi', 'ITC Hotels', 'Marriott'],
  '4111': ['Uber', 'Ola', 'Metro', 'Bus'],
  '5814': ['Burger King', 'Wendy\'s', 'Taco Bell', 'Dunkin\''],
};

async function createCustomers(count: number) {
  console.log(`Creating ${count} customers...`);
  
  const customers = [];
  for (let i = 0; i < count; i++) {
    const customer = {
      id: `cust_${String(i + 1).padStart(3, '0')}`,
      name: faker.person.fullName(),
      email_masked: faker.internet.email().replace(/(.{3}).*(@.*)/, '$1***$2'),
      risk_flags: faker.datatype.boolean(0.1) ? ['high_risk_customer'] : [],
    };
    customers.push(customer);
  }
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    for (const customer of customers) {
      await client.query(
        'INSERT INTO customers (id, name, email_masked, risk_flags) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING',
        [customer.id, customer.name, customer.email_masked, JSON.stringify(customer.risk_flags)]
      );
    }
    
    await client.query('COMMIT');
    console.log(`✅ Created ${customers.length} customers`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function createCards(customerCount: number, cardsPerCustomer: number = 2) {
  console.log(`Creating cards for ${customerCount} customers...`);
  
  const cards = [];
  for (let i = 1; i <= customerCount; i++) {
    for (let j = 1; j <= cardsPerCustomer; j++) {
      const card = {
        id: `card_${String((i - 1) * cardsPerCustomer + j).padStart(3, '0')}`,
        customer_id: `cust_${String(i).padStart(3, '0')}`,
        last4: faker.finance.creditCardNumber().slice(-4),
        status: faker.helpers.arrayElement(['active', 'blocked', 'expired']),
        network: faker.helpers.arrayElement(['VISA', 'MASTERCARD', 'RUPAY']),
      };
      cards.push(card);
    }
  }
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    for (const card of cards) {
      await client.query(
        'INSERT INTO cards (id, customer_id, last4, status, network) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING',
        [card.id, card.customer_id, card.last4, card.status, card.network]
      );
    }
    
    await client.query('COMMIT');
    console.log(`✅ Created ${cards.length} cards`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function createTransactions(transactionCount: number) {
  console.log(`Creating ${transactionCount} transactions...`);
  
  const batchSize = 100; // Smaller batches for faster processing
  const batches = Math.ceil(transactionCount / batchSize);
  
  for (let batch = 0; batch < batches; batch++) {
    const startIdx = batch * batchSize;
    const endIdx = Math.min(startIdx + batchSize, transactionCount);
    const batchSizeActual = endIdx - startIdx;
    
    console.log(`Processing batch ${batch + 1}/${batches} (${startIdx + 1}-${endIdx})`);
    
    const transactions = [];
    for (let i = startIdx; i < endIdx; i++) {
      const mcc = faker.helpers.arrayElement(MCC_CODES);
      const merchants = MERCHANT_CATEGORIES[mcc as keyof typeof MERCHANT_CATEGORIES] || ['Generic Merchant'];
      const merchant = faker.helpers.arrayElement(merchants);
      
      const city = faker.helpers.arrayElement(INDIAN_CITIES);
      const amount = faker.datatype.number({ min: -50000, max: 100000 }); // -500 to 1000 INR
      
      const transaction = {
        id: `txn_${String(i + 1).padStart(5, '0')}`,
        customer_id: `cust_${String(faker.datatype.number({ min: 1, max: 50 })).padStart(3, '0')}`,
        card_id: `card_${String(faker.datatype.number({ min: 1, max: 100 })).padStart(3, '0')}`,
        mcc,
        merchant,
        amount,
        currency: 'INR',
        ts: faker.date.between({ from: '2024-01-01', to: '2025-06-30' }),
        device_id: `dev_${faker.datatype.number({ min: 1, max: 20 })}`,
        geo: {
          lat: city.lat + (Math.random() - 0.5) * 0.1,
          lon: city.lon + (Math.random() - 0.5) * 0.1,
          country: 'IN',
          city: city.name,
        },
      };
      transactions.push(transaction);
    }
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      for (const txn of transactions) {
        await client.query(
          `INSERT INTO transactions (id, customer_id, card_id, mcc, merchant, amount, currency, ts, device_id, geo) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
           ON CONFLICT (id, ts) DO NOTHING`,
          [
            txn.id,
            txn.customer_id,
            txn.card_id,
            txn.mcc,
            txn.merchant,
            txn.amount,
            txn.currency,
            txn.ts,
            txn.device_id,
            JSON.stringify(txn.geo),
          ]
        );
      }
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  console.log(`✅ Created ${transactionCount} transactions`);
}

async function createDevices(customerCount: number) {
  console.log(`Creating devices for ${customerCount} customers...`);
  
  const devices = [];
  for (let i = 1; i <= customerCount; i++) {
    const deviceCount = faker.datatype.number({ min: 1, max: 2 });
    for (let j = 1; j <= deviceCount; j++) {
      const device = {
        id: `dev_${String((i - 1) * 2 + j).padStart(2, '0')}`,
        customer_id: `cust_${String(i).padStart(3, '0')}`,
        device_type: faker.helpers.arrayElement(['mobile', 'desktop', 'tablet']),
        device_info: {
          os: faker.helpers.arrayElement(['Android', 'iOS', 'Windows', 'macOS']),
          browser: faker.helpers.arrayElement(['Chrome', 'Safari', 'Firefox', 'Edge']),
          ip: faker.internet.ip(),
        },
        last_seen: faker.date.recent({ days: 30 }),
      };
      devices.push(device);
    }
  }
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    for (const device of devices) {
      await client.query(
        'INSERT INTO devices (id, customer_id, device_type, device_info, last_seen) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING',
        [device.id, device.customer_id, device.device_type, JSON.stringify(device.device_info), device.last_seen]
      );
    }
    
    await client.query('COMMIT');
    console.log(`✅ Created ${devices.length} devices`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function createKnowledgeBase() {
  console.log('Creating knowledge base documents...');
  
  const kbDocs = [
    {
      id: 'kb_001',
      title: 'Card Freeze Process',
      anchor: 'card_freeze',
      content: 'To freeze a card, verify customer identity, check for recent transactions, and confirm the freeze request. Always require OTP verification for security.',
      chunks: ['card_freeze_process', 'otp_verification', 'security_checks'],
    },
    {
      id: 'kb_002', 
      title: 'Dispute Resolution',
      anchor: 'dispute_process',
      content: 'For unauthorized transactions, gather transaction details, verify customer identity, and open a dispute with appropriate reason codes. Common codes: 10.4 for unauthorized, 10.5 for duplicate.',
      chunks: ['dispute_process', 'reason_codes', 'unauthorized_transactions'],
    },
    {
      id: 'kb_003',
      title: 'Travel Notice',
      anchor: 'travel_notice',
      content: 'Customers can set travel notices for international transactions. This helps prevent false fraud alerts during legitimate travel.',
      chunks: [
        'Customers can set travel notices for international transactions',
        'Travel notices help prevent false fraud alerts',
        'Valid for up to 90 days',
        'Can be set via mobile app or customer service'
      ]
    },
  ];
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    for (const doc of kbDocs) {
      await client.query(
        'INSERT INTO kb_documents (id, title, anchor, content, chunks) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING',
        [doc.id, doc.title, doc.anchor, doc.content, JSON.stringify(doc.chunks)]
      );
    }
    
    await client.query('COMMIT');
    console.log(`✅ Created ${kbDocs.length} knowledge base documents`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  try {
    console.log('🌱 Starting database seeding (small dataset)...');
    
    // Setup partitioning first
    await setupPartitioning();
    
    // Create base data with smaller numbers for faster setup
    await createCustomers(50); // 50 customers instead of 100
    await createCards(50, 2);
    await createDevices(50);
    await createKnowledgeBase();
    
    // Create 10K transactions instead of 1M for faster setup
    await createTransactions(10000);
    
    console.log('✅ Database seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log('- 50 customers');
    console.log('- 100 cards');
    console.log('- 100 devices');
    console.log('- 10,000 transactions');
    console.log('- 3 knowledge base documents');
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main();
}

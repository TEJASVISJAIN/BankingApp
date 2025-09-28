import { Pool } from 'pg';

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'aegis_support',
  user: 'aegis_user',
  password: 'aegis_password',
});

async function seedAdditionalData() {
  console.log('🌱 Adding additional test data...');
  
  try {
    // Add more transactions for existing customers
    const additionalTransactions = [
      {
        id: 'txn_01002',
        customerId: 'cust_001',
        cardId: 'card_001',
        mcc: '5411',
        merchant: 'Grocery Store',
        amount: 25000, // ₹250
        ts: new Date('2025-06-12T10:30:00Z'),
        deviceId: 'dev_01',
        geo: { lat: 28.61, lon: 77.21, country: 'IN', city: 'Delhi' }
      },
      {
        id: 'txn_01003',
        customerId: 'cust_001',
        cardId: 'card_001',
        mcc: '5812',
        merchant: 'Restaurant',
        amount: 15000, // ₹150
        ts: new Date('2025-06-11T19:45:00Z'),
        deviceId: 'dev_01',
        geo: { lat: 28.61, lon: 77.21, country: 'IN', city: 'Delhi' }
      },
      {
        id: 'txn_01004',
        customerId: 'cust_002',
        cardId: 'card_002',
        mcc: '6011',
        merchant: 'ATM Withdrawal',
        amount: -20000, // -₹200
        ts: new Date('2025-06-13T14:20:00Z'),
        deviceId: 'dev_02',
        geo: { lat: 19.07, lon: 72.87, country: 'IN', city: 'Mumbai' }
      },
      {
        id: 'txn_01005',
        customerId: 'cust_002',
        cardId: 'card_002',
        mcc: '5411',
        merchant: 'Supermarket',
        amount: 35000, // ₹350
        ts: new Date('2025-06-12T16:15:00Z'),
        deviceId: 'dev_02',
        geo: { lat: 19.07, lon: 72.87, country: 'IN', city: 'Mumbai' }
      },
      {
        id: 'txn_01006',
        customerId: 'cust_003',
        cardId: 'card_003',
        mcc: '5814',
        merchant: 'Fast Food',
        amount: 8000, // ₹80
        ts: new Date('2025-06-13T12:30:00Z'),
        deviceId: 'dev_03',
        geo: { lat: 12.97, lon: 77.59, country: 'IN', city: 'Bangalore' }
      },
      {
        id: 'txn_01007',
        customerId: 'cust_003',
        cardId: 'card_003',
        mcc: '6011',
        merchant: 'ATM Withdrawal',
        amount: -15000, // -₹150
        ts: new Date('2025-06-11T09:20:00Z'),
        deviceId: 'dev_03',
        geo: { lat: 12.97, lon: 77.59, country: 'IN', city: 'Bangalore' }
      },
      {
        id: 'txn_01008',
        customerId: 'cust_004',
        cardId: 'card_004',
        mcc: '5411',
        merchant: 'Department Store',
        amount: 45000, // ₹450
        ts: new Date('2025-06-10T15:45:00Z'),
        deviceId: 'dev_04',
        geo: { lat: 22.57, lon: 88.36, country: 'IN', city: 'Kolkata' }
      },
      {
        id: 'txn_01009',
        customerId: 'cust_004',
        cardId: 'card_004',
        mcc: '5812',
        merchant: 'Fine Dining',
        amount: 120000, // ₹1200
        ts: new Date('2025-06-09T20:00:00Z'),
        deviceId: 'dev_04',
        geo: { lat: 22.57, lon: 88.36, country: 'IN', city: 'Kolkata' }
      },
      {
        id: 'txn_01010',
        customerId: 'cust_005',
        cardId: 'card_005',
        mcc: '6011',
        merchant: 'ATM Withdrawal',
        amount: -50000, // -₹500
        ts: new Date('2025-06-13T11:15:00Z'),
        deviceId: 'dev_05',
        geo: { lat: 13.08, lon: 80.27, country: 'IN', city: 'Chennai' }
      },
      {
        id: 'txn_01011',
        customerId: 'cust_005',
        cardId: 'card_005',
        mcc: '5411',
        merchant: 'Electronics Store',
        amount: 250000, // ₹2500
        ts: new Date('2025-06-08T14:30:00Z'),
        deviceId: 'dev_05',
        geo: { lat: 13.08, lon: 80.27, country: 'IN', city: 'Chennai' }
      }
    ];

    // Insert additional transactions
    for (const txn of additionalTransactions) {
      await pool.query(`
        INSERT INTO transactions (id, customer_id, card_id, mcc, merchant, amount, ts, device_id, geo)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO UPDATE SET
          customer_id = EXCLUDED.customer_id,
          card_id = EXCLUDED.card_id,
          mcc = EXCLUDED.mcc,
          merchant = EXCLUDED.merchant,
          amount = EXCLUDED.amount,
          ts = EXCLUDED.ts,
          device_id = EXCLUDED.device_id,
          geo = EXCLUDED.geo
      `, [
        txn.id,
        txn.customerId,
        txn.cardId,
        txn.mcc,
        txn.merchant,
        txn.amount,
        txn.ts,
        txn.deviceId,
        JSON.stringify(txn.geo)
      ]);
    }

    console.log(`✅ Added ${additionalTransactions.length} additional transactions`);

    // Add some chargebacks for testing
    const additionalChargebacks = [
      {
        id: 'cb_002',
        customerId: 'cust_002',
        transactionId: 'txn_01004',
        amount: 20000,
        reason_code: 'fraud',
        status: 'pending'
      },
      {
        id: 'cb_003',
        customerId: 'cust_003',
        transactionId: 'txn_01007',
        amount: 15000,
        reason_code: 'unauth',
        status: 'resolved'
      }
    ];

    for (const cb of additionalChargebacks) {
      await pool.query(`
        INSERT INTO chargebacks (id, customer_id, transaction_id, amount, reason_code, status)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO UPDATE SET
          customer_id = EXCLUDED.customer_id,
          transaction_id = EXCLUDED.transaction_id,
          amount = EXCLUDED.amount,
          reason_code = EXCLUDED.reason_code,
          status = EXCLUDED.status
      `, [cb.id, cb.customerId, cb.transactionId, cb.amount, cb.reason_code, cb.status]);
    }

    console.log(`✅ Added ${additionalChargebacks.length} additional chargebacks`);

    // Get final counts
    const customerCount = await pool.query('SELECT COUNT(*) FROM customers');
    const transactionCount = await pool.query('SELECT COUNT(*) FROM transactions');
    const chargebackCount = await pool.query('SELECT COUNT(*) FROM chargebacks');

    console.log('\n📊 Final Database Summary:');
    console.log(`👥 Customers: ${customerCount.rows[0].count}`);
    console.log(`💸 Transactions: ${transactionCount.rows[0].count}`);
    console.log(`⚖️  Chargebacks: ${chargebackCount.rows[0].count}`);

  } catch (error) {
    console.error('❌ Error seeding additional data:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

seedAdditionalData().catch(console.error);

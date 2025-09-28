import { Pool } from 'pg';

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'aegis_support',
  user: 'aegis_user',
  password: 'aegis_password',
});

async function fixTransactionDates() {
  console.log('🕒 Fixing transaction dates to be recent...');
  
  try {
    // Update all transactions to have recent dates (last 30 days)
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    
    // Update transactions with dates in the last 30 days
    const updates = [
      { id: 'txn_01001', daysAgo: 1 },
      { id: 'txn_01002', daysAgo: 2 },
      { id: 'txn_01003', daysAgo: 3 },
      { id: 'txn_01004', daysAgo: 1 },
      { id: 'txn_01005', daysAgo: 2 },
      { id: 'txn_01006', daysAgo: 1 },
      { id: 'txn_01007', daysAgo: 3 },
      { id: 'txn_01008', daysAgo: 4 },
      { id: 'txn_01009', daysAgo: 5 },
      { id: 'txn_01010', daysAgo: 1 },
      { id: 'txn_01011', daysAgo: 6 }
    ];

    for (const update of updates) {
      const newDate = new Date(now.getTime() - (update.daysAgo * 24 * 60 * 60 * 1000));
      
      await pool.query(`
        UPDATE transactions 
        SET ts = $1 
        WHERE id = $2
      `, [newDate, update.id]);
    }

    console.log(`✅ Updated ${updates.length} transaction dates`);

    // Verify the updates
    const result = await pool.query(`
      SELECT id, ts, customer_id 
      FROM transactions 
      ORDER BY ts DESC
    `);

    console.log('\n📊 Updated Transaction Dates:');
    result.rows.forEach(row => {
      console.log(`${row.id}: ${row.ts.toISOString()} (${row.customer_id})`);
    });

  } catch (error) {
    console.error('❌ Error fixing transaction dates:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

fixTransactionDates().catch(console.error);

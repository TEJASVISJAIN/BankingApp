import { query, withTransaction } from '../utils/database';
import { secureLogger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface Transaction {
  id: string;
  customerId: string;
  cardId: string;
  mcc: string;
  merchant: string;
  amount: number;
  currency: string;
  ts: string;
  deviceId?: string;
  geo?: any;
}

export interface Customer {
  id: string;
  name: string;
  email_masked: string;
  risk_flags?: string[];
}

export interface Card {
  id: string;
  customerId: string;
  last4: string;
  status: string;
  network: string;
}

export interface IngestionResult {
  count: number;
  duplicates: number;
  errors: number;
}

class IngestionService {
  async ingestTransactions(transactions: Transaction[], idempotencyKey?: string): Promise<IngestionResult> {
    const start = Date.now();
    let count = 0;
    let duplicates = 0;
    let errors = 0;
    
    try {
      await withTransaction(async (client) => {
        for (const txn of transactions) {
          try {
            // Check for existing transaction
            const existing = await client.query(
              'SELECT id FROM transactions WHERE id = $1',
              [txn.id]
            );
            
            if (existing.rows.length > 0) {
              duplicates++;
              continue;
            }
            
            // Insert transaction
            await client.query(
              `INSERT INTO transactions (id, customer_id, card_id, mcc, merchant, amount, currency, ts, device_id, geo)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
              [
                txn.id,
                txn.customerId,
                txn.cardId,
                txn.mcc,
                txn.merchant,
                txn.amount,
                txn.currency,
                txn.ts,
                txn.deviceId,
                txn.geo ? JSON.stringify(txn.geo) : null,
              ]
            );
            
            count++;
          } catch (error) {
            secureLogger.error('Transaction ingestion error', {
              transactionId: txn.id,
              error: error.message,
            });
            errors++;
          }
        }
      });
      
      const duration = Date.now() - start;
      
      secureLogger.info('Transaction ingestion completed', {
        count,
        duplicates,
        errors,
        duration,
        idempotencyKey,
      });
      
      return { count, duplicates, errors };
    } catch (error) {
      secureLogger.error('Transaction ingestion failed', {
        error: error.message,
        idempotencyKey,
      });
      throw error;
    }
  }
  
  async ingestCustomers(customers: Customer[], idempotencyKey?: string): Promise<IngestionResult> {
    const start = Date.now();
    let count = 0;
    let duplicates = 0;
    let errors = 0;
    
    try {
      await withTransaction(async (client) => {
        for (const customer of customers) {
          try {
            // Check for existing customer
            const existing = await client.query(
              'SELECT id FROM customers WHERE id = $1',
              [customer.id]
            );
            
            if (existing.rows.length > 0) {
              duplicates++;
              continue;
            }
            
            // Insert customer
            await client.query(
              'INSERT INTO customers (id, name, email_masked, risk_flags) VALUES ($1, $2, $3, $4)',
              [
                customer.id,
                customer.name,
                customer.email_masked,
                JSON.stringify(customer.risk_flags || []),
              ]
            );
            
            count++;
          } catch (error) {
            secureLogger.error('Customer ingestion error', {
              customerId: customer.id,
              error: error.message,
            });
            errors++;
          }
        }
      });
      
      const duration = Date.now() - start;
      
      secureLogger.info('Customer ingestion completed', {
        count,
        duplicates,
        errors,
        duration,
        idempotencyKey,
      });
      
      return { count, duplicates, errors };
    } catch (error) {
      secureLogger.error('Customer ingestion failed', {
        error: error.message,
        idempotencyKey,
      });
      throw error;
    }
  }
  
  async ingestCards(cards: Card[], idempotencyKey?: string): Promise<IngestionResult> {
    const start = Date.now();
    let count = 0;
    let duplicates = 0;
    let errors = 0;
    
    try {
      await withTransaction(async (client) => {
        for (const card of cards) {
          try {
            // Check for existing card
            const existing = await client.query(
              'SELECT id FROM cards WHERE id = $1',
              [card.id]
            );
            
            if (existing.rows.length > 0) {
              duplicates++;
              continue;
            }
            
            // Insert card
            await client.query(
              'INSERT INTO cards (id, customer_id, last4, status, network) VALUES ($1, $2, $3, $4, $5)',
              [card.id, card.customerId, card.last4, card.status, card.network]
            );
            
            count++;
          } catch (error) {
            secureLogger.error('Card ingestion error', {
              cardId: card.id,
              error: error.message,
            });
            errors++;
          }
        }
      });
      
      const duration = Date.now() - start;
      
      secureLogger.info('Card ingestion completed', {
        count,
        duplicates,
        errors,
        duration,
        idempotencyKey,
      });
      
      return { count, duplicates, errors };
    } catch (error) {
      secureLogger.error('Card ingestion failed', {
        error: error.message,
        idempotencyKey,
      });
      throw error;
    }
  }
}

export const ingestionService = new IngestionService();

import { Injectable, HttpException, HttpStatus, Inject, forwardRef } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { secureLogger } from '../../utils/logger';
import * as csv from 'csv-parser';
import { Readable } from 'stream';
import { DashboardGateway } from '../dashboard/dashboard.gateway';

export interface TransactionData {
  id: string;
  customerId: string;
  cardId: string;
  amount: number;
  currency: string;
  merchant: string;
  mcc: string;
  timestamp: string;
  deviceId?: string;
  deviceInfo?: any;
  metadata?: any;
}

@Injectable()
export class IngestionService {
  constructor(
    private readonly databaseService: DatabaseService,
    @Inject(forwardRef(() => DashboardGateway))
    private readonly dashboardGateway: DashboardGateway,
  ) {}

  async ingestTransactions(transactions: TransactionData[]) {
    try {
      secureLogger.info('Ingesting transactions', { count: transactions.length });
      
      const results = {
        total: transactions.length,
        inserted: 0,
        skipped: 0,
        errors: 0,
        duplicates: 0
      };

      for (const transaction of transactions) {
        try {
          // Check for duplicates by (customerId, txnId)
          const existing = await this.databaseService.findTransactionById(transaction.id);
          if (existing) {
            results.duplicates++;
            results.skipped++;
            secureLogger.info('Skipping duplicate transaction', { 
              id: transaction.id, 
              customerId: transaction.customerId 
            });
            continue;
          }

          // Insert transaction
          await this.databaseService.createTransaction(transaction);
          results.inserted++;
          
          // Emit real-time update for new transaction
          try {
            this.dashboardGateway.broadcastNewTransaction(transaction);
          } catch (error) {
            secureLogger.warn('Failed to broadcast transaction update', { error: error.message });
          }
          
        } catch (error) {
          results.errors++;
          secureLogger.error('Failed to insert transaction', { 
            id: transaction.id, 
            error: error.message 
          });
        }
      }

      secureLogger.info('Transaction ingestion completed', results);
      
      return { 
        accepted: true,
        count: results.inserted,
        requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };
    } catch (error) {
      secureLogger.error('Failed to ingest transactions', { error: error.message });
      throw new HttpException(
        { error: 'Failed to ingest transactions', details: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async ingestFromCsv(csvData: string) {
    try {
      const transactions: TransactionData[] = [];
      
      return new Promise((resolve, reject) => {
        const stream = Readable.from(csvData);
        
        stream
          .pipe(csv.default())
          .on('data', (row) => {
            // Transform CSV row to transaction data
            const transaction: TransactionData = {
              id: row.id || row.transaction_id,
              customerId: row.customer_id,
              cardId: row.card_id,
              amount: parseInt(row.amount),
              currency: row.currency || 'INR',
              merchant: row.merchant,
              mcc: row.mcc,
              timestamp: row.timestamp || row.ts,
              deviceId: row.device_id,
              deviceInfo: row.device_info ? JSON.parse(row.device_info) : undefined,
              metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
            };
            transactions.push(transaction);
          })
          .on('end', async () => {
            try {
              const result = await this.ingestTransactions(transactions);
              resolve(result);
            } catch (error) {
              reject(error);
            }
          })
          .on('error', (error) => {
            reject(error);
          });
      });
    } catch (error) {
      secureLogger.error('Failed to ingest from CSV', { error: error.message });
      throw new HttpException(
        { error: 'Failed to ingest from CSV', details: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async loadFixtures(fixtureType: 'transactions' | 'customers' | 'cards' | 'devices' | 'chargebacks') {
    try {
      secureLogger.info('Loading fixtures', { type: fixtureType });
      
      // Load fixture data based on type
      const fixtureData = await this.databaseService.loadFixtureData(fixtureType);
      
      if (fixtureType === 'transactions') {
        return await this.ingestTransactions(fixtureData);
      }
      
      return { 
        status: 'SUCCESS', 
        message: `${fixtureType} fixtures loaded successfully`,
        count: fixtureData.length 
      };
    } catch (error) {
      secureLogger.error('Failed to load fixtures', { type: fixtureType, error: error.message });
      throw new HttpException(
        { error: 'Failed to load fixtures', details: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

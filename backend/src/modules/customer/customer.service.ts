import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { secureLogger } from '../../utils/logger';

@Injectable()
export class CustomerService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getCustomers() {
    try {
      const customers = await this.databaseService.findCustomers();
      return customers.map(customer => ({
        id: customer.id,
        name: customer.name,
        email: customer.email,
        riskFlags: customer.riskFlags,
        createdAt: customer.createdAt,
      }));
    } catch (error) {
      secureLogger.error('Failed to get customers', { error: error.message });
      throw error;
    }
  }

  async getCustomerById(id: string) {
    try {
      const customer = await this.databaseService.findCustomerById(id);
      if (!customer) {
        throw new NotFoundException('Customer not found');
      }

      return {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        riskFlags: customer.riskFlags,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
      };
    } catch (error) {
      secureLogger.error('Failed to get customer', { id, error: error.message });
      throw error;
    }
  }

  async getCustomerTransactions(
    id: string, 
    page = 1, 
    size = 20, 
    from?: string, 
    to?: string, 
    merchant?: string, 
    mcc?: string
  ) {
    const startTime = Date.now();
    try {
      const limit = size;
      const offset = (page - 1) * size;
      
      // Use 90-day optimized query for better performance
      const transactions = await this.databaseService.findTransactionsByCustomerLast90Days(id, limit, offset);
      
      const duration = Date.now() - startTime;
      secureLogger.info('Customer transactions query completed', {
        customerId: id,
        duration,
        transactionCount: transactions.length,
        performance: duration <= 100 ? 'good' : 'slow'
      });
      
      return {
        transactions: transactions.map(transaction => ({
          id: transaction.id,
          customerId: transaction.customerId,
          cardId: transaction.cardId,
          amount: transaction.amount,
          currency: transaction.currency,
          merchant: transaction.merchant,
          mcc: transaction.mcc,
          timestamp: transaction.timestamp.toISOString(),
          deviceId: transaction.deviceId,
          geo: transaction.geo,
          createdAt: transaction.createdAt,
        })),
        pagination: {
          page,
          size,
          total: transactions.length,
          totalPages: Math.ceil(transactions.length / size),
        }
      };
    } catch (error) {
      secureLogger.error('Failed to get customer transactions', { id, error: error.message });
      throw error;
    }
  }
}

import { query } from '../utils/database';
import { secureLogger } from '../utils/logger';

export interface TransactionFilters {
  from?: string;
  to?: string;
  page: number;
  size: number;
  merchant?: string;
  mcc?: string;
}

export interface PaginatedTransactions {
  transactions: any[];
  pagination: {
    page: number;
    size: number;
    total: number;
    totalPages: number;
  };
}

export interface CustomerProfile {
  id: string;
  name: string;
  email_masked: string;
  risk_flags: string[];
  created_at: string;
  updated_at: string;
}

class CustomerService {
  async getTransactions(customerId: string, filters: TransactionFilters): Promise<PaginatedTransactions> {
    const start = Date.now();
    
    try {
      // Build WHERE clause
      const whereConditions = ['customer_id = $1'];
      const params: any[] = [customerId];
      let paramIndex = 2;
      
      if (filters.from) {
        whereConditions.push(`ts >= $${paramIndex}`);
        params.push(filters.from);
        paramIndex++;
      }
      
      if (filters.to) {
        whereConditions.push(`ts <= $${paramIndex}`);
        params.push(filters.to);
        paramIndex++;
      }
      
      if (filters.merchant) {
        whereConditions.push(`merchant ILIKE $${paramIndex}`);
        params.push(`%${filters.merchant}%`);
        paramIndex++;
      }
      
      if (filters.mcc) {
        whereConditions.push(`mcc = $${paramIndex}`);
        params.push(filters.mcc);
        paramIndex++;
      }
      
      const whereClause = whereConditions.join(' AND ');
      
      // Get total count
      const countQuery = `SELECT COUNT(*) as total FROM transactions WHERE ${whereClause}`;
      const countResult = await query(countQuery, params);
      const total = parseInt(countResult.rows[0].total);
      
      // Get paginated results
      const offset = (filters.page - 1) * filters.size;
      const transactionsQuery = `
        SELECT 
          id,
          customer_id,
          card_id,
          mcc,
          merchant,
          amount,
          currency,
          ts,
          device_id,
          geo
        FROM transactions 
        WHERE ${whereClause}
        ORDER BY ts DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      
      params.push(filters.size, offset);
      const transactionsResult = await query(transactionsQuery, params);
      
      const duration = Date.now() - start;
      const totalPages = Math.ceil(total / filters.size);
      
      secureLogger.info('Customer transactions retrieved', {
        customerId,
        filters,
        duration,
        total,
        page: filters.page,
        size: filters.size,
      });
      
      return {
        transactions: transactionsResult.rows.map(row => ({
          id: row.id,
          customerId: row.customer_id,
          cardId: row.card_id,
          mcc: row.mcc,
          merchant: row.merchant,
          amount: row.amount,
          currency: row.currency,
          ts: row.ts,
          deviceId: row.device_id,
          geo: row.geo,
        })),
        pagination: {
          page: filters.page,
          size: filters.size,
          total,
          totalPages,
        },
      };
    } catch (error) {
      secureLogger.error('Customer transactions retrieval failed', {
        customerId,
        filters,
        error: error.message,
      });
      throw error;
    }
  }
  
  async getProfile(customerId: string): Promise<CustomerProfile> {
    try {
      const result = await query(
        'SELECT id, name, email_masked, risk_flags, created_at, updated_at FROM customers WHERE id = $1',
        [customerId]
      );
      
      if (result.rows.length === 0) {
        throw new Error('Customer not found');
      }
      
      const customer = result.rows[0];
      
      return {
        id: customer.id,
        name: customer.name,
        email_masked: customer.email_masked,
        risk_flags: customer.risk_flags || [],
        created_at: customer.created_at,
        updated_at: customer.updated_at,
      };
    } catch (error) {
      secureLogger.error('Customer profile retrieval failed', {
        customerId,
        error: error.message,
      });
      throw error;
    }
  }
  
  async getCards(customerId: string): Promise<any[]> {
    try {
      const result = await query(
        'SELECT id, customer_id, last4, status, network, created_at FROM cards WHERE customer_id = $1 ORDER BY created_at DESC',
        [customerId]
      );
      
      return result.rows.map(row => ({
        id: row.id,
        customerId: row.customer_id,
        last4: row.last4,
        status: row.status,
        network: row.network,
        created_at: row.created_at,
      }));
    } catch (error) {
      secureLogger.error('Customer cards retrieval failed', {
        customerId,
        error: error.message,
      });
      throw error;
    }
  }
  
  async getDevices(customerId: string): Promise<any[]> {
    try {
      const result = await query(
        'SELECT id, customer_id, device_type, device_info, last_seen, created_at FROM devices WHERE customer_id = $1 ORDER BY last_seen DESC',
        [customerId]
      );
      
      return result.rows.map(row => ({
        id: row.id,
        customerId: row.customer_id,
        deviceType: row.device_type,
        deviceInfo: row.device_info,
        lastSeen: row.last_seen,
        created_at: row.created_at,
      }));
    } catch (error) {
      secureLogger.error('Customer devices retrieval failed', {
        customerId,
        error: error.message,
      });
      throw error;
    }
  }
}

export const customerService = new CustomerService();

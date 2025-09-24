import { query } from '../utils/database';
import { secureLogger } from '../utils/logger';

export interface CustomerSummary {
  customerId: string;
  totalSpend: number;
  transactionCount: number;
  averageTransaction: number;
  topMerchants: Array<{
    merchant: string;
    amount: number;
    count: number;
  }>;
  categories: Array<{
    mcc: string;
    category: string;
    amount: number;
    count: number;
  }>;
  monthlyTrend: Array<{
    month: string;
    amount: number;
    count: number;
  }>;
  riskScore: number;
  lastTransaction: string;
}

export interface SpendAnomaly {
  type: 'velocity' | 'amount' | 'location' | 'merchant';
  description: string;
  severity: 'low' | 'medium' | 'high';
  transactionId?: string;
  amount?: number;
  expectedAmount?: number;
}

class InsightsService {
  async getCustomerSummary(customerId: string, from?: string, to?: string): Promise<CustomerSummary> {
    const start = Date.now();
    
    try {
      // Build date filter
      let dateFilter = '';
      const params: any[] = [customerId];
      let paramIndex = 2;
      
      if (from) {
        dateFilter += ` AND ts >= $${paramIndex}`;
        params.push(from);
        paramIndex++;
      }
      
      if (to) {
        dateFilter += ` AND ts <= $${paramIndex}`;
        params.push(to);
        paramIndex++;
      }
      
      // Get basic summary
      const summaryQuery = `
        SELECT 
          COUNT(*) as transaction_count,
          SUM(amount) as total_spend,
          AVG(amount) as avg_transaction,
          MAX(ts) as last_transaction
        FROM transactions 
        WHERE customer_id = $1 ${dateFilter}
      `;
      
      const summaryResult = await query(summaryQuery, params);
      const summary = summaryResult.rows[0];
      
      // Get top merchants
      const merchantsQuery = `
        SELECT 
          merchant,
          SUM(amount) as amount,
          COUNT(*) as count
        FROM transactions 
        WHERE customer_id = $1 ${dateFilter}
        GROUP BY merchant
        ORDER BY amount DESC
        LIMIT 5
      `;
      
      const merchantsResult = await query(merchantsQuery, params);
      
      // Get spend categories
      const categoriesQuery = `
        SELECT 
          mcc,
          SUM(amount) as amount,
          COUNT(*) as count
        FROM transactions 
        WHERE customer_id = $1 ${dateFilter}
        GROUP BY mcc
        ORDER BY amount DESC
        LIMIT 10
      `;
      
      const categoriesResult = await query(categoriesQuery, params);
      
      // Get monthly trend
      const trendQuery = `
        SELECT 
          DATE_TRUNC('month', ts) as month,
          SUM(amount) as amount,
          COUNT(*) as count
        FROM transactions 
        WHERE customer_id = $1 ${dateFilter}
        GROUP BY DATE_TRUNC('month', ts)
        ORDER BY month DESC
        LIMIT 12
      `;
      
      const trendResult = await query(trendQuery, params);
      
      // Calculate risk score (simplified)
      const riskScore = this.calculateRiskScore(summary, merchantsResult.rows, categoriesResult.rows);
      
      const duration = Date.now() - start;
      
      secureLogger.info('Customer summary generated', {
        customerId,
        duration,
        transactionCount: summary.transaction_count,
        totalSpend: summary.total_spend,
      });
      
      return {
        customerId,
        totalSpend: parseFloat(summary.total_spend) || 0,
        transactionCount: parseInt(summary.transaction_count) || 0,
        averageTransaction: parseFloat(summary.avg_transaction) || 0,
        topMerchants: merchantsResult.rows.map(row => ({
          merchant: row.merchant,
          amount: parseFloat(row.amount),
          count: parseInt(row.count),
        })),
        categories: categoriesResult.rows.map(row => ({
          mcc: row.mcc,
          category: this.getMccCategory(row.mcc),
          amount: parseFloat(row.amount),
          count: parseInt(row.count),
        })),
        monthlyTrend: trendResult.rows.map(row => ({
          month: row.month.toISOString().substring(0, 7),
          amount: parseFloat(row.amount),
          count: parseInt(row.count),
        })),
        riskScore,
        lastTransaction: summary.last_transaction,
      };
    } catch (error) {
      secureLogger.error('Customer summary generation failed', {
        customerId,
        error: error.message,
      });
      throw error;
    }
  }
  
  async getTopMerchants(customerId: string, limit: number = 10): Promise<any[]> {
    const result = await query(
      `SELECT 
        merchant,
        SUM(amount) as amount,
        COUNT(*) as count
      FROM transactions 
      WHERE customer_id = $1
      GROUP BY merchant
      ORDER BY amount DESC
      LIMIT $2`,
      [customerId, limit]
    );
    
    return result.rows.map(row => ({
      merchant: row.merchant,
      amount: parseFloat(row.amount),
      count: parseInt(row.count),
    }));
  }
  
  async getSpendCategories(customerId: string): Promise<any[]> {
    const result = await query(
      `SELECT 
        mcc,
        SUM(amount) as amount,
        COUNT(*) as count
      FROM transactions 
      WHERE customer_id = $1
      GROUP BY mcc
      ORDER BY amount DESC`,
      [customerId]
    );
    
    return result.rows.map(row => ({
      mcc: row.mcc,
      category: this.getMccCategory(row.mcc),
      amount: parseFloat(row.amount),
      count: parseInt(row.count),
    }));
  }
  
  async getSpendTrends(customerId: string, period: 'daily' | 'weekly' | 'monthly'): Promise<any[]> {
    let dateTrunc: string;
    switch (period) {
      case 'daily':
        dateTrunc = 'DATE_TRUNC(\'day\', ts)';
        break;
      case 'weekly':
        dateTrunc = 'DATE_TRUNC(\'week\', ts)';
        break;
      case 'monthly':
        dateTrunc = 'DATE_TRUNC(\'month\', ts)';
        break;
      default:
        dateTrunc = 'DATE_TRUNC(\'month\', ts)';
    }
    
    const result = await query(
      `SELECT 
        ${dateTrunc} as period,
        SUM(amount) as amount,
        COUNT(*) as count
      FROM transactions 
      WHERE customer_id = $1
      GROUP BY ${dateTrunc}
      ORDER BY period DESC
      LIMIT 30`,
      [customerId]
    );
    
    return result.rows.map(row => ({
      period: row.period.toISOString().substring(0, 10),
      amount: parseFloat(row.amount),
      count: parseInt(row.count),
    }));
  }
  
  async getSpendAnomalies(customerId: string): Promise<SpendAnomaly[]> {
    const anomalies: SpendAnomaly[] = [];
    
    try {
      // Check for velocity anomalies (high transaction count in short time)
      const velocityResult = await query(
        `SELECT 
          DATE_TRUNC('hour', ts) as hour,
          COUNT(*) as count,
          SUM(amount) as amount
        FROM transactions 
        WHERE customer_id = $1 
        AND ts >= NOW() - INTERVAL '24 hours'
        GROUP BY DATE_TRUNC('hour', ts)
        HAVING COUNT(*) > 10
        ORDER BY count DESC`,
        [customerId]
      );
      
      for (const row of velocityResult.rows) {
        anomalies.push({
          type: 'velocity',
          description: `High transaction velocity: ${row.count} transactions in 1 hour`,
          severity: row.count > 20 ? 'high' : 'medium',
          amount: parseFloat(row.amount),
        });
      }
      
      // Check for amount anomalies (unusually large transactions)
      const amountResult = await query(
        `SELECT 
          id,
          amount,
          merchant,
          ts
        FROM transactions 
        WHERE customer_id = $1 
        AND amount < -50000
        ORDER BY amount ASC
        LIMIT 5`,
        [customerId]
      );
      
      for (const row of amountResult.rows) {
        anomalies.push({
          type: 'amount',
          description: `Large transaction: ₹${Math.abs(row.amount / 100)} at ${row.merchant}`,
          severity: Math.abs(row.amount) > 100000 ? 'high' : 'medium',
          transactionId: row.id,
          amount: row.amount,
        });
      }
      
      return anomalies;
    } catch (error) {
      secureLogger.error('Anomaly detection failed', {
        customerId,
        error: error.message,
      });
      return [];
    }
  }
  
  private calculateRiskScore(summary: any, merchants: any[], categories: any[]): number {
    let score = 0;
    
    // Base score from transaction count
    if (summary.transaction_count > 100) score += 20;
    else if (summary.transaction_count > 50) score += 10;
    
    // Score from total spend
    if (summary.total_spend < -100000) score += 30;
    else if (summary.total_spend < -50000) score += 20;
    else if (summary.total_spend < -20000) score += 10;
    
    // Score from merchant diversity
    if (merchants.length > 20) score += 15;
    else if (merchants.length > 10) score += 10;
    
    // Score from category diversity
    if (categories.length > 10) score += 10;
    
    return Math.min(score, 100);
  }
  
  private getMccCategory(mcc: string): string {
    const mccCategories: { [key: string]: string } = {
      '5411': 'Grocery Stores',
      '5812': 'Restaurants',
      '5541': 'Gas Stations',
      '5311': 'Department Stores',
      '5999': 'Miscellaneous Retail',
      '6011': 'ATM Withdrawals',
      '6012': 'Financial Institutions',
      '7011': 'Hotels',
      '4111': 'Transportation',
      '5814': 'Fast Food',
    };
    
    return mccCategories[mcc] || 'Other';
  }
}

export const insightsService = new InsightsService();

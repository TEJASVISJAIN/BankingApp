import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { secureLogger } from '../../utils/logger';

@Injectable()
export class InsightsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getCustomerInsights(customerId: string) {
    try {
      const customer = await this.databaseService.findCustomerById(customerId);
      const transactions = await this.databaseService.findTransactionsByCustomer(customerId, 50);
      const chargebacks = await this.databaseService.findChargebacksByCustomer(customerId);

      // Calculate top merchants
      const merchantStats = new Map<string, { amount: number; count: number }>();
      transactions.forEach(transaction => {
        const merchant = transaction.merchant || 'Unknown';
        if (!merchantStats.has(merchant)) {
          merchantStats.set(merchant, { amount: 0, count: 0 });
        }
        const stats = merchantStats.get(merchant)!;
        stats.amount += transaction.amount;
        stats.count += 1;
      });

      const topMerchants = Array.from(merchantStats.entries())
        .map(([merchant, stats]) => ({
          merchant,
          amount: stats.amount,
          count: stats.count,
        }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);

      // Calculate MCC mix analysis
      const mccMix = this.calculateMccMix(transactions);
      
      // Calculate spend categories
      const spendCategories = this.calculateSpendCategories(transactions);
      
      // Detect time-series anomalies
      const anomalies = this.detectTimeSeriesAnomalies(transactions);

      // Calculate total spend
      const totalSpend = transactions.reduce((sum, transaction) => sum + transaction.amount, 0);

      // Calculate monthly trend
      const monthlyTrend = this.calculateMonthlyTrend(transactions);
      
      return {
        topMerchants: topMerchants.slice(0, 5), // Top 5 merchants
        categories: spendCategories.slice(0, 10), // Top 10 categories
        monthlyTrend: monthlyTrend
      };
    } catch (error) {
      secureLogger.error('Failed to get customer insights', { customerId, error: error.message });
      throw error;
    }
  }

  private calculateMccMix(transactions: any[]) {
    const mccStats = new Map<string, { amount: number; count: number; description: string }>();
    
    // MCC descriptions mapping
    const mccDescriptions: { [key: string]: string } = {
      '5411': 'Grocery Stores',
      '5541': 'Gas Stations',
      '5812': 'Restaurants',
      '5999': 'Miscellaneous',
      '6011': 'Financial Institutions',
      '7011': 'Hotels',
      '7372': 'Computer Software Stores',
      '7991': 'Tourist Attractions',
      '8062': 'Hospitals',
      '8211': 'Elementary Schools',
    };

    transactions.forEach(transaction => {
      const mcc = transaction.mcc || 'unknown';
      if (!mccStats.has(mcc)) {
        mccStats.set(mcc, { amount: 0, count: 0, description: mccDescriptions[mcc] || 'Unknown Category' });
      }
      const stats = mccStats.get(mcc)!;
      stats.amount += transaction.amount;
      stats.count += 1;
    });

    const totalAmount = Array.from(mccStats.values()).reduce((sum, stats) => sum + stats.amount, 0);

    return Array.from(mccStats.entries())
      .map(([mcc, stats]) => ({
        mcc,
        description: stats.description,
        amount: stats.amount,
        count: stats.count,
        percentage: totalAmount > 0 ? (stats.amount / totalAmount) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }

  private calculateSpendCategories(transactions: any[]) {
    const categories = new Map<string, { amount: number; count: number }>();
    
    // Category mapping based on MCC
    const categoryMapping: { [key: string]: string } = {
      '5411': 'Groceries',
      '5541': 'Transportation',
      '5812': 'Dining',
      '5999': 'Shopping',
      '6011': 'Financial',
      '7011': 'Travel',
      '7372': 'Technology',
      '7991': 'Entertainment',
      '8062': 'Healthcare',
      '8211': 'Education',
    };

    transactions.forEach(transaction => {
      const mcc = transaction.mcc || 'unknown';
      const category = categoryMapping[mcc] || 'Other';
      
      if (!categories.has(category)) {
        categories.set(category, { amount: 0, count: 0 });
      }
      const stats = categories.get(category)!;
      stats.amount += transaction.amount;
      stats.count += 1;
    });

    const totalAmount = Array.from(categories.values()).reduce((sum, stats) => sum + stats.amount, 0);

    return Array.from(categories.entries())
      .map(([category, stats]) => ({
        category,
        amount: stats.amount,
        count: stats.count,
        percentage: totalAmount > 0 ? (stats.amount / totalAmount) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }

  private detectTimeSeriesAnomalies(transactions: any[]) {
    if (transactions.length < 10) return [];

    // Group transactions by day
    const dailySpend = new Map<string, number>();
    transactions.forEach(transaction => {
      const date = new Date(transaction.timestamp).toISOString().split('T')[0];
      if (!dailySpend.has(date)) {
        dailySpend.set(date, 0);
      }
      dailySpend.set(date, dailySpend.get(date)! + transaction.amount);
    });

    const dailyAmounts = Array.from(dailySpend.values());
    const mean = dailyAmounts.reduce((sum, amount) => sum + amount, 0) / dailyAmounts.length;
    const variance = dailyAmounts.reduce((sum, amount) => sum + Math.pow(amount - mean, 2), 0) / dailyAmounts.length;
    const stdDev = Math.sqrt(variance);

    const anomalies: any[] = [];
    dailySpend.forEach((amount, date) => {
      const zScore = Math.abs((amount - mean) / stdDev);
      if (zScore > 2) { // 2 standard deviations
        anomalies.push({
          date,
          amount,
          zScore: zScore.toFixed(2),
          type: amount > mean ? 'spike' : 'drop',
          severity: zScore > 3 ? 'high' : 'medium',
        });
      }
    });

    return anomalies.sort((a, b) => b.zScore - a.zScore);
  }

  private calculateMonthlyTrend(transactions: any[]): any[] {
    const monthlyData = new Map<string, { amount: number; count: number }>();
    
    transactions.forEach(txn => {
      const date = new Date(txn.timestamp);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      const current = monthlyData.get(monthKey) || { amount: 0, count: 0 };
      current.amount += txn.amount;
      current.count += 1;
      monthlyData.set(monthKey, current);
    });

    return Array.from(monthlyData.entries())
      .map(([month, data]) => ({
        month,
        amount: data.amount,
        count: data.count,
        averageTransaction: data.count > 0 ? data.amount / data.count : 0
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }
}

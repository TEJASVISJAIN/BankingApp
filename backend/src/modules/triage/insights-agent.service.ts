import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { secureLogger } from '../../utils/logger';

export interface SpendingCategory {
  category: string;
  amount: number;
  count: number;
  percentage: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

export interface SpendingSummary {
  totalSpend: number;
  averageTransaction: number;
  topCategories: SpendingCategory[];
  spendingPatterns: string[];
  riskIndicators: string[];
  recommendations: string[];
}

export interface CustomerInsights {
  customerId: string;
  summary: SpendingSummary;
  categories: SpendingCategory[];
  patterns: {
    timeOfDay: string;
    dayOfWeek: string;
    merchantTypes: string[];
    amountRanges: string[];
  };
  riskProfile: {
    level: 'low' | 'medium' | 'high';
    factors: string[];
    score: number;
  };
}

@Injectable()
export class InsightsAgentService {
  constructor(private readonly databaseService: DatabaseService) {}

  async generateInsights(customerId: string, transactions: any[]): Promise<CustomerInsights> {
    try {
      secureLogger.info('Generating customer insights', { customerId, transactionCount: transactions.length });

      // Calculate spending categories
      const categories = this.calculateSpendingCategories(transactions);
      
      // Generate spending summary
      const summary = this.generateSpendingSummary(transactions, categories);
      
      // Analyze spending patterns
      const patterns = this.analyzeSpendingPatterns(transactions);
      
      // Assess risk profile
      const riskProfile = this.assessRiskProfile(transactions, categories);

      const insights: CustomerInsights = {
        customerId,
        summary,
        categories,
        patterns,
        riskProfile,
      };

      secureLogger.info('Customer insights generated successfully', { 
        customerId, 
        categoryCount: categories.length,
        riskLevel: riskProfile.level 
      });

      return insights;
    } catch (error) {
      secureLogger.error('Failed to generate customer insights', { customerId, error: error.message });
      throw error;
    }
  }

  private calculateSpendingCategories(transactions: any[]): SpendingCategory[] {
    const categoryMap = new Map<string, { amount: number; count: number }>();
    
    // MCC to category mapping
    const mccToCategory: { [key: string]: string } = {
      '5411': 'Groceries',
      '5541': 'Transportation',
      '5812': 'Dining',
      '5814': 'Dining',
      '5999': 'Shopping',
      '6011': 'Financial',
      '6012': 'Financial',
      '7011': 'Travel',
      '7372': 'Technology',
      '7991': 'Entertainment',
      '8062': 'Healthcare',
      '8211': 'Education',
    };

    // Process transactions
    transactions.forEach(transaction => {
      const category = mccToCategory[transaction.mcc] || 'Other';
      
      if (!categoryMap.has(category)) {
        categoryMap.set(category, { amount: 0, count: 0 });
      }
      
      const stats = categoryMap.get(category)!;
      stats.amount += Math.abs(transaction.amount);
      stats.count += 1;
    });

    const totalAmount = Array.from(categoryMap.values()).reduce((sum, stats) => sum + stats.amount, 0);

    return Array.from(categoryMap.entries())
      .map(([category, stats]) => ({
        category,
        amount: stats.amount,
        count: stats.count,
        percentage: totalAmount > 0 ? (stats.amount / totalAmount) * 100 : 0,
        trend: this.calculateTrend(transactions, category),
      }))
      .sort((a, b) => b.amount - a.amount);
  }

  private calculateTrend(transactions: any[], category: string): 'increasing' | 'decreasing' | 'stable' {
    // Simple trend calculation based on recent vs older transactions
    const recent = transactions.slice(0, Math.floor(transactions.length / 2));
    const older = transactions.slice(Math.floor(transactions.length / 2));
    
    const recentAmount = recent
      .filter(t => this.getCategoryFromMcc(t.mcc) === category)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    const olderAmount = older
      .filter(t => this.getCategoryFromMcc(t.mcc) === category)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    if (recentAmount > olderAmount * 1.2) return 'increasing';
    if (recentAmount < olderAmount * 0.8) return 'decreasing';
    return 'stable';
  }

  private getCategoryFromMcc(mcc: string): string {
    const mccToCategory: { [key: string]: string } = {
      '5411': 'Groceries',
      '5541': 'Transportation',
      '5812': 'Dining',
      '5814': 'Dining',
      '5999': 'Shopping',
      '6011': 'Financial',
      '6012': 'Financial',
      '7011': 'Travel',
      '7372': 'Technology',
      '7991': 'Entertainment',
      '8062': 'Healthcare',
      '8211': 'Education',
    };
    return mccToCategory[mcc] || 'Other';
  }

  private generateSpendingSummary(transactions: any[], categories: SpendingCategory[]): SpendingSummary {
    const totalSpend = transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const averageTransaction = transactions.length > 0 ? totalSpend / transactions.length : 0;
    
    const topCategories = categories.slice(0, 5);
    
    const spendingPatterns = this.identifySpendingPatterns(transactions);
    const riskIndicators = this.identifyRiskIndicators(transactions);
    const recommendations = this.generateRecommendations(categories, riskIndicators);

    return {
      totalSpend,
      averageTransaction,
      topCategories,
      spendingPatterns,
      riskIndicators,
      recommendations,
    };
  }

  private identifySpendingPatterns(transactions: any[]): string[] {
    const patterns: string[] = [];
    
    // Time-based patterns
    const hourCounts = new Array(24).fill(0);
    transactions.forEach(t => {
      const hour = new Date(t.timestamp).getHours();
      hourCounts[hour]++;
    });
    
    const peakHour = hourCounts.indexOf(Math.max(...hourCounts));
    if (peakHour >= 9 && peakHour <= 17) {
      patterns.push('Daytime spender');
    } else if (peakHour >= 18 && peakHour <= 23) {
      patterns.push('Evening spender');
    } else {
      patterns.push('Night/early morning spender');
    }

    // Amount patterns
    const amounts = transactions.map(t => Math.abs(t.amount));
    const avgAmount = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;
    
    if (avgAmount > 50000) { // > ₹500
      patterns.push('High-value spender');
    } else if (avgAmount < 10000) { // < ₹100
      patterns.push('Low-value spender');
    } else {
      patterns.push('Moderate spender');
    }

    // Frequency patterns
    if (transactions.length > 20) {
      patterns.push('Frequent spender');
    } else if (transactions.length < 5) {
      patterns.push('Infrequent spender');
    }

    return patterns;
  }

  private identifyRiskIndicators(transactions: any[]): string[] {
    const indicators: string[] = [];
    
    // High velocity
    if (transactions.length > 10) {
      indicators.push('High transaction velocity');
    }
    
    // Large amounts
    const largeTransactions = transactions.filter(t => Math.abs(t.amount) > 100000);
    if (largeTransactions.length > 0) {
      indicators.push('Large transaction amounts');
    }
    
    // Negative amounts (refunds/chargebacks)
    const negativeTransactions = transactions.filter(t => t.amount < 0);
    if (negativeTransactions.length > 0) {
      indicators.push('Refund/chargeback activity');
    }
    
    // Unusual merchants
    const merchants = [...new Set(transactions.map(t => t.merchant))];
    if (merchants.length > 10) {
      indicators.push('Diverse merchant usage');
    }

    return indicators;
  }

  private generateRecommendations(categories: SpendingCategory[], riskIndicators: string[]): string[] {
    const recommendations: string[] = [];
    
    // Category-based recommendations
    const topCategory = categories[0];
    if (topCategory && topCategory.percentage > 50) {
      recommendations.push(`Consider diversifying spending beyond ${topCategory.category}`);
    }
    
    // Risk-based recommendations
    if (riskIndicators.includes('High transaction velocity')) {
      recommendations.push('Monitor transaction frequency for unusual patterns');
    }
    
    if (riskIndicators.includes('Large transaction amounts')) {
      recommendations.push('Consider setting up transaction alerts for large amounts');
    }
    
    // General recommendations
    if (categories.length < 3) {
      recommendations.push('Customer has limited spending diversity');
    }
    
    return recommendations;
  }

  private analyzeSpendingPatterns(transactions: any[]): {
    timeOfDay: string;
    dayOfWeek: string;
    merchantTypes: string[];
    amountRanges: string[];
  } {
    // Time of day analysis
    const hourCounts = new Array(24).fill(0);
    transactions.forEach(t => {
      const hour = new Date(t.timestamp).getHours();
      hourCounts[hour]++;
    });
    const peakHour = hourCounts.indexOf(Math.max(...hourCounts));
    const timeOfDay = peakHour >= 6 && peakHour <= 11 ? 'Morning' :
                      peakHour >= 12 && peakHour <= 17 ? 'Afternoon' :
                      peakHour >= 18 && peakHour <= 22 ? 'Evening' : 'Night';

    // Day of week analysis
    const dayCounts = new Array(7).fill(0);
    transactions.forEach(t => {
      const day = new Date(t.timestamp).getDay();
      dayCounts[day]++;
    });
    const peakDay = dayCounts.indexOf(Math.max(...dayCounts));
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayOfWeek = days[peakDay];

    // Merchant types
    const merchantTypes = [...new Set(transactions.map(t => t.merchant))].slice(0, 5);

    // Amount ranges
    const amounts = transactions.map(t => Math.abs(t.amount));
    const minAmount = Math.min(...amounts);
    const maxAmount = Math.max(...amounts);
    const avgAmount = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;
    
    const amountRanges = [
      `Min: ₹${Math.round(minAmount / 100)}`,
      `Max: ₹${Math.round(maxAmount / 100)}`,
      `Avg: ₹${Math.round(avgAmount / 100)}`,
    ];

    return {
      timeOfDay,
      dayOfWeek,
      merchantTypes,
      amountRanges,
    };
  }

  private assessRiskProfile(transactions: any[], categories: SpendingCategory[]): {
    level: 'low' | 'medium' | 'high';
    factors: string[];
    score: number;
  } {
    let score = 0;
    const factors: string[] = [];

    // Transaction count factor
    if (transactions.length > 20) {
      score += 0.3;
      factors.push('High transaction frequency');
    }

    // Amount factor
    const avgAmount = transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0) / transactions.length;
    if (avgAmount > 100000) { // > ₹1000
      score += 0.4;
      factors.push('High average transaction amount');
    }

    // Category diversity factor
    if (categories.length < 3) {
      score += 0.2;
      factors.push('Limited spending diversity');
    }

    // Negative transactions factor
    const negativeCount = transactions.filter(t => t.amount < 0).length;
    if (negativeCount > 0) {
      score += 0.1;
      factors.push('Refund/chargeback activity');
    }

    // Determine risk level
    let level: 'low' | 'medium' | 'high';
    if (score >= 0.7) {
      level = 'high';
    } else if (score >= 0.4) {
      level = 'medium';
    } else {
      level = 'low';
    }

    return {
      level,
      factors,
      score: Math.min(score, 1.0),
    };
  }
}

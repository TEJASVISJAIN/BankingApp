import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from '../database/entities/transaction.entity';
import { Customer } from '../database/entities/customer.entity';
import { Card } from '../database/entities/card.entity';
import { Chargeback } from '../database/entities/chargeback.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
    @InjectRepository(Card)
    private cardRepository: Repository<Card>,
    @InjectRepository(Chargeback)
    private chargebackRepository: Repository<Chargeback>,
  ) {}

  async getDashboardKpis() {
    try {
      // Get all transactions (since our seeded data is from 2024-2025)
      const totalSpendResult = await this.transactionRepository
        .createQueryBuilder('transaction')
        .select('SUM(transaction.amount)', 'total')
        .where('transaction.amount > 0')
        .getRawOne();
      
      const totalSpend = parseInt(totalSpendResult?.total || '0');

      // Get high risk alerts (transactions with high amounts)
      const highRiskAlerts = await this.transactionRepository
        .createQueryBuilder('transaction')
        .where('ABS(transaction.amount) > :threshold', { threshold: 50000 }) // > 500 INR
        .getCount();

      // Get disputes opened
      const disputesOpened = await this.chargebackRepository
        .createQueryBuilder('chargeback')
        .getCount();

      // Get total transactions count
      const totalTransactions = await this.transactionRepository
        .createQueryBuilder('transaction')
        .getCount();

      // Calculate fraud rate (high risk alerts / total transactions)
      const fraudRate = totalTransactions > 0 ? (highRiskAlerts / totalTransactions) * 100 : 0;

      // Calculate average triage time (mock for now, but could be calculated from actual triage sessions)
      const avgTriageTime = 2.5; // minutes

      return {
        totalSpend,
        spendChange: 0, // No comparison for now
        highRiskAlerts,
        highRiskChange: 0, // No comparison for now
        disputesOpened,
        disputesChange: 0, // No comparison for now
        avgTriageTime,
        totalTransactions,
        fraudRate: Math.round(fraudRate * 10) / 10,
      };
    } catch (error) {
      console.error('Error fetching dashboard KPIs:', error);
      throw new Error('Failed to fetch dashboard KPIs');
    }
  }

  async getCustomerFraudAnalysis(customerId: string) {
    try {
      console.log(`Starting fraud analysis for customer: ${customerId}`);
      const startTime = Date.now();

      // Get customer info
      const customer = await this.customerRepository.findOne({
        where: { id: customerId }
      });

      if (!customer) {
        throw new Error('Customer not found');
      }

      // Get all transactions for this customer
      const customerTransactions = await this.transactionRepository
        .createQueryBuilder('transaction')
        .where('transaction.customerId = :customerId', { customerId })
        .orderBy('transaction.timestamp', 'DESC')
        .getMany();

      // Analyze fraud patterns
      const analysis = this.analyzeCustomerFraudPatterns(customer, customerTransactions);
      
      const endTime = Date.now();
      console.log(`Fraud analysis completed in ${endTime - startTime}ms for customer: ${customerId}`);

      return {
        customerId,
        customerName: customer.name,
        analysis,
        totalTransactions: customerTransactions.length,
        analysisTime: endTime - startTime
      };
    } catch (error) {
      console.error('Error in customer fraud analysis:', error);
      throw new Error('Failed to analyze customer fraud patterns');
    }
  }

  private analyzeCustomerFraudPatterns(customer: any, transactions: any[]) {
    const traceLogs = [];
    const now = new Date();
    const last30Days = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    const last7Days = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));

    traceLogs.push({
      step: 1,
      timestamp: new Date().toISOString(),
      action: 'Initializing Analysis',
      details: `Analyzing ${transactions.length} transactions for customer ${customer.id}`,
      status: 'started'
    });

    // Recent transactions
    const recentTransactions = transactions.filter(t => new Date(t.timestamp) >= last30Days);
    const veryRecentTransactions = transactions.filter(t => new Date(t.timestamp) >= last7Days);
    
    traceLogs.push({
      step: 2,
      timestamp: new Date().toISOString(),
      action: 'Time-based Filtering',
      details: `Found ${recentTransactions.length} transactions in last 30 days, ${veryRecentTransactions.length} in last 7 days`,
      status: 'completed'
    });

    // High-value transactions
    const highValueTransactions = transactions.filter(t => Math.abs(t.amount) > 50000); // > 500 INR
    const veryHighValueTransactions = transactions.filter(t => Math.abs(t.amount) > 100000); // > 1000 INR
    
    traceLogs.push({
      step: 3,
      timestamp: new Date().toISOString(),
      action: 'High-value Transaction Analysis',
      details: `Found ${highValueTransactions.length} high-value transactions (>₹500), ${veryHighValueTransactions.length} very high-value (>₹1000)`,
      status: 'completed'
    });

    // Merchant analysis
    const merchantCounts = {};
    const recentMerchants = new Set();
    
    recentTransactions.forEach(t => {
      const merchant = t.merchant || 'Unknown';
      merchantCounts[merchant] = (merchantCounts[merchant] || 0) + 1;
      recentMerchants.add(merchant);
    });
    
    traceLogs.push({
      step: 4,
      timestamp: new Date().toISOString(),
      action: 'Merchant Pattern Analysis',
      details: `Analyzed ${Object.keys(merchantCounts).length} unique merchants in recent transactions`,
      status: 'completed'
    });

    // Time-based analysis
    const hourlySpending = {};
    const dailySpending = {};
    
    recentTransactions.forEach(t => {
      const date = new Date(t.timestamp);
      const hour = date.getHours();
      const day = date.toDateString();
      
      hourlySpending[hour] = (hourlySpending[hour] || 0) + Math.abs(t.amount);
      dailySpending[day] = (dailySpending[day] || 0) + Math.abs(t.amount);
    });

    // Risk indicators
    const riskIndicators = [];
    
    traceLogs.push({
      step: 5,
      timestamp: new Date().toISOString(),
      action: 'Risk Indicator Analysis',
      details: 'Starting risk indicator evaluation',
      status: 'started'
    });
    
    // High velocity spending
    if (veryRecentTransactions.length > 10) {
      riskIndicators.push({
        type: 'high_velocity',
        severity: 'high',
        description: `High transaction velocity: ${veryRecentTransactions.length} transactions in last 7 days`,
        value: veryRecentTransactions.length
      });
      
      traceLogs.push({
        step: 6,
        timestamp: new Date().toISOString(),
        action: 'High Velocity Detection',
        details: `HIGH RISK: ${veryRecentTransactions.length} transactions in 7 days (threshold: 10)`,
        status: 'warning'
      });
    }

    // Large amounts
    if (veryHighValueTransactions.length > 0) {
      riskIndicators.push({
        type: 'large_amounts',
        severity: 'high',
        description: `${veryHighValueTransactions.length} very high-value transactions (>₹1000)`,
        value: veryHighValueTransactions.length
      });
      
      traceLogs.push({
        step: 7,
        timestamp: new Date().toISOString(),
        action: 'Large Amount Detection',
        details: `HIGH RISK: ${veryHighValueTransactions.length} very high-value transactions (>₹1000)`,
        status: 'warning'
      });
    }

    // Unusual spending patterns
    const dailySpendValues = Object.values(dailySpending).map(v => Number(v));
    const avgDailySpend = dailySpendValues.length > 0 
      ? dailySpendValues.reduce((a, b) => a + b, 0) / dailySpendValues.length 
      : 0;
    const maxDailySpend = dailySpendValues.length > 0 ? Math.max(...dailySpendValues) : 0;
    
    if (maxDailySpend > avgDailySpend * 3) {
      riskIndicators.push({
        type: 'unusual_spending',
        severity: 'medium',
        description: 'Unusual daily spending pattern detected',
        value: maxDailySpend / avgDailySpend
      });
    }

    // New merchants
    const allMerchants = new Set(transactions.map(t => t.merchant).filter(Boolean));
    const newMerchantRatio = recentMerchants.size / allMerchants.size;
    
    if (newMerchantRatio > 0.7) {
      riskIndicators.push({
        type: 'new_merchants',
        severity: 'medium',
        description: 'High ratio of new merchants in recent transactions',
        value: newMerchantRatio
      });
    }

    // Calculate overall risk score
    const riskScore = this.calculateOverallRiskScore(riskIndicators);
    
    traceLogs.push({
      step: 8,
      timestamp: new Date().toISOString(),
      action: 'Risk Score Calculation',
      details: `Final risk score: ${riskScore} (${riskIndicators.length} indicators)`,
      status: 'completed'
    });
    
    traceLogs.push({
      step: 9,
      timestamp: new Date().toISOString(),
      action: 'Analysis Complete',
      details: `Analysis completed with ${riskIndicators.length} risk indicators and score ${riskScore}`,
      status: 'completed'
    });

    return {
      summary: {
        totalTransactions: transactions.length,
        recentTransactions: recentTransactions.length,
        highValueTransactions: highValueTransactions.length,
        uniqueMerchants: allMerchants.size,
        recentMerchants: recentMerchants.size,
        avgTransactionValue: recentTransactions.length > 0 
          ? recentTransactions.reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0) / recentTransactions.length 
          : 0
      },
      riskIndicators,
      riskScore,
      patterns: {
        merchantDistribution: Object.entries(merchantCounts)
          .sort(([,a], [,b]) => Number(b) - Number(a))
          .slice(0, 10),
        hourlySpending,
        dailySpending
      },
      recommendations: this.generateRecommendations(riskIndicators, riskScore),
      traceLogs
    };
  }

  private calculateOverallRiskScore(riskIndicators: any[]): number {
    let score = 0;
    
    riskIndicators.forEach(indicator => {
      switch (indicator.severity) {
        case 'high':
          score += indicator.value * 3;
          break;
        case 'medium':
          score += indicator.value * 2;
          break;
        case 'low':
          score += indicator.value * 1;
          break;
      }
    });
    
    return Math.min(score, 100); // Cap at 100
  }

  private generateRecommendations(riskIndicators: any[], riskScore: number): string[] {
    const recommendations = [];
    
    if (riskScore > 70) {
      recommendations.push('Immediate review required - high risk detected');
    } else if (riskScore > 40) {
      recommendations.push('Enhanced monitoring recommended');
    }
    
    riskIndicators.forEach(indicator => {
      switch (indicator.type) {
        case 'high_velocity':
          recommendations.push('Consider velocity limits for this customer');
          break;
        case 'large_amounts':
          recommendations.push('Review large transaction patterns');
          break;
        case 'unusual_spending':
          recommendations.push('Investigate spending pattern anomalies');
          break;
        case 'new_merchants':
          recommendations.push('Monitor for merchant diversification');
          break;
      }
    });
    
    return recommendations;
  }

  async getFraudTriage(page: number = 1, size: number = 20) {
    try {
      const offset = (page - 1) * size;
      
      // Get total count of high-risk transactions
      const totalCount = await this.transactionRepository
        .createQueryBuilder('transaction')
        .where('ABS(transaction.amount) > :threshold', { threshold: 5000 })
        .getCount();

      // Get recent high-risk transactions with customer data in a single optimized query
      const highRiskTransactions = await this.transactionRepository
        .createQueryBuilder('transaction')
        .leftJoinAndSelect('transaction.customer', 'customer')
        .where('ABS(transaction.amount) > :threshold', { threshold: 5000 })
        .orderBy('transaction.timestamp', 'DESC')
        .limit(size)
        .offset(offset)
        .getMany();

      // Get unique customer IDs for batch transaction count lookup
      const customerIds = [...new Set(highRiskTransactions.map(txn => txn.customerId))];
      
      // Batch get transaction counts for all customers in one query
      const customerTransactionCounts = await this.transactionRepository
        .createQueryBuilder('transaction')
        .select('transaction.customerId', 'customerId')
        .addSelect('COUNT(transaction.id)', 'count')
        .where('transaction.customerId IN (:...customerIds)', { customerIds })
        .groupBy('transaction.customerId')
        .getRawMany();

      // Create a map for quick lookup
      const transactionCountMap = new Map();
      customerTransactionCounts.forEach(item => {
        transactionCountMap.set(item.customerId, parseInt(item.count));
      });

      // Transform to fraud triage format
      const fraudTriage = highRiskTransactions.map(txn => {
        const riskLevel = this.calculateRiskLevel(txn.amount);
        const riskScore = this.calculateRiskScore(txn.amount, riskLevel);
        
        return {
          id: `alert_${txn.id}`,
          customerId: txn.customerId,
          customerName: txn.customer?.name || 'Unknown',
          transactionId: txn.id,
          amount: txn.amount,
          merchant: txn.merchant || 'Unknown Merchant',
          timestamp: txn.timestamp,
          riskLevel: riskLevel,
          riskScore: riskScore,
          status: this.getRandomStatus(),
          lastFour: '****',
          location: txn.geo?.city || 'Unknown',
          transactionCount: transactionCountMap.get(txn.customerId) || 0,
        };
      });

      const totalPages = Math.ceil(totalCount / size);

      console.log(`Debug: Returning ${fraudTriage.length} fraud triage alerts (optimized)`);

      return {
        data: fraudTriage,
        pagination: {
          page,
          size,
          total: totalCount,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      };
    } catch (error) {
      console.error('Error fetching fraud triage data:', error);
      throw new Error('Failed to fetch fraud triage data');
    }
  }

  async getDisputes() {
    try {
      // Get all disputes (chargebacks) with customer info
      const disputes = await this.chargebackRepository
        .createQueryBuilder('chargeback')
        .leftJoinAndSelect('chargeback.customer', 'customer')
        .orderBy('chargeback.createdAt', 'DESC')
        .getMany();

      return disputes.map(dispute => ({
        id: dispute.id,
        transactionId: dispute.transactionId,
        customerId: dispute.customerId,
        customerName: dispute.customer?.name || 'Unknown',
        amount: dispute.amount,
        reason: dispute.reason,
        status: dispute.status,
        createdAt: dispute.createdAt,
        updatedAt: dispute.updatedAt,
      }));
    } catch (error) {
      console.error('Error fetching disputes:', error);
      throw new Error('Failed to fetch disputes');
    }
  }

  private calculateRiskLevel(amount: number): 'low' | 'medium' | 'high' {
    if (amount > 100000) return 'high';
    if (amount > 50000) return 'medium';
    return 'low';
  }

  private calculateRiskScore(amount: number, riskLevel: string): number {
    // Base score based on amount
    let baseScore = Math.min(amount / 1000, 100); // Cap at 100
    
    // Add randomness for realistic variation
    const variation = (Math.random() - 0.5) * 20;
    let score = Math.max(0, Math.min(100, baseScore + variation));
    
    // Adjust based on risk level
    switch (riskLevel) {
      case 'high':
        score = Math.max(75, score);
        break;
      case 'medium':
        score = Math.max(40, Math.min(75, score));
        break;
      case 'low':
        score = Math.min(40, score);
        break;
    }
    
    return Math.round(score);
  }

  private getRandomStatus(): 'pending' | 'investigating' | 'resolved' {
    const statuses = ['pending', 'investigating', 'resolved'];
    return statuses[Math.floor(Math.random() * statuses.length)] as 'pending' | 'investigating' | 'resolved';
  }
}

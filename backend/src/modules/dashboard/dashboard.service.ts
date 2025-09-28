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
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
      const sixtyDaysAgo = new Date(now.getTime() - (60 * 24 * 60 * 60 * 1000));

      // Get total spend from last 30 days (positive amounts only)
      const totalSpendResult = await this.transactionRepository
        .createQueryBuilder('transaction')
        .select('SUM(transaction.amount)', 'total')
        .where('transaction.amount > 0')
        .andWhere('transaction.timestamp >= :thirtyDaysAgo', { thirtyDaysAgo })
        .getRawOne();
      
      const totalSpend = parseInt(totalSpendResult?.total || '0');

      // Get total spend from previous 30 days for comparison
      const previousSpendResult = await this.transactionRepository
        .createQueryBuilder('transaction')
        .select('SUM(transaction.amount)', 'total')
        .where('transaction.amount > 0')
        .andWhere('transaction.timestamp >= :sixtyDaysAgo', { sixtyDaysAgo })
        .andWhere('transaction.timestamp < :thirtyDaysAgo', { thirtyDaysAgo })
        .getRawOne();
      
      const previousSpend = parseInt(previousSpendResult?.total || '0');
      const spendChange = previousSpend > 0 ? ((totalSpend - previousSpend) / previousSpend) * 100 : 0;

      // Get high risk alerts (transactions with high amounts)
      const highRiskAlerts = await this.transactionRepository
        .createQueryBuilder('transaction')
        .where('ABS(transaction.amount) > :threshold', { threshold: 50000 }) // > 500 INR
        .andWhere('transaction.timestamp >= :thirtyDaysAgo', { thirtyDaysAgo })
        .getCount();

      // Get previous period high risk alerts for comparison
      const previousHighRiskAlerts = await this.transactionRepository
        .createQueryBuilder('transaction')
        .where('ABS(transaction.amount) > :threshold', { threshold: 50000 })
        .andWhere('transaction.timestamp >= :sixtyDaysAgo', { sixtyDaysAgo })
        .andWhere('transaction.timestamp < :thirtyDaysAgo', { thirtyDaysAgo })
        .getCount();

      const highRiskChange = previousHighRiskAlerts > 0 ? 
        ((highRiskAlerts - previousHighRiskAlerts) / previousHighRiskAlerts) * 100 : 0;

      // Get disputes opened in last 30 days
      const disputesOpened = await this.chargebackRepository
        .createQueryBuilder('chargeback')
        .where('chargeback.createdAt >= :thirtyDaysAgo', { thirtyDaysAgo })
        .getCount();

      // Get previous period disputes for comparison
      const previousDisputes = await this.chargebackRepository
        .createQueryBuilder('chargeback')
        .where('chargeback.createdAt >= :sixtyDaysAgo', { sixtyDaysAgo })
        .andWhere('chargeback.createdAt < :thirtyDaysAgo', { thirtyDaysAgo })
        .getCount();

      const disputesChange = previousDisputes > 0 ? 
        ((disputesOpened - previousDisputes) / previousDisputes) * 100 : 0;

      // Calculate average triage time (mock for now, but could be calculated from actual triage sessions)
      const avgTriageTime = 2.5; // minutes

      return {
        totalSpend,
        spendChange: Math.round(spendChange * 10) / 10,
        highRiskAlerts,
        highRiskChange: Math.round(highRiskChange * 10) / 10,
        disputesOpened,
        disputesChange: Math.round(disputesChange * 10) / 10,
        avgTriageTime,
      };
    } catch (error) {
      console.error('Error fetching dashboard KPIs:', error);
      throw new Error('Failed to fetch dashboard KPIs');
    }
  }

  async getFraudTriage() {
    try {
      // Get recent high-risk transactions that need triage
      const highRiskTransactions = await this.transactionRepository
        .createQueryBuilder('transaction')
        .where('ABS(transaction.amount) > :threshold', { threshold: 5000 }) // > 50 INR (using absolute value)
        .orderBy('transaction.timestamp', 'DESC')
        .limit(20)
        .getMany();

      // Transform to fraud triage format
      const fraudTriage = [];
      
      for (const txn of highRiskTransactions) {
        const riskLevel = this.calculateRiskLevel(txn.amount);
        const riskScore = this.calculateRiskScore(txn.amount, riskLevel);
        
        // Get transaction count for this customer
        const transactionCount = await this.transactionRepository.count({
          where: { customerId: txn.customerId }
        });
        
        // Get customer data manually
        const customer = await this.customerRepository.findOne({
          where: { id: txn.customerId }
        });
        
        const alert = {
          id: `alert_${txn.id}`,
          customerId: txn.customerId,
          customerName: customer?.name || 'Unknown',
          transactionId: txn.id,
          amount: txn.amount,
          merchant: txn.merchant || 'Unknown Merchant',
          timestamp: txn.timestamp,
          riskLevel: riskLevel,
          riskScore: riskScore,
          status: this.getRandomStatus(),
          lastFour: '****', // We'll get this from card lookup if needed
          location: txn.geo?.city || 'Unknown',
          transactionCount: transactionCount,
        };
        
        console.log(`Debug: Created alert for ${txn.id}, customerId: ${alert.customerId}, customerName: ${alert.customerName}`);
        fraudTriage.push(alert);
      }

      console.log(`Debug: Returning ${fraudTriage.length} fraud triage alerts`);
      console.log(`Debug: First alert:`, JSON.stringify(fraudTriage[0], null, 2));
      return fraudTriage;
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

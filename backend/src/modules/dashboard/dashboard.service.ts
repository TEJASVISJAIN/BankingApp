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
      // Get total spend from transactions
      const totalSpendResult = await this.transactionRepository
        .createQueryBuilder('transaction')
        .select('SUM(transaction.amount)', 'total')
        .getRawOne();
      
      const totalSpend = parseInt(totalSpendResult?.total || '0');

      // Get total transactions count
      const totalTransactions = await this.transactionRepository.count();

      // Get high risk alerts (transactions with high amounts or suspicious patterns)
      const highRiskAlerts = await this.transactionRepository
        .createQueryBuilder('transaction')
        .where('transaction.amount > :threshold', { threshold: 100000 }) // > 1000 INR
        .getCount();

      // Get disputes opened (chargebacks)
      const disputesOpened = await this.chargebackRepository.count();

      // Calculate fraud rate
      const fraudRate = totalTransactions > 0 ? (disputesOpened / totalTransactions) * 100 : 0;

      // Calculate average triage time (mock data for now)
      const avgTriageTime = 2.5; // minutes

      return {
        totalSpend,
        totalTransactions,
        highRiskAlerts,
        disputesOpened,
        avgTriageTime,
        fraudRate: Math.round(fraudRate * 100) / 100,
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
        .leftJoinAndSelect('transaction.customer', 'customer')
        .where('transaction.amount > :threshold', { threshold: 50000 }) // > 500 INR
        .orderBy('transaction.timestamp', 'DESC')
        .limit(20)
        .getMany();

      // Transform to fraud triage format
      const fraudTriage = highRiskTransactions.map((txn, index) => {
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
          lastFour: '****', // We'll get this from card lookup if needed
          location: txn.deviceInfo?.location || 'Unknown',
        };
      });

      return fraudTriage;
    } catch (error) {
      console.error('Error fetching fraud triage data:', error);
      throw new Error('Failed to fetch fraud triage data');
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

import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { GroqService } from '../../services/groq.service';
import { secureLogger } from '../../utils/logger';

export interface RiskSignal {
  type: 'velocity' | 'amount' | 'location' | 'merchant' | 'device' | 'time';
  severity: 'low' | 'medium' | 'high';
  score: number;
  description: string;
  metadata?: any;
}

export interface FraudAssessment {
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  signals: RiskSignal[];
  recommendation: 'monitor' | 'investigate' | 'block';
  confidence: number;
  reasoning: string[];
}

export interface TransactionContext {
  transactionId: string;
  customerId: string;
  cardId: string;
  amount: number;
  merchant: string;
  mcc: string;
  timestamp: Date;
  deviceId?: string;
  geo?: {
    lat: number;
    lon: number;
    country: string;
    city: string;
  };
}

@Injectable()
export class FraudAgentService {
  private readonly VELOCITY_THRESHOLD = 5; // transactions per hour
  private readonly AMOUNT_THRESHOLD = 50000; // ₹500 in cents
  private readonly GEO_VELOCITY_THRESHOLD = 1000; // km in 1 hour
  private readonly UNUSUAL_MERCHANT_THRESHOLD = 0.1; // 10% of customer's transactions

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly groqService: GroqService
  ) {}

  async assessFraud(context: TransactionContext, kbResults?: any): Promise<FraudAssessment> {
    const start = Date.now();
    
    try {
      secureLogger.info('Fraud assessment started', {
        transactionId: context.transactionId,
        customerId: context.customerId,
        amount: context.amount,
      });

      // Gather customer data for analysis
      const customerData = await this.getCustomerContext(context.customerId);
      
      // Run all risk detection rules
      const signals = await Promise.all([
        this.checkVelocityAnomaly(context, customerData),
        this.checkAmountAnomaly(context, customerData),
        this.checkLocationAnomaly(context, customerData),
        this.checkMerchantAnomaly(context, customerData),
        this.checkDeviceAnomaly(context, customerData),
        this.checkTimeAnomaly(context, customerData),
      ]);

      // Filter out null signals
      const validSignals = signals.filter(signal => signal !== null) as RiskSignal[];

      // Calculate overall risk score
      const riskScore = this.calculateRiskScore(validSignals);
      const riskLevel = this.determineRiskLevel(riskScore);
      const recommendation = this.getRecommendation(riskLevel, validSignals);
      const confidence = this.calculateConfidence(validSignals);
      
      // Generate enhanced reasoning using Groq
      let reasoning: string[];
      try {
        const groqRiskSummary = await this.groqService.generateRiskSummary(
          validSignals,
          customerData.customer,
          context
        );
        reasoning = [
          groqRiskSummary.riskSummary,
          groqRiskSummary.explanation,
          ...groqRiskSummary.recommendations
        ];
      } catch (error) {
        secureLogger.warn('Groq risk summary failed, using fallback', { error: error.message });
        reasoning = this.generateReasoning(validSignals);
      }

      const assessment: FraudAssessment = {
        riskScore,
        riskLevel,
        signals: validSignals,
        recommendation,
        confidence,
        reasoning,
      };

      const duration = Date.now() - start;
      
      secureLogger.info('Fraud assessment completed', {
        transactionId: context.transactionId,
        riskScore,
        riskLevel,
        signalCount: validSignals.length,
        duration,
      });

      return assessment;
    } catch (error) {
      secureLogger.error('Fraud assessment failed', {
        transactionId: context.transactionId,
        error: (error as Error).message,
        stack: (error as Error).stack,
      });
      throw error;
    }
  }

  private async getCustomerContext(customerId: string): Promise<any> {
    const customer = await this.databaseService.findCustomerById(customerId);
    const transactions = await this.databaseService.findTransactionsByCustomer(customerId, 100);
    const devices = await this.databaseService.findDevicesByCustomer(customerId);
    const chargebacks = await this.databaseService.findChargebacksByCustomer(customerId);

    return {
      customer,
      transactions,
      devices,
      chargebacks,
    };
  }

  private async checkVelocityAnomaly(context: TransactionContext, customerData: any): Promise<RiskSignal | null> {
    try {
      const oneHourAgo = new Date(context.timestamp.getTime() - 60 * 60 * 1000);
      const oneDayAgo = new Date(context.timestamp.getTime() - 24 * 60 * 60 * 1000);
      
      const recentTransactions = customerData.transactions.filter(
        (tx: any) => new Date(tx.timestamp) > oneHourAgo
      );
      
      const dailyTransactions = customerData.transactions.filter(
        (tx: any) => new Date(tx.timestamp) > oneDayAgo
      );

      // Calculate customer's typical velocity patterns
      const avgDailyTransactions = dailyTransactions.length;
      const velocityRatio = recentTransactions.length / Math.max(avgDailyTransactions / 24, 1);
      
      // Dynamic threshold based on customer's typical behavior
      const dynamicThreshold = Math.max(this.VELOCITY_THRESHOLD, Math.ceil(avgDailyTransactions / 12));
      
      if (recentTransactions.length >= dynamicThreshold || velocityRatio > 3) {
        const severity = velocityRatio > 5 ? 'high' : velocityRatio > 3 ? 'medium' : 'low';
        return {
          type: 'velocity',
          severity,
          score: Math.min(velocityRatio / 2, 3),
          description: `High transaction velocity: ${recentTransactions.length} transactions in the last hour (${velocityRatio.toFixed(1)}x normal rate)`,
          metadata: { 
            transactionCount: recentTransactions.length, 
            threshold: dynamicThreshold,
            velocityRatio: velocityRatio.toFixed(2),
            avgDailyTransactions
          },
        };
      }

      return null;
    } catch (error) {
      secureLogger.error('Velocity anomaly check failed', { error: error.message });
      return null;
    }
  }

  private async checkAmountAnomaly(context: TransactionContext, customerData: any): Promise<RiskSignal | null> {
    try {
      if (customerData.transactions.length === 0) return null;
      
      const recentTransactions = customerData.transactions.slice(0, 30); // Last 30 transactions
      const amounts = recentTransactions.map((tx: any) => tx.amount);
      
      // Calculate statistical measures
      const avgAmount = amounts.reduce((sum: number, amount: number) => sum + amount, 0) / amounts.length;
      const sortedAmounts = amounts.sort((a: number, b: number) => a - b);
      const medianAmount = sortedAmounts[Math.floor(sortedAmounts.length / 2)];
      
      // Calculate standard deviation for more sophisticated analysis
      const variance = amounts.reduce((sum: number, amount: number) => sum + Math.pow(amount - avgAmount, 2), 0) / amounts.length;
      const stdDev = Math.sqrt(variance);
      
      // Dynamic threshold based on customer's spending patterns
      const dynamicThreshold = Math.max(this.AMOUNT_THRESHOLD, avgAmount * 3);
      const zScore = (context.amount - avgAmount) / (stdDev || 1);
      
      if (context.amount > dynamicThreshold || zScore > 2) {
        const amountRatio = context.amount / (avgAmount || 1);
        const severity = zScore > 4 ? 'high' : zScore > 2 ? 'medium' : 'low';
        
        return {
          type: 'amount',
          severity,
          score: Math.min(zScore / 2, 3),
          description: `Unusual transaction amount: ₹${(context.amount / 100).toLocaleString()} (${amountRatio.toFixed(1)}x average, z-score: ${zScore.toFixed(1)})`,
          metadata: { 
            amount: context.amount, 
            avgAmount, 
            medianAmount,
            stdDev,
            zScore: zScore.toFixed(2),
            ratio: amountRatio.toFixed(2),
            threshold: dynamicThreshold 
          },
        };
      }

      return null;
    } catch (error) {
      secureLogger.error('Amount anomaly check failed', { error: error.message });
      return null;
    }
  }

  private async checkLocationAnomaly(context: TransactionContext, customerData: any): Promise<RiskSignal | null> {
    try {
      if (!context.geo) return null;

      const recentTransactions = customerData.transactions
        .filter((tx: any) => tx.deviceInfo?.geo)
        .slice(0, 20);

      if (recentTransactions.length === 0) return null;

      // Check multiple recent locations for better pattern analysis
      const distances = recentTransactions.map((tx: any) => {
        const distance = this.calculateDistance(
          context.geo.lat, context.geo.lon,
          tx.deviceInfo.geo.lat, tx.deviceInfo.geo.lon
        );
        return { distance, timestamp: new Date(tx.timestamp) };
      });

      // Find the closest recent transaction
      const closestTransaction = distances.reduce((min, current) => 
        current.distance < min.distance ? current : min
      );

      // Calculate time-based velocity (distance/time)
      const timeDiff = (context.timestamp.getTime() - closestTransaction.timestamp.getTime()) / (1000 * 60 * 60); // hours
      const velocity = closestTransaction.distance / Math.max(timeDiff, 0.1); // km/h

      // Dynamic threshold based on time and typical travel patterns
      const maxReasonableVelocity = 1000; // km/h (commercial flight speed)
      const impossibleTravel = velocity > maxReasonableVelocity && closestTransaction.distance > 100;

      if (impossibleTravel || closestTransaction.distance > this.GEO_VELOCITY_THRESHOLD) {
        const severity = velocity > maxReasonableVelocity ? 'high' : 'medium';
        return {
          type: 'location',
          severity,
          score: Math.min(closestTransaction.distance / this.GEO_VELOCITY_THRESHOLD, 3),
          description: `Suspicious location: ${Math.round(closestTransaction.distance)}km from last transaction (${velocity.toFixed(0)} km/h)`,
          metadata: { 
            distance: closestTransaction.distance, 
            velocity: velocity.toFixed(1),
            threshold: this.GEO_VELOCITY_THRESHOLD,
            timeDiff: timeDiff.toFixed(1)
          },
        };
      }

      return null;
    } catch (error) {
      secureLogger.error('Location anomaly check failed', { error: error.message });
      return null;
    }
  }

  private async checkMerchantAnomaly(context: TransactionContext, customerData: any): Promise<RiskSignal | null> {
    try {
      const merchantCounts = customerData.transactions.reduce((counts: any, tx: any) => {
        counts[tx.merchant] = (counts[tx.merchant] || 0) + 1;
        return counts;
      }, {});

      const totalTransactions = customerData.transactions.length;
      const merchantFrequency = (merchantCounts[context.merchant] || 0) / totalTransactions;

      if (merchantFrequency < this.UNUSUAL_MERCHANT_THRESHOLD) {
        return {
          type: 'merchant',
          severity: 'medium',
          score: 1.5,
          description: `Unusual merchant: ${context.merchant} (${Math.round(merchantFrequency * 100)}% of transactions)`,
          metadata: { merchant: context.merchant, frequency: merchantFrequency },
        };
      }

      return null;
    } catch (error) {
      secureLogger.error('Merchant anomaly check failed', { error: error.message });
      return null;
    }
  }

  private async checkDeviceAnomaly(context: TransactionContext, customerData: any): Promise<RiskSignal | null> {
    try {
      if (!context.deviceId) return null;

      const knownDevices = customerData.devices.map((device: any) => device.id);
      
      if (!knownDevices.includes(context.deviceId)) {
        return {
          type: 'device',
          severity: 'medium',
          score: 2,
          description: `Unknown device used for transaction`,
          metadata: { deviceId: context.deviceId, knownDevices },
        };
      }

      return null;
    } catch (error) {
      secureLogger.error('Device anomaly check failed', { error: error.message });
      return null;
    }
  }

  private async checkTimeAnomaly(context: TransactionContext, customerData: any): Promise<RiskSignal | null> {
    try {
      const hour = context.timestamp.getHours();
      
      // Check for transactions outside normal hours (2 AM - 6 AM)
      if (hour >= 2 && hour <= 6) {
        return {
          type: 'time',
          severity: 'low',
          score: 1,
          description: `Transaction during unusual hours: ${hour}:00`,
          metadata: { hour, timestamp: context.timestamp },
        };
      }

      return null;
    } catch (error) {
      secureLogger.error('Time anomaly check failed', { error: error.message });
      return null;
    }
  }

  private calculateRiskScore(signals: RiskSignal[]): number {
    if (signals.length === 0) return 0;

    const totalScore = signals.reduce((sum, signal) => sum + signal.score, 0);
    const maxPossibleScore = signals.length * 3; // Max score per signal is 3
    
    return Math.min(totalScore / maxPossibleScore, 1);
  }

  private determineRiskLevel(riskScore: number): 'low' | 'medium' | 'high' {
    if (riskScore >= 0.9) return 'high';
    if (riskScore >= 0.5) return 'medium';
    return 'low';
  }

  private getRecommendation(riskLevel: string, signals: RiskSignal[]): 'monitor' | 'investigate' | 'block' {
    if (riskLevel === 'high') return 'block';
    if (riskLevel === 'medium') return 'investigate';
    if (signals.length > 0) return 'investigate';
    return 'monitor';
  }

  private calculateConfidence(signals: RiskSignal[]): number {
    if (signals.length === 0) return 0.5;
    
    const highSeverityCount = signals.filter(s => s.severity === 'high').length;
    const mediumSeverityCount = signals.filter(s => s.severity === 'medium').length;
    
    return Math.min(0.5 + (highSeverityCount * 0.3) + (mediumSeverityCount * 0.1), 1);
  }

  private generateReasoning(signals: RiskSignal[]): string[] {
    return signals.map(signal => signal.description);
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}

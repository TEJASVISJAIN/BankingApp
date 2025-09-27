import { query } from '../utils/database';
import { secureLogger } from '../utils/logger';

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

class FraudAgent {
  private readonly VELOCITY_THRESHOLD = 5; // transactions per hour
  private readonly AMOUNT_THRESHOLD = 50000; // ₹500 in cents
  private readonly GEO_VELOCITY_THRESHOLD = 1000; // km in 1 hour
  private readonly UNUSUAL_MERCHANT_THRESHOLD = 0.1; // 10% of customer's transactions

  async assessTransaction(context: TransactionContext): Promise<FraudAssessment> {
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
      const reasoning = this.generateReasoning(validSignals);

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
      });
      
      // Return safe fallback assessment
      return {
        riskScore: 50,
        riskLevel: 'medium',
        signals: [],
        recommendation: 'investigate',
        confidence: 0.5,
        reasoning: ['Assessment failed - manual review required'],
      };
    }
  }

  private async getCustomerContext(customerId: string) {
    // Get recent transactions (last 30 days)
    const recentTransactions = await query(`
      SELECT amount, merchant, mcc, ts, device_id, geo
      FROM transactions 
      WHERE customer_id = $1 
      AND ts >= NOW() - INTERVAL '30 days'
      ORDER BY ts DESC
      LIMIT 100
    `, [customerId]);

    // Get customer profile
    const customerProfile = await query(`
      SELECT risk_flags, created_at
      FROM customers 
      WHERE id = $1
    `, [customerId]);

    // Get device history
    const deviceHistory = await query(`
      SELECT id as device_id, last_seen
      FROM devices 
      WHERE customer_id = $1
      ORDER BY last_seen DESC
    `, [customerId]);

    return {
      recentTransactions: recentTransactions.rows,
      customerProfile: customerProfile.rows[0],
      deviceHistory: deviceHistory.rows,
    };
  }

  private async checkVelocityAnomaly(context: TransactionContext, customerData: any): Promise<RiskSignal | null> {
    const recentTransactions = customerData.recentTransactions;
    
    // Count transactions in the last hour
    const oneHourAgo = new Date(context.timestamp.getTime() - 60 * 60 * 1000);
    const recentCount = recentTransactions.filter((tx: any) => 
      new Date(tx.ts) > oneHourAgo
    ).length;

    if (recentCount > this.VELOCITY_THRESHOLD) {
      const severity = recentCount > this.VELOCITY_THRESHOLD * 2 ? 'high' : 'medium';
      const score = Math.min(100, (recentCount / this.VELOCITY_THRESHOLD) * 50);
      
      return {
        type: 'velocity',
        severity,
        score,
        description: `High transaction velocity: ${recentCount} transactions in the last hour`,
        metadata: { transactionCount: recentCount, threshold: this.VELOCITY_THRESHOLD },
      };
    }

    return null;
  }

  private async checkAmountAnomaly(context: TransactionContext, customerData: any): Promise<RiskSignal | null> {
    const recentTransactions = customerData.recentTransactions;
    const amount = Math.abs(context.amount);
    
    if (amount > this.AMOUNT_THRESHOLD) {
      // Calculate average transaction amount
      const avgAmount = recentTransactions.reduce((sum: number, tx: any) => 
        sum + Math.abs(tx.amount), 0) / recentTransactions.length;
      
      const ratio = amount / (avgAmount || 1);
      const severity = ratio > 5 ? 'high' : ratio > 2 ? 'medium' : 'low';
      const score = Math.min(100, ratio * 20);
      
      return {
        type: 'amount',
        severity,
        score,
        description: `Unusually large transaction: ₹${(amount / 100).toFixed(2)} (${ratio.toFixed(1)}x average)`,
        metadata: { amount, averageAmount: avgAmount, ratio },
      };
    }

    return null;
  }

  private async checkLocationAnomaly(context: TransactionContext, customerData: any): Promise<RiskSignal | null> {
    if (!context.geo) return null;

    const recentTransactions = customerData.recentTransactions;
    const recentLocations = recentTransactions
      .filter((tx: any) => tx.geo)
      .slice(0, 10)
      .map((tx: any) => JSON.parse(tx.geo));

    if (recentLocations.length === 0) return null;

    // Check for impossible travel (geo-velocity)
    const lastLocation = recentLocations[0];
    if (lastLocation) {
      const distance = this.calculateDistance(
        lastLocation.lat, lastLocation.lon,
        context.geo.lat, context.geo.lon
      );
      
      const timeDiff = (context.timestamp.getTime() - new Date(recentTransactions[0].ts).getTime()) / (1000 * 60 * 60); // hours
      const speed = distance / timeDiff; // km/h
      
      if (speed > this.GEO_VELOCITY_THRESHOLD) {
        return {
          type: 'location',
          severity: 'high',
          score: 90,
          description: `Impossible travel detected: ${distance.toFixed(0)}km in ${timeDiff.toFixed(1)}h (${speed.toFixed(0)}km/h)`,
          metadata: { distance, timeDiff, speed, lastLocation, currentLocation: context.geo },
        };
      }
    }

    return null;
  }

  private async checkMerchantAnomaly(context: TransactionContext, customerData: any): Promise<RiskSignal | null> {
    const recentTransactions = customerData.recentTransactions;
    
    // Count how often this merchant appears in recent transactions
    const merchantCount = recentTransactions.filter((tx: any) => 
      tx.merchant === context.merchant
    ).length;
    
    const merchantRatio = merchantCount / recentTransactions.length;
    
    if (merchantRatio < this.UNUSUAL_MERCHANT_THRESHOLD && recentTransactions.length > 10) {
      return {
        type: 'merchant',
        severity: 'medium',
        score: 60,
        description: `Unusual merchant: ${context.merchant} (${(merchantRatio * 100).toFixed(1)}% of recent transactions)`,
        metadata: { merchant: context.merchant, ratio: merchantRatio },
      };
    }

    return null;
  }

  private async checkDeviceAnomaly(context: TransactionContext, customerData: any): Promise<RiskSignal | null> {
    if (!context.deviceId) return null;

    const deviceHistory = customerData.deviceHistory;
    const isNewDevice = !deviceHistory.some((device: any) => device.device_id === context.deviceId);
    
    if (isNewDevice) {
      return {
        type: 'device',
        severity: 'medium',
        score: 70,
        description: `New device detected: ${context.deviceId}`,
        metadata: { deviceId: context.deviceId, isNewDevice: true },
      };
    }

    return null;
  }

  private async checkTimeAnomaly(context: TransactionContext, customerData: any): Promise<RiskSignal | null> {
    const hour = context.timestamp.getHours();
    
    // Check for transactions at unusual hours (2 AM - 6 AM)
    if (hour >= 2 && hour <= 6) {
      return {
        type: 'time',
        severity: 'low',
        score: 40,
        description: `Transaction at unusual time: ${hour}:00`,
        metadata: { hour, isUnusualTime: true },
      };
    }

    return null;
  }

  private calculateRiskScore(signals: RiskSignal[]): number {
    if (signals.length === 0) return 0;
    
    // Weighted average of signal scores
    const totalWeight = signals.reduce((sum, signal) => {
      const weight = signal.severity === 'high' ? 3 : signal.severity === 'medium' ? 2 : 1;
      return sum + weight;
    }, 0);
    
    const weightedScore = signals.reduce((sum, signal) => {
      const weight = signal.severity === 'high' ? 3 : signal.severity === 'medium' ? 2 : 1;
      return sum + (signal.score * weight);
    }, 0);
    
    return Math.min(100, Math.round(weightedScore / totalWeight));
  }

  private determineRiskLevel(riskScore: number): 'low' | 'medium' | 'high' {
    if (riskScore >= 80) return 'high';
    if (riskScore >= 50) return 'medium';
    return 'low';
  }

  private getRecommendation(riskLevel: string, signals: RiskSignal[]): 'monitor' | 'investigate' | 'block' {
    if (riskLevel === 'high') return 'block';
    if (riskLevel === 'medium' || signals.length > 2) return 'investigate';
    return 'monitor';
  }

  private calculateConfidence(signals: RiskSignal[]): number {
    if (signals.length === 0) return 0.5;
    
    // Higher confidence with more signals and higher severity
    const confidence = signals.reduce((sum, signal) => {
      const severityMultiplier = signal.severity === 'high' ? 0.9 : signal.severity === 'medium' ? 0.7 : 0.5;
      return sum + severityMultiplier;
    }, 0) / signals.length;
    
    return Math.min(0.95, confidence);
  }

  private generateReasoning(signals: RiskSignal[]): string[] {
    return signals.map(signal => {
      switch (signal.type) {
        case 'velocity':
          return `High transaction frequency detected (${signal.metadata?.transactionCount} transactions/hour)`;
        case 'amount':
          return `Large transaction amount (${signal.metadata?.ratio?.toFixed(1)}x average)`;
        case 'location':
          return `Impossible travel detected (${signal.metadata?.speed?.toFixed(0)}km/h)`;
        case 'merchant':
          return `Unusual merchant pattern (${(signal.metadata?.ratio * 100).toFixed(1)}% of recent transactions)`;
        case 'device':
          return `New device detected (${signal.metadata?.deviceId})`;
        case 'time':
          return `Transaction at unusual time (${signal.metadata?.hour}:00)`;
        default:
          return signal.description;
      }
    });
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
}

export const fraudAgent = new FraudAgent();

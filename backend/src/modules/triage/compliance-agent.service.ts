import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { MetricsService } from '../metrics/metrics.service';
import { secureLogger } from '../../utils/logger';

export interface CompliancePolicy {
  id: string;
  name: string;
  type: 'otp' | 'pii' | 'consent' | 'limits' | 'kyc';
  rules: ComplianceRule[];
  isActive: boolean;
}

export interface ComplianceRule {
  id: string;
  condition: string;
  action: 'allow' | 'block' | 'require_otp' | 'require_consent' | 'flag';
  severity: 'low' | 'medium' | 'high';
  description: string;
}

export interface ComplianceCheck {
  passed: boolean;
  violations: ComplianceViolation[];
  requiredActions: string[];
  canProceed: boolean;
  reason?: string;
}

export interface ComplianceViolation {
  policyId: string;
  ruleId: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  action: string;
}

export interface TransactionContext {
  customerId: string;
  transactionId: string;
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
export class ComplianceAgentService {
  private readonly policies: CompliancePolicy[] = [
    {
      id: 'otp_policy',
      name: 'OTP Verification Policy',
      type: 'otp',
      isActive: true,
      rules: [
        {
          id: 'otp_high_amount',
          condition: 'amount > 100000', // > ₹1000
          action: 'require_otp',
          severity: 'high',
          description: 'OTP required for transactions above ₹1000',
        },
        {
          id: 'otp_new_merchant',
          condition: 'new_merchant && amount > 50000', // > ₹500
          action: 'require_otp',
          severity: 'medium',
          description: 'OTP required for new merchants above ₹500',
        },
      ],
    },
    {
      id: 'pii_policy',
      name: 'PII Protection Policy',
      type: 'pii',
      isActive: true,
      rules: [
        {
          id: 'pii_redaction',
          condition: 'always',
          action: 'flag',
          severity: 'high',
          description: 'PII must be redacted in all logs and traces',
        },
        {
          id: 'pii_consent',
          condition: 'data_sharing',
          action: 'require_consent',
          severity: 'high',
          description: 'Explicit consent required for data sharing',
        },
      ],
    },
    {
      id: 'consent_policy',
      name: 'Consent Management Policy',
      type: 'consent',
      isActive: true,
      rules: [
        {
          id: 'consent_marketing',
          condition: 'marketing_communication',
          action: 'require_consent',
          severity: 'medium',
          description: 'Marketing consent required for promotional communications',
        },
        {
          id: 'consent_data_processing',
          condition: 'data_processing',
          action: 'require_consent',
          severity: 'high',
          description: 'Consent required for data processing activities',
        },
      ],
    },
    {
      id: 'limits_policy',
      name: 'Transaction Limits Policy',
      type: 'limits',
      isActive: true,
      rules: [
        {
          id: 'daily_limit',
          condition: 'daily_amount > 500000', // > ₹5000
          action: 'block',
          severity: 'high',
          description: 'Daily transaction limit exceeded',
        },
        {
          id: 'monthly_limit',
          condition: 'monthly_amount > 5000000', // > ₹50000
          action: 'block',
          severity: 'high',
          description: 'Monthly transaction limit exceeded',
        },
        {
          id: 'velocity_limit',
          condition: 'hourly_transactions > 10',
          action: 'block',
          severity: 'medium',
          description: 'Transaction velocity limit exceeded',
        },
      ],
    },
    {
      id: 'kyc_policy',
      name: 'KYC Compliance Policy',
      type: 'kyc',
      isActive: true,
      rules: [
        {
          id: 'kyc_verification',
          condition: 'amount > 200000 && kyc_status != "verified"', // > ₹2000
          action: 'block',
          severity: 'high',
          description: 'KYC verification required for high-value transactions',
        },
        {
          id: 'kyc_documentation',
          condition: 'kyc_documents_missing',
          action: 'flag',
          severity: 'medium',
          description: 'KYC documentation incomplete',
        },
      ],
    },
  ];

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly metricsService: MetricsService
  ) {}

  async checkCompliance(context: TransactionContext, customerData: any): Promise<ComplianceCheck> {
    try {
      secureLogger.info('Starting compliance check', { 
        customerId: context.customerId, 
        transactionId: context.transactionId 
      });

      const violations: ComplianceViolation[] = [];
      const requiredActions: string[] = [];
      let canProceed = true;

      // Check each active policy
      for (const policy of this.policies.filter(p => p.isActive)) {
        const policyResult = await this.checkPolicy(policy, context, customerData);
        
        if (policyResult.violations.length > 0) {
          violations.push(...policyResult.violations);
          
          // Check if any violation blocks the transaction
          const blockingViolations = policyResult.violations.filter(v => v.action === 'block');
          if (blockingViolations.length > 0) {
            canProceed = false;
            // Record action blocked metrics
            blockingViolations.forEach(violation => {
              this.metricsService.recordActionBlocked(policy.id, violation.action);
            });
          }
          
          // Collect required actions
          const actions = policyResult.violations
            .filter(v => v.action !== 'block')
            .map(v => v.action);
          requiredActions.push(...actions);
        }
      }

      const check: ComplianceCheck = {
        passed: violations.length === 0,
        violations,
        requiredActions: [...new Set(requiredActions)], // Remove duplicates
        canProceed,
        reason: canProceed ? undefined : 'Transaction blocked due to compliance violations',
      };

      secureLogger.info('Compliance check completed', {
        customerId: context.customerId,
        passed: check.passed,
        violationCount: violations.length,
        canProceed: check.canProceed,
      });

      return check;
    } catch (error) {
      secureLogger.error('Compliance check failed', { 
        customerId: context.customerId, 
        error: error.message 
      });
      
      // Fail-safe: block transaction if compliance check fails
      return {
        passed: false,
        violations: [{
          policyId: 'system',
          ruleId: 'compliance_check_failed',
          severity: 'high',
          description: 'Compliance check system failure',
          action: 'block',
        }],
        requiredActions: [],
        canProceed: false,
        reason: 'Compliance check system failure - transaction blocked for safety',
      };
    }
  }

  private async checkPolicy(
    policy: CompliancePolicy, 
    context: TransactionContext, 
    customerData: any
  ): Promise<{ violations: ComplianceViolation[] }> {
    const violations: ComplianceViolation[] = [];

    for (const rule of policy.rules) {
      try {
        const ruleResult = await this.checkRule(rule, context, customerData);
        if (!ruleResult.passed) {
          violations.push({
            policyId: policy.id,
            ruleId: rule.id,
            severity: rule.severity,
            description: rule.description,
            action: rule.action,
          });
        }
      } catch (error) {
        secureLogger.error('Rule check failed', { 
          policyId: policy.id, 
          ruleId: rule.id, 
          error: error.message 
        });
      }
    }

    return { violations };
  }

  private async checkRule(
    rule: ComplianceRule, 
    context: TransactionContext, 
    customerData: any
  ): Promise<{ passed: boolean }> {
    try {
      // Evaluate rule condition
      const conditionResult = await this.evaluateCondition(rule.condition, context, customerData);
      
      return { passed: conditionResult };
    } catch (error) {
      secureLogger.error('Rule evaluation failed', { 
        ruleId: rule.id, 
        condition: rule.condition, 
        error: error.message 
      });
      return { passed: false }; // Fail-safe: treat evaluation errors as violations
    }
  }

  private async evaluateCondition(
    condition: string, 
    context: TransactionContext, 
    customerData: any
  ): Promise<boolean> {
    try {
      // Simple condition evaluation (in production, use a proper rule engine)
      const variables = {
        amount: context.amount,
        merchant: context.merchant,
        mcc: context.mcc,
        customerId: context.customerId,
        timestamp: context.timestamp,
        deviceId: context.deviceId,
        // Customer data
        kyc_status: customerData?.kycStatus || 'unknown',
        risk_level: customerData?.riskLevel || 'low',
        // Calculated values
        daily_amount: await this.getDailyAmount(context.customerId),
        monthly_amount: await this.getMonthlyAmount(context.customerId),
        hourly_transactions: await this.getHourlyTransactionCount(context.customerId),
        new_merchant: await this.isNewMerchant(context.customerId, context.merchant),
        data_sharing: customerData?.consentDataSharing || false,
        marketing_communication: customerData?.consentMarketing || false,
        data_processing: customerData?.consentDataProcessing || false,
        kyc_documents_missing: !customerData?.kycDocuments || customerData.kycDocuments.length === 0,
      };

      // Simple condition parser (in production, use a proper expression evaluator)
      return this.parseCondition(condition, variables);
    } catch (error) {
      secureLogger.error('Condition evaluation failed', { condition, error: error.message });
      return false;
    }
  }

  private parseCondition(condition: string, variables: any): boolean {
    try {
      // Replace variable names with values
      let expression = condition;
      for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`\\b${key}\\b`, 'g');
        expression = expression.replace(regex, String(value));
      }

      // Simple arithmetic and comparison evaluation
      // This is a basic implementation - in production, use a proper expression evaluator
      if (expression.includes('>')) {
        const [left, right] = expression.split('>').map(s => s.trim());
        return parseFloat(left) > parseFloat(right);
      }
      if (expression.includes('<')) {
        const [left, right] = expression.split('<').map(s => s.trim());
        return parseFloat(left) < parseFloat(right);
      }
      if (expression.includes('==')) {
        const [left, right] = expression.split('==').map(s => s.trim());
        return left === right;
      }
      if (expression.includes('!=')) {
        const [left, right] = expression.split('!=').map(s => s.trim());
        return left !== right;
      }
      if (expression.includes('&&')) {
        const parts = expression.split('&&').map(s => s.trim());
        return parts.every(part => this.parseCondition(part, variables));
      }
      if (expression.includes('||')) {
        const parts = expression.split('||').map(s => s.trim());
        return parts.some(part => this.parseCondition(part, variables));
      }

      // Boolean values
      if (expression === 'true') return true;
      if (expression === 'false') return false;
      if (expression === 'always') return true;

      return false;
    } catch (error) {
      secureLogger.error('Condition parsing failed', { condition, error: error.message });
      return false;
    }
  }

  private async getDailyAmount(customerId: string): Promise<number> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const transactions = await this.databaseService.findTransactionsByCustomer(customerId, 100);
      const todayTransactions = transactions.filter(t => {
        const tDate = new Date(t.timestamp);
        return tDate >= today && tDate < tomorrow;
      });

      return todayTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    } catch (error) {
      secureLogger.error('Failed to get daily amount', { customerId, error: error.message });
      return 0;
    }
  }

  private async getMonthlyAmount(customerId: string): Promise<number> {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const transactions = await this.databaseService.findTransactionsByCustomer(customerId, 100);
      const monthTransactions = transactions.filter(t => {
        const tDate = new Date(t.timestamp);
        return tDate >= startOfMonth;
      });

      return monthTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    } catch (error) {
      secureLogger.error('Failed to get monthly amount', { customerId, error: error.message });
      return 0;
    }
  }

  private async getHourlyTransactionCount(customerId: string): Promise<number> {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      const transactions = await this.databaseService.findTransactionsByCustomer(customerId, 50);
      const recentTransactions = transactions.filter(t => {
        const tDate = new Date(t.timestamp);
        return tDate >= oneHourAgo;
      });

      return recentTransactions.length;
    } catch (error) {
      secureLogger.error('Failed to get hourly transaction count', { customerId, error: error.message });
      return 0;
    }
  }

  private async isNewMerchant(customerId: string, merchant: string): Promise<boolean> {
    try {
      const transactions = await this.databaseService.findTransactionsByCustomer(customerId, 20);
      const merchantTransactions = transactions.filter(t => t.merchant === merchant);
      
      return merchantTransactions.length === 0;
    } catch (error) {
      secureLogger.error('Failed to check if merchant is new', { customerId, merchant, error: error.message });
      return true; // Assume new if check fails
    }
  }

  async getActivePolicies(): Promise<CompliancePolicy[]> {
    return this.policies.filter(p => p.isActive);
  }

  async updatePolicy(policyId: string, updates: Partial<CompliancePolicy>): Promise<CompliancePolicy | null> {
    const policyIndex = this.policies.findIndex(p => p.id === policyId);
    if (policyIndex === -1) {
      return null;
    }

    this.policies[policyIndex] = { ...this.policies[policyIndex], ...updates };
    return this.policies[policyIndex];
  }
}

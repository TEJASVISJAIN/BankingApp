import { query } from '../utils/database';
import { secureLogger } from '../utils/logger';

export interface ComplianceCheck {
  requiresOtp: boolean;
  requiresVerification: boolean;
  requiresApproval: boolean;
  violations: string[];
  policies: string[];
  riskLevel: 'low' | 'medium' | 'high';
}

export interface OtpValidation {
  isValid: boolean;
  attempts: number;
  maxAttempts: number;
  expiresAt: Date;
  reason?: string;
}

export interface PiiCheck {
  hasPii: boolean;
  redactedContent: string;
  piiTypes: string[];
  riskScore: number;
}

class ComplianceService {
  private readonly OTP_EXPIRY_MINUTES = 5;
  private readonly MAX_OTP_ATTEMPTS = 3;
  private readonly PII_PATTERNS = {
    pan: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    aadhaar: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    phone: /\b(?:\+91|91)?[6-9]\d{9}\b/g,
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
  };

  async checkCompliance(
    action: string,
    customerId: string,
    amount?: number,
    riskScore?: number
  ): Promise<ComplianceCheck> {
    try {
      const violations: string[] = [];
      const policies: string[] = [];
      let requiresOtp = false;
      let requiresVerification = false;
      let requiresApproval = false;
      let riskLevel: 'low' | 'medium' | 'high' = 'low';

      // Get customer risk profile
      const customerProfile = await this.getCustomerRiskProfile(customerId);

      // Check amount-based policies
      if (amount && amount > 100000) { // ₹1000
        violations.push('high_amount_transaction');
        policies.push('OTP_REQUIRED_FOR_HIGH_AMOUNT');
        requiresOtp = true;
        riskLevel = 'medium';
      }

      // Check risk score policies
      if (riskScore && riskScore >= 80) {
        violations.push('high_risk_score');
        policies.push('VERIFICATION_REQUIRED_FOR_HIGH_RISK');
        requiresVerification = true;
        riskLevel = 'high';
      }

      // Check customer risk flags
      if (customerProfile.riskFlags.includes('high_risk_customer')) {
        violations.push('high_risk_customer');
        policies.push('APPROVAL_REQUIRED_FOR_HIGH_RISK_CUSTOMER');
        requiresApproval = true;
        riskLevel = 'high';
      }

      // Check action-specific policies
      switch (action) {
        case 'freeze_card':
          if (riskScore && riskScore >= 70) {
            violations.push('high_risk_freeze');
            policies.push('OTP_REQUIRED_FOR_HIGH_RISK_FREEZE');
            requiresOtp = true;
          }
          break;
        case 'open_dispute':
          if (amount && amount > 50000) { // ₹500
            violations.push('high_amount_dispute');
            policies.push('VERIFICATION_REQUIRED_FOR_HIGH_AMOUNT_DISPUTE');
            requiresVerification = true;
          }
          break;
        case 'contact_customer':
          // No additional checks for contact
          break;
      }

      return {
        requiresOtp,
        requiresVerification,
        requiresApproval,
        violations,
        policies,
        riskLevel,
      };
    } catch (error) {
      secureLogger.error('Compliance check failed', {
        action,
        customerId,
        error: (error as Error).message,
      });

      // Return strict compliance on error
      return {
        requiresOtp: true,
        requiresVerification: true,
        requiresApproval: true,
        violations: ['compliance_check_failed'],
        policies: ['STRICT_COMPLIANCE_ON_ERROR'],
        riskLevel: 'high',
      };
    }
  }

  async validateOtp(
    customerId: string,
    otp: string,
    action: string
  ): Promise<OtpValidation> {
    try {
      // Check if OTP exists and is valid
      const result = await query(`
        SELECT otp_code, attempts, created_at, expires_at
        FROM otp_requests
        WHERE customer_id = $1 AND action = $2 AND status = 'pending'
        ORDER BY created_at DESC
        LIMIT 1
      `, [customerId, action]);

      if (result.rows.length === 0) {
        return {
          isValid: false,
          attempts: 0,
          maxAttempts: this.MAX_OTP_ATTEMPTS,
          expiresAt: new Date(),
          reason: 'No valid OTP found',
        };
      }

      const otpRecord = result.rows[0];
      const now = new Date();
      const expiresAt = new Date(otpRecord.expires_at);

      // Check if OTP is expired
      if (now > expiresAt) {
        await this.markOtpExpired(customerId, action);
        return {
          isValid: false,
          attempts: otpRecord.attempts,
          maxAttempts: this.MAX_OTP_ATTEMPTS,
          expiresAt,
          reason: 'OTP expired',
        };
      }

      // Check if max attempts exceeded
      if (otpRecord.attempts >= this.MAX_OTP_ATTEMPTS) {
        return {
          isValid: false,
          attempts: otpRecord.attempts,
          maxAttempts: this.MAX_OTP_ATTEMPTS,
          expiresAt,
          reason: 'Maximum attempts exceeded',
        };
      }

      // Validate OTP
      const isValid = otpRecord.otp_code === otp;

      if (isValid) {
        await this.markOtpUsed(customerId, action);
        secureLogger.info('OTP validated successfully', {
          customerId,
          action,
          masked: true,
        });
      } else {
        await this.incrementOtpAttempts(customerId, action);
        secureLogger.warn('Invalid OTP attempt', {
          customerId,
          action,
          attempts: otpRecord.attempts + 1,
          masked: true,
        });
      }

      return {
        isValid,
        attempts: otpRecord.attempts + (isValid ? 0 : 1),
        maxAttempts: this.MAX_OTP_ATTEMPTS,
        expiresAt,
        reason: isValid ? undefined : 'Invalid OTP',
      };
    } catch (error) {
      secureLogger.error('OTP validation failed', {
        customerId,
        action,
        error: (error as Error).message,
      });

      return {
        isValid: false,
        attempts: 0,
        maxAttempts: this.MAX_OTP_ATTEMPTS,
        expiresAt: new Date(),
        reason: 'Validation error',
      };
    }
  }

  async generateOtp(customerId: string, action: string): Promise<string> {
    try {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + this.OTP_EXPIRY_MINUTES * 60 * 1000);

      await query(`
        INSERT INTO otp_requests (customer_id, action, otp_code, expires_at, status)
        VALUES ($1, $2, $3, $4, 'pending')
      `, [customerId, action, otp, expiresAt]);

      secureLogger.info('OTP generated', {
        customerId,
        action,
        expiresAt: expiresAt.toISOString(),
        masked: true,
      });

      return otp;
    } catch (error) {
      secureLogger.error('OTP generation failed', {
        customerId,
        action,
        error: (error as Error).message,
      });
      throw new Error('Failed to generate OTP');
    }
  }

  async checkPii(content: string): Promise<PiiCheck> {
    try {
      const piiTypes: string[] = [];
      let redactedContent = content;
      let riskScore = 0;

      // Check for PAN numbers
      if (this.PII_PATTERNS.pan.test(content)) {
        piiTypes.push('pan');
        riskScore += 40;
        redactedContent = redactedContent.replace(this.PII_PATTERNS.pan, '****REDACTED****');
      }

      // Check for Aadhaar numbers
      if (this.PII_PATTERNS.aadhaar.test(content)) {
        piiTypes.push('aadhaar');
        riskScore += 30;
        redactedContent = redactedContent.replace(this.PII_PATTERNS.aadhaar, '****REDACTED****');
      }

      // Check for phone numbers
      if (this.PII_PATTERNS.phone.test(content)) {
        piiTypes.push('phone');
        riskScore += 20;
        redactedContent = redactedContent.replace(this.PII_PATTERNS.phone, '****REDACTED****');
      }

      // Check for email addresses
      if (this.PII_PATTERNS.email.test(content)) {
        piiTypes.push('email');
        riskScore += 15;
        redactedContent = redactedContent.replace(this.PII_PATTERNS.email, '****REDACTED****');
      }

      // Check for SSN
      if (this.PII_PATTERNS.ssn.test(content)) {
        piiTypes.push('ssn');
        riskScore += 35;
        redactedContent = redactedContent.replace(this.PII_PATTERNS.ssn, '****REDACTED****');
      }

      return {
        hasPii: piiTypes.length > 0,
        redactedContent,
        piiTypes,
        riskScore,
      };
    } catch (error) {
      secureLogger.error('PII check failed', {
        error: (error as Error).message,
      });

      return {
        hasPii: false,
        redactedContent: content,
        piiTypes: [],
        riskScore: 0,
      };
    }
  }

  private async getCustomerRiskProfile(customerId: string) {
    const result = await query(`
      SELECT risk_flags, created_at
      FROM customers
      WHERE id = $1
    `, [customerId]);

    return {
      riskFlags: result.rows[0]?.risk_flags || [],
      createdAt: result.rows[0]?.created_at,
    };
  }

  private async markOtpUsed(customerId: string, action: string) {
    await query(`
      UPDATE otp_requests
      SET status = 'used', used_at = NOW()
      WHERE customer_id = $1 AND action = $2 AND status = 'pending'
    `, [customerId, action]);
  }

  private async markOtpExpired(customerId: string, action: string) {
    await query(`
      UPDATE otp_requests
      SET status = 'expired'
      WHERE customer_id = $1 AND action = $2 AND status = 'pending'
    `, [customerId, action]);
  }

  private async incrementOtpAttempts(customerId: string, action: string) {
    await query(`
      UPDATE otp_requests
      SET attempts = attempts + 1
      WHERE customer_id = $1 AND action = $2 AND status = 'pending'
    `, [customerId, action]);
  }
}

export const complianceService = new ComplianceService();

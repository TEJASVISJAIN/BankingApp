import { Router, Request, Response } from 'express';
import { complianceService } from '../services/complianceService';
import { secureLogger } from '../utils/logger';
import { apiKeyAuth } from '../middleware/auth';
import { query } from '../utils/database';

const router = Router();

// POST /api/actions/freeze-card - Freeze a card
router.post('/freeze-card', apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const { cardId, otp, customerId } = req.body;

    if (!cardId || !customerId) {
      return res.status(400).json({
        error: 'Missing required fields: cardId, customerId',
      });
    }

    secureLogger.info('Freeze card request', {
      cardId,
      customerId,
      masked: true,
    });

    // Check compliance
    const compliance = await complianceService.checkCompliance(
      'freeze_card',
      customerId,
      undefined,
      req.body.riskScore
    );

    // If OTP required but not provided
    if (compliance.requiresOtp && !otp) {
      const generatedOtp = await complianceService.generateOtp(customerId, 'freeze_card');
      
      return res.status(200).json({
        status: 'PENDING_OTP',
        message: 'OTP required for this action',
        otpSent: true,
        compliance: {
          requiresOtp: true,
          violations: compliance.violations,
          policies: compliance.policies,
        },
      });
    }

    // If OTP provided, validate it
    if (compliance.requiresOtp && otp) {
      const otpValidation = await complianceService.validateOtp(customerId, otp, 'freeze_card');
      
      if (!otpValidation.isValid) {
        return res.status(400).json({
          status: 'OTP_INVALID',
          message: otpValidation.reason,
          attempts: otpValidation.attempts,
          maxAttempts: otpValidation.maxAttempts,
        });
      }
    }

    // Check if card is already frozen
    const cardCheck = await query(`
      SELECT status FROM cards WHERE id = $1
    `, [cardId]);

    if (cardCheck.rows.length === 0) {
      return res.status(404).json({
        error: 'Card not found',
      });
    }

    if (cardCheck.rows[0].status === 'frozen') {
      return res.status(400).json({
        status: 'ALREADY_FROZEN',
        message: 'Card is already frozen',
      });
    }

    // Freeze the card
    await query(`
      UPDATE cards 
      SET status = 'frozen', updated_at = NOW()
      WHERE id = $1
    `, [cardId]);

    // Log the action
    await query(`
      INSERT INTO actions (customer_id, action_type, card_id, status, session_id, metadata)
      VALUES ($1, 'freeze_card', $2, 'completed', $3, $4)
    `, [
      customerId,
      cardId,
      req.headers['x-session-id'] || 'unknown',
      JSON.stringify({
        compliance,
        otpUsed: compliance.requiresOtp,
        timestamp: new Date().toISOString(),
      }),
    ]);

    secureLogger.info('Card frozen successfully', {
      cardId,
      customerId,
      compliance: compliance.violations,
      masked: true,
    });

    res.json({
      status: 'FROZEN',
      message: 'Card has been frozen successfully',
      cardId,
      frozenAt: new Date().toISOString(),
    });
  } catch (error) {
    secureLogger.error('Freeze card failed', {
      error: (error as Error).message,
      masked: true,
    });

    res.status(500).json({
      error: 'Failed to freeze card',
      details: (error as Error).message,
    });
  }
});

// POST /api/actions/open-dispute - Open a dispute
router.post('/open-dispute', apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const { txnId, reasonCode, confirm, customerId, amount } = req.body;

    if (!txnId || !reasonCode || !customerId) {
      return res.status(400).json({
        error: 'Missing required fields: txnId, reasonCode, customerId',
      });
    }

    if (!confirm) {
      return res.status(400).json({
        error: 'Confirmation required to open dispute',
      });
    }

    secureLogger.info('Open dispute request', {
      txnId,
      reasonCode,
      customerId,
      masked: true,
    });

    // Check compliance
    const compliance = await complianceService.checkCompliance(
      'open_dispute',
      customerId,
      amount,
      req.body.riskScore
    );

    // If verification required
    if (compliance.requiresVerification) {
      return res.status(200).json({
        status: 'PENDING_VERIFICATION',
        message: 'Manual verification required for this dispute',
        compliance: {
          requiresVerification: true,
          violations: compliance.violations,
          policies: compliance.policies,
        },
      });
    }

    // Check if dispute already exists
    const existingDispute = await query(`
      SELECT id FROM chargebacks WHERE transaction_id = $1
    `, [txnId]);

    if (existingDispute.rows.length > 0) {
      return res.status(400).json({
        status: 'DISPUTE_EXISTS',
        message: 'Dispute already exists for this transaction',
        caseId: existingDispute.rows[0].id,
      });
    }

    // Create dispute
    const caseId = `case_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await query(`
      INSERT INTO chargebacks (id, transaction_id, reason_code, status, created_at)
      VALUES ($1, $2, $3, 'open', NOW())
    `, [caseId, txnId, reasonCode]);

    // Log the action
    await query(`
      INSERT INTO actions (customer_id, action_type, transaction_id, status, session_id, metadata)
      VALUES ($1, 'open_dispute', $2, 'completed', $3, $4)
    `, [
      customerId,
      txnId,
      req.headers['x-session-id'] || 'unknown',
      JSON.stringify({
        caseId,
        reasonCode,
        compliance,
        timestamp: new Date().toISOString(),
      }),
    ]);

    secureLogger.info('Dispute opened successfully', {
      caseId,
      txnId,
      reasonCode,
      customerId,
      masked: true,
    });

    res.json({
      status: 'OPEN',
      message: 'Dispute has been opened successfully',
      caseId,
      txnId,
      reasonCode,
      openedAt: new Date().toISOString(),
    });
  } catch (error) {
    secureLogger.error('Open dispute failed', {
      error: (error as Error).message,
      masked: true,
    });

    res.status(500).json({
      error: 'Failed to open dispute',
      details: (error as Error).message,
    });
  }
});

// POST /api/actions/contact-customer - Contact customer
router.post('/contact-customer', apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const { customerId, method, reason, priority } = req.body;

    if (!customerId || !method || !reason) {
      return res.status(400).json({
        error: 'Missing required fields: customerId, method, reason',
      });
    }

    secureLogger.info('Contact customer request', {
      customerId,
      method,
      reason,
      priority,
      masked: true,
    });

    // Check compliance
    const compliance = await complianceService.checkCompliance(
      'contact_customer',
      customerId,
      undefined,
      req.body.riskScore
    );

    // Create contact request
    const contactId = `contact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await query(`
      INSERT INTO actions (customer_id, action_type, status, session_id, metadata)
      VALUES ($1, 'contact_customer', 'pending', $2, $3)
    `, [
      customerId,
      req.headers['x-session-id'] || 'unknown',
      JSON.stringify({
        contactId,
        method,
        reason,
        priority: priority || 'medium',
        compliance,
        timestamp: new Date().toISOString(),
      }),
    ]);

    secureLogger.info('Customer contact initiated', {
      contactId,
      customerId,
      method,
      reason,
      masked: true,
    });

    res.json({
      status: 'PENDING',
      message: 'Customer contact has been initiated',
      contactId,
      method,
      reason,
      priority: priority || 'medium',
      initiatedAt: new Date().toISOString(),
    });
  } catch (error) {
    secureLogger.error('Contact customer failed', {
      error: (error as Error).message,
      masked: true,
    });

    res.status(500).json({
      error: 'Failed to initiate customer contact',
      details: (error as Error).message,
    });
  }
});

// POST /api/actions/generate-otp - Generate OTP for action
router.post('/generate-otp', apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const { customerId, action } = req.body;

    if (!customerId || !action) {
      return res.status(400).json({
        error: 'Missing required fields: customerId, action',
      });
    }

    const otp = await complianceService.generateOtp(customerId, action);

    secureLogger.info('OTP generated', {
      customerId,
      action,
      masked: true,
    });

    res.json({
      message: 'OTP generated successfully',
      otp, // In production, this would be sent via SMS/email
      expiresIn: 5, // minutes
    });
  } catch (error) {
    secureLogger.error('Generate OTP failed', {
      error: (error as Error).message,
      masked: true,
    });

    res.status(500).json({
      error: 'Failed to generate OTP',
      details: (error as Error).message,
    });
  }
});

// POST /api/actions/validate-otp - Validate OTP
router.post('/validate-otp', apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const { customerId, action, otp } = req.body;

    if (!customerId || !action || !otp) {
      return res.status(400).json({
        error: 'Missing required fields: customerId, action, otp',
      });
    }

    const validation = await complianceService.validateOtp(customerId, otp, action);

    res.json({
      isValid: validation.isValid,
      attempts: validation.attempts,
      maxAttempts: validation.maxAttempts,
      expiresAt: validation.expiresAt,
      reason: validation.reason,
    });
  } catch (error) {
    secureLogger.error('Validate OTP failed', {
      error: (error as Error).message,
      masked: true,
    });

    res.status(500).json({
      error: 'Failed to validate OTP',
      details: (error as Error).message,
    });
  }
});

export default router;

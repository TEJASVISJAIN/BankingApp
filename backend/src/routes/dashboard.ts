import { Router } from 'express';
import { query, validationResult } from 'express-validator';
import { createError } from '../middleware/errorHandler';
import { secureLogger } from '../utils/logger';
import { query as dbQuery } from '../utils/database';

const router = Router();

// GET /api/dashboard/kpis
router.get('/kpis', async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR');
    }
    
    secureLogger.info('Dashboard KPIs requested', {
      requestId: req.requestId,
      sessionId: req.sessionId,
    });
    
    // Get total spend
    const spendResult = await dbQuery(`
      SELECT 
        COALESCE(SUM(ABS(amount)), 0) as total_spend,
        COUNT(*) as total_transactions
      FROM transactions 
      WHERE ts >= NOW() - INTERVAL '30 days'
    `);
    
    // Get high risk alerts count
    const riskResult = await dbQuery(`
      SELECT COUNT(*) as high_risk_count
      FROM transactions 
      WHERE ts >= NOW() - INTERVAL '30 days'
      AND ABS(amount) > 50000
    `);
    
    // Get disputes opened
    const disputesResult = await dbQuery(`
      SELECT COUNT(*) as disputes_opened
      FROM transactions 
      WHERE ts >= NOW() - INTERVAL '30 days'
      AND mcc = '6011'
    `);
    
    const kpis = {
      totalSpend: parseInt(spendResult.rows[0]?.total_spend || '0'),
      totalTransactions: parseInt(spendResult.rows[0]?.total_transactions || '0'),
      highRiskAlerts: parseInt(riskResult.rows[0]?.high_risk_count || '0'),
      disputesOpened: parseInt(disputesResult.rows[0]?.disputes_opened || '0'),
      avgTriageTime: 2.5, // Mock value
      fraudRate: 0.15, // Mock value
    };
    
    res.json(kpis);
  } catch (error) {
    next(error);
  }
});

// GET /api/dashboard/fraud-triage
router.get('/fraud-triage', [
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR');
    }
    
    const limit = parseInt(req.query.limit as string || '20');
    
    secureLogger.info('Fraud triage alerts requested', {
      requestId: req.requestId,
      sessionId: req.sessionId,
      limit,
    });
    
    // Get recent high-risk transactions (show any high-value transactions as fraud alerts)
    const result = await dbQuery(`
      SELECT 
        t.id,
        t.customer_id as customerId,
        t.id as transactionId,
        t.amount,
        t.merchant,
        COALESCE(t.ts, NOW() - INTERVAL '1 day' * (RANDOM() * 7)) as timestamp,
        CASE 
          WHEN ABS(t.amount) > 100000 THEN 90
          WHEN ABS(t.amount) > 50000 THEN 70
          WHEN ABS(t.amount) > 10000 THEN 50
          ELSE 30
        END as risk_score,
        CASE 
          WHEN ABS(t.amount) > 100000 THEN 'high'
          WHEN ABS(t.amount) > 50000 THEN 'medium'
          ELSE 'low'
        END as risk_level,
        'pending' as status,
        ARRAY[
          CASE WHEN ABS(t.amount) > 100000 THEN 'High amount transaction' END,
          CASE WHEN t.mcc = '6011' THEN 'ATM withdrawal' END,
          CASE WHEN t.mcc = '5541' THEN 'Gas station transaction' END,
          CASE WHEN t.merchant ILIKE '%hotel%' OR t.merchant ILIKE '%marriott%' OR t.merchant ILIKE '%itc%' THEN 'Hotel transaction' END
        ]::text[] as reasons
      FROM transactions t
      WHERE ABS(t.amount) > 10000
      ORDER BY ABS(t.amount) DESC
      LIMIT $1
    `, [limit]);
    
    const alerts = result.rows.map(row => ({
      id: row.id,
      customerId: row.customerid,
      transactionId: row.transactionid,
      amount: row.amount,
      merchant: row.merchant,
      timestamp: row.timestamp,
      riskScore: row.risk_score,
      riskLevel: row.risk_level,
      status: row.status,
      reasons: row.reasons.filter(r => r !== null),
    }));
    
    res.json(alerts);
  } catch (error) {
    next(error);
  }
});

export { router as dashboardRoutes };

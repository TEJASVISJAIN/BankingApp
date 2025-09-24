import { Router } from 'express';
import { param, query, validationResult } from 'express-validator';
import { insightsService } from '../services/insightsService';
import { createError } from '../middleware/errorHandler';
import { secureLogger } from '../utils/logger';

const router = Router();

// GET /api/insights/:customerId/summary
router.get('/:customerId/summary', [
  param('customerId').isString().withMessage('Customer ID is required'),
  query('from').optional().isISO8601().withMessage('From date must be valid ISO8601'),
  query('to').optional().isISO8601().withMessage('To date must be valid ISO8601'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR');
    }
    
    const { customerId } = req.params;
    const from = req.query.from as string;
    const to = req.query.to as string;
    
    secureLogger.info('Insights summary requested', {
      requestId: req.requestId,
      sessionId: req.sessionId,
      customerId,
      from,
      to,
    });
    
    const summary = await insightsService.getCustomerSummary(customerId, from, to);
    
    res.json(summary);
  } catch (error) {
    next(error);
  }
});

// GET /api/insights/:customerId/merchants
router.get('/:customerId/merchants', [
  param('customerId').isString().withMessage('Customer ID is required'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR');
    }
    
    const { customerId } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;
    
    const merchants = await insightsService.getTopMerchants(customerId, limit);
    
    res.json({ merchants });
  } catch (error) {
    next(error);
  }
});

// GET /api/insights/:customerId/categories
router.get('/:customerId/categories', [
  param('customerId').isString().withMessage('Customer ID is required'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR');
    }
    
    const { customerId } = req.params;
    
    const categories = await insightsService.getSpendCategories(customerId);
    
    res.json({ categories });
  } catch (error) {
    next(error);
  }
});

// GET /api/insights/:customerId/trends
router.get('/:customerId/trends', [
  param('customerId').isString().withMessage('Customer ID is required'),
  query('period').optional().isIn(['daily', 'weekly', 'monthly']).withMessage('Period must be daily, weekly, or monthly'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR');
    }
    
    const { customerId } = req.params;
    const period = (req.query.period as string) || 'monthly';
    
    const trends = await insightsService.getSpendTrends(customerId, period as 'daily' | 'weekly' | 'monthly');
    
    res.json({ trends });
  } catch (error) {
    next(error);
  }
});

// GET /api/insights/:customerId/anomalies
router.get('/:customerId/anomalies', [
  param('customerId').isString().withMessage('Customer ID is required'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR');
    }
    
    const { customerId } = req.params;
    
    const anomalies = await insightsService.getSpendAnomalies(customerId);
    
    res.json({ anomalies });
  } catch (error) {
    next(error);
  }
});

export { router as insightsRoutes };

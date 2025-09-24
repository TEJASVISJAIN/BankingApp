import { Router } from 'express';
import { param, query, validationResult } from 'express-validator';
import { customerService } from '../services/customerService';
import { createError } from '../middleware/errorHandler';
import { secureLogger } from '../utils/logger';

const router = Router();

// GET /api/customer/:id/transactions
router.get('/:id/transactions', [
  param('id').isString().withMessage('Customer ID is required'),
  query('from').optional().isISO8601().withMessage('From date must be valid ISO8601'),
  query('to').optional().isISO8601().withMessage('To date must be valid ISO8601'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('size').optional().isInt({ min: 1, max: 1000 }).withMessage('Size must be between 1 and 1000'),
  query('merchant').optional().isString().withMessage('Merchant filter must be a string'),
  query('mcc').optional().isString().withMessage('MCC filter must be a string'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR');
    }
    
    const { id } = req.params;
    const {
      from,
      to,
      page = '1',
      size = '50',
      merchant,
      mcc,
    } = req.query;
    
    const pageNum = parseInt(page as string);
    const pageSize = parseInt(size as string);
    
    secureLogger.info('Customer transactions requested', {
      requestId: req.requestId,
      sessionId: req.sessionId,
      customerId: id,
      filters: { from, to, merchant, mcc },
      pagination: { page: pageNum, size: pageSize },
    });
    
    const result = await customerService.getTransactions(id, {
      from: from as string,
      to: to as string,
      page: pageNum,
      size: pageSize,
      merchant: merchant as string,
      mcc: mcc as string,
    });
    
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/customer/:id/profile
router.get('/:id/profile', [
  param('id').isString().withMessage('Customer ID is required'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR');
    }
    
    const { id } = req.params;
    
    const profile = await customerService.getProfile(id);
    
    res.json(profile);
  } catch (error) {
    next(error);
  }
});

// GET /api/customer/:id/cards
router.get('/:id/cards', [
  param('id').isString().withMessage('Customer ID is required'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR');
    }
    
    const { id } = req.params;
    
    const cards = await customerService.getCards(id);
    
    res.json({ cards });
  } catch (error) {
    next(error);
  }
});

// GET /api/customer/:id/devices
router.get('/:id/devices', [
  param('id').isString().withMessage('Customer ID is required'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR');
    }
    
    const { id } = req.params;
    
    const devices = await customerService.getDevices(id);
    
    res.json({ devices });
  } catch (error) {
    next(error);
  }
});

export { router as customerRoutes };

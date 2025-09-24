import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { ingestionService } from '../services/ingestionService';
import { createError } from '../middleware/errorHandler';
import { secureLogger } from '../utils/logger';

const router = Router();

// POST /api/ingest/transactions
router.post('/transactions', [
  body('transactions').isArray().withMessage('Transactions must be an array'),
  body('transactions.*.id').isString().withMessage('Transaction ID is required'),
  body('transactions.*.customerId').isString().withMessage('Customer ID is required'),
  body('transactions.*.cardId').isString().withMessage('Card ID is required'),
  body('transactions.*.amount').isNumeric().withMessage('Amount must be numeric'),
  body('transactions.*.ts').isISO8601().withMessage('Timestamp must be valid ISO8601'),
], async (req, res, next) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR');
    }
    
    const { transactions } = req.body;
    const idempotencyKey = req.headers['idempotency-key'] as string;
    
    secureLogger.info('Transaction ingestion started', {
      requestId: req.requestId,
      sessionId: req.sessionId,
      transactionCount: transactions.length,
      idempotencyKey,
    });
    
    const result = await ingestionService.ingestTransactions(transactions, idempotencyKey);
    
    res.json({
      accepted: true,
      count: result.count,
      requestId: req.requestId,
      duplicates: result.duplicates,
      errors: result.errors,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/ingest/customers
router.post('/customers', [
  body('customers').isArray().withMessage('Customers must be an array'),
  body('customers.*.id').isString().withMessage('Customer ID is required'),
  body('customers.*.name').isString().withMessage('Customer name is required'),
  body('customers.*.email_masked').isString().withMessage('Email is required'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR');
    }
    
    const { customers } = req.body;
    const idempotencyKey = req.headers['idempotency-key'] as string;
    
    const result = await ingestionService.ingestCustomers(customers, idempotencyKey);
    
    res.json({
      accepted: true,
      count: result.count,
      requestId: req.requestId,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/ingest/cards
router.post('/cards', [
  body('cards').isArray().withMessage('Cards must be an array'),
  body('cards.*.id').isString().withMessage('Card ID is required'),
  body('cards.*.customerId').isString().withMessage('Customer ID is required'),
  body('cards.*.last4').isString().withMessage('Last 4 digits are required'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR');
    }
    
    const { cards } = req.body;
    const idempotencyKey = req.headers['idempotency-key'] as string;
    
    const result = await ingestionService.ingestCards(cards, idempotencyKey);
    
    res.json({
      accepted: true,
      count: result.count,
      requestId: req.requestId,
    });
  } catch (error) {
    next(error);
  }
});

export { router as ingestionRoutes };

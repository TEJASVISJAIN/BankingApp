import { Router, Request, Response } from 'express';
import { kbAgent } from '../agents/kbAgent';
import { circuitBreakerService } from '../services/circuitBreaker';
import { rateLimiterService } from '../services/rateLimiter';
import { observabilityService } from '../services/observability';
import { secureLogger } from '../utils/logger';
import { apiKeyAuth } from '../middleware/auth';

const router = Router();

// GET /api/kb/search - Search knowledge base
router.get('/search', apiKeyAuth, async (req: Request, res: Response) => {
  const traceId = `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const spanId = `span_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    const { q: query, context } = req.query;
    
    if (!query) {
      return res.status(400).json({
        error: 'Query parameter "q" is required',
      });
    }

    // Start trace
    observabilityService.startTrace(traceId, spanId, 'kb_search');
    
    // Check rate limit
    const rateLimitResult = await rateLimiterService.checkRateLimitByAPI(
      req.headers['x-api-key'] as string,
      { windowMs: 60000, maxRequests: 100 }
    );

    if (!rateLimitResult.allowed) {
      observabilityService.addTraceLog(spanId, 'warn', 'Rate limit exceeded');
      return res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfter: rateLimitResult.retryAfter,
      });
    }

    // Execute with circuit breaker
    const result = await circuitBreakerService.executeWithCircuitBreaker(
      'kb_search',
      () => kbAgent.searchKB(query as string, context),
      () => kbAgent.searchKB(query as string, context) // Fallback to same function
    );

    observabilityService.addTraceTag(spanId, 'query', query);
    observabilityService.addTraceTag(spanId, 'results_count', result.totalResults);
    observabilityService.addTraceTag(spanId, 'fallback_used', result.fallbackUsed);
    observabilityService.endTrace(spanId, 'success');

    res.json(result);
  } catch (error) {
    observabilityService.addTraceLog(spanId, 'error', 'KB search failed', {
      error: (error as Error).message,
    });
    observabilityService.endTrace(spanId, 'error');

    secureLogger.error('KB search failed', {
      query: req.query.q,
      error: (error as Error).message,
      masked: true,
    });

    res.status(500).json({
      error: 'Failed to search knowledge base',
      details: (error as Error).message,
    });
  }
});

// POST /api/kb/documents - Add document to KB
router.post('/documents', apiKeyAuth, async (req: Request, res: Response) => {
  const traceId = `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const spanId = `span_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    const { title, anchor, content, chunks, metadata } = req.body;
    
    if (!title || !anchor || !content) {
      return res.status(400).json({
        error: 'Missing required fields: title, anchor, content',
      });
    }

    // Start trace
    observabilityService.startTrace(traceId, spanId, 'kb_add_document');
    
    // Check rate limit
    const rateLimitResult = await rateLimiterService.checkRateLimitByAPI(
      req.headers['x-api-key'] as string,
      { windowMs: 60000, maxRequests: 50 }
    );

    if (!rateLimitResult.allowed) {
      observabilityService.addTraceLog(spanId, 'warn', 'Rate limit exceeded');
      return res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfter: rateLimitResult.retryAfter,
      });
    }

    // Execute with circuit breaker
    const documentId = await circuitBreakerService.executeWithCircuitBreaker(
      'kb_add_document',
      () => kbAgent.addDocument({
        title,
        anchor,
        content,
        chunks: chunks || [],
        metadata: metadata || {},
      })
    );

    observabilityService.addTraceTag(spanId, 'document_id', documentId);
    observabilityService.addTraceTag(spanId, 'title', title);
    observabilityService.endTrace(spanId, 'success');

    res.json({
      id: documentId,
      message: 'Document added successfully',
    });
  } catch (error) {
    observabilityService.addTraceLog(spanId, 'error', 'KB document addition failed', {
      error: (error as Error).message,
    });
    observabilityService.endTrace(spanId, 'error');

    secureLogger.error('KB document addition failed', {
      error: (error as Error).message,
      masked: true,
    });

    res.status(500).json({
      error: 'Failed to add document',
      details: (error as Error).message,
    });
  }
});

// PUT /api/kb/documents/:id - Update document
router.put('/documents/:id', apiKeyAuth, async (req: Request, res: Response) => {
  const traceId = `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const spanId = `span_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Start trace
    observabilityService.startTrace(traceId, spanId, 'kb_update_document');
    
    // Check rate limit
    const rateLimitResult = await rateLimiterService.checkRateLimitByAPI(
      req.headers['x-api-key'] as string,
      { windowMs: 60000, maxRequests: 50 }
    );

    if (!rateLimitResult.allowed) {
      observabilityService.addTraceLog(spanId, 'warn', 'Rate limit exceeded');
      return res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfter: rateLimitResult.retryAfter,
      });
    }

    // Execute with circuit breaker
    await circuitBreakerService.executeWithCircuitBreaker(
      'kb_update_document',
      () => kbAgent.updateDocument(id, updates)
    );

    observabilityService.addTraceTag(spanId, 'document_id', id);
    observabilityService.endTrace(spanId, 'success');

    res.json({
      message: 'Document updated successfully',
    });
  } catch (error) {
    observabilityService.addTraceLog(spanId, 'error', 'KB document update failed', {
      error: (error as Error).message,
    });
    observabilityService.endTrace(spanId, 'error');

    secureLogger.error('KB document update failed', {
      id: req.params.id,
      error: (error as Error).message,
      masked: true,
    });

    res.status(500).json({
      error: 'Failed to update document',
      details: (error as Error).message,
    });
  }
});

// GET /api/kb/health - KB health check
router.get('/health', apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const healthCheck = await observabilityService.performHealthCheck();
    res.json(healthCheck);
  } catch (error) {
    res.status(500).json({
      error: 'Health check failed',
      details: (error as Error).message,
    });
  }
});

// GET /api/kb/metrics - KB metrics
router.get('/metrics', apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const metrics = await observabilityService.collectMetrics();
    res.json(metrics);
  } catch (error) {
    res.status(500).json({
      error: 'Metrics collection failed',
      details: (error as Error).message,
    });
  }
});

export default router;

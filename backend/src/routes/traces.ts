import { Router, Request, Response } from 'express';
import { traceService } from '../services/traceService';
import { secureLogger } from '../utils/logger';
import { apiKeyAuth } from '../middleware/auth';

const router = Router();

// GET /api/traces/metrics - Get trace metrics
router.get('/metrics', apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const metrics = await traceService.getTraceMetrics(days);
    
    res.json(metrics);
  } catch (error) {
    secureLogger.error('Failed to get trace metrics', {
      error: (error as Error).message,
    });
    
    res.status(500).json({
      error: 'Failed to get trace metrics',
      details: (error as Error).message,
    });
  }
});

// GET /api/traces/recent - Get recent traces
router.get('/recent', apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const traces = await traceService.getRecentTraces(limit);
    
    res.json(traces);
  } catch (error) {
    secureLogger.error('Failed to get recent traces', {
      error: (error as Error).message,
    });
    
    res.status(500).json({
      error: 'Failed to get recent traces',
      details: (error as Error).message,
    });
  }
});

// GET /api/traces/:sessionId - Get specific trace
router.get('/:sessionId', apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const trace = await traceService.getTrace(sessionId);
    
    if (!trace) {
      return res.status(404).json({
        error: 'Trace not found',
      });
    }
    
    res.json(trace);
  } catch (error) {
    secureLogger.error('Failed to get trace', {
      sessionId: req.params.sessionId,
      error: (error as Error).message,
    });
    
    res.status(500).json({
      error: 'Failed to get trace',
      details: (error as Error).message,
    });
  }
});

// POST /api/traces/cleanup - Cleanup old traces
router.post('/cleanup', apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const daysToKeep = parseInt(req.body.daysToKeep) || 30;
    await traceService.cleanupOldTraces(daysToKeep);
    
    res.json({
      message: 'Cleanup completed',
      daysToKeep,
    });
  } catch (error) {
    secureLogger.error('Failed to cleanup traces', {
      error: (error as Error).message,
    });
    
    res.status(500).json({
      error: 'Failed to cleanup traces',
      details: (error as Error).message,
    });
  }
});

export default router;

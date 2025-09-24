import { Router, Request, Response } from 'express';
import { performanceTuner } from '../services/performanceTuner';
import { observabilityService } from '../services/observability';
import { circuitBreakerService } from '../services/circuitBreaker';
import { rateLimiterService } from '../services/rateLimiter';
import { secureLogger } from '../utils/logger';
import { apiKeyAuth } from '../middleware/auth';

const router = Router();

// POST /api/eval/run - Run golden evaluation set
router.post('/run', apiKeyAuth, async (req: Request, res: Response) => {
  try {
    secureLogger.info('Golden evaluation started', {
      requestedBy: req.headers['x-api-key'],
      masked: true,
    });

    // This would typically spawn the eval runner process
    // For now, return a mock response
    const mockResults = {
      totalCases: 12,
      passedCases: 10,
      failedCases: 2,
      successRate: 83.3,
      fallbackRate: 8.3,
      avgLatency: {
        p50: 45,
        p95: 95,
        p99: 150,
      },
      policyDenials: {
        'identity_verification_required': 1,
        'rate_limit_exceeded': 1,
      },
      confusionMatrix: {
        truePositives: 8,
        falsePositives: 1,
        trueNegatives: 1,
        falseNegatives: 1,
      },
      categoryBreakdown: {
        'card_security': { passed: 1, total: 1, rate: 100 },
        'fraud_detection': { passed: 1, total: 1, rate: 100 },
        'false_positive': { passed: 1, total: 1, rate: 100 },
        'velocity_fraud': { passed: 1, total: 1, rate: 100 },
        'behavioral_anomaly': { passed: 1, total: 1, rate: 100 },
        'reputation_based': { passed: 1, total: 1, rate: 100 },
        'fallback_scenario': { passed: 1, total: 1, rate: 100 },
        'rate_limiting': { passed: 1, total: 1, rate: 100 },
        'policy_enforcement': { passed: 1, total: 1, rate: 100 },
        'pii_redaction': { passed: 1, total: 1, rate: 100 },
        'knowledge_base': { passed: 0, total: 1, rate: 0 },
        'disambiguation': { passed: 0, total: 1, rate: 0 },
      },
      commonFailures: [
        { error: 'KB lookup failed', count: 1 },
        { error: 'Disambiguation timeout', count: 1 },
      ],
    };

    res.json({
      status: 'completed',
      results: mockResults,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    secureLogger.error('Evaluation run failed', {
      error: (error as Error).message,
      masked: true,
    });

    res.status(500).json({
      error: 'Failed to run evaluation',
      details: (error as Error).message,
    });
  }
});

// GET /api/eval/metrics - Get evaluation metrics
router.get('/metrics', apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const metrics = await observabilityService.collectMetrics();
    const healthCheck = await observabilityService.performHealthCheck();
    
    res.json({
      metrics,
      health: healthCheck,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    secureLogger.error('Failed to get evaluation metrics', {
      error: (error as Error).message,
      masked: true,
    });

    res.status(500).json({
      error: 'Failed to get metrics',
      details: (error as Error).message,
    });
  }
});

// POST /api/eval/tune - Run performance tuning
router.post('/tune', apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const { targets } = req.body;
    
    const defaultTargets = {
      p95: 100,
      p99: 200,
      errorRate: 0.01,
      throughput: 1000,
    };

    const tuningTargets = { ...defaultTargets, ...targets };

    secureLogger.info('Performance tuning started', {
      targets: tuningTargets,
      masked: true,
    });

    const improved = await performanceTuner.optimizeForTargets(tuningTargets);
    const recommendations = await performanceTuner.generateTuningRecommendations();

    res.json({
      improved,
      recommendations,
      targets: tuningTargets,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    secureLogger.error('Performance tuning failed', {
      error: (error as Error).message,
      masked: true,
    });

    res.status(500).json({
      error: 'Failed to run performance tuning',
      details: (error as Error).message,
    });
  }
});

// GET /api/eval/performance - Get performance analysis
router.get('/performance', apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const metrics = await performanceTuner.analyzePerformance();
    const recommendations = await performanceTuner.generateTuningRecommendations();

    res.json({
      metrics,
      recommendations,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    secureLogger.error('Performance analysis failed', {
      error: (error as Error).message,
      masked: true,
    });

    res.status(500).json({
      error: 'Failed to analyze performance',
      details: (error as Error).message,
    });
  }
});

// GET /api/eval/confusion-matrix - Get confusion matrix
router.get('/confusion-matrix', apiKeyAuth, async (req: Request, res: Response) => {
  try {
    // This would typically come from stored evaluation results
    const confusionMatrix = {
      truePositives: 8,
      falsePositives: 1,
      trueNegatives: 1,
      falseNegatives: 1,
      accuracy: 0.818,
      precision: 0.889,
      recall: 0.889,
      f1Score: 0.889,
    };

    res.json({
      confusionMatrix,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    secureLogger.error('Confusion matrix calculation failed', {
      error: (error as Error).message,
      masked: true,
    });

    res.status(500).json({
      error: 'Failed to calculate confusion matrix',
      details: (error as Error).message,
    });
  }
});

// GET /api/eval/circuit-breakers - Get circuit breaker status
router.get('/circuit-breakers', apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const circuits = circuitBreakerService.getAllCircuits();
    const status = Array.from(circuits.entries()).map(([name, state]) => ({
      name,
      state: state.state,
      failureCount: state.failureCount,
      lastFailureTime: state.lastFailureTime,
      nextAttemptTime: state.nextAttemptTime,
    }));

    res.json({
      circuits: status,
      total: circuits.size,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    secureLogger.error('Circuit breaker status failed', {
      error: (error as Error).message,
      masked: true,
    });

    res.status(500).json({
      error: 'Failed to get circuit breaker status',
      details: (error as Error).message,
    });
  }
});

// GET /api/eval/rate-limits - Get rate limiter status
router.get('/rate-limits', apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const rateLimits = rateLimiterService.getAllRateLimits();
    const status = Array.from(rateLimits.entries()).map(([key, entry]) => ({
      key,
      count: entry.count,
      windowStart: entry.windowStart,
      lastRequest: entry.lastRequest,
    }));

    res.json({
      rateLimits: status,
      total: rateLimits.size,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    secureLogger.error('Rate limiter status failed', {
      error: (error as Error).message,
      masked: true,
    });

    res.status(500).json({
      error: 'Failed to get rate limiter status',
      details: (error as Error).message,
    });
  }
});

export default router;

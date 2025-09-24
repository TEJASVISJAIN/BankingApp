import { Router } from 'express';
import { register, collectDefaultMetrics } from 'prom-client';

const router = Router();

// Collect default metrics
collectDefaultMetrics({ register });

// GET /metrics
router.get('/', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.end(metrics);
  } catch (error) {
    res.status(500).json({ error: 'Failed to collect metrics' });
  }
});

export { router as metricsRoutes };

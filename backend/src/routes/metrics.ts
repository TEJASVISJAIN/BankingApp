import { Router } from 'express';
import { register, collectDefaultMetrics, Counter, Histogram } from 'prom-client';

const router = Router();

// Create custom metrics
const toolCallTotal = new Counter({
  name: 'tool_call_total',
  help: 'Total number of tool calls',
  labelNames: ['tool', 'status'],
});

const agentFallbackTotal = new Counter({
  name: 'agent_fallback_total',
  help: 'Total number of agent fallbacks',
  labelNames: ['tool'],
});

const rateLimitBlockTotal = new Counter({
  name: 'rate_limit_block_total',
  help: 'Total number of rate limit blocks',
});

const agentLatencyMs = new Histogram({
  name: 'agent_latency_ms',
  help: 'Agent latency in milliseconds',
  buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
});

const actionBlockedTotal = new Counter({
  name: 'action_blocked_total',
  help: 'Total number of blocked actions',
  labelNames: ['policy'],
});

// Register custom metrics
register.registerMetric(toolCallTotal);
register.registerMetric(agentFallbackTotal);
register.registerMetric(rateLimitBlockTotal);
register.registerMetric(agentLatencyMs);
register.registerMetric(actionBlockedTotal);

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

// Export metrics for use in other modules
export { 
  toolCallTotal, 
  agentFallbackTotal, 
  rateLimitBlockTotal, 
  agentLatencyMs, 
  actionBlockedTotal 
};

export { router as metricsRoutes };

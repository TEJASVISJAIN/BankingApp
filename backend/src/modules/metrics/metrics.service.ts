import { Injectable } from '@nestjs/common';
import { register, collectDefaultMetrics, Counter, Histogram, Gauge } from 'prom-client';
import { secureLogger } from '../../utils/logger';

@Injectable()
export class MetricsService {
  // Agent latency histogram
  private agentLatencyHistogram: Histogram<string>;
  
  // Tool call counter
  private toolCallCounter: Counter<string>;
  
  // Agent fallback counter
  private agentFallbackCounter: Counter<string>;
  
  // Rate limit block counter
  private rateLimitBlockCounter: Counter<string>;
  
  // Action blocked counter
  private actionBlockedCounter: Counter<string>;

  constructor() {
    // Collect default metrics
    collectDefaultMetrics({ register });

    // Initialize custom metrics
    this.initializeMetrics();
  }

  private initializeMetrics() {
    // Agent latency histogram
    this.agentLatencyHistogram = new Histogram({
      name: 'agent_latency_ms',
      help: 'Agent execution latency in milliseconds',
      labelNames: ['agent', 'operation', 'status'],
      buckets: [10, 50, 100, 200, 500, 1000, 2000, 5000],
    });

    // Tool call counter
    this.toolCallCounter = new Counter({
      name: 'tool_call_total',
      help: 'Total number of tool calls',
      labelNames: ['tool', 'ok'],
    });

    // Agent fallback counter
    this.agentFallbackCounter = new Counter({
      name: 'agent_fallback_total',
      help: 'Total number of agent fallbacks',
      labelNames: ['tool', 'reason'],
    });

    // Rate limit block counter
    this.rateLimitBlockCounter = new Counter({
      name: 'rate_limit_block_total',
      help: 'Total number of rate limit blocks',
      labelNames: ['endpoint', 'session_id'],
    });

    // Action blocked counter
    this.actionBlockedCounter = new Counter({
      name: 'action_blocked_total',
      help: 'Total number of blocked actions',
      labelNames: ['policy', 'action_type'],
    });

    // Register metrics
    register.registerMetric(this.agentLatencyHistogram);
    register.registerMetric(this.toolCallCounter);
    register.registerMetric(this.agentFallbackCounter);
    register.registerMetric(this.rateLimitBlockCounter);
    register.registerMetric(this.actionBlockedCounter);

    secureLogger.info('Custom metrics initialized');
  }

  // Record agent latency
  recordAgentLatency(agent: string, operation: string, latencyMs: number, status: 'success' | 'error' | 'timeout') {
    this.agentLatencyHistogram
      .labels({ agent, operation, status })
      .observe(latencyMs);
    
    secureLogger.info('Agent latency recorded', { agent, operation, latencyMs, status });
  }

  // Record tool call
  recordToolCall(tool: string, success: boolean) {
    this.toolCallCounter
      .labels({ tool, ok: success.toString() })
      .inc();
    
    secureLogger.info('Tool call recorded', { tool, success });
  }

  // Record agent fallback
  recordAgentFallback(tool: string, reason: string) {
    this.agentFallbackCounter
      .labels({ tool, reason })
      .inc();
    
    secureLogger.warn('Agent fallback recorded', { tool, reason });
  }

  // Record rate limit block
  recordRateLimitBlock(endpoint: string, sessionId: string) {
    this.rateLimitBlockCounter
      .labels({ endpoint, session_id: sessionId })
      .inc();
    
    secureLogger.warn('Rate limit block recorded', { endpoint, sessionId });
  }

  // Record action blocked
  recordActionBlocked(policy: string, actionType: string) {
    this.actionBlockedCounter
      .labels({ policy, action_type: actionType })
      .inc();
    
    secureLogger.warn('Action blocked recorded', { policy, actionType });
  }

  async getMetrics(): Promise<string> {
    return register.metrics();
  }

  // Get specific metric values for monitoring
  async getMetricValues() {
    return {
      agentLatency: this.agentLatencyHistogram.get(),
      toolCalls: this.toolCallCounter.get(),
      agentFallbacks: this.agentFallbackCounter.get(),
      rateLimitBlocks: this.rateLimitBlockCounter.get(),
      actionBlocks: this.actionBlockedCounter.get(),
    };
  }
}

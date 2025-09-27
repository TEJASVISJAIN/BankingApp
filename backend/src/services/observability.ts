import { query } from '../utils/database';
import { secureLogger } from '../utils/logger';
import { circuitBreakerService } from './circuitBreaker';
import { rateLimiterService } from './rateLimiter';

// Custom metrics storage
interface CustomMetrics {
  toolCallTotal: Map<string, { total: number; ok: number; error: number }>;
  agentFallbackTotal: Map<string, number>;
  rateLimitBlockTotal: number;
  agentLatencyMs: number[];
  actionBlockedTotal: Map<string, number>;
}

// Global metrics instance
const customMetrics: CustomMetrics = {
  toolCallTotal: new Map(),
  agentFallbackTotal: new Map(),
  rateLimitBlockTotal: 0,
  agentLatencyMs: [],
  actionBlockedTotal: new Map(),
};

// Metrics recording functions
export function recordToolCall(tool: string, success: boolean): void {
  if (!customMetrics.toolCallTotal.has(tool)) {
    customMetrics.toolCallTotal.set(tool, { total: 0, ok: 0, error: 0 });
  }
  
  const toolMetrics = customMetrics.toolCallTotal.get(tool)!;
  toolMetrics.total++;
  if (success) {
    toolMetrics.ok++;
  } else {
    toolMetrics.error++;
  }
}

export function recordAgentFallback(tool: string): void {
  const current = customMetrics.agentFallbackTotal.get(tool) || 0;
  customMetrics.agentFallbackTotal.set(tool, current + 1);
}

export function recordRateLimitBlock(): void {
  customMetrics.rateLimitBlockTotal++;
}

export function recordAgentLatency(latencyMs: number): void {
  customMetrics.agentLatencyMs.push(latencyMs);
  // Keep only last 1000 measurements
  if (customMetrics.agentLatencyMs.length > 1000) {
    customMetrics.agentLatencyMs = customMetrics.agentLatencyMs.slice(-1000);
  }
}

export function recordActionBlocked(policy: string): void {
  const current = customMetrics.actionBlockedTotal.get(policy) || 0;
  customMetrics.actionBlockedTotal.set(policy, current + 1);
}

export interface MetricsData {
  timestamp: number;
  service: string;
  metrics: {
    requests: {
      total: number;
      successful: number;
      failed: number;
      rate: number;
    };
    latency: {
      p50: number;
      p95: number;
      p99: number;
      average: number;
    };
    errors: {
      total: number;
      byType: Record<string, number>;
    };
    circuitBreakers: {
      open: number;
      closed: number;
      halfOpen: number;
    };
    rateLimits: {
      blocked: number;
      allowed: number;
    };
  };
}

export interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: {
    database: boolean;
    redis: boolean;
    circuitBreakers: boolean;
    rateLimiters: boolean;
  };
  uptime: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  timestamp: number;
}

export interface TraceData {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operation: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  tags: Record<string, any>;
  logs: Array<{
    timestamp: number;
    level: string;
    message: string;
    fields: Record<string, any>;
  }>;
  status: 'success' | 'error' | 'timeout';
}

class ObservabilityService {
  private readonly metricsInterval = 30000; // 30 seconds
  private readonly healthCheckInterval = 10000; // 10 seconds
  private readonly startTime = Date.now();
  private metrics: MetricsData[] = [];
  private traces: Map<string, TraceData> = new Map();

  constructor() {
    // Start metrics collection
    setInterval(() => {
      this.collectMetrics();
    }, this.metricsInterval);

    // Start health checks
    setInterval(() => {
      this.performHealthCheck();
    }, this.healthCheckInterval);
  }

  async collectMetrics(): Promise<MetricsData> {
    try {
      const timestamp = Date.now();
      const service = 'aegis-support-api';

      // Get request metrics
      const requestMetrics = await this.getRequestMetrics();
      
      // Get latency metrics
      const latencyMetrics = await this.getLatencyMetrics();
      
      // Get error metrics
      const errorMetrics = await this.getErrorMetrics();
      
      // Get circuit breaker status
      const circuitBreakerStatus = this.getCircuitBreakerStatus();
      
      // Get rate limiter status
      const rateLimiterStatus = this.getRateLimiterStatus();

      const metricsData: MetricsData = {
        timestamp,
        service,
        metrics: {
          requests: requestMetrics,
          latency: latencyMetrics,
          errors: errorMetrics,
          circuitBreakers: circuitBreakerStatus,
          rateLimits: rateLimiterStatus,
        },
      };

      this.metrics.push(metricsData);
      
      // Keep only last 100 metrics
      if (this.metrics.length > 100) {
        this.metrics = this.metrics.slice(-100);
      }

      secureLogger.info('Metrics collected', {
        timestamp,
        service,
        requestCount: requestMetrics.total,
        errorCount: errorMetrics.total,
        masked: true,
      });

      return metricsData;
    } catch (error) {
      secureLogger.error('Failed to collect metrics', {
        error: (error as Error).message,
        masked: true,
      });
      throw error;
    }
  }

  async performHealthCheck(): Promise<HealthCheck> {
    try {
      const timestamp = Date.now();
      const uptime = timestamp - this.startTime;

      // Check database
      const databaseHealthy = await this.checkDatabaseHealth();
      
      // Check Redis (if available)
      const redisHealthy = await this.checkRedisHealth();
      
      // Check circuit breakers
      const circuitBreakersHealthy = this.checkCircuitBreakersHealth();
      
      // Check rate limiters
      const rateLimitersHealthy = this.checkRateLimitersHealth();

      const services = {
        database: databaseHealthy,
        redis: redisHealthy,
        circuitBreakers: circuitBreakersHealthy,
        rateLimiters: rateLimitersHealthy,
      };

      const healthyCount = Object.values(services).filter(Boolean).length;
      const totalServices = Object.keys(services).length;
      
      let status: 'healthy' | 'degraded' | 'unhealthy';
      if (healthyCount === totalServices) {
        status = 'healthy';
      } else if (healthyCount >= totalServices / 2) {
        status = 'degraded';
      } else {
        status = 'unhealthy';
      }

      const memory = this.getMemoryUsage();

      const healthCheck: HealthCheck = {
        status,
        services,
        uptime,
        memory,
        timestamp,
      };

      secureLogger.info('Health check performed', {
        status,
        services,
        uptime,
        memoryUsage: memory.percentage,
        masked: true,
      });

      return healthCheck;
    } catch (error) {
      secureLogger.error('Health check failed', {
        error: (error as Error).message,
        masked: true,
      });
      throw error;
    }
  }

  startTrace(traceId: string, spanId: string, operation: string, parentSpanId?: string): TraceData {
    const trace: TraceData = {
      traceId,
      spanId,
      parentSpanId,
      operation,
      startTime: Date.now(),
      tags: {},
      logs: [],
      status: 'success',
    };

    this.traces.set(spanId, trace);
    
    secureLogger.info('Trace started', {
      traceId,
      spanId,
      operation,
      masked: true,
    });

    return trace;
  }

  endTrace(spanId: string, status: 'success' | 'error' | 'timeout' = 'success'): void {
    const trace = this.traces.get(spanId);
    if (!trace) return;

    trace.endTime = Date.now();
    trace.duration = trace.endTime - trace.startTime;
    trace.status = status;

    secureLogger.info('Trace ended', {
      traceId: trace.traceId,
      spanId,
      operation: trace.operation,
      duration: trace.duration,
      status,
      masked: true,
    });
  }

  addTraceLog(spanId: string, level: string, message: string, fields: Record<string, any> = {}): void {
    const trace = this.traces.get(spanId);
    if (!trace) return;

    trace.logs.push({
      timestamp: Date.now(),
      level,
      message,
      fields,
    });
  }

  addTraceTag(spanId: string, key: string, value: any): void {
    const trace = this.traces.get(spanId);
    if (!trace) return;

    trace.tags[key] = value;
  }

  getTrace(spanId: string): TraceData | null {
    return this.traces.get(spanId) || null;
  }

  getTracesByTraceId(traceId: string): TraceData[] {
    return Array.from(this.traces.values()).filter(trace => trace.traceId === traceId);
  }

  private async getRequestMetrics() {
    try {
      const result = await query(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN status >= 200 AND status < 300 THEN 1 END) as successful,
          COUNT(CASE WHEN status >= 400 THEN 1 END) as failed
        FROM request_logs
        WHERE created_at > NOW() - INTERVAL '1 hour'
      `);

      const row = result.rows[0];
      const total = parseInt(row.total) || 0;
      const successful = parseInt(row.successful) || 0;
      const failed = parseInt(row.failed) || 0;

      return {
        total,
        successful,
        failed,
        rate: total / 3600, // requests per second
      };
    } catch (error) {
      return {
        total: 0,
        successful: 0,
        failed: 0,
        rate: 0,
      };
    }
  }

  private async getLatencyMetrics() {
    try {
      const result = await query(`
        SELECT 
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration) as p50,
          PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration) as p95,
          PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration) as p99,
          AVG(duration) as average
        FROM request_logs
        WHERE created_at > NOW() - INTERVAL '1 hour'
        AND duration IS NOT NULL
      `);

      const row = result.rows[0];
      return {
        p50: parseFloat(row.p50) || 0,
        p95: parseFloat(row.p95) || 0,
        p99: parseFloat(row.p99) || 0,
        average: parseFloat(row.average) || 0,
      };
    } catch (error) {
      return {
        p50: 0,
        p95: 0,
        p99: 0,
        average: 0,
      };
    }
  }

  private async getErrorMetrics() {
    try {
      const result = await query(`
        SELECT 
          COUNT(*) as total,
          error_type,
          COUNT(*) as count
        FROM request_logs
        WHERE created_at > NOW() - INTERVAL '1 hour'
        AND status >= 400
        GROUP BY error_type
      `);

      const byType: Record<string, number> = {};
      let total = 0;

      for (const row of result.rows) {
        const errorType = row.error_type || 'unknown';
        const count = parseInt(row.count) || 0;
        byType[errorType] = count;
        total += count;
      }

      return {
        total,
        byType,
      };
    } catch (error) {
      return {
        total: 0,
        byType: {},
      };
    }
  }

  private getCircuitBreakerStatus() {
    const circuits = circuitBreakerService.getAllCircuits();
    let open = 0;
    let closed = 0;
    let halfOpen = 0;

    for (const circuit of circuits.values()) {
      switch (circuit.state) {
        case 'OPEN':
          open++;
          break;
        case 'CLOSED':
          closed++;
          break;
        case 'HALF_OPEN':
          halfOpen++;
          break;
      }
    }

    return { open, closed, halfOpen };
  }

  private getRateLimiterStatus() {
    const rateLimits = rateLimiterService.getAllRateLimits();
    let blocked = 0;
    let allowed = 0;

    for (const entry of rateLimits.values()) {
      if (entry.count > 0) {
        allowed++;
      }
    }

    return { blocked, allowed };
  }

  private async checkDatabaseHealth(): Promise<boolean> {
    try {
      await query('SELECT 1');
      return true;
    } catch (error) {
      return false;
    }
  }

  private async checkRedisHealth(): Promise<boolean> {
    // Redis health check would go here
    // For now, return true as Redis is optional
    return true;
  }

  private checkCircuitBreakersHealth(): boolean {
    const circuits = circuitBreakerService.getAllCircuits();
    const openCircuits = Array.from(circuits.values()).filter(c => c.state === 'OPEN');
    return openCircuits.length === 0;
  }

  private checkRateLimitersHealth(): boolean {
    // Rate limiters are always healthy
    return true;
  }

  private getMemoryUsage() {
    const usage = process.memoryUsage();
    const total = usage.heapTotal;
    const used = usage.heapUsed;
    const percentage = (used / total) * 100;

    return {
      used,
      total,
      percentage: Math.round(percentage * 100) / 100,
    };
  }
}

export const observabilityService = new ObservabilityService();

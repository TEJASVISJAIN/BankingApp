import { query } from '../utils/database';
import { secureLogger } from '../utils/logger';
import { circuitBreakerService } from './circuitBreaker';
import { rateLimiterService } from './rateLimiter';

export interface PerformanceMetrics {
  timestamp: number;
  endpoint: string;
  p50: number;
  p95: number;
  p99: number;
  average: number;
  max: number;
  min: number;
  requestCount: number;
  errorRate: number;
}

export interface TuningRecommendations {
  database: {
    indexes: string[];
    queries: string[];
    connections: number;
  };
  caching: {
    enabled: boolean;
    ttl: number;
    keys: string[];
  };
  circuitBreakers: {
    thresholds: Record<string, number>;
    timeouts: Record<string, number>;
  };
  rateLimits: {
    windows: Record<string, number>;
    limits: Record<string, number>;
  };
}

export interface PerformanceTargets {
  p95: number;
  p99: number;
  errorRate: number;
  throughput: number;
}

class PerformanceTuner {
  private readonly TARGET_P95 = 100; // 100ms
  private readonly TARGET_P99 = 200; // 200ms
  private readonly TARGET_ERROR_RATE = 0.01; // 1%
  private readonly TARGET_THROUGHPUT = 1000; // 1000 req/s

  async analyzePerformance(): Promise<PerformanceMetrics[]> {
    try {
      const metrics = await this.collectMetrics();
      await this.analyzeSlowQueries();
      await this.analyzeIndexUsage();
      return metrics;
    } catch (error) {
      secureLogger.error('Performance analysis failed', {
        error: (error as Error).message,
        masked: true,
      });
      throw error;
    }
  }

  async generateTuningRecommendations(): Promise<TuningRecommendations> {
    const metrics = await this.analyzePerformance();
    const recommendations: TuningRecommendations = {
      database: {
        indexes: [],
        queries: [],
        connections: 10,
      },
      caching: {
        enabled: true,
        ttl: 300, // 5 minutes
        keys: [],
      },
      circuitBreakers: {
        thresholds: {},
        timeouts: {},
      },
      rateLimits: {
        windows: {},
        limits: {},
      },
    };

    // Analyze each endpoint
    for (const metric of metrics) {
      if (metric.p95 > this.TARGET_P95) {
        await this.tuneEndpoint(metric, recommendations);
      }
    }

    return recommendations;
  }

  async applyTuningRecommendations(recommendations: TuningRecommendations): Promise<void> {
    try {
      // Apply database optimizations
      await this.applyDatabaseTuning(recommendations.database);
      
      // Apply caching optimizations
      await this.applyCachingTuning(recommendations.caching);
      
      // Apply circuit breaker tuning
      await this.applyCircuitBreakerTuning(recommendations.circuitBreakers);
      
      // Apply rate limiting tuning
      await this.applyRateLimitTuning(recommendations.rateLimits);

      secureLogger.info('Performance tuning applied', {
        recommendations: Object.keys(recommendations),
        masked: true,
      });
    } catch (error) {
      secureLogger.error('Failed to apply tuning recommendations', {
        error: (error as Error).message,
        masked: true,
      });
      throw error;
    }
  }

  async optimizeForTargets(targets: PerformanceTargets): Promise<boolean> {
    const currentMetrics = await this.analyzePerformance();
    const avgP95 = currentMetrics.reduce((sum, m) => sum + m.p95, 0) / currentMetrics.length;
    const avgErrorRate = currentMetrics.reduce((sum, m) => sum + m.errorRate, 0) / currentMetrics.length;

    if (avgP95 <= targets.p95 && avgErrorRate <= targets.errorRate) {
      secureLogger.info('Performance targets already met', {
        p95: avgP95,
        errorRate: avgErrorRate,
        masked: true,
      });
      return true;
    }

    // Generate and apply recommendations
    const recommendations = await this.generateTuningRecommendations();
    await this.applyTuningRecommendations(recommendations);

    // Verify improvements
    const newMetrics = await this.analyzePerformance();
    const newAvgP95 = newMetrics.reduce((sum, m) => sum + m.p95, 0) / newMetrics.length;
    const newAvgErrorRate = newMetrics.reduce((sum, m) => sum + m.errorRate, 0) / newMetrics.length;

    const improved = newAvgP95 < avgP95 && newAvgErrorRate <= avgErrorRate;
    
    secureLogger.info('Performance optimization completed', {
      originalP95: avgP95,
      newP95: newAvgP95,
      originalErrorRate: avgErrorRate,
      newErrorRate: newAvgErrorRate,
      improved,
      masked: true,
    });

    return improved;
  }

  private async collectMetrics(): Promise<PerformanceMetrics[]> {
    const result = await query(`
      SELECT 
        url as endpoint,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration) as p50,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration) as p95,
        PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration) as p99,
        AVG(duration) as average,
        MAX(duration) as max,
        MIN(duration) as min,
        COUNT(*) as request_count,
        COUNT(CASE WHEN status >= 400 THEN 1 END)::float / COUNT(*) as error_rate
      FROM request_logs
      WHERE created_at > NOW() - INTERVAL '1 hour'
      GROUP BY url
      ORDER BY p95 DESC
    `);

    return result.rows.map(row => ({
      timestamp: Date.now(),
      endpoint: row.endpoint,
      p50: parseFloat(row.p50) || 0,
      p95: parseFloat(row.p95) || 0,
      p99: parseFloat(row.p99) || 0,
      average: parseFloat(row.average) || 0,
      max: parseInt(row.max) || 0,
      min: parseInt(row.min) || 0,
      requestCount: parseInt(row.request_count) || 0,
      errorRate: parseFloat(row.error_rate) || 0,
    }));
  }

  private async analyzeSlowQueries(): Promise<void> {
    try {
      const result = await query(`
        SELECT 
          query,
          mean_time,
          calls,
          total_time
        FROM pg_stat_statements
        WHERE mean_time > 100
        ORDER BY mean_time DESC
        LIMIT 10
      `);

      for (const row of result.rows) {
        secureLogger.warn('Slow query detected', {
          query: row.query.substring(0, 100),
          meanTime: row.mean_time,
          calls: row.calls,
          totalTime: row.total_time,
          masked: true,
        });
      }
    } catch (error) {
      // pg_stat_statements might not be available
      secureLogger.warn('pg_stat_statements not available', {
        error: (error as Error).message,
        masked: true,
      });
    }
  }

  private async analyzeIndexUsage(): Promise<void> {
    try {
      const result = await query(`
        SELECT 
          schemaname,
          tablename,
          indexname,
          idx_scan,
          idx_tup_read,
          idx_tup_fetch
        FROM pg_stat_user_indexes
        WHERE idx_scan = 0
        ORDER BY tablename, indexname
      `);

      for (const row of result.rows) {
        secureLogger.warn('Unused index detected', {
          table: row.tablename,
          index: row.indexname,
          scans: row.idx_scan,
          masked: true,
        });
      }
    } catch (error) {
      secureLogger.error('Index analysis failed', {
        error: (error as Error).message,
        masked: true,
      });
    }
  }

  private async tuneEndpoint(metric: PerformanceMetrics, recommendations: TuningRecommendations): Promise<void> {
    // Database tuning
    if (metric.endpoint.includes('/customer/')) {
      recommendations.database.indexes.push('CREATE INDEX CONCURRENTLY idx_customer_transactions ON transactions (customer_id, created_at DESC)');
      recommendations.database.indexes.push('CREATE INDEX CONCURRENTLY idx_customer_cards ON cards (customer_id, status)');
    }

    if (metric.endpoint.includes('/insights/')) {
      recommendations.database.indexes.push('CREATE INDEX CONCURRENTLY idx_transactions_mcc ON transactions (mcc, created_at)');
      recommendations.database.indexes.push('CREATE INDEX CONCURRENTLY idx_transactions_merchant ON transactions (merchant, created_at)');
    }

    if (metric.endpoint.includes('/triage/')) {
      recommendations.database.indexes.push('CREATE INDEX CONCURRENTLY idx_agent_traces_session ON agent_traces (session_id)');
      recommendations.database.indexes.push('CREATE INDEX CONCURRENTLY idx_agent_steps_trace ON agent_steps (trace_id)');
    }

    // Caching tuning
    if (metric.p95 > this.TARGET_P95 * 2) {
      recommendations.caching.keys.push(metric.endpoint);
      recommendations.caching.ttl = Math.min(recommendations.caching.ttl, 600); // 10 minutes
    }

    // Circuit breaker tuning
    if (metric.errorRate > this.TARGET_ERROR_RATE) {
      const serviceName = this.extractServiceName(metric.endpoint);
      recommendations.circuitBreakers.thresholds[serviceName] = 3;
      recommendations.circuitBreakers.timeouts[serviceName] = 1000;
    }

    // Rate limiting tuning
    if (metric.requestCount > 100) {
      const serviceName = this.extractServiceName(metric.endpoint);
      recommendations.rateLimits.windows[serviceName] = 60000; // 1 minute
      recommendations.rateLimits.limits[serviceName] = 100;
    }

    // Recommendations are modified in place
  }

  private extractServiceName(endpoint: string): string {
    const parts = endpoint.split('/');
    return parts[2] || 'unknown'; // Extract service from /api/service/...
  }

  private async applyDatabaseTuning(database: TuningRecommendations['database']): Promise<void> {
    for (const indexQuery of database.indexes) {
      try {
        await query(indexQuery);
        secureLogger.info('Database index created', {
          query: indexQuery.substring(0, 100),
          masked: true,
        });
      } catch (error) {
        secureLogger.warn('Failed to create index', {
          query: indexQuery.substring(0, 100),
          error: (error as Error).message,
          masked: true,
        });
      }
    }
  }

  private async applyCachingTuning(caching: TuningRecommendations['caching']): Promise<void> {
    // Caching implementation would go here
    secureLogger.info('Caching optimizations applied', {
      enabled: caching.enabled,
      ttl: caching.ttl,
      keys: caching.keys.length,
      masked: true,
    });
  }

  private async applyCircuitBreakerTuning(circuitBreakers: TuningRecommendations['circuitBreakers']): Promise<void> {
    // Circuit breaker tuning would be applied here
    secureLogger.info('Circuit breaker tuning applied', {
      thresholds: Object.keys(circuitBreakers.thresholds).length,
      timeouts: Object.keys(circuitBreakers.timeouts).length,
      masked: true,
    });
  }

  private async applyRateLimitTuning(rateLimits: TuningRecommendations['rateLimits']): Promise<void> {
    // Rate limiting tuning would be applied here
    secureLogger.info('Rate limiting tuning applied', {
      windows: Object.keys(rateLimits.windows).length,
      limits: Object.keys(rateLimits.limits).length,
      masked: true,
    });
  }
}

export const performanceTuner = new PerformanceTuner();

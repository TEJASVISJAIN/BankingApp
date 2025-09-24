import axios from 'axios';

interface PerformanceTargets {
  p95: number;
  p99: number;
  errorRate: number;
  throughput: number;
}

class PerformanceOptimizer {
  private apiUrl: string;
  private apiKey: string;

  constructor() {
    this.apiUrl = process.env.API_URL || 'http://localhost:3001';
    this.apiKey = process.env.API_KEY || 'dev_key_789';
  }

  async optimizePerformance(): Promise<void> {
    console.log('🚀 Starting Performance Optimization...\n');

    try {
      // Get current performance metrics
      console.log('📊 Analyzing current performance...');
      const metrics = await this.getPerformanceMetrics();
      this.printMetrics(metrics);

      // Set performance targets
      const targets: PerformanceTargets = {
        p95: 100, // 100ms
        p99: 200, // 200ms
        errorRate: 0.01, // 1%
        throughput: 1000, // 1000 req/s
      };

      console.log('\n🎯 Performance Targets:');
      console.log(`P95: ${targets.p95}ms`);
      console.log(`P99: ${targets.p99}ms`);
      console.log(`Error Rate: ${(targets.errorRate * 100).toFixed(1)}%`);
      console.log(`Throughput: ${targets.throughput} req/s`);

      // Run performance tuning
      console.log('\n🔧 Running performance tuning...');
      const tuningResult = await this.runTuning(targets);
      
      if (tuningResult.improved) {
        console.log('✅ Performance optimization successful!');
      } else {
        console.log('⚠️  Performance optimization completed with limited improvements');
      }

      // Get updated metrics
      console.log('\n📈 Updated performance metrics:');
      const updatedMetrics = await this.getPerformanceMetrics();
      this.printMetrics(updatedMetrics);

      // Show recommendations
      console.log('\n💡 Tuning Recommendations:');
      this.printRecommendations(tuningResult.recommendations);

    } catch (error) {
      console.error('❌ Performance optimization failed:', error);
      process.exit(1);
    }
  }

  private async getPerformanceMetrics(): Promise<any> {
    try {
      const response = await axios.get(`${this.apiUrl}/api/eval/performance`, {
        headers: { 'X-API-Key': this.apiKey },
        timeout: 10000,
      });
      return response.data;
    } catch (error) {
      console.error('Failed to get performance metrics:', error);
      throw error;
    }
  }

  private async runTuning(targets: PerformanceTargets): Promise<any> {
    try {
      const response = await axios.post(`${this.apiUrl}/api/eval/tune`, {
        targets,
      }, {
        headers: { 'X-API-Key': this.apiKey },
        timeout: 30000,
      });
      return response.data;
    } catch (error) {
      console.error('Failed to run performance tuning:', error);
      throw error;
    }
  }

  private printMetrics(metrics: any): void {
    if (metrics.metrics && Array.isArray(metrics.metrics)) {
      console.log('\n📊 Endpoint Performance:');
      console.log('========================');
      
      metrics.metrics.forEach((metric: any) => {
        console.log(`\n${metric.endpoint}:`);
        console.log(`  P50: ${metric.p50.toFixed(1)}ms`);
        console.log(`  P95: ${metric.p95.toFixed(1)}ms`);
        console.log(`  P99: ${metric.p99.toFixed(1)}ms`);
        console.log(`  Avg: ${metric.average.toFixed(1)}ms`);
        console.log(`  Requests: ${metric.requestCount}`);
        console.log(`  Error Rate: ${(metric.errorRate * 100).toFixed(1)}%`);
        
        // Highlight performance issues
        if (metric.p95 > 100) {
          console.log(`  ⚠️  P95 exceeds target (${metric.p95.toFixed(1)}ms > 100ms)`);
        }
        if (metric.errorRate > 0.01) {
          console.log(`  ⚠️  Error rate exceeds target (${(metric.errorRate * 100).toFixed(1)}% > 1%)`);
        }
      });
    }
  }

  private printRecommendations(recommendations: any): void {
    if (recommendations.database) {
      console.log('\n🗄️  Database Optimizations:');
      if (recommendations.database.indexes.length > 0) {
        console.log('  Indexes to create:');
        recommendations.database.indexes.forEach((index: string, i: number) => {
          console.log(`    ${i + 1}. ${index}`);
        });
      }
      console.log(`  Connection pool size: ${recommendations.database.connections}`);
    }

    if (recommendations.caching) {
      console.log('\n💾 Caching Optimizations:');
      console.log(`  Enabled: ${recommendations.caching.enabled}`);
      console.log(`  TTL: ${recommendations.caching.ttl}s`);
      if (recommendations.caching.keys.length > 0) {
        console.log('  Cached endpoints:');
        recommendations.caching.keys.forEach((key: string) => {
          console.log(`    - ${key}`);
        });
      }
    }

    if (recommendations.circuitBreakers) {
      console.log('\n⚡ Circuit Breaker Settings:');
      Object.entries(recommendations.circuitBreakers.thresholds).forEach(([service, threshold]) => {
        console.log(`  ${service}: ${threshold} failures`);
      });
    }

    if (recommendations.rateLimits) {
      console.log('\n🚦 Rate Limiting Settings:');
      Object.entries(recommendations.rateLimits.limits).forEach(([service, limit]) => {
        console.log(`  ${service}: ${limit} requests per window`);
      });
    }
  }
}

// Run optimization if called directly
if (require.main === module) {
  const optimizer = new PerformanceOptimizer();
  optimizer.optimizePerformance().catch(console.error);
}

export { PerformanceOptimizer };

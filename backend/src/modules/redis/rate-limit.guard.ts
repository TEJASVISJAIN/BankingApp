import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { RedisService } from './redis.service';
import { TokenBucketService } from './token-bucket.service';
import { MetricsService } from '../metrics/metrics.service';
import { secureLogger } from '../../utils/logger';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly redisService: RedisService,
    private readonly tokenBucketService: TokenBucketService,
    private readonly metricsService: MetricsService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    
    // Get client identifier (IP address or API key)
    const clientId = this.getClientId(request);
    const endpoint = request.route?.path || request.url;
    
    // Create rate limit key for session-based limiting
    const sessionId = request.headers['x-session-id'] || clientId;
    const key = `session:${sessionId}:${endpoint}`;
    
    try {
      // Use token bucket for 5 req/s per session
      const tokenBucketResult = await this.tokenBucketService.checkTokenBucket(key);
      
      // Set rate limit headers
      response.setHeader('X-RateLimit-Limit', 5);
      response.setHeader('X-RateLimit-Remaining', tokenBucketResult.remaining);
      response.setHeader('X-RateLimit-Reset', new Date(tokenBucketResult.resetTime).toISOString());
      response.setHeader('Retry-After', Math.ceil(tokenBucketResult.retryAfterMs / 1000));
      
      if (!tokenBucketResult.allowed) {
        // Record rate limit block metric
        this.metricsService.recordRateLimitBlock(endpoint, sessionId);
        
        secureLogger.warn('Token bucket rate limit exceeded', { 
          sessionId, 
          endpoint, 
          remaining: tokenBucketResult.remaining,
          retryAfterMs: tokenBucketResult.retryAfterMs
        });
        
        throw new HttpException(
          {
            error: 'Rate limit exceeded',
            message: 'Too many requests. Limit: 5 requests per second per session',
            retryAfterMs: tokenBucketResult.retryAfterMs,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      
      return true;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      
      secureLogger.error('Token bucket rate limit check failed', { 
        sessionId, 
        endpoint, 
        error: error.message 
      });
      
      // Allow request if rate limiting fails
      return true;
    }
  }

  private getClientId(request: any): string {
    // Try to get API key first, then fall back to IP
    const apiKey = request.headers['x-api-key'];
    if (apiKey) {
      return `api_key:${apiKey}`;
    }
    
    // Get IP address
    const ip = request.ip || 
              request.connection?.remoteAddress || 
              request.socket?.remoteAddress ||
              'unknown';
    
    return `ip:${ip}`;
  }
}

import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service';
import { secureLogger } from '../../utils/logger';

export interface TokenBucketConfig {
  capacity: number; // Maximum tokens in bucket
  refillRate: number; // Tokens per second
  windowMs: number; // Time window in milliseconds
}

export interface TokenBucketResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfterMs: number;
}

@Injectable()
export class TokenBucketService {
  private readonly DEFAULT_CONFIG: TokenBucketConfig = {
    capacity: 5, // 5 requests per session
    refillRate: 5, // 5 tokens per second
    windowMs: 1000, // 1 second window
  };

  constructor(private readonly redisService: RedisService) {}

  async checkTokenBucket(
    key: string,
    config: TokenBucketConfig = this.DEFAULT_CONFIG
  ): Promise<TokenBucketResult> {
    try {
      const now = Date.now();
      const windowStart = now - config.windowMs;
      
      // Get current bucket state
      const bucketKey = `token_bucket:${key}`;
      const bucketData = await this.redisService.get(bucketKey);
      
      let tokens: number;
      let lastRefill: number;
      
      if (bucketData) {
        const parsed = JSON.parse(bucketData);
        tokens = parsed.tokens;
        lastRefill = parsed.lastRefill;
      } else {
        tokens = config.capacity;
        lastRefill = now;
      }
      
      // Calculate tokens to add based on time elapsed
      const timeElapsed = now - lastRefill;
      const tokensToAdd = Math.floor((timeElapsed / 1000) * config.refillRate);
      
      // Refill bucket (don't exceed capacity)
      tokens = Math.min(config.capacity, tokens + tokensToAdd);
      lastRefill = now;
      
      // Check if request can be processed
      if (tokens >= 1) {
        tokens -= 1; // Consume one token
        
        // Update bucket state
        await this.redisService.set(
          bucketKey,
          JSON.stringify({ tokens, lastRefill }),
          Math.ceil(config.windowMs / 1000)
        );
        
        const remaining = tokens;
        const resetTime = now + config.windowMs;
        const retryAfterMs = 0;
        
        secureLogger.debug('Token bucket request allowed', {
          key,
          tokens,
          remaining,
          config
        });
        
        return {
          allowed: true,
          remaining,
          resetTime,
          retryAfterMs,
        };
      } else {
        // Not enough tokens
        const timeUntilNextToken = Math.ceil((1 / config.refillRate) * 1000);
        const resetTime = now + timeUntilNextToken;
        const retryAfterMs = timeUntilNextToken;
        
        secureLogger.warn('Token bucket rate limit exceeded', {
          key,
          tokens,
          config,
          retryAfterMs
        });
        
        return {
          allowed: false,
          remaining: 0,
          resetTime,
          retryAfterMs,
        };
      }
    } catch (error) {
      secureLogger.error('Token bucket check failed', { key, error: error.message });
      // Allow request if Redis is down (fail open)
      return {
        allowed: true,
        remaining: this.DEFAULT_CONFIG.capacity,
        resetTime: Date.now() + this.DEFAULT_CONFIG.windowMs,
        retryAfterMs: 0,
      };
    }
  }

  async resetBucket(key: string): Promise<void> {
    const bucketKey = `token_bucket:${key}`;
    await this.redisService.del(bucketKey);
    secureLogger.info('Token bucket reset', { key });
  }

  async getBucketStatus(key: string): Promise<{ tokens: number; lastRefill: number } | null> {
    try {
      const bucketKey = `token_bucket:${key}`;
      const bucketData = await this.redisService.get(bucketKey);
      
      if (bucketData) {
        return JSON.parse(bucketData);
      }
      return null;
    } catch (error) {
      secureLogger.error('Failed to get bucket status', { key, error: error.message });
      return null;
    }
  }
}

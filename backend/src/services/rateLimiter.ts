import { secureLogger } from '../utils/logger';
import { query } from '../utils/database';

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: any) => string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

export interface RateLimitEntry {
  key: string;
  count: number;
  windowStart: number;
  lastRequest: number;
}

class RateLimiterService {
  private readonly defaultConfig: RateLimitConfig = {
    windowMs: 60000, // 1 minute
    maxRequests: 100,
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
  };

  private memoryStore: Map<string, RateLimitEntry> = new Map();
  private readonly cleanupInterval = 60000; // 1 minute

  constructor() {
    // Start cleanup interval
    setInterval(() => {
      this.cleanupExpiredEntries();
    }, this.cleanupInterval);
  }

  async checkRateLimit(
    key: string,
    config?: Partial<RateLimitConfig>
  ): Promise<RateLimitResult> {
    const rateLimitConfig = { ...this.defaultConfig, ...config };
    const now = Date.now();
    const windowStart = now - rateLimitConfig.windowMs;

    // Get or create entry
    let entry = this.memoryStore.get(key);
    if (!entry || entry.windowStart < windowStart) {
      entry = {
        key,
        count: 0,
        windowStart: now,
        lastRequest: now,
      };
    }

    // Check if limit exceeded
    if (entry.count >= rateLimitConfig.maxRequests) {
      const resetTime = entry.windowStart + rateLimitConfig.windowMs;
      const retryAfter = Math.ceil((resetTime - now) / 1000);

      secureLogger.warn('Rate limit exceeded', {
        key,
        count: entry.count,
        maxRequests: rateLimitConfig.maxRequests,
        retryAfter,
        masked: true,
      });

      return {
        allowed: false,
        remaining: 0,
        resetTime,
        retryAfter,
      };
    }

    // Update entry
    entry.count++;
    entry.lastRequest = now;
    this.memoryStore.set(key, entry);

    const remaining = rateLimitConfig.maxRequests - entry.count;
    const resetTime = entry.windowStart + rateLimitConfig.windowMs;

    return {
      allowed: true,
      remaining,
      resetTime,
    };
  }

  async checkRateLimitWithDatabase(
    key: string,
    config?: Partial<RateLimitConfig>
  ): Promise<RateLimitResult> {
    const rateLimitConfig = { ...this.defaultConfig, ...config };
    const now = Date.now();
    const windowStart = now - rateLimitConfig.windowMs;

    try {
      // Get current count from database
      const result = await query(`
        SELECT COUNT(*) as count, MAX(created_at) as last_request
        FROM rate_limit_entries
        WHERE key = $1 AND created_at > $2
      `, [key, new Date(windowStart)]);

      const count = parseInt(result.rows[0]?.count || '0');
      const lastRequest = result.rows[0]?.last_request;

      if (count >= rateLimitConfig.maxRequests) {
        const resetTime = windowStart + rateLimitConfig.windowMs;
        const retryAfter = Math.ceil((resetTime - now) / 1000);

        secureLogger.warn('Rate limit exceeded (database)', {
          key,
          count,
          maxRequests: rateLimitConfig.maxRequests,
          retryAfter,
          masked: true,
        });

        return {
          allowed: false,
          remaining: 0,
          resetTime,
          retryAfter,
        };
      }

      // Record this request
      await query(`
        INSERT INTO rate_limit_entries (key, created_at)
        VALUES ($1, $2)
      `, [key, new Date(now)]);

      const remaining = rateLimitConfig.maxRequests - count - 1;
      const resetTime = windowStart + rateLimitConfig.windowMs;

      return {
        allowed: true,
        remaining,
        resetTime,
      };
    } catch (error) {
      secureLogger.error('Rate limit check failed', {
        key,
        error: (error as Error).message,
        masked: true,
      });

      // Fallback to memory store
      return this.checkRateLimit(key, config);
    }
  }

  async checkRateLimitByIP(
    ip: string,
    config?: Partial<RateLimitConfig>
  ): Promise<RateLimitResult> {
    return this.checkRateLimit(`ip:${ip}`, config);
  }

  async checkRateLimitByUser(
    userId: string,
    config?: Partial<RateLimitConfig>
  ): Promise<RateLimitResult> {
    return this.checkRateLimit(`user:${userId}`, config);
  }

  async checkRateLimitBySession(
    sessionId: string,
    config?: Partial<RateLimitConfig>
  ): Promise<RateLimitResult> {
    return this.checkRateLimit(`session:${sessionId}`, config);
  }

  async checkRateLimitByAPI(
    apiKey: string,
    config?: Partial<RateLimitConfig>
  ): Promise<RateLimitResult> {
    return this.checkRateLimit(`api:${apiKey}`, config);
  }

  private cleanupExpiredEntries(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.memoryStore.entries()) {
      if (entry.lastRequest < now - this.cleanupInterval * 2) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => {
      this.memoryStore.delete(key);
    });

    if (expiredKeys.length > 0) {
      secureLogger.info('Cleaned up expired rate limit entries', {
        count: expiredKeys.length,
        masked: true,
      });
    }
  }

  getRateLimitStatus(key: string): RateLimitEntry | null {
    return this.memoryStore.get(key) || null;
  }

  resetRateLimit(key: string): void {
    this.memoryStore.delete(key);
    secureLogger.info('Rate limit reset', {
      key,
      masked: true,
    });
  }

  getAllRateLimits(): Map<string, RateLimitEntry> {
    return new Map(this.memoryStore);
  }

  async cleanupDatabaseEntries(): Promise<void> {
    try {
      const result = await query(`
        DELETE FROM rate_limit_entries
        WHERE created_at < NOW() - INTERVAL '1 hour'
      `);

      secureLogger.info('Cleaned up database rate limit entries', {
        deletedCount: result.rowCount,
        masked: true,
      });
    } catch (error) {
      secureLogger.error('Failed to cleanup database rate limit entries', {
        error: (error as Error).message,
        masked: true,
      });
    }
  }
}

export const rateLimiterService = new RateLimiterService();

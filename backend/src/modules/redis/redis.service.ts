import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { secureLogger } from '../../utils/logger';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;
  private subscriber: Redis;
  private publisher: Redis;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    try {
      const redisConfig = this.configService.get('redis');
      
      this.client = new Redis({
        host: redisConfig.host,
        port: redisConfig.port,
        password: redisConfig.password,
        maxRetriesPerRequest: 3,
      });

      this.subscriber = new Redis({
        host: redisConfig.host,
        port: redisConfig.port,
        password: redisConfig.password,
        maxRetriesPerRequest: 3,
      });

      this.publisher = new Redis({
        host: redisConfig.host,
        port: redisConfig.port,
        password: redisConfig.password,
        maxRetriesPerRequest: 3,
      });

      // Test connection
      await this.client.ping();
      secureLogger.info('Redis connection established');
    } catch (error) {
      secureLogger.error('Failed to connect to Redis', { error: error.message });
      throw error;
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
    }
    if (this.subscriber) {
      await this.subscriber.quit();
    }
    if (this.publisher) {
      await this.publisher.quit();
    }
  }

  // Rate limiting methods
  async checkRateLimit(key: string, limit: number, windowMs: number): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
  }> {
    try {
      const now = Date.now();
      const windowStart = now - windowMs;
      
      // Remove expired entries
      await this.client.zremrangebyscore(key, 0, windowStart);
      
      // Count current requests
      const currentCount = await this.client.zcard(key);
      
      if (currentCount >= limit) {
        return {
          allowed: false,
          remaining: 0,
          resetTime: now + windowMs,
        };
      }
      
      // Add current request
      await this.client.zadd(key, now, `${now}-${Math.random()}`);
      await this.client.expire(key, Math.ceil(windowMs / 1000));
      
      return {
        allowed: true,
        remaining: limit - currentCount - 1,
        resetTime: now + windowMs,
      };
    } catch (error) {
      secureLogger.error('Rate limit check failed', { key, error: error.message });
      // Allow request if Redis is down
      return {
        allowed: true,
        remaining: limit,
        resetTime: Date.now() + windowMs,
      };
    }
  }

  // Cache methods
  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch (error) {
      secureLogger.error('Redis get failed', { key, error: error.message });
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    try {
      if (ttlSeconds) {
        await this.client.setex(key, ttlSeconds, value);
      } else {
        await this.client.set(key, value);
      }
      return true;
    } catch (error) {
      secureLogger.error('Redis set failed', { key, error: error.message });
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      secureLogger.error('Redis delete failed', { key, error: error.message });
      return false;
    }
  }

  async getTtl(key: string): Promise<number> {
    try {
      return await this.client.ttl(key);
    } catch (error) {
      secureLogger.error('Redis TTL check failed', { key, error: error.message });
      return -1;
    }
  }

  // Queue methods
  async enqueue(queueName: string, data: any): Promise<boolean> {
    try {
      await this.client.lpush(queueName, JSON.stringify(data));
      return true;
    } catch (error) {
      secureLogger.error('Redis enqueue failed', { queueName, error: error.message });
      return false;
    }
  }

  async dequeue(queueName: string): Promise<any | null> {
    try {
      const result = await this.client.brpop(queueName, 1);
      return result ? JSON.parse(result[1]) : null;
    } catch (error) {
      secureLogger.error('Redis dequeue failed', { queueName, error: error.message });
      return null;
    }
  }

  // Pub/Sub methods
  async publish(channel: string, message: any): Promise<boolean> {
    try {
      await this.publisher.publish(channel, JSON.stringify(message));
      return true;
    } catch (error) {
      secureLogger.error('Redis publish failed', { channel, error: error.message });
      return false;
    }
  }

  async subscribe(channel: string, callback: (message: any) => void): Promise<void> {
    try {
      await this.subscriber.subscribe(channel);
      this.subscriber.on('message', (receivedChannel, message) => {
        if (receivedChannel === channel) {
          callback(JSON.parse(message));
        }
      });
    } catch (error) {
      secureLogger.error('Redis subscribe failed', { channel, error: error.message });
    }
  }

  // Health check
  async isHealthy(): Promise<boolean> {
    try {
      await this.client.ping();
      return true;
    } catch (error) {
      secureLogger.error('Redis health check failed', { error: error.message });
      return false;
    }
  }
}

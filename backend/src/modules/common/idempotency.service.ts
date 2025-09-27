import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { secureLogger } from '../../utils/logger';

export interface IdempotencyResult {
  isNew: boolean;
  result?: any;
  statusCode?: number;
}

@Injectable()
export class IdempotencyService {
  private readonly IDEMPOTENCY_TTL = 24 * 60 * 60; // 24 hours in seconds

  constructor(private readonly redisService: RedisService) {}

  async checkIdempotency(
    key: string,
    operation: () => Promise<{ result: any; statusCode: number }>
  ): Promise<IdempotencyResult> {
    try {
      // Check if we have a cached result
      const cachedResult = await this.redisService.get(`idempotency:${key}`);
      
      if (cachedResult) {
        const parsed = JSON.parse(cachedResult);
        secureLogger.info('Idempotency key found, returning cached result', { 
          key, 
          statusCode: parsed.statusCode 
        });
        
        return {
          isNew: false,
          result: parsed.result,
          statusCode: parsed.statusCode,
        };
      }

      // Execute the operation
      const operationResult = await operation();
      
      // Cache the result
      await this.redisService.set(
        `idempotency:${key}`,
        JSON.stringify(operationResult),
        this.IDEMPOTENCY_TTL
      );

      secureLogger.info('Idempotency key processed, result cached', { 
        key, 
        statusCode: operationResult.statusCode 
      });

      return {
        isNew: true,
        result: operationResult.result,
        statusCode: operationResult.statusCode,
      };
    } catch (error) {
      secureLogger.error('Idempotency check failed', { key, error: error.message });
      // If idempotency fails, execute the operation anyway
      const operationResult = await operation();
      return {
        isNew: true,
        result: operationResult.result,
        statusCode: operationResult.statusCode,
      };
    }
  }

  async clearIdempotency(key: string): Promise<void> {
    await this.redisService.del(`idempotency:${key}`);
    secureLogger.info('Idempotency key cleared', { key });
  }

  async getIdempotencyStatus(key: string): Promise<{ exists: boolean; ttl: number }> {
    try {
      const exists = await this.redisService.get(`idempotency:${key}`) !== null;
      const ttl = await this.redisService.getTtl(`idempotency:${key}`);
      return { exists, ttl };
    } catch (error) {
      secureLogger.error('Failed to get idempotency status', { key, error: error.message });
      return { exists: false, ttl: 0 };
    }
  }
}

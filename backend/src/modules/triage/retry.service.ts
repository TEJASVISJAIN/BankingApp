import { Injectable } from '@nestjs/common';
import { secureLogger } from '../../utils/logger';

export interface RetryOptions {
  maxRetries: number;
  baseDelay: number; // Initial delay in ms
  maxDelay: number; // Maximum delay in ms
  backoffMultiplier: number;
  jitter: boolean; // Add random jitter to prevent thundering herd
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attempts: number;
  totalDuration: number;
}

@Injectable()
export class RetryService {
  private readonly defaultOptions: RetryOptions = {
    maxRetries: 2,
    baseDelay: 150, // 150ms
    maxDelay: 400, // 400ms
    backoffMultiplier: 2,
    jitter: true,
  };

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    options: Partial<RetryOptions> = {}
  ): Promise<RetryResult<T>> {
    const config = { ...this.defaultOptions, ...options };
    const startTime = Date.now();
    let lastError: Error | undefined;
    let attempts = 0;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      attempts = attempt + 1;
      
      try {
        secureLogger.debug('Retry attempt started', { 
          attempt: attempts, 
          maxRetries: config.maxRetries 
        });

        const result = await operation();
        
        const totalDuration = Date.now() - startTime;
        secureLogger.info('Operation succeeded', { 
          attempts, 
          totalDuration,
          success: true 
        });

        return {
          success: true,
          result,
          attempts,
          totalDuration,
        };
      } catch (error) {
        lastError = error as Error;
        secureLogger.warn('Operation failed', { 
          attempt: attempts, 
          error: error.message,
          willRetry: attempt < config.maxRetries 
        });

        // Don't retry on the last attempt
        if (attempt >= config.maxRetries) {
          break;
        }

        // Calculate delay with exponential backoff
        const delay = this.calculateDelay(attempt, config);
        secureLogger.debug('Waiting before retry', { delay, attempt: attempts });
        
        await this.sleep(delay);
      }
    }

    const totalDuration = Date.now() - startTime;
    secureLogger.error('Operation failed after all retries', { 
      attempts, 
      totalDuration,
      finalError: lastError?.message 
    });

    return {
      success: false,
      error: lastError,
      attempts,
      totalDuration,
    };
  }

  private calculateDelay(attempt: number, config: RetryOptions): number {
    // Exponential backoff: baseDelay * (backoffMultiplier ^ attempt)
    let delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt);
    
    // Cap at maxDelay
    delay = Math.min(delay, config.maxDelay);
    
    // Add jitter to prevent thundering herd
    if (config.jitter) {
      const jitterRange = delay * 0.1; // 10% jitter
      const jitter = (Math.random() - 0.5) * 2 * jitterRange;
      delay += jitter;
    }
    
    return Math.max(0, Math.round(delay));
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Convenience method for the specific requirements (150ms, 400ms, max 2)
  async executeWithStandardRetry<T>(
    operation: () => Promise<T>
  ): Promise<RetryResult<T>> {
    return this.executeWithRetry(operation, {
      maxRetries: 2,
      baseDelay: 150,
      maxDelay: 400,
      backoffMultiplier: 2,
      jitter: true,
    });
  }

  // Method for tool-specific retries (1s timeout)
  async executeToolWithRetry<T>(
    operation: () => Promise<T>
  ): Promise<RetryResult<T>> {
    return this.executeWithRetry(operation, {
      maxRetries: 2,
      baseDelay: 150,
      maxDelay: 400,
      backoffMultiplier: 2,
      jitter: true,
    });
  }

  // Method for flow-level retries (5s budget)
  async executeFlowWithRetry<T>(
    operation: () => Promise<T>
  ): Promise<RetryResult<T>> {
    return this.executeWithRetry(operation, {
      maxRetries: 1, // Fewer retries for flow-level operations
      baseDelay: 200,
      maxDelay: 500,
      backoffMultiplier: 1.5,
      jitter: true,
    });
  }
}

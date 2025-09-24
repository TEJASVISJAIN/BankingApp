import { secureLogger } from '../utils/logger';

export interface CircuitBreakerState {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  lastFailureTime: number;
  nextAttemptTime: number;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  timeout: number;
  resetTimeout: number;
  monitoringPeriod: number;
}

export interface FallbackConfig {
  enabled: boolean;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

class CircuitBreakerService {
  private circuits: Map<string, CircuitBreakerState> = new Map();
  private readonly defaultConfig: CircuitBreakerConfig = {
    failureThreshold: 3,
    timeout: 1000,
    resetTimeout: 30000,
    monitoringPeriod: 60000,
  };

  private readonly defaultFallbackConfig: FallbackConfig = {
    enabled: true,
    timeout: 5000,
    retryAttempts: 2,
    retryDelay: 150,
  };

  async executeWithCircuitBreaker<T>(
    serviceName: string,
    operation: () => Promise<T>,
    fallback?: () => Promise<T>,
    config?: Partial<CircuitBreakerConfig>
  ): Promise<T> {
    const circuitConfig = { ...this.defaultConfig, ...config };
    const state = this.getCircuitState(serviceName);

    // Check if circuit is open
    if (state.state === 'OPEN') {
      if (Date.now() < state.nextAttemptTime) {
        secureLogger.warn('Circuit breaker open', {
          service: serviceName,
          nextAttempt: new Date(state.nextAttemptTime).toISOString(),
          masked: true,
        });

        if (fallback) {
          return this.executeFallback(serviceName, fallback);
        }
        throw new Error(`Circuit breaker is open for ${serviceName}`);
      } else {
        // Move to half-open state
        state.state = 'HALF_OPEN';
        this.circuits.set(serviceName, state);
      }
    }

    try {
      const result = await this.executeWithTimeout(operation, circuitConfig.timeout);
      
      // Success - reset circuit
      if (state.state === 'HALF_OPEN') {
        state.state = 'CLOSED';
        state.failureCount = 0;
        this.circuits.set(serviceName, state);
        
        secureLogger.info('Circuit breaker reset', {
          service: serviceName,
          masked: true,
        });
      }

      return result;
    } catch (error) {
      this.recordFailure(serviceName, circuitConfig);
      
      secureLogger.error('Circuit breaker failure', {
        service: serviceName,
        error: (error as Error).message,
        failureCount: state.failureCount,
        masked: true,
      });

      if (fallback) {
        return this.executeFallback(serviceName, fallback);
      }
      
      throw error;
    }
  }

  async executeWithFallback<T>(
    operation: () => Promise<T>,
    fallback: () => Promise<T>,
    config?: Partial<FallbackConfig>
  ): Promise<T> {
    const fallbackConfig = { ...this.defaultFallbackConfig, ...config };
    
    if (!fallbackConfig.enabled) {
      return operation();
    }

    try {
      return await this.executeWithTimeout(operation, fallbackConfig.timeout);
    } catch (error) {
      secureLogger.warn('Primary operation failed, using fallback', {
        error: (error as Error).message,
        masked: true,
      });

      return this.executeWithRetry(fallback, fallbackConfig);
    }
  }

  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeout: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Operation timeout'));
      }, timeout);

      operation()
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    config: FallbackConfig
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= config.retryAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < config.retryAttempts) {
          await this.delay(config.retryDelay * Math.pow(2, attempt));
        }
      }
    }
    
    throw lastError!;
  }

  private async executeFallback<T>(
    serviceName: string,
    fallback: () => Promise<T>
  ): Promise<T> {
    try {
      secureLogger.info('Executing fallback', {
        service: serviceName,
        masked: true,
      });

      return await fallback();
    } catch (error) {
      secureLogger.error('Fallback execution failed', {
        service: serviceName,
        error: (error as Error).message,
        masked: true,
      });
      throw error;
    }
  }

  private getCircuitState(serviceName: string): CircuitBreakerState {
    if (!this.circuits.has(serviceName)) {
      this.circuits.set(serviceName, {
        state: 'CLOSED',
        failureCount: 0,
        lastFailureTime: 0,
        nextAttemptTime: 0,
      });
    }
    return this.circuits.get(serviceName)!;
  }

  private recordFailure(serviceName: string, config: CircuitBreakerConfig): void {
    const state = this.getCircuitState(serviceName);
    state.failureCount++;
    state.lastFailureTime = Date.now();

    if (state.failureCount >= config.failureThreshold) {
      state.state = 'OPEN';
      state.nextAttemptTime = Date.now() + config.resetTimeout;
      
      secureLogger.warn('Circuit breaker opened', {
        service: serviceName,
        failureCount: state.failureCount,
        nextAttempt: new Date(state.nextAttemptTime).toISOString(),
        masked: true,
      });
    }

    this.circuits.set(serviceName, state);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getCircuitStatus(serviceName: string): CircuitBreakerState | null {
    return this.circuits.get(serviceName) || null;
  }

  resetCircuit(serviceName: string): void {
    this.circuits.delete(serviceName);
    secureLogger.info('Circuit breaker reset', {
      service: serviceName,
      masked: true,
    });
  }

  getAllCircuits(): Map<string, CircuitBreakerState> {
    return new Map(this.circuits);
  }
}

export const circuitBreakerService = new CircuitBreakerService();

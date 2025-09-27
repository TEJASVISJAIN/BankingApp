import { Injectable } from '@nestjs/common';
import { secureLogger } from '../../utils/logger';

export interface CircuitBreakerOptions {
  failureThreshold: number; // Number of consecutive failures before opening
  recoveryTimeout: number; // Time in ms to wait before attempting recovery
  monitoringPeriod: number; // Time in ms to monitor for failures
}

export interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  lastFailureTime: number;
  nextAttemptTime: number;
}

export interface CircuitBreakerResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  circuitState: CircuitBreakerState;
}

@Injectable()
export class CircuitBreakerService {
  private readonly circuitStates = new Map<string, CircuitBreakerState>();
  private readonly defaultOptions: CircuitBreakerOptions = {
    failureThreshold: 3, // 3 consecutive failures
    recoveryTimeout: 30000, // 30 seconds
    monitoringPeriod: 60000, // 1 minute
  };

  async executeWithCircuitBreaker<T>(
    key: string,
    operation: () => Promise<T>,
    options: Partial<CircuitBreakerOptions> = {}
  ): Promise<CircuitBreakerResult<T>> {
    const config = { ...this.defaultOptions, ...options };
    const state = this.getCircuitState(key);
    
    // Check if circuit is open and not ready for recovery
    if (state.state === 'open') {
      if (Date.now() < state.nextAttemptTime) {
        const error = new Error(`Circuit breaker is open for ${key}. Next attempt at ${new Date(state.nextAttemptTime).toISOString()}`);
        secureLogger.warn('Circuit breaker blocked operation', { 
          key, 
          state: state.state,
          nextAttemptTime: new Date(state.nextAttemptTime).toISOString()
        });
        
        return {
          success: false,
          error,
          circuitState: state,
        };
      } else {
        // Transition to half-open for recovery attempt
        state.state = 'half-open';
        state.failureCount = 0;
        secureLogger.info('Circuit breaker transitioning to half-open', { key });
      }
    }

    try {
      secureLogger.debug('Executing operation through circuit breaker', { key, state: state.state });
      
      const result = await operation();
      
      // Operation succeeded
      if (state.state === 'half-open') {
        // Recovery successful, close the circuit
        state.state = 'closed';
        state.failureCount = 0;
        state.lastFailureTime = 0;
        state.nextAttemptTime = 0;
        secureLogger.info('Circuit breaker recovered and closed', { key });
      } else if (state.state === 'closed') {
        // Reset failure count on success
        state.failureCount = 0;
      }

      this.updateCircuitState(key, state);
      
      return {
        success: true,
        result,
        circuitState: state,
      };
    } catch (error) {
      // Operation failed
      state.failureCount++;
      state.lastFailureTime = Date.now();
      
      secureLogger.warn('Circuit breaker recorded failure', { 
        key, 
        failureCount: state.failureCount,
        threshold: config.failureThreshold 
      });

      if (state.state === 'half-open') {
        // Recovery attempt failed, open the circuit again
        state.state = 'open';
        state.nextAttemptTime = Date.now() + config.recoveryTimeout;
        secureLogger.warn('Circuit breaker recovery failed, reopening', { key });
      } else if (state.failureCount >= config.failureThreshold) {
        // Threshold reached, open the circuit
        state.state = 'open';
        state.nextAttemptTime = Date.now() + config.recoveryTimeout;
        secureLogger.error('Circuit breaker opened due to failure threshold', { 
          key, 
          failureCount: state.failureCount,
          threshold: config.failureThreshold,
          nextAttemptTime: new Date(state.nextAttemptTime).toISOString()
        });
      }

      this.updateCircuitState(key, state);
      
      return {
        success: false,
        error: error as Error,
        circuitState: state,
      };
    }
  }

  private getCircuitState(key: string): CircuitBreakerState {
    let state = this.circuitStates.get(key);
    
    if (!state) {
      state = {
        state: 'closed',
        failureCount: 0,
        lastFailureTime: 0,
        nextAttemptTime: 0,
      };
      this.circuitStates.set(key, state);
    }

    // Check if we should reset the circuit based on monitoring period
    const now = Date.now();
    if (state.lastFailureTime > 0 && (now - state.lastFailureTime) > this.defaultOptions.monitoringPeriod) {
      secureLogger.info('Circuit breaker reset due to monitoring period', { key });
      state.state = 'closed';
      state.failureCount = 0;
      state.lastFailureTime = 0;
      state.nextAttemptTime = 0;
    }

    return state;
  }

  private updateCircuitState(key: string, state: CircuitBreakerState): void {
    this.circuitStates.set(key, { ...state });
  }

  getCircuitState(key: string): CircuitBreakerState {
    return this.getCircuitState(key);
  }

  getAllCircuitStates(): Map<string, CircuitBreakerState> {
    return new Map(this.circuitStates);
  }

  resetCircuit(key: string): void {
    this.circuitStates.delete(key);
    secureLogger.info('Circuit breaker reset', { key });
  }

  resetAllCircuits(): void {
    this.circuitStates.clear();
    secureLogger.info('All circuit breakers reset');
  }

  // Method to check if a circuit is healthy
  isCircuitHealthy(key: string): boolean {
    const state = this.getCircuitState(key);
    return state.state === 'closed' || state.state === 'half-open';
  }

  // Method to get circuit health metrics
  getCircuitHealthMetrics(): {
    totalCircuits: number;
    healthyCircuits: number;
    openCircuits: number;
    halfOpenCircuits: number;
  } {
    const states = Array.from(this.circuitStates.values());
    
    return {
      totalCircuits: states.length,
      healthyCircuits: states.filter(s => s.state === 'closed').length,
      openCircuits: states.filter(s => s.state === 'open').length,
      halfOpenCircuits: states.filter(s => s.state === 'half-open').length,
    };
  }
}

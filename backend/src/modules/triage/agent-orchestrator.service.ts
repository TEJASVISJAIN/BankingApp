import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'events';
import { DatabaseService } from '../database/database.service';
import { FraudAgentService } from './fraud-agent.service';
import { KbAgentService } from './kb-agent.service';
import { RetryService } from './retry.service';
import { CircuitBreakerService } from './circuit-breaker.service';
import { SchemaValidationService } from './schema-validation.service';
import { PromptInjectionDefenseService } from './prompt-injection-defense.service';
import { MetricsService } from '../metrics/metrics.service';
import { secureLogger } from '../../utils/logger';

export interface AgentStep {
  id: string;
  agent: string;
  tool: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime: number;
  endTime?: number;
  duration?: number;
  input?: any;
  output?: any;
  error?: string;
  metadata?: any;
}

export interface AgentTrace {
  sessionId: string;
  customerId: string;
  transactionId: string;
  startTime: number;
  endTime?: number;
  totalDuration?: number;
  status: 'running' | 'completed' | 'failed';
  steps: AgentStep[];
  finalAssessment?: any;
  fallbacks: string[];
  policyBlocks: string[];
}

export interface TriageRequest {
  customerId: string;
  transactionId: string;
  sessionId?: string;
}

export interface TriageResponse {
  sessionId: string;
  status: 'running' | 'completed' | 'failed';
  assessment?: any;
  trace?: AgentTrace;
  error?: string;
}

@Injectable()
export class AgentOrchestratorService extends EventEmitter {
  private readonly activeSessions = new Map<string, AgentTrace>();
  private readonly MAX_CONCURRENT_SESSIONS = 10;
  private readonly STEP_TIMEOUT = 1000; // 1 second (tool timeout)
  private readonly TOTAL_TIMEOUT = 5000; // 5 seconds (flow budget)

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly fraudAgent: FraudAgentService,
    private readonly kbAgent: KbAgentService,
    private readonly retryService: RetryService,
    private readonly circuitBreaker: CircuitBreakerService,
    private readonly schemaValidation: SchemaValidationService,
    private readonly promptInjectionDefense: PromptInjectionDefenseService,
    private readonly metricsService: MetricsService,
  ) {
    super();
  }

  async triageTransaction(request: TriageRequest): Promise<TriageResponse> {
    // Validate input schema
    const validationResult = this.schemaValidation.validate(request, this.schemaValidation.getTriageRequestSchema());
    if (!validationResult.valid) {
      secureLogger.error('Invalid triage request schema', { 
        errors: validationResult.errors,
        request 
      });
      return {
        sessionId: request.sessionId || 'invalid',
        status: 'failed',
        error: `Invalid request schema: ${validationResult.errors.join(', ')}`,
        trace: null,
      };
    }

    // Sanitize input
    const sanitizedRequest = this.schemaValidation.sanitizeInput(validationResult.sanitizedData);
    
    // Check for prompt injection attempts
    const inputString = JSON.stringify(sanitizedRequest);
    const injectionAnalysis = this.promptInjectionDefense.analyzeInput(inputString);
    
    if (!injectionAnalysis.isSafe) {
      secureLogger.error('Prompt injection attempt detected', {
        threats: injectionAnalysis.detectedThreats,
        confidence: injectionAnalysis.confidence,
        input: inputString.substring(0, 100) + '...',
      });
      return {
        sessionId: sanitizedRequest.sessionId || 'blocked',
        status: 'failed',
        error: `Input blocked due to security threats: ${injectionAnalysis.detectedThreats.join(', ')}`,
        trace: null,
      };
    }
    
    const sessionId = sanitizedRequest.sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Check concurrent session limit
    if (this.activeSessions.size >= this.MAX_CONCURRENT_SESSIONS) {
      throw new Error('Maximum concurrent sessions reached');
    }

    // Initialize trace
    const trace: AgentTrace = {
      sessionId,
      customerId: request.customerId,
      transactionId: request.transactionId,
      startTime: Date.now(),
      status: 'running',
      steps: [],
      fallbacks: [],
      policyBlocks: [],
    };

    this.activeSessions.set(sessionId, trace);
    this.emit('session_started', { sessionId, trace });

    try {
      secureLogger.info('Starting triage session', {
        sessionId,
        customerId: request.customerId,
        transactionId: request.transactionId,
      });

      // Set total timeout
      const triageTimeout = this.TOTAL_TIMEOUT;
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Triage process timeout')), triageTimeout);
      });

      const assessment = await Promise.race([
        this.executeTriagePipeline(sessionId, request),
        timeoutPromise
      ]);

      // Update trace
      trace.status = 'completed';
      trace.endTime = Date.now();
      trace.totalDuration = trace.endTime - trace.startTime;
      trace.finalAssessment = assessment;

      this.emit('session_completed', { sessionId, trace, assessment });

      secureLogger.info('Triage session completed successfully', {
        sessionId,
        duration: trace.totalDuration,
        assessment: {
          riskLevel: assessment.riskLevel,
          recommendation: assessment.recommendation,
          confidence: assessment.confidence,
        },
      });

      // Clean up session after delay
      setTimeout(() => {
        this.activeSessions.delete(sessionId);
      }, 300000); // Keep for 5 minutes for debugging

      return {
        sessionId,
        status: 'completed',
        assessment,
        trace,
      };
    } catch (error) {
      trace.status = 'failed';
      trace.endTime = Date.now();
      trace.totalDuration = trace.endTime - trace.startTime;

      this.emit('session_failed', { sessionId, trace, error: error.message });

      secureLogger.error('Triage session failed', {
        sessionId,
        customerId: request.customerId,
        transactionId: request.transactionId,
        error: error.message,
        stack: error.stack,
        errorType: error.constructor.name,
        errorDetails: JSON.stringify(error),
      });

      // Clean up failed session immediately
      this.activeSessions.delete(sessionId);

      return {
        sessionId,
        status: 'failed',
        error: error.message,
        trace,
      };
    }
  }

  private async executeTriagePipeline(sessionId: string, request: TriageRequest): Promise<any> {
    const trace = this.activeSessions.get(sessionId);
    if (!trace) {
      secureLogger.error('Session not found in executeTriagePipeline', { sessionId });
      throw new Error('Session not found');
    }

    try {
      // Step 1: Get Profile
      const profileStep = await this.executeStep(sessionId, 'getProfile', 'Get customer profile', async () => {
        return await this.getCustomerProfile(request.customerId);
      });

      if (profileStep.status === 'failed') {
        secureLogger.error('Profile step failed', { sessionId, error: profileStep.error });
        throw new Error(`Failed to get customer profile: ${profileStep.error}`);
      }

      // Step 2: Get Recent Transactions
      const transactionsStep = await this.executeStep(sessionId, 'getRecentTransactions', 'Get recent transactions', async () => {
        return await this.getRecentTransactions(request.customerId, request.transactionId);
      });

      if (transactionsStep.status === 'failed') {
        secureLogger.error('Transactions step failed', { sessionId, error: transactionsStep.error });
        throw new Error(`Failed to get recent transactions: ${transactionsStep.error}`);
      }

      // Step 3: Risk Signals
      const riskSignalsStep = await this.executeStep(sessionId, 'riskSignals', 'Analyze risk signals', async () => {
        return await this.analyzeRiskSignals(profileStep.output, transactionsStep.output, request.transactionId);
      });

      if (riskSignalsStep.status === 'failed') {
        secureLogger.error('Risk signals step failed', { sessionId, error: riskSignalsStep.error });
        throw new Error(`Failed to analyze risk signals: ${riskSignalsStep.error}`);
      }

      // Step 4: KB Lookup
      const kbStep = await this.executeStep(sessionId, 'kbLookup', 'Search knowledge base', async () => {
        return await this.kbAgent.searchKnowledgeBase({
          customerId: request.customerId,
          transactionId: request.transactionId,
          profile: profileStep.output,
          transactions: transactionsStep.output,
          riskSignals: riskSignalsStep.output,
        });
      });

      // Step 5: Decide
      const decideStep = await this.executeStep(sessionId, 'decide', 'Make fraud decision', async () => {
        return await this.makeFraudDecision(riskSignalsStep.output, kbStep.output, profileStep.output);
      });

      if (decideStep.status === 'failed') {
        secureLogger.error('Decide step failed', { sessionId, error: decideStep.error });
        throw new Error(`Failed to make fraud decision: ${decideStep.error}`);
      }

      // Step 6: Propose Action
      const actionStep = await this.executeStep(sessionId, 'proposeAction', 'Propose action', async () => {
        return await this.proposeAction(decideStep.output, profileStep.output, riskSignalsStep.output);
      });

      // Combine all results
      const assessment = {
        profile: profileStep.output,
        transactions: transactionsStep.output,
        riskSignals: riskSignalsStep.output,
        kbResults: kbStep.output,
        decision: decideStep.output,
        action: actionStep.output,
        sessionId,
        timestamp: new Date().toISOString(),
      };

      return assessment;
    } catch (error) {
      secureLogger.error('executeTriagePipeline failed', {
        sessionId,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  private async executeStep(
    sessionId: string,
    stepId: string,
    description: string,
    operation: () => Promise<any>
  ): Promise<AgentStep> {
    const trace = this.activeSessions.get(sessionId);
    if (!trace) {
      secureLogger.error('Session not found in executeStep', { sessionId, stepId });
      throw new Error('Session not found');
    }

    const step: AgentStep = {
      id: stepId,
      agent: 'orchestrator',
      tool: stepId,
      status: 'running',
      startTime: Date.now(),
    };

    trace.steps.push(step);
    this.emit('step_started', { sessionId, step });

    try {
      secureLogger.info('Executing step', { sessionId, stepId, description });
      
      // Use circuit breaker with retry mechanism
      const circuitResult = await this.circuitBreaker.executeWithCircuitBreaker(
        `step_${stepId}`,
        async () => {
          // Use retry mechanism with 1s tool timeout
          const retryResult = await this.retryService.executeToolWithRetry(async () => {
            // Set timeout for the step (1s as required)
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error(`Step timeout after 1000ms`)), 1000);
            });

            return await Promise.race([operation(), timeoutPromise]);
          });

          if (!retryResult.success) {
            throw retryResult.error || new Error('Step failed after retries');
          }

          return retryResult.result;
        }
      );

      if (circuitResult.success) {
        step.status = 'completed';
        step.endTime = Date.now();
        step.duration = step.endTime - step.startTime;
        step.output = circuitResult.result;

        // Record metrics
        this.metricsService.recordAgentLatency('orchestrator', stepId, step.duration, 'success');
        this.metricsService.recordToolCall(stepId, true);

        this.emit('step_completed', { sessionId, step, result: circuitResult.result });

        secureLogger.info('Agent step completed', {
          sessionId,
          stepId,
          duration: step.duration,
          success: true,
          circuitState: circuitResult.circuitState.state,
        });

        return step;
      } else {
        step.status = 'failed';
        step.endTime = Date.now();
        step.duration = step.endTime - step.startTime;
        step.error = circuitResult.error?.message || 'Step failed after circuit breaker';

        // Record metrics
        this.metricsService.recordAgentLatency('orchestrator', stepId, step.duration, 'error');
        this.metricsService.recordToolCall(stepId, false);
        this.metricsService.recordAgentFallback(stepId, 'circuit_breaker_failure');

        this.emit('step_failed', { sessionId, step, error: step.error });

        secureLogger.error('Agent step failed', {
          sessionId,
          stepId,
          duration: step.duration,
          success: false,
          circuitState: circuitResult.circuitState.state,
        });

        return step;
      }
    } catch (error) {
      step.status = 'failed';
      step.endTime = Date.now();
      step.duration = step.endTime - step.startTime;
      step.error = error.message;

      // Record metrics for error case
      this.metricsService.recordAgentLatency('orchestrator', stepId, step.duration, 'error');
      this.metricsService.recordToolCall(stepId, false);
      this.metricsService.recordAgentFallback(stepId, 'exception');

      this.emit('step_failed', { sessionId, step, error: error.message });

      secureLogger.error('Agent step failed', {
        sessionId,
        stepId,
        duration: step.duration,
        error: error.message,
        stack: error.stack,
      });

      return step;
    }
  }

  private async getTransactionContext(transactionId: string, customerId: string): Promise<any> {
    try {
      secureLogger.info('Getting transaction context', { transactionId, customerId });
      
      const transaction = await this.databaseService.findTransactionById(transactionId);
      if (!transaction) {
        throw new Error('Transaction not found');
      }

      const customer = await this.databaseService.findCustomerById(customerId);
      if (!customer) {
        throw new Error('Customer not found');
      }

      const devices = await this.databaseService.findDevicesByCustomer(customerId);
      const chargebacks = await this.databaseService.findChargebacksByCustomer(customerId);

      const context = {
        transactionId: transaction.id,
        customerId: transaction.customerId,
        cardId: transaction.cardId,
        amount: transaction.amount,
        merchant: transaction.merchant,
        mcc: transaction.mcc,
        timestamp: transaction.timestamp,
        deviceId: transaction.deviceId,
        geo: transaction.deviceInfo,
        customer: {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          riskFlags: customer.riskFlags,
        },
        devices,
        chargebacks,
      };

      secureLogger.info('Transaction context created successfully', { 
        context: {
          transactionId: context.transactionId,
          customerId: context.customerId,
          amount: context.amount,
          merchant: context.merchant
        }
      });
      
      return context;
    } catch (error) {
      secureLogger.error('Failed to get transaction context', {
        transactionId,
        customerId,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  private async generateRecommendations(fraudAssessment: any, context: any): Promise<any> {
    // Generate recommendations based on fraud assessment
    const recommendations = {
      actions: [],
      priority: 'medium',
      reasoning: '',
    };

    if (fraudAssessment.riskLevel === 'high') {
      recommendations.actions = ['freeze_card', 'open_dispute', 'contact_customer'];
      recommendations.priority = 'high';
      recommendations.reasoning = 'High risk transaction detected';
    } else if (fraudAssessment.riskLevel === 'medium') {
      recommendations.actions = ['monitor', 'open_dispute', 'request_verification'];
      recommendations.priority = 'medium';
      recommendations.reasoning = 'Medium risk transaction requires investigation';
    } else {
      recommendations.actions = ['monitor'];
      recommendations.priority = 'low';
      recommendations.reasoning = 'Low risk transaction, monitor only';
    }

    return recommendations;
  }

  private async getCustomerProfile(customerId: string): Promise<any> {
    try {
      const customer = await this.databaseService.findCustomerById(customerId);
      if (!customer) {
        throw new Error('Customer not found');
      }

      return {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        riskFlags: customer.riskFlags,
        preferences: customer.preferences,
        createdAt: customer.createdAt,
      };
    } catch (error) {
      secureLogger.error('Failed to get customer profile', { customerId, error: error.message });
      throw error;
    }
  }

  private async getRecentTransactions(customerId: string, transactionId: string): Promise<any> {
    try {
      const transactions = await this.databaseService.findTransactionsByCustomer(customerId, 20);
      const currentTransaction = transactions.find(t => t.id === transactionId);
      
      return {
        current: currentTransaction,
        recent: transactions.slice(0, 10),
        total: transactions.length,
        summary: {
          totalAmount: transactions.reduce((sum, t) => sum + t.amount, 0),
          avgAmount: transactions.length > 0 ? transactions.reduce((sum, t) => sum + t.amount, 0) / transactions.length : 0,
          merchants: [...new Set(transactions.map(t => t.merchant))],
        },
      };
    } catch (error) {
      secureLogger.error('Failed to get recent transactions', { customerId, transactionId, error: error.message });
      throw error;
    }
  }

  private async analyzeRiskSignals(profile: any, transactions: any, transactionId: string): Promise<any> {
    try {
      const currentTransaction = transactions.current;
      const riskSignals = [];

      // Amount-based risk
      if (currentTransaction.amount > 100000) { // > ₹1000
        riskSignals.push({
          type: 'amount',
          severity: 'high',
          score: 0.8,
          description: 'High transaction amount',
        });
      }

      // Velocity-based risk
      const recentCount = transactions.recent.length;
      if (recentCount > 5) {
        riskSignals.push({
          type: 'velocity',
          severity: 'medium',
          score: 0.6,
          description: `High transaction velocity: ${recentCount} recent transactions`,
        });
      }

      // Merchant-based risk
      const merchantCount = transactions.recent.filter(t => t.merchant === currentTransaction.merchant).length;
      if (merchantCount === 0) {
        riskSignals.push({
          type: 'merchant',
          severity: 'medium',
          score: 0.5,
          description: 'New merchant for customer',
        });
      }

      // Calculate overall risk score
      const totalScore = riskSignals.reduce((sum, signal) => sum + signal.score, 0);
      const riskLevel = totalScore > 1.5 ? 'high' : totalScore > 0.8 ? 'medium' : 'low';

      return {
        signals: riskSignals,
        riskScore: Math.min(totalScore, 1.0),
        riskLevel,
        confidence: 0.85,
      };
    } catch (error) {
      secureLogger.error('Failed to analyze risk signals', { error: error.message });
      throw error;
    }
  }

  private async makeFraudDecision(riskSignals: any, kbResults: any, profile: any): Promise<any> {
    try {
      const decision = {
        riskLevel: riskSignals.riskLevel,
        riskScore: riskSignals.riskScore,
        confidence: riskSignals.confidence,
        reasoning: riskSignals.signals.map(s => s.description),
        recommendation: this.getRecommendation(riskSignals.riskLevel),
        requiresReview: riskSignals.riskLevel === 'high',
        autoApprove: riskSignals.riskLevel === 'low',
      };

      return decision;
    } catch (error) {
      secureLogger.error('Failed to make fraud decision', { error: error.message });
      throw error;
    }
  }

  private async proposeAction(decision: any, profile: any, riskSignals: any): Promise<any> {
    try {
      const actions = [];

      if (decision.riskLevel === 'high') {
        actions.push({
          type: 'block_transaction',
          priority: 'high',
          description: 'Block transaction immediately',
        });
        actions.push({
          type: 'contact_customer',
          priority: 'high',
          description: 'Contact customer for verification',
        });
      } else if (decision.riskLevel === 'medium') {
        actions.push({
          type: 'monitor_transaction',
          priority: 'medium',
          description: 'Monitor transaction closely',
        });
        actions.push({
          type: 'request_verification',
          priority: 'medium',
          description: 'Request additional verification',
        });
      } else {
        actions.push({
          type: 'allow_transaction',
          priority: 'low',
          description: 'Allow transaction to proceed',
        });
      }

      return {
        actions,
        nextSteps: this.getNextSteps(decision.riskLevel),
        escalation: decision.requiresReview,
      };
    } catch (error) {
      secureLogger.error('Failed to propose action', { error: error.message });
      throw error;
    }
  }

  private getRecommendation(riskLevel: string): string {
    switch (riskLevel) {
      case 'high': return 'block';
      case 'medium': return 'investigate';
      default: return 'monitor';
    }
  }

  private getNextSteps(riskLevel: string): string[] {
    switch (riskLevel) {
      case 'high':
        return ['Block transaction', 'Contact customer', 'Review account', 'Update risk profile'];
      case 'medium':
        return ['Monitor closely', 'Request verification', 'Review patterns'];
      default:
        return ['Continue monitoring', 'Update records'];
    }
  }
}

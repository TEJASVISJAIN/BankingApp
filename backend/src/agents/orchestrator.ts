import { EventEmitter } from 'events';
import { fraudAgent, FraudAssessment, TransactionContext } from './fraudAgent';
import { kbAgent } from './kbAgent';
import { circuitBreakerService } from '../services/circuitBreaker';
import { rateLimiterService } from '../services/rateLimiter';
import { observabilityService } from '../services/observability';
import { secureLogger } from '../utils/logger';
import { query } from '../utils/database';
import { traceService } from '../services/traceService';
import { toolCallTotal, agentLatencyMs, agentFallbackTotal } from '../routes/metrics';

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
  finalAssessment?: FraudAssessment;
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
  assessment?: FraudAssessment;
  trace?: AgentTrace;
  error?: string;
}

class AgentOrchestrator extends EventEmitter {
  private activeSessions: Map<string, AgentTrace> = new Map();
  private readonly MAX_CONCURRENT_SESSIONS = 10;
  private readonly STEP_TIMEOUT = 5000; // 5 seconds per step
  private readonly TOTAL_TIMEOUT = 30000; // 30 seconds total

  async triageTransaction(request: TriageRequest): Promise<TriageResponse> {
    const sessionId = request.sessionId || this.generateSessionId();
    const startTime = Date.now();

    secureLogger.info('Triage session started', {
      sessionId,
      customerId: request.customerId,
      transactionId: request.transactionId,
    });

    // Check if we're at capacity
    if (this.activeSessions.size >= this.MAX_CONCURRENT_SESSIONS) {
      return {
        sessionId,
        status: 'failed',
        error: 'System at capacity - please try again later',
      };
    }

    try {
      // Create initial trace
      const trace: AgentTrace = {
        sessionId,
        customerId: request.customerId,
        transactionId: request.transactionId,
        startTime,
        status: 'running',
        steps: [],
        fallbacks: [],
        policyBlocks: [],
      };

      this.activeSessions.set(sessionId, trace);
      this.emit('session_started', { sessionId, trace });

      // Execute the triage pipeline with timeout
      const triageTimeout = 30000; // 30 seconds
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Triage process timeout')), triageTimeout);
      });

      const assessment = await Promise.race([
        this.executeTriagePipeline(sessionId, request),
        timeoutPromise
      ]);

      // Update trace with final results
      trace.endTime = Date.now();
      trace.totalDuration = trace.endTime - trace.startTime;
      trace.status = 'completed';
      trace.finalAssessment = assessment;

      this.activeSessions.set(sessionId, trace);
      
      // Save trace to database and file system
      await traceService.saveTrace(trace);
      
      this.emit('session_completed', { sessionId, trace, assessment });

      // Clean up after a delay
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
      const trace = this.activeSessions.get(sessionId);
      if (trace) {
        trace.endTime = Date.now();
        trace.totalDuration = trace.endTime - trace.startTime;
        trace.status = 'failed';
        trace.steps.push({
          id: 'error',
          agent: 'orchestrator',
          tool: 'error_handler',
          status: 'failed',
          startTime: Date.now(),
          endTime: Date.now(),
          error: (error as Error).message,
        });
      }

      secureLogger.error('Triage session failed', {
        sessionId,
        customerId: request.customerId,
        transactionId: request.transactionId,
        error: (error as Error).message,
        stack: (error as Error).stack,
        errorType: error.constructor.name,
        errorDetails: JSON.stringify(error),
      });

      this.emit('session_failed', { sessionId, error: (error as Error).message });

      return {
        sessionId,
        status: 'failed',
        error: (error as Error).message,
        trace,
      };
    }
  }

  private async executeTriagePipeline(sessionId: string, request: TriageRequest): Promise<FraudAssessment> {
    const trace = this.activeSessions.get(sessionId);
    if (!trace) {
      secureLogger.error('Session not found in executeTriagePipeline', { sessionId });
      throw new Error('Session not found');
    }

    try {
      // Step 1: Get transaction context
      const contextStep = await this.executeStep(sessionId, 'get_context', 'Get transaction context', async () => {
        return await this.getTransactionContext(request.transactionId, request.customerId);
      });

      if (contextStep.status === 'failed') {
        secureLogger.error('Context step failed', { sessionId, error: contextStep.error });
        throw new Error(`Failed to get transaction context: ${contextStep.error}`);
      }

    const context = contextStep.output as TransactionContext;

    // Step 2: KB lookup for relevant information
    const kbStep = await this.executeStep(sessionId, 'kb_lookup', 'Search knowledge base', async () => {
      return await circuitBreakerService.executeWithCircuitBreaker(
        'kb_search',
        () => kbAgent.searchKB('fraud detection transaction analysis', { context }),
        () => kbAgent.searchKB('fraud detection transaction analysis', { context })
      );
    });

    // Step 3: Run fraud assessment
    const fraudStep = await this.executeStep(sessionId, 'fraud_assessment', 'Run fraud assessment', async () => {
      return await circuitBreakerService.executeWithCircuitBreaker(
        'fraud_analysis',
        () => fraudAgent.assessTransaction(context),
        () => this.executeFallbackAssessment(context)
      );
    });

    if (fraudStep.status === 'failed') {
      // Fallback to basic rules
      trace.fallbacks.push('fraud_assessment_failed');
      agentFallbackTotal.inc({ tool: 'fraud_assessment' });
      secureLogger.warn('Fraud assessment failed, using fallback', { sessionId });
      return await this.executeFallbackAssessment(context);
    }

    const assessment = fraudStep.output as FraudAssessment;

    // Step 3: Apply compliance policies
    const complianceStep = await this.executeStep(sessionId, 'compliance_check', 'Check compliance policies', async () => {
      return await this.checkCompliancePolicies(assessment, context);
    });

    if (complianceStep.status === 'failed') {
      trace.fallbacks.push('compliance_check_failed');
    }

    // Step 4: Generate recommendations
    const recommendationStep = await this.executeStep(sessionId, 'generate_recommendations', 'Generate action recommendations', async () => {
      return await this.generateRecommendations(assessment, context);
    });

    if (recommendationStep.status === 'completed') {
      assessment.recommendation = recommendationStep.output.recommendation;
      assessment.reasoning.push(...recommendationStep.output.reasoning);
    }

    // Add KB citations if available
    if (kbStep.status === 'completed' && kbStep.output?.results?.length > 0) {
      assessment.reasoning.push('Knowledge Base References:');
      kbStep.output.results.forEach((result: any) => {
        assessment.reasoning.push(`- ${result.document.title}: ${result.citations.join(', ')}`);
      });
    }

    return assessment;
    } catch (error) {
      secureLogger.error('executeTriagePipeline failed', {
        sessionId,
        error: (error as Error).message,
        stack: (error as Error).stack,
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
      
      // Set timeout for the step
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Step timeout after ${this.STEP_TIMEOUT}ms`)), this.STEP_TIMEOUT);
      });

      const result = await Promise.race([operation(), timeoutPromise]);
      
      step.status = 'completed';
      step.endTime = Date.now();
      step.duration = step.endTime - step.startTime;
      step.output = result;

      // Record metrics
      toolCallTotal.inc({ tool: stepId, status: 'ok' });
      agentLatencyMs.observe(step.duration);

      this.emit('step_completed', { sessionId, step, result });

      secureLogger.info('Agent step completed', {
        sessionId,
        stepId,
        duration: step.duration,
        success: true,
      });

      return step;
    } catch (error) {
      step.status = 'failed';
      step.endTime = Date.now();
      step.duration = step.endTime - step.startTime;
      step.error = (error as Error).message;

      // Record metrics for failed step
      toolCallTotal.inc({ tool: stepId, status: 'error' });
      agentLatencyMs.observe(step.duration);

      this.emit('step_failed', { sessionId, step, error: (error as Error).message });

      secureLogger.error('Agent step failed', {
        sessionId,
        stepId,
        duration: step.duration,
        error: (error as Error).message,
        stack: (error as Error).stack,
      });

      return step;
    }
  }

  private async getTransactionContext(transactionId: string, customerId: string): Promise<TransactionContext> {
    try {
      secureLogger.info('Getting transaction context', { transactionId, customerId });
      
      const result = await query(`
        SELECT t.*, c.risk_flags, d.id as device_id, d.device_info as geo
        FROM transactions t
        LEFT JOIN customers c ON t.customer_id = c.id
        LEFT JOIN devices d ON t.device_id = d.id
        WHERE t.id = $1 AND t.customer_id = $2
      `, [transactionId, customerId]);

      secureLogger.info('Transaction query result', { 
        transactionId, 
        customerId, 
        rowCount: result.rows.length,
        query: 'SELECT t.*, c.risk_flags, d.id as device_id, d.device_info as geo FROM transactions t LEFT JOIN customers c ON t.customer_id = c.id LEFT JOIN devices d ON t.device_id = d.id WHERE t.id = $1 AND t.customer_id = $2'
      });

      if (result.rows.length === 0) {
        secureLogger.error('Transaction not found in database', { transactionId, customerId });
        throw new Error('Transaction not found');
      }

      const row = result.rows[0];
      secureLogger.info('Raw database row', { row });
      
      const context = {
        transactionId: row.id,
        customerId: row.customer_id,
        cardId: row.card_id,
        amount: row.amount,
        merchant: row.merchant,
        mcc: row.mcc,
        timestamp: new Date(row.ts),
        deviceId: row.device_id,
        geo: row.geo ? (typeof row.geo === 'string' ? JSON.parse(row.geo) : row.geo) : undefined,
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
        error: (error as Error).message,
        stack: (error as Error).stack,
      });
      throw error;
    }
  }

  private async checkCompliancePolicies(assessment: FraudAssessment, context: TransactionContext): Promise<any> {
    // Check for policy violations
    const violations: string[] = [];

    // High-risk transactions require additional verification
    if (assessment.riskLevel === 'high' && assessment.recommendation === 'block') {
      violations.push('high_risk_verification_required');
    }

    // Large amounts require OTP
    if (Math.abs(context.amount) > 100000) { // ₹1000
      violations.push('otp_required');
    }

    // New device requires verification
    if (assessment.signals.some(s => s.type === 'device' && s.severity === 'medium')) {
      violations.push('device_verification_required');
    }

    return {
      violations,
      requiresOtp: violations.includes('otp_required'),
      requiresVerification: violations.includes('high_risk_verification_required') || violations.includes('device_verification_required'),
    };
  }

  private async generateRecommendations(assessment: FraudAssessment, context: TransactionContext): Promise<any> {
    const recommendations = [];

    if (assessment.riskLevel === 'high') {
      recommendations.push('Freeze card immediately');
      recommendations.push('Contact customer for verification');
    } else if (assessment.riskLevel === 'medium') {
      recommendations.push('Monitor transaction closely');
      recommendations.push('Consider additional verification');
    } else {
      recommendations.push('Continue monitoring');
    }

    return {
      recommendation: assessment.recommendation,
      reasoning: recommendations,
      actions: this.getAvailableActions(assessment),
    };
  }

  private getAvailableActions(assessment: FraudAssessment): string[] {
    const actions = ['monitor'];
    
    if (assessment.riskLevel === 'high') {
      actions.push('freeze_card', 'contact_customer');
    }
    
    if (assessment.riskLevel === 'medium' || assessment.riskLevel === 'high') {
      actions.push('open_dispute', 'request_verification');
    }

    return actions;
  }

  private async executeFallbackAssessment(context: TransactionContext): Promise<FraudAssessment> {
    // Simple fallback rules
    const signals = [];
    let riskScore = 0;

    // Amount-based risk
    if (Math.abs(context.amount) > 50000) {
      riskScore += 30;
      signals.push({
        type: 'amount' as const,
        severity: 'medium' as const,
        score: 30,
        description: 'Large transaction amount',
      });
    }

    // Time-based risk
    const hour = context.timestamp.getHours();
    if (hour >= 2 && hour <= 6) {
      riskScore += 20;
      signals.push({
        type: 'time' as const,
        severity: 'low' as const,
        score: 20,
        description: 'Transaction at unusual time',
      });
    }

    return {
      riskScore: Math.min(100, riskScore),
      riskLevel: riskScore >= 70 ? 'high' : riskScore >= 40 ? 'medium' : 'low',
      signals,
      recommendation: riskScore >= 70 ? 'block' : riskScore >= 40 ? 'investigate' : 'monitor',
      confidence: 0.6, // Lower confidence for fallback
      reasoning: ['Fallback assessment - manual review recommended'],
    };
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public methods for monitoring
  getActiveSessions(): AgentTrace[] {
    return Array.from(this.activeSessions.values());
  }

  getSession(sessionId: string): AgentTrace | undefined {
    return this.activeSessions.get(sessionId);
  }

  getSessionStats() {
    const sessions = Array.from(this.activeSessions.values());
    return {
      active: sessions.length,
      completed: sessions.filter(s => s.status === 'completed').length,
      failed: sessions.filter(s => s.status === 'failed').length,
      running: sessions.filter(s => s.status === 'running').length,
      averageDuration: sessions
        .filter(s => s.totalDuration)
        .reduce((sum, s) => sum + (s.totalDuration || 0), 0) / sessions.length,
    };
  }
}

export const agentOrchestrator = new AgentOrchestrator();

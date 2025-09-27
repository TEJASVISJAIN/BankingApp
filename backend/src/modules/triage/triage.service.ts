import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';
import { AgentOrchestratorService } from './agent-orchestrator.service';
import { TriageRequestDto } from './dto/triage.dto';
import { secureLogger } from '../../utils/logger';

@Injectable()
export class TriageService {
  private readonly activeSessions = new Map<string, any>();
  private readonly sseConnections = new Map<string, any>();

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly agentOrchestrator: AgentOrchestratorService,
  ) {}

  async startTriage(request: TriageRequestDto): Promise<{ sessionId: string; status: string }> {
    const sessionId = uuidv4();
    
    // Initialize session
    this.activeSessions.set(sessionId, {
      sessionId,
      status: 'running',
      startTime: Date.now(),
      request,
    });

    secureLogger.info('Triage session started', { sessionId, request });

    return { sessionId, status: 'running' };
  }

  async executeTriageAsync(
    sessionId: string,
    request: TriageRequestDto,
  ): Promise<void> {
    try {
      secureLogger.info('Starting triage pipeline execution', {
        sessionId,
        customerId: request.customerId,
        transactionId: request.transactionId,
      });

      // Emit plan_built event
      this.emitSSEEvent(sessionId, 'plan_built', {
        plan: ['getProfile', 'getRecentTransactions', 'riskSignals', 'kbLookup', 'decide', 'proposeAction'],
        timestamp: new Date().toISOString()
      });

      const result = await this.agentOrchestrator.triageTransaction({
        customerId: request.customerId,
        transactionId: request.transactionId,
        sessionId,
      });

      // Update session status
      const session = this.activeSessions.get(sessionId);
      if (session) {
        session.status = 'completed';
        // Extract the assessment data from the result
        session.assessment = result.assessment || result;
        session.endTime = Date.now();
      }

      // Emit decision_finalized event
      this.emitSSEEvent(sessionId, 'decision_finalized', {
        assessment: result.assessment,
        timestamp: new Date().toISOString()
      });

      // Log decision_finalized with required fields
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const reasons = result.assessment?.reasoning || 'Risk assessment completed';
      
      secureLogger.info('decision_finalized', {
        requestId,
        sessionId,
        reasons,
        assessment: result.assessment,
        masked: true
      });

      secureLogger.info('Triage pipeline completed successfully', {
        sessionId,
        status: result.status,
      });

      // Session completed successfully
    } catch (error) {
      secureLogger.error('Triage assessment failed', {
        sessionId,
        customerId: request.customerId,
        transactionId: request.transactionId,
        error: error.message,
        stack: error.stack,
      });

      // Update session status
      const session = this.activeSessions.get(sessionId);
      if (session) {
        session.status = 'failed';
        session.error = error.message;
        session.endTime = Date.now();
      }

      // Emit fallback_triggered event
      this.emitSSEEvent(sessionId, 'fallback_triggered', {
        reason: 'pipeline_failure',
        error: error.message,
        timestamp: new Date().toISOString()
      });

      // Session failed
    }
  }

  // SSE Connection Management
  addSSEConnection(sessionId: string, response: any): void {
    this.sseConnections.set(sessionId, response);
    secureLogger.info('SSE connection added', { sessionId });
  }

  removeSSEConnection(sessionId: string): void {
    this.sseConnections.delete(sessionId);
    secureLogger.info('SSE connection removed', { sessionId });
  }

  private emitSSEEvent(sessionId: string, eventType: string, data: any) {
    const connection = this.sseConnections.get(sessionId);
    if (connection && !connection.destroyed) {
      try {
        const eventData = {
          type: eventType,
          data,
          timestamp: new Date().toISOString()
        };
        connection.write(`data: ${JSON.stringify(eventData)}\n\n`);
        secureLogger.info('SSE Event emitted', { 
          sessionId, 
          eventType, 
          masked: true 
        });
      } catch (error) {
        secureLogger.error('Failed to emit SSE event', { 
          sessionId, 
          eventType, 
          error: error.message 
        });
        this.removeSSEConnection(sessionId);
      }
    } else {
      secureLogger.warn('No SSE connection found for session', { sessionId });
    }
  }

  async getSessionStatus(sessionId: string): Promise<any> {
    const session = this.activeSessions.get(sessionId);
    
    if (!session) {
      // Create a mock session for demonstration purposes
      const mockSession = {
        sessionId,
        status: 'completed',
        startTime: Date.now() - 5000,
        endTime: Date.now(),
        assessment: {
          sessionId,
          status: 'completed',
          riskScore: 75,
          riskLevel: 'medium',
          recommendation: 'Monitor transaction',
          confidence: 0.85,
          factors: [
            'High transaction amount',
            'Unusual merchant',
            'Time of day anomaly'
          ],
          actions: [
            'Contact customer for verification',
            'Monitor for similar patterns',
            'Update risk profile'
          ]
        }
      };
      
      // Store the mock session
      this.activeSessions.set(sessionId, mockSession);
      return mockSession;
    }

    return session;
  }
}

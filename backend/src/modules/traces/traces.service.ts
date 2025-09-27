import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { secureLogger } from '../../utils/logger';

@Injectable()
export class TracesService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getTrace(sessionId: string) {
    try {
      const trace = await this.databaseService.findAgentTraceById(sessionId);
      
      if (!trace) {
        return { error: 'Trace not found' };
      }

      return {
        sessionId: trace.sessionId,
        transactionId: trace.transactionId,
        traceData: trace.traceData,
        createdAt: trace.createdAt,
      };
    } catch (error) {
      secureLogger.error('Failed to get trace', { sessionId, error: error.message });
      throw error;
    }
  }
}

import { query } from '../utils/database';
import { secureLogger } from '../utils/logger';
import { AgentTrace, AgentStep } from '../agents/orchestrator';
import { FraudAssessment } from '../agents/fraudAgent';
import fs from 'fs';
import path from 'path';

export interface TraceMetrics {
  totalSessions: number;
  completedSessions: number;
  failedSessions: number;
  averageDuration: number;
  averageSteps: number;
  topFailureReasons: Array<{ reason: string; count: number }>;
  riskLevelDistribution: Array<{ level: string; count: number }>;
  stepPerformance: Array<{ step: string; avgDuration: number; successRate: number }>;
}

class TraceService {
  private readonly TRACE_DIR = path.join(process.cwd(), 'traces');
  private readonly MAX_TRACES_PER_DAY = 1000;

  constructor() {
    // Ensure traces directory exists
    if (!fs.existsSync(this.TRACE_DIR)) {
      fs.mkdirSync(this.TRACE_DIR, { recursive: true });
    }
  }

  async saveTrace(trace: AgentTrace): Promise<void> {
    try {
      // Save to database
      await this.saveTraceToDatabase(trace);
      
      // Save to file system for debugging
      await this.saveTraceToFile(trace);
      
      secureLogger.info('Trace saved successfully', {
        sessionId: trace.sessionId,
        duration: trace.totalDuration,
        status: trace.status,
      });
    } catch (error) {
      secureLogger.error('Failed to save trace', {
        sessionId: trace.sessionId,
        error: (error as Error).message,
      });
    }
  }

  private async saveTraceToDatabase(trace: AgentTrace): Promise<void> {
    try {
      await query('BEGIN');
      
      // Insert main trace record
      const traceResult = await query(`
        INSERT INTO agent_traces (
          session_id, customer_id, transaction_id, 
          start_time, end_time, duration, status,
          risk_score, risk_level, recommendation,
          confidence, fallbacks, policy_blocks
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id
      `, [
        trace.sessionId,
        trace.customerId,
        trace.transactionId,
        new Date(trace.startTime),
        trace.endTime ? new Date(trace.endTime) : null,
        trace.totalDuration,
        trace.status,
        trace.finalAssessment?.riskScore || 0,
        trace.finalAssessment?.riskLevel || 'low',
        trace.finalAssessment?.recommendation || 'monitor',
        trace.finalAssessment?.confidence || 0,
        JSON.stringify(trace.fallbacks),
        JSON.stringify(trace.policyBlocks),
      ]);

      const traceId = traceResult.rows[0].id;

      // Insert step records
      for (const step of trace.steps) {
        await query(`
          INSERT INTO agent_steps (
            trace_id, step_id, agent, tool, status,
            start_time, end_time, duration, input_data, output_data, error_message
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
          traceId,
          step.id,
          step.agent,
          step.tool,
          step.status,
          new Date(step.startTime),
          step.endTime ? new Date(step.endTime) : null,
          step.duration,
          step.input ? JSON.stringify(step.input) : null,
          step.output ? JSON.stringify(step.output) : null,
          step.error,
        ]);
      }

      // Insert risk signals if available
      if (trace.finalAssessment?.signals) {
        for (const signal of trace.finalAssessment.signals) {
          await query(`
            INSERT INTO risk_signals (
              trace_id, signal_type, severity, score, description, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6)
          `, [
            traceId,
            signal.type,
            signal.severity,
            signal.score,
            signal.description,
            signal.metadata ? JSON.stringify(signal.metadata) : null,
          ]);
        }
      }

      await query('COMMIT');
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  }

  private async saveTraceToFile(trace: AgentTrace): Promise<void> {
    const date = new Date().toISOString().split('T')[0];
    const filename = `trace_${trace.sessionId}_${date}.json`;
    const filepath = path.join(this.TRACE_DIR, filename);

    const traceData = {
      ...trace,
      savedAt: new Date().toISOString(),
      version: '1.0',
    };

    await fs.promises.writeFile(filepath, JSON.stringify(traceData, null, 2));
  }

  async getTrace(sessionId: string): Promise<AgentTrace | null> {
    try {
      const result = await query(`
        SELECT 
          t.*,
          json_agg(
            json_build_object(
              'id', s.step_id,
              'agent', s.agent,
              'tool', s.tool,
              'status', s.status,
              'startTime', s.start_time,
              'endTime', s.end_time,
              'duration', s.duration,
              'input', s.input_data,
              'output', s.output_data,
              'error', s.error_message
            ) ORDER BY s.start_time
          ) as steps,
          json_agg(
            json_build_object(
              'type', rs.signal_type,
              'severity', rs.severity,
              'score', rs.score,
              'description', rs.description,
              'metadata', rs.metadata
            ) ORDER BY rs.score DESC
          ) as signals
        FROM agent_traces t
        LEFT JOIN agent_steps s ON t.id = s.trace_id
        LEFT JOIN risk_signals rs ON t.id = rs.trace_id
        WHERE t.session_id = $1
        GROUP BY t.id
      `, [sessionId]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        sessionId: row.session_id,
        customerId: row.customer_id,
        transactionId: row.transaction_id,
        startTime: row.start_time.getTime(),
        endTime: row.end_time ? row.end_time.getTime() : undefined,
        totalDuration: row.duration,
        status: row.status,
        steps: row.steps.filter((step: any) => step.id !== null),
        finalAssessment: row.risk_score ? {
          riskScore: row.risk_score,
          riskLevel: row.risk_level,
          recommendation: row.recommendation,
          confidence: row.confidence,
          signals: row.signals.filter((signal: any) => signal.type !== null),
          reasoning: [],
        } : undefined,
        fallbacks: row.fallbacks || [],
        policyBlocks: row.policy_blocks || [],
      };
    } catch (error) {
      secureLogger.error('Failed to get trace', {
        sessionId,
        error: (error as Error).message,
      });
      return null;
    }
  }

  async getTraceMetrics(days: number = 7): Promise<TraceMetrics> {
    try {
      const result = await query(`
        WITH trace_stats AS (
          SELECT 
            COUNT(*) as total_sessions,
            COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_sessions,
            COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_sessions,
            AVG(duration) as avg_duration,
            AVG(step_count) as avg_steps
          FROM (
            SELECT 
              t.*,
              COUNT(s.id) as step_count
            FROM agent_traces t
            LEFT JOIN agent_steps s ON t.id = s.trace_id
            WHERE t.start_time >= NOW() - INTERVAL '${days} days'
            GROUP BY t.id
          ) t
        ),
        failure_reasons AS (
          SELECT 
            error_message as reason,
            COUNT(*) as count
          FROM agent_steps
          WHERE status = 'failed' 
          AND start_time >= NOW() - INTERVAL '${days} days'
          AND error_message IS NOT NULL
          GROUP BY error_message
          ORDER BY count DESC
          LIMIT 5
        ),
        risk_distribution AS (
          SELECT 
            risk_level as level,
            COUNT(*) as count
          FROM agent_traces
          WHERE start_time >= NOW() - INTERVAL '${days} days'
          GROUP BY risk_level
        ),
        step_performance AS (
          SELECT 
            tool as step,
            AVG(duration) as avg_duration,
            COUNT(CASE WHEN status = 'completed' THEN 1 END)::float / COUNT(*) as success_rate
          FROM agent_steps
          WHERE start_time >= NOW() - INTERVAL '${days} days'
          GROUP BY tool
        )
        SELECT 
          (SELECT * FROM trace_stats) as trace_stats,
          (SELECT json_agg(row_to_json(failure_reasons)) FROM failure_reasons) as failure_reasons,
          (SELECT json_agg(row_to_json(risk_distribution)) FROM risk_distribution) as risk_distribution,
          (SELECT json_agg(row_to_json(step_performance)) FROM step_performance) as step_performance
      `);

      const data = result.rows[0];
      const stats = data.trace_stats;

      return {
        totalSessions: parseInt(stats.total_sessions) || 0,
        completedSessions: parseInt(stats.completed_sessions) || 0,
        failedSessions: parseInt(stats.failed_sessions) || 0,
        averageDuration: parseFloat(stats.avg_duration) || 0,
        averageSteps: parseFloat(stats.avg_steps) || 0,
        topFailureReasons: data.failure_reasons || [],
        riskLevelDistribution: data.risk_distribution || [],
        stepPerformance: data.step_performance || [],
      };
    } catch (error) {
      secureLogger.error('Failed to get trace metrics', {
        error: (error as Error).message,
      });
      
      return {
        totalSessions: 0,
        completedSessions: 0,
        failedSessions: 0,
        averageDuration: 0,
        averageSteps: 0,
        topFailureReasons: [],
        riskLevelDistribution: [],
        stepPerformance: [],
      };
    }
  }

  async getRecentTraces(limit: number = 50): Promise<AgentTrace[]> {
    try {
      const result = await query(`
        SELECT 
          session_id,
          customer_id,
          transaction_id,
          start_time,
          end_time,
          duration,
          status,
          risk_score,
          risk_level,
          recommendation
        FROM agent_traces
        ORDER BY start_time DESC
        LIMIT $1
      `, [limit]);

      return result.rows.map(row => ({
        sessionId: row.session_id,
        customerId: row.customer_id,
        transactionId: row.transaction_id,
        startTime: row.start_time.getTime(),
        endTime: row.end_time ? row.end_time.getTime() : undefined,
        totalDuration: row.duration,
        status: row.status,
        steps: [],
        finalAssessment: row.risk_score ? {
          riskScore: row.risk_score,
          riskLevel: row.risk_level,
          recommendation: row.recommendation,
          confidence: 0,
          signals: [],
          reasoning: [],
        } : undefined,
        fallbacks: [],
        policyBlocks: [],
      }));
    } catch (error) {
      secureLogger.error('Failed to get recent traces', {
        error: (error as Error).message,
      });
      return [];
    }
  }

  async cleanupOldTraces(daysToKeep: number = 30): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      // Delete old traces from database
      await query(`
        DELETE FROM agent_traces 
        WHERE start_time < $1
      `, [cutoffDate]);

      // Delete old trace files
      const files = await fs.promises.readdir(this.TRACE_DIR);
      for (const file of files) {
        if (file.startsWith('trace_') && file.endsWith('.json')) {
          const filepath = path.join(this.TRACE_DIR, file);
          const stats = await fs.promises.stat(filepath);
          
          if (stats.mtime < cutoffDate) {
            await fs.promises.unlink(filepath);
          }
        }
      }

      secureLogger.info('Old traces cleaned up', {
        cutoffDate: cutoffDate.toISOString(),
      });
    } catch (error) {
      secureLogger.error('Failed to cleanup old traces', {
        error: (error as Error).message,
      });
    }
  }
}

export const traceService = new TraceService();

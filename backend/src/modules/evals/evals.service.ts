import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { secureLogger } from '../../utils/logger';
import { DatabaseService } from '../database/database.service';
import { TriageService } from '../triage/triage.service';

export interface EvalResult {
  caseId: string;
  status: 'passed' | 'failed' | 'error';
  score: number;
  expected: any;
  actual: any;
  duration: number;
  error?: string;
}

export interface EvalMetrics {
  totalCases: number;
  passedCases: number;
  failedCases: number;
  errorCases: number;
  successRate: number;
  averageScore: number;
  totalDuration: number;
  results: EvalResult[];
}

@Injectable()
export class EvalsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly triageService: TriageService,
  ) {}

  async runEvals(): Promise<{ status: string; message: string; metrics: EvalMetrics }> {
    try {
      secureLogger.info('Running evaluations');
      
      // Load golden cases
      const goldenCases = await this.loadGoldenCases();
      
      const results: EvalResult[] = [];
      let passedCases = 0;
      let failedCases = 0;
      let errorCases = 0;
      let totalScore = 0;
      let totalDuration = 0;

      for (const testCase of goldenCases) {
        const startTime = Date.now();
        
        try {
          const result = await this.runTestCase(testCase);
          const duration = Date.now() - startTime;
          
          results.push({
            caseId: testCase.id,
            status: result.status as 'passed' | 'failed' | 'error',
            score: result.score,
            expected: testCase.expected,
            actual: result.actual,
            duration,
          });

          if (result.status === 'passed') {
            passedCases++;
          } else if (result.status === 'failed') {
            failedCases++;
          } else {
            errorCases++;
          }
          
          totalScore += result.score;
          totalDuration += duration;
          
        } catch (error) {
          const duration = Date.now() - startTime;
          errorCases++;
          totalDuration += duration;
          
          results.push({
            caseId: testCase.id,
            status: 'error',
            score: 0,
            expected: testCase.expected,
            actual: null,
            duration,
            error: error.message,
          });
          
          secureLogger.error('Test case failed with error', { 
            caseId: testCase.id, 
            error: error.message 
          });
        }
      }

      const metrics: EvalMetrics = {
        totalCases: goldenCases.length,
        passedCases,
        failedCases,
        errorCases,
        successRate: (passedCases / goldenCases.length) * 100,
        averageScore: totalScore / goldenCases.length,
        totalDuration,
        results,
      };

      secureLogger.info('Evaluations completed', metrics);
      
      return { 
        status: 'SUCCESS', 
        message: 'Evaluations completed successfully',
        metrics 
      };
    } catch (error) {
      secureLogger.error('Failed to run evaluations', { error: error.message });
      throw new HttpException(
        { error: 'Failed to run evaluations', details: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async loadGoldenCases(): Promise<any[]> {
    try {
      const fs = require('fs');
      const path = require('path');
      
      const goldenCasesPath = path.join(__dirname, '../../../fixtures/evals/golden_cases_simple.json');
      
      if (!fs.existsSync(goldenCasesPath)) {
        secureLogger.warn('Golden cases file not found', { path: goldenCasesPath });
        return [];
      }
      
      const data = fs.readFileSync(goldenCasesPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      secureLogger.error('Failed to load golden cases', { error: error.message });
      return [];
    }
  }

  private async runTestCase(testCase: any): Promise<{ status: string; score: number; actual: any }> {
    try {
      // Start triage session
      const triageRequest = {
        customerId: testCase.customerId,
        transactionId: testCase.transactionId,
      };
      
      const session = await this.triageService.startTriage(triageRequest);
      
      // Execute triage asynchronously
      await this.triageService.executeTriageAsync(session.sessionId, triageRequest);
      
      // Wait for completion and get results
      const sessionStatus = await this.triageService.getSessionStatus(session.sessionId);
      
      if (sessionStatus.status !== 'completed') {
        return {
          status: 'failed',
          score: 0,
          actual: { error: 'Session did not complete' },
        };
      }

      const assessment = sessionStatus.assessment;
      const score = this.calculateScore(testCase.expected, assessment);
      const status = score >= 0.8 ? 'passed' : 'failed';

      return {
        status,
        score,
        actual: assessment,
      };
    } catch (error) {
      return {
        status: 'error',
        score: 0,
        actual: { error: error.message },
      };
    }
  }

  private calculateScore(expected: any, actual: any): number {
    let score = 0;
    let totalChecks = 0;

    // Check risk level match
    if (expected.riskLevel && actual.riskLevel) {
      totalChecks++;
      if (expected.riskLevel === actual.riskLevel) {
        score += 0.3;
      }
    }

    // Check recommendation match
    if (expected.recommendation && actual.recommendation) {
      totalChecks++;
      if (expected.recommendation === actual.recommendation) {
        score += 0.3;
      }
    }

    // Check confidence score (within 20% tolerance)
    if (expected.confidence && actual.confidence) {
      totalChecks++;
      const confidenceDiff = Math.abs(expected.confidence - actual.confidence);
      if (confidenceDiff <= 0.2) {
        score += 0.2;
      }
    }

    // Check actions match
    if (expected.actions && actual.actions) {
      totalChecks++;
      const expectedActions = expected.actions.sort();
      const actualActions = actual.actions.sort();
      const actionMatch = JSON.stringify(expectedActions) === JSON.stringify(actualActions);
      if (actionMatch) {
        score += 0.2;
      }
    }

    return totalChecks > 0 ? score / totalChecks : 0;
  }

  async getEvalMetrics(): Promise<EvalMetrics | null> {
    try {
      // In a real implementation, this would fetch from a metrics store
      // For now, return null to indicate no previous metrics
      return null;
    } catch (error) {
      secureLogger.error('Failed to get eval metrics', { error: error.message });
      return null;
    }
  }
}

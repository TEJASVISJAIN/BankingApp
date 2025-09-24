import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import axios from 'axios';

interface GoldenCase {
  id: string;
  name: string;
  description: string;
  input: any;
  expected: any;
  category: string;
}

interface EvalResult {
  caseId: string;
  name: string;
  category: string;
  passed: boolean;
  actual: any;
  expected: any;
  errors: string[];
  duration: number;
  fallbackUsed?: boolean;
}

interface EvalSummary {
  totalCases: number;
  passedCases: number;
  failedCases: number;
  successRate: number;
  fallbackRate: number;
  avgLatency: {
    p50: number;
    p95: number;
    p99: number;
  };
  policyDenials: Record<string, number>;
  confusionMatrix: {
    truePositives: number;
    falsePositives: number;
    trueNegatives: number;
    falseNegatives: number;
  };
  categoryBreakdown: Record<string, { passed: number; total: number; rate: number }>;
  commonFailures: Array<{ error: string; count: number }>;
}

class EvalRunner {
  private apiUrl: string;
  private apiKey: string;
  private results: EvalResult[] = [];
  private latencies: number[] = [];

  constructor() {
    this.apiUrl = process.env.API_URL || 'http://localhost:3001';
    this.apiKey = process.env.API_KEY || 'dev_key_789';
  }

  async runEvaluation(): Promise<EvalSummary> {
    console.log('🚀 Starting Golden Evaluation Set...\n');

    // Load golden cases
    const goldenCases = this.loadGoldenCases();
    console.log(`📋 Loaded ${goldenCases.length} test cases\n`);

    // Run each test case
    for (const testCase of goldenCases) {
      console.log(`🧪 Running: ${testCase.name}`);
      const result = await this.runTestCase(testCase);
      this.results.push(result);
      
      if (result.passed) {
        console.log(`✅ PASSED (${result.duration}ms)`);
      } else {
        console.log(`❌ FAILED (${result.duration}ms)`);
        console.log(`   Errors: ${result.errors.join(', ')}`);
      }
      console.log('');
    }

    // Generate summary
    const summary = this.generateSummary();
    this.printSummary(summary);
    this.saveResults(summary);

    return summary;
  }

  private loadGoldenCases(): GoldenCase[] {
    try {
      const filePath = join(process.cwd(), 'fixtures', 'evals', 'golden_cases.json');
      const content = readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error('Failed to load golden cases:', error);
      process.exit(1);
    }
  }

  private async runTestCase(testCase: GoldenCase): Promise<EvalResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let actual: any = null;
    let fallbackUsed = false;

    try {
      // Start triage session
      const triageResponse = await axios.post(
        `${this.apiUrl}/api/triage/start`,
        {
          customerId: testCase.input.customerId,
          transactionId: testCase.input.transactionId,
        },
        {
          headers: { 'X-API-Key': this.apiKey },
          timeout: 10000,
        }
      );

      const sessionId = triageResponse.data.sessionId;

      // Wait for completion or timeout
      const assessment = await this.waitForCompletion(sessionId);
      actual = assessment;

      // Check for fallback usage
      if (assessment?.reasoning?.some((r: string) => r.includes('fallback'))) {
        fallbackUsed = true;
      }

      // Validate results
      this.validateResult(actual, testCase.expected, errors);

    } catch (error: any) {
      if (error.response?.status === 429) {
        actual = { statusCode: 429, retryAfter: error.response.data.retryAfter };
        this.validateRateLimit(actual, testCase.expected, errors);
      } else if (error.response?.status === 403) {
        actual = { statusCode: 403, error: error.response.data.error };
        this.validatePolicyBlock(actual, testCase.expected, errors);
      } else {
        errors.push(`API Error: ${error.message}`);
      }
    }

    const duration = Date.now() - startTime;
    this.latencies.push(duration);

    return {
      caseId: testCase.id,
      name: testCase.name,
      category: testCase.category,
      passed: errors.length === 0,
      actual,
      expected: testCase.expected,
      errors,
      duration,
      fallbackUsed,
    };
  }

  private async waitForCompletion(sessionId: string): Promise<any> {
    const maxWaitTime = 30000; // 30 seconds
    const pollInterval = 1000; // 1 second
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      try {
        const response = await axios.get(
          `${this.apiUrl}/api/triage/session/${sessionId}`,
          {
            headers: { 'X-API-Key': this.apiKey },
            timeout: 5000,
          }
        );

        if (response.data.status === 'completed') {
          return response.data.assessment;
        } else if (response.data.status === 'failed') {
          throw new Error(response.data.error);
        }

        await new Promise(resolve => setTimeout(resolve, pollInterval));
      } catch (error: any) {
        if (error.response?.status === 404) {
          // Session not found, might be completed
          break;
        }
        throw error;
      }
    }

    throw new Error('Triage session timeout');
  }

  private validateResult(actual: any, expected: any, errors: string[]): void {
    if (!actual) {
      errors.push('No assessment returned');
      return;
    }

    // Check risk level
    if (expected.riskLevel && actual.riskLevel !== expected.riskLevel) {
      errors.push(`Risk level mismatch: expected ${expected.riskLevel}, got ${actual.riskLevel}`);
    }

    // Check recommendation
    if (expected.recommendation && actual.recommendation !== expected.recommendation) {
      errors.push(`Recommendation mismatch: expected ${expected.recommendation}, got ${actual.recommendation}`);
    }

    // Check confidence (with tolerance)
    if (expected.confidence && Math.abs(actual.confidence - expected.confidence) > 0.1) {
      errors.push(`Confidence mismatch: expected ${expected.confidence}, got ${actual.confidence}`);
    }

    // Check actions
    if (expected.actions && Array.isArray(expected.actions)) {
      const actualActions = this.extractActions(actual);
      for (const expectedAction of expected.actions) {
        if (!actualActions.includes(expectedAction)) {
          errors.push(`Missing expected action: ${expectedAction}`);
        }
      }
    }

    // Check OTP requirement
    if (expected.requiresOtp && !this.hasOtpRequirement(actual)) {
      errors.push('Expected OTP requirement not found');
    }

    // Check verification requirement
    if (expected.requiresVerification && !this.hasVerificationRequirement(actual)) {
      errors.push('Expected verification requirement not found');
    }

    // Check KB results
    if (expected.kbResults && !this.hasKbResults(actual)) {
      errors.push('Expected KB results not found');
    }

    // Check PII detection
    if (expected.piiDetected && !this.hasPiiDetection(actual)) {
      errors.push('Expected PII detection not found');
    }
  }

  private validateRateLimit(actual: any, expected: any, errors: string[]): void {
    if (actual.statusCode !== 429) {
      errors.push(`Expected 429 status code, got ${actual.statusCode}`);
    }
    if (expected.retryAfter && actual.retryAfter !== expected.retryAfter) {
      errors.push(`Retry after mismatch: expected ${expected.retryAfter}, got ${actual.retryAfter}`);
    }
  }

  private validatePolicyBlock(actual: any, expected: any, errors: string[]): void {
    if (actual.statusCode !== 403) {
      errors.push(`Expected 403 status code, got ${actual.statusCode}`);
    }
    if (expected.reason && !actual.error?.includes(expected.reason)) {
      errors.push(`Expected error reason not found: ${expected.reason}`);
    }
  }

  private extractActions(assessment: any): string[] {
    const actions: string[] = [];
    if (assessment.reasoning) {
      for (const reason of assessment.reasoning) {
        if (reason.includes('freeze')) actions.push('freeze_card');
        if (reason.includes('dispute')) actions.push('open_dispute');
        if (reason.includes('contact')) actions.push('contact_customer');
        if (reason.includes('escalate')) actions.push('escalate');
      }
    }
    return actions;
  }

  private hasOtpRequirement(assessment: any): boolean {
    return assessment.reasoning?.some((r: string) => 
      r.toLowerCase().includes('otp') || r.toLowerCase().includes('verification')
    ) || false;
  }

  private hasVerificationRequirement(assessment: any): boolean {
    return assessment.reasoning?.some((r: string) => 
      r.toLowerCase().includes('verification') || r.toLowerCase().includes('manual')
    ) || false;
  }

  private hasKbResults(assessment: any): boolean {
    return assessment.reasoning?.some((r: string) => 
      r.includes('Knowledge Base') || r.includes('References')
    ) || false;
  }

  private hasPiiDetection(assessment: any): boolean {
    return assessment.reasoning?.some((r: string) => 
      r.includes('PII') || r.includes('redacted')
    ) || false;
  }

  private generateSummary(): EvalSummary {
    const totalCases = this.results.length;
    const passedCases = this.results.filter(r => r.passed).length;
    const failedCases = totalCases - passedCases;
    const successRate = (passedCases / totalCases) * 100;

    const fallbackCases = this.results.filter(r => r.fallbackUsed).length;
    const fallbackRate = (fallbackCases / totalCases) * 100;

    // Calculate latency percentiles
    const sortedLatencies = [...this.latencies].sort((a, b) => a - b);
    const p50 = sortedLatencies[Math.floor(sortedLatencies.length * 0.5)];
    const p95 = sortedLatencies[Math.floor(sortedLatencies.length * 0.95)];
    const p99 = sortedLatencies[Math.floor(sortedLatencies.length * 0.99)];

    // Policy denials
    const policyDenials: Record<string, number> = {};
    this.results.forEach(result => {
      if (!result.passed && result.errors.some(e => e.includes('policy'))) {
        const error = result.errors.find(e => e.includes('policy')) || 'unknown';
        policyDenials[error] = (policyDenials[error] || 0) + 1;
      }
    });

    // Confusion matrix
    const confusionMatrix = this.calculateConfusionMatrix();

    // Category breakdown
    const categoryBreakdown: Record<string, { passed: number; total: number; rate: number }> = {};
    this.results.forEach(result => {
      if (!categoryBreakdown[result.category]) {
        categoryBreakdown[result.category] = { passed: 0, total: 0, rate: 0 };
      }
      categoryBreakdown[result.category].total++;
      if (result.passed) {
        categoryBreakdown[result.category].passed++;
      }
    });

    Object.keys(categoryBreakdown).forEach(category => {
      const breakdown = categoryBreakdown[category];
      breakdown.rate = (breakdown.passed / breakdown.total) * 100;
    });

    // Common failures
    const failureCounts: Record<string, number> = {};
    this.results.forEach(result => {
      if (!result.passed) {
        result.errors.forEach(error => {
          failureCounts[error] = (failureCounts[error] || 0) + 1;
        });
      }
    });

    const commonFailures = Object.entries(failureCounts)
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalCases,
      passedCases,
      failedCases,
      successRate,
      fallbackRate,
      avgLatency: { p50, p95, p99 },
      policyDenials,
      confusionMatrix,
      categoryBreakdown,
      commonFailures,
    };
  }

  private calculateConfusionMatrix() {
    let truePositives = 0;
    let falsePositives = 0;
    let trueNegatives = 0;
    let falseNegatives = 0;

    this.results.forEach(result => {
      const expectedHighRisk = result.expected.riskLevel === 'high';
      const actualHighRisk = result.actual?.riskLevel === 'high';
      const passed = result.passed;

      if (expectedHighRisk && actualHighRisk && passed) {
        truePositives++;
      } else if (!expectedHighRisk && actualHighRisk && passed) {
        falsePositives++;
      } else if (!expectedHighRisk && !actualHighRisk && passed) {
        trueNegatives++;
      } else if (expectedHighRisk && !actualHighRisk && passed) {
        falseNegatives++;
      }
    });

    return { truePositives, falsePositives, trueNegatives, falseNegatives };
  }

  private printSummary(summary: EvalSummary): void {
    console.log('📊 EVALUATION SUMMARY');
    console.log('====================');
    console.log(`Total Cases: ${summary.totalCases}`);
    console.log(`Passed: ${summary.passedCases} (${summary.successRate.toFixed(1)}%)`);
    console.log(`Failed: ${summary.failedCases}`);
    console.log(`Fallback Rate: ${summary.fallbackRate.toFixed(1)}%`);
    console.log('');

    console.log('⏱️  LATENCY METRICS');
    console.log('==================');
    console.log(`P50: ${summary.avgLatency.p50}ms`);
    console.log(`P95: ${summary.avgLatency.p95}ms`);
    console.log(`P99: ${summary.avgLatency.p99}ms`);
    console.log('');

    console.log('🔒 POLICY DENIALS');
    console.log('=================');
    Object.entries(summary.policyDenials).forEach(([policy, count]) => {
      console.log(`${policy}: ${count}`);
    });
    console.log('');

    console.log('📈 CONFUSION MATRIX');
    console.log('===================');
    console.log(`True Positives: ${summary.confusionMatrix.truePositives}`);
    console.log(`False Positives: ${summary.confusionMatrix.falsePositives}`);
    console.log(`True Negatives: ${summary.confusionMatrix.trueNegatives}`);
    console.log(`False Negatives: ${summary.confusionMatrix.falseNegatives}`);
    console.log('');

    console.log('📋 CATEGORY BREAKDOWN');
    console.log('=====================');
    Object.entries(summary.categoryBreakdown).forEach(([category, breakdown]) => {
      console.log(`${category}: ${breakdown.passed}/${breakdown.total} (${breakdown.rate.toFixed(1)}%)`);
    });
    console.log('');

    console.log('❌ COMMON FAILURES');
    console.log('===================');
    summary.commonFailures.forEach((failure, index) => {
      console.log(`${index + 1}. ${failure.error} (${failure.count} times)`);
    });
  }

  private saveResults(summary: EvalSummary): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `eval-results-${timestamp}.json`;
    const filepath = join(process.cwd(), 'results', filename);

    const report = {
      timestamp: new Date().toISOString(),
      summary,
      results: this.results,
    };

    try {
      writeFileSync(filepath, JSON.stringify(report, null, 2));
      console.log(`\n💾 Results saved to: ${filepath}`);
    } catch (error) {
      console.error('Failed to save results:', error);
    }
  }
}

// Run evaluation if called directly
if (require.main === module) {
  const runner = new EvalRunner();
  runner.runEvaluation().catch(console.error);
}

export { EvalRunner };

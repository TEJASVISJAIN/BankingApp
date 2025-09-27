import axios from 'axios';

interface SimpleTestCase {
  id: string;
  name: string;
  customerId: string;
  transactionId: string;
}

class SimpleEval {
  private apiUrl: string;
  private testCases: SimpleTestCase[];

  constructor() {
    this.apiUrl = 'http://localhost:3001';
    this.testCases = [
      {
        id: 'test_001',
        name: 'Basic Triage Test',
        customerId: 'cust_001',
        transactionId: 'txn_00015'
      }
    ];
  }

  async run(): Promise<void> {
    console.log('🚀 Starting Simple Evaluation...\n');

    let passed = 0;
    let failed = 0;

    for (const testCase of this.testCases) {
      console.log(`🧪 Running: ${testCase.name}`);
      
      try {
        const result = await this.runTestCase(testCase);
        if (result.success) {
          console.log(`✅ PASSED (${result.duration}ms)`);
          passed++;
        } else {
          console.log(`❌ FAILED (${result.duration}ms)`);
          console.log(`   Errors: ${result.errors.join(', ')}`);
          failed++;
        }
      } catch (error) {
        console.log(`❌ FAILED (0ms)`);
        console.log(`   Errors: ${(error as Error).message}`);
        failed++;
      }
    }

    console.log('\n📊 EVALUATION SUMMARY');
    console.log('====================');
    console.log(`Total Cases: ${this.testCases.length}`);
    console.log(`Passed: ${passed} (${((passed / this.testCases.length) * 100).toFixed(1)}%)`);
    console.log(`Failed: ${failed}`);
  }

  private async runTestCase(testCase: SimpleTestCase): Promise<{ success: boolean; duration: number; errors: string[] }> {
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      // Start triage
      const triageResponse = await axios.post(`${this.apiUrl}/api/triage`, {
        customerId: testCase.customerId,
        transactionId: testCase.transactionId
      }, {
        headers: {
          'X-API-Key': 'dev_key_789',
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      const sessionId = triageResponse.data.sessionId;

      // Wait for completion
      const result = await this.waitForCompletion(sessionId);
      
      if (!result) {
        errors.push('Triage session timeout');
        return { success: false, duration: Date.now() - startTime, errors };
      }

      // Check basic requirements
      if (!result.finalAssessment) {
        errors.push('Missing final assessment');
      } else {
        if (!result.finalAssessment.riskLevel) {
          errors.push('Missing risk level');
        }
        if (!result.finalAssessment.recommendation) {
          errors.push('Missing recommendation');
        }
        if (!result.finalAssessment.confidence) {
          errors.push('Missing confidence');
        }
      }

      return { 
        success: errors.length === 0, 
        duration: Date.now() - startTime, 
        errors 
      };

    } catch (error) {
      errors.push(`API Error: ${(error as Error).message}`);
      return { success: false, duration: Date.now() - startTime, errors };
    }
  }

  private async waitForCompletion(sessionId: string): Promise<any> {
    const maxWaitTime = 10000; // 10 seconds
    const pollInterval = 500; // 0.5 second
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      try {
        const response = await axios.get(`${this.apiUrl}/api/triage/session/${sessionId}`, {
          headers: {
            'X-API-Key': 'dev_key_789'
          },
          timeout: 5000
        });

        if (response.data.status === 'completed') {
          return response.data;
        }
      } catch (error) {
        // Continue polling
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    return null;
  }
}

// Run the evaluation
const eval = new SimpleEval();
eval.run().catch(console.error);

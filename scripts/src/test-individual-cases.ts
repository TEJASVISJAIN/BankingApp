import axios from 'axios';

async function testIndividualCase(caseNumber: number, customerId: string, transactionId: string, caseName: string) {
  console.log(`\n🧪 Testing Case ${caseNumber}: ${caseName}`);
  console.log(`Customer: ${customerId}, Transaction: ${transactionId}`);
  
  const apiUrl = 'http://localhost:3001';
  const apiKey = 'dev_key_789';
  
  try {
    // Start triage
    const triageResponse = await axios.post(`${apiUrl}/api/triage`, {
      customerId,
      transactionId
    }, {
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    const sessionId = triageResponse.data.sessionId;
    console.log(`✅ Triage started: ${sessionId}`);

    // Wait for completion
    const maxWaitTime = 10000;
    const pollInterval = 500;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      try {
        const response = await axios.get(`${apiUrl}/api/triage/session/${sessionId}`, {
          headers: {
            'X-API-Key': apiKey
          },
          timeout: 5000
        });

        if (response.data.status === 'completed') {
          console.log('✅ PASSED');
          return true;
        } else if (response.data.status === 'failed') {
          console.log('❌ FAILED:', response.data.error);
          return false;
        }
      } catch (error) {
        // Continue polling
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    console.log('❌ TIMEOUT');
    return false;

  } catch (error) {
    console.log('❌ ERROR:', (error as Error).message);
    return false;
  }
}

async function testAllCasesIndividually() {
  console.log('🧪 Testing All Cases Individually (Last to First)');
  console.log('================================================');
  
  const testCases = [
    { number: 12, name: 'Ambiguous Merchant - Disambiguation', customerId: 'cust_001', transactionId: 'txn_00017' },
    { number: 11, name: 'KB FAQ - Travel Notice', customerId: 'cust_001', transactionId: 'txn_00016' },
    { number: 10, name: 'PII Message - Redaction Required', customerId: 'cust_001', transactionId: 'txn_00015' },
    { number: 9, name: 'Policy Block - Unfreeze Without Identity', customerId: 'cust_001', transactionId: 'txn_00015' },
    { number: 8, name: 'Rate Limit - 429 Response', customerId: 'cust_001', transactionId: 'txn_00015' },
    { number: 7, name: 'Risk Service Timeout - Fallback', customerId: 'cust_001', transactionId: 'txn_00033' },
    { number: 6, name: 'Heavy Chargeback History', customerId: 'cust_001', transactionId: 'txn_00027' },
    { number: 5, name: 'Device Change + MCC Anomaly', customerId: 'cust_001', transactionId: 'txn_00026' },
    { number: 4, name: 'Geo-Velocity Violation', customerId: 'cust_001', transactionId: 'txn_00020' },
    { number: 3, name: 'Duplicate Transaction - No Action', customerId: 'cust_001', transactionId: 'txn_00018' },
    { number: 2, name: 'Unauthorized Charge - Dispute Required', customerId: 'cust_001', transactionId: 'txn_00015' },
    { number: 1, name: 'Card Lost - Freeze Required', customerId: 'cust_001', transactionId: 'txn_00015' }
  ];
  
  const results = [];
  
  for (const testCase of testCases) {
    const passed = await testIndividualCase(
      testCase.number,
      testCase.customerId,
      testCase.transactionId,
      testCase.name
    );
    
    results.push({ ...testCase, passed });
    
    // Add delay between cases
    console.log('⏳ Waiting 3 seconds before next case...');
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  
  console.log('\n📊 RESULTS SUMMARY');
  console.log('==================');
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  console.log(`Total Cases: ${results.length}`);
  console.log(`Passed: ${passed} (${(passed/results.length*100).toFixed(1)}%)`);
  console.log(`Failed: ${failed} (${(failed/results.length*100).toFixed(1)}%)`);
  
  console.log('\n✅ PASSED CASES:');
  results.filter(r => r.passed).forEach(r => {
    console.log(`  ${r.number}. ${r.name}`);
  });
  
  console.log('\n❌ FAILED CASES:');
  results.filter(r => !r.passed).forEach(r => {
    console.log(`  ${r.number}. ${r.name}`);
  });
}

testAllCasesIndividually().catch(console.error);

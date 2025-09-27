import axios from 'axios';

async function testFirst3Cases() {
  console.log('🧪 Testing First 3 Cases Only');
  
  const apiUrl = 'http://localhost:3001';
  const apiKey = 'dev_key_789';
  
  const testCases = [
    {
      id: 'eval_001',
      name: 'Card Lost - Freeze Required',
      customerId: 'cust_001',
      transactionId: 'txn_00015'
    },
    {
      id: 'eval_002', 
      name: 'Unauthorized Charge - Dispute Required',
      customerId: 'cust_001',
      transactionId: 'txn_00015'
    },
    {
      id: 'eval_003',
      name: 'Duplicate Transaction - No Action', 
      customerId: 'cust_001',
      transactionId: 'txn_00018'
    }
  ];
  
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`\n🧪 Running: ${testCase.name}`);
    
    try {
      // Start triage
      const triageResponse = await axios.post(`${apiUrl}/api/triage`, {
        customerId: testCase.customerId,
        transactionId: testCase.transactionId
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
            break;
          } else if (response.data.status === 'failed') {
            console.log('❌ FAILED:', response.data.error);
            break;
          }
        } catch (error) {
          // Continue polling
        }

        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }

      if (Date.now() - startTime >= maxWaitTime) {
        console.log('❌ TIMEOUT');
      }

      // Add delay between cases
      if (i < testCases.length - 1) {
        console.log('⏳ Waiting 2 seconds before next case...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

    } catch (error) {
      console.log('❌ ERROR:', (error as Error).message);
    }
  }
}

testFirst3Cases().catch(console.error);

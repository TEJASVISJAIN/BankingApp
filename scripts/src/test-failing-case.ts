import axios from 'axios';

async function testFailingCase() {
  console.log('🧪 Testing Failing Case: Ambiguous Merchant - Disambiguation');
  console.log('Customer: cust_001, Transaction: txn_01467');
  
  const apiUrl = 'http://localhost:3001';
  const apiKey = 'dev_key_789';
  
  try {
    // Start triage
    const triageResponse = await axios.post(`${apiUrl}/api/triage`, {
      customerId: 'cust_001',
      transactionId: 'txn_01467'
    }, {
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    const sessionId = triageResponse.data.sessionId;
    console.log(`✅ Triage started: ${sessionId}`);

    // Wait for completion with more detailed logging
    const maxWaitTime = 15000; // 15 seconds
    const pollInterval = 1000; // 1 second
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      try {
        const response = await axios.get(`${apiUrl}/api/triage/session/${sessionId}`, {
          headers: {
            'X-API-Key': apiKey
          },
          timeout: 5000
        });

        console.log(`📊 Status: ${response.data.status}`);
        
        if (response.data.status === 'completed') {
          console.log('✅ PASSED');
          console.log('📊 Final Assessment:', JSON.stringify(response.data.finalAssessment, null, 2));
          return;
        } else if (response.data.status === 'failed') {
          console.log('❌ FAILED:', response.data.error);
          return;
        }
      } catch (error) {
        console.log(`❌ Error polling session: ${(error as Error).message}`);
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    console.log('❌ TIMEOUT');
  } catch (error) {
    console.log('❌ ERROR:', (error as Error).message);
  }
}

testFailingCase().catch(console.error);

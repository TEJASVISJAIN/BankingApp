import axios from 'axios';

async function debugTimeoutCase() {
  console.log('🔍 DEBUGGING TIMEOUT CASE: Policy Block - Unfreeze Without Identity');
  console.log('================================================================');
  
  const apiUrl = 'http://localhost:3001';
  const customerId = 'cust_001';
  const transactionId = 'txn_00015';
  
  try {
    console.log('📤 Starting triage...');
    const triageResponse = await axios.post(`${apiUrl}/api/triage`, {
      customerId,
      transactionId
    }, {
      headers: {
        'X-API-Key': 'dev_key_789',
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    const sessionId = triageResponse.data.sessionId;
    console.log('✅ Triage started:', sessionId);

    // Wait for completion
    console.log('\n⏳ Waiting for completion...');
    const maxWaitTime = 10000;
    const pollInterval = 500;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      try {
        const response = await axios.get(`${apiUrl}/api/triage/session/${sessionId}`, {
          headers: {
            'X-API-Key': 'dev_key_789'
          },
          timeout: 5000
        });

        console.log(`📊 Status: ${response.data.status}`);
        
        if (response.data.status === 'completed') {
          console.log('✅ Triage completed!');
          console.log('📊 Final Assessment:', JSON.stringify(response.data.finalAssessment, null, 2));
          return;
        } else if (response.data.status === 'failed') {
          console.log('❌ Triage failed:', response.data.error);
          return;
        }
      } catch (error) {
        console.log(`❌ Error polling session: ${(error as Error).message}`);
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    console.log('❌ Timeout waiting for completion');
  } catch (error) {
    console.log('❌ Error:', (error as Error).message);
  }
}

debugTimeoutCase().catch(console.error);

import axios from 'axios';

async function debugCase1() {
  console.log('🔍 DEBUGGING CASE 1: Card Lost - Freeze Required');
  console.log('================================================');
  
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

    console.log('✅ Triage started:', triageResponse.data);
    const sessionId = triageResponse.data.sessionId;

    // Wait for completion
    console.log('⏳ Waiting for completion...');
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

        if (response.data.status === 'completed') {
          console.log('✅ Triage completed!');
          console.log('📊 Full Response:');
          console.log(JSON.stringify(response.data, null, 2));
          
          // Extract actions
          const assessment = response.data.finalAssessment;
          console.log('\n🔍 ASSESSMENT ANALYSIS:');
          console.log('Risk Level:', assessment?.riskLevel);
          console.log('Recommendation:', assessment?.recommendation);
          console.log('Confidence:', assessment?.confidence);
          console.log('Actions:', assessment?.actions);
          
          // Check steps for actions
          if (response.data.steps) {
            const recommendationStep = response.data.steps.find((step: any) => step.id === 'generate_recommendations');
            if (recommendationStep) {
              console.log('\n📋 GENERATE_RECOMMENDATIONS STEP:');
              console.log(JSON.stringify(recommendationStep, null, 2));
            }
          }
          
          return;
        }
      } catch (error) {
        // Continue polling
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    console.log('❌ Timeout waiting for completion');
  } catch (error) {
    console.log('❌ Error:', (error as Error).message);
  }
}

debugCase1().catch(console.error);

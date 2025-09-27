import axios from 'axios';

async function testCase1() {
  console.log('🧪 Testing Case 1: Card Lost - Freeze Required');
  
  const apiUrl = 'http://localhost:3001';
  const customerId = 'cust_001';
  const transactionId = 'txn_00015';
  
  try {
    // Start triage
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

    // Wait for completion
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
          
          // Extract actions using the same logic as eval script
          const assessment = response.data.finalAssessment;
          console.log('\n🔍 EXTRACTING ACTIONS:');
          
          // Check if actions are directly provided in the assessment
          if (assessment.actions && Array.isArray(assessment.actions)) {
            console.log('✅ Found actions in assessment.actions:', assessment.actions);
            return assessment.actions;
          }
          
          // Check in steps for generate_recommendations output
          if (response.data.steps && Array.isArray(response.data.steps)) {
            console.log('🔍 Checking steps for actions...');
            const recommendationStep = response.data.steps.find((step: any) => step.id === 'generate_recommendations');
            if (recommendationStep && recommendationStep.output) {
              console.log('📋 Found generate_recommendations step:', JSON.stringify(recommendationStep.output, null, 2));
              if (recommendationStep.output.actions) {
                console.log('✅ Found actions in step output:', recommendationStep.output.actions);
                return recommendationStep.output.actions;
              }
            }
          }
          
          console.log('❌ No actions found');
          return [];
        }
      } catch (error) {
        // Continue polling
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    console.log('❌ Timeout waiting for completion');
    return [];
  } catch (error) {
    console.log('❌ Error:', (error as Error).message);
    return [];
  }
}

testCase1().then(actions => {
  console.log('\n🎯 FINAL ACTIONS:', actions);
}).catch(console.error);

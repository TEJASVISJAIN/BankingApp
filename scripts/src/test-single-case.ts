import axios from 'axios';

async function testSingleCase() {
  console.log('🧪 Testing Single Case');
  
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
          
          // Simulate the eval script's validation
          const actual = response.data.finalAssessment;
          const expected = {
            riskLevel: "medium",
            recommendation: "investigate", 
            actions: ["monitor", "open_dispute", "request_verification"],
            confidence: 0.7
          };
          
          console.log('\n🔍 EVAL SCRIPT VALIDATION:');
          console.log('Expected actions:', expected.actions);
          console.log('Actual data structure:', JSON.stringify(actual, null, 2));
          
          // Extract actions using eval script logic
          let actualActions: string[] = [];
          
          // Check if actions are directly provided in the assessment
          if (actual?.actions && Array.isArray(actual.actions)) {
            console.log('✅ Found actions in assessment.actions:', actual.actions);
            actualActions = actual.actions;
          } else {
            console.log('❌ No actions in assessment.actions');
          }
          
          // Check in steps for generate_recommendations output
          if (response.data.steps && Array.isArray(response.data.steps)) {
            console.log('🔍 Checking steps for actions...');
            const recommendationStep = response.data.steps.find((step: any) => step.id === 'generate_recommendations');
            if (recommendationStep && recommendationStep.output) {
              console.log('📋 Found generate_recommendations step:');
              console.log(JSON.stringify(recommendationStep.output, null, 2));
              if (recommendationStep.output.actions) {
                console.log('✅ Found actions in step output:', recommendationStep.output.actions);
                actualActions = recommendationStep.output.actions;
              }
            }
          }
          
          console.log('\n🎯 FINAL RESULT:');
          console.log('Expected actions:', expected.actions);
          console.log('Actual actions:', actualActions);
          console.log('Actions match:', JSON.stringify(expected.actions) === JSON.stringify(actualActions));
          
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

testSingleCase().catch(console.error);

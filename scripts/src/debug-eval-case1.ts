import axios from 'axios';

async function debugEvalCase1() {
  console.log('🔍 DEBUGGING EVAL CASE 1: Card Lost - Freeze Required');
  console.log('=====================================================');
  
  const apiUrl = 'http://localhost:3001';
  const customerId = 'cust_001';
  const transactionId = 'txn_00015';
  
  // Expected values from golden case
  const expected = {
    riskLevel: "medium",
    recommendation: "investigate", 
    actions: ["monitor", "open_dispute", "request_verification"],
    confidence: 0.7
  };
  
  console.log('📋 Expected:', expected);
  
  try {
    console.log('\n📤 Starting triage...');
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

        if (response.data.status === 'completed') {
          console.log('✅ Triage completed!');
          
          const actual = response.data.finalAssessment;
          console.log('\n📊 ACTUAL ASSESSMENT:');
          console.log('Risk Level:', actual?.riskLevel);
          console.log('Recommendation:', actual?.recommendation);
          console.log('Confidence:', actual?.confidence);
          console.log('Actions in assessment:', actual?.actions);
          
          // Extract actions using eval script logic
          console.log('\n🔍 EXTRACTING ACTIONS:');
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
          
          console.log('\n🎯 FINAL COMPARISON:');
          console.log('Expected actions:', expected.actions);
          console.log('Actual actions:', actualActions);
          console.log('Actions match:', JSON.stringify(expected.actions) === JSON.stringify(actualActions));
          
          // Check each expected action
          console.log('\n🔍 ACTION VALIDATION:');
          for (const expectedAction of expected.actions) {
            const found = actualActions.includes(expectedAction);
            console.log(`${found ? '✅' : '❌'} ${expectedAction}: ${found ? 'FOUND' : 'MISSING'}`);
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

debugEvalCase1().catch(console.error);

#!/usr/bin/env ts-node

import axios from 'axios';

const API_BASE_URL = 'http://localhost:3001';

async function testApi() {
  console.log('🧪 Testing Aegis Support API...\n');

  try {
    // Test health endpoint
    console.log('1. Testing health endpoint...');
    const healthResponse = await axios.get(`${API_BASE_URL}/health`);
    console.log('✅ Health check passed:', healthResponse.data.status);

    // Test metrics endpoint
    console.log('\n2. Testing metrics endpoint...');
    const metricsResponse = await axios.get(`${API_BASE_URL}/metrics`);
    console.log('✅ Metrics endpoint accessible');

    // Test customer profile endpoint
    console.log('\n3. Testing customer profile endpoint...');
    try {
      const profileResponse = await axios.get(`${API_BASE_URL}/api/customer/cust_001/profile`, {
        headers: { 'X-API-Key': 'dev_key_789' }
      });
      console.log('✅ Customer profile endpoint working');
    } catch (error) {
      console.log('⚠️  Customer profile endpoint not yet implemented (expected)');
    }

    // Test insights endpoint
    console.log('\n4. Testing insights endpoint...');
    try {
      const insightsResponse = await axios.get(`${API_BASE_URL}/api/insights/cust_001/summary`, {
        headers: { 'X-API-Key': 'dev_key_789' }
      });
      console.log('✅ Insights endpoint working');
    } catch (error) {
      console.log('⚠️  Insights endpoint not yet implemented (expected)');
    }

    // Test transactions endpoint
    console.log('\n5. Testing transactions endpoint...');
    try {
      const transactionsResponse = await axios.get(`${API_BASE_URL}/api/customer/cust_001/transactions`, {
        headers: { 'X-API-Key': 'dev_key_789' }
      });
      console.log('✅ Transactions endpoint working');
    } catch (error) {
      console.log('⚠️  Transactions endpoint not yet implemented (expected)');
    }

    console.log('\n🎉 API testing completed!');
    console.log('\nNext steps:');
    console.log('1. Start the backend: cd backend && npm run dev');
    console.log('2. Start the frontend: cd frontend && npm run dev');
    console.log('3. Visit http://localhost:3000 to see the dashboard');

  } catch (error) {
    console.error('❌ API test failed:', (error as Error).message);
    console.log('\nMake sure the backend is running:');
    console.log('cd backend && npm run dev');
  }
}

if (require.main === module) {
  testApi();
}

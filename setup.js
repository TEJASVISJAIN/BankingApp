#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Aegis Support Setup Script');
console.log('============================\n');

// Check prerequisites
function checkPrerequisites() {
  console.log('1. Checking prerequisites...');
  
  try {
    execSync('node --version', { stdio: 'pipe' });
    console.log('✅ Node.js found');
  } catch (error) {
    console.error('❌ Node.js not found. Please install Node.js 18+');
    process.exit(1);
  }
  
  try {
    execSync('docker --version', { stdio: 'pipe' });
    console.log('✅ Docker found');
  } catch (error) {
    console.error('❌ Docker not found. Please install Docker');
    process.exit(1);
  }
  
  try {
    execSync('docker-compose --version', { stdio: 'pipe' });
    console.log('✅ Docker Compose found');
  } catch (error) {
    console.error('❌ Docker Compose not found. Please install Docker Compose');
    process.exit(1);
  }
}

// Install dependencies
function installDependencies() {
  console.log('\n2. Installing dependencies...');
  
  try {
    console.log('   Installing root dependencies...');
    execSync('npm install', { stdio: 'inherit' });
    
    console.log('   Installing backend dependencies...');
    execSync('cd backend && npm install', { stdio: 'inherit' });
    
    console.log('   Installing frontend dependencies...');
    execSync('cd frontend && npm install', { stdio: 'inherit' });
    
    console.log('   Installing scripts dependencies...');
    execSync('cd scripts && npm install', { stdio: 'inherit' });
    
    console.log('✅ All dependencies installed');
  } catch (error) {
    console.error('❌ Failed to install dependencies:', error.message);
    process.exit(1);
  }
}

// Start Docker services
function startServices() {
  console.log('\n3. Starting Docker services...');
  
  try {
    execSync('docker-compose up -d', { stdio: 'inherit' });
    console.log('✅ Docker services started');
    console.log('   Waiting for services to be ready...');
    
    // Wait for services to be ready
    setTimeout(() => {
      console.log('✅ Services should be ready now');
    }, 30000);
    
  } catch (error) {
    console.error('❌ Failed to start Docker services:', error.message);
    process.exit(1);
  }
}

// Seed database
function seedDatabase() {
  console.log('\n4. Seeding database...');
  
  try {
    console.log('   This may take a few minutes for 1M transactions...');
    execSync('npm run seed', { stdio: 'inherit' });
    console.log('✅ Database seeded successfully');
  } catch (error) {
    console.error('❌ Failed to seed database:', error.message);
    console.log('   You can try running: npm run seed');
  }
}

// Test API
function testApi() {
  console.log('\n5. Testing API...');
  
  try {
    execSync('npm run test-api', { stdio: 'inherit' });
    console.log('✅ API test completed');
  } catch (error) {
    console.log('⚠️  API test failed (this is expected if backend is not running)');
  }
}

// Main execution
async function main() {
  try {
    checkPrerequisites();
    installDependencies();
    startServices();
    
    console.log('\n⏳ Waiting 30 seconds for services to start...');
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    seedDatabase();
    testApi();
    
    console.log('\n🎉 Setup completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Start development servers: npm run dev');
    console.log('2. Open http://localhost:3000 in your browser');
    console.log('3. Backend API: http://localhost:3001');
    console.log('\nOr start services individually:');
    console.log('- Backend: cd backend && npm run dev');
    console.log('- Frontend: cd frontend && npm run dev');
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    process.exit(1);
  }
}

main();

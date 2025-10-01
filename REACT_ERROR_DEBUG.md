# React Error #310 Debug Guide

## 🚨 Error Analysis

**React Error #310** typically indicates:
- **Hydration Mismatch**: Server-side rendered content doesn't match client-side
- **Component Rendering Issue**: Error in component lifecycle
- **State Management Problem**: Inconsistent state between renders
- **Data Fetching Issue**: Race condition or undefined data

## 🔍 Debugging Steps

### Step 1: Check Browser Console
```bash
# Open browser developer tools (F12)
# Look for detailed error messages in Console tab
# Check Network tab for failed API calls
```

### Step 2: Check React DevTools
```bash
# Install React DevTools browser extension
# Check component tree and props
# Look for undefined or null values
```

### Step 3: Check Network Requests
```bash
# Open Network tab in DevTools
# Look for failed API calls to:
# - /api/customer/cust_013/profile
# - /api/customer/cust_013/transactions
# - /api/insights/cust_013/summary
```

## 🛠️ Common Fixes

### Fix 1: Check Customer Page Component
```typescript
// Check if CustomerPage.tsx has proper error handling
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import apiService from '../services/apiService';

export function CustomerPage() {
  const { id } = useParams<{ id: string }>();
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) {
      setError('Customer ID is required');
      setLoading(false);
      return;
    }

    const fetchCustomer = async () => {
      try {
        setLoading(true);
        const customerData = await apiService.getCustomerProfile(id);
        setCustomer(customerData);
      } catch (err) {
        console.error('Failed to fetch customer:', err);
        setError(err.message || 'Failed to load customer');
      } finally {
        setLoading(false);
      }
    };

    fetchCustomer();
  }, [id]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!customer) return <div>Customer not found</div>;

  return (
    <div>
      <h1>Customer: {customer.name}</h1>
      {/* Rest of component */}
    </div>
  );
}
```

### Fix 2: Check API Service
```typescript
// Ensure apiService.getCustomerProfile handles errors properly
class ApiService {
  async getCustomerProfile(customerId: string): Promise<CustomerProfile> {
    try {
      const response = await api.get(`/api/customer/${customerId}/profile`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch customer profile:', error);
      throw new Error(`Customer ${customerId} not found`);
    }
  }
}
```

### Fix 3: Check Backend API
```bash
# Test the API endpoint directly
curl -H "X-API-Key: dev_key_789" http://localhost:3001/api/customer/cust_013/profile

# Check if customer exists in database
docker exec -it aegis-postgres psql -U aegis_user -d aegis_support -c "SELECT * FROM customers WHERE id = 'cust_013';"
```

### Fix 4: Check Data Seeding
```bash
# Check if customer data was seeded properly
docker exec -it aegis-postgres psql -U aegis_user -d aegis_support -c "SELECT COUNT(*) FROM customers;"

# If no data, re-seed
npm run seed-quick
```

## 🔧 Specific Debugging for Your App

### Check Customer Data
```bash
# Check if cust_013 exists
docker exec -it aegis-postgres psql -U aegis_user -d aegis_support -c "SELECT id, name, email_masked FROM customers WHERE id = 'cust_013';"

# Check customer transactions
docker exec -it aegis-postgres psql -U aegis_user -d aegis_support -c "SELECT COUNT(*) FROM transactions WHERE customer_id = 'cust_013';"
```

### Check Backend Logs
```bash
# Check backend logs for errors
docker logs aegis-backend

# Or if running locally
cd backend && npm run dev
# Look for error messages in terminal
```

### Check Frontend Logs
```bash
# Check frontend logs
cd frontend && npm run dev
# Look for error messages in terminal
```

## 🚀 Quick Fixes

### Fix 1: Add Error Boundary
```typescript
// Add ErrorBoundary to CustomerPage
import ErrorBoundary from '../components/ErrorBoundary';

function CustomerPage() {
  return (
    <ErrorBoundary>
      {/* Your existing CustomerPage component */}
    </ErrorBoundary>
  );
}
```

### Fix 2: Add Loading States
```typescript
// Ensure all data fetching has loading states
const [customer, setCustomer] = useState(null);
const [transactions, setTransactions] = useState([]);
const [insights, setInsights] = useState(null);
const [loading, setLoading] = useState(true);

// Don't render until data is loaded
if (loading) return <div>Loading...</div>;
```

### Fix 3: Add Null Checks
```typescript
// Add null checks for all data
if (!customer) return <div>Customer not found</div>;
if (!transactions) return <div>No transactions found</div>;
if (!insights) return <div>No insights available</div>;
```

## 🔍 Advanced Debugging

### Check React DevTools
1. Install React DevTools browser extension
2. Open DevTools → Components tab
3. Look for:
   - Undefined props
   - Null state values
   - Component re-renders
   - Error boundaries

### Check Network Tab
1. Open DevTools → Network tab
2. Look for:
   - Failed API calls (red status)
   - 404 errors for customer data
   - 500 errors from backend
   - CORS issues

### Check Console for Specific Errors
```javascript
// Look for these specific error patterns:
// - "Cannot read property 'name' of null"
// - "Cannot read property 'transactions' of undefined"
// - "Network Error"
// - "404 Not Found"
```

## 🛠️ Step-by-Step Debugging

### Step 1: Check if Customer Exists
```bash
# Check database
docker exec -it aegis-postgres psql -U aegis_user -d aegis_support -c "SELECT * FROM customers WHERE id = 'cust_013';"
```

### Step 2: Check API Endpoint
```bash
# Test API directly
curl -H "X-API-Key: dev_key_789" http://localhost:3001/api/customer/cust_013/profile
```

### Step 3: Check Frontend Route
```typescript
// Ensure route is properly configured
<Route path="/customers/:id" element={<CustomerPage />} />
```

### Step 4: Check Component Props
```typescript
// Add console.log to debug
useEffect(() => {
  console.log('Customer ID:', id);
  console.log('Customer data:', customer);
  console.log('Loading state:', loading);
  console.log('Error state:', error);
}, [id, customer, loading, error]);
```

## 🚨 Emergency Fixes

### Fix 1: Restart Services
```bash
# Restart all services
docker-compose down
docker-compose up -d

# Wait for services to be ready
sleep 30

# Re-seed data
npm run seed-quick
```

### Fix 2: Clear Browser Cache
```bash
# Clear browser cache and cookies
# Or use incognito/private mode
```

### Fix 3: Check Port Conflicts
```bash
# Check if ports are in use
netstat -an | grep :3000
netstat -an | grep :3001

# Kill processes if needed
lsof -ti:3000 | xargs kill -9
lsof -ti:3001 | xargs kill -9
```

## 📊 Common Solutions

### Solution 1: Data Not Seeded
```bash
# Re-seed the database
npm run seed-quick
```

### Solution 2: API Not Running
```bash
# Check if backend is running
curl http://localhost:3001/health

# If not running, start it
cd backend && npm run dev
```

### Solution 3: Frontend Build Issue
```bash
# Rebuild frontend
cd frontend && npm run build
```

### Solution 4: Route Configuration
```typescript
// Ensure routes are properly configured
<Route path="/customers/:id" element={<CustomerPage />} />
<Route path="/customer/:id" element={<CustomerPage />} />
```

## 🎯 Quick Test

### Test the Fix
```bash
# 1. Check if customer exists
docker exec -it aegis-postgres psql -U aegis_user -d aegis_support -c "SELECT id FROM customers WHERE id = 'cust_013';"

# 2. Test API endpoint
curl -H "X-API-Key: dev_key_789" http://localhost:3001/api/customer/cust_013/profile

# 3. Check frontend
# Go to http://localhost:3000/customers/cust_013
```

## 🔧 Prevention

### Add Error Handling
```typescript
// Always add error handling for data fetching
try {
  const data = await apiService.getCustomerProfile(id);
  setCustomer(data);
} catch (error) {
  console.error('Error fetching customer:', error);
  setError('Failed to load customer');
}
```

### Add Loading States
```typescript
// Always show loading states
if (loading) return <div>Loading...</div>;
if (error) return <div>Error: {error}</div>;
if (!customer) return <div>Customer not found</div>;
```

### Add Null Checks
```typescript
// Always check for null/undefined values
const customerName = customer?.name || 'Unknown';
const transactionCount = transactions?.length || 0;
```

This should help you debug and fix the React error #310 in your banking application!

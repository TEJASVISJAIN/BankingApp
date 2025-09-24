import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'dev_key_789', // Development API key
  },
})

// Request interceptor for logging
api.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`)
    return config
  },
  (error) => {
    console.error('API Request Error:', error)
    return Promise.reject(error)
  }
)

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 429) {
      console.warn('Rate limit exceeded, retrying...')
      // Could implement retry logic here
    }
    return Promise.reject(error)
  }
)

export interface DashboardKpis {
  totalSpend: number
  highRiskAlerts: number
  disputesOpened: number
  avgTriageTime: number
}

export interface FraudTriageAlert {
  id: string
  customerId: string
  customerName: string
  riskScore: number
  status: string
  amount: number
  merchant: string
  timestamp: string
  reasons: string[]
}

export interface CustomerProfile {
  id: string
  name: string
  email_masked: string
  risk_flags: string[]
  created_at: string
  updated_at: string
}

export interface CustomerInsights {
  customerId: string
  totalSpend: number
  transactionCount: number
  averageTransaction: number
  topMerchants: Array<{
    merchant: string
    amount: number
    count: number
  }>
  categories: Array<{
    mcc: string
    category: string
    amount: number
    count: number
  }>
  monthlyTrend: Array<{
    month: string
    amount: number
    count: number
  }>
  riskScore: number
  lastTransaction: string
}

export interface Transaction {
  id: string
  customerId: string
  cardId: string
  mcc: string
  merchant: string
  amount: number
  currency: string
  ts: string
  deviceId?: string
  geo?: any
}

export interface PaginatedTransactions {
  transactions: Transaction[]
  pagination: {
    page: number
    size: number
    total: number
    totalPages: number
  }
}

export interface TransactionFilters {
  from?: string
  to?: string
  page: number
  size: number
  merchant?: string
  mcc?: string
}

class ApiService {
  // Dashboard APIs
  async getDashboardKpis(): Promise<DashboardKpis> {
    try {
      const response = await api.get('/api/dashboard/kpis')
      return response.data
    } catch (error) {
      console.error('Failed to fetch dashboard KPIs:', error)
      // Return mock data for development
      return {
        totalSpend: 1250000,
        highRiskAlerts: 23,
        disputesOpened: 8,
        avgTriageTime: 2.3,
      }
    }
  }

  async getFraudTriage(): Promise<FraudTriageAlert[]> {
    try {
      const response = await api.get('/api/dashboard/fraud-triage')
      return response.data
    } catch (error) {
      console.error('Failed to fetch fraud triage:', error)
      // Return mock data for development
      return [
        {
          id: 'alert_001',
          customerId: 'cust_001',
          customerName: 'Rajesh Kumar',
          riskScore: 85,
          status: 'pending',
          amount: 25000,
          merchant: 'Unknown Merchant',
          timestamp: '2025-01-15T10:30:00Z',
          reasons: ['Velocity anomaly', 'New merchant', 'High amount'],
        },
        {
          id: 'alert_002',
          customerId: 'cust_002',
          customerName: 'Priya Sharma',
          riskScore: 92,
          status: 'in_progress',
          amount: 50000,
          merchant: 'Suspicious Store',
          timestamp: '2025-01-15T09:15:00Z',
          reasons: ['Geo-velocity', 'Device change', 'Past chargebacks'],
        },
      ]
    }
  }

  // Customer APIs
  async getCustomerProfile(customerId: string): Promise<CustomerProfile> {
    try {
      const response = await api.get(`/api/customer/${customerId}/profile`)
      return response.data
    } catch (error) {
      console.error('Failed to fetch customer profile:', error)
      throw error
    }
  }

  async getCustomerInsights(customerId: string): Promise<CustomerInsights> {
    try {
      const response = await api.get(`/api/insights/${customerId}/summary`)
      return response.data
    } catch (error) {
      console.error('Failed to fetch customer insights:', error)
      // Return mock data for development
      return {
        customerId,
        totalSpend: 45000,
        transactionCount: 25,
        averageTransaction: 1800,
        topMerchants: [
          { merchant: 'Big Bazaar', amount: 15000, count: 8 },
          { merchant: 'McDonald\'s', amount: 8000, count: 12 },
          { merchant: 'Indian Oil', amount: 12000, count: 5 },
        ],
        categories: [
          { mcc: '5411', category: 'Grocery Stores', amount: 15000, count: 8 },
          { mcc: '5812', category: 'Restaurants', amount: 8000, count: 12 },
          { mcc: '5541', category: 'Gas Stations', amount: 12000, count: 5 },
        ],
        monthlyTrend: [
          { month: '2024-12', amount: 45000, count: 25 },
          { month: '2024-11', amount: 38000, count: 22 },
        ],
        riskScore: 35,
        lastTransaction: '2025-01-15T10:30:00Z',
      }
    }
  }

  async getCustomerTransactions(
    customerId: string,
    filters: TransactionFilters
  ): Promise<PaginatedTransactions> {
    try {
      const params = new URLSearchParams()
      if (filters.from) params.append('from', filters.from)
      if (filters.to) params.append('to', filters.to)
      if (filters.merchant) params.append('merchant', filters.merchant)
      if (filters.mcc) params.append('mcc', filters.mcc)
      params.append('page', filters.page.toString())
      params.append('size', filters.size.toString())

      const response = await api.get(`/api/customer/${customerId}/transactions?${params}`)
      return response.data
    } catch (error) {
      console.error('Failed to fetch customer transactions:', error)
      // Return mock data for development
      return {
        transactions: [
          {
            id: 'txn_001',
            customerId,
            cardId: 'card_001',
            mcc: '5411',
            merchant: 'Big Bazaar',
            amount: -2500,
            currency: 'INR',
            ts: '2025-01-15T10:30:00Z',
            deviceId: 'dev_01',
            geo: { lat: 28.61, lon: 77.21, country: 'IN' },
          },
          {
            id: 'txn_002',
            customerId,
            cardId: 'card_001',
            mcc: '5812',
            merchant: 'McDonald\'s',
            amount: -450,
            currency: 'INR',
            ts: '2025-01-15T09:15:00Z',
            deviceId: 'dev_01',
            geo: { lat: 28.61, lon: 77.21, country: 'IN' },
          },
        ],
        pagination: {
          page: filters.page,
          size: filters.size,
          total: 25,
          totalPages: 2,
        },
      }
    }
  }

  // Ingestion APIs
  async ingestTransactions(transactions: any[]): Promise<any> {
    try {
      const response = await api.post('/api/ingest/transactions', {
        transactions,
      })
      return response.data
    } catch (error) {
      console.error('Failed to ingest transactions:', error)
      throw error
    }
  }

  // Triage APIs
  async startTriage(customerId: string, suspectTxnId: string): Promise<any> {
    try {
      const response = await api.post('/api/triage', {
        customerId,
        suspectTxnId,
      })
      return response.data
    } catch (error) {
      console.error('Failed to start triage:', error)
      throw error
    }
  }

  // Action APIs
  async freezeCard(cardId: string, otp?: string): Promise<any> {
    try {
      const response = await api.post('/api/action/freeze-card', {
        cardId,
        otp,
      })
      return response.data
    } catch (error) {
      console.error('Failed to freeze card:', error)
      throw error
    }
  }

  async openDispute(txnId: string, reasonCode: string, confirm: boolean): Promise<any> {
    try {
      const response = await api.post('/api/action/open-dispute', {
        txnId,
        reasonCode,
        confirm,
      })
      return response.data
    } catch (error) {
      console.error('Failed to open dispute:', error)
      throw error
    }
  }

  // Knowledge Base APIs
  async searchKnowledgeBase(query: string): Promise<any> {
    try {
      const response = await api.get(`/api/kb/search?q=${encodeURIComponent(query)}`)
      return response.data
    } catch (error) {
      console.error('Failed to search knowledge base:', error)
      throw error
    }
  }

  // Evaluation APIs
  async runEvaluations(): Promise<any> {
    try {
      const response = await api.get('/api/evals/run')
      return response.data
    } catch (error) {
      console.error('Failed to run evaluations:', error)
      throw error
    }
  }
}

export const apiService = new ApiService()

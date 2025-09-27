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

// Types
export interface DashboardKpis {
  totalSpend: number
  highRiskAlerts: number
  disputesOpened: number
  avgTriageTime: number
  totalTransactions: number
  fraudRate: number
}

export interface FraudTriageAlert {
  id: string
  customerId: string
  transactionId: string
  amount: number
  merchant: string
  timestamp: string
  riskScore: number
  riskLevel: 'low' | 'medium' | 'high'
  status: 'pending' | 'in_progress' | 'resolved' | 'false_positive'
  reasons: string[]
}

export interface CustomerProfile {
  id: string
  name: string
  email: string
  email_masked: string
  phone: string
  riskScore: number
  risk_flags: string[]
  accountStatus: string
  lastLogin: string
  totalSpend: number
  transactionCount: number
}

export interface CustomerInsights {
  topMerchants: Array<{
    merchant: string
    amount: number
    count: number
  }>
  categories: Array<{
    category: string
    amount: number
    percentage: number
  }>
  monthlyTrend: Array<{
    month: string
    amount: number
    transactionCount: number
  }>
  totalSpend: number
  transactionCount: number
  riskScore: number
}

export interface Transaction {
  id: string
  customerId: string
  cardId: string
  mcc: string
  merchant: string
  amount: number
  currency: string
  timestamp: string
  deviceId: string
  geo: {
    lat: number
    lon: number
    country: string
  }
  status: string
  riskScore?: number
}

export interface EvalResult {
  id: string
  name: string
  status: 'passed' | 'failed' | 'running'
  successRate: number
  avgLatency: number
  fallbackRate: number
  timestamp: string
  details: any
}

class ApiService {
  // Dashboard APIs
  async getDashboardKpis(): Promise<DashboardKpis> {
    try {
      const response = await api.get('/api/dashboard/kpis')
      return response.data
    } catch (error) {
      console.error('Failed to fetch dashboard KPIs:', error)
      throw error
    }
  }

  async getFraudTriage(): Promise<FraudTriageAlert[]> {
    try {
      const response = await api.get('/api/dashboard/fraud-triage')
      return response.data
    } catch (error) {
      console.error('Failed to fetch fraud triage:', error)
      throw error
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
      throw error
    }
  }

  async getCustomerTransactions(
    customerId: string,
    from?: string,
    to?: string,
    page: number = 1,
    size: number = 50
  ): Promise<{ transactions: Transaction[]; total: number; page: number; size: number }> {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        size: size.toString(),
      })
      
      if (from) params.append('from', from)
      if (to) params.append('to', to)
      
      const response = await api.get(`/api/customer/${customerId}/transactions?${params}`)
      return response.data
    } catch (error) {
      console.error('Failed to fetch customer transactions:', error)
      throw error
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
  async startTriage(request: { customerId: string; transactionId: string }): Promise<any> {
    try {
      const response = await api.post('/api/triage', request)
      return response.data
    } catch (error) {
      console.error('Failed to start triage:', error)
      throw error
    }
  }

  async getTriageSession(sessionId: string): Promise<any> {
    try {
      const response = await api.get(`/api/triage/session/${sessionId}`)
      return response.data
    } catch (error) {
      console.error('Failed to get triage session:', error)
      throw error
    }
  }

  async getTriageSessions(): Promise<any> {
    try {
      const response = await api.get('/api/triage/sessions')
      return response.data
    } catch (error) {
      console.error('Failed to get triage sessions:', error)
      throw error
    }
  }

  async cancelTriageSession(sessionId: string): Promise<any> {
    try {
      const response = await api.post(`/api/triage/cancel/${sessionId}`)
      return response.data
    } catch (error) {
      console.error('Failed to cancel triage session:', error)
      throw error
    }
  }

  // Action APIs
  async freezeCard(cardId: string, otp?: string, customerId?: string): Promise<any> {
    try {
      const response = await api.post('/api/actions/freeze-card', {
        cardId,
        otp,
        customerId,
      })
      return response.data
    } catch (error) {
      console.error('Failed to freeze card:', error)
      throw error
    }
  }

  async openDispute(txnId: string, reasonCode: string, confirm: boolean, customerId?: string): Promise<any> {
    try {
      const response = await api.post('/api/actions/open-dispute', {
        txnId,
        reasonCode,
        confirm,
        customerId,
      })
      return response.data
    } catch (error) {
      console.error('Failed to open dispute:', error)
      throw error
    }
  }

  async contactCustomer(request: { customerId: string; method: string; reason: string; priority?: string }): Promise<any> {
    try {
      const response = await api.post('/api/actions/contact-customer', request)
      return response.data
    } catch (error) {
      console.error('Failed to contact customer:', error)
      throw error
    }
  }

  async generateOtp(customerId: string, action: string): Promise<any> {
    try {
      const response = await api.post('/api/actions/generate-otp', {
        customerId,
        action,
      })
      return response.data
    } catch (error) {
      console.error('Failed to generate OTP:', error)
      throw error
    }
  }

  async validateOtp(request: { customerId: string; action: string; otp: string }): Promise<any> {
    try {
      const response = await api.post('/api/actions/validate-otp', request)
      return response.data
    } catch (error) {
      console.error('Failed to validate OTP:', error)
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

  // Trace APIs
  async getTraceMetrics(days: number = 7): Promise<any> {
    try {
      const response = await api.get(`/api/traces/metrics?days=${days}`)
      return response.data
    } catch (error) {
      console.error('Failed to get trace metrics:', error)
      throw error
    }
  }

  async getRecentTraces(limit: number = 50): Promise<any> {
    try {
      const response = await api.get(`/api/traces/recent?limit=${limit}`)
      return response.data
    } catch (error) {
      console.error('Failed to get recent traces:', error)
      throw error
    }
  }

  async getTrace(sessionId: string): Promise<any> {
    try {
      const response = await api.get(`/api/traces/${sessionId}`)
      return response.data
    } catch (error) {
      console.error('Failed to get trace:', error)
      throw error
    }
  }
}

export default new ApiService()
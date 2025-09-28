import React, { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Paper,
  Grid,
  Card,
  CardContent,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Pagination,
  TextField,
  Button,
  InputAdornment,
  IconButton,
  Avatar,
  CircularProgress,
  Alert,
} from '@mui/material'
import {
  TrendingUp,
  ShoppingCart,
  Category,
  Search,
  Visibility,
  Person,
  Email,
  Phone,
} from '@mui/icons-material'
import { useQuery } from '@tanstack/react-query'
import apiService from '../services/apiService'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`customer-tabpanel-${index}`}
      aria-labelledby={`customer-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  )
}

// Customer List Page Component
function CustomerListPage() {
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)

  // Fetch fraud alerts to get customer data
  const { data: fraudAlerts, isLoading, error } = useQuery({
    queryKey: ['fraud-alerts'],
    queryFn: () => apiService.getFraudTriage(),
    staleTime: 30 * 1000, // 30 seconds
  })

  // Extract unique customers from fraud alerts
  const customers = useMemo(() => {
    if (!fraudAlerts) return []
    
    const customerMap = new Map()
    fraudAlerts.forEach((alert: any) => {
      if (!customerMap.has(alert.customerId)) {
        customerMap.set(alert.customerId, {
          id: alert.customerId,
          name: alert.customerName || 'Unknown Customer',
          email: alert.email || 'N/A',
          phone: alert.phone || 'N/A',
          riskScore: alert.riskScore || 0,
          riskLevel: alert.riskLevel || 'low',
          lastTransaction: alert.timestamp,
          transactionCount: 1,
          totalAmount: alert.amount || 0,
        })
      } else {
        const existing = customerMap.get(alert.customerId)
        existing.transactionCount += 1
        existing.totalAmount += alert.amount || 0
        if (new Date(alert.timestamp) > new Date(existing.lastTransaction)) {
          existing.lastTransaction = alert.timestamp
        }
      }
    })
    
    return Array.from(customerMap.values())
  }, [fraudAlerts])

  // Filter customers based on search term
  const filteredCustomers = useMemo(() => {
    if (!searchTerm) return customers
    
    return customers.filter(customer => 
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.id.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [customers, searchTerm])

  // Pagination
  const totalPages = Math.ceil(filteredCustomers.length / pageSize)
  const paginatedCustomers = filteredCustomers.slice(
    (page - 1) * pageSize,
    page * pageSize
  )

  const handleCustomerClick = (customerId: string) => {
    navigate(`/customers/${customerId}`)
  }

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'high': return 'error'
      case 'medium': return 'warning'
      case 'low': return 'success'
      default: return 'default'
    }
  }

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
        <Typography variant="body1" sx={{ ml: 2 }}>
          Loading customers...
        </Typography>
      </Box>
    )
  }

  if (error) {
    return (
      <Box>
        <Typography variant="h4" component="h1" gutterBottom>
          Customer Management
        </Typography>
        <Alert severity="error">
          Failed to load customer data. Please try again.
        </Alert>
      </Box>
    )
  }

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Customer Management
      </Typography>
      
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Manage and view customer details, transaction history, and risk assessments.
      </Typography>

      {/* Search and Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              placeholder="Search customers by name, email, or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="body2" color="text.secondary">
              {filteredCustomers.length} customer{filteredCustomers.length !== 1 ? 's' : ''} found
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      {/* Customer List */}
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Customer</TableCell>
                <TableCell>Contact</TableCell>
                <TableCell>Risk Level</TableCell>
                <TableCell>Transactions</TableCell>
                <TableCell>Total Amount</TableCell>
                <TableCell>Last Activity</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedCustomers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Box sx={{ py: 4 }}>
                      <Person sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                      <Typography variant="h6" color="text.secondary">
                        {searchTerm ? 'No customers found matching your search' : 'No customers found'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {searchTerm ? 'Try adjusting your search terms' : 'Customer data will appear here when fraud alerts are generated'}
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedCustomers.map((customer) => (
                  <TableRow key={customer.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar sx={{ bgcolor: 'primary.main' }}>
                          {customer.name.charAt(0).toUpperCase()}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight="medium">
                            {customer.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {customer.id}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <Email sx={{ fontSize: 16, color: 'text.secondary' }} />
                          <Typography variant="body2">
                            {customer.email}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Phone sx={{ fontSize: 16, color: 'text.secondary' }} />
                          <Typography variant="body2">
                            {customer.phone}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={customer.riskLevel.toUpperCase()}
                        color={getRiskColor(customer.riskLevel)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {customer.transactionCount}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        ₹{(customer.totalAmount / 100).toLocaleString()}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {new Date(customer.lastTransaction).toLocaleDateString()}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => handleCustomerClick(customer.id)}
                        color="primary"
                      >
                        <Visibility />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination */}
        {totalPages > 1 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
            <Pagination
              count={totalPages}
              page={page}
              onChange={(_, newPage) => setPage(newPage)}
              color="primary"
            />
          </Box>
        )}
      </Paper>
    </Box>
  )
}

export function CustomerPage() {
  const { id } = useParams<{ id: string }>()
  const [tabValue, setTabValue] = useState(0)
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({
    from: '',
    to: '',
    merchant: '',
    mcc: '',
  })

  // Fetch customer profile
  const { data: profile, isLoading: profileLoading, error: profileError } = useQuery({
    queryKey: ['customer', id, 'profile'],
    queryFn: () => apiService.getCustomerProfile(id!),
    enabled: !!id,
  })

  // Fetch customer insights
  const { data: insights } = useQuery({
    queryKey: ['customer', id, 'insights'],
    queryFn: () => apiService.getCustomerInsights(id!),
    enabled: !!id,
  })

  // Debug: Log insights data
  React.useEffect(() => {
    if (insights) {
      console.log('Customer insights data:', insights)
    }
  }, [insights])

  // Fetch transactions
  const { data: transactions } = useQuery({
    queryKey: ['customer', id, 'transactions', page, filters],
    queryFn: () => apiService.getCustomerTransactions(id!, filters.from, filters.to, page, 20),
    enabled: !!id,
  })

  // If no ID, show customer list
  if (!id) {
    return <CustomerListPage />
  }

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue)
  }

  const handleFilterChange = (field: string, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }))
    setPage(1) // Reset to first page when filters change
  }

  const handlePageChange = (_event: React.ChangeEvent<unknown>, newPage: number) => {
    setPage(newPage)
  }

  if (profileLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Typography>Loading customer profile...</Typography>
      </Box>
    )
  }

  if (profileError) {
    return (
      <Box>
        <Typography variant="h4" component="h1" gutterBottom>
          Customer Not Found
        </Typography>
        <Typography variant="body1" color="text.secondary">
          The customer with ID "{id}" could not be found.
        </Typography>
      </Box>
    )
  }

  if (!profile) {
    return (
      <Box>
        <Typography variant="h4" component="h1" gutterBottom>
          Customer Not Found
        </Typography>
        <Typography variant="body1" color="text.secondary">
          The customer with ID "{id}" could not be found.
        </Typography>
      </Box>
    )
  }

  // Mock data for charts
  const spendTrendData = [
    { month: '2024-07', amount: 45000 },
    { month: '2024-08', amount: 52000 },
    { month: '2024-09', amount: 38000 },
    { month: '2024-10', amount: 61000 },
    { month: '2024-11', amount: 48000 },
    { month: '2024-12', amount: 55000 },
  ]

  const categoryData = [
    { name: 'Grocery', value: 35, color: '#8884d8' },
    { name: 'Restaurants', value: 25, color: '#82ca9d' },
    { name: 'Transportation', value: 20, color: '#ffc658' },
    { name: 'Shopping', value: 15, color: '#ff7c7c' },
    { name: 'Other', value: 5, color: '#8dd1e1' },
  ]

  return (
    <Box>
      {/* Customer Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {profile.name}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <Chip label={profile.email} variant="outlined" />
          {(profile.riskFlags || []).map((flag: string, index: number) => (
            <Chip
              key={index}
              label={flag}
              color="warning"
              size="small"
            />
          ))}
        </Box>
      </Box>

      {/* Tabs */}
      <Paper sx={{ width: '100%' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange}>
            <Tab label="Transactions" />
            <Tab label="Insights & Reports" />
          </Tabs>
        </Box>

        {/* Transactions Tab */}
        <TabPanel value={tabValue} index={0}>
          <Box sx={{ mb: 3 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={3}>
                <TextField
                  label="From Date"
                  type="date"
                  size="small"
                  value={filters.from}
                  onChange={(e) => handleFilterChange('from', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField
                  label="To Date"
                  type="date"
                  size="small"
                  value={filters.to}
                  onChange={(e) => handleFilterChange('to', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField
                  label="Merchant"
                  size="small"
                  value={filters.merchant}
                  onChange={(e) => handleFilterChange('merchant', e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={3}>
                <Button variant="contained" onClick={() => setFilters({ from: '', to: '', merchant: '', mcc: '' })}>
                  Clear Filters
                </Button>
              </Grid>
            </Grid>
          </Box>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Merchant</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Device</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {transactions?.transactions.map((txn: any) => (
                  <TableRow key={txn.id}>
                    <TableCell>
                      {new Date(txn.timestamp).toLocaleDateString()}
                    </TableCell>
                    <TableCell>{txn.merchant}</TableCell>
                    <TableCell>
                      <Typography
                        color={txn.amount < 0 ? 'error' : 'success'}
                        fontWeight="medium"
                      >
                        ₹{(txn.amount / 100).toLocaleString()}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={txn.mcc} size="small" />
                    </TableCell>
                    <TableCell>{txn.deviceId}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {transactions && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
              <Pagination
                count={Math.ceil((transactions?.pagination?.total || 0) / 20)}
                page={page}
                onChange={handlePageChange}
                color="primary"
              />
            </Box>
          )}
        </TabPanel>

        {/* Insights Tab */}
        <TabPanel value={tabValue} index={1}>
          <Grid container spacing={3}>
            {/* Summary Cards */}
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <TrendingUp color="primary" sx={{ mr: 1 }} />
                    <Typography variant="h6">Total Spend</Typography>
                  </Box>
                  <Typography variant="h4" color="primary">
                    ₹{((insights?.totalSpend || 0) / 100).toLocaleString()}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {insights?.transactionCount || 0} transactions
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <ShoppingCart color="success" sx={{ mr: 1 }} />
                    <Typography variant="h6">Top Merchant</Typography>
                  </Box>
                  <Typography variant="h6">
                    {insights?.topMerchants?.[0]?.merchant || 'N/A'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    ₹{((insights?.topMerchants?.[0]?.amount || 0) / 100).toLocaleString()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Category color="warning" sx={{ mr: 1 }} />
                    <Typography variant="h6">Risk Score</Typography>
                  </Box>
                  <Typography variant="h4" color="warning.main">
                    {insights?.riskScore || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Risk assessment
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            {/* Charts */}
            <Grid item xs={12} md={8}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Spend Trend
                  </Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={spendTrendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(value: number) => [`₹${(value / 100).toLocaleString()}`, 'Amount']} />
                      <Line type="monotone" dataKey="amount" stroke="#1976d2" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Spend Categories
                  </Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>
      </Paper>
    </Box>
  )
}

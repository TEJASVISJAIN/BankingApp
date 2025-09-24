import React, { useState } from 'react'
import { useParams } from 'react-router-dom'
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
} from '@mui/material'
import {
  TrendingUp,
  ShoppingCart,
  Category,
  Timeline,
} from '@mui/icons-material'
import { useQuery } from '@tanstack/react-query'
import { apiService } from '../services/apiService'
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
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['customer', id, 'profile'],
    queryFn: () => apiService.getCustomerProfile(id!),
    enabled: !!id,
  })

  // Fetch customer insights
  const { data: insights, isLoading: insightsLoading } = useQuery({
    queryKey: ['customer', id, 'insights'],
    queryFn: () => apiService.getCustomerInsights(id!),
    enabled: !!id,
  })

  // Fetch transactions
  const { data: transactions, isLoading: transactionsLoading } = useQuery({
    queryKey: ['customer', id, 'transactions', page, filters],
    queryFn: () => apiService.getCustomerTransactions(id!, { page, size: 20, ...filters }),
    enabled: !!id,
  })

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue)
  }

  const handleFilterChange = (field: string, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }))
    setPage(1) // Reset to first page when filters change
  }

  const handlePageChange = (event: React.ChangeEvent<unknown>, newPage: number) => {
    setPage(newPage)
  }

  if (profileLoading) {
    return <Typography>Loading customer profile...</Typography>
  }

  if (!profile) {
    return <Typography>Customer not found</Typography>
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
          <Chip label={profile.email_masked} variant="outlined" />
          {profile.risk_flags.map((flag, index) => (
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
                      {new Date(txn.ts).toLocaleDateString()}
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
                count={transactions.pagination.totalPages}
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
                    ₹{(insights?.totalSpend || 0 / 100).toLocaleString()}
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
                    {insights?.topMerchants[0]?.merchant || 'N/A'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    ₹{(insights?.topMerchants[0]?.amount || 0 / 100).toLocaleString()}
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
                      <Tooltip formatter={(value) => [`₹${(value / 100).toLocaleString()}`, 'Amount']} />
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

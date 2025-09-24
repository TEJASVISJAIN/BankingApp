import React, { useState } from 'react'
import {
  Grid,
  Paper,
  Typography,
  Box,
  Card,
  CardContent,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
} from '@mui/material'
import {
  TrendingUp,
  TrendingDown,
  Warning,
  Assessment,
  Visibility,
} from '@mui/icons-material'
import { useQuery } from '@tanstack/react-query'
import { apiService } from '../services/apiService'
import TriageDrawer from '../components/TriageDrawer'

// Mock data for demonstration
const mockKpis = {
  totalSpend: 1250000,
  highRiskAlerts: 23,
  disputesOpened: 8,
  avgTriageTime: 2.3,
}

const mockFraudTriage = [
  {
    id: 'txn_08502',
    customerId: 'cust_001',
    customerName: 'Rajesh Kumar',
    riskScore: 85,
    status: 'pending',
    amount: 13526,
    merchant: "Wendy's",
    timestamp: '2025-06-26T18:25:35.817Z',
    reasons: ['Velocity anomaly', 'New merchant', 'High amount'],
  },
  {
    id: 'txn_08189',
    customerId: 'cust_001',
    customerName: 'Rajesh Kumar',
    riskScore: 92,
    status: 'in_progress',
    amount: 46968,
    merchant: 'Uber',
    timestamp: '2025-06-24T02:07:14.906Z',
    reasons: ['Geo-velocity', 'Device change', 'Past chargebacks'],
  },
  {
    id: 'txn_02692',
    customerId: 'cust_001',
    customerName: 'Rajesh Kumar',
    riskScore: 45,
    status: 'resolved',
    amount: 89176,
    merchant: 'Nykaa',
    timestamp: '2025-06-23T01:58:45.281Z',
    reasons: ['Amount spike'],
  },
]

export function Dashboard() {
  const [triageDrawerOpen, setTriageDrawerOpen] = useState(false)
  const [selectedAlert, setSelectedAlert] = useState<any>(null)

  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ['dashboard', 'kpis'],
    queryFn: () => apiService.getDashboardKpis(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  const { data: fraudTriage, isLoading: triageLoading } = useQuery({
    queryKey: ['dashboard', 'fraud-triage'],
    queryFn: () => apiService.getFraudTriage(),
    staleTime: 30 * 1000, // 30 seconds
  })

  const displayKpis = kpis || mockKpis
  const displayTriage = fraudTriage || mockFraudTriage

  const handleViewTriage = (alert: any) => {
    setSelectedAlert(alert)
    setTriageDrawerOpen(true)
  }

  const handleCloseTriage = () => {
    setTriageDrawerOpen(false)
    setSelectedAlert(null)
  }

  const getRiskColor = (score: number) => {
    if (score >= 80) return 'error'
    if (score >= 60) return 'warning'
    return 'success'
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'warning'
      case 'in_progress': return 'info'
      case 'resolved': return 'success'
      default: return 'default'
    }
  }

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Dashboard
      </Typography>
      
      {/* KPIs */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <TrendingUp color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">Total Spend</Typography>
              </Box>
              <Typography variant="h4" color="primary">
                ₹{(displayKpis.totalSpend / 100).toLocaleString()}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Last 30 days
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Warning color="error" sx={{ mr: 1 }} />
                <Typography variant="h6">High Risk Alerts</Typography>
              </Box>
              <Typography variant="h4" color="error">
                {displayKpis.highRiskAlerts}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Requires attention
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Assessment color="warning" sx={{ mr: 1 }} />
                <Typography variant="h6">Disputes Opened</Typography>
              </Box>
              <Typography variant="h4" color="warning.main">
                {displayKpis.disputesOpened}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                This week
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <TrendingDown color="success" sx={{ mr: 1 }} />
                <Typography variant="h6">Avg Triage Time</Typography>
              </Box>
              <Typography variant="h4" color="success.main">
                {displayKpis.avgTriageTime}s
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Target: &lt;5s
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Fraud Triage Table */}
      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="h6">Fraud Triage Queue</Typography>
        </Box>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Customer</TableCell>
                <TableCell>Risk Score</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Merchant</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Timestamp</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {displayTriage.map((alert) => (
                <TableRow key={alert.id} hover>
                  <TableCell>
                    <Box>
                      <Typography variant="body2" fontWeight="medium">
                        {alert.customerName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {alert.customerId}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={alert.riskScore}
                      color={getRiskColor(alert.riskScore)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      ₹{(alert.amount / 100).toLocaleString()}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{alert.merchant}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={alert.status}
                      color={getStatusColor(alert.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {new Date(alert.timestamp).toLocaleString()}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Tooltip title="View Triage Analysis">
                      <IconButton 
                        size="small"
                        onClick={() => handleViewTriage(alert)}
                      >
                        <Visibility />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Triage Drawer */}
      {selectedAlert && (
        <TriageDrawer
          open={triageDrawerOpen}
          onClose={handleCloseTriage}
          customerId={selectedAlert.customerId}
          transactionId={selectedAlert.id}
        />
      )}
    </Box>
  )
}

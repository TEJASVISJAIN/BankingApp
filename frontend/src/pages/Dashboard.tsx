import { useState } from 'react'
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
  Skeleton,
} from '@mui/material'
import {
  TrendingUp,
  TrendingDown,
  Warning,
  Assessment,
  Visibility,
} from '@mui/icons-material'
import { useQuery } from '@tanstack/react-query'
import apiService from '../services/apiService'
import TriageDrawer from '../components/TriageDrawer'
import SkeletonLoader from '../components/SkeletonLoader'
import { maskCustomerId } from '../utils/piiRedaction'

// Removed mock data - using real API data only

export function Dashboard() {
  const [triageDrawerOpen, setTriageDrawerOpen] = useState(false)
  const [selectedAlert, setSelectedAlert] = useState<any>(null)

  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ['dashboard', 'kpis'],
    queryFn: () => apiService.getDashboardKpis(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  const { data: fraudTriageResponse, isLoading: fraudTriageLoading, error: fraudTriageError } = useQuery({
    queryKey: ['dashboard', 'fraud-triage'],
    queryFn: () => apiService.getFraudTriage(1, 20),
    staleTime: 30 * 1000, // 30 seconds
  })

  const displayKpis = kpis || { totalSpend: 0, highRiskAlerts: 0, disputesOpened: 0, avgTriageTime: 0, totalTransactions: 0, fraudRate: 0 }
  const displayTriage = fraudTriageResponse?.data || []

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
              {kpisLoading ? (
                <Skeleton width="60%" height={40} />
              ) : (
                <Typography variant="h4" color="primary">
                  ₹{(displayKpis.totalSpend / 100).toLocaleString()}
                </Typography>
              )}
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
              {kpisLoading ? (
                <Skeleton width="40%" height={40} />
              ) : (
                <Typography variant="h4" color="error">
                  {displayKpis.highRiskAlerts}
                </Typography>
              )}
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
              {kpisLoading ? (
                <Skeleton width="30%" height={40} />
              ) : (
                <Typography variant="h4" color="warning.main">
                  {displayKpis.disputesOpened}
                </Typography>
              )}
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
              {kpisLoading ? (
                <Skeleton width="25%" height={40} />
              ) : (
                <Typography variant="h4" color="success.main">
                  {displayKpis.avgTriageTime}s
                </Typography>
              )}
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
        
        {fraudTriageLoading ? (
          <SkeletonLoader rows={8} variant="table" />
        ) : fraudTriageError ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography color="error">
              Failed to load fraud triage data. Please try again.
            </Typography>
          </Box>
        ) : displayTriage.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography color="text.secondary">
              No fraud alerts at the moment. All transactions are within normal parameters.
            </Typography>
          </Box>
        ) : (
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
                          Customer {maskCustomerId(alert.customerId)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {maskCustomerId(alert.customerId)}
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
        )}
      </Paper>

      {/* Triage Drawer */}
      {selectedAlert && (
        <TriageDrawer
          open={triageDrawerOpen}
          onClose={handleCloseTriage}
          customerId={selectedAlert.customerId}
          transactionId={selectedAlert.transactionId}
        />
      )}
    </Box>
  )
}

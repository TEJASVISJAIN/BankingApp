import React from 'react'
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
} from '@mui/material'
import Pagination from '../components/Pagination'
import {
  Visibility,
} from '@mui/icons-material'
import { useQuery } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import apiService from '../services/apiService'
import { maskCustomerId } from '../utils/piiRedaction'
import TriageDrawer from '../components/TriageDrawer'

export function AlertsPage() {
  const { id: alertId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [selectedAlert, setSelectedAlert] = React.useState<any>(null)
  const [triageDrawerOpen, setTriageDrawerOpen] = React.useState(false)
  const [currentPage, setCurrentPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(20)

  // Fetch real fraud alerts data
  const { data: fraudAlertsResponse, isLoading, error } = useQuery({
    queryKey: ['fraud-alerts', currentPage, pageSize],
    queryFn: () => apiService.getFraudTriage(currentPage, pageSize),
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute
  })

  const fraudAlerts = fraudAlertsResponse?.data || []
  const pagination = fraudAlertsResponse?.pagination

  // Auto-open triage drawer for specific alert ID
  React.useEffect(() => {
    if (alertId && fraudAlerts && !isLoading) {
      const alert = fraudAlerts.find((a: any) => a.id === alertId)
      if (alert) {
        const alertWithReasons = {
          ...alert,
          reasons: alert.reasons || getDefaultRiskReasons(alert.riskScore, alert.riskLevel)
        }
        setSelectedAlert(alertWithReasons)
        setTriageDrawerOpen(true)
      }
    }
  }, [alertId, fraudAlerts, isLoading])

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

  const handleTriageClick = (alert: any) => {
    // Add default risk reasons if none exist
    const alertWithReasons = {
      ...alert,
      reasons: alert.reasons || getDefaultRiskReasons(alert.riskScore, alert.riskLevel)
    }
    setSelectedAlert(alertWithReasons)
    setTriageDrawerOpen(true)
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handleSizeChange = (size: number) => {
    setPageSize(size)
    setCurrentPage(1) // Reset to first page when changing size
  }

  const getDefaultRiskReasons = (riskScore: number, riskLevel: string) => {
    const reasons = []
    
    if (riskScore >= 80) {
      reasons.push('High risk transaction')
      reasons.push('Unusual spending pattern')
    } else if (riskScore >= 60) {
      reasons.push('Medium risk transaction')
      reasons.push('Suspicious merchant')
    } else {
      reasons.push('Low risk transaction')
    }
    
    if (riskLevel === 'high') {
      reasons.push('Velocity anomaly')
      reasons.push('Geo-location mismatch')
    } else if (riskLevel === 'medium') {
      reasons.push('Amount spike')
    }
    
    return reasons
  }

  const handleCloseTriage = () => {
    setTriageDrawerOpen(false)
    setSelectedAlert(null)
    // Navigate back to alerts list if we came from a specific alert
    if (alertId) {
      navigate('/alerts')
    }
  }


  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
        <Typography variant="body1" sx={{ ml: 2 }}>
          Loading fraud alerts...
        </Typography>
      </Box>
    )
  }

  if (error) {
    return (
      <Box>
        <Typography variant="h4" component="h1" gutterBottom>
          Fraud Alerts Queue
        </Typography>
        <Alert severity="error">
          Failed to load fraud alerts. Please try again.
        </Alert>
      </Box>
    )
  }

  const alerts = fraudAlerts || []

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Fraud Alerts Queue ({pagination ? `${pagination.total} total alerts` : `${alerts.length} alerts`})
        {alertId && selectedAlert && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Viewing: {selectedAlert.customerName} - {selectedAlert.merchant} (₹{(selectedAlert.amount / 100).toLocaleString()})
          </Typography>
        )}
      </Typography>
      
      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
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
              {alerts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Typography variant="body2" color="text.secondary">
                      No fraud alerts found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                alerts.map((alert: any) => (
                  <TableRow key={alert.id} hover>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" fontWeight="medium">
                          {alert.customerName || 'Unknown Customer'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {maskCustomerId(alert.customerId)}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={alert.riskScore || 0}
                        color={getRiskColor(alert.riskScore || 0)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        ₹{((alert.amount || 0) / 100).toLocaleString()}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {alert.merchant || 'Unknown Merchant'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={alert.status || 'pending'}
                        color={getStatusColor(alert.status || 'pending')}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {alert.timestamp ? new Date(alert.timestamp).toLocaleString() : 'N/A'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Tooltip title="Triage Alert">
                        <IconButton 
                          size="small"
                          onClick={() => handleTriageClick(alert)}
                        >
                          <Visibility />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        
        {/* Pagination */}
        {pagination && (
          <Pagination
            page={pagination.page}
            size={pagination.size}
            total={pagination.total}
            totalPages={pagination.totalPages}
            hasNext={pagination.hasNext}
            hasPrev={pagination.hasPrev}
            onPageChange={handlePageChange}
            onSizeChange={handleSizeChange}
          />
        )}
      </Paper>

      {/* Triage Drawer */}
      {selectedAlert && (
        <TriageDrawer
          open={triageDrawerOpen}
          onClose={handleCloseTriage}
          customerId={selectedAlert.customerId}
          transactionId={selectedAlert.transactionId || selectedAlert.id}
        />
      )}
    </Box>
  )
}

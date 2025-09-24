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
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material'
import {
  Visibility,
  Warning,
  CheckCircle,
  Cancel,
} from '@mui/icons-material'

// Mock data for alerts
const mockAlerts = [
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
    description: 'Unusual spending pattern detected',
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
    description: 'High-risk transaction flagged',
  },
  {
    id: 'alert_003',
    customerId: 'cust_003',
    customerName: 'Amit Patel',
    riskScore: 45,
    status: 'resolved',
    amount: 5000,
    merchant: 'Regular Store',
    timestamp: '2025-01-15T08:45:00Z',
    reasons: ['Amount spike'],
    description: 'Amount spike detected',
  },
]

export function AlertsPage() {
  const [selectedAlert, setSelectedAlert] = React.useState<any>(null)
  const [triageDialogOpen, setTriageDialogOpen] = React.useState(false)

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
    setSelectedAlert(alert)
    setTriageDialogOpen(true)
  }

  const handleCloseTriage = () => {
    setTriageDialogOpen(false)
    setSelectedAlert(null)
  }

  const handleAction = (action: string) => {
    console.log(`Action: ${action} for alert: ${selectedAlert?.id}`)
    // Here you would call the API to perform the action
    handleCloseTriage()
  }

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Fraud Alerts Queue
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
              {mockAlerts.map((alert) => (
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
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Triage Dialog */}
      <Dialog 
        open={triageDialogOpen} 
        onClose={handleCloseTriage}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Fraud Triage - {selectedAlert?.customerName}
        </DialogTitle>
        <DialogContent>
          {selectedAlert && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Alert Details
              </Typography>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Customer: {selectedAlert.customerName} ({selectedAlert.customerId})
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Amount: ₹{(selectedAlert.amount / 100).toLocaleString()}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Merchant: {selectedAlert.merchant}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Risk Score: {selectedAlert.riskScore}
                </Typography>
              </Box>

              <Typography variant="h6" gutterBottom>
                Risk Reasons
              </Typography>
              <Box sx={{ mb: 2 }}>
                {selectedAlert.reasons.map((reason: string, index: number) => (
                  <Chip
                    key={index}
                    label={reason}
                    color="warning"
                    size="small"
                    sx={{ mr: 1, mb: 1 }}
                  />
                ))}
              </Box>

              <Typography variant="h6" gutterBottom>
                Recommended Actions
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button
                  variant="contained"
                  color="error"
                  startIcon={<Warning />}
                  onClick={() => handleAction('freeze_card')}
                >
                  Freeze Card
                </Button>
                <Button
                  variant="contained"
                  color="warning"
                  startIcon={<Cancel />}
                  onClick={() => handleAction('open_dispute')}
                >
                  Open Dispute
                </Button>
                <Button
                  variant="outlined"
                  color="success"
                  startIcon={<CheckCircle />}
                  onClick={() => handleAction('mark_false_positive')}
                >
                  Mark False Positive
                </Button>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseTriage}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

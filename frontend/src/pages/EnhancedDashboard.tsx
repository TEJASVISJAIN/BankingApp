import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Paper,
  Button,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  InputAdornment,
  IconButton,
  Tooltip,
  Snackbar,
} from '@mui/material';
import {
  Search,
  Refresh,
  Warning,
  Assessment,
  Accessibility,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import apiService from '../services/apiService';
import TriageDrawer from '../components/TriageDrawer';
import VirtualizedTable from '../components/VirtualizedTable';
import AccessibleDrawer from '../components/AccessibleDrawer';


interface FraudTriageItem {
  id: string;
  customerId: string;
  transactionId: string;
  amount: number;
  merchant: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  timestamp: string;
  status: 'pending' | 'investigating' | 'resolved';
}

const EnhancedDashboard: React.FC = () => {
  const [triageDrawerOpen, setTriageDrawerOpen] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<FraudTriageItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
  }>({ open: false, message: '', severity: 'info' });

  // Fetch KPIs
  const { data: kpis, isLoading: kpisLoading, error: kpisError } = useQuery({
    queryKey: ['dashboard-kpis'],
    queryFn: () => apiService.getDashboardKpis(),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch fraud triage data
  const { data: fraudTriage, isLoading: triageLoading, error: triageError } = useQuery({
    queryKey: ['fraud-triage'],
    queryFn: () => apiService.getFraudTriage(),
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Filtered fraud triage data
  const filteredFraudTriage = useMemo(() => {
    if (!fraudTriage) return [];
    
    return fraudTriage.filter((item: any) => {
      const matchesSearch = item.merchant.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           item.customerId.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRisk = riskFilter === 'all' || item.riskLevel === riskFilter;
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      
      return matchesSearch && matchesRisk && matchesStatus;
    });
  }, [fraudTriage, searchTerm, riskFilter, statusFilter]);

  const handleViewTriage = (alert: FraudTriageItem) => {
    setSelectedAlert(alert);
    setTriageDrawerOpen(true);
  };

  const handleCloseTriage = () => {
    setTriageDrawerOpen(false);
    setSelectedAlert(null);
  };

  const handleRefresh = () => {
    // Trigger refetch of all queries
    window.location.reload();
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'success';
      default: return 'default';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'resolved': return 'success';
      case 'investigating': return 'warning';
      case 'pending': return 'error';
      default: return 'default';
    }
  };

  const tableColumns = [
    {
      key: 'customerId',
      label: 'Customer ID',
      width: 120,
    },
    {
      key: 'amount',
      label: 'Amount',
      width: 100,
      render: (value: number) => `₹${(value / 100).toFixed(2)}`,
    },
    {
      key: 'merchant',
      label: 'Merchant',
      width: 200,
    },
    {
      key: 'riskLevel',
      label: 'Risk Level',
      width: 120,
      render: (value: string) => (
        <Chip
          label={value.toUpperCase()}
          color={getRiskColor(value) as any}
          size="small"
          variant="outlined"
        />
      ),
    },
    {
      key: 'riskScore',
      label: 'Risk Score',
      width: 100,
      render: (value: number) => `${value}%`,
    },
    {
      key: 'status',
      label: 'Status',
      width: 120,
      render: (value: string) => (
        <Chip
          label={value.toUpperCase()}
          color={getStatusColor(value) as any}
          size="small"
        />
      ),
    },
    {
      key: 'timestamp',
      label: 'Time',
      width: 150,
      render: (value: string) => new Date(value).toLocaleString(),
    },
    {
      key: 'actions',
      label: 'Actions',
      width: 100,
      render: (_value: any, row: FraudTriageItem) => (
        <Button
          variant="outlined"
          size="small"
          onClick={() => handleViewTriage(row)}
          aria-label={`View triage details for ${row.customerId}`}
        >
          View Details
        </Button>
      ),
    },
  ];

  if (kpisLoading || triageLoading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        height="100vh"
        role="status"
        aria-label="Loading dashboard"
      >
        <CircularProgress />
        <Typography variant="body1" sx={{ ml: 2 }}>
          Loading dashboard...
        </Typography>
      </Box>
    );
  }

  if (kpisError || triageError) {
    return (
      <Alert severity="error" role="alert" aria-live="polite">
        Failed to load dashboard data. Please try again.
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 3 }} role="main" aria-label="Fraud Detection Dashboard">
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Fraud Detection Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Monitor and manage fraud detection activities in real-time
        </Typography>
      </Box>

      {/* KPIs */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Assessment color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">Total Spend</Typography>
              </Box>
              <Typography variant="h4" color="primary">
                ₹{(kpis?.totalSpend || 0).toLocaleString()}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Total spend this month
                </Typography>
              </Box>
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
                {kpis?.highRiskAlerts || 0}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  High-risk alerts detected
                </Typography>
              </Box>
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
                {kpis?.disputesOpened || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                This month
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Accessibility color="info" sx={{ mr: 1 }} />
                <Typography variant="h6">Avg Triage Time</Typography>
              </Box>
              <Typography variant="h4" color="info.main">
                {kpis?.avgTriageTime || 0}s
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Average processing time
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters and Search */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              placeholder="Search by merchant or customer ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
              aria-label="Search fraud triage data"
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <FormControl fullWidth>
              <InputLabel>Risk Level</InputLabel>
              <Select
                value={riskFilter}
                onChange={(e) => setRiskFilter(e.target.value)}
                label="Risk Level"
                aria-label="Filter by risk level"
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="high">High</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="low">Low</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2}>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                label="Status"
                aria-label="Filter by status"
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="investigating">Investigating</MenuItem>
                <MenuItem value="resolved">Resolved</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2}>
            <Tooltip title="Refresh data">
              <IconButton onClick={handleRefresh} aria-label="Refresh dashboard data">
                <Refresh />
              </IconButton>
            </Tooltip>
          </Grid>
        </Grid>
      </Paper>

      {/* Fraud Triage Table */}
      <Paper sx={{ mb: 3 }}>
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="h6" component="h2">
            Fraud Triage Queue
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {filteredFraudTriage.length} alerts found
          </Typography>
        </Box>
        
        <VirtualizedTable
          data={filteredFraudTriage}
          columns={tableColumns}
          height={600}
          aria-label="Fraud triage alerts table"
          aria-describedby="fraud-triage-description"
        />
      </Paper>

      {/* Triage Drawer */}
      {selectedAlert && (
        <AccessibleDrawer
          open={triageDrawerOpen}
          onClose={handleCloseTriage}
          title="Fraud Triage Analysis"
          aria-label="Fraud triage analysis drawer"
          aria-describedby="triage-analysis-content"
        >
          <TriageDrawer
            open={triageDrawerOpen}
            onClose={handleCloseTriage}
            customerId={selectedAlert.customerId}
            transactionId={selectedAlert.transactionId}
          />
        </AccessibleDrawer>
      )}

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ open: false, message: '', severity: 'info' })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar({ open: false, message: '', severity: 'info' })}
          severity={snackbar.severity}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default EnhancedDashboard;

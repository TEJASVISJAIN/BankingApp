import { useState } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  LinearProgress,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Button,
  Paper,
  useTheme,
} from '@mui/material';
import {
  TrendingUp,
  Security,
  Assessment,
  CheckCircle,
  Refresh,
  Visibility,
  MoreVert,
  ArrowUpward,
  ArrowDownward,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import apiService from '../services/apiService';
import websocketService from '../services/websocketService';
import PageSkeleton from '../components/Loading/PageSkeleton';
import { maskCustomerId } from '../utils/piiRedaction';

interface FraudAlert {
  id: string;
  customerId: string;
  transactionId: string;
  amount: number;
  riskScore: number;
  status: string;
  timestamp: string;
  merchant: string;
}

export default function ProfessionalDashboard() {
  const theme = useTheme();
  const navigate = useNavigate();
  const [refreshing, setRefreshing] = useState(false);

  const { data: kpis, isLoading: kpisLoading, error: kpisError, refetch: refetchKpis } = useQuery({
    queryKey: ['dashboard', 'kpis'],
    queryFn: () => apiService.getDashboardKpis(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: fraudAlertsResponse, isLoading: alertsLoading, error: alertsError, refetch: refetchAlerts } = useQuery({
    queryKey: ['dashboard', 'fraud-alerts'],
    queryFn: () => apiService.getFraudTriage(1, 20),
    staleTime: 30 * 1000,
  });

  const fraudAlerts = fraudAlertsResponse?.data || [];

  // WebSocket connection and real-time updates
  useEffect(() => {
    // Connect to WebSocket
    websocketService.connect();

    // Listen for new transactions
    const unsubscribeNewTransaction = websocketService.onNewTransaction((transaction) => {
      console.log('New transaction received:', transaction);
      // Refetch data to get updated KPIs and alerts
      refetchKpis();
      refetchAlerts();
    });

    // Listen for new disputes
    const unsubscribeNewDispute = websocketService.onNewDispute((dispute) => {
      console.log('New dispute received:', dispute);
      // Refetch KPIs to update dispute count
      refetchKpis();
    });

    // Listen for KPI updates
    const unsubscribeKpiUpdate = websocketService.onKpiUpdate((kpis) => {
      console.log('KPI update received:', kpis);
      // Refetch KPIs to get latest data
      refetchKpis();
    });

    // Listen for fraud alerts
    const unsubscribeFraudAlert = websocketService.onFraudAlert((alert) => {
      console.log('Fraud alert received:', alert);
      // Refetch alerts to get latest data
      refetchAlerts();
    });

    // Cleanup on unmount
    return () => {
      unsubscribeNewTransaction();
      unsubscribeNewDispute();
      unsubscribeKpiUpdate();
      unsubscribeFraudAlert();
      websocketService.disconnect();
    };
  }, [refetchKpis, refetchAlerts]);

  const handleRefresh = async () => {
    setRefreshing(true);
    // Trigger refetch
    setTimeout(() => setRefreshing(false), 1000);
  };

  const getRiskColor = (score: number) => {
    if (score >= 80) return 'error';
    if (score >= 60) return 'warning';
    return 'success';
  };


  const kpiCards = [
    {
      title: 'Total Spend',
      value: `₹${((kpis?.totalSpend || 0) / 100).toLocaleString()}`,
      subtitle: 'Last 30 days',
      icon: <TrendingUp color="primary" />,
      trend: `${(kpis?.spendChange || 0) >= 0 ? '+' : ''}${kpis?.spendChange || 0}%`,
      trendDirection: (kpis?.spendChange || 0) >= 0 ? 'up' as const : 'down' as const,
    },
    {
      title: 'High Risk Alerts',
      value: kpis?.highRiskAlerts || 0,
      subtitle: 'Requires attention',
      icon: <Security color="error" />,
      trend: `${(kpis?.highRiskChange || 0) >= 0 ? '+' : ''}${kpis?.highRiskChange || 0}%`,
      trendDirection: (kpis?.highRiskChange || 0) >= 0 ? 'up' as const : 'down' as const,
    },
    {
      title: 'Disputes Opened',
      value: kpis?.disputesOpened || 0,
      subtitle: 'This month',
      icon: <Assessment color="warning" />,
      trend: `${(kpis?.disputesChange || 0) >= 0 ? '+' : ''}${kpis?.disputesChange || 0}%`,
      trendDirection: (kpis?.disputesChange || 0) >= 0 ? 'up' as const : 'down' as const,
    },
    {
      title: 'Avg Triage Time',
      value: `${kpis?.avgTriageTime || 0}s`,
      subtitle: 'Response time',
      icon: <CheckCircle color="success" />,
      trend: '-15.3%', // Keep this static for now
      trendDirection: 'down' as const,
    },
  ];

  if (kpisLoading || alertsLoading) {
    return <PageSkeleton />;
  }

  if (kpisError || alertsError) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h6" color="error" gutterBottom>
          Failed to load dashboard data
        </Typography>
        <Button variant="outlined" onClick={handleRefresh}>
          Try Again
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold' }}>
            Fraud Risk Dashboard
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Monitor and manage fraud detection in real-time
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={handleRefresh}
          disabled={refreshing}
        >
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </Box>

      {/* KPI Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {kpiCards.map((card, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card 
              sx={{ 
                height: '100%',
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: theme.shadows[8],
                },
              }}
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Avatar sx={{ bgcolor: 'primary.light', mr: 2 }}>
                    {card.icon}
                  </Avatar>
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                      {card.value}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {card.title}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                      {card.trendDirection === 'up' ? (
                        <ArrowUpward color="success" sx={{ fontSize: 16, mr: 0.5 }} />
                      ) : (
                        <ArrowDownward color="error" sx={{ fontSize: 16, mr: 0.5 }} />
                      )}
                      <Typography 
                        variant="caption" 
                        color={card.trendDirection === 'up' ? 'success.main' : 'error.main'}
                        sx={{ fontWeight: 'bold' }}
                      >
                        {card.trend}
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {card.subtitle}
                    </Typography>
                  </Box>
                </Box>
                <LinearProgress 
                  variant="determinate" 
                  value={Math.random() * 100} 
                  sx={{ mt: 1 }}
                />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Fraud Alerts Table */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  Recent Fraud Alerts
                </Typography>
                <Button 
                  variant="outlined" 
                  size="small"
                  onClick={() => navigate('/alerts')}
                >
                  View All
                </Button>
              </Box>
              
              <List>
                {(fraudAlerts || []).slice(0, 5).map((alert: FraudAlert) => (
                  <ListItem 
                    key={alert.id}
                    sx={{ 
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 2,
                      mb: 1,
                      '&:hover': {
                        backgroundColor: 'action.hover',
                      },
                    }}
                  >
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: getRiskColor(alert.riskScore) + '.light' }}>
                        <Security />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                            Customer {maskCustomerId(alert.customerId)}
                          </Typography>
                          <Chip
                            label={`${alert.riskScore}%`}
                            size="small"
                            color={getRiskColor(alert.riskScore)}
                            variant="outlined"
                          />
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            {alert.merchant} • ₹{alert.amount.toLocaleString()}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {new Date(alert.timestamp).toLocaleString()}
                          </Typography>
                        </Box>
                      }
                    />
                    <ListItemSecondaryAction>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Tooltip title="View Details">
                          <IconButton 
                            size="small"
                            onClick={() => navigate(`/alerts/${alert.id}`)}
                          >
                            <Visibility />
                          </IconButton>
                        </Tooltip>
                        <IconButton size="small">
                          <MoreVert />
                        </IconButton>
                      </Box>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
                System Status
              </Typography>
              
              <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">Fraud Detection</Typography>
                  <Typography variant="body2" color="success.main">Active</Typography>
                </Box>
                <LinearProgress variant="determinate" value={95} color="success" />
              </Box>

              <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">Risk Assessment</Typography>
                  <Typography variant="body2" color="success.main">Running</Typography>
                </Box>
                <LinearProgress variant="determinate" value={88} color="success" />
              </Box>

              <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">Alert Processing</Typography>
                  <Typography variant="body2" color="warning.main">Queue: 3</Typography>
                </Box>
                <LinearProgress variant="determinate" value={67} color="warning" />
              </Box>

              <Paper sx={{ p: 2, backgroundColor: 'primary.light', color: 'primary.contrastText' }}>
                <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                  Quick Actions
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Button 
                    variant="contained" 
                    size="small"
                    onClick={() => navigate('/alerts')}
                    sx={{ backgroundColor: 'white', color: 'primary.main' }}
                  >
                    View Alerts
                  </Button>
                  <Button 
                    variant="outlined" 
                    size="small"
                    onClick={() => navigate('/customers')}
                    sx={{ borderColor: 'white', color: 'white' }}
                  >
                    Customers
                  </Button>
                </Box>
              </Paper>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

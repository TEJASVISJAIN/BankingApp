import React, { useState, useEffect, useRef } from 'react';
import {
  Drawer,
  Box,
  Typography,
  Chip,
  LinearProgress,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Button,
  Alert,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Badge,
  Tooltip,
  IconButton,
} from '@mui/material';
import {
  CheckCircle,
  Error,
  Warning,
  Info,
  Close,
  ExpandMore,
  Security,
  Speed,
  LocationOn,
  CreditCard,
  Schedule,
  DeviceHub,
} from '@mui/icons-material';
import { apiService } from '../services/apiService';

interface RiskSignal {
  type: 'velocity' | 'amount' | 'location' | 'merchant' | 'device' | 'time';
  severity: 'low' | 'medium' | 'high';
  score: number;
  description: string;
  metadata?: any;
}

interface AgentStep {
  id: string;
  agent: string;
  tool: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime: number;
  endTime?: number;
  duration?: number;
  input?: any;
  output?: any;
  error?: string;
  metadata?: any;
}

interface FraudAssessment {
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  signals: RiskSignal[];
  recommendation: 'monitor' | 'investigate' | 'block';
  confidence: number;
  reasoning: string[];
}

interface TriageDrawerProps {
  open: boolean;
  onClose: () => void;
  customerId: string;
  transactionId: string;
}

const TriageDrawer: React.FC<TriageDrawerProps> = ({
  open,
  onClose,
  customerId,
  transactionId,
}) => {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [assessment, setAssessment] = useState<FraudAssessment | null>(null);
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamConnected, setStreamConnected] = useState(false);
  
  const eventSourceRef = useRef<EventSource | null>(null);

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'success';
      default: return 'default';
    }
  };

  const getStepIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle color="success" />;
      case 'failed': return <Error color="error" />;
      case 'running': return <LinearProgress />;
      default: return <Info color="info" />;
    }
  };

  const getSignalIcon = (type: string) => {
    switch (type) {
      case 'velocity': return <Speed />;
      case 'amount': return <CreditCard />;
      case 'location': return <LocationOn />;
      case 'device': return <DeviceHub />;
      case 'time': return <Schedule />;
      default: return <Security />;
    }
  };

  const startTriage = async () => {
    try {
      setIsRunning(true);
      setError(null);
      setSteps([]);
      setAssessment(null);

      // Start triage session
      const response = await apiService.startTriage({
        customerId,
        transactionId,
      });

      setSessionId(response.sessionId);

      // Connect to SSE stream
      connectToStream(response.sessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start triage');
      setIsRunning(false);
    }
  };

  const connectToStream = (sessionId: string) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource(`/api/triage/stream/${sessionId}`);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setStreamConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'connected':
            console.log('SSE connected:', data);
            break;
            
          case 'step_started':
            setSteps(prev => [...prev, {
              id: data.step.id,
              agent: data.step.agent,
              tool: data.step.tool,
              status: 'running',
              startTime: data.step.startTime,
            }]);
            break;
            
          case 'step_completed':
            setSteps(prev => prev.map(step => 
              step.id === data.step.id 
                ? { ...step, status: 'completed', endTime: Date.now(), output: data.result }
                : step
            ));
            break;
            
          case 'step_failed':
            setSteps(prev => prev.map(step => 
              step.id === data.step.id 
                ? { ...step, status: 'failed', endTime: Date.now(), error: data.error }
                : step
            ));
            break;
            
          case 'session_completed':
            setAssessment(data.assessment);
            setIsRunning(false);
            eventSource.close();
            break;
            
          case 'session_failed':
            setError(data.error);
            setIsRunning(false);
            eventSource.close();
            break;
            
          case 'heartbeat':
            // Keep connection alive
            break;
        }
      } catch (err) {
        console.error('Failed to parse SSE data:', err);
      }
    };

    eventSource.onerror = (err) => {
      console.error('SSE error:', err);
      setStreamConnected(false);
      setError('Connection lost');
    };
  };

  useEffect(() => {
    if (open && customerId && transactionId) {
      startTriage();
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [open, customerId, transactionId]);

  const handleClose = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    setSessionId(null);
    setAssessment(null);
    setSteps([]);
    setIsRunning(false);
    setError(null);
    setStreamConnected(false);
    onClose();
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={handleClose}
      PaperProps={{
        sx: { width: 600, maxWidth: '90vw' }
      }}
    >
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Fraud Triage Analysis</Typography>
          <IconButton onClick={handleClose}>
            <Close />
          </IconButton>
        </Box>

        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Customer: {customerId} | Transaction: {transactionId}
          </Typography>
          {sessionId && (
            <Typography variant="caption" color="text.secondary">
              Session: {sessionId}
            </Typography>
          )}
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {isRunning && (
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle2">Analysis in Progress</Typography>
                <Chip 
                  label={streamConnected ? 'Connected' : 'Connecting...'} 
                  color={streamConnected ? 'success' : 'warning'}
                  size="small"
                  sx={{ ml: 2 }}
                />
              </Box>
              <LinearProgress />
            </CardContent>
          </Card>
        )}

        {assessment && (
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Risk Assessment
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <Chip
                  label={`Score: ${assessment.riskScore}`}
                  color={getRiskColor(assessment.riskLevel)}
                  variant="outlined"
                />
                <Chip
                  label={assessment.riskLevel.toUpperCase()}
                  color={getRiskColor(assessment.riskLevel)}
                />
                <Chip
                  label={`Confidence: ${Math.round(assessment.confidence * 100)}%`}
                  color="info"
                  variant="outlined"
                />
              </Box>

              <Typography variant="subtitle2" gutterBottom>
                Recommendation: {assessment.recommendation.toUpperCase()}
              </Typography>

              {assessment.reasoning.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Reasoning:
                  </Typography>
                  <List dense>
                    {assessment.reasoning.map((reason, index) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          <Info color="info" />
                        </ListItemIcon>
                        <ListItemText primary={reason} />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}
            </CardContent>
          </Card>
        )}

        {assessment?.signals && assessment.signals.length > 0 && (
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Risk Signals
              </Typography>
              <List dense>
                {assessment.signals.map((signal, index) => (
                  <ListItem key={index}>
                    <ListItemIcon>
                      {getSignalIcon(signal.type)}
                    </ListItemIcon>
                    <ListItemText
                      primary={signal.description}
                      secondary={`${signal.type} - ${signal.severity} (${signal.score})`}
                    />
                    <Chip
                      label={signal.severity}
                      color={getRiskColor(signal.severity)}
                      size="small"
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        )}

        {steps.length > 0 && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Agent Execution Trace
              </Typography>
              
              {steps.map((step, index) => (
                <Accordion key={step.id} defaultExpanded={step.status === 'failed'}>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                      {getStepIcon(step.status)}
                      <Box sx={{ ml: 2, flexGrow: 1 }}>
                        <Typography variant="subtitle2">
                          {step.agent} - {step.tool}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {step.duration ? `${step.duration}ms` : 'Running...'}
                        </Typography>
                      </Box>
                      <Chip
                        label={step.status}
                        color={step.status === 'completed' ? 'success' : step.status === 'failed' ? 'error' : 'info'}
                        size="small"
                      />
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    {step.error && (
                      <Alert severity="error" sx={{ mb: 2 }}>
                        {step.error}
                      </Alert>
                    )}
                    {step.output && (
                      <Box>
                        <Typography variant="subtitle2" gutterBottom>
                          Output:
                        </Typography>
                        <pre style={{ fontSize: '0.75rem', overflow: 'auto' }}>
                          {JSON.stringify(step.output, null, 2)}
                        </pre>
                      </Box>
                    )}
                  </AccordionDetails>
                </Accordion>
              ))}
            </CardContent>
          </Card>
        )}

        {assessment && (
          <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
            <Button
              variant="contained"
              color="error"
              disabled={assessment.recommendation !== 'block'}
            >
              Freeze Card
            </Button>
            <Button
              variant="contained"
              color="warning"
              disabled={assessment.riskLevel === 'low'}
            >
              Open Dispute
            </Button>
            <Button
              variant="outlined"
              color="info"
            >
              Contact Customer
            </Button>
          </Box>
        )}
      </Box>
    </Drawer>
  );
};

export default TriageDrawer;

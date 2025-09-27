import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Snackbar,
  CircularProgress,
} from '@mui/material';
import {
  CheckCircle,
  Error,
  Info,
  Close,
  ExpandMore,
  Security,
  Speed,
  LocationOn,
  CreditCard,
  Schedule,
  DeviceHub,
  Block,
  Gavel,
  ContactPhone,
  VpnKey,
} from '@mui/icons-material';
import apiService from '../services/apiService';

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
  
  // Action states
  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    type: 'freeze' | 'dispute' | 'contact' | null;
    title: string;
    description: string;
  }>({ open: false, type: null, title: '', description: '' });
  const [otpDialog, setOtpDialog] = useState<{
    open: boolean;
    action: string;
    otp: string;
    loading: boolean;
  }>({ open: false, action: '', otp: '', loading: false });
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
  }>({ open: false, message: '', severity: 'info' });
  
  // 429 UX handling
  const [rateLimited, setRateLimited] = useState(false);
  const [retryAfter, setRetryAfter] = useState(0);
  
  // Accessibility
  const drawerRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  const eventSourceRef = useRef<EventSource | null>(null);

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'success';
      default: return 'default';
    }
  };

  // Accessibility: Focus trap
  const trapFocus = useCallback((e: KeyboardEvent) => {
    if (!drawerRef.current) return;
    
    const focusableElements = drawerRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;
    
    if (e.key === 'Tab') {
      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    }
  }, []);

  // Accessibility: ESC key handling
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  // 429 UX: Handle rate limiting
  const handleRateLimit = useCallback((retryAfterMs: number) => {
    setRateLimited(true);
    setRetryAfter(Math.ceil(retryAfterMs / 1000));
    
    const interval = setInterval(() => {
      setRetryAfter(prev => {
        if (prev <= 1) {
          setRateLimited(false);
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

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
      setError((err as Error)?.message || 'Failed to start triage');
      setIsRunning(false);
    }
  };

  const connectToStream = (sessionId: string) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    console.log('Connecting to SSE stream for sessionId:', sessionId);
    const sseUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/triage/stream/${sessionId}?X-API-Key=dev_key_789`;
    console.log('SSE URL:', sseUrl);
    const eventSource = new EventSource(sseUrl);
    eventSourceRef.current = eventSource;

    // Add timeout to prevent hanging connections
    const timeout = setTimeout(() => {
      if (eventSource.readyState === EventSource.CONNECTING) {
        console.warn('SSE connection timeout, closing connection');
        eventSource.close();
        setError('Connection timeout. Please try again.');
      }
    }, 10000); // 10 second timeout

    eventSource.onopen = () => {
      console.log('SSE connection opened successfully');
      clearTimeout(timeout);
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
            
          case 'decision_finalized':
            // Handle decision_finalized event from backend
            console.log('Received decision_finalized:', data);
            if (data.assessment) {
              const mappedAssessment = {
                riskScore: data.assessment.decision?.riskScore || 0,
                riskLevel: data.assessment.decision?.riskLevel || 'low',
                confidence: data.assessment.decision?.confidence || 0,
                recommendation: data.assessment.decision?.recommendation || 'monitor',
                signals: data.assessment.riskSignals?.signals || [],
                reasoning: data.assessment.decision?.reasoning || []
              };
              console.log('Mapped assessment:', mappedAssessment);
              setAssessment(mappedAssessment);
              setIsRunning(false);
            }
            break;
            
          case 'session_completed':
            // Map backend assessment structure to frontend structure
            if (data.assessment) {
              const mappedAssessment = {
                riskScore: data.assessment.decision?.riskScore || 0,
                riskLevel: data.assessment.decision?.riskLevel || 'low',
                confidence: data.assessment.decision?.confidence || 0,
                recommendation: data.assessment.decision?.recommendation || 'monitor',
                signals: data.assessment.riskSignals?.signals || [],
                reasoning: data.assessment.decision?.reasoning || []
              };
              setAssessment(mappedAssessment);
            }
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
      console.error('SSE connection failed for sessionId:', sessionId);
      console.error('SSE URL:', `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/triage/stream/${sessionId}?X-API-Key=dev_key_789`);
      setStreamConnected(false);
      
      // Check if the connection was closed or if there's a network error
      if (eventSource.readyState === EventSource.CLOSED) {
        console.log('SSE connection was closed');
        // Fallback: Try to get session status via regular API call
        setTimeout(() => {
          console.log('Attempting fallback API call for session status...');
          apiService.getTriageSession(sessionId)
            .then(session => {
              if (session && session.assessment) {
                console.log('Fallback successful, got session data:', session);
                const mappedAssessment = {
                  riskScore: session.assessment.decision?.riskScore || 0,
                  riskLevel: session.assessment.decision?.riskLevel || 'low',
                  confidence: session.assessment.decision?.confidence || 0,
                  recommendation: session.assessment.decision?.recommendation || 'monitor',
                  signals: session.assessment.riskSignals?.signals || [],
                  reasoning: session.assessment.decision?.reasoning || []
                };
                setAssessment(mappedAssessment);
                setIsRunning(false);
              } else {
                console.log('Fallback failed, no session data available');
                setError('Unable to get session status. Please try again.');
              }
            })
            .catch(fallbackErr => {
              console.error('Fallback API call failed:', fallbackErr);
              setError('Connection failed and fallback unavailable. Please try again.');
            });
        }, 2000); // Wait 2 seconds before trying fallback
      } else if (eventSource.readyState === EventSource.CONNECTING) {
        console.log('SSE connection is retrying...');
      }
      
      // Only show error if we're still running and don't have an assessment
      if (isRunning && !assessment) {
        setError('Connection lost. Please try again.');
        // Try to get the session status as a fallback
        setTimeout(() => {
          if (sessionId && isRunning && !assessment) {
            console.log('Attempting fallback: getting session status for', sessionId);
            apiService.getTriageSession(sessionId)
              .then((sessionData) => {
                if (sessionData && sessionData.assessment) {
                  console.log('Fallback successful: got assessment from session status');
                  const mappedAssessment = {
                    riskScore: sessionData.assessment.decision?.riskScore || 0,
                    riskLevel: sessionData.assessment.decision?.riskLevel || 'low',
                    confidence: sessionData.assessment.decision?.confidence || 0,
                    recommendation: sessionData.assessment.decision?.recommendation || 'monitor',
                    signals: sessionData.assessment.riskSignals?.signals || [],
                    reasoning: sessionData.assessment.decision?.reasoning || []
                  };
                  setAssessment(mappedAssessment);
                  setIsRunning(false);
                }
              })
              .catch((fallbackError) => {
                console.error('Fallback also failed:', fallbackError);
              });
          }
        }, 2000); // Wait 2 seconds before trying fallback
      }
    };
  };

  useEffect(() => {
    if (open && customerId && transactionId) {
      // Store the previously focused element for accessibility
      previousActiveElement.current = document.activeElement as HTMLElement;
      startTriage();
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [open, customerId, transactionId]);

  // Accessibility: Set up focus trap and keyboard handling
  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('keydown', trapFocus);
      
      // Focus the first focusable element
      setTimeout(() => {
        const firstFocusable = drawerRef.current?.querySelector(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        ) as HTMLElement;
        firstFocusable?.focus();
      }, 100);
      
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.removeEventListener('keydown', trapFocus);
        
        // Return focus to the previously focused element
        if (previousActiveElement.current) {
          previousActiveElement.current.focus();
        }
      };
    }
  }, [open, handleKeyDown, trapFocus]);

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
    setActionDialog({ open: false, type: null, title: '', description: '' });
    setOtpDialog({ open: false, action: '', otp: '', loading: false });
    onClose();
  };

  const handleAction = (type: 'freeze' | 'dispute' | 'contact') => {
    if (rateLimited) {
      setSnackbar({
        open: true,
        message: `Too many requests — try again in ${retryAfter}s`,
        severity: 'warning'
      });
      return;
    }
    
    const actions = {
      freeze: {
        title: 'Freeze Card',
        description: 'This will immediately freeze the card to prevent further transactions. This action may require OTP verification.',
      },
      dispute: {
        title: 'Open Dispute',
        description: 'This will create a dispute case for the transaction. Manual verification may be required for high amounts.',
      },
      contact: {
        title: 'Contact Customer',
        description: 'This will initiate contact with the customer to verify the transaction.',
      },
    };

    setActionDialog({
      open: true,
      type,
      title: actions[type].title,
      description: actions[type].description,
    });
  };

  const handleActionConfirm = async () => {
    if (!actionDialog.type) return;

    setActionLoading(actionDialog.type);
    
    try {
      let response;
      
      switch (actionDialog.type) {
        case 'freeze':
          response = await apiService.freezeCard(
            'card_001', // This should come from the transaction data
            undefined,
            customerId
          );
          break;
        case 'dispute':
          response = await apiService.openDispute(
            transactionId,
            '10.4', // Reason code
            true,
            customerId
          );
          break;
        case 'contact':
          response = await apiService.contactCustomer({
            customerId,
            method: 'phone',
            reason: 'Transaction verification',
            priority: 'high',
          });
          break;
      }

      if (response.status === 'PENDING_OTP') {
        setOtpDialog({
          open: true,
          action: actionDialog.type,
          otp: '',
          loading: false,
        });
        setActionDialog({ open: false, type: null, title: '', description: '' });
        return;
      }

      setSnackbar({
        open: true,
        message: `${actionDialog.title} completed successfully`,
        severity: 'success',
      });
      setActionDialog({ open: false, type: null, title: '', description: '' });
    } catch (error: any) {
      if (error.response?.status === 429) {
        const retryAfter = error.response.headers['retry-after'] || 2000;
        handleRateLimit(retryAfter);
        setSnackbar({
          open: true,
          message: `Too many requests — try again in ${Math.ceil(retryAfter / 1000)}s`,
          severity: 'warning',
        });
      } else {
        setSnackbar({
          open: true,
          message: `Failed to ${actionDialog.title.toLowerCase()}`,
          severity: 'error',
        });
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleOtpSubmit = async () => {
    setOtpDialog(prev => ({ ...prev, loading: true }));
    
    try {
      const response = await apiService.validateOtp({
        customerId,
        action: otpDialog.action,
        otp: otpDialog.otp,
      });

      if (response.isValid) {
        setSnackbar({
          open: true,
          message: 'OTP validated successfully',
          severity: 'success',
        });
        setOtpDialog({ open: false, action: '', otp: '', loading: false });
      } else {
        setSnackbar({
          open: true,
          message: response.reason || 'Invalid OTP',
          severity: 'error',
        });
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'OTP validation failed',
        severity: 'error',
      });
    } finally {
      setOtpDialog(prev => ({ ...prev, loading: false }));
    }
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={handleClose}
      PaperProps={{
        sx: { width: 600, maxWidth: '90vw' },
        ref: drawerRef
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
              
              <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                <Chip
                  label={`Triage Score: ${Math.round(((assessment?.riskScore || 0) * 100))}`}
                  color={getRiskColor(assessment?.riskLevel || 'low')}
                  variant="outlined"
                />
                <Chip
                  label={`Level: ${(assessment?.riskLevel || 'unknown').toUpperCase()}`}
                  color={getRiskColor(assessment?.riskLevel || 'low')}
                />
                <Chip
                  label={`Confidence: ${Math.round((assessment?.confidence || 0) * 100)}%`}
                  color="info"
                  variant="outlined"
                />
              </Box>
              
              <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                * Triage analysis provides detailed AI-based risk assessment vs. initial screening
              </Typography>

              <Typography variant="subtitle2" gutterBottom>
                Recommendation: {(assessment?.recommendation || 'No recommendation').toUpperCase()}
              </Typography>

              {(assessment?.reasoning || []).length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Reasoning:
                  </Typography>
                  <List dense>
                    {(assessment?.reasoning || []).map((reason, index) => (
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
                {(assessment?.signals || []).map((signal, index) => (
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
              
              {steps.map((step) => (
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
              startIcon={<Block />}
              disabled={assessment?.recommendation !== 'block' || actionLoading === 'freeze' || rateLimited}
              onClick={() => handleAction('freeze')}
            >
              {actionLoading === 'freeze' ? <CircularProgress size={20} /> : 
               rateLimited ? `Try again in ${retryAfter}s` : 'Freeze Card'}
            </Button>
            <Button
              variant="contained"
              color="warning"
              startIcon={<Gavel />}
              disabled={assessment?.riskLevel === 'low' || actionLoading === 'dispute' || rateLimited}
              onClick={() => handleAction('dispute')}
            >
              {actionLoading === 'dispute' ? <CircularProgress size={20} /> : 
               rateLimited ? `Try again in ${retryAfter}s` : 'Open Dispute'}
            </Button>
            <Button
              variant="outlined"
              color="info"
              startIcon={<ContactPhone />}
              disabled={actionLoading === 'contact' || rateLimited}
              onClick={() => handleAction('contact')}
            >
              {actionLoading === 'contact' ? <CircularProgress size={20} /> : 
               rateLimited ? `Try again in ${retryAfter}s` : 'Contact Customer'}
            </Button>
          </Box>
        )}
      </Box>

      {/* Action Confirmation Dialog */}
      <Dialog open={actionDialog.open} onClose={() => setActionDialog({ open: false, type: null, title: '', description: '' })}>
        <DialogTitle>{actionDialog.title}</DialogTitle>
        <DialogContent>
          <Typography>{actionDialog.description}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setActionDialog({ open: false, type: null, title: '', description: '' })}>
            Cancel
          </Button>
          <Button onClick={handleActionConfirm} variant="contained" color="primary">
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      {/* OTP Dialog */}
      <Dialog open={otpDialog.open} onClose={() => setOtpDialog({ open: false, action: '', otp: '', loading: false })}>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <VpnKey />
            OTP Verification Required
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            Please enter the OTP sent to your registered mobile number to complete this action.
          </Typography>
          <TextField
            fullWidth
            label="OTP"
            value={otpDialog.otp}
            onChange={(e) => setOtpDialog(prev => ({ ...prev, otp: e.target.value }))}
            placeholder="Enter 6-digit OTP"
            inputProps={{ maxLength: 6 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOtpDialog({ open: false, action: '', otp: '', loading: false })}>
            Cancel
          </Button>
          <Button 
            onClick={handleOtpSubmit} 
            variant="contained" 
            color="primary"
            disabled={otpDialog.loading || otpDialog.otp.length !== 6}
          >
            {otpDialog.loading ? <CircularProgress size={20} /> : 'Verify OTP'}
          </Button>
        </DialogActions>
      </Dialog>

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
    </Drawer>
  );
};

export default TriageDrawer;

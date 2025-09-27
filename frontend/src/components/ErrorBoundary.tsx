import { Component, ErrorInfo, ReactNode } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Container,
  Alert,
} from '@mui/material';
import { ErrorOutline, Refresh } from '@mui/icons-material';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Container maxWidth="md" sx={{ mt: 4 }}>
          <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
            <Box sx={{ mb: 3 }}>
              <ErrorOutline sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
              <Typography variant="h4" gutterBottom>
                Something went wrong
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                We're sorry, but something unexpected happened. Please try refreshing the page.
              </Typography>
            </Box>

            <Alert severity="error" sx={{ mb: 3, textAlign: 'left' }}>
              <Typography variant="subtitle2" gutterBottom>
                Error Details:
              </Typography>
              <Typography variant="body2" component="pre" sx={{ fontSize: '0.75rem' }}>
                {this.state.error?.message}
              </Typography>
            </Alert>

            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
              <Button
                variant="contained"
                startIcon={<Refresh />}
                onClick={this.handleReset}
              >
                Try Again
              </Button>
              <Button
                variant="outlined"
                onClick={() => window.location.reload()}
              >
                Refresh Page
              </Button>
            </Box>
          </Paper>
        </Container>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

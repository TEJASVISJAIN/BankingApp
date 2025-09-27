import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toaster } from 'react-hot-toast';

// Components
import AppLayout from './components/Layout/AppLayout';
import ErrorBoundary from './components/ErrorBoundary';
import LoadingSpinner from './components/Loading/LoadingSpinner';

// Pages
import ProfessionalDashboard from './pages/ProfessionalDashboard';
import { CustomerPage } from './pages/CustomerPage';
import { AlertsPage } from './pages/AlertsPage';
import NotFound from './pages/NotFound';

// Lazy load heavy components
const AnalyticsPage = React.lazy(() => import('./pages/AnalyticsPage'));
const SettingsPage = React.lazy(() => import('./pages/SettingsPage'));

// Create theme
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
      light: '#42a5f5',
      dark: '#1565c0',
    },
    secondary: {
      main: '#dc004e',
      light: '#ff5983',
      dark: '#9a0036',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
    error: {
      main: '#f44336',
    },
    warning: {
      main: '#ff9800',
    },
    success: {
      main: '#4caf50',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontWeight: 700,
    },
    h2: {
      fontWeight: 600,
    },
    h3: {
      fontWeight: 600,
    },
    h4: {
      fontWeight: 600,
    },
    h5: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          '&:hover': {
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
  },
});

// Create query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: (failureCount, error: any) => {
        if (error?.response?.status === 401) return false;
        return failureCount < 3;
      },
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <ErrorBoundary>
          <Router>
            <AppLayout>
              <Suspense fallback={<LoadingSpinner message="Loading page..." />}>
                <Routes>
                  {/* Main Routes */}
                  <Route path="/" element={<ProfessionalDashboard />} />
                  <Route path="/dashboard" element={<Navigate to="/" replace />} />
                  
                  {/* Customer Routes */}
                  <Route path="/customers" element={<CustomerPage />} />
                  <Route path="/customers/:id" element={<CustomerPage />} />
                  <Route path="/customer/:id" element={<CustomerPage />} />
                  
                  {/* Alert Routes */}
                  <Route path="/alerts" element={<AlertsPage />} />
                  <Route path="/alerts/:id" element={<AlertsPage />} />
                  
                  {/* Analytics Route */}
                  <Route 
                    path="/analytics" 
                    element={
                      <Suspense fallback={<LoadingSpinner message="Loading analytics..." />}>
                        <AnalyticsPage />
                      </Suspense>
                    } 
                  />
                  
                  {/* Settings Route */}
                  <Route 
                    path="/settings" 
                    element={
                      <Suspense fallback={<LoadingSpinner message="Loading settings..." />}>
                        <SettingsPage />
                      </Suspense>
                    } 
                  />
                  
                  {/* 404 Route */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </AppLayout>
          </Router>
        </ErrorBoundary>
        
        {/* Toast Notifications */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            },
            success: {
              style: {
                background: '#4caf50',
              },
            },
            error: {
              style: {
                background: '#f44336',
              },
            },
          }}
        />
        
        {/* React Query Devtools */}
        <ReactQueryDevtools initialIsOpen={false} />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
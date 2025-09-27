import React from 'react'
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Chip,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material'
import {
  PlayArrow,
  CheckCircle,
  Error,
  Assessment,
} from '@mui/icons-material'

// Mock evaluation data
const mockEvalResults = {
  summary: {
    totalTests: 12,
    passed: 10,
    failed: 2,
    successRate: 83.3,
    avgLatency: 2.1,
    fallbackRate: 8.3,
  },
  testCases: [
    {
      id: 'eval_001',
      name: 'Card Lost Scenario',
      status: 'passed',
      latency: 1.8,
      description: 'Customer reports lost card, should freeze with OTP',
    },
    {
      id: 'eval_002',
      name: 'Unauthorized Charge',
      status: 'passed',
      latency: 2.3,
      description: 'Customer reports unauthorized charge, should open dispute',
    },
    {
      id: 'eval_003',
      name: 'Geo-Velocity Alert',
      status: 'passed',
      latency: 1.9,
      description: 'Impossible travel detected, should freeze card',
    },
    {
      id: 'eval_004',
      name: 'Risk Service Timeout',
      status: 'failed',
      latency: 5.2,
      description: 'Risk service timeout, should fallback to rules',
    },
    {
      id: 'eval_005',
      name: 'Policy Block',
      status: 'passed',
      latency: 1.5,
      description: 'Unfreeze without identity should be denied',
    },
  ],
  metrics: {
    toolCallTotal: 156,
    toolCallSuccess: 142,
    toolCallErrors: 14,
    fallbackTriggers: 3,
    policyDenials: 2,
    avgAgentLatency: 2.1,
    p95Latency: 4.8,
  },
}

export function EvalsPage() {
  const [isRunning, setIsRunning] = React.useState(false)

  const handleRunEvals = async () => {
    setIsRunning(true)
    // Simulate running evaluations
    setTimeout(() => {
      setIsRunning(false)
    }, 3000)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'passed': return 'success'
      case 'failed': return 'error'
      case 'running': return 'info'
      default: return 'default'
    }
  }


  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Model Evaluations
        </Typography>
        <Button
          variant="contained"
          startIcon={<PlayArrow />}
          onClick={handleRunEvals}
          disabled={isRunning}
        >
          {isRunning ? 'Running...' : 'Run Evaluations'}
        </Button>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Assessment color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">Success Rate</Typography>
              </Box>
              <Typography variant="h4" color="primary">
                {mockEvalResults.summary.successRate}%
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {mockEvalResults.summary.passed}/{mockEvalResults.summary.totalTests} tests passed
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <CheckCircle color="success" sx={{ mr: 1 }} />
                <Typography variant="h6">Avg Latency</Typography>
              </Box>
              <Typography variant="h4" color="success.main">
                {mockEvalResults.summary.avgLatency}s
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Target: &lt;5s
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Error color="warning" sx={{ mr: 1 }} />
                <Typography variant="h6">Fallback Rate</Typography>
              </Box>
              <Typography variant="h4" color="warning.main">
                {mockEvalResults.summary.fallbackRate}%
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {mockEvalResults.metrics.fallbackTriggers} triggers
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Assessment color="info" sx={{ mr: 1 }} />
                <Typography variant="h6">Tool Calls</Typography>
              </Box>
              <Typography variant="h4" color="info.main">
                {mockEvalResults.metrics.toolCallTotal}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {mockEvalResults.metrics.toolCallSuccess} successful
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Test Cases Table */}
      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="h6">Test Cases</Typography>
        </Box>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Test Case</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Latency</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {mockEvalResults.testCases.map((testCase) => (
                <TableRow key={testCase.id}>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {testCase.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {testCase.id}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={testCase.status}
                      color={getStatusColor(testCase.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {testCase.latency}s
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {testCase.description}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Button size="small" variant="outlined">
                      View Details
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Metrics Summary */}
      <Paper sx={{ mt: 3, p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Performance Metrics
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Tool Call Success Rate
              </Typography>
              <Typography variant="h6">
                {((mockEvalResults.metrics.toolCallSuccess / mockEvalResults.metrics.toolCallTotal) * 100).toFixed(1)}%
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Box>
              <Typography variant="body2" color="text.secondary">
                P95 Latency
              </Typography>
              <Typography variant="h6">
                {mockEvalResults.metrics.p95Latency}s
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Policy Denials
              </Typography>
              <Typography variant="h6">
                {mockEvalResults.metrics.policyDenials}
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Avg Agent Latency
              </Typography>
              <Typography variant="h6">
                {mockEvalResults.metrics.avgAgentLatency}s
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  )
}

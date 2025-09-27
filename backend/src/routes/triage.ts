import { Router, Request, Response } from 'express';
import { agentOrchestrator, TriageRequest } from '../agents/orchestrator';
import { secureLogger } from '../utils/logger';
import { apiKeyAuth } from '../middleware/auth';

const router = Router();

// Store active SSE connections
const activeConnections = new Map<string, Response>();

// POST /api/triage - Start fraud triage assessment
router.post('/', apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const { customerId, transactionId } = req.body;

    if (!customerId || !transactionId) {
      return res.status(400).json({
        error: 'Missing required fields: customerId, transactionId',
      });
    }

    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    secureLogger.info('Triage request received', {
      customerId,
      transactionId,
      sessionId,
    });

    // Return session ID immediately for SSE connection
    res.json({
      sessionId,
      status: 'started',
      message: 'Triage assessment started. Connect to SSE stream for real-time updates.',
    });

    // Start the triage process asynchronously
    setImmediate(async () => {
      try {
        secureLogger.info('Starting triage pipeline execution', {
          sessionId,
          customerId,
          transactionId,
        });

        const result = await agentOrchestrator.triageTransaction({
          customerId,
          transactionId,
          sessionId,
        });

        secureLogger.info('Triage pipeline completed successfully', {
          sessionId,
          status: result.status,
        });

        // Send final result via SSE if connection exists
        const connection = activeConnections.get(sessionId);
        if (connection) {
          connection.write(`data: ${JSON.stringify({
            type: 'assessment_complete',
            sessionId,
            assessment: result,
            timestamp: new Date().toISOString(),
          })}\n\n`);
          connection.end();
          activeConnections.delete(sessionId);
        }
      } catch (error) {
        secureLogger.error('Triage assessment failed', {
          sessionId,
          customerId,
          transactionId,
          error: (error as Error).message,
          stack: (error as Error).stack,
        });

        const connection = activeConnections.get(sessionId);
        if (connection) {
          connection.write(`data: ${JSON.stringify({
            type: 'assessment_error',
            sessionId,
            error: (error as Error).message,
            timestamp: new Date().toISOString(),
          })}\n\n`);
          connection.end();
          activeConnections.delete(sessionId);
        }
      }
    });
  } catch (error) {
    secureLogger.error('Triage request failed', {
      error: (error as Error).message,
    });

    res.status(500).json({
      error: 'Triage assessment failed',
      details: (error as Error).message,
    });
  }
});

// GET /api/triage/stream/:sessionId - SSE stream for real-time updates
router.get('/stream/:sessionId', apiKeyAuth, (req: Request, res: Response) => {
  const { sessionId } = req.params;
  
  secureLogger.info('SSE stream request received', {
    sessionId,
    headers: req.headers,
  });

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control',
  });

  // Store the connection
  activeConnections.set(sessionId, res);

  // Send initial connection event
  res.write(`data: ${JSON.stringify({
    type: 'connected',
    sessionId,
    timestamp: new Date().toISOString(),
  })}\n\n`);

  // Set up event listeners for this session
  const onStepStarted = (data: any) => {
    if (data.sessionId === sessionId) {
      res.write(`data: ${JSON.stringify({
        type: 'step_started',
        sessionId,
        step: data.step,
        timestamp: new Date().toISOString(),
      })}\n\n`);
    }
  };

  const onStepCompleted = (data: any) => {
    if (data.sessionId === sessionId) {
      res.write(`data: ${JSON.stringify({
        type: 'step_completed',
        sessionId,
        step: data.step,
        result: data.result,
        timestamp: new Date().toISOString(),
      })}\n\n`);
    }
  };

  const onStepFailed = (data: any) => {
    if (data.sessionId === sessionId) {
      res.write(`data: ${JSON.stringify({
        type: 'step_failed',
        sessionId,
        step: data.step,
        error: data.error,
        timestamp: new Date().toISOString(),
      })}\n\n`);
    }
  };

  const onSessionCompleted = (data: any) => {
    if (data.sessionId === sessionId) {
      res.write(`data: ${JSON.stringify({
        type: 'session_completed',
        sessionId,
        assessment: data.assessment,
        trace: data.trace,
        timestamp: new Date().toISOString(),
      })}\n\n`);
      
      // Close the connection after completion
      setTimeout(() => {
        res.end();
        activeConnections.delete(sessionId);
      }, 1000);
    }
  };

  const onSessionFailed = (data: any) => {
    if (data.sessionId === sessionId) {
      res.write(`data: ${JSON.stringify({
        type: 'session_failed',
        sessionId,
        error: data.error,
        timestamp: new Date().toISOString(),
      })}\n\n`);
      
      // Close the connection after failure
      setTimeout(() => {
        res.end();
        activeConnections.delete(sessionId);
      }, 1000);
    }
  };

  // Register event listeners
  agentOrchestrator.on('step_started', onStepStarted);
  agentOrchestrator.on('step_completed', onStepCompleted);
  agentOrchestrator.on('step_failed', onStepFailed);
  agentOrchestrator.on('session_completed', onSessionCompleted);
  agentOrchestrator.on('session_failed', onSessionFailed);

  // Handle client disconnect
  req.on('close', () => {
    activeConnections.delete(sessionId);
    agentOrchestrator.removeListener('step_started', onStepStarted);
    agentOrchestrator.removeListener('step_completed', onStepCompleted);
    agentOrchestrator.removeListener('step_failed', onStepFailed);
    agentOrchestrator.removeListener('session_completed', onSessionCompleted);
    agentOrchestrator.removeListener('session_failed', onSessionFailed);
  });

  // Send periodic heartbeat
  const heartbeat = setInterval(() => {
    if (activeConnections.has(sessionId)) {
      res.write(`data: ${JSON.stringify({
        type: 'heartbeat',
        sessionId,
        timestamp: new Date().toISOString(),
      })}\n\n`);
    } else {
      clearInterval(heartbeat);
    }
  }, 30000); // Every 30 seconds

  // Clean up on disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
  });
});

// GET /api/triage/session/:sessionId - Get session status
router.get('/session/:sessionId', apiKeyAuth, (req: Request, res: Response) => {
  const { sessionId } = req.params;

  const session = agentOrchestrator.getSession(sessionId);
  if (!session) {
    return res.status(404).json({
      error: 'Session not found',
    });
  }

  res.json(session);
});

// GET /api/triage/sessions - Get all active sessions
router.get('/sessions', apiKeyAuth, (req: Request, res: Response) => {
  const sessions = agentOrchestrator.getActiveSessions();
  const stats = agentOrchestrator.getSessionStats();

  res.json({
    sessions,
    stats,
  });
});

// POST /api/triage/cancel/:sessionId - Cancel a running session
router.post('/cancel/:sessionId', apiKeyAuth, (req: Request, res: Response) => {
  const { sessionId } = req.params;

  const session = agentOrchestrator.getSession(sessionId);
  if (!session) {
    return res.status(404).json({
      error: 'Session not found',
    });
  }

  if (session.status !== 'running') {
    return res.status(400).json({
      error: 'Session is not running',
    });
  }

  // Mark session as cancelled
  session.status = 'failed';
  session.endTime = Date.now();
  session.totalDuration = session.endTime - session.startTime;
  session.steps.push({
    id: 'cancelled',
    agent: 'orchestrator',
    tool: 'cancel',
    status: 'failed',
    startTime: Date.now(),
    endTime: Date.now(),
    error: 'Session cancelled by user',
  });

  // Close SSE connection if active
  const connection = activeConnections.get(sessionId);
  if (connection) {
    connection.write(`data: ${JSON.stringify({
      type: 'session_cancelled',
      sessionId,
      timestamp: new Date().toISOString(),
    })}\n\n`);
    connection.end();
    activeConnections.delete(sessionId);
  }

  res.json({
    message: 'Session cancelled',
    sessionId,
  });
});

export default router;

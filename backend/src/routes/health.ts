import { Router } from 'express';
import { pool } from '../utils/database';
import { logger } from '../utils/logger';

const router = Router();

// GET /health
router.get('/', async (req, res) => {
  const start = Date.now();
  
  try {
    // Check database connection
    await pool.query('SELECT 1');
    const dbLatency = Date.now() - start;
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: {
          status: 'connected',
          latency: `${dbLatency}ms`,
        },
        api: {
          status: 'running',
          uptime: process.uptime(),
        },
      },
      version: process.env.npm_package_version || '1.0.0',
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      services: {
        database: {
          status: 'disconnected',
          error: error.message,
        },
        api: {
          status: 'running',
          uptime: process.uptime(),
        },
      },
    });
  }
});

// GET /health/ready
router.get('/ready', async (req, res) => {
  try {
    // Check if all required services are ready
    await pool.query('SELECT 1');
    
    res.json({
      status: 'ready',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

export { router as healthRoutes };

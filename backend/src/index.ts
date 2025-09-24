import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { apiKeyAuth } from './middleware/auth';

// Import routes
import { ingestionRoutes } from './routes/ingestion';
import { insightsRoutes } from './routes/insights';
import { customerRoutes } from './routes/customer';
import { healthRoutes } from './routes/health';
import { metricsRoutes } from './routes/metrics';
import triageRoutes from './routes/triage';
import traceRoutes from './routes/traces';

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

// Compression
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests',
    retryAfterMs: 60000,
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(requestLogger);

// Health check (no auth required)
app.use('/health', healthRoutes);

// Metrics endpoint (no auth required)
app.use('/metrics', metricsRoutes);

// API routes with authentication
app.use('/api/ingest', apiKeyAuth, ingestionRoutes);
app.use('/api/insights', apiKeyAuth, insightsRoutes);
app.use('/api/customer', apiKeyAuth, customerRoutes);
app.use('/api/triage', apiKeyAuth, triageRoutes);
app.use('/api/traces', apiKeyAuth, traceRoutes);

// Error handling
app.use(errorHandler);

// Start server
const PORT = config.port;
app.listen(PORT, () => {
  logger.info(`🚀 Aegis Support API running on port ${PORT}`);
  logger.info(`📊 Metrics available at http://localhost:${PORT}/metrics`);
  logger.info(`🏥 Health check at http://localhost:${PORT}/health`);
});

export default app;

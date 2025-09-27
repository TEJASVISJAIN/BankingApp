import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { secureLogger } from '../utils/logger';

// Extend Request interface
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      sessionId?: string;
      user?: {
        role: 'agent' | 'lead';
        apiKey: string;
      };
    }
  }
}

export function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'] as string || req.query['X-API-Key'] as string;
  
  if (!apiKey) {
    secureLogger.warn('API key missing', {
      requestId: req.requestId,
      sessionId: req.sessionId,
      ip: req.ip,
    });
    
    return res.status(401).json({
      error: 'API key required',
      code: 'MISSING_API_KEY',
    });
  }
  
  // Simple API key validation (in production, use proper key management)
  const validKeys = {
    'agent_key_123': { role: 'agent' as const },
    'lead_key_456': { role: 'lead' as const },
    'dev_key_789': { role: 'lead' as const }, // Development key
  };
  
  const user = validKeys[apiKey as keyof typeof validKeys];
  
  if (!user) {
    secureLogger.warn('Invalid API key', {
      requestId: req.requestId,
      sessionId: req.sessionId,
      apiKey: apiKey.substring(0, 8) + '...',
      ip: req.ip,
    });
    
    return res.status(401).json({
      error: 'Invalid API key',
      code: 'INVALID_API_KEY',
    });
  }
  
  req.user = {
    role: user.role,
    apiKey,
  };
  
  secureLogger.info('API key validated', {
    requestId: req.requestId,
    sessionId: req.sessionId,
    role: user.role,
    ip: req.ip,
  });
  
  next();
}

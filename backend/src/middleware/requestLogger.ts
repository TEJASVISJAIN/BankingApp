import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { secureLogger } from '../utils/logger';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const requestId = uuidv4();
  const sessionId = req.headers['x-session-id'] as string || uuidv4();
  
  // Add request metadata
  req.requestId = requestId;
  req.sessionId = sessionId;
  
  const start = Date.now();
  
  // Log request
  secureLogger.info('Request started', {
    requestId,
    sessionId,
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
  });
  
  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any) {
    const duration = Date.now() - start;
    
    secureLogger.info('Request completed', {
      requestId,
      sessionId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      contentLength: res.get('Content-Length'),
    });
    
    return originalEnd.call(this, chunk, encoding);
  };
  
  next();
}

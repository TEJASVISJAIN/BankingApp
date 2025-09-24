import { Request, Response, NextFunction } from 'express';
import { secureLogger } from '../utils/logger';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  isOperational?: boolean;
}

export function errorHandler(
  error: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const statusCode = error.statusCode || 500;
  const code = error.code || 'INTERNAL_ERROR';
  
  // Log error
  secureLogger.error('Request error', {
    requestId: req.requestId,
    sessionId: req.sessionId,
    error: {
      message: error.message,
      stack: error.stack,
      statusCode,
      code,
    },
    url: req.url,
    method: req.method,
  });
  
  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(statusCode).json({
    error: {
      message: isDevelopment ? error.message : 'Internal server error',
      code,
      ...(isDevelopment && { stack: error.stack }),
    },
    requestId: req.requestId,
  });
}

export function createError(message: string, statusCode: number = 500, code?: string): AppError {
  const error: AppError = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  error.isOperational = true;
  return error;
}

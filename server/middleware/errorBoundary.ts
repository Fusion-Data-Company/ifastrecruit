import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

// Custom error classes for better error handling
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public code: string;
  public details?: any;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    isOperational: boolean = true,
    details?: any
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;
    this.details = details;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR', true, details);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized access') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden access') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Resource conflict') {
    super(message, 409, 'CONFLICT');
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, message?: string) {
    super(
      message || `External service ${service} is unavailable`,
      503,
      'EXTERNAL_SERVICE_ERROR',
      true,
      { service }
    );
  }
}

export class DatabaseError extends AppError {
  constructor(message: string = 'Database operation failed', details?: any) {
    super(message, 500, 'DATABASE_ERROR', true, details);
  }
}

// Error logging and monitoring
class ErrorLogger {
  private errorCounts = new Map<string, number>();
  private recentErrors: Array<{
    timestamp: number;
    error: AppError;
    context?: any;
  }> = [];

  logError(error: AppError, context?: any) {
    // Count errors by type
    const errorKey = `${error.code}:${error.statusCode}`;
    this.errorCounts.set(errorKey, (this.errorCounts.get(errorKey) || 0) + 1);

    // Store recent errors (last 1000)
    this.recentErrors.push({
      timestamp: Date.now(),
      error,
      context,
    });

    if (this.recentErrors.length > 1000) {
      this.recentErrors = this.recentErrors.slice(-1000);
    }

    // Log to console with appropriate level
    const logLevel = error.statusCode >= 500 ? 'error' : 'warn';
    console[logLevel]('Application Error:', {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      isOperational: error.isOperational,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString(),
    });

    // In production, send to external monitoring service
    if (process.env.NODE_ENV === 'production' && error.statusCode >= 500) {
      this.sendToMonitoringService(error, context);
    }
  }

  private sendToMonitoringService(error: AppError, context?: any) {
    // Mock implementation - replace with actual monitoring service
    console.log('Would send to monitoring service:', {
      error: error.message,
      code: error.code,
      context,
    });
  }

  getErrorStats(timeframe: number = 3600000) {
    const cutoff = Date.now() - timeframe;
    const recentErrors = this.recentErrors.filter(e => e.timestamp > cutoff);

    const errorsByCode = new Map<string, number>();
    const errorsByStatus = new Map<number, number>();

    recentErrors.forEach(({ error }) => {
      errorsByCode.set(error.code, (errorsByCode.get(error.code) || 0) + 1);
      errorsByStatus.set(error.statusCode, (errorsByStatus.get(error.statusCode) || 0) + 1);
    });

    return {
      totalErrors: recentErrors.length,
      errorsByCode: Object.fromEntries(errorsByCode),
      errorsByStatus: Object.fromEntries(errorsByStatus),
      recentErrors: recentErrors.slice(-10).map(e => ({
        timestamp: e.timestamp,
        message: e.error.message,
        code: e.error.code,
        statusCode: e.error.statusCode,
      })),
    };
  }

  clearStats() {
    this.errorCounts.clear();
    this.recentErrors = [];
  }
}

export const errorLogger = new ErrorLogger();

// Circuit breaker pattern for external services
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private failureThreshold: number = 5,
    private recoveryTimeout: number = 60000, // 1 minute
    private monitoringWindow: number = 300000 // 5 minutes
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new ExternalServiceError('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  getStatus() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
    };
  }
}

// Retry mechanism with exponential backoff
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
  maxDelay: number = 10000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxRetries) {
        break;
      }

      const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

// Global error handler middleware
export const globalErrorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let appError: AppError;

  // Convert known errors to AppError
  if (error instanceof AppError) {
    appError = error;
  } else if (error instanceof z.ZodError) {
    appError = new ValidationError('Validation failed', error.errors);
  } else if (error.name === 'CastError') {
    appError = new ValidationError('Invalid ID format');
  } else if (error.name === 'ValidationError') {
    appError = new ValidationError(error.message);
  } else if (error.message.includes('duplicate key')) {
    appError = new ConflictError('Resource already exists');
  } else if (error.message.includes('ECONNREFUSED')) {
    appError = new ExternalServiceError('Database', 'Database connection failed');
  } else {
    // Unknown error
    appError = new AppError(
      process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
      500,
      'INTERNAL_ERROR',
      false
    );
  }

  // Log the error
  errorLogger.logError(appError, {
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    body: req.body,
    query: req.query,
    params: req.params,
  });

  // Send error response
  const response: any = {
    error: {
      message: appError.message,
      code: appError.code,
      statusCode: appError.statusCode,
    },
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
  };

  // Include details and stack trace in development
  if (process.env.NODE_ENV !== 'production') {
    if (appError.details) {
      response.error.details = appError.details;
    }
    if (appError.stack) {
      response.error.stack = appError.stack;
    }
  }

  res.status(appError.statusCode).json(response);
};

// Async error wrapper
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// 404 handler
export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  const error = new NotFoundError(`Route ${req.originalUrl} not found`);
  next(error);
};

// Graceful shutdown handler
export const gracefulShutdown = (server: any) => {
  const shutdown = (signal: string) => {
    console.log(`Received ${signal}, shutting down gracefully...`);
    
    server.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });

    // Force close after 30 seconds
    setTimeout(() => {
      console.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 30000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

// Health check with error monitoring
export const healthCheck = async (req: Request, res: Response) => {
  try {
    const errorStats = errorLogger.getErrorStats();
    const memoryUsage = process.memoryUsage();
    
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      },
      errors: errorStats,
    };

    // Check if error rate is too high
    if (errorStats.totalErrors > 100) {
      health.status = 'degraded';
    }

    res.json(health);
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
    });
  }
};
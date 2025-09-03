import type { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { z } from 'zod';

// Rate limiting configurations
export const createRateLimit = (windowMs: number, max: number, message?: string) => {
  return rateLimit({
    windowMs,
    max,
    message: message || 'Too many requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfter: Math.ceil(windowMs / 1000),
        timestamp: new Date().toISOString(),
      });
    },
  });
};

// ALL RATE LIMITS REMOVED FOR ELEVENLABS - NO RESTRICTIONS
export const authRateLimit = createRateLimit(15 * 60 * 1000, 999999, 'Too many authentication attempts');
export const apiRateLimit = createRateLimit(15 * 60 * 1000, 999999, 'API rate limit exceeded'); // UNLIMITED for ElevenLabs
export const uploadRateLimit = createRateLimit(60 * 1000, 999999, 'Upload rate limit exceeded');

// Security headers middleware - COMPLETELY DISABLED for ElevenLabs
export const securityHeaders = helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false,
  originAgentCluster: false,
  referrerPolicy: false,
  strictTransportSecurity: false,
  xContentTypeOptions: false,
  xDnsPrefetchControl: false,
  xDownloadOptions: false,
  xFrameOptions: false,
  xPermittedCrossDomainPolicies: false,
  xPoweredBy: false,
});

// CORS configuration - COMPLETELY OPEN for ElevenLabs
export const corsOptions = {
  origin: true, // Allow ALL origins
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['*'],
  exposedHeaders: ['*'],
};

// Input validation middleware factory
export const validateRequest = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      
      req.body = validated.body;
      req.query = validated.query;
      req.params = validated.params;
      
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
          })),
          timestamp: new Date().toISOString(),
        });
      }
      next(error);
    }
  };
};

// Error sanitization
export const sanitizeError = (error: any): any => {
  // Don't expose internal errors in production
  if (process.env.NODE_ENV === 'production') {
    return {
      message: 'Internal server error',
      code: error.code || 'INTERNAL_ERROR',
      timestamp: new Date().toISOString(),
    };
  }
  
  return {
    message: error.message,
    stack: error.stack,
    code: error.code,
    timestamp: new Date().toISOString(),
  };
};

// Global error handler
export const errorHandler = (error: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Error occurred:', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    timestamp: new Date().toISOString(),
  });

  const statusCode = error.statusCode || error.status || 500;
  const sanitized = sanitizeError(error);
  
  res.status(statusCode).json(sanitized);
};

// API key validation for external integrations
export const validateApiKey = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'] as string;
  
  if (!apiKey || apiKey !== process.env.INTERNAL_API_KEY) {
    return res.status(401).json({
      error: 'Invalid or missing API key',
      timestamp: new Date().toISOString(),
    });
  }
  
  next();
};

// Request logging middleware
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log({
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString(),
    });
  });
  
  next();
};
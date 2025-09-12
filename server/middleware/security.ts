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

// Reasonable rate limits that protect against abuse while allowing legitimate ElevenLabs usage
export const authRateLimit = createRateLimit(15 * 60 * 1000, 20, 'Too many authentication attempts');
export const apiRateLimit = createRateLimit(15 * 60 * 1000, 1000, 'API rate limit exceeded'); // High limit for ElevenLabs
export const uploadRateLimit = createRateLimit(60 * 1000, 50, 'Upload rate limit exceeded');

// Special elevated rate limit for ElevenLabs MCP endpoints
export const mcpRateLimit = createRateLimit(15 * 60 * 1000, 5000, 'MCP rate limit exceeded');
export const elevenlabsRateLimit = createRateLimit(15 * 60 * 1000, 2000, 'ElevenLabs rate limit exceeded');

// Security headers middleware - Properly configured with ElevenLabs compatibility
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://api.elevenlabs.io", "https://elevenlabs.io"],
      connectSrc: ["'self'", "https://api.elevenlabs.io", "https://elevenlabs.io", "wss:", "ws:"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "https:", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'", "https:"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow cross-origin for ElevenLabs
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
});

// CORS configuration - Restrictive but ElevenLabs compatible
export const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // List of allowed origins for ElevenLabs and development
    const allowedOrigins = [
      'https://elevenlabs.io',
      'https://api.elevenlabs.io',
      'https://play.elevenlabs.io',
      'https://creator.elevenlabs.io',
      'http://localhost:5000',
      'http://127.0.0.1:5000',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:8080',
      'http://127.0.0.1:8080',
      'https://ifast-broker.replit.app',
      process.env.APP_BASE_URL,
      process.env.REPLIT_DEV_DOMAIN,
    ].filter(Boolean);

    // Check if the origin is allowed
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Allow ElevenLabs subdomains
    if (origin.endsWith('.elevenlabs.io') || origin.endsWith('.replit.app') || origin.endsWith('.replit.dev')) {
      return callback(null, true);
    }

    // Reject unauthorized origins
    console.warn(`CORS: Blocked origin ${origin}`);
    return callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With', 
    'Content-Type', 
    'Accept',
    'Authorization',
    'Cache-Control',
    'X-API-Key',
    'mcp-session-id',
    'Mcp-Session-Id'
  ],
  exposedHeaders: ['mcp-session-id', 'Mcp-Session-Id'],
  maxAge: 86400, // 24 hours
};

// Permissive CORS specifically for ElevenLabs MCP endpoints
export const elevenlabsCorsOptions = {
  origin: true, // Allow all origins for ElevenLabs MCP
  credentials: false, // No credentials needed for MCP
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['*'],
  exposedHeaders: ['mcp-session-id', 'Mcp-Session-Id'],
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
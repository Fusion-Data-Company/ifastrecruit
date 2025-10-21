/**
 * AI Rate Limiting Middleware
 *
 * Prevents abuse of AI features by limiting requests per user
 */

import rateLimit from 'express-rate-limit';

// Per-user rate limiter for AI requests
export const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: parseInt(process.env.AI_RATE_LIMIT_PER_MINUTE || '10'), // 10 requests per minute default
  keyGenerator: (req: any) => req.user?.id || req.ip,
  handler: (req, res) => {
    res.status(429).json({
      error: {
        code: 'AI_RATE_LIMIT_EXCEEDED',
        message: 'Too many AI requests. Please wait before asking Jason again.',
        retryAfter: 60,
      },
    });
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Hourly rate limiter
export const aiHourlyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: parseInt(process.env.AI_RATE_LIMIT_PER_HOUR || '100'), // 100 requests per hour default
  keyGenerator: (req: any) => req.user?.id || req.ip,
  handler: (req, res) => {
    res.status(429).json({
      error: {
        code: 'AI_HOURLY_LIMIT_EXCEEDED',
        message: 'You have exceeded your hourly AI request limit. Please try again later.',
        retryAfter: 3600,
      },
    });
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Daily rate limiter
export const aiDailyLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: parseInt(process.env.AI_RATE_LIMIT_PER_DAY || '500'), // 500 requests per day default
  keyGenerator: (req: any) => req.user?.id || req.ip,
  handler: (req, res) => {
    res.status(429).json({
      error: {
        code: 'AI_DAILY_LIMIT_EXCEEDED',
        message: 'You have reached your daily AI request limit. Please try again tomorrow.',
        retryAfter: 86400,
      },
    });
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Combined AI rate limiter (apply all three)
 * Use this on AI endpoints
 */
export function applyAIRateLimits(req: any, res: any, next: any) {
  aiRateLimiter(req, res, (err1: any) => {
    if (err1) return next(err1);

    aiHourlyLimiter(req, res, (err2: any) => {
      if (err2) return next(err2);

      aiDailyLimiter(req, res, (err3: any) => {
        if (err3) return next(err3);
        next();
      });
    });
  });
}

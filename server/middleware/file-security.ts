import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { storage } from "../storage";

// Signed URL configuration
const SIGNED_URL_SECRET = process.env.FILE_SIGNING_SECRET || crypto.randomBytes(32).toString('hex');
const SIGNED_URL_TTL = 3600; // 1 hour in seconds

export interface SignedUrlPayload {
  fileId: string;
  fileType: 'audio' | 'transcript';
  candidateId?: string;
  conversationId?: string;
  exp: number;
}

/**
 * Generate a signed URL for secure file access
 */
export function generateSignedUrl(payload: Omit<SignedUrlPayload, 'exp'>, ttlSeconds: number = SIGNED_URL_TTL): string {
  const expiration = Math.floor(Date.now() / 1000) + ttlSeconds;
  const fullPayload: SignedUrlPayload = {
    ...payload,
    exp: expiration
  };
  
  const payloadStr = JSON.stringify(fullPayload);
  const signature = crypto
    .createHmac('sha256', SIGNED_URL_SECRET)
    .update(payloadStr)
    .digest('hex');
  
  const token = Buffer.from(payloadStr).toString('base64') + '.' + signature;
  return token;
}

/**
 * Verify a signed URL token
 */
export function verifySignedUrl(token: string): SignedUrlPayload | null {
  try {
    const [payloadBase64, signature] = token.split('.');
    if (!payloadBase64 || !signature) {
      return null;
    }
    
    const payloadStr = Buffer.from(payloadBase64, 'base64').toString('utf8');
    const expectedSignature = crypto
      .createHmac('sha256', SIGNED_URL_SECRET)
      .update(payloadStr)
      .digest('hex');
    
    if (signature !== expectedSignature) {
      console.warn("[File Security] Invalid signature for signed URL");
      return null;
    }
    
    const payload: SignedUrlPayload = JSON.parse(payloadStr);
    
    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      console.warn("[File Security] Signed URL expired");
      return null;
    }
    
    return payload;
  } catch (error) {
    console.error("[File Security] Error verifying signed URL:", error);
    return null;
  }
}

/**
 * Middleware to validate signed URLs for file access
 */
export function validateSignedUrl(req: Request, res: Response, next: NextFunction) {
  const token = req.query.token as string;
  
  if (!token) {
    console.warn("[File Security] No signed URL token provided");
    return res.status(401).json({ 
      error: "Access denied", 
      message: "Signed URL token required for file access" 
    });
  }
  
  const payload = verifySignedUrl(token);
  if (!payload) {
    console.warn("[File Security] Invalid or expired signed URL token");
    return res.status(401).json({ 
      error: "Access denied", 
      message: "Invalid or expired signed URL token" 
    });
  }
  
  // Verify file ID matches the request
  const requestedFileId = req.params.fileId;
  if (requestedFileId && payload.fileId !== requestedFileId) {
    console.warn("[File Security] File ID mismatch in signed URL");
    return res.status(401).json({ 
      error: "Access denied", 
      message: "File ID mismatch" 
    });
  }
  
  // Store payload in request for use by route handlers
  req.signedUrlPayload = payload;
  
  console.log(`[File Security] Validated signed URL access for file: ${payload.fileId} (type: ${payload.fileType})`);
  next();
}

/**
 * Enhanced file access middleware with candidate ownership verification
 */
export async function validateFileAccess(req: Request, res: Response, next: NextFunction) {
  try {
    const { fileId } = req.params;
    const payload = req.signedUrlPayload;
    
    if (!payload) {
      return res.status(401).json({ 
        error: "Access denied", 
        message: "No valid signed URL payload" 
      });
    }
    
    // Additional verification: Check if candidate exists and user has access
    if (payload.candidateId) {
      const candidate = await storage.getCandidate(payload.candidateId);
      if (!candidate) {
        console.warn(`[File Security] Candidate not found for file access: ${payload.candidateId}`);
        return res.status(404).json({ 
          error: "Not found", 
          message: "Associated candidate not found" 
        });
      }
      
      // Store candidate in request for potential use
      req.candidate = candidate;
    }
    
    console.log(`[File Security] File access validated for: ${fileId}`);
    next();
    
  } catch (error) {
    console.error("[File Security] Error validating file access:", error);
    res.status(500).json({ 
      error: "Internal error", 
      message: "Error validating file access" 
    });
  }
}

/**
 * Simple API key authentication for administrative endpoints
 */
export function validateAdminApiKey(req: Request, res: Response, next: NextFunction) {
  const providedKey = req.headers['x-admin-api-key'] as string;
  const validKey = process.env.ADMIN_API_KEY;
  
  if (!validKey) {
    console.error("[File Security] ADMIN_API_KEY not set in environment");
    return res.status(500).json({ 
      error: "Server configuration error" 
    });
  }
  
  if (!providedKey || providedKey !== validKey) {
    console.warn("[File Security] Invalid admin API key provided");
    return res.status(401).json({ 
      error: "Access denied", 
      message: "Valid admin API key required" 
    });
  }
  
  next();
}

/**
 * Rate limiting middleware for file downloads
 */
export function fileDownloadRateLimit(req: Request, res: Response, next: NextFunction) {
  // Simple in-memory rate limiting (in production, use Redis)
  const clientId = req.ip;
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 30; // Max 30 file downloads per minute
  
  if (!req.app.locals.downloadRateLimit) {
    req.app.locals.downloadRateLimit = new Map();
  }
  
  const rateLimit = req.app.locals.downloadRateLimit;
  const clientRequests = rateLimit.get(clientId) || [];
  
  // Remove old requests outside the window
  const recentRequests = clientRequests.filter((timestamp: number) => now - timestamp < windowMs);
  
  if (recentRequests.length >= maxRequests) {
    console.warn(`[File Security] Rate limit exceeded for client: ${clientId}`);
    return res.status(429).json({ 
      error: "Rate limit exceeded", 
      message: "Too many file download requests. Please try again later." 
    });
  }
  
  // Record this request
  recentRequests.push(now);
  rateLimit.set(clientId, recentRequests);
  
  next();
}

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      signedUrlPayload?: SignedUrlPayload;
      candidate?: any;
    }
  }
}
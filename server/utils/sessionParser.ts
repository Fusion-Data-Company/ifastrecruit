import { Pool } from '@neondatabase/serverless';
import { IncomingMessage } from 'http';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

interface SessionData {
  passport?: {
    user?: {
      claims?: {
        sub?: string;
        email?: string;
      };
      expires_at?: number;
    };
  };
}

/**
 * Extracts session ID from cookie header
 * Format: connect.sid=s%3A<sessionId>.<signature>
 */
export function extractSessionId(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(';').map(c => c.trim());
  const sessionCookie = cookies.find(c => c.startsWith('connect.sid='));
  
  if (!sessionCookie) {
    return null;
  }

  // Extract the session ID from connect.sid=s%3A<sessionId>.<signature>
  const cookieValue = sessionCookie.split('=')[1];
  if (!cookieValue) {
    return null;
  }

  // Decode URI component and extract session ID
  const decodedValue = decodeURIComponent(cookieValue);
  // Format is s:<sessionId>.<signature>
  const match = decodedValue.match(/^s:([^.]+)\./);
  
  return match ? match[1] : null;
}

/**
 * Validates session against PostgreSQL session store
 * Returns the userId if session is valid and authenticated
 */
export async function validateSessionAndGetUserId(sessionId: string): Promise<string | null> {
  try {
    const result = await pool.query(
      'SELECT sess FROM sessions WHERE sid = $1 AND expire > NOW()',
      [sessionId]
    );

    if (result.rows.length === 0) {
      console.log('[Session Validation] Session not found or expired:', sessionId);
      return null;
    }

    const sessionData: SessionData = result.rows[0].sess;

    // Check if passport user exists and has claims with sub (user ID)
    const userId = sessionData?.passport?.user?.claims?.sub;
    
    if (!userId) {
      console.log('[Session Validation] No user ID in session:', sessionId);
      return null;
    }

    // Check if session is expired based on token expiration
    const expiresAt = sessionData?.passport?.user?.expires_at;
    if (expiresAt) {
      const now = Math.floor(Date.now() / 1000);
      if (now > expiresAt) {
        console.log('[Session Validation] Session token expired:', sessionId);
        return null;
      }
    }

    console.log('[Session Validation] Valid session for user:', userId);
    return userId;
  } catch (error) {
    console.error('[Session Validation] Error validating session:', error);
    return null;
  }
}

/**
 * Validates WebSocket upgrade request and extracts authenticated user ID
 */
export async function validateWebSocketRequest(request: IncomingMessage): Promise<string | null> {
  const cookieHeader = request.headers.cookie;
  const sessionId = extractSessionId(cookieHeader);
  
  if (!sessionId) {
    console.log('[WS Auth] No session cookie found');
    return null;
  }

  return await validateSessionAndGetUserId(sessionId);
}

import { storage } from "../storage";

// Poison message configuration
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = [1000, 5000, 15000]; // 1s, 5s, 15s
const POISON_MESSAGE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

export interface PoisonMessage {
  conversationId: string;
  attempts: number;
  firstFailureAt: Date;
  lastFailureAt: Date;
  lastError: string;
  errorType: 'duplicate_email' | 'insufficient_data' | 'processing_error' | 'unknown';
  isPoisoned: boolean;
  nextRetryAt?: Date;
}

export interface RetryResult {
  shouldRetry: boolean;
  waitTimeMs?: number;
  reason: string;
}

export class ElevenLabsPoisonHandler {
  private poisonMessages = new Map<string, PoisonMessage>();
  private broadcastSSE: ((event: string, data: any) => void) | null = null;

  constructor() {
    console.log(`[Poison Handler] Service initialized with max ${MAX_RETRY_ATTEMPTS} retry attempts`);
    
    // Clean up old poison messages periodically
    setInterval(() => {
      this.cleanupOldPoisonMessages();
    }, 60 * 60 * 1000); // Every hour
  }

  // Set SSE broadcast function for real-time updates
  setBroadcastFunction(broadcastFn: (event: string, data: any) => void) {
    this.broadcastSSE = broadcastFn;
  }

  /**
   * Determine error type from error message
   */
  private categorizeError(error: string): PoisonMessage['errorType'] {
    if (error.includes('duplicate key value violates unique constraint') && error.includes('email')) {
      return 'duplicate_email';
    }
    if (error.includes('Insufficient data for candidate creation')) {
      return 'insufficient_data';
    }
    if (error.includes('Processing error') || error.includes('Failed to process')) {
      return 'processing_error';
    }
    return 'unknown';
  }

  /**
   * Check if a conversation should be retried or is poisoned
   */
  shouldRetryConversation(conversationId: string, error: string): RetryResult {
    const now = new Date();
    let poisonMessage = this.poisonMessages.get(conversationId);

    if (!poisonMessage) {
      // First failure - always retry
      poisonMessage = {
        conversationId,
        attempts: 1,
        firstFailureAt: now,
        lastFailureAt: now,
        lastError: error,
        errorType: this.categorizeError(error),
        isPoisoned: false,
        nextRetryAt: new Date(now.getTime() + RETRY_BACKOFF_MS[0])
      };
      
      this.poisonMessages.set(conversationId, poisonMessage);
      
      console.log(`[Poison Handler] First failure for conversation ${conversationId}: ${error}`);
      
      return {
        shouldRetry: true,
        waitTimeMs: RETRY_BACKOFF_MS[0],
        reason: `First failure, will retry in ${RETRY_BACKOFF_MS[0]}ms`
      };
    }

    // Update existing poison message
    poisonMessage.attempts++;
    poisonMessage.lastFailureAt = now;
    poisonMessage.lastError = error;
    poisonMessage.errorType = this.categorizeError(error);

    // Check if we've exceeded max attempts
    if (poisonMessage.attempts > MAX_RETRY_ATTEMPTS) {
      poisonMessage.isPoisoned = true;
      poisonMessage.nextRetryAt = undefined;
      
      console.warn(`[Poison Handler] Conversation ${conversationId} marked as POISONED after ${poisonMessage.attempts} attempts`);
      console.warn(`[Poison Handler] First failure: ${poisonMessage.firstFailureAt.toISOString()}, Error type: ${poisonMessage.errorType}`);
      
      // Broadcast poison message event
      if (this.broadcastSSE) {
        this.broadcastSSE("conversation-poisoned", {
          conversationId,
          attempts: poisonMessage.attempts,
          errorType: poisonMessage.errorType,
          firstFailureAt: poisonMessage.firstFailureAt,
          lastError: error
        });
      }
      
      return {
        shouldRetry: false,
        reason: `Conversation poisoned after ${poisonMessage.attempts} attempts`
      };
    }

    // Calculate next retry time with exponential backoff
    const backoffIndex = Math.min(poisonMessage.attempts - 1, RETRY_BACKOFF_MS.length - 1);
    const waitTimeMs = RETRY_BACKOFF_MS[backoffIndex];
    poisonMessage.nextRetryAt = new Date(now.getTime() + waitTimeMs);

    console.warn(`[Poison Handler] Conversation ${conversationId} failed ${poisonMessage.attempts} times, will retry in ${waitTimeMs}ms`);

    return {
      shouldRetry: true,
      waitTimeMs,
      reason: `Retry attempt ${poisonMessage.attempts}/${MAX_RETRY_ATTEMPTS} in ${waitTimeMs}ms`
    };
  }

  /**
   * Mark a conversation as successfully processed (remove from poison tracking)
   */
  markConversationSuccess(conversationId: string): void {
    const poisonMessage = this.poisonMessages.get(conversationId);
    
    if (poisonMessage) {
      console.log(`[Poison Handler] Conversation ${conversationId} successfully processed after ${poisonMessage.attempts} attempt(s)`);
      this.poisonMessages.delete(conversationId);
      
      // Broadcast recovery event
      if (this.broadcastSSE) {
        this.broadcastSSE("conversation-recovered", {
          conversationId,
          attempts: poisonMessage.attempts,
          firstFailureAt: poisonMessage.firstFailureAt,
          recoveredAt: new Date()
        });
      }
    }
  }

  /**
   * Check if a conversation is ready to be retried
   */
  isReadyForRetry(conversationId: string): boolean {
    const poisonMessage = this.poisonMessages.get(conversationId);
    
    if (!poisonMessage || poisonMessage.isPoisoned) {
      return false;
    }
    
    if (!poisonMessage.nextRetryAt) {
      return true; // Can retry immediately
    }
    
    return new Date() >= poisonMessage.nextRetryAt;
  }

  /**
   * Get all poison messages for monitoring
   */
  getPoisonMessages(): PoisonMessage[] {
    return Array.from(this.poisonMessages.values());
  }

  /**
   * Get poison message statistics
   */
  getPoisonStats(): {
    totalFailed: number;
    poisoned: number;
    awaitingRetry: number;
    byErrorType: Record<string, number>;
  } {
    const messages = this.getPoisonMessages();
    
    const stats = {
      totalFailed: messages.length,
      poisoned: messages.filter(m => m.isPoisoned).length,
      awaitingRetry: messages.filter(m => !m.isPoisoned && this.isReadyForRetry(m.conversationId)).length,
      byErrorType: {} as Record<string, number>
    };
    
    // Count by error type
    messages.forEach(message => {
      stats.byErrorType[message.errorType] = (stats.byErrorType[message.errorType] || 0) + 1;
    });
    
    return stats;
  }

  /**
   * Manually retry a poisoned conversation (admin function)
   */
  manualRetryConversation(conversationId: string): boolean {
    const poisonMessage = this.poisonMessages.get(conversationId);
    
    if (!poisonMessage) {
      console.warn(`[Poison Handler] No poison record found for conversation ${conversationId}`);
      return false;
    }
    
    if (!poisonMessage.isPoisoned) {
      console.warn(`[Poison Handler] Conversation ${conversationId} is not poisoned`);
      return false;
    }
    
    // Reset poison status for manual retry
    poisonMessage.isPoisoned = false;
    poisonMessage.attempts = 0;
    poisonMessage.nextRetryAt = new Date();
    
    console.log(`[Poison Handler] Manually resetting poison status for conversation ${conversationId}`);
    
    return true;
  }

  /**
   * Clean up old poison messages that have exceeded TTL
   */
  private cleanupOldPoisonMessages(): void {
    const now = new Date();
    const cutoffTime = new Date(now.getTime() - POISON_MESSAGE_TTL);
    let cleanedCount = 0;
    
    for (const [conversationId, poisonMessage] of this.poisonMessages.entries()) {
      if (poisonMessage.firstFailureAt < cutoffTime) {
        this.poisonMessages.delete(conversationId);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`[Poison Handler] Cleaned up ${cleanedCount} old poison messages`);
    }
  }

  /**
   * Clear all poison messages (admin function)
   */
  clearAllPoisonMessages(): number {
    const count = this.poisonMessages.size;
    this.poisonMessages.clear();
    console.log(`[Poison Handler] Cleared ${count} poison messages`);
    return count;
  }

  /**
   * Force mark a conversation as poisoned (admin function)
   */
  forceMarkAsPoisoned(conversationId: string, reason: string): void {
    const now = new Date();
    const poisonMessage: PoisonMessage = {
      conversationId,
      attempts: MAX_RETRY_ATTEMPTS + 1,
      firstFailureAt: now,
      lastFailureAt: now,
      lastError: reason,
      errorType: 'unknown',
      isPoisoned: true
    };
    
    this.poisonMessages.set(conversationId, poisonMessage);
    console.warn(`[Poison Handler] Manually marked conversation ${conversationId} as poisoned: ${reason}`);
  }

  /**
   * Get conversations that are ready to retry
   */
  getConversationsReadyForRetry(): string[] {
    return Array.from(this.poisonMessages.entries())
      .filter(([conversationId, _]) => this.isReadyForRetry(conversationId))
      .map(([conversationId, _]) => conversationId);
  }
}

// Export singleton instance
export const elevenLabsPoisonHandler = new ElevenLabsPoisonHandler();
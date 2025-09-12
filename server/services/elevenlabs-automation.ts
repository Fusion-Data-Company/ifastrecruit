import { elevenlabsIntegration } from "../integrations/elevenlabs";
import { storage } from "../storage";
import { elevenLabsAgent } from "./elevenlabs-agent";
import { elevenLabsPoisonHandler } from "./elevenlabs-poison-handler";

// The specific authorized ElevenLabs agent ID that we monitor
const AUTHORIZED_AGENT_ID = "agent_0601k4t9d82qe5ybsgkngct0zzkm";

// Polling interval in milliseconds (5 minutes)
const POLLING_INTERVAL = 5 * 60 * 1000;

export class ElevenLabsAutomationService {
  private isPolling = false;
  private pollingTimer: NodeJS.Timeout | null = null;
  private broadcastSSE: ((event: string, data: any) => void) | null = null;

  constructor() {
    console.log(`[ElevenLabs Automation] Service initialized for agent: ${AUTHORIZED_AGENT_ID}`);
  }

  // Set SSE broadcast function for real-time updates
  setBroadcastFunction(broadcastFn: (event: string, data: any) => void) {
    this.broadcastSSE = broadcastFn;
  }

  // Start automated polling for new conversations
  async startPolling(): Promise<void> {
    if (this.isPolling) {
      console.log(`[ElevenLabs Automation] Already polling - skipping start`);
      return;
    }

    console.log(`[ElevenLabs Automation] Starting automated polling every ${POLLING_INTERVAL / 1000} seconds`);
    this.isPolling = true;

    // Initialize tracking record if it doesn't exist
    await this.initializeTracking();

    // Start the polling loop
    this.pollingTimer = setInterval(async () => {
      try {
        await this.pollForNewConversations();
      } catch (error) {
        console.error(`[ElevenLabs Automation] Polling error:`, error);
        await this.updateTrackingError(String(error));
      }
    }, POLLING_INTERVAL);

    // Run initial poll immediately
    setTimeout(async () => {
      try {
        await this.pollForNewConversations();
      } catch (error) {
        console.error(`[ElevenLabs Automation] Initial poll error:`, error);
        await this.updateTrackingError(String(error));
      }
    }, 5000); // Wait 5 seconds for system to be ready

    console.log(`[ElevenLabs Automation] Polling started successfully`);
  }

  // Stop automated polling
  stopPolling(): void {
    if (!this.isPolling) {
      return;
    }

    console.log(`[ElevenLabs Automation] Stopping automated polling`);
    this.isPolling = false;

    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }

    console.log(`[ElevenLabs Automation] Polling stopped`);
  }

  // Initialize tracking record for the authorized agent
  private async initializeTracking(): Promise<void> {
    try {
      let tracking = await storage.getElevenLabsTracking(AUTHORIZED_AGENT_ID);
      
      if (!tracking) {
        console.log(`[ElevenLabs Automation] Creating initial tracking record for agent: ${AUTHORIZED_AGENT_ID}`);
        tracking = await storage.createElevenLabsTracking({
          agentId: AUTHORIZED_AGENT_ID,
          lastProcessedAt: new Date(),
          totalProcessed: 0,
          isActive: true
        });
        console.log(`[ElevenLabs Automation] Tracking record created:`, tracking.id);
      } else {
        console.log(`[ElevenLabs Automation] Found existing tracking record:`, tracking.id);
      }

      // Broadcast tracking status
      if (this.broadcastSSE) {
        this.broadcastSSE("elevenlabs-tracking-status", {
          agentId: AUTHORIZED_AGENT_ID,
          isActive: tracking.isActive,
          totalProcessed: tracking.totalProcessed,
          lastProcessedAt: tracking.lastProcessedAt
        });
      }
    } catch (error) {
      console.error(`[ElevenLabs Automation] Failed to initialize tracking:`, error);
      throw error;
    }
  }

  // Poll for new conversations and process them
  private async pollForNewConversations(): Promise<void> {
    console.log(`[ElevenLabs Automation] Polling for new conversations...`);

    try {
      // Get current tracking state
      const tracking = await storage.getElevenLabsTracking(AUTHORIZED_AGENT_ID);
      if (!tracking || !tracking.isActive) {
        console.log(`[ElevenLabs Automation] Tracking disabled or not found - skipping poll`);
        return;
      }

      // Get conversations since last processed time
      const since = tracking.lastProcessedAt.toISOString();
      console.log(`[ElevenLabs Automation] Looking for conversations after: ${since}`);

      const conversationsResponse = await elevenlabsIntegration.getAgentConversations(AUTHORIZED_AGENT_ID, {
        limit: 50,
        after: since
      });

      const newConversations = conversationsResponse.conversations || [];
      console.log(`[ElevenLabs Automation] Found ${newConversations.length} new conversations`);

      if (newConversations.length === 0) {
        console.log(`[ElevenLabs Automation] No new conversations to process`);
        return;
      }

      let processedCount = 0;
      let lastConversationId = tracking.lastConversationId;
      let latestProcessedAt = tracking.lastProcessedAt;

      // Process each new conversation using the new agent service
      for (const conversation of newConversations) {
        try {
          console.log(`[ElevenLabs Automation] Processing conversation: ${conversation.conversation_id}`);

          // Use the new ElevenLabs agent to process the conversation directly
          const result = await elevenLabsAgent.processConversation(conversation.conversation_id);
          
          if (result.success) {
            console.log(`[ElevenLabs Automation] Successfully processed conversation: ${conversation.conversation_id}`);
            processedCount++;
            lastConversationId = conversation.conversation_id;
            
            // Update latest processed time
            const conversationTime = new Date(conversation.created_at || conversation.ended_at || Date.now());
            if (conversationTime > latestProcessedAt) {
              latestProcessedAt = conversationTime;
            }

            // Broadcast new candidate created
            if (this.broadcastSSE && result.candidate) {
              this.broadcastSSE("candidate-created", {
                id: result.candidate.id,
                name: result.candidate.name,
                email: result.candidate.email,
                pipelineStage: result.candidate.pipelineStage,
                source: 'ElevenLabs',
                conversationId: conversation.conversation_id,
                action: result.action,
                timestamp: new Date().toISOString()
              });
            }

          } else {
            // Handle failed processing with poison message detection
            const retryResult = elevenLabsPoisonHandler.shouldRetryConversation(
              conversation.conversation_id, 
              result.error || 'Unknown processing error'
            );
            
            if (retryResult.shouldRetry) {
              console.warn(`[ElevenLabs Automation] Will retry conversation: ${conversation.conversation_id} - ${retryResult.reason}`);
            } else {
              console.error(`[ElevenLabs Automation] Conversation marked as poisoned: ${conversation.conversation_id} - ${retryResult.reason}`);
            }
          }

        } catch (conversationError) {
          // Handle processing exceptions with poison message detection  
          const errorMessage = conversationError instanceof Error ? conversationError.message : String(conversationError);
          const retryResult = elevenLabsPoisonHandler.shouldRetryConversation(
            conversation.conversation_id, 
            errorMessage
          );
          
          if (retryResult.shouldRetry) {
            console.warn(`[ElevenLabs Automation] Will retry after error: ${conversation.conversation_id} - ${retryResult.reason}`);
          } else {
            console.error(`[ElevenLabs Automation] Conversation poisoned after error: ${conversation.conversation_id} - ${retryResult.reason}`);
          }
          
          // Continue with next conversation instead of failing the entire batch
        }
      }

      // Update tracking with progress
      await storage.updateElevenLabsTracking(AUTHORIZED_AGENT_ID, {
        lastProcessedAt: latestProcessedAt,
        lastConversationId,
        totalProcessed: (tracking.totalProcessed || 0) + processedCount,
        lastError: null,
        lastErrorAt: null
      });

      console.log(`[ElevenLabs Automation] Successfully processed ${processedCount} new conversations`);

      // Broadcast automation status update
      if (this.broadcastSSE) {
        this.broadcastSSE("elevenlabs-automation-update", {
          agentId: AUTHORIZED_AGENT_ID,
          newConversations: processedCount,
          totalProcessed: (tracking.totalProcessed || 0) + processedCount,
          lastProcessedAt: latestProcessedAt,
          timestamp: new Date().toISOString()
        });
      }

    } catch (error) {
      console.error(`[ElevenLabs Automation] Polling failed:`, error);
      await this.updateTrackingError(String(error));
      throw error;
    }
  }

  // Update tracking with error information
  private async updateTrackingError(error: string): Promise<void> {
    try {
      await storage.updateElevenLabsTracking(AUTHORIZED_AGENT_ID, {
        lastError: error,
        lastErrorAt: new Date()
      });

      // Broadcast error
      if (this.broadcastSSE) {
        this.broadcastSSE("elevenlabs-automation-error", {
          agentId: AUTHORIZED_AGENT_ID,
          error,
          timestamp: new Date().toISOString()
        });
      }
    } catch (updateError) {
      console.error(`[ElevenLabs Automation] Failed to update tracking error:`, updateError);
    }
  }

  // Helper methods for data processing
  private calculateDuration(details: any): string {
    if (details.created_at && details.ended_at) {
      const start = new Date(details.created_at);
      const end = new Date(details.ended_at);
      const durationMs = end.getTime() - start.getTime();
      const minutes = Math.floor(durationMs / 60000);
      const seconds = Math.floor((durationMs % 60000) / 1000);
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    return "Unknown";
  }

  private parseDurationSeconds(details: any): number {
    if (details.created_at && details.ended_at) {
      const start = new Date(details.created_at);
      const end = new Date(details.ended_at);
      return Math.floor((end.getTime() - start.getTime()) / 1000);
    }
    return 0;
  }

  private generateSummary(details: any): string {
    if (details.transcript && Array.isArray(details.transcript)) {
      const messages = details.transcript.slice(0, 3).map((msg: any) => 
        `${msg.role}: ${(msg.content || msg.message || '').substring(0, 100)}...`
      ).join('\n');
      return `Automated interview conversation with ${details.transcript.length} exchanges:\n${messages}`;
    }
    return "Automated interview conversation processed";
  }

  private generateTranscriptSummary(details: any): string {
    if (details.transcript && Array.isArray(details.transcript)) {
      return `Interview transcript with ${details.transcript.length} message exchanges`;
    }
    return "Interview transcript available";
  }

  // Get current automation status
  async getStatus(): Promise<{
    isPolling: boolean;
    agentId: string;
    tracking?: any;
  }> {
    const tracking = await storage.getElevenLabsTracking(AUTHORIZED_AGENT_ID);
    return {
      isPolling: this.isPolling,
      agentId: AUTHORIZED_AGENT_ID,
      tracking
    };
  }

  // Manual trigger for testing
  async triggerManualPoll(): Promise<void> {
    console.log(`[ElevenLabs Automation] Manual poll triggered`);
    await this.pollForNewConversations();
  }
}

// Export singleton instance
export const elevenLabsAutomation = new ElevenLabsAutomationService();
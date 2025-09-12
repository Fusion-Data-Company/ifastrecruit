import { elevenlabsIntegration } from "../integrations/elevenlabs";
import { storage } from "../storage";
import { elevenLabsAgent } from "./elevenlabs-agent";

// The specific authorized ElevenLabs agent ID that we monitor
const AUTHORIZED_AGENT_ID = "agent_0601k4t9d82qe5ybsgkngct0zzkm";

export interface SyncVerificationResult {
  status: 'synced' | 'partial' | 'out_of_sync';
  totalElevenLabsConversations: number;
  totalLocalCandidates: number;
  missingCandidates: string[]; // conversation IDs without candidates
  duplicateCandidates: string[]; // conversation IDs with multiple candidates  
  invalidCandidates: string[]; // candidates with data issues
  lastSuccessfulSyncAt: Date | null;
  syncHealth: 'healthy' | 'degraded' | 'critical';
  details: any;
}

export interface ReconciliationOptions {
  startDate?: Date;
  endDate?: Date;
  dryRun?: boolean;
  maxConversations?: number;
  skipProcessed?: boolean;
}

export interface BackfillResult {
  success: boolean;
  processedCount: number;
  createdCount: number;
  updatedCount: number;
  failedCount: number;
  skippedCount: number;
  errors: string[];
  details: any;
}

export interface GapAnalysis {
  missingConversations: string[];
  orphanedCandidates: string[];
  duplicateConversations: string[];
  dataInconsistencies: {
    conversationId: string;
    issue: string;
    localData: any;
    elevenLabsData: any;
  }[];
}

export class ElevenLabsReconciliationService {
  private broadcastSSE: ((event: string, data: any) => void) | null = null;

  constructor() {
    console.log(`[ElevenLabs Reconciliation] Service initialized for agent: ${AUTHORIZED_AGENT_ID}`);
  }

  // Set SSE broadcast function for real-time updates
  setBroadcastFunction(broadcastFn: (event: string, data: any) => void) {
    this.broadcastSSE = broadcastFn;
  }

  /**
   * Comprehensive sync verification - checks consistency between ElevenLabs and local data
   */
  async verifySyncStatus(): Promise<SyncVerificationResult> {
    console.log(`[ElevenLabs Reconciliation] Starting comprehensive sync verification...`);

    try {
      // Get tracking record to check sync health
      const tracking = await storage.getElevenLabsTracking(AUTHORIZED_AGENT_ID);
      const lastSuccessfulSyncAt = tracking?.lastProcessedAt || null;

      // Get all conversations from ElevenLabs (last 30 days to avoid overwhelming)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      console.log(`[ElevenLabs Reconciliation] Fetching conversations from ElevenLabs since: ${thirtyDaysAgo.toISOString()}`);
      
      const conversationsResponse = await elevenlabsIntegration.getAgentConversations(AUTHORIZED_AGENT_ID, {
        limit: 1000,
        after: thirtyDaysAgo.toISOString()
      });

      const elevenLabsConversations = conversationsResponse.conversations || [];
      console.log(`[ElevenLabs Reconciliation] Found ${elevenLabsConversations.length} ElevenLabs conversations`);

      // Get all local candidates with conversation IDs
      const localCandidates = await storage.getCandidates(1, 1000);
      const candidatesWithConversations = localCandidates.filter(c => c.conversationId);
      
      console.log(`[ElevenLabs Reconciliation] Found ${candidatesWithConversations.length} local candidates with conversation IDs`);

      // Create lookup maps
      const elevenLabsMap = new Map(elevenLabsConversations.map(c => [c.conversation_id, c]));
      const localCandidateMap = new Map(candidatesWithConversations.map(c => [c.conversationId!, c]));

      // Find missing candidates (conversations in ElevenLabs but no local candidate)
      const missingCandidates = elevenLabsConversations
        .filter(c => !localCandidateMap.has(c.conversation_id))
        .map(c => c.conversation_id);

      // Find orphaned candidates (local candidates without ElevenLabs conversation)
      const orphanedCandidates = candidatesWithConversations
        .filter(c => !elevenLabsMap.has(c.conversationId!))
        .map(c => c.conversationId!);

      // Check for duplicates (multiple candidates with same conversation ID)
      const conversationIdCounts = new Map<string, number>();
      candidatesWithConversations.forEach(c => {
        const count = conversationIdCounts.get(c.conversationId!) || 0;
        conversationIdCounts.set(c.conversationId!, count + 1);
      });
      
      const duplicateCandidates = Array.from(conversationIdCounts.entries())
        .filter(([_, count]) => count > 1)
        .map(([conversationId, _]) => conversationId);

      // Check for invalid candidates (data quality issues)
      const invalidCandidates = candidatesWithConversations
        .filter(c => !c.email || !c.name || c.email === 'unknown@email.com')
        .map(c => c.conversationId!);

      // Determine sync status
      const totalElevenLabsConversations = elevenLabsConversations.length;
      const totalLocalCandidates = candidatesWithConversations.length;
      const issueCount = missingCandidates.length + orphanedCandidates.length + duplicateCandidates.length + invalidCandidates.length;
      
      let status: 'synced' | 'partial' | 'out_of_sync';
      let syncHealth: 'healthy' | 'degraded' | 'critical';

      if (issueCount === 0) {
        status = 'synced';
        syncHealth = 'healthy';
      } else if (issueCount < totalElevenLabsConversations * 0.05) { // Less than 5% issues
        status = 'partial';
        syncHealth = 'degraded';
      } else {
        status = 'out_of_sync';
        syncHealth = 'critical';
      }

      const result: SyncVerificationResult = {
        status,
        totalElevenLabsConversations,
        totalLocalCandidates,
        missingCandidates,
        duplicateCandidates,
        invalidCandidates,
        lastSuccessfulSyncAt,
        syncHealth,
        details: {
          orphanedCandidates,
          conversationIdCounts: Object.fromEntries(conversationIdCounts),
          tracking: tracking ? {
            totalProcessed: tracking.totalProcessed,
            lastProcessedAt: tracking.lastProcessedAt,
            isActive: tracking.isActive
          } : null
        }
      };

      console.log(`[ElevenLabs Reconciliation] Sync verification complete: ${status} (${syncHealth})`);
      console.log(`[ElevenLabs Reconciliation] Issues found: ${issueCount} (${missingCandidates.length} missing, ${duplicateCandidates.length} duplicates, ${invalidCandidates.length} invalid)`);

      // Broadcast sync status
      if (this.broadcastSSE) {
        this.broadcastSSE("sync-verification-complete", {
          ...result,
          timestamp: new Date().toISOString()
        });
      }

      return result;

    } catch (error) {
      console.error(`[ElevenLabs Reconciliation] Sync verification failed:`, error);
      
      const errorResult: SyncVerificationResult = {
        status: 'out_of_sync',
        totalElevenLabsConversations: 0,
        totalLocalCandidates: 0,
        missingCandidates: [],
        duplicateCandidates: [],
        invalidCandidates: [],
        lastSuccessfulSyncAt: null,
        syncHealth: 'critical',
        details: { error: String(error) }
      };

      if (this.broadcastSSE) {
        this.broadcastSSE("sync-verification-error", {
          error: String(error),
          timestamp: new Date().toISOString()
        });
      }

      return errorResult;
    }
  }

  /**
   * Perform full backfill of conversations from ElevenLabs
   */
  async performBackfill(options: ReconciliationOptions = {}): Promise<BackfillResult> {
    console.log(`[ElevenLabs Reconciliation] Starting backfill operation...`);
    
    const {
      startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days ago
      endDate = new Date(),
      dryRun = false,
      maxConversations = 1000,
      skipProcessed = true
    } = options;

    console.log(`[ElevenLabs Reconciliation] Backfill options: ${startDate.toISOString()} to ${endDate.toISOString()}, max: ${maxConversations}, dryRun: ${dryRun}`);

    try {
      let allConversations: any[] = [];
      let after = startDate.toISOString();
      let hasMore = true;

      // Fetch all conversations in batches
      while (hasMore && allConversations.length < maxConversations) {
        const response = await elevenlabsIntegration.getAgentConversations(AUTHORIZED_AGENT_ID, {
          limit: 100,
          after: after,
          before: endDate.toISOString()
        });

        const conversations = response.conversations || [];
        
        if (conversations.length === 0) {
          hasMore = false;
          break;
        }

        allConversations.push(...conversations);
        
        // Update after to the last conversation's timestamp
        const lastConversation = conversations[conversations.length - 1];
        after = lastConversation.ended_at || lastConversation.created_at || after;
        
        console.log(`[ElevenLabs Reconciliation] Fetched ${allConversations.length} conversations so far...`);
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      console.log(`[ElevenLabs Reconciliation] Total conversations to process: ${allConversations.length}`);

      if (dryRun) {
        console.log(`[ElevenLabs Reconciliation] Dry run mode - no changes will be made`);
        return {
          success: true,
          processedCount: allConversations.length,
          createdCount: 0,
          updatedCount: 0,
          failedCount: 0,
          skippedCount: 0,
          errors: [],
          details: { dryRun: true, conversations: allConversations.map(c => c.conversation_id) }
        };
      }

      let processedCount = 0;
      let createdCount = 0;
      let updatedCount = 0;
      let failedCount = 0;
      let skippedCount = 0;
      const errors: string[] = [];

      // Process each conversation
      for (const conversation of allConversations) {
        try {
          // Check if we should skip already processed conversations
          if (skipProcessed) {
            const existing = await storage.getCandidateByConversationId(conversation.conversation_id);
            if (existing) {
              skippedCount++;
              console.log(`[ElevenLabs Reconciliation] Skipping already processed conversation: ${conversation.conversation_id}`);
              continue;
            }
          }

          console.log(`[ElevenLabs Reconciliation] Processing conversation: ${conversation.conversation_id}`);

          // Process the conversation using the agent service
          const result = await elevenLabsAgent.processConversation(conversation.conversation_id);

          if (result.success) {
            processedCount++;
            if (result.action === 'created') {
              createdCount++;
            } else if (result.action === 'updated') {
              updatedCount++;
            }

            console.log(`[ElevenLabs Reconciliation] Successfully ${result.action} candidate for conversation: ${conversation.conversation_id}`);
          } else {
            failedCount++;
            const error = `Failed to process conversation ${conversation.conversation_id}: ${result.error}`;
            errors.push(error);
            console.warn(`[ElevenLabs Reconciliation] ${error}`);
          }

          // Broadcast progress every 10 conversations
          if (processedCount % 10 === 0 && this.broadcastSSE) {
            this.broadcastSSE("backfill-progress", {
              processed: processedCount,
              total: allConversations.length,
              created: createdCount,
              updated: updatedCount,
              failed: failedCount,
              skipped: skippedCount
            });
          }

        } catch (error) {
          failedCount++;
          const errorMsg = `Error processing conversation ${conversation.conversation_id}: ${error}`;
          errors.push(errorMsg);
          console.error(`[ElevenLabs Reconciliation] ${errorMsg}`);
        }
      }

      const result: BackfillResult = {
        success: failedCount < allConversations.length / 2, // Success if less than 50% failed
        processedCount,
        createdCount,
        updatedCount,
        failedCount,
        skippedCount,
        errors,
        details: {
          totalConversations: allConversations.length,
          startDate,
          endDate,
          options
        }
      };

      console.log(`[ElevenLabs Reconciliation] Backfill complete: ${processedCount} processed, ${createdCount} created, ${updatedCount} updated, ${failedCount} failed, ${skippedCount} skipped`);

      // Broadcast final result
      if (this.broadcastSSE) {
        this.broadcastSSE("backfill-complete", {
          ...result,
          timestamp: new Date().toISOString()
        });
      }

      return result;

    } catch (error) {
      console.error(`[ElevenLabs Reconciliation] Backfill operation failed:`, error);
      
      const errorResult: BackfillResult = {
        success: false,
        processedCount: 0,
        createdCount: 0,
        updatedCount: 0,
        failedCount: 1,
        skippedCount: 0,
        errors: [String(error)],
        details: { error: String(error), options }
      };

      if (this.broadcastSSE) {
        this.broadcastSSE("backfill-error", {
          error: String(error),
          timestamp: new Date().toISOString()
        });
      }

      return errorResult;
    }
  }

  /**
   * Detect gaps between ElevenLabs and local data
   */
  async detectGaps(days: number = 30): Promise<GapAnalysis> {
    console.log(`[ElevenLabs Reconciliation] Detecting gaps for last ${days} days...`);

    try {
      // Get date range
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Get ElevenLabs conversations
      const conversationsResponse = await elevenlabsIntegration.getAgentConversations(AUTHORIZED_AGENT_ID, {
        limit: 1000,
        after: startDate.toISOString()
      });
      const elevenLabsConversations = conversationsResponse.conversations || [];

      // Get local candidates  
      const localCandidates = await storage.getCandidates(1, 1000);
      const recentCandidates = localCandidates.filter(c => 
        c.conversationId && 
        c.interviewDate && 
        c.interviewDate >= startDate
      );

      // Create sets for comparison
      const elevenLabsIds = new Set(elevenLabsConversations.map(c => c.conversation_id));
      const localIds = new Set(recentCandidates.map(c => c.conversationId!));

      // Find gaps
      const missingConversations = elevenLabsConversations
        .filter(c => !localIds.has(c.conversation_id))
        .map(c => c.conversation_id);

      const orphanedCandidates = recentCandidates
        .filter(c => !elevenLabsIds.has(c.conversationId!))
        .map(c => c.conversationId!);

      // Find duplicates
      const conversationCounts = new Map<string, number>();
      recentCandidates.forEach(c => {
        const count = conversationCounts.get(c.conversationId!) || 0;
        conversationCounts.set(c.conversationId!, count + 1);
      });

      const duplicateConversations = Array.from(conversationCounts.entries())
        .filter(([_, count]) => count > 1)
        .map(([id, _]) => id);

      // Detect data inconsistencies by comparing a sample
      const dataInconsistencies: GapAnalysis['dataInconsistencies'] = [];
      
      for (const conversation of elevenLabsConversations.slice(0, 50)) { // Sample first 50
        const candidate = recentCandidates.find(c => c.conversationId === conversation.conversation_id);
        if (candidate) {
          // Check for basic inconsistencies
          if (candidate.callDuration && conversation.call_duration_secs && 
              Math.abs(candidate.callDuration - conversation.call_duration_secs) > 10) {
            dataInconsistencies.push({
              conversationId: conversation.conversation_id,
              issue: 'Call duration mismatch',
              localData: { callDuration: candidate.callDuration },
              elevenLabsData: { call_duration_secs: conversation.call_duration_secs }
            });
          }
        }
      }

      const result: GapAnalysis = {
        missingConversations,
        orphanedCandidates,
        duplicateConversations,
        dataInconsistencies
      };

      console.log(`[ElevenLabs Reconciliation] Gap analysis complete: ${missingConversations.length} missing, ${orphanedCandidates.length} orphaned, ${duplicateConversations.length} duplicates, ${dataInconsistencies.length} inconsistencies`);

      return result;

    } catch (error) {
      console.error(`[ElevenLabs Reconciliation] Gap detection failed:`, error);
      throw error;
    }
  }

  /**
   * Auto-heal detected gaps by processing missing conversations
   */
  async healGaps(gapAnalysis: GapAnalysis): Promise<BackfillResult> {
    console.log(`[ElevenLabs Reconciliation] Auto-healing ${gapAnalysis.missingConversations.length} missing conversations...`);

    const healed = {
      success: true,
      processedCount: 0,
      createdCount: 0,
      updatedCount: 0,
      failedCount: 0,
      skippedCount: 0,
      errors: [] as string[],
      details: { healedGaps: true }
    };

    // Process missing conversations
    for (const conversationId of gapAnalysis.missingConversations) {
      try {
        console.log(`[ElevenLabs Reconciliation] Healing missing conversation: ${conversationId}`);
        
        const result = await elevenLabsAgent.processConversation(conversationId);
        
        if (result.success) {
          healed.processedCount++;
          if (result.action === 'created') {
            healed.createdCount++;
          } else if (result.action === 'updated') {
            healed.updatedCount++;
          }
        } else {
          healed.failedCount++;
          healed.errors.push(`Failed to heal ${conversationId}: ${result.error}`);
        }
        
      } catch (error) {
        healed.failedCount++;
        healed.errors.push(`Error healing ${conversationId}: ${error}`);
      }
    }

    // TODO: Handle duplicates and orphaned candidates
    
    healed.success = healed.failedCount < healed.processedCount / 2;
    
    console.log(`[ElevenLabs Reconciliation] Gap healing complete: ${healed.processedCount} processed, ${healed.createdCount} created, ${healed.failedCount} failed`);
    
    return healed;
  }
}

// Export singleton instance
export const elevenLabsReconciliation = new ElevenLabsReconciliationService();
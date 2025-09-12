import { Router } from "express";
import { elevenLabsReconciliation } from "../services/elevenlabs-reconciliation";
import { elevenLabsPoisonHandler } from "../services/elevenlabs-poison-handler";
import { storage } from "../storage";
import { validateAdminApiKey } from "../middleware/file-security";

export const syncMonitoringRouter = Router();

/**
 * Comprehensive system health dashboard endpoint
 */
syncMonitoringRouter.get("/dashboard", async (req, res) => {
  try {
    // Get sync verification status
    const syncStatus = await elevenLabsReconciliation.verifySyncStatus();
    
    // Get poison message statistics
    const poisonStats = elevenLabsPoisonHandler.getPoisonStats();
    
    // Get tracking information
    const tracking = await storage.getElevenLabsTracking("agent_0601k4t9d82qe5ybsgkngct0zzkm");
    
    // Get database statistics
    const candidates = await storage.getCandidates(1, 1);
    const totalCandidates = candidates.length;
    
    const dashboard = {
      timestamp: new Date().toISOString(),
      
      // Overall system health
      systemHealth: {
        status: syncStatus.syncHealth,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        version: process.version
      },
      
      // Sync health metrics  
      syncMetrics: {
        status: syncStatus.status,
        totalElevenLabsConversations: syncStatus.totalElevenLabsConversations,
        totalLocalCandidates: syncStatus.totalLocalCandidates,
        missingCandidates: syncStatus.missingCandidates.length,
        duplicateCandidates: syncStatus.duplicateCandidates.length,
        invalidCandidates: syncStatus.invalidCandidates.length,
        lastSuccessfulSyncAt: syncStatus.lastSuccessfulSyncAt,
        syncHealthScore: this.calculateSyncHealthScore(syncStatus)
      },
      
      // Automation tracking
      automationMetrics: tracking ? {
        isActive: tracking.isActive,
        totalProcessed: tracking.totalProcessed,
        lastProcessedAt: tracking.lastProcessedAt,
        lastError: tracking.lastError,
        lastErrorAt: tracking.lastErrorAt
      } : null,
      
      // Poison message handling
      poisonMetrics: {
        totalFailed: poisonStats.totalFailed,
        poisoned: poisonStats.poisoned,
        awaitingRetry: poisonStats.awaitingRetry,
        errorBreakdown: poisonStats.byErrorType,
        healthScore: this.calculatePoisonHealthScore(poisonStats)
      },
      
      // Database health
      databaseMetrics: {
        totalCandidates,
        candidatesWithConversationIds: syncStatus.totalLocalCandidates,
        orphanedCandidates: syncStatus.details?.orphanedCandidates?.length || 0
      },
      
      // Issues requiring attention
      alerts: this.generateAlerts(syncStatus, poisonStats, tracking)
    };
    
    res.json(dashboard);
    
  } catch (error) {
    console.error("[Sync Monitoring] Dashboard error:", error);
    res.status(500).json({ 
      error: "Failed to generate dashboard", 
      details: String(error),
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Get poison messages for admin review
 */
syncMonitoringRouter.get("/poison-messages", validateAdminApiKey, (req, res) => {
  try {
    const poisonMessages = elevenLabsPoisonHandler.getPoisonMessages();
    res.json({
      total: poisonMessages.length,
      messages: poisonMessages,
      statistics: elevenLabsPoisonHandler.getPoisonStats()
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to get poison messages" });
  }
});

/**
 * Manually retry a poisoned conversation
 */
syncMonitoringRouter.post("/poison-messages/:conversationId/retry", validateAdminApiKey, (req, res) => {
  try {
    const { conversationId } = req.params;
    const success = elevenLabsPoisonHandler.manualRetryConversation(conversationId);
    
    if (success) {
      res.json({ success: true, message: `Conversation ${conversationId} marked for retry` });
    } else {
      res.status(404).json({ error: "Conversation not found or not poisoned" });
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to retry conversation" });
  }
});

/**
 * Clear all poison messages (admin function)
 */
syncMonitoringRouter.delete("/poison-messages", validateAdminApiKey, (req, res) => {
  try {
    const count = elevenLabsPoisonHandler.clearAllPoisonMessages();
    res.json({ success: true, message: `Cleared ${count} poison messages` });
  } catch (error) {
    res.status(500).json({ error: "Failed to clear poison messages" });
  }
});

/**
 * Get detailed sync verification report
 */
syncMonitoringRouter.get("/sync-report", async (req, res) => {
  try {
    const verification = await elevenLabsReconciliation.verifySyncStatus();
    const gaps = await elevenLabsReconciliation.detectGaps();
    
    res.json({
      verification,
      gaps,
      recommendations: this.generateRecommendations(verification, gaps),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to generate sync report" });
  }
});

/**
 * Auto-heal detected gaps
 */
syncMonitoringRouter.post("/auto-heal", validateAdminApiKey, async (req, res) => {
  try {
    const gaps = await elevenLabsReconciliation.detectGaps();
    const healResult = await elevenLabsReconciliation.healGaps(gaps);
    
    res.json({
      success: healResult.success,
      healed: healResult.processedCount,
      created: healResult.createdCount,
      updated: healResult.updatedCount,
      failed: healResult.failedCount,
      errors: healResult.errors
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to auto-heal gaps" });
  }
});

// Helper methods (would normally be in a separate class)
function calculateSyncHealthScore(syncStatus: any): number {
  const total = syncStatus.totalElevenLabsConversations;
  if (total === 0) return 100;
  
  const issues = syncStatus.missingCandidates.length + 
                 syncStatus.duplicateCandidates.length + 
                 syncStatus.invalidCandidates.length;
  
  return Math.max(0, Math.round((1 - issues / total) * 100));
}

function calculatePoisonHealthScore(poisonStats: any): number {
  const total = poisonStats.totalFailed;
  if (total === 0) return 100;
  
  const poisoned = poisonStats.poisoned;
  return Math.max(0, Math.round((1 - poisoned / total) * 100));
}

function generateAlerts(syncStatus: any, poisonStats: any, tracking: any): any[] {
  const alerts = [];
  
  // Sync health alerts
  if (syncStatus.syncHealth === 'critical') {
    alerts.push({
      type: 'critical',
      title: 'Sync Health Critical',
      message: 'Multiple sync issues detected requiring immediate attention',
      action: 'Run backfill or auto-heal'
    });
  }
  
  // Poison message alerts
  if (poisonStats.poisoned > 5) {
    alerts.push({
      type: 'warning',
      title: 'Multiple Poisoned Messages',
      message: `${poisonStats.poisoned} conversations are repeatedly failing`,
      action: 'Review and manually retry or fix root cause'
    });
  }
  
  // Automation alerts
  if (tracking && tracking.lastError) {
    const errorAge = Date.now() - new Date(tracking.lastErrorAt).getTime();
    if (errorAge < 30 * 60 * 1000) { // 30 minutes
      alerts.push({
        type: 'error',
        title: 'Recent Automation Error',
        message: tracking.lastError,
        action: 'Check automation service health'
      });
    }
  }
  
  return alerts;
}

function generateRecommendations(verification: any, gaps: any): string[] {
  const recommendations = [];
  
  if (gaps.missingConversations.length > 0) {
    recommendations.push(`Run backfill to process ${gaps.missingConversations.length} missing conversations`);
  }
  
  if (gaps.duplicateConversations.length > 0) {
    recommendations.push(`Resolve ${gaps.duplicateConversations.length} duplicate conversations`);
  }
  
  if (verification.invalidCandidates.length > 0) {
    recommendations.push(`Clean up ${verification.invalidCandidates.length} invalid candidates`);
  }
  
  if (verification.syncHealth === 'critical') {
    recommendations.push('Consider running auto-heal to fix detected issues');
  }
  
  return recommendations;
}
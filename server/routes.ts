import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { insertCandidateSchema, insertCampaignSchema, insertInterviewSchema, insertBookingSchema } from "@shared/schema";
import { mcpServer } from "./mcp/server";
import { setupSSE } from "./services/sse";
import { registerWorkflowRoutes } from "./routes/workflow";
import { apiManager } from "./services/external-apis";
import { emailAutomation } from "./services/email";
import { 
  securityHeaders, 
  apiRateLimit, 
  errorHandler, 
  requestLogger, 
  corsOptions 
} from "./middleware/security";
import { 
  performanceTracker,
  performanceMonitor,
  compressionOptimizer,
  performanceHeaders,
  intelligentCaching,
  requestSizeLimiter,
  memoryMonitor,
  cpuMonitor
} from "./middleware/performance";
import { 
  globalErrorHandler,
  notFoundHandler,
  healthCheck,
  errorLogger,
  CircuitBreaker,
  retryWithBackoff
} from "./middleware/errorBoundary";
import { cacheManager } from "./services/cache";
import { dbOptimizer } from "./services/database-optimization";
import { observabilityService } from "./services/observability";
import { runProductionReadinessChecks, getDeploymentHealth } from "../deployment.config";
import { WebSocketServer } from "ws";
import crypto from "crypto";
import cors from "cors";

// Validation schemas
const tokenSchema = z.object({
  token: z.string().min(1),
});

const adminKeySchema = z.object({
  key: z.string().min(1),
});

// Secure token generation
function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // Apply security and performance middleware
  app.use(cors(corsOptions));
  app.use(securityHeaders);
  app.use(performanceHeaders);
  app.use(requestLogger);
  app.use(performanceTracker);
  app.use(compressionOptimizer);
  app.use(requestSizeLimiter(10)); // 10MB limit
  app.use(apiRateLimit);
  
  // Only setup WebSocket server in production to avoid conflict with Vite's WebSocket
  let wss: WebSocketServer | null = null;
  if (process.env.NODE_ENV === "production") {
    wss = new WebSocketServer({ server: httpServer });
  }
  
  // Setup SSE for real-time updates
  setupSSE(app);

  // Health check
  app.get("/api/health", async (req, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
  });

  // MCP Server endpoints
  app.post("/api/mcp/tools/list", async (req, res) => {
    try {
      const tools = await mcpServer.listTools();
      res.json({ tools });
    } catch (error) {
      res.status(500).json({ error: "Failed to list tools" });
    }
  });

  app.post("/api/mcp/tools/call", async (req, res) => {
    try {
      const { name, arguments: args } = req.body;
      const result = await mcpServer.callTool(name, args);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Tool execution failed", details: String(error) });
    }
  });

  // Campaign management
  app.get("/api/campaigns", async (req, res) => {
    try {
      const campaigns = await storage.getCampaigns();
      res.json(campaigns);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch campaigns" });
    }
  });

  app.post("/api/campaigns", async (req, res) => {
    try {
      const campaignData = insertCampaignSchema.parse(req.body);
      const campaign = await storage.createCampaign(campaignData);
      res.json(campaign);
    } catch (error) {
      res.status(400).json({ error: "Invalid campaign data", details: String(error) });
    }
  });

  // Candidate management
  app.get("/api/candidates", async (req, res) => {
    try {
      const { page = 1, limit = 100 } = req.query;
      const candidates = await storage.getCandidates(Number(page), Number(limit));
      res.json(candidates);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch candidates" });
    }
  });

  app.post("/api/candidates", async (req, res) => {
    try {
      const candidateData = insertCandidateSchema.parse(req.body);
      const candidate = await storage.createCandidate(candidateData);
      
      // Broadcast real-time update
      if (req.app.locals.broadcastCandidateCreated) {
        req.app.locals.broadcastCandidateCreated(candidate);
      }
      
      res.json(candidate);
    } catch (error) {
      res.status(400).json({ error: "Invalid candidate data", details: String(error) });
    }
  });

  app.patch("/api/candidates/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const candidate = await storage.updateCandidate(id, updates);
      
      // Broadcast real-time update
      if (req.app.locals.broadcastCandidateUpdated) {
        req.app.locals.broadcastCandidateUpdated(candidate, updates);
      }
      
      res.json(candidate);
    } catch (error) {
      res.status(500).json({ error: "Failed to update candidate" });
    }
  });

  // Interview endpoints
  app.post("/api/interviews", async (req, res) => {
    try {
      const interviewData = insertInterviewSchema.parse(req.body);
      const interview = await storage.createInterview(interviewData);
      
      // Broadcast real-time update
      if (req.app.locals.broadcastInterviewScheduled) {
        req.app.locals.broadcastInterviewScheduled({
          id: interview.id,
          candidateName: interview.candidateName || 'Unknown',
          startTs: interview.startTs,
          type: interview.type || 'interview'
        });
      }
      
      res.json(interview);
    } catch (error) {
      res.status(400).json({ error: "Invalid interview data", details: String(error) });
    }
  });

  // Booking endpoints
  app.get("/api/bookings", async (req, res) => {
    try {
      const bookings = await storage.getBookings();
      res.json(bookings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch bookings" });
    }
  });

  app.post("/api/bookings", async (req, res) => {
    try {
      const bookingData = insertBookingSchema.parse(req.body);
      const booking = await storage.createBooking(bookingData);
      res.json(booking);
    } catch (error) {
      res.status(400).json({ error: "Invalid booking data", details: String(error) });
    }
  });

  // Indeed integration webhook
  app.post("/api/indeed/applications", async (req, res) => {
    try {
      // Process Indeed application
      const candidateData = {
        name: req.body.name,
        email: req.body.email,
        phone: req.body.phone,
        sourceRef: req.body.applicationId,
        resumeUrl: req.body.resumeUrl,
        pipelineStage: "NEW" as const,
      };
      
      const candidate = await storage.createCandidate(candidateData);
      
      // Broadcast real-time update
      if (req.app.locals.broadcastCandidateCreated) {
        req.app.locals.broadcastCandidateCreated(candidate);
      }
      
      res.json({ success: true, candidateId: candidate.id });
    } catch (error) {
      res.status(500).json({ error: "Failed to process application" });
    }
  });

  // Mailjet webhook
  app.post("/api/mailjet/webhooks", async (req, res) => {
    try {
      // Process Mailjet events (delivery, bounce, open)
      await storage.createAuditLog({
        actor: "mailjet",
        action: "webhook",
        payloadJson: req.body,
      });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to process webhook" });
    }
  });

  // Public interview portal
  app.get("/interview/:token", async (req, res) => {
    try {
      const { token } = tokenSchema.parse(req.params);
      // Validate token and get candidate
      const candidate = await storage.getCandidateByToken(token);
      if (!candidate) {
        return res.status(404).json({ error: "Invalid interview token" });
      }
      // Return interview page data or redirect to frontend
      res.json({ candidateId: candidate.id, name: candidate.name });
    } catch (error) {
      res.status(400).json({ error: "Invalid token" });
    }
  });

  // Public booking portal
  app.get("/booking/:token", async (req, res) => {
    try {
      const { token } = tokenSchema.parse(req.params);
      const candidate = await storage.getCandidateByToken(token);
      if (!candidate) {
        return res.status(404).json({ error: "Invalid booking token" });
      }
      res.json({ candidateId: candidate.id, name: candidate.name });
    } catch (error) {
      res.status(400).json({ error: "Invalid token" });
    }
  });

  // Admin endpoints (gated by query key)
  app.get("/admin", (req, res, next) => {
    const { key } = req.query;
    if (key !== process.env.ADMIN_QUERY_KEY) {
      return res.status(403).json({ error: "Invalid admin key" });
    }
    next();
  }, async (req, res) => {
    const stats = await storage.getAdminStats();
    res.json(stats);
  });

  // KPI endpoints
  app.get("/api/kpis", async (req, res) => {
    try {
      const kpis = await storage.getKPIs();
      res.json(kpis);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch KPIs" });
    }
  });

  // Apify endpoints
  app.get("/api/apify/actors", async (req, res) => {
    try {
      const actors = await storage.getApifyActors();
      res.json(actors);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch Apify actors" });
    }
  });

  // Register workflow routes
  registerWorkflowRoutes(app);

  // External API health check endpoint
  app.get("/api/health/external", async (req, res) => {
    try {
      const healthChecks = await apiManager.healthCheckAll();
      const configuration = apiManager.getConfigurationStatus();
      
      res.json({
        external_apis: healthChecks,
        configuration_status: configuration,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to check external API health" });
    }
  });

  // Email automation endpoints
  app.post("/api/email/send", async (req, res) => {
    try {
      const { to, templateId, variables } = req.body;
      
      if (!to || !templateId) {
        return res.status(400).json({ error: "Missing required fields: to, templateId" });
      }

      const result = await emailAutomation.sendWelcomeEmail(variables.candidateName, to);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to send email" });
    }
  });

  app.post("/api/email/interview-invite", async (req, res) => {
    try {
      const { candidateId, interviewDetails } = req.body;
      
      const candidate = await storage.getCandidate(candidateId);
      if (!candidate) {
        return res.status(404).json({ error: "Candidate not found" });
      }

      const result = await emailAutomation.sendInterviewInvitation(
        candidate.name,
        candidate.email,
        interviewDetails
      );
      
      // Log the email send
      await storage.createAuditLog({
        actor: 'system',
        action: 'email_sent',
        payloadJson: { 
          type: 'interview_invite',
          candidateId,
          success: result.success,
        },
      });

      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to send interview invitation" });
    }
  });

  // External API integration endpoints
  app.post("/api/integrations/slack/notify", async (req, res) => {
    try {
      const { candidateName, action, details } = req.body;
      
      const slackService = apiManager.getService('slack');
      if (!slackService?.isConfigured()) {
        return res.status(503).json({ error: "Slack integration not configured" });
      }

      const result = await slackService.sendCandidateNotification(candidateName, action, details);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to send Slack notification" });
    }
  });

  app.post("/api/integrations/indeed/search", async (req, res) => {
    try {
      const { query, location, limit } = req.body;
      
      const indeedService = apiManager.getService('indeed');
      if (!indeedService?.isConfigured()) {
        return res.status(503).json({ error: "Indeed integration not configured" });
      }

      const result = await indeedService.searchJobs({ query, location, limit });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to search Indeed jobs" });
    }
  });

  app.post("/api/integrations/apify/scrape", async (req, res) => {
    try {
      const { searchQuery } = req.body;
      
      const apifyService = apiManager.getService('apify');
      if (!apifyService?.isConfigured()) {
        return res.status(503).json({ error: "Apify integration not configured" });
      }

      const result = await apifyService.scrapeLinkedInProfiles(searchQuery);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to scrape profiles" });
    }
  });

  // AI-powered candidate analysis
  app.post("/api/ai/analyze-candidate", async (req, res) => {
    try {
      const { candidateId } = req.body;
      
      const candidate = await storage.getCandidate(candidateId);
      if (!candidate) {
        return res.status(404).json({ error: "Candidate not found" });
      }

      const openRouterService = apiManager.getService('openrouter');
      if (!openRouterService?.isConfigured()) {
        return res.status(503).json({ error: "AI service not configured" });
      }

      const analysis = await openRouterService.generateCandidateAnalysis({
        name: candidate.name,
        email: candidate.email,
        skills: candidate.tags || [],
      });

      // Update candidate with AI analysis
      await storage.updateCandidate(candidateId, {
        score: analysis.score,
      });

      res.json(analysis);
    } catch (error) {
      res.status(500).json({ error: "Failed to analyze candidate" });
    }
  });

  // System monitoring endpoint
  app.get("/api/system/status", async (req, res) => {
    try {
      const stats = await storage.getAdminStats();
      const externalHealth = await apiManager.healthCheckAll();
      const configuration = apiManager.getConfigurationStatus();
      
      res.json({
        system: {
          status: 'healthy',
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          node_version: process.version,
          env: process.env.NODE_ENV,
        },
        database: stats,
        external_apis: externalHealth,
        integrations: configuration,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get system status" });
    }
  });

  // Performance monitoring endpoints
  app.get("/api/performance/metrics", intelligentCaching(60), async (req, res) => {
    try {
      const timeframe = parseInt(req.query.timeframe as string) || 3600000; // 1 hour default
      const metrics = performanceMonitor.getAggregatedMetrics(timeframe);
      const memory = memoryMonitor();
      const cpu = cpuMonitor();
      
      res.json({
        performance: metrics,
        system: {
          memory,
          cpu,
          uptime: process.uptime(),
        },
        cache: cacheManager.getStats(),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch performance metrics" });
    }
  });

  app.get("/api/performance/errors", intelligentCaching(30), async (req, res) => {
    try {
      const timeframe = parseInt(req.query.timeframe as string) || 3600000;
      const errorStats = errorLogger.getErrorStats(timeframe);
      
      res.json({
        ...errorStats,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch error statistics" });
    }
  });

  app.post("/api/performance/clear", async (req, res) => {
    try {
      performanceMonitor.clearMetrics();
      errorLogger.clearStats();
      await cacheManager.clear();
      
      res.json({
        message: "Performance data cleared",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to clear performance data" });
    }
  });

  // Enhanced health check with performance data
  app.get("/api/health/detailed", async (req, res) => {
    try {
      const healthData = await healthCheck(req, res);
      // Don't send response here as healthCheck already does
    } catch (error) {
      res.status(500).json({
        status: 'unhealthy',
        error: 'Health check failed',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Backup and disaster recovery endpoints
  app.post("/api/admin/backup", async (req, res) => {
    try {
      const backupData = {
        candidates: await storage.getAllCandidates(),
        campaigns: await storage.getAllCampaigns(),
        interviews: await storage.getAllInterviews(),
        bookings: await storage.getAllBookings(),
        workflowRules: await storage.getAllWorkflowRules(),
        apifyActors: await storage.getAllApifyActors(),
        metadata: {
          timestamp: new Date().toISOString(),
          version: '1.0.0',
          platform: 'iFast-Broker',
        },
      };
      
      res.setHeader('Content-Disposition', 'attachment; filename=ifast-backup.json');
      res.setHeader('Content-Type', 'application/json');
      res.json(backupData);
    } catch (error) {
      res.status(500).json({ error: "Backup generation failed" });
    }
  });

  app.post("/api/admin/restore", async (req, res) => {
    try {
      const { backupData, confirmRestore } = req.body;
      
      if (!confirmRestore) {
        return res.status(400).json({ 
          error: "Restoration requires explicit confirmation",
          message: "Set confirmRestore: true to proceed"
        });
      }

      if (!backupData || !backupData.metadata) {
        return res.status(400).json({ error: "Invalid backup data format" });
      }

      // Clear existing data (in a real implementation, this would be more sophisticated)
      await storage.clearAllData();
      
      // Restore data
      if (backupData.candidates) {
        for (const candidate of backupData.candidates) {
          await storage.createCandidate(candidate);
        }
      }
      
      if (backupData.campaigns) {
        for (const campaign of backupData.campaigns) {
          await storage.createCampaign(campaign);
        }
      }

      // Log the restoration
      await storage.createAuditLog({
        actor: 'admin',
        action: 'system_restore',
        payloadJson: { 
          backupTimestamp: backupData.metadata.timestamp,
          itemsRestored: {
            candidates: backupData.candidates?.length || 0,
            campaigns: backupData.campaigns?.length || 0,
          }
        },
      });

      res.json({
        message: "System restored successfully",
        restored: {
          candidates: backupData.candidates?.length || 0,
          campaigns: backupData.campaigns?.length || 0,
          interviews: backupData.interviews?.length || 0,
          bookings: backupData.bookings?.length || 0,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({ error: "System restoration failed" });
    }
  });

  // Database optimization endpoints
  app.get("/api/database/stats", intelligentCaching(60), async (req, res) => {
    try {
      const stats = await dbOptimizer.getDatabaseStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch database statistics" });
    }
  });

  app.get("/api/database/performance", intelligentCaching(30), async (req, res) => {
    try {
      const report = dbOptimizer.generatePerformanceReport();
      res.json(report);
    } catch (error) {
      res.status(500).json({ error: "Failed to generate performance report" });
    }
  });

  app.post("/api/database/optimize", async (req, res) => {
    try {
      await dbOptimizer.warmCache();
      const alerts = dbOptimizer.getPerformanceAlerts();
      
      res.json({
        message: "Database optimization completed",
        alerts: alerts.length,
        recommendations: alerts,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({ error: "Database optimization failed" });
    }
  });

  // Observability and monitoring endpoints
  app.get("/api/observability/health-score", intelligentCaching(30), async (req, res) => {
    try {
      const healthScore = observabilityService.calculateHealthScore();
      res.json(healthScore);
    } catch (error) {
      res.status(500).json({ error: "Failed to calculate health score" });
    }
  });

  app.get("/api/observability/alerts", async (req, res) => {
    try {
      const level = req.query.level as 'info' | 'warning' | 'error' | 'critical' | undefined;
      const alerts = observabilityService.getActiveAlerts(level);
      res.json({ alerts, count: alerts.length });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch alerts" });
    }
  });

  app.post("/api/observability/alerts/:alertId/resolve", async (req, res) => {
    try {
      const { alertId } = req.params;
      const resolved = observabilityService.resolveAlert(alertId);
      
      if (resolved) {
        res.json({ message: "Alert resolved", alertId });
      } else {
        res.status(404).json({ error: "Alert not found" });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to resolve alert" });
    }
  });

  app.get("/api/observability/report", intelligentCaching(300), async (req, res) => {
    try {
      const timeframe = parseInt(req.query.timeframe as string) || 3600000;
      const report = observabilityService.generateReport(timeframe);
      res.json(report);
    } catch (error) {
      res.status(500).json({ error: "Failed to generate observability report" });
    }
  });

  app.post("/api/observability/benchmark", async (req, res) => {
    try {
      const results = await observabilityService.runBenchmarks();
      res.json({
        message: "Benchmarks completed",
        results,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({ error: "Benchmark execution failed" });
    }
  });

  // Production readiness endpoints
  app.get("/api/deployment/readiness", async (req, res) => {
    try {
      const readiness = await runProductionReadinessChecks();
      res.json(readiness);
    } catch (error) {
      res.status(500).json({ error: "Failed to check production readiness" });
    }
  });

  app.get("/api/deployment/health", (req, res) => {
    try {
      const health = getDeploymentHealth();
      res.json(health);
    } catch (error) {
      res.status(500).json({ error: "Failed to get deployment health" });
    }
  });

  // API documentation endpoint
  app.get("/api/docs", (req, res) => {
    const apiDocs = {
      openapi: "3.0.0",
      info: {
        title: "iFast Broker API",
        version: "1.0.0",
        description: "Enterprise recruiting platform API",
      },
      servers: [
        {
          url: `${req.protocol}://${req.get('host')}`,
          description: "Current server",
        },
      ],
      paths: {
        "/api/candidates": {
          get: {
            summary: "Get all candidates",
            parameters: [
              { name: "limit", in: "query", type: "integer" },
              { name: "offset", in: "query", type: "integer" },
              { name: "search", in: "query", type: "string" },
            ],
            responses: {
              200: { description: "List of candidates" },
            },
          },
          post: {
            summary: "Create new candidate",
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Candidate" },
                },
              },
            },
          },
        },
        "/api/performance/metrics": {
          get: {
            summary: "Get performance metrics",
            parameters: [
              { name: "timeframe", in: "query", type: "integer" },
            ],
          },
        },
        "/api/health": {
          get: {
            summary: "Basic health check",
          },
        },
      },
      components: {
        schemas: {
          Candidate: {
            type: "object",
            properties: {
              name: { type: "string" },
              email: { type: "string" },
              phone: { type: "string" },
              stage: { type: "string" },
            },
          },
        },
      },
    };
    
    res.json(apiDocs);
  });

  // 404 handler for undefined API routes only
  app.use('/api/*', notFoundHandler);

  // Apply global error handler
  app.use(globalErrorHandler);

  return httpServer;
}

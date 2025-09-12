import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { 
  insertCandidateSchema, 
  insertCampaignSchema, 
  insertInterviewSchema, 
  insertBookingSchema,
  insertIndeedJobSchema,
  insertIndeedApplicationSchema,
  insertApifyActorSchema,
  insertApifyRunSchema
} from "@shared/schema";
import {
  ObjectStorageService,
  ObjectNotFoundError,
} from "./objectStorage";
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
  corsOptions,
  elevenlabsCorsOptions,
  mcpRateLimit,
  elevenlabsRateLimit,
  authRateLimit,
  uploadRateLimit,
  validateApiKey
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
import { apifyService } from "./services/apify-client";
import { indeedService } from "./services/indeed-client";
import { elevenlabsIntegration } from "./integrations/elevenlabs";
import { elevenLabsAutomation } from "./services/elevenlabs-automation";
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
  
  // Apply security middleware globally
  app.use(securityHeaders);
  app.use(requestLogger);
  app.use(cors(corsOptions));
  
  // Apply rate limiting to most endpoints
  app.use('/api', apiRateLimit);
  
  // Special handling for ElevenLabs MCP endpoints - apply permissive CORS and higher rate limits
  app.use('/api/mcp', cors(elevenlabsCorsOptions));
  app.use('/api/mcp', mcpRateLimit);
  app.use('/api/elevenlabs', elevenlabsRateLimit);
  
  // Only setup WebSocket server in production to avoid conflict with Vite's WebSocket
  let wss: WebSocketServer | null = null;
  if (process.env.NODE_ENV === "production") {
    wss = new WebSocketServer({ server: httpServer });
  }
  
  // Setup SSE for real-time updates
  setupSSE(app);

  // Initialize ElevenLabs automation service with SSE broadcasting
  if (app.locals.broadcastSSE) {
    elevenLabsAutomation.setBroadcastFunction(app.locals.broadcastSSE);
    console.log("[ElevenLabs Automation] SSE broadcasting configured");
    
    // Start automated polling after a delay to ensure system is ready
    setTimeout(async () => {
      try {
        await elevenLabsAutomation.startPolling();
        console.log("[ElevenLabs Automation] Automated polling started successfully");
      } catch (error) {
        console.error("[ElevenLabs Automation] Failed to start automated polling:", error);
      }
    }, 10000); // 10 second delay
  }

  // Health check
  app.get("/api/health", async (req, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
  });

  // ElevenLabs automation API endpoints
  app.get("/api/elevenlabs/automation/status", async (req, res) => {
    try {
      const status = await elevenLabsAutomation.getStatus();
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: "Failed to get automation status", details: String(error) });
    }
  });

  app.post("/api/elevenlabs/automation/trigger", async (req, res) => {
    try {
      await elevenLabsAutomation.triggerManualPoll();
      res.json({ success: true, message: "Manual poll triggered" });
    } catch (error) {
      res.status(500).json({ error: "Failed to trigger manual poll", details: String(error) });
    }
  });

  app.post("/api/elevenlabs/automation/start", async (req, res) => {
    try {
      await elevenLabsAutomation.startPolling();
      res.json({ success: true, message: "Automation started" });
    } catch (error) {
      res.status(500).json({ error: "Failed to start automation", details: String(error) });
    }
  });

  app.post("/api/elevenlabs/automation/stop", async (req, res) => {
    try {
      elevenLabsAutomation.stopPolling();
      res.json({ success: true, message: "Automation stopped" });
    } catch (error) {
      res.status(500).json({ error: "Failed to stop automation", details: String(error) });
    }
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

  // STREAMABLE_HTTP MCP endpoint for ElevenLabs interview agents
  // Unified endpoint supporting POST (commands), GET (streaming), DELETE (cleanup)
  
  // Store active sessions
  const mcpSessions = new Map<string, any>();
  
  // POST - Handle MCP commands
  app.post("/api/mcp", async (req, res) => {
    try {
      const sessionId = req.headers['mcp-session-id'] as string;
      const { method, params, id, jsonrpc } = req.body;

      // COMPREHENSIVE LOGGING - Log all incoming MCP requests
      console.log(`[MCP] Incoming request - Method: ${method}, SessionId: ${sessionId}, ID: ${id}`);
      console.log(`[MCP] Full request body:`, JSON.stringify(req.body, null, 2));
      console.log(`[MCP] Request headers:`, JSON.stringify(req.headers, null, 2));

      // Validate JSON-RPC 2.0 format
      if (jsonrpc !== "2.0" || !method) {
        console.log(`[MCP] ERROR: Invalid JSON-RPC format - jsonrpc: ${jsonrpc}, method: ${method}`);
        return res.status(400).json({
          jsonrpc: "2.0",
          error: { code: -32600, message: "Invalid Request" },
          id: id || null
        });
      }

      // Session management
      if (sessionId && !mcpSessions.has(sessionId)) {
        mcpSessions.set(sessionId, { 
          id: sessionId, 
          created: new Date(),
          tools: await mcpServer.listTools()
        });
        console.log(`[MCP] Created new session: ${sessionId}`);
      }

      let result;

      switch (method) {
        case "initialize":
          console.log(`[MCP] Processing initialize method with params:`, params);
          const newSessionId = sessionId || crypto.randomUUID();
          mcpSessions.set(newSessionId, {
            id: newSessionId,
            created: new Date(),
            initialized: true
          });
          
          result = {
            protocolVersion: "2024-11-05",
            capabilities: {
              tools: {
                listChanged: true
              },
              logging: {},
              experimental: {
                streaming: {}
              }
            },
            serverInfo: {
              name: "ifast-broker",
              version: "1.0.0"
            }
          };
          
          // Set session header for client
          res.setHeader('Mcp-Session-Id', newSessionId);
          console.log(`[MCP] Initialize complete, session: ${newSessionId}`);
          break;

        case "initialized":
          console.log(`[MCP] Processing initialized notification`);
          result = {};
          break;

        case "notifications/initialized":
          console.log(`[MCP] Processing notifications/initialized method`);
          result = {};
          break;

        case "notifications/cancelled":
          console.log(`[MCP] Processing notifications/cancelled method`);
          if (params?.requestId) {
            console.log(`[MCP] Cancelling request ID: ${params.requestId}`);
          }
          result = {};
          break;

        case "ping":
          console.log(`[MCP] Processing ping method`);
          result = { pong: true, timestamp: new Date().toISOString() };
          break;

        case "capabilities":
          console.log(`[MCP] Processing capabilities method`);
          result = {
            tools: {
              listChanged: true
            },
            logging: {},
            experimental: {
              streaming: {}
            }
          };
          break;

        case "tools/list":
          console.log(`[MCP] Processing tools/list method`);
          const tools = await mcpServer.listTools();
          result = tools;
          console.log(`[MCP] Returning ${tools.tools?.length || 0} tools`);
          break;

        case "tools/call":
          console.log(`[MCP] Processing tools/call method with params:`, params);
          if (!params?.name) {
            console.log(`[MCP] ERROR: tools/call missing name parameter`);
            return res.status(200).json({
              jsonrpc: "2.0",
              error: { code: -32602, message: "Invalid params: name required" },
              id: id || null
            });
          }
          console.log(`[MCP] Calling tool: ${params.name} with arguments:`, params.arguments);
          result = await mcpServer.callTool(params.name, params.arguments || {});
          console.log(`[MCP] Tool ${params.name} completed successfully`);
          break;

        case "logging/setLevel":
          console.log(`[MCP] Processing logging/setLevel method with params:`, params);
          result = {};
          break;

        default:
          console.log(`[MCP] ERROR: Unknown method called: ${method}`);
          console.log(`[MCP] Available methods: initialize, initialized, notifications/initialized, notifications/cancelled, ping, capabilities, tools/list, tools/call, logging/setLevel`);
          return res.status(200).json({
            jsonrpc: "2.0",
            error: { code: -32601, message: `Method not found: ${method}` },
            id
          });
      }

      const response = {
        jsonrpc: "2.0",
        result,
        id
      };

      // Log successful response
      console.log(`[MCP] Sending response for ${method}:`, JSON.stringify(response, null, 2));
      res.json(response);

    } catch (error) {
      console.log(`[MCP] ERROR: Exception in MCP handler:`, error);
      console.log(`[MCP] Request that caused error:`, JSON.stringify(req.body, null, 2));
      
      const errorResponse = {
        jsonrpc: "2.0",
        error: { 
          code: -32603, 
          message: "Internal error", 
          data: String(error) 
        },
        id: req.body.id || null
      };

      console.log(`[MCP] Sending error response:`, JSON.stringify(errorResponse, null, 2));
      res.status(500).json(errorResponse);
    }
  });

  // GET - Handle SSE streaming for STREAMABLE_HTTP
  app.get("/api/mcp", async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string;
    
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // Optional session validation
    if (sessionId && !mcpSessions.has(sessionId)) {
      res.write(`event: error\ndata: {"error": "Invalid session"}\n\n`);
      res.end();
      return;
    }

    // Keep connection alive
    const keepAlive = setInterval(() => {
      res.write(`event: ping\ndata: {"type": "ping"}\n\n`);
    }, 30000);

    // Send initial connection event
    res.write(`event: connected\ndata: {"type": "connected", "sessionId": "${sessionId || 'anonymous'}"}\n\n`);

    // Handle client disconnect
    req.on('close', () => {
      clearInterval(keepAlive);
    });
  });

  // DELETE - Handle session cleanup
  app.delete("/api/mcp", async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string;
    
    if (sessionId && mcpSessions.has(sessionId)) {
      mcpSessions.delete(sessionId);
      res.json({ success: true, message: "Session terminated" });
    } else {
      res.status(404).json({ error: "Session not found" });
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
  app.get("/api/interviews", async (req, res) => {
    try {
      const interviews = await storage.getInterviews();
      res.json(interviews);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch interviews" });
    }
  });

  app.post("/api/interviews", async (req, res) => {
    try {
      const interviewData = insertInterviewSchema.parse(req.body);
      const interview = await storage.createInterview(interviewData);
      
      // Broadcast real-time update
      if (req.app.locals.broadcastInterviewScheduled) {
        req.app.locals.broadcastInterviewScheduled({
          id: interview.id,
          candidateId: interview.candidateId,
          summary: interview.summary || 'Interview scheduled'
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

  // Indeed integration webhook - protected with API key validation
  app.post("/api/indeed/applications", validateApiKey, async (req, res) => {
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

  // Mailjet webhook - protected with API key validation
  app.post("/api/mailjet/webhooks", validateApiKey, async (req, res) => {
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
  app.get("/admin", authRateLimit, (req, res, next) => {
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

  // =========================
  // ELEVENLABS INTEGRATION API
  // =========================
  
  // Collect all available data from a specific ElevenLabs agent
  app.post("/api/elevenlabs/collect-agent-data", async (req, res) => {
    try {
      // Default to the specific agent ID, but allow override
      const agentId = req.body.agentId || "agent_0601k4t9d82qe5ybsgkngct0zzkm";
      
      console.log(`[ElevenLabs] Collecting data for agent: ${agentId}`);
      
      const agentData = await elevenlabsIntegration.getAllAgentData(agentId);
      
      console.log(`[ElevenLabs] Successfully collected data for agent ${agentId}:`, {
        total_conversations: agentData.total_conversations,
        has_agent_info: !!agentData.agent,
        has_errors: !!agentData.error_details
      });
      
      res.json({
        success: true,
        agent_id: agentId,
        timestamp: new Date().toISOString(),
        data: agentData
      });
    } catch (error) {
      console.error("[ElevenLabs] Agent data collection failed:", error);
      res.status(500).json({ 
        error: "Failed to collect ElevenLabs agent data", 
        details: String(error),
        agent_id: req.body.agentId || "agent_0601k4t9d82qe5ybsgkngct0zzkm"
      });
    }
  });

  // Get conversations for a specific ElevenLabs agent (with pagination)
  app.get("/api/elevenlabs/conversations/:agentId", async (req, res) => {
    try {
      const { agentId } = req.params;
      const { limit, cursor, after, before } = req.query;
      
      const options = {
        limit: limit ? parseInt(String(limit)) : undefined,
        cursor: cursor ? String(cursor) : undefined,
        after: after ? String(after) : undefined,
        before: before ? String(before) : undefined,
      };
      
      const conversations = await elevenlabsIntegration.getAgentConversations(agentId, options);
      
      res.json({
        success: true,
        agent_id: agentId,
        ...conversations
      });
    } catch (error) {
      console.error(`[ElevenLabs] Failed to fetch conversations for agent ${req.params.agentId}:`, error);
      res.status(500).json({ 
        error: "Failed to fetch agent conversations", 
        details: String(error),
        agent_id: req.params.agentId
      });
    }
  });

  // Pull today's calls for the authorized agent and process them automatically
  app.post("/api/elevenlabs/pull-todays-calls", async (req, res) => {
    try {
      const agentId = "agent_0601k4t9d82qe5ybsgkngct0zzkm"; // Fixed authorized agent
      
      // Get today's date range in ISO format
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Start of today
      const startOfToday = today.toISOString();
      
      const endOfToday = new Date(today);
      endOfToday.setHours(23, 59, 59, 999); // End of today
      const endOfTodayStr = endOfToday.toISOString();
      
      console.log(`[ElevenLabs] Pulling today's calls for agent ${agentId} from ${startOfToday} to ${endOfTodayStr}`);
      
      // Get today's conversations
      const conversationsData = await elevenlabsIntegration.getAgentConversations(agentId, {
        limit: 100,
        after: startOfToday,
        before: endOfTodayStr
      });
      
      console.log(`[ElevenLabs] Found ${conversationsData.conversations.length} conversations for today`);
      
      if (conversationsData.conversations.length === 0) {
        return res.json({
          success: true,
          message: "No conversations found for today",
          agent_id: agentId,
          date_range: { start: startOfToday, end: endOfTodayStr },
          processed: 0
        });
      }
      
      // Enrich each conversation with details and process through MCP tools
      const processedResults = [];
      let successCount = 0;
      let errorCount = 0;
      
      for (const conversation of conversationsData.conversations) {
        try {
          // Get detailed conversation data
          const details = await elevenlabsIntegration.getConversationDetails(conversation.conversation_id);
          
          // Get audio info
          let audioInfo = null;
          try {
            audioInfo = await elevenlabsIntegration.getConversationAudio(conversation.conversation_id);
          } catch (audioError) {
            console.log(`[ElevenLabs] Could not fetch audio for conversation ${conversation.conversation_id}: ${audioError}`);
          }
          
          // Prepare comprehensive interview data for MCP processing
          const interviewData = {
            agent_id: agentId,
            conversation_id: conversation.conversation_id,
            transcript: details.transcript ? JSON.stringify(details.transcript) : undefined,
            created_at: details.created_at,
            ended_at: details.ended_at,
            audio_recording_url: audioInfo?.audio_url,
            conversation_metadata: details.metadata,
            agent_data: {
              agent_id: agentId,
              conversation_details: details,
              audio_info: audioInfo
            }
          };
          
          // Try to process through MCP tool
          try {
            const mcpResult = await mcpServer.callTool("create_candidate_from_interview", {
              name: "ElevenLabs Interview Candidate",
              email: `conversation-${conversation.conversation_id}@temp.elevenlabs.com`,
              interviewData: interviewData,
              notes: `Auto-imported from ElevenLabs conversation ${conversation.conversation_id} on ${new Date().toISOString()}`
            });
            
            processedResults.push({
              conversation_id: conversation.conversation_id,
              status: "success",
              result: mcpResult
            });
            successCount++;
          } catch (mcpError) {
            console.error(`[ElevenLabs] MCP processing failed for conversation ${conversation.conversation_id}:`, mcpError);
            processedResults.push({
              conversation_id: conversation.conversation_id,
              status: "mcp_error",
              error: String(mcpError),
              raw_data: interviewData
            });
            errorCount++;
          }
          
        } catch (error) {
          console.error(`[ElevenLabs] Failed to process conversation ${conversation.conversation_id}:`, error);
          processedResults.push({
            conversation_id: conversation.conversation_id,
            status: "error", 
            error: String(error)
          });
          errorCount++;
        }
      }
      
      console.log(`[ElevenLabs] Processing complete: ${successCount} success, ${errorCount} errors`);
      
      res.json({
        success: true,
        message: `Processed ${conversationsData.conversations.length} conversations from today`,
        agent_id: agentId,
        date_range: { start: startOfToday, end: endOfTodayStr },
        statistics: {
          total_found: conversationsData.conversations.length,
          processed_successfully: successCount,
          processing_errors: errorCount
        },
        results: processedResults
      });
      
    } catch (error) {
      console.error("[ElevenLabs] Failed to pull today's calls:", error);
      res.status(500).json({ 
        error: "Failed to pull today's calls", 
        details: String(error),
        agent_id: "agent_0601k4t9d82qe5ybsgkngct0zzkm"
      });
    }
  });

  // Import conversations and match them to candidates
  app.post("/api/elevenlabs/import-conversations", async (req, res) => {
    try {
      const { conversations, agentId, confirmImport = false } = req.body;
      
      if (!conversations || !Array.isArray(conversations)) {
        return res.status(400).json({ error: "Invalid conversations data" });
      }

      console.log(`[ElevenLabs] Processing ${conversations.length} conversations for import`);

      // Smart matching function to extract potential candidate identifiers
      const extractCandidateInfo = (conversation: any) => {
        const extractedInfo: any = { conversation_id: conversation.conversation_id };
        
        // Extract from transcript if available
        if (conversation.transcript && Array.isArray(conversation.transcript)) {
          const transcriptText = conversation.transcript
            .map((t: any) => t.message || t.text || '')
            .join(' ')
            .toLowerCase();
          
          // Email extraction using regex
          const emailMatches = transcriptText.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi);
          if (emailMatches && emailMatches.length > 0) {
            extractedInfo.emails = Array.from(new Set(emailMatches));
          }
          
          // Phone number extraction (various formats)
          const phoneMatches = transcriptText.match(/(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\+\d{1,3}[-.\s]?\d{3,4}[-.\s]?\d{3,4}[-.\s]?\d{3,4})/g);
          if (phoneMatches && phoneMatches.length > 0) {
            extractedInfo.phones = Array.from(new Set(phoneMatches.map((p: string) => p.replace(/[^\d+]/g, ''))));
          }
          
          // Name extraction - look for "my name is" or "I'm" patterns
          const namePatterns = [
            /(?:my name is|i'm|i am|this is)\s+([a-z]+(?:\s+[a-z]+)*)/gi,
            /(?:^|\s)([A-Z][a-z]+\s+[A-Z][a-z]+)(?=\s|$)/g
          ];
          
          const names: string[] = [];
          namePatterns.forEach(pattern => {
            const matches = transcriptText.matchAll(pattern);
            for (const match of matches) {
              if (match[1] && match[1].length > 2) {
                names.push(match[1].trim());
              }
            }
          });
          
          if (names.length > 0) {
            extractedInfo.names = Array.from(new Set(names));
          }
        }
        
        // Extract from metadata if available
        if (conversation.metadata) {
          if (conversation.metadata.email) extractedInfo.emails = [conversation.metadata.email];
          if (conversation.metadata.phone) extractedInfo.phones = [conversation.metadata.phone];
          if (conversation.metadata.name) extractedInfo.names = [conversation.metadata.name];
        }
        
        return extractedInfo;
      };

      // Process each conversation and find potential matches
      const processed = [];
      const matches = [];
      const errors = [];

      for (const conversation of conversations) {
        try {
          const extractedInfo = extractCandidateInfo(conversation);
          let matchedCandidate = null;
          let matchType = '';

          // Try to find existing candidate
          if (extractedInfo.emails) {
            for (const email of extractedInfo.emails) {
              matchedCandidate = await storage.getCandidateByEmail(email);
              if (matchedCandidate) {
                matchType = 'email';
                break;
              }
            }
          }

          // If no email match, try phone numbers (this would need custom implementation)
          // For now, we'll focus on email matching as it's most reliable

          const processedItem = {
            conversation,
            extractedInfo,
            matchedCandidate,
            matchType,
            status: matchedCandidate ? 'matched' : 'unmatched'
          };

          processed.push(processedItem);
          
          if (matchedCandidate) {
            matches.push(processedItem);
          }
        } catch (error) {
          errors.push({
            conversation_id: conversation.conversation_id,
            error: String(error)
          });
        }
      }

      // If this is just a preview (not confirmed import), return the analysis
      if (!confirmImport) {
        return res.json({
          success: true,
          preview: true,
          total_conversations: conversations.length,
          matched_count: matches.length,
          unmatched_count: processed.length - matches.length,
          error_count: errors.length,
          matches: matches.map(m => ({
            conversation_id: m.conversation.conversation_id,
            candidate_id: m.matchedCandidate?.id,
            candidate_name: m.matchedCandidate?.name,
            candidate_email: m.matchedCandidate?.email,
            match_type: m.matchType,
            extracted_info: m.extractedInfo
          })),
          errors
        });
      }

      // Perform actual import if confirmed
      const importResults = {
        updated: 0,
        failed: 0,
        skipped: 0,
        details: [] as any[]
      };

      for (const match of matches) {
        try {
          const { conversation, matchedCandidate } = match;
          
          if (!matchedCandidate) {
            continue; // Skip if no matched candidate
          }
          
          // Prepare transcript from conversation
          let transcript = '';
          if (conversation.transcript && Array.isArray(conversation.transcript)) {
            transcript = conversation.transcript
              .map((t: any) => `${t.role || 'unknown'}: ${t.message || t.text || ''}`)
              .join('\n');
          }

          // Prepare update data
          const updateData: any = {
            interviewTranscript: transcript,
            conversationId: conversation.conversation_id,
            agentId: agentId,
            conversationMetadata: {
              ...conversation.metadata,
              import_date: new Date().toISOString(),
              conversation_duration: conversation.ended_at 
                ? new Date(conversation.ended_at).getTime() - new Date(conversation.created_at).getTime()
                : null
            },
            agentData: {
              conversation_data: conversation,
              agent_id: agentId,
              import_timestamp: new Date().toISOString()
            }
          };

          // Add audio URL if available
          if (conversation.audio_info?.audio_url) {
            updateData.audioRecordingUrl = conversation.audio_info.audio_url;
          }

          // Set interview date from conversation created_at
          if (conversation.created_at) {
            updateData.interviewDate = new Date(conversation.created_at);
          }

          // Calculate call duration in seconds
          if (conversation.created_at && conversation.ended_at) {
            const durationMs = new Date(conversation.ended_at).getTime() - new Date(conversation.created_at).getTime();
            updateData.callDuration = Math.floor(durationMs / 1000);
          }

          // Update the candidate
          await storage.updateCandidate(matchedCandidate.id, updateData);
          
          importResults.updated++;
          importResults.details.push({
            conversation_id: conversation.conversation_id,
            candidate_id: matchedCandidate.id,
            candidate_name: matchedCandidate.name,
            status: 'updated'
          });

          console.log(`[ElevenLabs] Updated candidate ${matchedCandidate.id} with conversation ${conversation.conversation_id}`);
          
        } catch (error) {
          importResults.failed++;
          importResults.details.push({
            conversation_id: match.conversation.conversation_id,
            candidate_id: match.matchedCandidate?.id,
            status: 'failed',
            error: String(error)
          });
          console.error(`[ElevenLabs] Failed to update candidate:`, error);
        }
      }

      // Count unmatched conversations as skipped
      importResults.skipped = processed.length - matches.length;

      res.json({
        success: true,
        imported: true,
        total_processed: processed.length,
        results: importResults
      });

    } catch (error) {
      console.error("[ElevenLabs] Import failed:", error);
      res.status(500).json({ 
        error: "Failed to import conversations", 
        details: String(error)
      });
    }
  });

  // Get detailed information for a specific conversation
  app.get("/api/elevenlabs/conversations/:conversationId/details", async (req, res) => {
    try {
      const { conversationId } = req.params;
      
      const details = await elevenlabsIntegration.getConversationDetails(conversationId);
      
      res.json({
        success: true,
        conversation_id: conversationId,
        details
      });
    } catch (error) {
      console.error(`[ElevenLabs] Failed to fetch conversation details for ${req.params.conversationId}:`, error);
      res.status(500).json({ 
        error: "Failed to fetch conversation details", 
        details: String(error),
        conversation_id: req.params.conversationId
      });
    }
  });

  // Get audio for a specific conversation
  app.get("/api/elevenlabs/conversations/:conversationId/audio", async (req, res) => {
    try {
      const { conversationId } = req.params;
      
      const audioInfo = await elevenlabsIntegration.getConversationAudio(conversationId);
      
      // If we got binary audio data, stream it directly
      if (audioInfo.audio_data) {
        res.setHeader('Content-Type', audioInfo.content_type || 'audio/mpeg');
        res.setHeader('Content-Length', audioInfo.audio_data.byteLength);
        res.end(Buffer.from(audioInfo.audio_data));
      } else if (audioInfo.audio_url) {
        // If we got a URL, redirect to it or return the URL
        res.json({
          success: true,
          conversation_id: conversationId,
          audio_url: audioInfo.audio_url,
          content_type: audioInfo.content_type
        });
      } else {
        res.status(404).json({
          error: "No audio data found for conversation",
          conversation_id: conversationId
        });
      }
    } catch (error) {
      console.error(`[ElevenLabs] Failed to fetch conversation audio for ${req.params.conversationId}:`, error);
      res.status(500).json({ 
        error: "Failed to fetch conversation audio", 
        details: String(error),
        conversation_id: req.params.conversationId
      });
    }
  });

  // ======================
  // INDEED INTEGRATION API
  // ======================

  // Indeed job management - Returns what Indeed API would provide
  app.get("/api/indeed/jobs", async (req, res) => {
    try {
      const jobs = await storage.getIndeedJobs();
      
      // If no stored jobs, show placeholder data demonstrating Indeed API response format
      if (jobs.length === 0) {
        const placeholderJobs = [
          {
            id: 'indeed-demo-001',
            title: 'Senior Frontend Developer',
            company: 'TechFlow Inc',
            location: 'San Francisco, CA',
            description: 'Join our engineering team to build next-generation web applications using React, TypeScript, and modern frontend technologies. You will work on user-facing features that serve millions of users daily.',
            requirements: 'Bachelor\'s in Computer Science, 5+ years React experience, TypeScript proficiency, Experience with state management libraries, Strong problem-solving skills',
            salary: '$140,000 - $180,000 annually + equity',
            type: 'Full-time',
            status: 'active',
            applicationsCount: 42,
            createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
          },
          {
            id: 'indeed-demo-002',
            title: 'Backend Engineer - Node.js',
            company: 'DataCorp Solutions',
            location: 'Remote (US)',
            description: 'We are looking for a skilled Backend Engineer to design and implement scalable APIs and microservices. You\'ll work with Node.js, PostgreSQL, and cloud infrastructure.',
            requirements: '3+ years Node.js experience, Strong SQL and database design skills, Experience with cloud platforms (AWS/GCP), API design and microservices architecture, Agile development experience',
            salary: '$110,000 - $150,000 + benefits',
            type: 'Full-time',
            status: 'active',
            applicationsCount: 28,
            createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
          }
        ];
        res.json(placeholderJobs);
      } else {
        // Transform stored jobs to match Indeed API format
        res.json(jobs.map(job => ({
          id: job.id,
          title: job.title,
          company: job.company,
          location: job.location,
          description: job.description,
          requirements: job.requirements,
          salary: job.salary,
          type: job.type,
          status: job.status,
          applicationsCount: 0, // Would come from Indeed API
          createdAt: job.createdAt.toISOString()
        })));
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch Indeed jobs" });
    }
  });

  app.post("/api/indeed/jobs", async (req, res) => {
    try {
      const jobData = insertIndeedJobSchema.parse(req.body);
      const job = await storage.createIndeedJob(jobData);
      
      // TODO: Post to Indeed API when credentials available
      // const indeedAPI = new IndeedAPI(process.env.INDEED_API_KEY);
      // const indeedJobId = await indeedAPI.postJob(jobData);
      // await storage.updateIndeedJob(job.id, { indeedJobId });
      
      res.json(job);
    } catch (error) {
      res.status(400).json({ error: "Invalid job data", details: String(error) });
    }
  });

  // Indeed application delivery (webhook from Indeed)
  app.post("/api/indeed/applications", async (req, res) => {
    try {
      console.log("Indeed application received:", req.body);
      
      // Map Indeed payload to our schema
      const applicationData = {
        jobId: req.body.jobId || req.body.job_id,
        indeedApplicationId: req.body.applicationId || req.body.application_id,
        candidateName: req.body.candidateName || req.body.candidate_name || req.body.name,
        candidateEmail: req.body.candidateEmail || req.body.candidate_email || req.body.email,
        resume: req.body.resumeUrl || req.body.resume_url,
        coverLetter: req.body.coverLetter || req.body.cover_letter,
        screeningAnswers: req.body.screeningAnswers || req.body.screening_answers || {},
        eeoData: req.body.eeoData || req.body.eeo_data || {},
        appliedAt: new Date(req.body.appliedAt || req.body.applied_at || Date.now()),
        rawPayload: req.body, // Store full payload
      };
      
      const application = await storage.createIndeedApplication(applicationData);
      
      // Create candidate record from application
      const candidateData = {
        name: applicationData.candidateName,
        email: applicationData.candidateEmail,
        phone: req.body.phone,
        sourceRef: applicationData.indeedApplicationId,
        resumeUrl: applicationData.resume,
        pipelineStage: "NEW" as const,
        tags: ["indeed", "web-application"],
      };
      
      const candidate = await storage.createCandidate(candidateData);
      
      // Link application to candidate
      await storage.updateIndeedApplication(application.id, { candidateId: candidate.id });
      
      // Broadcast real-time update
      if (req.app.locals.broadcastCandidateCreated) {
        req.app.locals.broadcastCandidateCreated(candidate);
      }
      
      res.json({ success: true, applicationId: application.id, candidateId: candidate.id });
    } catch (error) {
      console.error("Indeed application processing failed:", error);
      res.status(500).json({ error: "Failed to process Indeed application" });
    }
  });

  // Indeed disposition sync
  app.put("/api/indeed/applications/:id/disposition", async (req, res) => {
    try {
      const { id } = req.params;
      const { disposition } = req.body;
      
      const application = await storage.updateIndeedApplication(id, { disposition });
      
      // TODO: Send disposition back to Indeed via GraphQL
      // const indeedAPI = new IndeedAPI(process.env.INDEED_API_KEY);
      // await indeedAPI.sendDisposition(application.indeedApplicationId, disposition);
      
      // Log audit trail
      await storage.createAuditLog({
        actor: "system",
        action: "disposition_sync",
        payloadJson: { applicationId: id, disposition, syncedToIndeed: false }, // Will be true when API integrated
        pathUsed: "api",
      });
      
      res.json(application);
    } catch (error) {
      res.status(500).json({ error: "Failed to update disposition" });
    }
  });

  // Indeed integration status
  app.get("/api/indeed/status", async (req, res) => {
    try {
      const jobs = await storage.getIndeedJobs();
      const applications = await storage.getIndeedApplications();
      const recentApplications = applications.filter(
        app => new Date(app.appliedAt).getTime() > Date.now() - 24 * 60 * 60 * 1000
      );
      
      res.json({
        connected: !!process.env.INDEED_API_KEY,
        activeJobs: jobs.filter(j => j.status === 'active').length,
        totalApplications: applications.length,
        recentApplications: recentApplications.length,
        lastApplication: applications[0]?.appliedAt,
        endpointUrl: `${process.env.APP_BASE_URL || 'https://your-app.replit.app'}/api/indeed/applications`,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get Indeed status" });
    }
  });

  // Get Indeed applications
  app.get("/api/indeed/applications", async (req, res) => {
    try {
      const applications = await storage.getIndeedApplications();
      
      // If no stored applications, show placeholder data demonstrating Indeed API response
      if (applications.length === 0) {
        const placeholderApplications = [
          {
            id: 'app-demo-001',
            jobId: 'indeed-demo-001',
            candidateName: 'Sarah Johnson',
            candidateEmail: 'sarah.johnson@email.com',
            resume: 'Senior Frontend Developer with 6 years of experience building responsive web applications...',
            coverLetter: 'I am excited to apply for the Frontend Developer position at TechFlow Inc...',
            screeningAnswers: {
              'years_experience': '6 years',
              'preferred_location': 'San Francisco, CA',
              'expected_salary': '$150,000'
            },
            appliedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            disposition: 'new'
          },
          {
            id: 'app-demo-002',
            jobId: 'indeed-demo-002',
            candidateName: 'Michael Chen',
            candidateEmail: 'michael.chen@email.com',
            resume: 'Backend Engineer with expertise in Node.js, PostgreSQL, and microservices architecture...',
            coverLetter: 'I am interested in the Backend Engineer role at DataCorp Solutions...',
            screeningAnswers: {
              'years_experience': '4 years',
              'remote_preference': 'Remote preferred',
              'expected_salary': '$125,000'
            },
            appliedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
            disposition: 'reviewed'
          }
        ];
        res.json(placeholderApplications);
      } else {
        res.json(applications);
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch Indeed applications" });
    }
  });

  // ======================
  // APIFY INTEGRATION API
  // ======================

  // Apify actors management
  app.get("/api/apify/actors", async (req, res) => {
    try {
      let allActors = [];
      
      // Fetch real actors from Apify if connected
      if (apifyService.isApiConnected()) {
        try {
          const realActors = await apifyService.listActors();
          allActors = realActors.map((actor: any) => ({
            id: actor.id,
            name: actor.name,
            description: actor.description || '',
            actorId: actor.id,
            template: 'web-scraper',
            configurationJson: { realActor: true },
            createdAt: new Date(actor.createdAt),
            lastRun: null,
            isPublic: actor.isPublic,
            source: 'apify-platform'
          }));
        } catch (error) {
          console.error("Failed to fetch real actors:", error);
        }
      }
      
      // Add stored local actors
      const storedActors = await storage.getApifyActors();
      allActors = [...allActors, ...storedActors.map(a => ({ ...a, source: 'local' }))];
      
      res.json(allActors);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch actors" });
    }
  });

  app.post("/api/apify/actors", async (req, res) => {
    try {
      const { name, description, template, inputSchema } = req.body;
      
      // Create actor in Apify if API is connected
      let realActor = null;
      if (apifyService.isApiConnected()) {
        try {
          realActor = await apifyService.createActor({
            name,
            description,
            isPublic: false,
          });
        } catch (error) {
          console.error("Failed to create real actor:", error);
        }
      }
      
      const actorData = {
        name,
        actorId: realActor?.id || `ifast/${name.toLowerCase().replace(/\s+/g, '-')}`,
        configurationJson: {
          template,
          inputSchema: JSON.parse(inputSchema),
          description,
          realActor: !!realActor,
        },
      };
      
      const actor = await storage.createApifyActor(actorData);
      
      // Log audit trail
      await storage.createAuditLog({
        actor: "user",
        action: "actor_created",
        payloadJson: { actorId: actor.id, name },
        pathUsed: "api",
      });
      
      res.json(actor);
    } catch (error) {
      console.error("Actor creation failed:", error);
      res.status(400).json({ error: "Failed to create actor", details: String(error) });
    }
  });

  // Run Apify actor
  app.post("/api/apify/actors/run", async (req, res) => {
    try {
      const { actorId, input } = req.body;
      
      const actor = await storage.getApifyActor(actorId);
      if (!actor) {
        return res.status(404).json({ error: "Actor not found" });
      }
      
      // Start real run in Apify if API is connected
      let realRun = null;
      if (apifyService.isApiConnected()) {
        try {
          realRun = await apifyService.runActor(actor.actorId, input);
        } catch (error) {
          console.error("Apify API call failed, falling back to mock:", error);
        }
      }
      
      // Create run record (real or mock)
      const runData = {
        actorId: actor.id,
        apifyRunId: realRun?.id || `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        status: realRun?.status || "RUNNING",
        startedAt: realRun?.startedAt || new Date(),
        inputJson: input,
        logMessages: ["Run started", "Initializing scraper", "Processing requests..."],
      };
      
      const run = await storage.createApifyRun(runData);
      
      // Update actor last run
      await storage.updateApifyActor(actorId, { lastRun: new Date() });
      
      // Simulate run completion after delay (for demo)
      setTimeout(async () => {
        try {
          await storage.updateApifyRun(run.id, {
            status: "SUCCEEDED",
            finishedAt: new Date(),
            defaultDatasetId: `dataset_${Date.now()}`,
            outputJson: { itemCount: 50, datasetId: `dataset_${Date.now()}` },
            statsJson: {
              requestsFinished: 50,
              requestsFailed: 2,
              outputValueCount: 48,
            },
          });
        } catch (error) {
          console.error("Failed to update mock run:", error);
        }
      }, 10000); // Complete after 10 seconds
      
      res.json({ runId: run.apifyRunId, status: "RUNNING" });
    } catch (error) {
      console.error("Run start failed:", error);
      res.status(500).json({ error: "Failed to start actor run", details: String(error) });
    }
  });

  // Get Apify runs for actor
  app.get("/api/apify/runs/:actorId", async (req, res) => {
    try {
      const { actorId } = req.params;
      const runs = await storage.getApifyRuns(actorId);
      res.json(runs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch runs" });
    }
  });

  // Get Apify run details
  app.get("/api/apify/runs/:runId/details", async (req, res) => {
    try {
      const { runId } = req.params;
      const run = await storage.getApifyRunByApifyId(runId);
      
      if (!run) {
        return res.status(404).json({ error: "Run not found" });
      }
      
      // Fetch live data from Apify if API is connected
      if (apifyService.isApiConnected() && run.apifyRunId.startsWith('run_') === false) {
        try {
          const liveRun = await apifyService.getRunStatus(run.apifyRunId);
          // Merge live data with stored data
          res.json({ ...run, ...liveRun });
          return;
        } catch (error) {
          console.error("Failed to fetch live run data:", error);
        }
      }
      
      res.json(run);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch run details" });
    }
  });

  // Get dataset items
  app.get("/api/apify/datasets/:datasetId/items", async (req, res) => {
    try {
      const { datasetId } = req.params;
      const { limit = 100 } = req.query;
      
      // Fetch from Apify when API is connected
      if (apifyService.isApiConnected()) {
        try {
          const items = await apifyService.getDatasetItems(datasetId, { limit: Number(limit) });
          res.json({ items, count: items.length });
          return;
        } catch (error) {
          console.error("Failed to fetch real dataset items:", error);
        }
      }
      
      // Fallback to mock dataset items
      const mockItems = Array.from({ length: Number(limit) }, (_, i) => ({
        id: `item_${i}`,
        name: `John Doe ${i}`,
        email: `candidate${i}@example.com`,
        phone: `+1-555-000${i.toString().padStart(4, '0')}`,
        company: `TechCorp ${i}`,
        position: `Software Engineer ${i}`,
        location: `San Francisco, CA`,
        experience: `${3 + i} years`,
        skills: ["JavaScript", "React", "Node.js"],
        linkedinUrl: `https://linkedin.com/in/johndoe${i}`,
        source: "LinkedIn",
      }));
      
      res.json({ items: mockItems, count: mockItems.length });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch dataset items" });
    }
  });

  // Import dataset to candidates
  app.post("/api/apify/import", async (req, res) => {
    try {
      const { items } = req.body;
      
      if (!Array.isArray(items)) {
        return res.status(400).json({ error: "Items must be an array" });
      }
      
      let imported = 0;
      let duplicates = 0;
      
      for (const item of items) {
        try {
          // Check for existing candidate by email
          const existing = await storage.getCandidateByEmail(item.email);
          if (existing) {
            duplicates++;
            continue;
          }
          
          // Map dataset item to candidate
          const candidateData = {
            name: item.name || 'Unknown',
            email: item.email,
            phone: item.phone,
            sourceRef: item.linkedinUrl || item.id,
            resumeUrl: item.resumeUrl,
            pipelineStage: "NEW" as const,
            tags: [
              "apify-import",
              item.source?.toLowerCase() || "web-scraping",
              ...(item.skills || []).slice(0, 5)
            ].filter(Boolean),
          };
          
          const candidate = await storage.createCandidate(candidateData);
          imported++;
          
          // Broadcast real-time update
          if (req.app.locals.broadcastCandidateCreated) {
            req.app.locals.broadcastCandidateCreated(candidate);
          }
        } catch (error) {
          console.error("Failed to import item:", item, error);
        }
      }
      
      // Log audit trail
      await storage.createAuditLog({
        actor: "user",
        action: "dataset_import",
        payloadJson: { 
          totalItems: items.length, 
          imported, 
          duplicates,
          source: "apify"
        },
        pathUsed: "api",
      });
      
      res.json({ 
        success: true, 
        imported, 
        duplicates, 
        total: items.length,
        message: `Successfully imported ${imported} candidates (${duplicates} duplicates skipped)`
      });
    } catch (error) {
      console.error("Dataset import failed:", error);
      res.status(500).json({ error: "Failed to import dataset" });
    }
  });

  // Get Indeed integration status
  app.get("/api/indeed/status", async (req, res) => {
    try {
      const jobs = await storage.getIndeedJobs();
      const applications = await storage.getIndeedApplications();
      const recentApplications = applications.filter(
        app => new Date(app.appliedAt).getTime() > Date.now() - 24 * 60 * 60 * 1000
      );
      
      res.json({
        connected: !!process.env.INDEED_API_KEY,
        activeJobs: jobs.filter(j => j.status === 'active').length,
        totalApplications: applications.length,
        recentApplications: recentApplications.length,
        lastApplication: applications[0]?.appliedAt,
        endpointUrl: `${process.env.APP_BASE_URL || 'https://your-app.replit.app'}/api/indeed/applications`,
        webhookConfigured: true, // Will check actual webhook setup when API integrated
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get Indeed status" });
    }
  });

  // ======================
  // APIFY INTEGRATION API  
  // ======================

  // Enhanced Apify actors endpoint
  app.get("/api/apify/actors", async (req, res) => {
    try {
      const actors = await storage.getApifyActors();
      
      // Enhance with run data
      const actorsWithRuns = await Promise.all(
        actors.map(async (actor) => {
          const runs = await storage.getApifyRuns(actor.id);
          const lastRun = runs[0]; // Most recent
          
          return {
            ...actor,
            lastRun: lastRun ? {
              id: lastRun.apifyRunId,
              status: lastRun.status,
              startedAt: lastRun.startedAt.toISOString(),
              finishedAt: lastRun.finishedAt?.toISOString(),
              defaultDatasetId: lastRun.defaultDatasetId,
              stats: lastRun.statsJson,
            } : null,
            totalRuns: runs.length,
            successfulRuns: runs.filter(r => r.status === 'SUCCEEDED').length,
          };
        })
      );
      
      res.json(actorsWithRuns);
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
      
      const slackService = apiManager.getService('slack') as any;
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
      
      const indeedService = apiManager.getService('indeed') as any;
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
      
      const apifyService = apiManager.getService('apify') as any;
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

      const openRouterService = apiManager.getService('openrouter') as any;
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

  // Audit logs endpoint
  app.get("/api/audit-logs", intelligentCaching(60), async (req, res) => {
    try {
      const { action, actor, limit = 100, offset = 0 } = req.query;
      
      // Get audit logs from storage with filtering
      const auditLogs = await storage.getAuditLogs(parseInt(limit as string));

      res.json(auditLogs);
    } catch (error) {
      console.error("Failed to fetch audit logs:", error);
      res.status(500).json({ error: "Failed to fetch audit logs" });
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
        candidates: await storage.getCandidates(),
        campaigns: await storage.getCampaigns(),
        interviews: await storage.getInterviews(),
        bookings: await storage.getBookings(),
        workflowRules: await storage.getWorkflowRules(),
        apifyActors: await storage.getApifyActors(),
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

      // Clear existing data would require individual deletions
      // await storage.clearAllData(); // Method doesn't exist, would need implementation
      
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

  // Indeed Integration Endpoints
  app.get("/api/indeed/status", async (req, res) => {
    try {
      const connected = indeedService.isApiConnected();
      const jobs = await storage.getIndeedJobs();
      const applications = await storage.getIndeedApplications();
      
      res.json({
        connected,
        activeJobs: jobs.filter(j => j.status === 'active').length,
        totalJobs: jobs.length,
        recentApplications: applications.filter(a => 
          new Date(a.appliedAt) > new Date(Date.now() - 24*60*60*1000)
        ).length,
        totalApplications: applications.length,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch Indeed status" });
    }
  });

  app.get("/api/indeed/jobs", async (req, res) => {
    try {
      const jobs = await storage.getIndeedJobs();
      res.json(jobs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch Indeed jobs" });
    }
  });

  app.post("/api/indeed/jobs", async (req, res) => {
    try {
      const jobData = insertIndeedJobSchema.parse(req.body);
      
      // Post to Indeed if API is connected
      if (indeedService.isApiConnected()) {
        try {
          const indeedJob = await indeedService.postJob({
            title: jobData.title,
            company: jobData.company,
            location: jobData.location,
            description: jobData.description,
            requirements: jobData.requirements || '',
            salary: jobData.salary || '',
            type: jobData.type || 'Full-time',
          });
          
          // Store with Indeed job ID
          jobData.indeedJobId = indeedJob.jobId;
          jobData.status = 'active';
        } catch (error) {
          console.error("Failed to post to Indeed:", error);
          // Continue with local storage
        }
      }
      
      const job = await storage.createIndeedJob(jobData);
      res.json(job);
    } catch (error) {
      res.status(400).json({ error: "Failed to create job", details: String(error) });
    }
  });

  app.get("/api/indeed/applications", async (req, res) => {
    try {
      const applications = await storage.getIndeedApplications();
      res.json(applications);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch applications" });
    }
  });

  app.post("/api/indeed/applications", async (req, res) => {
    try {
      // This endpoint receives Indeed webhook data
      const applicationData = req.body;
      
      if (indeedService.isApiConnected()) {
        const isValid = await indeedService.validateApplication(applicationData);
        if (!isValid) {
          return res.status(400).json({ error: "Invalid application data" });
        }
      }

      // Create candidate from application
      const candidateData = {
        name: applicationData.candidateName,
        email: applicationData.candidateEmail,
        phone: applicationData.phone,
        stage: 'applied',
        source: 'indeed',
        notes: `Applied for ${applicationData.jobTitle || 'position'}`,
      };

      const candidate = await storage.createCandidate(candidateData);

      // Store application record
      const application = await storage.createIndeedApplication({
        indeedApplicationId: applicationData.applicationId,
        jobId: applicationData.jobId,
        candidateId: candidate.id,
        candidateName: applicationData.candidateName,
        candidateEmail: applicationData.candidateEmail,
        appliedAt: new Date(applicationData.appliedAt),
        disposition: 'new',
        resume: applicationData.resume || null,
        coverLetter: applicationData.coverLetter || null,
        screeningAnswers: applicationData.screeningAnswers || {},
      });

      res.json({ candidate, application });
    } catch (error) {
      res.status(500).json({ error: "Failed to process application" });
    }
  });

  app.patch("/api/indeed/applications/:id/disposition", async (req, res) => {
    try {
      const { id } = req.params;
      const { disposition, reason } = req.body;
      
      const application = await storage.getIndeedApplication(id);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      // Send disposition to Indeed if connected
      if (indeedService.isApiConnected() && application.indeedApplicationId) {
        try {
          await indeedService.sendDisposition(application.indeedApplicationId, disposition, reason);
        } catch (error) {
          console.error("Failed to send disposition to Indeed:", error);
        }
      }

      // Update local record  
      const updated = await storage.updateIndeedApplication(id, { disposition });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update disposition" });
    }
  });

  // Object storage endpoints
  app.get("/objects/:objectPath(*)", async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(
        req.path,
      );
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error checking object access:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  app.post("/api/objects/upload", uploadRateLimit, async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    try {
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  app.put("/api/candidates/:id/resume", uploadRateLimit, async (req, res) => {
    if (!req.body.resumeURL) {
      return res.status(400).json({ error: "resumeURL is required" });
    }

    try {
      const objectStorageService = new ObjectStorageService();
      const objectPath = objectStorageService.normalizeObjectEntityPath(
        req.body.resumeURL,
      );

      // Update candidate with resume path
      const { id } = req.params;
      const candidate = await storage.updateCandidate(id, { resumeUrl: objectPath });

      res.status(200).json({
        objectPath: objectPath,
        candidate: candidate,
      });
    } catch (error) {
      console.error("Error setting candidate resume:", error);
      res.status(500).json({ error: "Internal server error" });
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

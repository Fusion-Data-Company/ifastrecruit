import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { insertCandidateSchema, insertCampaignSchema, insertInterviewSchema, insertBookingSchema } from "@shared/schema";
import { mcpServer } from "./mcp/server";
import { setupSSE } from "./services/sse";
import { WebSocketServer } from "ws";
import crypto from "crypto";

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

  return httpServer;
}

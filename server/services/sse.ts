import type { Express } from "express";
import { storage } from "../storage";

export function setupSSE(app: Express) {
  // Store SSE clients
  app.locals.sseClients = new Set();

  app.get("/api/sse", (req, res) => {
    // Set SSE headers
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Cache-Control",
    });

    // Send initial connection event
    res.write("event: connected\n");
    res.write("data: {\"status\":\"connected\",\"timestamp\":\"" + new Date().toISOString() + "\"}\n\n");

    // Add client to the set
    app.locals.sseClients.add(res);

    // Send periodic ping
    const pingInterval = setInterval(() => {
      try {
        res.write("event: ping\n");
        res.write("data: {\"timestamp\":\"" + new Date().toISOString() + "\"}\n\n");
      } catch (error) {
        // Client disconnected
        clearInterval(pingInterval);
        app.locals.sseClients.delete(res);
      }
    }, 30000);

    // Handle client disconnect
    req.on("close", () => {
      clearInterval(pingInterval);
      app.locals.sseClients.delete(res);
    });

    req.on("error", () => {
      clearInterval(pingInterval);
      app.locals.sseClients.delete(res);
    });
  });

  // Utility function to broadcast SSE events
  app.locals.broadcastSSE = (event: string, data: any) => {
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    
    app.locals.sseClients.forEach((client: any) => {
      try {
        client.write(message);
      } catch (error) {
        app.locals.sseClients.delete(client);
      }
    });
  };

  // Utility functions for specific event types
  app.locals.broadcastCandidateCreated = (candidate: any) => {
    app.locals.broadcastSSE("candidate-created", {
      id: candidate.id,
      name: candidate.name,
      email: candidate.email,
      pipelineStage: candidate.pipelineStage,
      source: candidate.campaignId ? 'Campaign' : 'Manual',
      timestamp: new Date().toISOString()
    });
  };

  app.locals.broadcastCandidateUpdated = (candidate: any, changes: any) => {
    app.locals.broadcastSSE("candidate-updated", {
      id: candidate.id,
      name: candidate.name,
      pipelineStage: candidate.pipelineStage,
      changes,
      timestamp: new Date().toISOString()
    });
  };

  app.locals.broadcastInterviewScheduled = (interview: any) => {
    app.locals.broadcastSSE("interview-scheduled", {
      id: interview.id,
      candidateName: interview.candidateName,
      startTs: interview.startTs,
      type: interview.type,
      timestamp: new Date().toISOString()
    });
  };

  app.locals.broadcastSystemEvent = (level: string, message: string, details?: any) => {
    app.locals.broadcastSSE("system-event", {
      level,
      message,
      details,
      timestamp: new Date().toISOString()
    });
  };

  app.locals.broadcastBulkOperation = (action: string, count: number, details?: any) => {
    app.locals.broadcastSSE("bulk-operation", {
      action,
      count,
      details,
      timestamp: new Date().toISOString()
    });
  };

  // KPI updates every 30 seconds
  setInterval(async () => {
    try {
      const kpis = await storage.getKPIs();
      app.locals.broadcastSSE("kpis-updated", kpis);
    } catch (error) {
      console.error("Failed to broadcast KPI updates:", error);
    }
  }, 30000);

  // Send initial system event
  setTimeout(() => {
    app.locals.broadcastSystemEvent("info", "iFast Broker system initialized and ready");
  }, 2000);

  console.log("SSE service initialized");
}

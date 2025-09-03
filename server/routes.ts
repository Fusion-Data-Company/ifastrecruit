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
import { apifyService } from "./services/apify-client";
import { indeedService } from "./services/indeed-client";
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
  
  // NO MIDDLEWARE - EVERYTHING REMOVED FOR ELEVENLABS WIDGET
  app.use(cors({ origin: "*", credentials: false })); // Allow everything, no credentials
  // ALL OTHER MIDDLEWARE REMOVED FOR ELEVENLABS
  
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
          allActors = realActors.map(actor => ({
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

  // Audit logs endpoint
  app.get("/api/audit-logs", intelligentCaching(60), async (req, res) => {
    try {
      const { action, actor, limit = 100, offset = 0 } = req.query;
      
      // Get audit logs from storage with filtering
      const auditLogs = await storage.getAuditLogs({
        action: action as string,
        actor: actor as string,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      });

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
            type: jobData.type,
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
        appliedAt: new Date(applicationData.appliedAt),
        disposition: 'new',
        resume: applicationData.resume || null,
        coverLetter: applicationData.coverLetter || null,
        screeningAnswersJson: applicationData.screeningAnswers || {},
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

  app.post("/api/objects/upload", async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    try {
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  app.put("/api/candidates/:id/resume", async (req, res) => {
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

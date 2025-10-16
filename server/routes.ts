import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { 
  insertCandidateSchema, 
  insertCampaignSchema, 
  insertInterviewSchema, 
  insertBookingSchema,
  insertApifyActorSchema,
  insertApifyRunSchema,
  insertPlatformConversationSchema,
  insertConversationContextSchema,
  insertConversationMemorySchema
} from "@shared/schema";
import {
  ObjectStorageService,
  ObjectNotFoundError,
} from "./objectStorage";
import { fileStorageService } from "./services/file-storage";
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
  validateSignedUrl, 
  validateFileAccess, 
  fileDownloadRateLimit,
  generateSignedUrl,
  validateAdminApiKey
} from "./middleware/file-security";
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
import { db } from "./db";
import { users, channels } from "@shared/schema";
import { sql, eq } from "drizzle-orm";
import { runProductionReadinessChecks, getDeploymentHealth } from "../deployment.config";
import { apifyService } from "./services/apify-client";
import { elevenlabsIntegration } from "./integrations/elevenlabs";
import { elevenLabsAutomation } from "./services/elevenlabs-automation";
import { elevenLabsReconciliation } from "./services/elevenlabs-reconciliation";
import { syncMonitoringRouter } from "./routes/sync-monitoring";
import { WebSocketServer } from "ws";
import crypto from "crypto";
import cors from "cors";
import { setupAuth, isAuthenticated, isAdmin } from "./replitAuth";
import { messengerWS } from "./services/messenger-websocket";
import { jasonAI } from "./services/jason-ai-persona";
import { jasonPerez } from "./services/jasonPerezService";
import multer from "multer";
import path from "path";
import { promises as fs } from "fs";
import { resumeParser } from "./services/resume-parser";

// Configure multer for file uploads
const uploadStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads');
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const sanitizedOriginalName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9-_]/g, '_');
    cb(null, `${sanitizedOriginalName}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage: uploadStorage,
  limits: { 
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.doc', '.docx', '.txt', '.png', '.jpg', '.jpeg', '.gif'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not supported. Allowed types: ${allowedTypes.join(', ')}`));
    }
  }
});

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
  
  // Setup Replit Auth FIRST (before other middleware)
  await setupAuth(app);
  
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
  
  // Initialize messenger WebSocket service
  messengerWS.initialize(httpServer);
  
  // Setup SSE for real-time updates
  setupSSE(app);

  // Initialize ElevenLabs automation service with SSE broadcasting
  if (app.locals.broadcastSSE) {
    elevenLabsAutomation.setBroadcastFunction(app.locals.broadcastSSE);
    console.log("[ElevenLabs Automation] SSE broadcasting configured");
    
    // DISABLED: ElevenLabs automation polling to reduce log noise
    // To re-enable, uncomment the following section:
    /*
    // Start automated polling after a delay to ensure system is ready
    setTimeout(async () => {
      try {
        await elevenLabsAutomation.startPolling();
        console.log("[ElevenLabs Automation] Automated polling started successfully");
      } catch (error) {
        console.error("[ElevenLabs Automation] Failed to start automated polling:", error);
      }
    }, 10000); // 10 second delay
    */
    console.log("[ElevenLabs Automation] Automatic polling is DISABLED - use manual trigger endpoint if needed");
  }

  // Health check
  app.get("/api/health", async (req, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
  });

  // ===== DEVELOPMENT BYPASS ROUTES - DO NOT USE IN PRODUCTION =====
  // Development bypass route for messenger - NO AUTHENTICATION REQUIRED
  app.get('/api/dev/messenger/user', async (req, res) => {
    console.log('[DEV BYPASS] Returning mock user for dev messenger');
    
    try {
      // Look for an existing admin user with the dev email
      const devEmail = 'rob@fusiondataco.com';
      let mockUser = await storage.getUserByEmail(devEmail);
      
      if (!mockUser) {
        // Create a new mock user if none exists with this email
        const mockUserId = 'dev-user-rob-' + Date.now(); // Unique ID to avoid conflicts
        mockUser = await db.insert(users).values({
          id: mockUserId,
          email: devEmail,
          firstName: 'Rob',
          lastName: 'Developer',
          isAdmin: true,
          hasFloridaLicense: true,
          isMultiStateLicensed: true,
          licensedStates: ['FL', 'CA', 'TX', 'NY', 'GA', 'NC', 'VA'],
          onboardingCompleted: true,
          onlineStatus: 'online',
          profileImageUrl: null,
          phone: '555-0100',
          createdAt: new Date(),
          updatedAt: new Date()
        }).returning().then(rows => rows[0]);
        
        console.log('[DEV BYPASS] Created mock user:', mockUser.email);
      } else {
        // Update existing user to ensure they have the right permissions
        mockUser = await db.update(users)
          .set({
            isAdmin: true,
            hasFloridaLicense: true,
            isMultiStateLicensed: true,
            licensedStates: ['FL', 'CA', 'TX', 'NY', 'GA', 'NC', 'VA'],
            onboardingCompleted: true,
            onlineStatus: 'online',
            updatedAt: new Date()
          })
          .where(eq(users.email, devEmail))
          .returning()
          .then(rows => rows[0]);
          
        console.log('[DEV BYPASS] Using existing user:', mockUser.email);
      }
      
      // Ensure this user is in the required channels
      const allChannels = await db.select().from(channels);
      for (const channel of allChannels) {
        try {
          await storage.joinChannel(mockUser.id, channel.id);
          console.log(`[DEV BYPASS] Added user to channel: ${channel.name}`);
        } catch (e) {
          // Channel membership might already exist
        }
      }
      
      res.json(mockUser);
    } catch (error) {
      console.error('[DEV BYPASS] Error creating/fetching mock user:', error);
      res.status(500).json({ message: 'Failed to create dev user', error: String(error) });
    }
  });

  // Dev bypass for onboarding status - always returns completed
  app.get('/api/dev/messenger/onboarding/status', async (req, res) => {
    console.log('[DEV BYPASS] Returning completed onboarding status');
    res.json({
      hasCompleted: true,
      currentLicensingInfo: {
        hasFloridaLicense: true,
        isMultiStateLicensed: true,
        licensedStates: ['FL', 'CA', 'TX', 'NY', 'GA', 'NC', 'VA']
      }
    });
  });

  // Dev bypass versions of all messenger-related routes (NO AUTH)
  
  // Dev bypass user search for @mentions
  app.get('/api/dev/messenger/users/search', async (req, res) => {
    try {
      const { q: query, channelId } = req.query;
      const devUser = await storage.getUserByEmail('rob@fusiondataco.com');
      
      if (!devUser) {
        return res.status(404).json({ message: 'Dev user not found. Access /dev/messenger first.' });
      }

      if (!query || typeof query !== 'string') {
        return res.json([]);
      }

      // Search users - for channel mentions, get channel members; for DMs, get all available users
      let searchResults;
      if (channelId && typeof channelId === 'string') {
        // Get channel members for channel-specific mentions
        searchResults = await storage.searchChannelMembers(channelId, query.toLowerCase(), 10);
      } else {
        // Get all users for DM mentions (dev user is admin)
        searchResults = await storage.searchUsers(query.toLowerCase(), devUser.id, true, 10);
      }
      
      // Format users for frontend autocomplete
      const formattedUsers = searchResults.map(user => ({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        isAdmin: user.isAdmin,
        onlineStatus: user.onlineStatus || 'offline',
        profileImageUrl: user.profileImageUrl,
        mentionText: user.firstName && user.lastName 
          ? `@${user.firstName}_${user.lastName}`.replace(/\s+/g, '_')
          : `@${user.firstName || user.email.split('@')[0]}`
      }));

      res.json(formattedUsers);
    } catch (error) {
      console.error("[DEV BYPASS] Error searching users:", error);
      res.status(500).json({ message: "Failed to search users" });
    }
  });
  
  app.get('/api/dev/messenger/channels', async (req, res) => {
    try {
      // Get the dev user first
      const devUser = await storage.getUserByEmail('rob@fusiondataco.com');
      if (!devUser) {
        return res.status(404).json({ message: 'Dev user not found. Access /dev/messenger first.' });
      }
      const channels = await storage.getUserChannels(devUser.id);
      const channelDetails = await Promise.all(
        channels.map(uc => storage.getChannel(uc.channelId))
      );
      res.json(channelDetails.filter(Boolean));
    } catch (error) {
      console.error("[DEV BYPASS] Error fetching channels:", error);
      res.status(500).json({ message: "Failed to fetch channels" });
    }
  });

  app.get('/api/dev/messenger/channels/:channelId/messages', async (req, res) => {
    try {
      const { channelId } = req.params;
      const messages = await storage.getChannelMessages(channelId, 100);
      res.json(messages);
    } catch (error) {
      console.error("[DEV BYPASS] Error fetching messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.get('/api/dev/messenger/direct-messages/conversations', async (req, res) => {
    try {
      const devUser = await storage.getUserByEmail('rob@fusiondataco.com');
      if (!devUser) {
        return res.status(404).json({ message: 'Dev user not found. Access /dev/messenger first.' });
      }
      const conversations = await storage.getUserConversations(devUser.id);
      
      const enrichedConversations = await Promise.all(
        conversations.map(async (conv) => {
          const otherUser = await storage.getUser(conv.userId);
          return {
            userId: conv.userId,
            user: otherUser ? {
              id: otherUser.id,
              firstName: otherUser.firstName,
              lastName: otherUser.lastName,
              email: otherUser.email,
              isAdmin: otherUser.isAdmin,
              onlineStatus: otherUser.onlineStatus
            } : null,
            lastMessage: conv.lastMessage
          };
        })
      );
      
      res.json(enrichedConversations);
    } catch (error) {
      console.error("[DEV BYPASS] Error fetching DM conversations:", error);
      res.status(500).json({ message: "Failed to fetch conversations" });
    }
  });

  app.get('/api/dev/messenger/direct-messages-users', async (req, res) => {
    try {
      const devUser = await storage.getUserByEmail('rob@fusiondataco.com');
      if (!devUser) {
        return res.status(404).json({ message: 'Dev user not found. Access /dev/messenger first.' });
      }
      const allUsers = await db.select().from(users).where(sql`${users.id} != ${devUser.id}`);
      
      res.json(allUsers.map(u => ({
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        isAdmin: u.isAdmin,
        onlineStatus: u.onlineStatus,
        profileImageUrl: u.profileImageUrl
      })));
    } catch (error) {
      console.error("[DEV BYPASS] Error fetching DM users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.get('/api/dev/messenger/direct-messages/:otherUserId', async (req, res) => {
    try {
      const devUser = await storage.getUserByEmail('rob@fusiondataco.com');
      if (!devUser) {
        return res.status(404).json({ message: 'Dev user not found. Access /dev/messenger first.' });
      }
      const { otherUserId } = req.params;
      const messages = await storage.getDirectMessages(devUser.id, otherUserId);
      await storage.markDirectMessagesAsRead(devUser.id, otherUserId);
      res.json(messages);
    } catch (error) {
      console.error("[DEV BYPASS] Error fetching direct messages:", error);
      res.status(500).json({ message: "Failed to fetch direct messages" });
    }
  });
  // ===== END DEVELOPMENT BYPASS ROUTES =====

  // Replit Auth user endpoint
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userEmail = req.user.claims.email;
      
      // First try to get by ID
      let user = await storage.getUser(userId);
      
      // If not found by ID, try by email (handles ID mismatch cases)
      if (!user && userEmail) {
        user = await storage.getUserByEmail(userEmail);
      }
      
      // Debug log to see user details
      console.log("[AUTH DEBUG] User logged in:", {
        email: user?.email,
        isAdmin: user?.isAdmin,
        userId: userId,
        foundById: !!user
      });
      
      if (!user) {
        // User not found - this shouldn't happen after upsertUser in auth flow
        console.error("User not found after authentication:", userId, userEmail);
        res.status(404).json({ message: "User not found" });
        return;
      }
      
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Onboarding status endpoint
  app.get('/api/onboarding/status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const status = await storage.getOnboardingStatus(userId);
      res.json(status);
    } catch (error) {
      console.error("[Onboarding] Error fetching status:", error);
      res.status(500).json({ message: "Failed to fetch onboarding status" });
    }
  });

  // Onboarding completion endpoint with channel assignment
  const onboardingSchema = z.object({
    hasFloridaLicense: z.boolean(),
    isMultiStateLicensed: z.boolean(),
    licensedStates: z.array(z.string()).optional().default([])
  });

  const upload = multer({ dest: 'uploads/' });
  app.post('/api/onboarding/complete', isAuthenticated, upload.fields([
    { name: 'resume', maxCount: 1 },
    { name: 'license', maxCount: 1 }
  ]), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Parse and validate request body
      const bodyData = {
        hasFloridaLicense: req.body.hasFloridaLicense === 'true' || req.body.hasFloridaLicense === true,
        isMultiStateLicensed: req.body.hasMultiStateLicense === 'true' || req.body.hasMultiStateLicense === true || req.body.isMultiStateLicensed === 'true' || req.body.isMultiStateLicensed === true,
        licensedStates: req.body.selectedStates ? (typeof req.body.selectedStates === 'string' ? JSON.parse(req.body.selectedStates) : req.body.selectedStates) : (req.body.licensedStates || [])
      };

      const validatedData = onboardingSchema.parse(bodyData);
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };

      // Complete onboarding using storage method
      const { user: updatedUser, channels: assignedChannels } = await storage.completeOnboarding(userId, validatedData);
      
      const channelNames = assignedChannels.map(c => c.name);

      // Send Jason Perez AI welcome message to each assigned channel  
      for (const channel of assignedChannels) {
        const welcomeMessage = await jasonPerez.generateWelcomeMessage(
          user.firstName || user.email || 'New Candidate',
          channel.name,
          {
            hasFloridaLicense: validatedData.hasFloridaLicense,
            isMultiStateLicensed: validatedData.isMultiStateLicensed,
            states: validatedData.licensedStates
          }
        );

        // Create the welcome message
        await storage.createMessage({
          channelId: channel.id,
          userId: 'system', // Jason AI (system user)
          content: welcomeMessage,
          isAiGenerated: true
        });
      }

      // Handle file uploads with resume parsing
      if (files?.resume) {
        const resumeFile = files.resume[0];
        
        // Parse resume if it's a PDF
        let resumeData = null;
        if (resumeFile.mimetype === 'application/pdf') {
          try {
            const { resumeParser } = await import('./services/resume-parser');
            resumeData = await resumeParser.parseResume(resumeFile.path);
            
            // Update user profile with parsed data
            if (resumeData.email || resumeData.phone) {
              await storage.updateUserProfile(userId, {
                email: resumeData.email,
                phone: resumeData.phone
              });
            }
          } catch (parseError) {
            console.error('[Onboarding] Resume parsing failed:', parseError);
          }
        }
        
        await storage.createFileUpload({
          userId,
          filename: resumeFile.originalname,
          filepath: resumeFile.path,
          fileType: 'resume',
          fileSize: resumeFile.size,
          metadata: resumeData ? {
            parsedName: resumeData.name,
            parsedEmail: resumeData.email,
            parsedPhone: resumeData.phone,
            experience: resumeData.experience,
            education: resumeData.education,
            licenses: resumeData.licenses
          } : null
        });
      }

      if (files?.license) {
        const licenseFile = files.license[0];
        await storage.createFileUpload({
          userId,
          filename: licenseFile.originalname,
          filepath: licenseFile.path,
          fileType: 'license',
          fileSize: licenseFile.size
        });
      }

      res.json({ 
        success: true, 
        channels: channelNames,
        message: "Onboarding completed successfully!" 
      });

      console.log(`[Onboarding] User ${userId} assigned to channels: ${channelNames.join(', ')}`);
      
    } catch (error) {
      console.error("[Onboarding] Error:", error);
      res.status(500).json({ message: "Failed to complete onboarding" });
    }
  });

  // Messenger API endpoints
  app.get('/api/channels', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const channels = await storage.getUserChannels(userId);
      const channelDetails = await Promise.all(
        channels.map(uc => storage.getChannel(uc.channelId))
      );
      res.json(channelDetails.filter(Boolean));
    } catch (error) {
      console.error("Error fetching channels:", error);
      res.status(500).json({ message: "Failed to fetch channels" });
    }
  });

  app.get('/api/channels/:channelId/messages', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { channelId } = req.params;
      
      const hasAccess = await storage.userHasChannelAccess(userId, channelId);
      if (!hasAccess) {
        return res.status(403).json({ message: "No access to this channel" });
      }

      const messages = await storage.getChannelMessages(channelId, 100);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  // Direct Messages API endpoints
  app.get('/api/direct-messages/conversations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const conversations = await storage.getUserConversations(userId);
      
      // Enrich with user details
      const enrichedConversations = await Promise.all(
        conversations.map(async (conv) => {
          const otherUser = await storage.getUser(conv.userId);
          return {
            userId: conv.userId,
            user: otherUser ? {
              id: otherUser.id,
              firstName: otherUser.firstName,
              lastName: otherUser.lastName,
              email: otherUser.email,
              isAdmin: otherUser.isAdmin,
              onlineStatus: otherUser.onlineStatus
            } : null,
            lastMessage: conv.lastMessage
          };
        })
      );
      
      res.json(enrichedConversations);
    } catch (error) {
      console.error("Error fetching DM conversations:", error);
      res.status(500).json({ message: "Failed to fetch conversations" });
    }
  });

  app.get('/api/direct-messages/:otherUserId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { otherUserId } = req.params;
      
      const messages = await storage.getDirectMessages(userId, otherUserId);
      
      // Mark messages as read
      await storage.markDirectMessagesAsRead(userId, otherUserId);
      
      res.json(messages);
    } catch (error) {
      console.error("Error fetching direct messages:", error);
      res.status(500).json({ message: "Failed to fetch direct messages" });
    }
  });

  app.post('/api/direct-messages', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { receiverId, content } = req.body;
      
      if (!receiverId || !content) {
        return res.status(400).json({ message: "Missing receiverId or content" });
      }
      
      const message = await storage.createDirectMessage({
        senderId: userId,
        receiverId,
        content
      });
      
      res.json(message);
    } catch (error) {
      console.error("Error sending direct message:", error);
      res.status(500).json({ message: "Failed to send direct message" });
    }
  });

  // Get list of users available for DMs (admins for regular users, all users for admins)
  app.get('/api/direct-messages-users', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const currentUser = await storage.getUser(userId);
      
      if (!currentUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // For now, get all users - in production you'd filter based on permissions
      const allUsers = await db.select().from(users).where(sql`${users.id} != ${userId}`);
      
      // Filter based on role - regular users see only admins, admins see everyone
      const availableUsers = currentUser.isAdmin 
        ? allUsers 
        : allUsers.filter(u => u.isAdmin);
      
      res.json(availableUsers.map(u => ({
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        isAdmin: u.isAdmin,
        onlineStatus: u.onlineStatus,
        profileImageUrl: u.profileImageUrl
      })));
    } catch (error) {
      console.error("Error fetching DM users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
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

  // ElevenLabs sync verification endpoints
  app.get("/api/elevenlabs/sync/verify", async (req, res) => {
    try {
      const verification = await elevenLabsReconciliation.verifySyncStatus();
      res.json(verification);
    } catch (error) {
      res.status(500).json({ error: "Failed to verify sync status", details: String(error) });
    }
  });

  app.post("/api/elevenlabs/sync/backfill", async (req, res) => {
    try {
      const options = req.body;
      const result = await elevenLabsReconciliation.performBackfill(options);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to perform backfill", details: String(error) });
    }
  });

  app.get("/api/elevenlabs/sync/gaps", async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const gaps = await elevenLabsReconciliation.detectGaps(days);
      res.json(gaps);
    } catch (error) {
      res.status(500).json({ error: "Failed to detect gaps", details: String(error) });
    }
  });

  app.post("/api/elevenlabs/sync/heal", async (req, res) => {
    try {
      const { gaps } = req.body;
      const result = await elevenLabsReconciliation.healGaps(gaps);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to heal gaps", details: String(error) });
    }
  });

  app.get("/api/elevenlabs/health", async (req, res) => {
    try {
      const verification = await elevenLabsReconciliation.verifySyncStatus();
      const health = {
        status: verification.syncHealth,
        sync: verification.status,
        issues: verification.missingCandidates.length + verification.duplicateCandidates.length + verification.invalidCandidates.length,
        lastSync: verification.lastSuccessfulSyncAt,
        metrics: {
          elevenLabsConversations: verification.totalElevenLabsConversations,
          localCandidates: verification.totalLocalCandidates,
          missing: verification.missingCandidates.length,
          duplicates: verification.duplicateCandidates.length,
          invalid: verification.invalidCandidates.length
        }
      };
      res.json(health);
    } catch (error) {
      res.status(500).json({ error: "Failed to get health status", details: String(error) });
    }
  });

  // Audio proxy endpoint for ElevenLabs conversations
  app.get("/api/audio/:conversationId", async (req, res) => {
    try {
      const { conversationId } = req.params;
      
      // Validate conversation ID format
      if (!conversationId || !conversationId.startsWith('conv_')) {
        return res.status(400).json({ error: "Invalid conversation ID format" });
      }

      console.log(`[Audio Proxy] Fetching audio for conversation: ${conversationId}`);
      
      // Get audio data from ElevenLabs
      const audioData = await elevenlabsIntegration.getConversationAudio(conversationId);
      
      if (audioData.audio_url) {
        // If we have a direct URL, redirect to it
        console.log(`[Audio Proxy] Redirecting to audio URL: ${audioData.audio_url}`);
        return res.redirect(audioData.audio_url);
      } else if (audioData.audio_data) {
        // If we have binary data, stream it directly
        console.log(`[Audio Proxy] Streaming binary audio data for conversation: ${conversationId}`);
        
        const contentType = audioData.content_type || 'audio/mpeg';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `inline; filename="${conversationId}.mp3"`);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        
        // Convert ArrayBuffer to Buffer and send
        const buffer = Buffer.from(audioData.audio_data);
        return res.send(buffer);
      } else {
        console.log(`[Audio Proxy] No audio data found for conversation: ${conversationId}`);
        return res.status(404).json({ error: "Audio not found for this conversation" });
      }
    } catch (error) {
      console.error(`[Audio Proxy] Error serving audio for conversation ${req.params.conversationId}:`, error);
      res.status(500).json({ 
        error: "Failed to fetch audio recording", 
        details: String(error)
      });
    }
  });

  // Mount sync monitoring routes
  app.use("/api/sync", syncMonitoringRouter);

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

  // =========================
  // PHASE 3: CONVERSATION CONTEXT API
  // =========================

  // Platform Conversation endpoints
  app.get("/api/conversations", async (req, res) => {
    try {
      const { page = 1, limit = 50 } = req.query;
      const conversations = await storage.getPlatformConversations(Number(page), Number(limit));
      res.json(conversations);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  app.get("/api/conversations/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const conversation = await storage.getPlatformConversation(id);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      res.json(conversation);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch conversation" });
    }
  });

  app.post("/api/conversations", async (req, res) => {
    try {
      const conversationData = insertPlatformConversationSchema.parse(req.body);
      const conversation = await storage.createPlatformConversation(conversationData);
      res.json(conversation);
    } catch (error) {
      res.status(400).json({ error: "Invalid conversation data", details: String(error) });
    }
  });

  app.patch("/api/conversations/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const conversation = await storage.updatePlatformConversation(id, updates);
      res.json(conversation);
    } catch (error) {
      res.status(500).json({ error: "Failed to update conversation" });
    }
  });

  // Conversation Context endpoints
  app.get("/api/conversations/:conversationId/context", async (req, res) => {
    try {
      const { conversationId } = req.params;
      const contextEntries = await storage.getConversationContexts(conversationId);
      res.json(contextEntries);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch conversation context" });
    }
  });

  app.post("/api/conversations/:conversationId/context", async (req, res) => {
    try {
      const { conversationId } = req.params;
      const contextData = insertConversationContextSchema.parse({
        ...req.body,
        platformConversationId: conversationId
      });
      const context = await storage.createConversationContext(contextData);
      res.json(context);
    } catch (error) {
      res.status(400).json({ error: "Invalid context data", details: String(error) });
    }
  });

  app.patch("/api/context/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const context = await storage.updateConversationContext(id, updates);
      res.json(context);
    } catch (error) {
      res.status(500).json({ error: "Failed to update context" });
    }
  });

  app.delete("/api/context/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteConversationContext(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete context" });
    }
  });

  // Conversation Memory endpoints
  app.get("/api/memory/:agentId", async (req, res) => {
    try {
      const { agentId } = req.params;
      const { limit = 100 } = req.query;
      const memories = await storage.getConversationMemoryByAgent(agentId, Number(limit));
      res.json(memories);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch agent memory" });
    }
  });

  app.post("/api/memory", async (req, res) => {
    try {
      const memoryData = insertConversationMemorySchema.parse(req.body);
      const memory = await storage.createConversationMemory(memoryData);
      res.json(memory);
    } catch (error) {
      res.status(400).json({ error: "Invalid memory data", details: String(error) });
    }
  });

  app.patch("/api/memory/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const memory = await storage.updateConversationMemory(id, updates);
      res.json(memory);
    } catch (error) {
      res.status(500).json({ error: "Failed to update memory" });
    }
  });

  app.delete("/api/memory/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteConversationMemory(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete memory" });
    }
  });

  app.post("/api/memory/:id/use", async (req, res) => {
    try {
      const { id } = req.params;
      const memory = await storage.incrementMemoryUsage(id);
      res.json(memory);
    } catch (error) {
      res.status(500).json({ error: "Failed to increment memory usage" });
    }
  });

  app.post("/api/memory/search", async (req, res) => {
    try {
      const { agentId, searchTerms, memoryTypes } = req.body;
      if (!agentId || !Array.isArray(searchTerms)) {
        return res.status(400).json({ error: "agentId and searchTerms (array) are required" });
      }
      const memories = await storage.searchConversationMemory(agentId, searchTerms, memoryTypes);
      res.json(memories);
    } catch (error) {
      res.status(500).json({ error: "Failed to search memory" });
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
  // JASON AI ADMIN ENDPOINTS
  // =========================
  
  // GET /api/admin/jason/settings - Get all Jason settings
  app.get("/api/admin/jason/settings", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const settings = await storage.getJasonSettings();
      res.json(settings);
    } catch (error) {
      console.error("[Jason Admin] Error fetching settings:", error);
      res.status(500).json({ error: "Failed to fetch Jason settings" });
    }
  });

  // PUT /api/admin/jason/settings - Update Jason settings
  app.put("/api/admin/jason/settings", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const userId = (req.user as any)?.id;
      const { settingKey, settingValue, category, description } = req.body;
      
      if (!settingKey || !settingValue) {
        return res.status(400).json({ error: "Setting key and value are required" });
      }

      const existingSetting = await storage.getJasonSetting(settingKey);
      
      let updatedSetting;
      if (existingSetting) {
        updatedSetting = await storage.updateJasonSetting(settingKey, settingValue, userId);
      } else {
        updatedSetting = await storage.createJasonSetting({
          settingKey,
          settingValue,
          category: category || 'general',
          description,
          updatedBy: userId
        });
      }

      res.json(updatedSetting);
    } catch (error) {
      console.error("[Jason Admin] Error updating settings:", error);
      res.status(500).json({ error: "Failed to update Jason settings" });
    }
  });

  // GET /api/admin/jason/templates - Get all templates
  app.get("/api/admin/jason/templates", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { channelTier } = req.query;
      const templates = await storage.getJasonTemplates(channelTier as string | undefined);
      res.json(templates);
    } catch (error) {
      console.error("[Jason Admin] Error fetching templates:", error);
      res.status(500).json({ error: "Failed to fetch templates" });
    }
  });

  // POST /api/admin/jason/templates - Create new template
  app.post("/api/admin/jason/templates", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const userId = (req.user as any)?.id;
      const { templateName, templateType, channelTier, template, variables, tags } = req.body;
      
      if (!templateName || !templateType || !template) {
        return res.status(400).json({ error: "Template name, type, and content are required" });
      }

      const newTemplate = await storage.createJasonTemplate({
        templateName,
        templateType,
        channelTier,
        template,
        variables: variables || [],
        tags: tags || [],
        updatedBy: userId
      });

      res.json(newTemplate);
    } catch (error) {
      console.error("[Jason Admin] Error creating template:", error);
      res.status(500).json({ error: "Failed to create template" });
    }
  });

  // PUT /api/admin/jason/templates/:id - Update template
  app.put("/api/admin/jason/templates/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = (req.user as any)?.id;
      const updates = { ...req.body, updatedBy: userId };
      
      const updatedTemplate = await storage.updateJasonTemplate(id, updates);
      res.json(updatedTemplate);
    } catch (error) {
      console.error("[Jason Admin] Error updating template:", error);
      res.status(500).json({ error: "Failed to update template" });
    }
  });

  // DELETE /api/admin/jason/templates/:id - Delete template
  app.delete("/api/admin/jason/templates/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteJasonTemplate(id);
      res.json({ success: true });
    } catch (error) {
      console.error("[Jason Admin] Error deleting template:", error);
      res.status(500).json({ error: "Failed to delete template" });
    }
  });

  // GET /api/admin/jason/channel-behaviors - Get all channel behaviors
  app.get("/api/admin/jason/channel-behaviors", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const behaviors = await storage.getJasonChannelBehaviors();
      res.json(behaviors);
    } catch (error) {
      console.error("[Jason Admin] Error fetching channel behaviors:", error);
      res.status(500).json({ error: "Failed to fetch channel behaviors" });
    }
  });

  // PUT /api/admin/jason/channel-behaviors/:channelId - Update channel behavior
  app.put("/api/admin/jason/channel-behaviors/:channelId", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { channelId } = req.params;
      const userId = (req.user as any)?.id;
      const behavior = { ...req.body, updatedBy: userId };
      
      const updatedBehavior = await storage.upsertJasonChannelBehavior(channelId, behavior);
      res.json(updatedBehavior);
    } catch (error) {
      console.error("[Jason Admin] Error updating channel behavior:", error);
      res.status(500).json({ error: "Failed to update channel behavior" });
    }
  });

  // =========================
  // MESSENGER DM API ENDPOINTS
  // =========================
  
  // GET /api/messenger/users/search - Search users for @mentions
  app.get("/api/messenger/users/search", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.id;
      const { q: query, channelId } = req.query;
      
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      if (!query || typeof query !== 'string') {
        return res.json([]);
      }

      const currentUser = await storage.getUser(userId);
      if (!currentUser) {
        return res.status(404).json({ error: "User not found" });
      }

      // Search users - for channel mentions, get channel members; for DMs, get all available users
      let searchResults;
      if (channelId && typeof channelId === 'string') {
        // Get channel members for channel-specific mentions
        searchResults = await storage.searchChannelMembers(channelId, query.toLowerCase(), 10);
      } else {
        // Get all users for DM mentions (considering permissions)
        searchResults = await storage.searchUsers(query.toLowerCase(), userId, currentUser.isAdmin, 10);
      }
      
      // Format users for frontend autocomplete
      const formattedUsers = searchResults.map(user => ({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        isAdmin: user.isAdmin,
        onlineStatus: user.onlineStatus || 'offline',
        profileImageUrl: user.profileImageUrl,
        mentionText: user.firstName && user.lastName 
          ? `@${user.firstName}_${user.lastName}`.replace(/\s+/g, '_')
          : `@${user.firstName || user.email.split('@')[0]}`
      }));

      res.json(formattedUsers);
    } catch (error) {
      console.error("[Messenger] Error searching users:", error);
      res.status(500).json({ error: "Failed to search users" });
    }
  });
  
  // GET /api/messenger/dm/users - List all users available for DM (admins see all, users see admins only)
  app.get("/api/messenger/dm/users", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.id;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const currentUser = await storage.getUser(userId);
      if (!currentUser) {
        return res.status(404).json({ error: "User not found" });
      }

      const dmUsers = await storage.getDMUsers(userId, currentUser.isAdmin);
      
      // Format users for frontend
      const formattedUsers = dmUsers.map(user => ({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        isAdmin: user.isAdmin,
        onlineStatus: user.onlineStatus || 'offline',
        profileImageUrl: user.profileImageUrl,
        hasFloridaLicense: user.hasFloridaLicense,
        isMultiStateLicensed: user.isMultiStateLicensed
      }));

      res.json(formattedUsers);
    } catch (error) {
      console.error("[Messenger DM] Error fetching DM users:", error);
      res.status(500).json({ error: "Failed to fetch DM users" });
    }
  });

  // GET /api/messenger/dm/conversations - Get user's DM conversations
  app.get("/api/messenger/dm/conversations", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.id;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const conversations = await storage.getUserConversations(userId);
      const unreadCounts = await storage.getUnreadCounts(userId);
      
      // Enrich conversations with user info and unread counts
      const enrichedConversations = await Promise.all(
        conversations.map(async (conv) => {
          const otherUser = await storage.getUser(conv.userId);
          return {
            userId: conv.userId,
            user: otherUser ? {
              id: otherUser.id,
              firstName: otherUser.firstName,
              lastName: otherUser.lastName,
              email: otherUser.email,
              isAdmin: otherUser.isAdmin,
              onlineStatus: otherUser.onlineStatus || 'offline',
              profileImageUrl: otherUser.profileImageUrl,
              hasFloridaLicense: otherUser.hasFloridaLicense,
              isMultiStateLicensed: otherUser.isMultiStateLicensed
            } : null,
            lastMessage: conv.lastMessage,
            unreadCount: unreadCounts[conv.userId] || 0
          };
        })
      );
      
      res.json(enrichedConversations);
    } catch (error) {
      console.error("[Messenger DM] Error fetching DM conversations:", error);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  // GET /api/messenger/dm/messages/:userId - Get messages between current user and another user
  app.get("/api/messenger/dm/messages/:userId", isAuthenticated, async (req, res) => {
    try {
      const currentUserId = (req.user as any)?.id;
      if (!currentUserId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { userId: otherUserId } = req.params;
      
      // Get messages between users
      const messages = await storage.getDMMessages(currentUserId, otherUserId);
      
      // Mark messages as read
      await storage.markDMAsRead(currentUserId, otherUserId);
      
      res.json(messages);
    } catch (error) {
      console.error("[Messenger DM] Error fetching messages:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  // POST /api/messenger/dm/send - Send a direct message
  app.post("/api/messenger/dm/send", isAuthenticated, async (req, res) => {
    try {
      const senderId = (req.user as any)?.id;
      if (!senderId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { recipientId, content, fileUrl, fileName } = req.body;
      
      if (!recipientId || !content) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Send the direct message
      const message = await storage.sendDM(senderId, recipientId, content, fileUrl, fileName);
      
      // Emit WebSocket event for real-time delivery
      messengerWS.broadcast({
        type: 'dm_message',
        payload: {
          message,
          senderId,
          recipientId
        }
      });
      
      res.json(message);
    } catch (error) {
      console.error("[Messenger DM] Error sending message:", error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  // PUT /api/messenger/dm/read/:userId - Mark messages as read
  app.put("/api/messenger/dm/read/:userId", isAuthenticated, async (req, res) => {
    try {
      const recipientId = (req.user as any)?.id;
      if (!recipientId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { userId: senderId } = req.params;
      
      await storage.markDMAsRead(recipientId, senderId);
      
      // Emit WebSocket event for read receipt
      messengerWS.broadcast({
        type: 'mark_read',
        payload: {
          recipientId,
          senderId
        }
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("[Messenger DM] Error marking messages as read:", error);
      res.status(500).json({ error: "Failed to mark messages as read" });
    }
  });

  // GET /api/messenger/dm/unread - Get unread message counts
  app.get("/api/messenger/dm/unread", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.id;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const unreadCounts = await storage.getUnreadCounts(userId);
      
      // Calculate total unread count
      const totalUnread = Object.values(unreadCounts).reduce((sum, count) => sum + count, 0);
      
      res.json({
        total: totalUnread,
        bySender: unreadCounts
      });
    } catch (error) {
      console.error("[Messenger DM] Error fetching unread counts:", error);
      res.status(500).json({ error: "Failed to fetch unread counts" });
    }
  });

  // ===== THREAD ROUTES =====
  
  // GET /api/messenger/threads/:messageId - Get thread replies for a channel message
  app.get("/api/messenger/threads/:messageId", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.id;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { messageId } = req.params;
      const replies = await storage.getThreadReplies(messageId);
      
      res.json(replies);
    } catch (error) {
      console.error("[Messenger Threads] Error fetching thread replies:", error);
      res.status(500).json({ error: "Failed to fetch thread replies" });
    }
  });
  
  // POST /api/messenger/threads/reply - Post a reply to a channel thread
  app.post("/api/messenger/threads/reply", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.id;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { parentMessageId, channelId, content, fileUrl, fileName } = req.body;
      
      if (!parentMessageId || !channelId || !content) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Create the thread reply
      const reply = await storage.createThreadReply({
        channelId,
        userId,
        content,
        parentMessageId,
        attachmentId: null,
        messageType: 'text' as const
      });
      
      // Emit WebSocket event for real-time thread update
      messengerWS.broadcast({
        type: 'thread_reply',
        payload: {
          reply,
          parentMessageId,
          channelId
        }
      });
      
      res.json(reply);
    } catch (error) {
      console.error("[Messenger Threads] Error creating thread reply:", error);
      res.status(500).json({ error: "Failed to create thread reply" });
    }
  });
  
  // GET /api/messenger/dm/threads/:messageId - Get thread replies for a direct message
  app.get("/api/messenger/dm/threads/:messageId", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.id;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { messageId } = req.params;
      const replies = await storage.getDirectThreadReplies(messageId);
      
      res.json(replies);
    } catch (error) {
      console.error("[Messenger DM Threads] Error fetching thread replies:", error);
      res.status(500).json({ error: "Failed to fetch thread replies" });
    }
  });
  
  // POST /api/messenger/dm/threads/reply - Post a reply to a DM thread
  app.post("/api/messenger/dm/threads/reply", isAuthenticated, async (req, res) => {
    try {
      const senderId = (req.user as any)?.id;
      if (!senderId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { parentMessageId, receiverId, content, fileUrl, fileName } = req.body;
      
      if (!parentMessageId || !receiverId || !content) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Create the DM thread reply
      const reply = await storage.createDirectThreadReply({
        senderId,
        receiverId,
        content,
        parentMessageId,
        attachmentId: null,
        messageType: 'text' as const,
        isRead: false
      });
      
      // Emit WebSocket event for real-time thread update
      messengerWS.broadcast({
        type: 'dm_thread_reply',
        payload: {
          reply,
          parentMessageId,
          senderId,
          receiverId
        }
      });
      
      res.json(reply);
    } catch (error) {
      console.error("[Messenger DM Threads] Error creating thread reply:", error);
      res.status(500).json({ error: "Failed to create thread reply" });
    }
  });

  // ===== FILE UPLOAD ROUTES =====
  
  // POST /api/messenger/upload - Handle file uploads with resume parsing
  app.post("/api/messenger/upload", isAuthenticated, uploadRateLimit, upload.single('file'), async (req, res) => {
    try {
      const userId = (req.user as any)?.id;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const file = req.file;
      const ext = path.extname(file.originalname).toLowerCase();
      const isResume = ['.pdf', '.doc', '.docx'].includes(ext);
      
      // Generate public URL for the file
      const fileUrl = `/uploads/${file.filename}`;
      
      // Save file metadata to database
      const fileUpload = await storage.saveFileUpload(
        userId,
        file.originalname,
        file.mimetype,
        fileUrl,
        file.size,
        isResume
      );

      // If it's a resume, parse it asynchronously
      if (isResume && ext === '.pdf') {
        try {
          const resumeData = await resumeParser.parseResume(file.path);
          
          // Update the file with parsed data
          await storage.updateParsedData(fileUpload.id, resumeData, 'parsed');
          
          // Emit WebSocket event for resume parsed
          messengerWS.broadcast({
            type: 'resume_parsed',
            payload: {
              fileId: fileUpload.id,
              userId,
              parsedData: resumeData
            }
          });
        } catch (parseError) {
          console.error('[File Upload] Resume parsing failed:', parseError);
          await storage.updateParsedData(fileUpload.id, null, 'failed');
        }
      }

      // Emit WebSocket event for file uploaded
      messengerWS.broadcast({
        type: 'file_uploaded',
        payload: {
          file: fileUpload,
          userId
        }
      });

      res.json({
        success: true,
        file: fileUpload
      });
    } catch (error) {
      console.error("[File Upload] Error uploading file:", error);
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  // GET /api/messenger/uploads - Get user's uploaded files
  app.get("/api/messenger/uploads", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.id;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const uploads = await storage.getUserUploads(userId);
      res.json(uploads);
    } catch (error) {
      console.error("[File Upload] Error fetching uploads:", error);
      res.status(500).json({ error: "Failed to fetch uploads" });
    }
  });

  // GET /api/messenger/upload/:fileId - Get specific file upload details
  app.get("/api/messenger/upload/:fileId", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.id;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { fileId } = req.params;
      const file = await storage.getFileUpload(fileId);
      
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }

      // Check if user has access to this file
      if (file.userId !== userId && !(req.user as any)?.isAdmin) {
        return res.status(403).json({ error: "Access denied" });
      }

      res.json(file);
    } catch (error) {
      console.error("[File Upload] Error fetching file:", error);
      res.status(500).json({ error: "Failed to fetch file" });
    }
  });

  // Static route to serve uploaded files
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  // ===== REACTION ROUTES =====
  
  // POST /api/messenger/reactions/add - Add a reaction to a message
  app.post("/api/messenger/reactions/add", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.id;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { messageId, emoji, messageType } = req.body;
      
      if (!messageId || !emoji || !messageType) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      
      if (!['channel', 'dm'].includes(messageType)) {
        return res.status(400).json({ error: "Invalid message type" });
      }

      const reaction = await storage.addReaction(messageId, userId, emoji, messageType);
      
      // Get user info for the reaction
      const user = await storage.getUser(userId);
      
      // Emit WebSocket event for real-time update
      messengerWS.broadcast({
        type: 'reaction_added',
        payload: {
          messageId,
          messageType,
          reaction: {
            ...reaction,
            user: {
              id: user?.id,
              firstName: user?.firstName,
              lastName: user?.lastName,
              email: user?.email
            }
          }
        }
      });
      
      res.json(reaction);
    } catch (error) {
      console.error("[Reactions] Error adding reaction:", error);
      res.status(500).json({ error: "Failed to add reaction" });
    }
  });
  
  // POST /api/messenger/reactions/remove - Remove a reaction from a message
  app.post("/api/messenger/reactions/remove", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.id;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { messageId, emoji, messageType } = req.body;
      
      if (!messageId || !emoji || !messageType) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      
      if (!['channel', 'dm'].includes(messageType)) {
        return res.status(400).json({ error: "Invalid message type" });
      }

      await storage.removeReaction(messageId, userId, emoji, messageType);
      
      // Emit WebSocket event for real-time update
      messengerWS.broadcast({
        type: 'reaction_removed',
        payload: {
          messageId,
          messageType,
          userId,
          emoji
        }
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("[Reactions] Error removing reaction:", error);
      res.status(500).json({ error: "Failed to remove reaction" });
    }
  });
  
  // GET /api/messenger/reactions/:messageType/:messageId - Get all reactions for a message
  app.get("/api/messenger/reactions/:messageType/:messageId", isAuthenticated, async (req, res) => {
    try {
      const { messageType, messageId } = req.params;
      
      if (!['channel', 'dm'].includes(messageType)) {
        return res.status(400).json({ error: "Invalid message type" });
      }

      let reactions;
      if (messageType === 'channel') {
        reactions = await storage.getMessageReactions(messageId);
      } else {
        reactions = await storage.getDirectMessageReactions(messageId);
      }
      
      // Group reactions by emoji and include user info
      const reactionsByEmoji: { [emoji: string]: any[] } = {};
      
      for (const reaction of reactions) {
        const user = await storage.getUser(reaction.userId);
        const reactionWithUser = {
          ...reaction,
          user: {
            id: user?.id,
            firstName: user?.firstName,
            lastName: user?.lastName,
            email: user?.email
          }
        };
        
        if (!reactionsByEmoji[reaction.emoji]) {
          reactionsByEmoji[reaction.emoji] = [];
        }
        reactionsByEmoji[reaction.emoji].push(reactionWithUser);
      }
      
      res.json(reactionsByEmoji);
    } catch (error) {
      console.error("[Reactions] Error fetching reactions:", error);
      res.status(500).json({ error: "Failed to fetch reactions" });
    }
  });

  // GET /api/channels - Get list of channels for user  
  app.get("/api/channels", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.id;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Return all channels - visibility is handled in frontend
      const allChannels = await storage.getChannels();
      res.json(allChannels);
    } catch (error) {
      console.error("[Messenger] Error fetching channels:", error);
      res.status(500).json({ error: "Failed to fetch channels" });
    }
  });

  // GET /api/online-users - Get list of online users
  app.get("/api/online-users", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.id;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const currentUser = await storage.getUser(userId);
      if (!currentUser) {
        return res.status(404).json({ error: "User not found" });
      }

      // Get all users that are online
      const allUsers = await storage.getDMUsers(userId, currentUser.isAdmin);
      const onlineUsers = allUsers.filter(u => u.onlineStatus === 'online' || u.isOnline);
      
      res.json(onlineUsers.map(user => ({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        isAdmin: user.isAdmin,
        onlineStatus: user.onlineStatus || (user.isOnline ? 'online' : 'offline'),
        profileImageUrl: user.profileImageUrl
      })));
    } catch (error) {
      console.error("[Messenger] Error fetching online users:", error);
      res.status(500).json({ error: "Failed to fetch online users" });
    }
  });

  // Legacy support for old endpoints (backward compatibility)
  app.get("/api/direct-messages-users", isAuthenticated, async (req, res) => {
    // Redirect to new endpoint
    return app._router.handle(Object.assign(req, { url: '/api/messenger/dm/users' }), res, () => {});
  });

  app.get("/api/direct-messages/conversations", isAuthenticated, async (req, res) => {
    // Redirect to new endpoint
    return app._router.handle(Object.assign(req, { url: '/api/messenger/dm/conversations' }), res, () => {});
  });

  app.get("/api/direct-messages/:otherUserId", isAuthenticated, async (req, res) => {
    // Redirect to new endpoint with userId parameter
    return app._router.handle(Object.assign(req, { url: `/api/messenger/dm/messages/${req.params.otherUserId}` }), res, () => {});
  });

  // =========================
  // JASON AI PERSONA ENDPOINTS
  // =========================

  // POST /api/messenger/ai/jason - Get Jason AI response
  app.post("/api/messenger/ai/jason", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.id;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { message, channel, conversationHistory } = req.body;
      
      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Generate Jason AI response
      const response = await jasonPerez.generateResponse(
        message,
        conversationHistory || [],
        {
          userName: user.firstName || user.email,
          channel: channel,
          hasLicense: user.hasFloridaLicense,
          licenseType: user.isMultiStateLicensed ? 'multi-state' : user.hasFloridaLicense ? 'florida' : undefined,
          experienceLevel: user.experienceLevel
        }
      );

      res.json(response);
    } catch (error) {
      console.error("[Jason AI] Error generating response:", error);
      res.status(500).json({ error: "Failed to generate AI response" });
    }
  });

  // POST /api/messenger/ai/jason/welcome - Generate welcome message
  app.post("/api/messenger/ai/jason/welcome", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.id;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { channel } = req.body;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const welcomeMessage = await jasonPerez.generateWelcomeMessage(
        user.firstName || user.email || 'New Candidate',
        channel || 'general',
        {
          hasFloridaLicense: user.hasFloridaLicense,
          isMultiStateLicensed: user.isMultiStateLicensed,
          states: user.licensedStates
        }
      );

      res.json({ message: welcomeMessage, isAiGenerated: true });
    } catch (error) {
      console.error("[Jason AI] Error generating welcome message:", error);
      res.status(500).json({ error: "Failed to generate welcome message" });
    }
  });

  // POST /api/messenger/ai/jason/resume-feedback - Generate resume feedback
  app.post("/api/messenger/ai/jason/resume-feedback", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.id;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { resumeData } = req.body;
      
      if (!resumeData) {
        return res.status(400).json({ error: "Resume data is required" });
      }

      const user = await storage.getUser(userId);
      const feedback = await jasonPerez.generateResumeFeedback(
        resumeData,
        user?.firstName || user?.email
      );

      res.json({ message: feedback, isAiGenerated: true });
    } catch (error) {
      console.error("[Jason AI] Error generating resume feedback:", error);
      res.status(500).json({ error: "Failed to generate resume feedback" });
    }
  });

  // POST /api/messenger/ai/jason/career-guidance - Get career path guidance
  app.post("/api/messenger/ai/jason/career-guidance", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.id;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { goals } = req.body;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const currentStatus = user.isMultiStateLicensed ? 'multi_state' :
                           user.hasFloridaLicense ? 'fl_licensed' : 'non_licensed';

      const guidance = await jasonPerez.generateCareerPathGuidance(currentStatus, goals);

      res.json({ message: guidance, isAiGenerated: true });
    } catch (error) {
      console.error("[Jason AI] Error generating career guidance:", error);
      res.status(500).json({ error: "Failed to generate career guidance" });
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
          console.error("Apify API call failed:", error);
          return res.status(500).json({ error: "Apify API service unavailable", details: String(error) });
        }
      } else {
        return res.status(503).json({ error: "Apify API not configured" });
      }
      
      // Create run record from real Apify data only
      const runData = {
        actorId: actor.id,
        apifyRunId: realRun.id,
        status: realRun.status,
        startedAt: realRun.startedAt,
        inputJson: input,
        logMessages: realRun.logMessages || ["Run started"],
      };
      
      const run = await storage.createApifyRun(runData);
      
      // Update actor last run
      await storage.updateApifyActor(actorId, { lastRun: new Date() });
      
      // No mock run simulation - only real Apify data
      
      res.json({ runId: run.apifyRunId, status: realRun.status });
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
      
      // No fallback mock data - return empty result if API unavailable
      res.json({ items: [], count: 0, message: "Apify API not available - no mock data provided" });
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

  // Local file storage routes for ElevenLabs recordings and transcripts
  app.get("/api/files/audio/:fileId", async (req, res) => {
    try {
      const { fileId } = req.params;
      
      const file = await fileStorageService.getFile(fileId, "audio");
      if (!file || !await fileStorageService.fileExists(file.localPath)) {
        return res.status(404).json({ error: "Audio file not found" });
      }

      const fileBuffer = await fileStorageService.readFile(file.localPath);
      
      // Set appropriate headers for audio streaming
      res.set({
        "Content-Type": file.mimeType,
        "Content-Length": file.size.toString(),
        "Cache-Control": "public, max-age=3600",
        "Accept-Ranges": "bytes",
        "Content-Disposition": `inline; filename="${file.filename}"`
      });

      res.send(fileBuffer);
    } catch (error) {
      console.error("Error serving audio file:", error);
      res.status(500).json({ error: "Error serving audio file" });
    }
  });

  app.get("/api/files/transcript/:fileId", async (req, res) => {
    try {
      const { fileId } = req.params;
      
      const file = await fileStorageService.getFile(fileId, "transcript");
      if (!file || !await fileStorageService.fileExists(file.localPath)) {
        return res.status(404).json({ error: "Transcript file not found" });
      }

      const fileBuffer = await fileStorageService.readFile(file.localPath);
      
      // Set appropriate headers for text files
      res.set({
        "Content-Type": file.mimeType,
        "Content-Length": file.size.toString(),
        "Cache-Control": "public, max-age=3600",
        "Content-Disposition": `inline; filename="${file.filename}"`
      });

      res.send(fileBuffer);
    } catch (error) {
      console.error("Error serving transcript file:", error);
      res.status(500).json({ error: "Error serving transcript file" });
    }
  });

  // Download route for audio files
  app.get("/api/files/audio/:fileId/download", async (req, res) => {
    try {
      const { fileId } = req.params;
      
      const file = await fileStorageService.getFile(fileId, "audio");
      if (!file || !await fileStorageService.fileExists(file.localPath)) {
        return res.status(404).json({ error: "Audio file not found" });
      }

      const fileBuffer = await fileStorageService.readFile(file.localPath);
      
      // Force download
      res.set({
        "Content-Type": "application/octet-stream",
        "Content-Length": file.size.toString(),
        "Content-Disposition": `attachment; filename="${file.filename}"`
      });

      res.send(fileBuffer);
    } catch (error) {
      console.error("Error downloading audio file:", error);
      res.status(500).json({ error: "Error downloading audio file" });
    }
  });

  // Download route for transcript files
  app.get("/api/files/transcript/:fileId/download", async (req, res) => {
    try {
      const { fileId } = req.params;
      
      const file = await fileStorageService.getFile(fileId, "transcript");
      if (!file || !await fileStorageService.fileExists(file.localPath)) {
        return res.status(404).json({ error: "Transcript file not found" });
      }

      const fileBuffer = await fileStorageService.readFile(file.localPath);
      
      // Force download
      res.set({
        "Content-Type": "application/octet-stream", 
        "Content-Length": file.size.toString(),
        "Content-Disposition": `attachment; filename="${file.filename}"`
      });

      res.send(fileBuffer);
    } catch (error) {
      console.error("Error downloading transcript file:", error);
      res.status(500).json({ error: "Error downloading transcript file" });
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

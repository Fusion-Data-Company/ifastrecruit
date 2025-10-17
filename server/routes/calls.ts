import { Router } from "express";
import { callService } from "../services/call.service";
import { storage } from "../storage";
import { z } from "zod";

const router = Router();

// Validation schemas
const startCallSchema = z.object({
  workspaceId: z.string(),
  channelId: z.string().optional(),
  type: z.enum(['voice', 'video', 'huddle', 'screen_share']),
  title: z.string().optional(),
  participants: z.array(z.string()).optional(),
  maxParticipants: z.number().min(2).max(15).optional(),
  scheduledFor: z.string().datetime().optional()
});

const updateCallSettingsSchema = z.object({
  title: z.string().optional(),
  maxParticipants: z.number().min(2).max(15).optional(),
  isRecording: z.boolean().optional()
});

const toggleMediaSchema = z.object({
  mediaType: z.enum(['audio', 'video']),
  enabled: z.boolean()
});

const qualityMetricsSchema = z.object({
  networkQuality: z.number().min(1).max(5).optional(),
  bitrate: z.number().optional(),
  packetLoss: z.number().min(0).max(100).optional(),
  latency: z.number().optional()
});

// Middleware to check authentication
const requireAuth = (req: any, res: any, next: any) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

/**
 * POST /api/calls/start
 * Start a new call
 */
router.post('/start', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const validatedData = startCallSchema.parse(req.body);
    
    const scheduledFor = validatedData.scheduledFor 
      ? new Date(validatedData.scheduledFor) 
      : undefined;
    
    const call = await callService.startCall(userId, {
      ...validatedData,
      scheduledFor
    });
    
    res.json(call);
  } catch (error: any) {
    console.error('[Call API] Error starting call:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request data', details: error.errors });
    } else {
      res.status(400).json({ error: error.message || 'Failed to start call' });
    }
  }
});

/**
 * POST /api/calls/:id/join
 * Join an existing call
 */
router.post('/:id/join', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const callId = req.params.id;
    const { mediaConstraints } = req.body;
    
    const result = await callService.joinCall({
      callId,
      userId,
      mediaConstraints
    });
    
    res.json(result);
  } catch (error: any) {
    console.error('[Call API] Error joining call:', error);
    res.status(400).json({ error: error.message || 'Failed to join call' });
  }
});

/**
 * POST /api/calls/:id/leave
 * Leave a call
 */
router.post('/:id/leave', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const callId = req.params.id;
    
    await callService.leaveCall(callId, userId);
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('[Call API] Error leaving call:', error);
    res.status(400).json({ error: error.message || 'Failed to leave call' });
  }
});

/**
 * POST /api/calls/:id/end
 * End a call (initiator or admin only)
 */
router.post('/:id/end', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const callId = req.params.id;
    
    const call = await callService.endCall(callId, userId);
    
    res.json(call);
  } catch (error: any) {
    console.error('[Call API] Error ending call:', error);
    res.status(400).json({ error: error.message || 'Failed to end call' });
  }
});

/**
 * PUT /api/calls/:id/settings
 * Update call settings
 */
router.put('/:id/settings', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const callId = req.params.id;
    const validatedData = updateCallSettingsSchema.parse(req.body);
    
    const call = await callService.updateCallSettings(callId, userId, validatedData);
    
    res.json(call);
  } catch (error: any) {
    console.error('[Call API] Error updating call settings:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request data', details: error.errors });
    } else {
      res.status(400).json({ error: error.message || 'Failed to update call settings' });
    }
  }
});

/**
 * POST /api/calls/:id/media/toggle
 * Toggle audio/video for a participant
 */
router.post('/:id/media/toggle', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const callId = req.params.id;
    const validatedData = toggleMediaSchema.parse(req.body);
    
    const participant = await callService.toggleParticipantMedia(
      callId,
      userId,
      validatedData.mediaType,
      validatedData.enabled
    );
    
    res.json(participant);
  } catch (error: any) {
    console.error('[Call API] Error toggling media:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request data', details: error.errors });
    } else {
      res.status(400).json({ error: error.message || 'Failed to toggle media' });
    }
  }
});

/**
 * POST /api/calls/:id/screen/start
 * Start screen sharing
 */
router.post('/:id/screen/start', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const callId = req.params.id;
    
    const participant = await callService.startScreenShare(callId, userId);
    
    res.json(participant);
  } catch (error: any) {
    console.error('[Call API] Error starting screen share:', error);
    res.status(400).json({ error: error.message || 'Failed to start screen share' });
  }
});

/**
 * POST /api/calls/:id/screen/stop
 * Stop screen sharing
 */
router.post('/:id/screen/stop', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const callId = req.params.id;
    
    const participant = await callService.stopScreenShare(callId, userId);
    
    res.json(participant);
  } catch (error: any) {
    console.error('[Call API] Error stopping screen share:', error);
    res.status(400).json({ error: error.message || 'Failed to stop screen share' });
  }
});

/**
 * POST /api/calls/:id/consent
 * Record consent for call recording
 */
router.post('/:id/consent', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const callId = req.params.id;
    const { consent } = req.body;
    
    if (typeof consent !== 'boolean') {
      return res.status(400).json({ error: 'Consent must be a boolean value' });
    }
    
    const participant = await callService.recordConsent(callId, userId, consent);
    
    res.json(participant);
  } catch (error: any) {
    console.error('[Call API] Error recording consent:', error);
    res.status(400).json({ error: error.message || 'Failed to record consent' });
  }
});

/**
 * POST /api/calls/:id/quality
 * Report quality metrics
 */
router.post('/:id/quality', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const callId = req.params.id;
    const validatedData = qualityMetricsSchema.parse(req.body);
    
    const participant = await callService.updateQualityMetrics(
      callId,
      userId,
      validatedData
    );
    
    res.json(participant);
  } catch (error: any) {
    console.error('[Call API] Error updating quality metrics:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request data', details: error.errors });
    } else {
      res.status(400).json({ error: error.message || 'Failed to update quality metrics' });
    }
  }
});

/**
 * GET /api/calls/active
 * Get active calls in workspace
 */
router.get('/active', requireAuth, async (req, res) => {
  try {
    const { workspaceId } = req.query;
    
    if (!workspaceId || typeof workspaceId !== 'string') {
      return res.status(400).json({ error: 'Workspace ID is required' });
    }
    
    const calls = await callService.getActiveCalls(workspaceId);
    
    res.json(calls);
  } catch (error: any) {
    console.error('[Call API] Error getting active calls:', error);
    res.status(400).json({ error: error.message || 'Failed to get active calls' });
  }
});

/**
 * GET /api/calls/:id
 * Get call details with participants
 */
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const callId = req.params.id;
    
    const result = await callService.getCallWithParticipants(callId);
    
    res.json(result);
  } catch (error: any) {
    console.error('[Call API] Error getting call details:', error);
    res.status(400).json({ error: error.message || 'Failed to get call details' });
  }
});

/**
 * GET /api/calls/:id/participants
 * Get call participants
 */
router.get('/:id/participants', requireAuth, async (req, res) => {
  try {
    const callId = req.params.id;
    
    const participants = await storage.getCallParticipants(callId);
    
    // Fetch user data for each participant
    const participantsWithUsers = await Promise.all(
      participants.map(async (p) => ({
        ...p,
        user: await storage.getUser(p.userId)
      }))
    );
    
    res.json(participantsWithUsers);
  } catch (error: any) {
    console.error('[Call API] Error getting participants:', error);
    res.status(400).json({ error: error.message || 'Failed to get participants' });
  }
});

/**
 * GET /api/calls/user/current
 * Get current call for user
 */
router.get('/user/current', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    
    const call = await storage.userInCall(userId);
    
    if (call) {
      const result = await callService.getCallWithParticipants(call.id);
      res.json(result);
    } else {
      res.json(null);
    }
  } catch (error: any) {
    console.error('[Call API] Error getting current call:', error);
    res.status(400).json({ error: error.message || 'Failed to get current call' });
  }
});

export default router;
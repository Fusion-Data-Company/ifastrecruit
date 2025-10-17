import { storage } from "../storage";
import { webrtcSignaling } from "./webrtc.service";
import type { Call, CallParticipant, User, Channel, InsertCall } from "@shared/schema";
import crypto from "crypto";

export interface StartCallOptions {
  workspaceId: string;
  channelId?: string;
  type: 'voice' | 'video' | 'huddle' | 'screen_share';
  title?: string;
  participants?: string[]; // User IDs to invite
  maxParticipants?: number;
  scheduledFor?: Date;
}

export interface JoinCallOptions {
  callId: string;
  userId: string;
  mediaConstraints?: MediaStreamConstraints;
}

export interface CallNotification {
  type: 'incoming_call' | 'call_ended' | 'participant_joined' | 'participant_left' | 'recording_started';
  call: Call;
  from?: User;
  participants?: CallParticipant[];
}

export class CallService {
  /**
   * Start a new call
   */
  async startCall(initiatorId: string, options: StartCallOptions): Promise<Call> {
    // Validate user
    const initiator = await storage.getUser(initiatorId);
    if (!initiator) {
      throw new Error('User not found');
    }

    // Check if user is already in a call
    const existingCall = await storage.userInCall(initiatorId);
    if (existingCall) {
      throw new Error('User is already in a call');
    }

    // Validate channel if provided
    if (options.channelId) {
      const channel = await storage.getChannel(options.channelId);
      if (!channel) {
        throw new Error('Channel not found');
      }

      // Check if user has access to channel
      const hasAccess = await storage.userHasChannelAccess(initiatorId, options.channelId);
      if (!hasAccess) {
        throw new Error('User does not have access to this channel');
      }
    }

    // Generate room ID
    const roomId = `room_${crypto.randomBytes(16).toString('hex')}`;

    // Create call
    const call = await storage.createCall({
      workspaceId: options.workspaceId,
      channelId: options.channelId,
      initiatorId,
      type: options.type as any,
      title: options.title || `${options.type} call`,
      roomId,
      maxParticipants: options.maxParticipants || 15,
      scheduledFor: options.scheduledFor,
      status: 'pending' as any,
      stunServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' }
      ],
      turnServers: [] // Add TURN servers if available
    });

    // Add initiator as first participant
    await storage.addCallParticipant({
      callId: call.id,
      userId: initiatorId,
      status: 'connecting' as any,
      audioEnabled: true,
      videoEnabled: options.type === 'video'
    });

    // Invite participants if specified
    if (options.participants && options.participants.length > 0) {
      for (const participantId of options.participants) {
        if (participantId !== initiatorId) {
          await this.inviteParticipant(call, participantId);
        }
      }
    }

    // Send notifications to channel members if it's a channel call
    if (options.channelId && options.type === 'huddle') {
      await this.notifyChannelMembers(call, options.channelId, initiator);
    }

    return call;
  }

  /**
   * Join an existing call
   */
  async joinCall(options: JoinCallOptions): Promise<{ call: Call; participant: CallParticipant }> {
    const { callId, userId } = options;

    // Validate user
    const user = await storage.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Get call
    const call = await storage.getCall(callId);
    if (!call) {
      throw new Error('Call not found');
    }

    // Check call status
    if (call.status !== 'active' && call.status !== 'pending') {
      throw new Error('Call is not active');
    }

    // Check if user is already in another call
    const existingCall = await storage.userInCall(userId);
    if (existingCall && existingCall.id !== callId) {
      throw new Error('User is already in another call');
    }

    // Check participant limit
    const participants = await storage.getCallParticipants(callId);
    const connectedCount = participants.filter(p => p.status === 'connected').length;
    if (connectedCount >= (call.maxParticipants || 15)) {
      throw new Error('Call is full');
    }

    // Check channel access if it's a channel call
    if (call.channelId) {
      const hasAccess = await storage.userHasChannelAccess(userId, call.channelId);
      if (!hasAccess) {
        throw new Error('User does not have access to this channel');
      }
    }

    // Add or update participant
    const participant = await storage.addCallParticipant({
      callId,
      userId,
      status: 'connecting' as any,
      audioEnabled: true,
      videoEnabled: call.type === 'video'
    });

    // Update call status to active if it was pending
    if (call.status === 'pending') {
      await storage.updateCall(callId, { status: 'active' as any });
    }

    return { call, participant };
  }

  /**
   * Leave a call
   */
  async leaveCall(callId: string, userId: string): Promise<void> {
    const call = await storage.getCall(callId);
    if (!call) {
      throw new Error('Call not found');
    }

    // Remove participant
    await storage.removeCallParticipant(callId, userId);

    // Check if call should end
    const remainingParticipants = await storage.getCallParticipants(callId);
    const connectedCount = remainingParticipants.filter(p => p.status === 'connected').length;

    if (connectedCount === 0) {
      // End call if no participants left
      await this.endCall(callId, userId);
    } else if (userId === call.initiatorId) {
      // Transfer host if initiator leaves
      const nextHost = remainingParticipants.find(p => p.status === 'connected');
      if (nextHost) {
        await storage.updateCall(callId, { initiatorId: nextHost.userId });
      }
    }
  }

  /**
   * End a call
   */
  async endCall(callId: string, endedBy: string): Promise<Call> {
    const call = await storage.getCall(callId);
    if (!call) {
      throw new Error('Call not found');
    }

    // Check if user has permission to end call
    if (call.initiatorId !== endedBy) {
      const user = await storage.getUser(endedBy);
      if (!user?.isAdmin) {
        throw new Error('Only the call initiator or an admin can end the call');
      }
    }

    // Notify WebRTC signaling service
    await webrtcSignaling.endCall(callId);

    // End call in database
    const endedCall = await storage.endCall(callId);

    // Send notifications
    await this.notifyCallEnded(endedCall);

    return endedCall;
  }

  /**
   * Update call settings
   */
  async updateCallSettings(
    callId: string, 
    userId: string, 
    settings: Partial<{
      title: string;
      maxParticipants: number;
      isRecording: boolean;
    }>
  ): Promise<Call> {
    const call = await storage.getCall(callId);
    if (!call) {
      throw new Error('Call not found');
    }

    // Check if user has permission to update settings
    if (call.initiatorId !== userId) {
      const user = await storage.getUser(userId);
      if (!user?.isAdmin) {
        throw new Error('Only the call initiator or an admin can update call settings');
      }
    }

    // Handle recording
    if (settings.isRecording !== undefined) {
      if (settings.isRecording) {
        // Start recording
        await storage.updateCall(callId, {
          isRecording: true,
          recordingStartedAt: new Date()
        });

        // Notify participants
        await this.notifyRecordingStarted(call);
      } else {
        // Stop recording
        await storage.updateCall(callId, {
          isRecording: false,
          recordingStoppedAt: new Date()
        });
      }
    }

    // Update other settings
    const updates: any = {};
    if (settings.title !== undefined) updates.title = settings.title;
    if (settings.maxParticipants !== undefined) updates.maxParticipants = settings.maxParticipants;

    return await storage.updateCall(callId, updates);
  }

  /**
   * Toggle participant media (audio/video)
   */
  async toggleParticipantMedia(
    callId: string, 
    userId: string, 
    mediaType: 'audio' | 'video',
    enabled: boolean
  ): Promise<CallParticipant> {
    const participant = await storage.getCallParticipant(callId, userId);
    if (!participant) {
      throw new Error('Participant not found');
    }

    const updates: any = {};
    if (mediaType === 'audio') {
      updates.audioEnabled = enabled;
    } else {
      updates.videoEnabled = enabled;
    }

    return await storage.updateCallParticipant(participant.id, updates);
  }

  /**
   * Start screen sharing
   */
  async startScreenShare(callId: string, userId: string): Promise<CallParticipant> {
    const participant = await storage.getCallParticipant(callId, userId);
    if (!participant) {
      throw new Error('Participant not found');
    }

    // Check if someone else is already sharing
    const allParticipants = await storage.getCallParticipants(callId);
    const currentSharer = allParticipants.find(p => p.screenSharing && p.userId !== userId);
    if (currentSharer) {
      throw new Error('Another participant is already sharing their screen');
    }

    return await storage.updateCallParticipant(participant.id, {
      screenSharing: true
    });
  }

  /**
   * Stop screen sharing
   */
  async stopScreenShare(callId: string, userId: string): Promise<CallParticipant> {
    const participant = await storage.getCallParticipant(callId, userId);
    if (!participant) {
      throw new Error('Participant not found');
    }

    return await storage.updateCallParticipant(participant.id, {
      screenSharing: false
    });
  }

  /**
   * Get active calls in workspace
   */
  async getActiveCalls(workspaceId: string): Promise<Call[]> {
    return await storage.getActiveCalls(workspaceId);
  }

  /**
   * Get call with participants
   */
  async getCallWithParticipants(callId: string): Promise<{
    call: Call;
    participants: (CallParticipant & { user?: User })[];
  }> {
    const call = await storage.getCall(callId);
    if (!call) {
      throw new Error('Call not found');
    }

    const participants = await storage.getCallParticipants(callId);
    
    // Fetch user data for each participant
    const participantsWithUsers = await Promise.all(
      participants.map(async (p) => ({
        ...p,
        user: await storage.getUser(p.userId) || undefined
      }))
    );

    return { call, participants: participantsWithUsers };
  }

  /**
   * Record participant consent for recording
   */
  async recordConsent(callId: string, userId: string, consent: boolean): Promise<CallParticipant> {
    const participant = await storage.getCallParticipant(callId, userId);
    if (!participant) {
      throw new Error('Participant not found');
    }

    return await storage.updateCallParticipant(participant.id, {
      recordingConsent: consent,
      consentGivenAt: consent ? new Date() : null
    });
  }

  /**
   * Update participant quality metrics
   */
  async updateQualityMetrics(
    callId: string, 
    userId: string, 
    metrics: {
      networkQuality?: number;
      bitrate?: number;
      packetLoss?: number;
      latency?: number;
    }
  ): Promise<CallParticipant> {
    const participant = await storage.getCallParticipant(callId, userId);
    if (!participant) {
      throw new Error('Participant not found');
    }

    const updates: any = {};
    if (metrics.networkQuality !== undefined) updates.networkQuality = metrics.networkQuality;
    if (metrics.bitrate !== undefined) updates.avgBitrate = metrics.bitrate;
    if (metrics.packetLoss !== undefined) updates.packetLoss = metrics.packetLoss;
    if (metrics.latency !== undefined) updates.avgLatency = metrics.latency;

    return await storage.updateCallParticipant(participant.id, updates);
  }

  // Private helper methods

  private async inviteParticipant(call: Call, userId: string): Promise<void> {
    // Add participant with 'invited' status
    await storage.addCallParticipant({
      callId: call.id,
      userId,
      status: 'invited' as any,
      audioEnabled: false,
      videoEnabled: false
    });

    // Create notification for the user
    await storage.createNotification({
      userId,
      type: 'message',
      status: 'unread',
      sourceId: call.id,
      channelId: call.channelId,
      senderId: call.initiatorId,
      title: 'Incoming Call',
      content: `You have been invited to a ${call.type} call`,
      metadata: {
        callType: call.type,
        callId: call.id,
        roomId: call.roomId
      }
    });
  }

  private async notifyChannelMembers(call: Call, channelId: string, initiator: User): Promise<void> {
    const members = await storage.getChannelMembers(channelId);
    const channel = await storage.getChannel(channelId);

    for (const member of members) {
      if (member.userId !== initiator.id) {
        await storage.createNotification({
          userId: member.userId,
          type: 'message',
          status: 'unread',
          sourceId: call.id,
          channelId,
          senderId: initiator.id,
          title: `Huddle started in #${channel?.name}`,
          content: `${initiator.firstName || initiator.email} started a huddle`,
          metadata: {
            callType: 'huddle',
            callId: call.id,
            roomId: call.roomId,
            channelName: channel?.name
          }
        });
      }
    }
  }

  private async notifyCallEnded(call: Call): Promise<void> {
    const participants = await storage.getCallParticipants(call.id);
    
    for (const participant of participants) {
      if (participant.status === 'connected' || participant.status === 'connecting') {
        await storage.createNotification({
          userId: participant.userId,
          type: 'message',
          status: 'unread',
          sourceId: call.id,
          channelId: call.channelId,
          senderId: call.initiatorId,
          title: 'Call Ended',
          content: `The ${call.type} call has ended`,
          metadata: {
            callType: call.type,
            callId: call.id,
            duration: call.totalDuration
          }
        });
      }
    }
  }

  private async notifyRecordingStarted(call: Call): Promise<void> {
    const participants = await storage.getCallParticipants(call.id);
    
    for (const participant of participants) {
      if (participant.status === 'connected') {
        await storage.createNotification({
          userId: participant.userId,
          type: 'message',
          status: 'unread',
          sourceId: call.id,
          channelId: call.channelId,
          senderId: call.initiatorId,
          title: 'Recording Started',
          content: 'This call is now being recorded',
          metadata: {
            callType: call.type,
            callId: call.id,
            requiresConsent: true
          }
        });
      }
    }
  }
}

export const callService = new CallService();
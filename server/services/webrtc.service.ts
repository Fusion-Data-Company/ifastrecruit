import { WebSocket, WebSocketServer } from "ws";
import { Server } from "http";
import { storage } from "../storage";
import { validateWebSocketRequest } from "../utils/sessionParser";
import type { Call, CallParticipant, InsertCall, InsertCallParticipant } from "@shared/schema";

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  isAuthenticated?: boolean;
  roomId?: string;
  peerId?: string;
}

interface SignalingMessage {
  type: 'join_room' | 'leave_room' | 'offer' | 'answer' | 'ice_candidate' | 
        'media_status' | 'peer_disconnected' | 'room_participants' | 'call_ended' |
        'recording_status' | 'quality_report' | 'screen_share_status';
  payload: any;
  targetPeerId?: string;
  roomId?: string;
}

interface MediaStatus {
  audioEnabled: boolean;
  videoEnabled: boolean;
  screenSharing: boolean;
}

interface QualityMetrics {
  bitrate: number;
  packetLoss: number;
  latency: number;
  networkQuality: number; // 1-5 scale
}

export class WebRTCSignalingService {
  private wss: WebSocketServer | null = null;
  private rooms: Map<string, Set<AuthenticatedWebSocket>> = new Map();
  private peerConnections: Map<string, Map<string, AuthenticatedWebSocket>> = new Map(); // roomId -> Map<peerId, socket>
  private callStates: Map<string, Call> = new Map(); // roomId -> Call
  
  initialize(server: Server) {
    this.wss = new WebSocketServer({ 
      noServer: true 
    });

    // Handle upgrade manually
    server.on('upgrade', async (request, socket, head) => {
      if (request.url === '/ws/webrtc') {
        try {
          // Validate session and extract userId
          const userId = await validateWebSocketRequest(request);
          
          if (!userId) {
            console.log('[WebRTC WS] Unauthorized connection attempt');
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
            return;
          }

          // Verify user exists
          const user = await storage.getUser(userId);
          if (!user) {
            console.log('[WebRTC WS] User not found:', userId);
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
            return;
          }

          // Upgrade connection
          this.wss!.handleUpgrade(request, socket, head, (ws) => {
            (ws as AuthenticatedWebSocket).userId = userId;
            (ws as AuthenticatedWebSocket).isAuthenticated = true;
            (ws as AuthenticatedWebSocket).peerId = `peer_${userId}_${Date.now()}`;
            this.wss!.emit('connection', ws, request);
          });
        } catch (error) {
          console.error('[WebRTC WS] Error during upgrade:', error);
          socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
          socket.destroy();
        }
      }
    });

    this.wss.on('connection', async (ws: AuthenticatedWebSocket) => {
      console.log('[WebRTC WS] Connection established for user:', ws.userId);

      // Send authentication confirmation with peer ID
      ws.send(JSON.stringify({ 
        type: 'authenticated', 
        payload: { 
          userId: ws.userId,
          peerId: ws.peerId 
        } 
      }));

      ws.on('message', async (data: string) => {
        try {
          const message: SignalingMessage = JSON.parse(data.toString());
          await this.handleMessage(ws, message);
        } catch (error) {
          console.error('[WebRTC WS] Error handling message:', error);
          ws.send(JSON.stringify({ 
            type: 'error', 
            payload: { message: 'Invalid message format' } 
          }));
        }
      });

      ws.on('close', () => {
        this.handleDisconnect(ws);
      });

      ws.on('error', (error) => {
        console.error('[WebRTC WS] WebSocket error:', error);
      });
    });

    console.log('[WebRTC WS] Service initialized');
  }

  private async handleMessage(ws: AuthenticatedWebSocket, message: SignalingMessage) {
    switch (message.type) {
      case 'join_room':
        await this.handleJoinRoom(ws, message.payload);
        break;
      
      case 'leave_room':
        await this.handleLeaveRoom(ws);
        break;
      
      case 'offer':
        await this.handleOffer(ws, message);
        break;
      
      case 'answer':
        await this.handleAnswer(ws, message);
        break;
      
      case 'ice_candidate':
        await this.handleIceCandidate(ws, message);
        break;
      
      case 'media_status':
        await this.handleMediaStatus(ws, message.payload);
        break;
        
      case 'screen_share_status':
        await this.handleScreenShareStatus(ws, message.payload);
        break;
        
      case 'quality_report':
        await this.handleQualityReport(ws, message.payload);
        break;
        
      case 'recording_status':
        await this.handleRecordingStatus(ws, message.payload);
        break;
      
      default:
        ws.send(JSON.stringify({ 
          type: 'error', 
          payload: { message: 'Unknown message type' } 
        }));
    }
  }

  private async handleJoinRoom(ws: AuthenticatedWebSocket, payload: { 
    roomId: string; 
    callId?: string;
    mediaConstraints?: MediaStreamConstraints 
  }) {
    const { roomId, callId, mediaConstraints } = payload;
    
    if (!ws.userId) {
      ws.send(JSON.stringify({ 
        type: 'error', 
        payload: { message: 'Not authenticated' } 
      }));
      return;
    }

    // Check if user is already in another call
    const existingCall = await storage.userInCall(ws.userId);
    if (existingCall && existingCall.roomId !== roomId) {
      ws.send(JSON.stringify({ 
        type: 'error', 
        payload: { message: 'Already in another call' } 
      }));
      return;
    }

    // Get or verify call
    let call: Call | undefined;
    if (callId) {
      call = await storage.getCall(callId);
    } else {
      call = await storage.getCallByRoomId(roomId);
    }

    if (!call) {
      ws.send(JSON.stringify({ 
        type: 'error', 
        payload: { message: 'Call not found' } 
      }));
      return;
    }

    // Check if call is active
    if (call.status !== 'active' && call.status !== 'pending') {
      ws.send(JSON.stringify({ 
        type: 'error', 
        payload: { message: 'Call is not active' } 
      }));
      return;
    }

    // Check participant limit
    const participants = await storage.getCallParticipants(call.id);
    const connectedCount = participants.filter(p => p.status === 'connected').length;
    if (connectedCount >= (call.maxParticipants || 15)) {
      ws.send(JSON.stringify({ 
        type: 'error', 
        payload: { message: 'Call is full' } 
      }));
      return;
    }

    // Add to room
    ws.roomId = roomId;
    
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set());
      this.peerConnections.set(roomId, new Map());
    }
    
    const room = this.rooms.get(roomId)!;
    const peers = this.peerConnections.get(roomId)!;
    
    // Get existing participants before adding new one
    const existingPeers = Array.from(peers.entries()).map(([peerId, peerWs]) => ({
      peerId,
      userId: peerWs.userId,
      mediaStatus: {
        audioEnabled: true,
        videoEnabled: mediaConstraints?.video !== false,
        screenSharing: false
      }
    }));
    
    room.add(ws);
    peers.set(ws.peerId!, ws);
    
    // Update call state if needed
    if (call.status === 'pending') {
      await storage.updateCall(call.id, { status: 'active' });
    }
    
    // Add participant to database
    await storage.addCallParticipant({
      callId: call.id,
      userId: ws.userId,
      status: 'connected',
      audioEnabled: mediaConstraints?.audio !== false,
      videoEnabled: mediaConstraints?.video !== false,
      screenSharing: false
    });
    
    // Store call state
    this.callStates.set(roomId, call);
    
    // Send room info to new participant
    ws.send(JSON.stringify({
      type: 'room_joined',
      payload: {
        roomId,
        callId: call.id,
        peerId: ws.peerId,
        existingPeers,
        iceServers: call.stunServers || [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      }
    }));
    
    // Notify existing participants about new peer
    this.broadcastToRoom(roomId, {
      type: 'peer_joined',
      payload: {
        peerId: ws.peerId,
        userId: ws.userId,
        mediaStatus: {
          audioEnabled: mediaConstraints?.audio !== false,
          videoEnabled: mediaConstraints?.video !== false,
          screenSharing: false
        }
      }
    }, ws);
    
    console.log(`[WebRTC WS] User ${ws.userId} joined room ${roomId}`);
  }

  private async handleLeaveRoom(ws: AuthenticatedWebSocket) {
    if (!ws.roomId || !ws.userId) return;
    
    const roomId = ws.roomId;
    const room = this.rooms.get(roomId);
    const peers = this.peerConnections.get(roomId);
    const call = this.callStates.get(roomId);
    
    if (room) {
      room.delete(ws);
      
      // Remove from peer connections
      if (peers) {
        peers.delete(ws.peerId!);
      }
      
      // Update participant in database
      if (call) {
        await storage.removeCallParticipant(call.id, ws.userId);
        
        // Check if room is empty and end call if needed
        if (room.size === 0) {
          await storage.endCall(call.id);
          this.callStates.delete(roomId);
          this.rooms.delete(roomId);
          this.peerConnections.delete(roomId);
          
          console.log(`[WebRTC WS] Call ended in room ${roomId}`);
        } else {
          // Notify remaining participants
          this.broadcastToRoom(roomId, {
            type: 'peer_left',
            payload: {
              peerId: ws.peerId,
              userId: ws.userId
            }
          });
        }
      }
    }
    
    ws.roomId = undefined;
    console.log(`[WebRTC WS] User ${ws.userId} left room ${roomId}`);
  }

  private async handleOffer(ws: AuthenticatedWebSocket, message: SignalingMessage) {
    if (!ws.roomId || !message.targetPeerId) return;
    
    const targetSocket = this.findPeerSocket(ws.roomId, message.targetPeerId);
    if (targetSocket) {
      targetSocket.send(JSON.stringify({
        type: 'offer',
        payload: message.payload,
        fromPeerId: ws.peerId,
        targetPeerId: message.targetPeerId
      }));
    }
  }

  private async handleAnswer(ws: AuthenticatedWebSocket, message: SignalingMessage) {
    if (!ws.roomId || !message.targetPeerId) return;
    
    const targetSocket = this.findPeerSocket(ws.roomId, message.targetPeerId);
    if (targetSocket) {
      targetSocket.send(JSON.stringify({
        type: 'answer',
        payload: message.payload,
        fromPeerId: ws.peerId,
        targetPeerId: message.targetPeerId
      }));
    }
  }

  private async handleIceCandidate(ws: AuthenticatedWebSocket, message: SignalingMessage) {
    if (!ws.roomId || !message.targetPeerId) return;
    
    const targetSocket = this.findPeerSocket(ws.roomId, message.targetPeerId);
    if (targetSocket) {
      targetSocket.send(JSON.stringify({
        type: 'ice_candidate',
        payload: message.payload,
        fromPeerId: ws.peerId,
        targetPeerId: message.targetPeerId
      }));
    }
  }

  private async handleMediaStatus(ws: AuthenticatedWebSocket, status: MediaStatus) {
    if (!ws.roomId || !ws.userId) return;
    
    const call = this.callStates.get(ws.roomId);
    if (!call) return;
    
    // Update participant media status in database
    const participant = await storage.getCallParticipant(call.id, ws.userId);
    if (participant) {
      await storage.updateCallParticipant(participant.id, {
        audioEnabled: status.audioEnabled,
        videoEnabled: status.videoEnabled
      });
    }
    
    // Broadcast to room
    this.broadcastToRoom(ws.roomId, {
      type: 'media_status_changed',
      payload: {
        peerId: ws.peerId,
        userId: ws.userId,
        mediaStatus: status
      }
    }, ws);
  }

  private async handleScreenShareStatus(ws: AuthenticatedWebSocket, payload: { 
    screenSharing: boolean;
    screenStreamId?: string;
  }) {
    if (!ws.roomId || !ws.userId) return;
    
    const call = this.callStates.get(ws.roomId);
    if (!call) return;
    
    // Update participant screen sharing status
    const participant = await storage.getCallParticipant(call.id, ws.userId);
    if (participant) {
      await storage.updateCallParticipant(participant.id, {
        screenSharing: payload.screenSharing
      });
    }
    
    // Broadcast to room
    this.broadcastToRoom(ws.roomId, {
      type: 'screen_share_status_changed',
      payload: {
        peerId: ws.peerId,
        userId: ws.userId,
        screenSharing: payload.screenSharing,
        screenStreamId: payload.screenStreamId
      }
    }, ws);
  }

  private async handleQualityReport(ws: AuthenticatedWebSocket, metrics: QualityMetrics) {
    if (!ws.roomId || !ws.userId) return;
    
    const call = this.callStates.get(ws.roomId);
    if (!call) return;
    
    // Update participant quality metrics
    const participant = await storage.getCallParticipant(call.id, ws.userId);
    if (participant) {
      await storage.updateCallParticipant(participant.id, {
        networkQuality: metrics.networkQuality,
        avgBitrate: metrics.bitrate,
        packetLoss: metrics.packetLoss,
        avgLatency: metrics.latency
      });
    }
    
    // Store aggregate metrics for the call
    const qualityMetrics = (call.qualityMetrics as any) || {};
    qualityMetrics[ws.userId] = metrics;
    await storage.updateCall(call.id, { qualityMetrics });
  }

  private async handleRecordingStatus(ws: AuthenticatedWebSocket, payload: {
    recording: boolean;
    consent?: boolean;
  }) {
    if (!ws.roomId || !ws.userId) return;
    
    const call = this.callStates.get(ws.roomId);
    if (!call) return;
    
    // Check if user is the call initiator
    if (call.initiatorId !== ws.userId) {
      ws.send(JSON.stringify({ 
        type: 'error', 
        payload: { message: 'Only the call initiator can manage recording' } 
      }));
      return;
    }
    
    if (payload.recording) {
      // Start recording
      await storage.updateCall(call.id, {
        isRecording: true,
        recordingStartedAt: new Date()
      });
      
      // Notify all participants
      this.broadcastToRoom(ws.roomId, {
        type: 'recording_started',
        payload: {
          requestConsent: true
        }
      });
    } else {
      // Stop recording
      await storage.updateCall(call.id, {
        isRecording: false,
        recordingStoppedAt: new Date()
      });
      
      // Notify all participants
      this.broadcastToRoom(ws.roomId, {
        type: 'recording_stopped',
        payload: {}
      });
    }
  }

  private handleDisconnect(ws: AuthenticatedWebSocket) {
    if (ws.roomId) {
      this.handleLeaveRoom(ws);
    }
    console.log('[WebRTC WS] User disconnected:', ws.userId);
  }

  private findPeerSocket(roomId: string, peerId: string): AuthenticatedWebSocket | undefined {
    const peers = this.peerConnections.get(roomId);
    return peers?.get(peerId);
  }

  private broadcastToRoom(roomId: string, message: any, excludeSocket?: AuthenticatedWebSocket) {
    const room = this.rooms.get(roomId);
    if (room) {
      room.forEach(client => {
        if (client !== excludeSocket && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(message));
        }
      });
    }
  }

  async endCall(callId: string) {
    const call = await storage.getCall(callId);
    if (!call) return;
    
    const roomId = call.roomId;
    
    // Notify all participants
    this.broadcastToRoom(roomId, {
      type: 'call_ended',
      payload: { reason: 'host_ended' }
    });
    
    // Clean up room
    const room = this.rooms.get(roomId);
    if (room) {
      room.forEach(ws => {
        (ws as AuthenticatedWebSocket).roomId = undefined;
      });
    }
    
    this.rooms.delete(roomId);
    this.peerConnections.delete(roomId);
    this.callStates.delete(roomId);
    
    // End call in database
    await storage.endCall(callId);
  }
}

export const webrtcSignaling = new WebRTCSignalingService();
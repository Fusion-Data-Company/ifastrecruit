import { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react';
import SimplePeer from 'simple-peer';
import { io, Socket } from 'socket.io-client';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Call, CallParticipant } from '@shared/schema';

interface PeerConnection {
  peer: SimplePeer.Instance;
  userId: string;
  stream?: MediaStream;
}

interface CallState {
  currentCall: Call | null;
  participants: CallParticipant[];
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  connectionQuality: 'excellent' | 'good' | 'fair' | 'poor';
}

interface WebRTCContextType extends CallState {
  startCall: (params: {
    channelId: string;
    workspaceId: string;
    type: 'voice' | 'video' | 'huddle';
    participants?: string[];
  }) => Promise<void>;
  joinCall: (callId: string) => Promise<void>;
  leaveCall: () => Promise<void>;
  toggleAudio: () => void;
  toggleVideo: () => void;
  shareScreen: () => Promise<void>;
  stopScreenShare: () => void;
  acceptIncomingCall: (callId: string) => void;
  rejectIncomingCall: (callId: string) => void;
  incomingCall: Call | null;
}

const WebRTCContext = createContext<WebRTCContextType | undefined>(undefined);

export function WebRTCProvider({ children, userId }: { children: React.ReactNode; userId: string }) {
  const { toast } = useToast();
  const socketRef = useRef<Socket | null>(null);
  const peersRef = useRef<Map<string, PeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  
  const [state, setState] = useState<CallState>({
    currentCall: null,
    participants: [],
    localStream: null,
    remoteStreams: new Map(),
    isAudioEnabled: true,
    isVideoEnabled: true,
    isScreenSharing: false,
    connectionQuality: 'good',
  });
  
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);

  // Initialize Socket.IO connection
  useEffect(() => {
    const socket = io('/webrtc', {
      path: '/socket.io/',
      transports: ['websocket'],
    });

    socketRef.current = socket;

    // Socket event handlers
    socket.on('connect', () => {
      console.log('WebRTC socket connected');
      socket.emit('register', { userId });
    });

    socket.on('incoming-call', (call: Call) => {
      setIncomingCall(call);
    });

    socket.on('call-accepted', ({ callId, userId: acceptingUserId }) => {
      if (state.currentCall?.id === callId) {
        console.log(`User ${acceptingUserId} accepted the call`);
      }
    });

    socket.on('call-rejected', ({ callId, userId: rejectingUserId }) => {
      if (state.currentCall?.id === callId) {
        toast({
          title: 'Call rejected',
          description: `User declined the call`,
          variant: 'destructive',
        });
      }
    });

    socket.on('participant-joined', ({ callId, participant }: { callId: string; participant: CallParticipant }) => {
      if (state.currentCall?.id === callId) {
        setState(prev => ({
          ...prev,
          participants: [...prev.participants, participant],
        }));
        // Create peer connection for new participant
        createPeerConnection(participant.userId, true);
      }
    });

    socket.on('participant-left', ({ callId, userId: leftUserId }) => {
      if (state.currentCall?.id === callId) {
        setState(prev => ({
          ...prev,
          participants: prev.participants.filter(p => p.userId !== leftUserId),
          remoteStreams: new Map([...prev.remoteStreams].filter(([id]) => id !== leftUserId)),
        }));
        // Clean up peer connection
        const peerConnection = peersRef.current.get(leftUserId);
        if (peerConnection) {
          peerConnection.peer.destroy();
          peersRef.current.delete(leftUserId);
        }
      }
    });

    // WebRTC signaling events
    socket.on('signal', ({ from, signal }) => {
      const peerConnection = peersRef.current.get(from);
      if (peerConnection) {
        peerConnection.peer.signal(signal);
      } else {
        // Create new peer connection for incoming call
        const peer = createPeerConnection(from, false);
        peer?.signal(signal);
      }
    });

    socket.on('call-ended', ({ callId }) => {
      if (state.currentCall?.id === callId) {
        cleanupCall();
        toast({
          title: 'Call ended',
          description: 'The call has been terminated',
        });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [userId]);

  const createPeerConnection = (remoteUserId: string, initiator: boolean): SimplePeer.Instance | null => {
    if (!localStreamRef.current) {
      console.error('No local stream available');
      return null;
    }

    const peer = new SimplePeer({
      initiator,
      stream: localStreamRef.current,
      trickle: true,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      },
    });

    peer.on('signal', (signal) => {
      socketRef.current?.emit('signal', {
        to: remoteUserId,
        signal,
        callId: state.currentCall?.id,
      });
    });

    peer.on('stream', (stream) => {
      setState(prev => ({
        ...prev,
        remoteStreams: new Map(prev.remoteStreams).set(remoteUserId, stream),
      }));
    });

    peer.on('error', (err) => {
      console.error('Peer connection error:', err);
      toast({
        title: 'Connection error',
        description: 'Failed to establish peer connection',
        variant: 'destructive',
      });
    });

    peer.on('close', () => {
      setState(prev => ({
        ...prev,
        remoteStreams: new Map([...prev.remoteStreams].filter(([id]) => id !== remoteUserId)),
      }));
    });

    peersRef.current.set(remoteUserId, { peer, userId: remoteUserId });
    return peer;
  };

  const getUserMedia = async (type: 'voice' | 'video' | 'huddle') => {
    const constraints: MediaStreamConstraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: type === 'video' ? {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user',
      } : false,
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setState(prev => ({ ...prev, localStream: stream }));
      return stream;
    } catch (error) {
      console.error('Failed to get user media:', error);
      toast({
        title: 'Media access denied',
        description: 'Please allow access to your camera and microphone',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const startCall = async (params: {
    channelId: string;
    workspaceId: string;
    type: 'voice' | 'video' | 'huddle';
    participants?: string[];
  }) => {
    try {
      // Get user media
      await getUserMedia(params.type);

      // Start call via API
      const response = await apiRequest('/api/calls/start', {
        method: 'POST',
        body: JSON.stringify(params),
      });

      const call = await response.json();
      setState(prev => ({ ...prev, currentCall: call, participants: [] }));

      // Notify participants via socket
      socketRef.current?.emit('call-started', {
        callId: call.id,
        participants: params.participants || [],
      });

      toast({
        title: 'Call started',
        description: 'Waiting for participants to join...',
      });
    } catch (error) {
      console.error('Failed to start call:', error);
      toast({
        title: 'Failed to start call',
        description: 'Please try again',
        variant: 'destructive',
      });
    }
  };

  const joinCall = async (callId: string) => {
    try {
      // Get user media
      const call = incomingCall || state.currentCall;
      if (!call) return;
      
      await getUserMedia(call.type as 'voice' | 'video' | 'huddle');

      // Join call via API
      const response = await apiRequest(`/api/calls/${callId}/join`, {
        method: 'POST',
      });

      const updatedCall = await response.json();
      setState(prev => ({ 
        ...prev, 
        currentCall: updatedCall.call,
        participants: updatedCall.participants || [],
      }));
      setIncomingCall(null);

      // Notify via socket
      socketRef.current?.emit('joined-call', { callId });

      // Create peer connections for existing participants
      updatedCall.participants?.forEach((participant: CallParticipant) => {
        if (participant.userId !== userId) {
          createPeerConnection(participant.userId, true);
        }
      });
    } catch (error) {
      console.error('Failed to join call:', error);
      toast({
        title: 'Failed to join call',
        description: 'Please try again',
        variant: 'destructive',
      });
    }
  };

  const leaveCall = async () => {
    if (!state.currentCall) return;

    try {
      await apiRequest(`/api/calls/${state.currentCall.id}/leave`, {
        method: 'POST',
      });

      socketRef.current?.emit('left-call', { callId: state.currentCall.id });
      cleanupCall();
    } catch (error) {
      console.error('Failed to leave call:', error);
    }
  };

  const cleanupCall = () => {
    // Stop local stream
    localStreamRef.current?.getTracks().forEach(track => track.stop());
    localStreamRef.current = null;

    // Destroy all peer connections
    peersRef.current.forEach(({ peer }) => peer.destroy());
    peersRef.current.clear();

    // Reset state
    setState({
      currentCall: null,
      participants: [],
      localStream: null,
      remoteStreams: new Map(),
      isAudioEnabled: true,
      isVideoEnabled: true,
      isScreenSharing: false,
      connectionQuality: 'good',
    });

    // Invalidate queries
    queryClient.invalidateQueries({ queryKey: ['/api/calls/active'] });
  };

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setState(prev => ({ ...prev, isAudioEnabled: audioTrack.enabled }));
        
        socketRef.current?.emit('toggle-audio', {
          callId: state.currentCall?.id,
          enabled: audioTrack.enabled,
        });
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setState(prev => ({ ...prev, isVideoEnabled: videoTrack.enabled }));
        
        socketRef.current?.emit('toggle-video', {
          callId: state.currentCall?.id,
          enabled: videoTrack.enabled,
        });
      }
    }
  };

  const shareScreen = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      const screenTrack = screenStream.getVideoTracks()[0];
      
      // Replace video track in all peer connections
      peersRef.current.forEach(({ peer }) => {
        const sender = (peer as any)._pc?.getSenders?.().find(
          (s: RTCRtpSender) => s.track?.kind === 'video'
        );
        if (sender) {
          sender.replaceTrack(screenTrack);
        }
      });

      // Handle screen share ending
      screenTrack.onended = () => {
        stopScreenShare();
      };

      setState(prev => ({ ...prev, isScreenSharing: true }));
      
      socketRef.current?.emit('screen-share-started', {
        callId: state.currentCall?.id,
      });
    } catch (error) {
      console.error('Failed to share screen:', error);
      toast({
        title: 'Screen share failed',
        description: 'Could not start screen sharing',
        variant: 'destructive',
      });
    }
  };

  const stopScreenShare = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      
      // Replace screen track with camera track in all peer connections
      peersRef.current.forEach(({ peer }) => {
        const sender = (peer as any)._pc?.getSenders?.().find(
          (s: RTCRtpSender) => s.track?.kind === 'video'
        );
        if (sender && videoTrack) {
          sender.replaceTrack(videoTrack);
        }
      });

      setState(prev => ({ ...prev, isScreenSharing: false }));
      
      socketRef.current?.emit('screen-share-ended', {
        callId: state.currentCall?.id,
      });
    }
  };

  const acceptIncomingCall = (callId: string) => {
    joinCall(callId);
  };

  const rejectIncomingCall = (callId: string) => {
    socketRef.current?.emit('reject-call', { callId });
    setIncomingCall(null);
  };

  return (
    <WebRTCContext.Provider
      value={{
        ...state,
        startCall,
        joinCall,
        leaveCall,
        toggleAudio,
        toggleVideo,
        shareScreen,
        stopScreenShare,
        acceptIncomingCall,
        rejectIncomingCall,
        incomingCall,
      }}
    >
      {children}
    </WebRTCContext.Provider>
  );
}

export function useWebRTC() {
  const context = useContext(WebRTCContext);
  if (!context) {
    throw new Error('useWebRTC must be used within a WebRTCProvider');
  }
  return context;
}
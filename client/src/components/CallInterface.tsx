import { useEffect, useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Monitor,
  MonitorOff,
  Users,
  Settings,
  Maximize2,
  Grid,
  SpeakerIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useWebRTC } from '@/hooks/useWebRTC';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { CallParticipant } from '@shared/schema';

interface VideoStreamProps {
  stream: MediaStream;
  userId: string;
  isLocal?: boolean;
  isMuted?: boolean;
  className?: string;
}

function VideoStream({ stream, userId, isLocal = false, isMuted = false, className }: VideoStreamProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasVideo, setHasVideo] = useState(true);
  
  // Fetch user info
  const { data: userInfo } = useQuery({
    queryKey: [`/api/users/${userId}`],
    enabled: !!userId,
  });

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      
      // Check if video track is enabled
      const videoTrack = stream.getVideoTracks()[0];
      setHasVideo(videoTrack?.enabled ?? false);
    }
  }, [stream]);

  return (
    <div className={cn('relative bg-muted rounded-lg overflow-hidden', className)}>
      {hasVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal || isMuted}
          className="w-full h-full object-cover"
          data-testid={`video-stream-${userId}`}
        />
      ) : (
        <div className="flex items-center justify-center w-full h-full bg-muted">
          <Avatar className="h-20 w-20">
            <AvatarImage src={userInfo?.avatar} />
            <AvatarFallback className="text-2xl">
              {userInfo?.name?.charAt(0) || userInfo?.email?.charAt(0) || '?'}
            </AvatarFallback>
          </Avatar>
        </div>
      )}
      
      {/* User info overlay */}
      <div className="absolute bottom-2 left-2 flex items-center gap-2">
        <Badge variant={isLocal ? 'default' : 'secondary'} className="text-xs">
          {isLocal ? 'You' : userInfo?.name || userInfo?.email || 'Unknown'}
        </Badge>
        {isMuted && <MicOff className="h-3 w-3 text-red-500" />}
      </div>

      {/* Connection quality indicator */}
      <div className="absolute top-2 right-2 flex gap-1">
        <div className="h-1 w-1 bg-green-500 rounded-full" />
        <div className="h-1 w-1 bg-green-500 rounded-full" />
        <div className="h-1 w-1 bg-green-500 rounded-full" />
      </div>
    </div>
  );
}

export function CallInterface({ onClose }: { onClose?: () => void }) {
  const {
    currentCall,
    participants,
    localStream,
    remoteStreams,
    isAudioEnabled,
    isVideoEnabled,
    isScreenSharing,
    toggleAudio,
    toggleVideo,
    shareScreen,
    stopScreenShare,
    leaveCall,
  } = useWebRTC();

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [layout, setLayout] = useState<'grid' | 'speaker'>('grid');
  const [volume, setVolume] = useState(100);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleEndCall = async () => {
    await leaveCall();
    onClose?.();
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleScreenShare = async () => {
    if (isScreenSharing) {
      stopScreenShare();
    } else {
      await shareScreen();
    }
  };

  if (!currentCall) return null;

  const allStreams = [
    ...(localStream ? [{ stream: localStream, userId: 'local', isLocal: true }] : []),
    ...Array.from(remoteStreams.entries()).map(([userId, stream]) => ({
      stream,
      userId,
      isLocal: false,
    })),
  ];

  const gridCols = allStreams.length <= 1 ? 1 : allStreams.length <= 4 ? 2 : 3;

  return (
    <div
      ref={containerRef}
      className={cn(
        'fixed inset-0 z-50 bg-background flex flex-col',
        isFullscreen && 'bg-black'
      )}
      data-testid="call-interface"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold">
            {currentCall.type === 'huddle' ? 'Huddle' : currentCall.type === 'video' ? 'Video Call' : 'Voice Call'}
          </h3>
          <Badge variant="outline">
            <Users className="h-3 w-3 mr-1" />
            {participants.length + 1} participants
          </Badge>
          {currentCall.type !== 'huddle' && (
            <Badge variant="secondary">
              {new Date().toLocaleTimeString()}
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLayout(layout === 'grid' ? 'speaker' : 'grid')}
            data-testid="button-toggle-layout"
          >
            <Grid className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleFullscreen}
            data-testid="button-fullscreen"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Video Grid */}
      <div className="flex-1 p-4 overflow-auto">
        {currentCall.type === 'voice' || currentCall.type === 'huddle' ? (
          // Audio-only call view
          <div className="flex flex-wrap gap-4 justify-center items-center h-full">
            {participants.map((participant) => (
              <div
                key={participant.userId}
                className="flex flex-col items-center gap-2 p-4 bg-muted rounded-lg"
                data-testid={`audio-participant-${participant.userId}`}
              >
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="text-xl">
                    {participant.userId.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium">User {participant.userId}</span>
                {!participant.audioEnabled && <MicOff className="h-4 w-4 text-red-500" />}
              </div>
            ))}
          </div>
        ) : (
          // Video call grid
          <div
            className={cn(
              'grid gap-4 h-full',
              layout === 'grid' && `grid-cols-${gridCols}`,
              layout === 'speaker' && 'grid-cols-1'
            )}
          >
            {allStreams.map(({ stream, userId, isLocal }) => (
              <VideoStream
                key={userId}
                stream={stream}
                userId={userId}
                isLocal={isLocal}
                className={layout === 'speaker' && !isLocal ? 'col-span-full' : ''}
              />
            ))}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="border-t bg-background/95 backdrop-blur">
        <div className="flex items-center justify-center gap-4 p-4">
          {/* Audio Control */}
          <Button
            variant={isAudioEnabled ? 'outline' : 'destructive'}
            size="icon"
            onClick={toggleAudio}
            data-testid="button-toggle-audio"
          >
            {isAudioEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
          </Button>

          {/* Video Control */}
          {currentCall.type === 'video' && (
            <Button
              variant={isVideoEnabled ? 'outline' : 'destructive'}
              size="icon"
              onClick={toggleVideo}
              data-testid="button-toggle-video"
            >
              {isVideoEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
            </Button>
          )}

          {/* Screen Share */}
          {currentCall.type !== 'huddle' && (
            <Button
              variant={isScreenSharing ? 'default' : 'outline'}
              size="icon"
              onClick={handleScreenShare}
              data-testid="button-screen-share"
            >
              {isScreenSharing ? <MonitorOff className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
            </Button>
          )}

          {/* Volume Control */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" data-testid="button-volume">
                <SpeakerIcon className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48">
              <div className="flex items-center gap-2">
                <SpeakerIcon className="h-4 w-4" />
                <Slider
                  value={[volume]}
                  onValueChange={([v]) => setVolume(v)}
                  max={100}
                  step={1}
                  className="flex-1"
                />
                <span className="text-sm w-8 text-right">{volume}%</span>
              </div>
            </PopoverContent>
          </Popover>

          {/* Settings */}
          <Button variant="outline" size="icon" data-testid="button-settings">
            <Settings className="h-4 w-4" />
          </Button>

          {/* End Call */}
          <Button
            variant="destructive"
            size="icon"
            onClick={handleEndCall}
            className="ml-4"
            data-testid="button-end-call"
          >
            <PhoneOff className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
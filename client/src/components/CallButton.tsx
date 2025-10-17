import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Phone, Video, PhoneOff, Mic } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useToast } from '@/hooks/use-toast';

interface CallButtonProps {
  channelId: string;
  workspaceId: string;
  participants?: string[];
  variant?: 'voice' | 'video' | 'huddle';
  className?: string;
}

export function CallButton({
  channelId,
  workspaceId,
  participants = [],
  variant,
  className = '',
}: CallButtonProps) {
  const { startCall, currentCall, leaveCall } = useWebRTC();
  const { toast } = useToast();
  const [isStarting, setIsStarting] = useState(false);

  const handleStartCall = async (type: 'voice' | 'video' | 'huddle') => {
    try {
      setIsStarting(true);
      await startCall({
        channelId,
        workspaceId,
        type,
        participants,
      });
    } catch (error) {
      console.error('Failed to start call:', error);
      toast({
        title: 'Failed to start call',
        description: 'Please check your permissions and try again',
        variant: 'destructive',
      });
    } finally {
      setIsStarting(false);
    }
  };

  const handleEndCall = async () => {
    await leaveCall();
  };

  // If in a call, show end call button
  if (currentCall) {
    return (
      <Button
        onClick={handleEndCall}
        variant="destructive"
        size="sm"
        className={`${className}`}
        data-testid="button-end-call"
      >
        <PhoneOff className="h-4 w-4 mr-2" />
        End Call
      </Button>
    );
  }

  // Single variant button
  if (variant) {
    const icons = {
      voice: Phone,
      video: Video,
      huddle: Mic,
    };
    const labels = {
      voice: 'Start Voice Call',
      video: 'Start Video Call',
      huddle: 'Start Huddle',
    };
    const Icon = icons[variant];

    return (
      <Button
        onClick={() => handleStartCall(variant)}
        disabled={isStarting}
        size="sm"
        variant="outline"
        className={`${className}`}
        data-testid={`button-start-${variant}`}
      >
        <Icon className="h-4 w-4 mr-2" />
        {labels[variant]}
      </Button>
    );
  }

  // Dropdown menu for multiple options
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={isStarting}
          className={className}
          data-testid="button-call-menu"
        >
          <Phone className="h-4 w-4 mr-2" />
          Call
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => handleStartCall('voice')}
          data-testid="menu-item-voice-call"
        >
          <Phone className="h-4 w-4 mr-2" />
          Voice Call
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleStartCall('video')}
          data-testid="menu-item-video-call"
        >
          <Video className="h-4 w-4 mr-2" />
          Video Call
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleStartCall('huddle')}
          data-testid="menu-item-huddle"
        >
          <Mic className="h-4 w-4 mr-2" />
          Start Huddle
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
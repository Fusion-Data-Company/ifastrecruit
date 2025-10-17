import { useEffect, useState } from 'react';
import { Phone, PhoneOff, Video, User } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useQuery } from '@tanstack/react-query';

export function IncomingCallModal() {
  const { incomingCall, acceptIncomingCall, rejectIncomingCall } = useWebRTC();
  const [ringtoneAudio] = useState(() => new Audio('/sounds/ringtone.mp3'));

  // Fetch caller information
  const { data: callerInfo } = useQuery({
    queryKey: [`/api/users/${incomingCall?.initiatorId}`],
    enabled: !!incomingCall?.initiatorId,
  });

  // Play ringtone when call comes in
  useEffect(() => {
    if (incomingCall) {
      ringtoneAudio.loop = true;
      ringtoneAudio.play().catch(console.error);
    } else {
      ringtoneAudio.pause();
      ringtoneAudio.currentTime = 0;
    }

    return () => {
      ringtoneAudio.pause();
      ringtoneAudio.currentTime = 0;
    };
  }, [incomingCall, ringtoneAudio]);

  const handleAccept = () => {
    if (incomingCall) {
      acceptIncomingCall(incomingCall.id);
    }
  };

  const handleReject = () => {
    if (incomingCall) {
      rejectIncomingCall(incomingCall.id);
    }
  };

  if (!incomingCall) return null;

  const isVideoCall = incomingCall.type === 'video';
  const CallIcon = isVideoCall ? Video : Phone;

  return (
    <AlertDialog open={!!incomingCall}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-center">
            Incoming {isVideoCall ? 'Video' : 'Voice'} Call
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="flex flex-col items-center space-y-4 pt-4">
              {/* Caller Avatar */}
              <div className="relative">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={callerInfo?.avatar} />
                  <AvatarFallback>
                    <User className="h-12 w-12" />
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-2 -right-2 rounded-full bg-primary p-2">
                  <CallIcon className="h-4 w-4 text-primary-foreground" />
                </div>
              </div>
              
              {/* Caller Name */}
              <div className="text-center">
                <p className="text-lg font-semibold text-foreground">
                  {callerInfo?.name || callerInfo?.email || 'Unknown Caller'}
                </p>
                <p className="text-sm text-muted-foreground">
                  is calling you...
                </p>
              </div>

              {/* Call Animation */}
              <div className="flex space-x-1">
                <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse delay-100" />
                <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse delay-200" />
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row justify-center gap-4 sm:justify-center">
          <Button
            variant="destructive"
            size="lg"
            onClick={handleReject}
            className="rounded-full h-14 w-14 p-0"
            data-testid="button-reject-call"
          >
            <PhoneOff className="h-6 w-6" />
          </Button>
          <Button
            variant="default"
            size="lg"
            onClick={handleAccept}
            className="rounded-full h-14 w-14 p-0 bg-green-600 hover:bg-green-700"
            data-testid="button-accept-call"
          >
            <Phone className="h-6 w-6" />
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
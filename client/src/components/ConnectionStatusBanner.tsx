import { Alert, AlertDescription } from '@/components/ui/alert';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';

interface ConnectionStatusBannerProps {
  status: 'connected' | 'connecting' | 'disconnected';
}

export function ConnectionStatusBanner({ status }: ConnectionStatusBannerProps) {
  if (status === 'connected') {
    return null; // Don't show banner when connected
  }

  return (
    <Alert
      variant={status === 'disconnected' ? 'destructive' : 'default'}
      className="mb-4 border-2"
    >
      <div className="flex items-center gap-2">
        {status === 'connecting' && (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertDescription>Connecting to messenger...</AlertDescription>
          </>
        )}
        {status === 'disconnected' && (
          <>
            <WifiOff className="h-4 w-4" />
            <AlertDescription>
              Connection lost. Attempting to reconnect...
            </AlertDescription>
          </>
        )}
      </div>
    </Alert>
  );
}

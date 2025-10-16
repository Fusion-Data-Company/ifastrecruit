import { useState, useEffect, createContext, useContext } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import MessengerPage from './MessengerPage';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

// Create a mock auth context for the dev environment
interface DevUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  isAdmin: boolean;
  hasFloridaLicense: boolean;
  isMultiStateLicensed: boolean;
  licensedStates?: string[];
  onboardingCompleted: boolean;
  onlineStatus?: string;
  profileImageUrl?: string | null;
}

interface DevAuthContextType {
  user: DevUser | null;
  isLoading: boolean;
  isAdmin: boolean;
  logout: () => Promise<void>;
}

const DevAuthContext = createContext<DevAuthContextType>({
  user: null,
  isLoading: true,
  isAdmin: false,
  logout: async () => {},
});

// Hook to override the normal useAuth with dev auth
export const useAuth = () => useContext(DevAuthContext);

function DevMessengerContent() {
  return (
    <>
      {/* Dev Mode Warning Banner */}
      <Alert className="fixed top-0 left-0 right-0 z-[100] rounded-none bg-red-500 text-white border-red-600" data-testid="dev-mode-banner">
        <AlertTriangle className="h-4 w-4 text-white" />
        <AlertDescription className="text-white font-semibold">
          DEV MODE - Authentication Bypassed - DO NOT USE IN PRODUCTION
        </AlertDescription>
      </Alert>
      
      {/* Add padding to account for the banner */}
      <div className="pt-12">
        <MessengerPage />
      </div>
    </>
  );
}

export default function DevMessengerPage() {
  const [user, setUser] = useState<DevUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Fetch the mock user from the dev bypass endpoint
    const fetchDevUser = async () => {
      try {
        const response = await fetch('/api/dev/messenger/user');
        if (!response.ok) {
          throw new Error('Failed to fetch dev user');
        }
        const userData = await response.json();
        setUser(userData);
        console.log('[DevMessenger] Mock user loaded:', userData.email);
      } catch (error) {
        console.error('[DevMessenger] Failed to load mock user:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDevUser();
  }, []);

  // Override all API calls to use dev bypass endpoints
  useEffect(() => {
    const originalFetch = window.fetch;
    
    // Intercept fetch calls and redirect to dev endpoints
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      let url = typeof input === 'string' ? input : input.toString();
      
      // Redirect auth and messenger endpoints to dev bypass versions
      const devRouteMap: Record<string, string> = {
        '/api/auth/user': '/api/dev/messenger/user',
        '/api/onboarding/status': '/api/dev/messenger/onboarding/status',
        '/api/channels': '/api/dev/messenger/channels',
        '/api/direct-messages/conversations': '/api/dev/messenger/direct-messages/conversations',
        '/api/direct-messages-users': '/api/dev/messenger/direct-messages-users',
      };

      // Check for exact matches
      if (devRouteMap[url]) {
        url = devRouteMap[url];
      }
      
      // Check for pattern matches
      if (url.startsWith('/api/channels/') && url.includes('/messages')) {
        url = url.replace('/api/channels/', '/api/dev/messenger/channels/');
      } else if (url.startsWith('/api/direct-messages/') && !url.includes('conversations') && !url.includes('users')) {
        url = url.replace('/api/direct-messages/', '/api/dev/messenger/direct-messages/');
      }

      console.log(`[DevMessenger] Redirecting API call: ${typeof input === 'string' ? input : input.toString()} → ${url}`);
      
      return originalFetch(url, init);
    };

    // Cleanup on unmount
    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  const logout = async () => {
    console.log('[DevMessenger] Logout called in dev mode - no action taken');
  };

  const authContextValue: DevAuthContextType = {
    user,
    isLoading,
    isAdmin: user?.isAdmin || false,
    logout,
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-cyan-400">Loading Development Environment...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-red-400">Failed to load development user. Please check the server.</div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <DevAuthContext.Provider value={authContextValue}>
        <DevMessengerContent />
      </DevAuthContext.Provider>
    </QueryClientProvider>
  );
}
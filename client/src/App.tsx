import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MainUIAgent, SecondaryAgent, CenterAgent } from "@/components/ElevenLabsWidgets";
import { useAuth } from "@/hooks/useAuth";
import Dashboard from "@/pages/dashboard";
import Candidates from "@/pages/candidates";
import Interviews from "@/pages/interviews";
import Interview from "@/pages/interview";
import Booking from "@/pages/booking";
import AirtopIntegration from "@/pages/AirtopIntegration";
import ElevenLabsPage from "@/pages/elevenlabs";
import MessengerPage from "@/pages/MessengerPage";
import OnboardingPage from "@/pages/OnboardingPage";
import DevMessengerPage from "@/pages/DevMessengerPage";
import LoginPage from "@/pages/LoginPage";
import NotFound from "@/pages/not-found";

// Admin wrapper that includes ElevenLabs agent
function AdminPageWrapper({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useAuth();
  
  return (
    <>
      {children}
      {/* Only show ElevenLabs agent on admin pages */}
      {isAdmin && <MainUIAgent />}
    </>
  );
}

interface OnboardingGuardProps {
  children: React.ReactNode;
}

function OnboardingGuard({ children }: OnboardingGuardProps) {
  const { user, isLoading: userLoading, isAdmin } = useAuth();
  const [location] = useLocation();

  const { data: status, isLoading: statusLoading } = useQuery<{
    hasCompleted: boolean;
    currentLicensingInfo: any;
  }>({
    queryKey: ["/api/onboarding/status"],
    enabled: !!user && !isAdmin,
  });

  // Show loading state
  if (userLoading || (user && !isAdmin && statusLoading)) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  // Not authenticated - redirect to login unless on public pages
  if (!user) {
    const publicPaths = ['/login', '/booking', '/interview'];
    const isPublicPath = publicPaths.some(path => location.startsWith(path));
    
    if (!isPublicPath) {
      return <Redirect to="/login" />;
    }
    return <>{children}</>;
  }

  // Admin users - redirect to dashboard if on root or wrong pages
  if (isAdmin) {
    // If admin is on root, messenger, or onboarding, redirect to dashboard
    if (location === '/' || location === '/messenger' || location === '/onboarding') {
      return <Redirect to="/dashboard" />;
    }
    return <>{children}</>;
  }

  // Non-admin users - can't access admin pages
  const adminPaths = ['/dashboard', '/candidates', '/interviews', '/airtop', '/elevenlabs'];
  if (adminPaths.some(path => location.startsWith(path))) {
    // Redirect non-admins to messenger or onboarding
    if (status && !status.hasCompleted) {
      return <Redirect to="/onboarding" />;
    }
    return <Redirect to="/messenger" />;
  }

  // User hasn't completed onboarding and isn't on onboarding page
  if (status && !status.hasCompleted && location !== "/onboarding") {
    return <Redirect to="/onboarding" />;
  }

  // User has completed onboarding but is on onboarding page
  if (status && status.hasCompleted && location === "/onboarding") {
    return <Redirect to="/messenger" />;
  }

  // Non-admin on root - redirect to messenger or onboarding
  if (location === '/') {
    if (status && !status.hasCompleted) {
      return <Redirect to="/onboarding" />;
    }
    return <Redirect to="/messenger" />;
  }

  return <>{children}</>;
}

function Router() {
  const [location] = useLocation();
  
  // Special handling for dev/messenger route - bypass all guards
  if (location === '/dev/messenger') {
    return <DevMessengerPage />;
  }
  
  return (
    <OnboardingGuard>
      <Switch>
        <Route path="/login" component={LoginPage} />
        <Route path="/">{() => <AdminPageWrapper><Dashboard /></AdminPageWrapper>}</Route>
        <Route path="/dashboard">{() => <AdminPageWrapper><Dashboard /></AdminPageWrapper>}</Route>
        <Route path="/candidates">{() => <AdminPageWrapper><Candidates /></AdminPageWrapper>}</Route>
        <Route path="/interviews">{() => <AdminPageWrapper><Interviews /></AdminPageWrapper>}</Route>
        <Route path="/interview/:token">{() => <AdminPageWrapper><Interview /></AdminPageWrapper>}</Route>
        <Route path="/booking/:token" component={Booking} />
        <Route path="/airtop">{() => <AdminPageWrapper><AirtopIntegration /></AdminPageWrapper>}</Route>
        <Route path="/elevenlabs">{() => <AdminPageWrapper><ElevenLabsPage /></AdminPageWrapper>}</Route>
        <Route path="/onboarding" component={OnboardingPage} />
        <Route path="/messenger" component={MessengerPage} />
        <Route component={NotFound} />
      </Switch>
    </OnboardingGuard>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

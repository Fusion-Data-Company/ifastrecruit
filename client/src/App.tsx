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
import NotFound from "@/pages/not-found";

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

  // Not authenticated - let the route handle it
  if (!user) {
    return <>{children}</>;
  }

  // Admin users bypass onboarding
  if (isAdmin) {
    return <>{children}</>;
  }

  // User hasn't completed onboarding and isn't on onboarding page
  if (status && !status.hasCompleted && location !== "/onboarding") {
    return <Redirect to="/onboarding" />;
  }

  // User has completed onboarding but is on onboarding page
  if (status && status.hasCompleted && location === "/onboarding") {
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
        <Route path="/" component={Dashboard} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/candidates" component={Candidates} />
        <Route path="/interviews" component={Interviews} />
        <Route path="/interview/:token" component={Interview} />
        <Route path="/booking/:token" component={Booking} />
        <Route path="/airtop" component={AirtopIntegration} />
        <Route path="/elevenlabs" component={ElevenLabsPage} />
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
        {/* Platform Assistant - Fortune 500 Enterprise AI Assistant */}
        <MainUIAgent />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MainUIAgent, SecondaryAgent, CenterAgent } from "@/components/ElevenLabsWidgets";
import Dashboard from "@/pages/dashboard";
import Candidates from "@/pages/candidates";
import Interviews from "@/pages/interviews";
import Interview from "@/pages/interview";
import Booking from "@/pages/booking";
import AirtopIntegration from "@/pages/AirtopIntegration";
import ElevenLabsPage from "@/pages/elevenlabs";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/candidates" component={Candidates} />
      <Route path="/interviews" component={Interviews} />
      <Route path="/interview/:token" component={Interview} />
      <Route path="/booking/:token" component={Booking} />
      <Route path="/airtop" component={AirtopIntegration} />
      <Route path="/elevenlabs" component={ElevenLabsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
        {/* Temporarily disabled ElevenLabs widgets to resolve runtime error */}
        {/* <MainUIAgent />
        <SecondaryAgent />
        <CenterAgent /> */}
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

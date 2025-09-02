import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { InterviewAgent } from "@/components/ElevenLabsWidgets";

interface InterviewSession {
  candidateId: string;
  name: string;
  isActive: boolean;
  transcript?: string;
  score?: number;
  greenFlags?: string[];
  redFlags?: string[];
}

export default function Interview() {
  const { token } = useParams<{ token: string }>();
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "error">("connecting");

  const { data: candidateData, isLoading } = useQuery({
    queryKey: ["/interview", token],
    enabled: !!token,
  });

  useEffect(() => {
    if (candidateData) {
      setSession({
        candidateId: candidateData.candidateId,
        name: candidateData.name,
        isActive: false,
      });
      setConnectionStatus("connected");
    }
  }, [candidateData]);

  const handleStartInterview = async () => {
    if (!session) return;

    try {
      // TODO: Initialize ElevenLabs A3 Interview Agent
      setIsRecording(true);
      setSession(prev => prev ? { ...prev, isActive: true } : null);
      
      console.log("Starting interview with ElevenLabs A3 agent...");
      // const webrtcToken = await elevenlabsIntegration.createWebRTCToken("interview-agent-id");
      // Initialize WebRTC connection with A3 agent
      
    } catch (error) {
      console.error("Failed to start interview:", error);
      setConnectionStatus("error");
    }
  };

  const handleEndInterview = async () => {
    setIsRecording(false);
    setSession(prev => prev ? { ...prev, isActive: false } : null);
    
    // TODO: Process interview results and send to webhook
    console.log("Interview completed, processing results...");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="glass-panel rounded-lg p-8 text-center">
          <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-spinner fa-spin text-primary text-2xl"></i>
          </div>
          <p className="text-muted-foreground">Loading interview session...</p>
        </Card>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="glass-panel rounded-lg p-8 text-center max-w-md">
          <div className="w-16 h-16 bg-destructive/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-exclamation-triangle text-destructive text-2xl"></i>
          </div>
          <h1 className="enterprise-heading text-xl font-bold mb-2">Invalid Interview Link</h1>
          <p className="text-muted-foreground">This interview link is invalid or has expired.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
        className="glass-panel rounded-lg p-8 max-w-lg w-full text-center"
      >
        {/* Connection Status */}
        <div className="flex items-center justify-center space-x-2 mb-6">
          <div className={`w-3 h-3 rounded-full ${
            connectionStatus === "connected" ? "bg-accent" :
            connectionStatus === "connecting" ? "bg-primary" :
            "bg-destructive"
          }`}></div>
          <span className="text-sm text-muted-foreground">
            {connectionStatus === "connected" ? "Connected to Interview Agent" :
             connectionStatus === "connecting" ? "Connecting..." :
             "Connection Error"}
          </span>
        </div>

        {/* Agent Avatar */}
        <div className="w-20 h-20 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center mx-auto mb-6 agent-status">
          <i className="fas fa-video text-white text-2xl"></i>
        </div>

        <h1 className="enterprise-heading text-2xl font-bold mb-2">Voice Interview</h1>
        <p className="text-lg font-medium mb-2" data-testid="candidate-name">Hello, {session.name}!</p>
        <p className="text-muted-foreground mb-6">
          You're about to start a voice interview with our AI agent. This session will be recorded and evaluated for your application.
        </p>

        {!session.isActive ? (
          <Button
            onClick={handleStartInterview}
            className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-semibold glow-hover mb-4"
            disabled={connectionStatus !== "connected"}
            data-testid="start-interview-button"
          >
            <i className="fas fa-microphone mr-2"></i>
            Start Interview
          </Button>
        ) : (
          <div className="space-y-4">
            <div className="glass-input p-4 rounded-lg">
              <div className="flex items-center justify-center space-x-3 mb-3">
                <div className="w-4 h-4 bg-destructive rounded-full voice-indicator"></div>
                <span className="font-semibold">Interview in Progress</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Speak clearly and naturally. The AI agent will guide you through the interview process.
              </p>
            </div>

            {session.transcript && (
              <div className="glass-input p-4 rounded-lg text-left">
                <h3 className="font-semibold mb-2">Live Transcript</h3>
                <div className="text-sm text-muted-foreground max-h-32 overflow-y-auto scroll-area">
                  {session.transcript}
                </div>
              </div>
            )}

            <Button
              onClick={handleEndInterview}
              variant="destructive"
              className="w-full py-3 rounded-lg font-semibold"
              data-testid="end-interview-button"
            >
              <i className="fas fa-stop mr-2"></i>
              End Interview
            </Button>
          </div>
        )}

        {/* Results Section */}
        {session.score !== undefined && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-input p-4 rounded-lg text-left mt-6"
          >
            <h3 className="font-semibold mb-3">Interview Results</h3>
            <div className="flex items-center space-x-3 mb-3">
              <span className="text-sm">Overall Score:</span>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-accent rounded-full transition-all duration-500"
                  style={{ width: `${session.score}%` }}
                />
              </div>
              <span className="font-semibold">{session.score}%</span>
            </div>

            {session.greenFlags && session.greenFlags.length > 0 && (
              <div className="mb-3">
                <h4 className="text-sm font-medium mb-2 text-accent">Green Flags</h4>
                <div className="space-y-1">
                  {session.greenFlags.map((flag, index) => (
                    <Badge key={index} className="bg-accent/20 text-accent text-xs">
                      {flag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {session.redFlags && session.redFlags.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 text-destructive">Red Flags</h4>
                <div className="space-y-1">
                  {session.redFlags.map((flag, index) => (
                    <Badge key={index} className="bg-destructive/20 text-destructive text-xs">
                      {flag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        <p className="text-xs text-muted-foreground mt-6">
          Powered by ElevenLabs Voice AI • iFast Broker
        </p>
      </motion.div>
      
      <InterviewAgent />
    </div>
  );
}

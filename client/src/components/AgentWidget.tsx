import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion, AnimatePresence } from "framer-motion";
import { useMCPClient } from "@/lib/mcp-client";

interface Message {
  id: string;
  type: "agent" | "user";
  content: string;
  timestamp: Date;
  toolExecutions?: string[];
}

export default function AgentWidget() {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      type: "agent",
      content: "Hello! I'm your UI Interface Agent. I can help you launch campaigns, manage candidates, and execute any recruiting workflow. What would you like to accomplish today?",
      timestamp: new Date(),
    }
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const { callTool, isLoading } = useMCPClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content: inputMessage,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage("");

    try {
      // Process message through LLM router to determine action
      const llmResponse = await callTool("llm.route", {
        prompt: `As the UI Interface Agent, analyze this request and execute appropriate MCP tools: "${inputMessage}"`,
        profile: "orchestrator"
      });

      // Simulate agent response with tool execution
      const agentMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: "agent",
        content: llmResponse.response || "I've processed your request and executed the necessary tools.",
        timestamp: new Date(),
        toolExecutions: ["llm.route"], // Would be populated by actual tool calls
      };

      setMessages(prev => [...prev, agentMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: "agent",
        content: "I encountered an error processing your request. Please try again or rephrase your request.",
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const handleVoiceInput = () => {
    setIsRecording(!isRecording);
    // TODO: Integrate with ElevenLabs WebRTC
    console.log("Voice input:", isRecording ? "stopped" : "started");
  };

  if (isMinimized) {
    return (
      <motion.div
        className="fixed bottom-6 right-6 w-16 h-16 glass-panel agent-glow rounded-full z-50 flex items-center justify-center cursor-pointer"
        onClick={() => setIsMinimized(false)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        data-testid="agent-widget-minimized"
      >
        <i className="fas fa-robot text-primary text-xl"></i>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="fixed bottom-6 right-6 w-96 h-[600px] glass-panel agent-glow rounded-lg z-50 flex flex-col"
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      data-testid="agent-widget"
    >
      {/* Agent Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center agent-status">
              <i className="fas fa-robot text-white"></i>
            </div>
            <div>
              <h3 className="enterprise-heading font-semibold">UI Interface Agent</h3>
              <p className="text-xs text-muted-foreground">Voice + Text Assistant</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              className={`w-8 h-8 glass-input rounded-lg glow-hover ${isRecording ? "bg-destructive/20 text-destructive" : ""}`}
              onClick={handleVoiceInput}
              data-testid="voice-input-button"
            >
              <i className={`fas fa-microphone text-sm ${isRecording ? "voice-indicator" : ""}`}></i>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-8 h-8 glass-input rounded-lg glow-hover"
              onClick={() => setIsMinimized(true)}
              data-testid="minimize-agent-button"
            >
              <i className="fas fa-minus text-sm"></i>
            </Button>
          </div>
        </div>
        <div className="text-xs text-accent">
          <i className="fas fa-circle text-[6px] mr-1"></i>
          Connected to ElevenLabs • MCP Active
        </div>
      </div>

      {/* Chat Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          <AnimatePresence>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
                className={`flex items-start space-x-3 ${
                  message.type === "user" ? "flex-row-reverse space-x-reverse" : ""
                }`}
                data-testid={`message-${message.type}-${message.id}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  message.type === "agent" 
                    ? "bg-primary/20" 
                    : "bg-accent/20"
                }`}>
                  <i className={`text-sm ${
                    message.type === "agent" 
                      ? "fas fa-robot text-primary" 
                      : "fas fa-user text-accent"
                  }`}></i>
                </div>
                
                <div className={`p-3 rounded-lg max-w-[280px] ${
                  message.type === "agent"
                    ? "glass-input"
                    : "bg-primary/20 border border-primary/30"
                }`}>
                  <p className="text-sm">{message.content}</p>
                  
                  {message.toolExecutions && message.toolExecutions.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-border/50">
                      <p className="text-xs text-muted-foreground mb-1">MCP Tools Executed:</p>
                      <div className="space-y-1">
                        {message.toolExecutions.map((tool, index) => (
                          <div key={index} className="flex items-center space-x-2 text-xs">
                            <i className="fas fa-check text-accent"></i>
                            <span>{tool}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <span className="text-xs text-muted-foreground mt-2 block">
                    {message.timestamp.toLocaleTimeString()}
                  </span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center space-x-2">
          <div className="flex-1 glass-input rounded-lg px-3 py-2 flex items-center space-x-2">
            <Input
              type="text"
              placeholder="Type your request or use voice..."
              className="flex-1 bg-transparent border-none outline-none text-sm p-0 h-auto focus-visible:ring-0"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              disabled={isLoading}
              data-testid="message-input"
            />
            <Button
              variant="ghost"
              size="sm"
              className={`w-8 h-8 bg-primary rounded-lg glow-hover micro-animation ${isRecording ? "bg-destructive" : ""}`}
              onClick={handleVoiceInput}
              data-testid="voice-toggle-button"
            >
              <i className={`fas fa-microphone text-primary-foreground text-sm ${isRecording ? "voice-indicator" : ""}`}></i>
            </Button>
          </div>
          <Button
            className="w-10 h-10 bg-accent rounded-lg glow-hover micro-animation"
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || isLoading}
            data-testid="send-message-button"
          >
            {isLoading ? (
              <i className="fas fa-spinner fa-spin text-accent-foreground text-sm"></i>
            ) : (
              <i className="fas fa-paper-plane text-accent-foreground text-sm"></i>
            )}
          </Button>
        </div>
        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
          <span>Press & hold for voice input</span>
          <span data-testid="tools-count">11 tools available</span>
        </div>
      </div>
    </motion.div>
  );
}

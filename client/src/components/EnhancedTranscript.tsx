import { useState } from "react";
import { MessageSquare, User, Bot, Clock, Copy, Search, Filter, Download } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

interface TranscriptMessage {
  speaker: 'agent' | 'candidate';
  message: string;
  timestamp?: string;
  duration?: number;
}

interface EnhancedTranscriptProps {
  transcript: string;
  candidateName?: string;
  agentName?: string;
  interviewDate?: string | Date;
  duration?: string;
  messageCount?: number;
  className?: string;
}

export function EnhancedTranscript({ 
  transcript, 
  candidateName, 
  agentName = "AI Agent", 
  interviewDate,
  duration,
  messageCount,
  className 
}: EnhancedTranscriptProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showOnlyCandidate, setShowOnlyCandidate] = useState(false);
  const [showOnlyAgent, setShowOnlyAgent] = useState(false);
  const { toast } = useToast();

  // Parse transcript into structured messages
  const parseTranscript = (rawTranscript: string): TranscriptMessage[] => {
    if (!rawTranscript) return [];

    try {
      // Try to parse as JSON first (structured format)
      const parsed = JSON.parse(rawTranscript);
      if (Array.isArray(parsed)) {
        return parsed.map((item: any) => ({
          speaker: item.speaker === 'agent' || item.speaker === 'ai' ? 'agent' : 'candidate',
          message: item.message || item.text || String(item),
          timestamp: item.timestamp,
          duration: item.duration
        }));
      }
    } catch {
      // If not JSON, parse as plain text
      const lines = rawTranscript.split('\n').filter(line => line.trim());
      const messages: TranscriptMessage[] = [];
      
      for (const line of lines) {
        // Try to identify speaker patterns
        let speaker: 'agent' | 'candidate' = 'candidate';
        let message = line.trim();
        
        // Common patterns for agent identification
        if (line.match(/^(Agent|AI|Assistant|Bot|System)[\s:]/i)) {
          speaker = 'agent';
          message = line.replace(/^(Agent|AI|Assistant|Bot|System)[\s:]+/i, '').trim();
        } else if (line.match(/^(Candidate|User|Applicant)[\s:]/i)) {
          speaker = 'candidate';
          message = line.replace(/^(Candidate|User|Applicant)[\s:]+/i, '').trim();
        } else if (line.includes('[Agent]') || line.includes('[AI]')) {
          speaker = 'agent';
          message = line.replace(/\[(Agent|AI)\]/gi, '').trim();
        } else if (line.includes('[Candidate]') || line.includes('[User]')) {
          speaker = 'candidate';
          message = line.replace(/\[(Candidate|User)\]/gi, '').trim();
        }
        
        // Extract timestamp if present
        const timestampMatch = message.match(/^\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?\s*/);
        let timestamp;
        if (timestampMatch) {
          timestamp = timestampMatch[1];
          message = message.replace(timestampMatch[0], '').trim();
        }
        
        if (message) {
          messages.push({ speaker, message, timestamp });
        }
      }
      
      return messages;
    }
    
    return [];
  };

  const messages = parseTranscript(transcript);

  // Filter messages based on search and speaker filters
  const filteredMessages = messages.filter(msg => {
    const matchesSearch = !searchTerm || 
      msg.message.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesSpeakerFilter = 
      (!showOnlyCandidate && !showOnlyAgent) ||
      (showOnlyCandidate && msg.speaker === 'candidate') ||
      (showOnlyAgent && msg.speaker === 'agent');
    
    return matchesSearch && matchesSpeakerFilter;
  });

  const copyTranscript = () => {
    const formattedTranscript = messages.map(msg => 
      `${msg.speaker === 'agent' ? agentName : candidateName || 'Candidate'}: ${msg.message}`
    ).join('\n\n');
    
    navigator.clipboard.writeText(formattedTranscript);
    toast({
      title: "Transcript Copied",
      description: "The complete transcript has been copied to your clipboard.",
    });
  };

  const downloadTranscript = () => {
    const formattedTranscript = messages.map(msg => 
      `${msg.timestamp ? `[${msg.timestamp}] ` : ''}${msg.speaker === 'agent' ? agentName : candidateName || 'Candidate'}: ${msg.message}`
    ).join('\n\n');
    
    const blob = new Blob([formattedTranscript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${candidateName || 'candidate'}_interview_transcript.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const formatInterviewDate = (date: string | Date): string => {
    if (!date) return '';
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleString();
  };

  const getCandidateMessageCount = () => 
    messages.filter(msg => msg.speaker === 'candidate').length;
  
  const getAgentMessageCount = () => 
    messages.filter(msg => msg.speaker === 'agent').length;

  if (!transcript || transcript.trim() === '' || transcript === '-') {
    return (
      <Card className={`p-6 border-2 border-muted ${className}`}>
        <div className="text-center py-8">
          <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Transcript Available</h3>
          <p className="text-muted-foreground">
            No interview transcript has been recorded for this candidate yet.
          </p>
        </div>
      </Card>
    );
  }

  if (messages.length === 0) {
    return (
      <Card className={`p-6 border-2 border-muted ${className}`}>
        <div className="text-center py-8">
          <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Transcript Processing Error</h3>
          <p className="text-muted-foreground mb-4">
            Unable to parse the transcript format. Showing raw content below:
          </p>
          <div className="bg-muted/50 rounded p-4 text-left">
            <pre className="text-sm whitespace-pre-wrap">{transcript}</pre>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className={`border-2 border-primary/20 ${className}`}>
      {/* Header */}
      <div className="p-6 border-b bg-gradient-to-r from-primary/5 to-secondary/5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold flex items-center">
              <MessageSquare className="h-5 w-5 mr-2" />
              Interview Transcript
            </h3>
            {candidateName && (
              <p className="text-sm text-muted-foreground mt-1">
                Interview with {candidateName}
              </p>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={copyTranscript}
              data-testid="copy-transcript"
            >
              <Copy className="h-4 w-4 mr-1" />
              Copy
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={downloadTranscript}
              data-testid="download-transcript"
            >
              <Download className="h-4 w-4 mr-1" />
              Download
            </Button>
          </div>
        </div>

        {/* Interview Metadata */}
        <div className="flex flex-wrap items-center gap-4 mb-4">
          {interviewDate && (
            <div className="flex items-center text-sm text-muted-foreground">
              <Clock className="h-4 w-4 mr-1" />
              {formatInterviewDate(interviewDate)}
            </div>
          )}
          {duration && (
            <Badge variant="outline">
              Duration: {duration}
            </Badge>
          )}
          <Badge variant="outline">
            {messages.length} messages
          </Badge>
          <Badge variant="outline">
            Agent: {getAgentMessageCount()} • Candidate: {getCandidateMessageCount()}
          </Badge>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search transcript..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="transcript-search"
            />
          </div>
          <Button
            variant={showOnlyAgent ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setShowOnlyAgent(!showOnlyAgent);
              setShowOnlyCandidate(false);
            }}
            data-testid="filter-agent"
          >
            <Bot className="h-4 w-4 mr-1" />
            Agent ({getAgentMessageCount()})
          </Button>
          <Button
            variant={showOnlyCandidate ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setShowOnlyCandidate(!showOnlyCandidate);
              setShowOnlyAgent(false);
            }}
            data-testid="filter-candidate"
          >
            <User className="h-4 w-4 mr-1" />
            Candidate ({getCandidateMessageCount()})
          </Button>
        </div>
      </div>

      {/* Transcript Messages */}
      <ScrollArea className="h-[500px] p-6">
        {filteredMessages.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Filter className="h-8 w-8 mx-auto mb-2" />
            No messages match your search criteria.
          </div>
        ) : (
          <div className="space-y-4">
            {filteredMessages.map((message, index) => (
              <div key={index} className="group">
                <div className={`flex items-start space-x-3 ${
                  message.speaker === 'agent' 
                    ? 'justify-start' 
                    : 'justify-end'
                }`}>
                  {message.speaker === 'agent' && (
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                    </div>
                  )}
                  
                  <div className={`max-w-[80%] ${
                    message.speaker === 'agent' 
                      ? 'bg-primary/5 border-primary/20' 
                      : 'bg-secondary/10 border-secondary/20'
                  } border rounded-lg p-4`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold">
                        {message.speaker === 'agent' ? agentName : candidateName || 'Candidate'}
                      </span>
                      {message.timestamp && (
                        <span className="text-xs text-muted-foreground">
                          {message.timestamp}
                        </span>
                      )}
                    </div>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {searchTerm && message.message.toLowerCase().includes(searchTerm.toLowerCase()) ? (
                        message.message.split(new RegExp(`(${searchTerm})`, 'gi')).map((part, i) => 
                          part.toLowerCase() === searchTerm.toLowerCase() ? 
                            <mark key={i} className="bg-yellow-200 dark:bg-yellow-800">{part}</mark> : part
                        )
                      ) : (
                        message.message
                      )}
                    </p>
                  </div>
                  
                  {message.speaker === 'candidate' && (
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-secondary/10 rounded-full flex items-center justify-center">
                        <User className="h-4 w-4 text-secondary" />
                      </div>
                    </div>
                  )}
                </div>
                
                {index < filteredMessages.length - 1 && (
                  <Separator className="my-4 opacity-50" />
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </Card>
  );
}
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

interface MessageGroup {
  speaker: 'agent' | 'candidate';
  messages: TranscriptMessage[];
  startTimestamp?: string;
  endTimestamp?: string;
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

  // Parse transcript into structured messages with improved whitespace handling
  const parseTranscript = (rawTranscript: string): TranscriptMessage[] => {
    if (!rawTranscript) return [];

    try {
      // Try to parse as JSON first (structured format)
      const parsed = JSON.parse(rawTranscript);
      
      // Handle direct array format
      if (Array.isArray(parsed)) {
        return parsed.map((item: any) => ({
          speaker: item.speaker === 'agent' || item.speaker === 'ai' ? 'agent' : 'candidate',
          message: (item.message || item.text || String(item)).replace(/\s+/g, ' ').trim(),
          timestamp: item.timestamp,
          duration: item.duration
        })).filter(msg => msg.message.length > 0);
      }
      
      // Handle object with messages array (common ElevenLabs format)
      if (parsed && typeof parsed === 'object') {
        const messagesArray = parsed.messages || parsed.transcript || parsed.data || [];
        if (Array.isArray(messagesArray) && messagesArray.length > 0) {
          return messagesArray.map((item: any) => ({
            speaker: item.speaker === 'agent' || item.speaker === 'ai' ? 'agent' : 'candidate',
            message: (item.message || item.text || String(item)).replace(/\s+/g, ' ').trim(),
            timestamp: item.timestamp,
            duration: item.duration
          })).filter(msg => msg.message.length > 0);
        }
        
        // Handle single object with text content
        if (parsed.message || parsed.text) {
          return [{
            speaker: parsed.speaker === 'agent' || parsed.speaker === 'ai' ? 'agent' : 'candidate',
            message: (parsed.message || parsed.text).replace(/\s+/g, ' ').trim(),
            timestamp: parsed.timestamp,
            duration: parsed.duration
          }].filter(msg => msg.message.length > 0);
        }
      }
    } catch {
      // If not JSON, parse as plain text with enhanced cleanup
      const lines = rawTranscript
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0 && !line.match(/^\s*$/)); // Filter empty and whitespace-only lines
      
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
        
        // Clean up excessive whitespace and ensure message has content
        message = message.replace(/\s+/g, ' ').trim();
        
        if (message && message.length > 0) {
          messages.push({ speaker, message, timestamp });
        }
      }
      
      return messages;
    }
    
    return [];
  };

  // Group consecutive messages by the same speaker
  const groupMessages = (messages: TranscriptMessage[]): MessageGroup[] => {
    if (messages.length === 0) return [];
    
    const groups: MessageGroup[] = [];
    let currentGroup: MessageGroup = {
      speaker: messages[0].speaker,
      messages: [messages[0]],
      startTimestamp: messages[0].timestamp,
      endTimestamp: messages[0].timestamp
    };
    
    for (let i = 1; i < messages.length; i++) {
      const message = messages[i];
      
      if (message.speaker === currentGroup.speaker) {
        // Same speaker, add to current group
        currentGroup.messages.push(message);
        if (message.timestamp) {
          currentGroup.endTimestamp = message.timestamp;
        }
      } else {
        // Different speaker, start new group
        groups.push(currentGroup);
        currentGroup = {
          speaker: message.speaker,
          messages: [message],
          startTimestamp: message.timestamp,
          endTimestamp: message.timestamp
        };
      }
    }
    
    // Don't forget the last group
    groups.push(currentGroup);
    
    return groups;
  };

  const messages = parseTranscript(transcript);
  const messageGroups = groupMessages(messages);

  // Filter message groups based on search and speaker filters
  const filteredGroups = messageGroups.map(group => {
    // Filter messages within the group based on search
    const filteredMessages = group.messages.filter(msg => {
      const matchesSearch = !searchTerm || 
        msg.message.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });
    
    // Check if group should be included based on speaker filter
    const matchesSpeakerFilter = 
      (!showOnlyCandidate && !showOnlyAgent) ||
      (showOnlyCandidate && group.speaker === 'candidate') ||
      (showOnlyAgent && group.speaker === 'agent');
    
    // Return group only if it has filtered messages and matches speaker filter
    if (filteredMessages.length > 0 && matchesSpeakerFilter) {
      return { ...group, messages: filteredMessages };
    }
    return null;
  }).filter(group => group !== null) as MessageGroup[];

  const copyTranscript = () => {
    const formattedTranscript = messageGroups.map(group => {
      const speakerName = group.speaker === 'agent' ? agentName : candidateName || 'Candidate';
      const timeRange = group.startTimestamp ? 
        (group.startTimestamp === group.endTimestamp ? 
          `[${group.startTimestamp}] ` : 
          `[${group.startTimestamp} - ${group.endTimestamp}] `) : '';
      
      const groupMessages = group.messages.map(msg => msg.message).join(' ');
      return `${timeRange}${speakerName}: ${groupMessages}`;
    }).join('\n\n');
    
    navigator.clipboard.writeText(formattedTranscript);
    toast({
      title: "Transcript Copied",
      description: "The complete transcript has been copied to your clipboard.",
    });
  };

  const downloadTranscript = () => {
    const formattedTranscript = messageGroups.map(group => {
      const speakerName = group.speaker === 'agent' ? agentName : candidateName || 'Candidate';
      const timeRange = group.startTimestamp ? 
        (group.startTimestamp === group.endTimestamp ? 
          `[${group.startTimestamp}] ` : 
          `[${group.startTimestamp} - ${group.endTimestamp}] `) : '';
      
      const groupMessages = group.messages.map(msg => msg.message).join(' ');
      return `${timeRange}${speakerName}: ${groupMessages}`;
    }).join('\n\n');
    
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
            {messages.length} messages ({messageGroups.length} groups)
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

      {/* Transcript Messages - Responsive Layout */}
      <ScrollArea className="h-[400px] md:h-[500px] lg:h-[600px] p-3">
        {filteredGroups.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Filter className="h-8 w-8 mx-auto mb-2" />
            No messages match your search criteria.
          </div>
        ) : (
          <div className="space-y-2">
            {filteredGroups.map((group, groupIndex) => (
              <div key={groupIndex} className="group">
                <div className={`flex items-start space-x-2 ${
                  group.speaker === 'agent' 
                    ? 'justify-start' 
                    : 'justify-end'
                }`}>
                  {group.speaker === 'agent' && (
                    <div className="flex-shrink-0 mt-1">
                      <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center">
                        <Bot className="h-3 w-3 text-primary" />
                      </div>
                    </div>
                  )}
                  
                  <div className={`max-w-[85%] ${
                    group.speaker === 'agent' 
                      ? 'bg-primary/5 border-primary/20' 
                      : 'bg-secondary/10 border-secondary/20'
                  } border rounded-lg p-2`}>
                    {/* Speaker header with timestamp range */}
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-muted-foreground">
                        {group.speaker === 'agent' ? agentName : candidateName || 'Candidate'}
                      </span>
                      {(group.startTimestamp || group.endTimestamp) && (
                        <span className="text-xs text-muted-foreground">
                          {group.startTimestamp}
                          {group.startTimestamp !== group.endTimestamp && group.endTimestamp && 
                            ` - ${group.endTimestamp}`
                          }
                        </span>
                      )}
                    </div>
                    
                    {/* Messages in the group */}
                    <div className="space-y-1">
                      {group.messages.map((message, messageIndex) => (
                        <p key={messageIndex} className="text-sm leading-tight">
                          {searchTerm && message.message.toLowerCase().includes(searchTerm.toLowerCase()) ? (
                            // Safe search highlighting without regex crashes
                            (() => {
                              const lowerMessage = message.message.toLowerCase();
                              const lowerSearchTerm = searchTerm.toLowerCase();
                              const parts = [];
                              let lastIndex = 0;
                              let index = lowerMessage.indexOf(lowerSearchTerm, lastIndex);
                              
                              while (index !== -1) {
                                // Add text before match
                                if (index > lastIndex) {
                                  parts.push(message.message.slice(lastIndex, index));
                                }
                                // Add highlighted match
                                parts.push(
                                  <mark key={`match-${index}`} className="bg-yellow-200 dark:bg-yellow-800">
                                    {message.message.slice(index, index + searchTerm.length)}
                                  </mark>
                                );
                                lastIndex = index + searchTerm.length;
                                index = lowerMessage.indexOf(lowerSearchTerm, lastIndex);
                              }
                              
                              // Add remaining text
                              if (lastIndex < message.message.length) {
                                parts.push(message.message.slice(lastIndex));
                              }
                              
                              return parts;
                            })()
                          ) : (
                            message.message
                          )}
                        </p>
                      ))}
                    </div>
                  </div>
                  
                  {group.speaker === 'candidate' && (
                    <div className="flex-shrink-0 mt-1">
                      <div className="w-6 h-6 bg-secondary/10 rounded-full flex items-center justify-center">
                        <User className="h-3 w-3 text-secondary" />
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Minimal separation between groups */}
                {groupIndex < filteredGroups.length - 1 && (
                  <div className="h-2" />
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </Card>
  );
}
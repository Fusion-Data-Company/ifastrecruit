import { useState } from "react";
import { MessageSquare, User, Bot, Clock, Copy, Search, Filter, Download, ChevronDown, ChevronUp, BarChart3, Users, Timer } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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
  const [isExpanded, setIsExpanded] = useState(false);
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
        return parsed.map((item: any): TranscriptMessage => ({
          speaker: (item.speaker === 'agent' || item.speaker === 'ai' ? 'agent' : 'candidate') as 'agent' | 'candidate',
          message: (item.message || item.text || String(item)).replace(/\s+/g, ' ').trim(),
          timestamp: item.timestamp,
          duration: item.duration
        })).filter(msg => msg.message.length > 0);
      }
      
      // Handle object with messages array (common ElevenLabs format)
      if (parsed && typeof parsed === 'object') {
        const messagesArray = parsed.messages || parsed.transcript || parsed.data || [];
        if (Array.isArray(messagesArray) && messagesArray.length > 0) {
          return messagesArray.map((item: any): TranscriptMessage => ({
            speaker: (item.speaker === 'agent' || item.speaker === 'ai' ? 'agent' : 'candidate') as 'agent' | 'candidate',
            message: (item.message || item.text || String(item)).replace(/\s+/g, ' ').trim(),
            timestamp: item.timestamp,
            duration: item.duration
          })).filter(msg => msg.message.length > 0);
        }
        
        // Handle single object with text content
        if (parsed.message || parsed.text) {
          return ([{
            speaker: (parsed.speaker === 'agent' || parsed.speaker === 'ai' ? 'agent' : 'candidate') as 'agent' | 'candidate',
            message: (parsed.message || parsed.text).replace(/\s+/g, ' ').trim(),
            timestamp: parsed.timestamp,
            duration: parsed.duration
          }] as TranscriptMessage[]).filter(msg => msg.message.length > 0);
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

  // Calculate conversation highlights for summary
  const getConversationHighlights = () => {
    if (messages.length === 0) return null;
    
    const totalWords = messages.reduce((acc, msg) => 
      acc + msg.message.split(' ').length, 0);
    
    const conversationFlow = messageGroups.length;
    const avgWordsPerMessage = Math.round(totalWords / messages.length);
    
    // Get first and last few words for preview
    const firstMessage = messages[0]?.message || '';
    const lastMessage = messages[messages.length - 1]?.message || '';
    const preview = firstMessage.length > 60 ? 
      firstMessage.slice(0, 60) + '...' : firstMessage;
    
    return {
      totalWords,
      conversationFlow,
      avgWordsPerMessage,
      preview,
      firstMessage,
      lastMessage
    };
  };

  const highlights = getConversationHighlights();

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
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <Card className={`border border-primary/20 bg-gradient-to-br from-white/80 to-gray-50/80 dark:from-gray-900/80 dark:to-gray-800/80 backdrop-blur-xl shadow-lg hover:shadow-xl transition-all duration-300 ${className}`}>
        {/* Professional Summary Header */}
        <CollapsibleTrigger asChild>
          <div className="p-6 cursor-pointer hover:bg-gradient-to-r hover:from-primary/5 hover:to-secondary/5 transition-all duration-300 border-b border-primary/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                  <MessageSquare className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold flex items-center text-gray-900 dark:text-gray-100">
                    Interview Transcript
                    {candidateName && (
                      <Badge variant="secondary" className="ml-3 bg-primary/10 text-primary border-primary/20">
                        {candidateName}
                      </Badge>
                    )}
                  </h3>
                  {highlights && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 max-w-md truncate">
                      {highlights.preview}
                    </p>
                  )}
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                {/* Quick Stats */}
                <div className="hidden md:flex items-center space-x-4 mr-4">
                  <div className="flex items-center space-x-2 bg-white/60 dark:bg-gray-800/60 px-3 py-2 rounded-lg backdrop-blur-sm border border-primary/10">
                    <Timer className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">{duration || 'N/A'}</span>
                  </div>
                  <div className="flex items-center space-x-2 bg-white/60 dark:bg-gray-800/60 px-3 py-2 rounded-lg backdrop-blur-sm border border-primary/10">
                    <Users className="h-4 w-4 text-secondary" />
                    <span className="text-sm font-medium">{messages.length}</span>
                  </div>
                  <div className="flex items-center space-x-2 bg-white/60 dark:bg-gray-800/60 px-3 py-2 rounded-lg backdrop-blur-sm border border-primary/10">
                    <BarChart3 className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium">{messageGroups.length} exchanges</span>
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="flex items-center space-x-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={(e) => {
                      e.stopPropagation();
                      copyTranscript();
                    }}
                    className="bg-white/60 dark:bg-gray-800/60 hover:bg-white/80 dark:hover:bg-gray-700/80 backdrop-blur-sm border border-primary/10"
                    data-testid="copy-transcript"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadTranscript();
                    }}
                    className="bg-white/60 dark:bg-gray-800/60 hover:bg-white/80 dark:hover:bg-gray-700/80 backdrop-blur-sm border border-primary/10"
                    data-testid="download-transcript"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
                
                {/* Expand/Collapse Icon */}
                <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center transition-transform duration-200 group-hover:scale-110">
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-primary" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-primary" />
                  )}
                </div>
              </div>
            </div>
            
            {/* Mobile Quick Stats */}
            <div className="md:hidden mt-4 flex items-center space-x-3">
              <Badge variant="outline" className="bg-white/60 dark:bg-gray-800/60 border-primary/20">
                {duration || 'N/A'}
              </Badge>
              <Badge variant="outline" className="bg-white/60 dark:bg-gray-800/60 border-primary/20">
                {messages.length} messages
              </Badge>
              <Badge variant="outline" className="bg-white/60 dark:bg-gray-800/60 border-primary/20">
                {messageGroups.length} exchanges
              </Badge>
            </div>
          </div>
        </CollapsibleTrigger>


        
        {/* Expanded Content Area */}
        <CollapsibleContent className="border-t border-primary/10">
          <div className="bg-gradient-to-b from-gray-50/50 to-white/50 dark:from-gray-800/50 dark:to-gray-900/50">
            {/* Enhanced Header with Metadata */}
            <div className="p-6 border-b border-primary/10">
              <div className="flex flex-wrap items-center gap-4 mb-4">
                {interviewDate && (
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-400 bg-white/60 dark:bg-gray-800/60 px-3 py-2 rounded-lg backdrop-blur-sm border border-primary/10">
                    <Clock className="h-4 w-4 mr-2" />
                    {formatInterviewDate(interviewDate)}
                  </div>
                )}
                <div className="flex items-center space-x-3">
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                    {messages.length} messages
                  </Badge>
                  <Badge variant="outline" className="bg-secondary/10 text-secondary border-secondary/20">
                    {messageGroups.length} exchanges
                  </Badge>
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
                    Agent: {getAgentMessageCount()}
                  </Badge>
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800">
                    Candidate: {getCandidateMessageCount()}
                  </Badge>
                </div>
              </div>
              
              {/* Enhanced Search and Filters */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[250px]">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search conversation..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-primary/20 focus:border-primary/40 focus:ring-primary/20"
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
                  className={`${showOnlyAgent ? 'bg-primary hover:bg-primary/90' : 'bg-white/60 dark:bg-gray-800/60 hover:bg-white/80 dark:hover:bg-gray-700/80'} backdrop-blur-sm border-primary/20`}
                  data-testid="filter-agent"
                >
                  <Bot className="h-4 w-4 mr-2" />
                  Agent ({getAgentMessageCount()})
                </Button>
                <Button
                  variant={showOnlyCandidate ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setShowOnlyCandidate(!showOnlyCandidate);
                    setShowOnlyAgent(false);
                  }}
                  className={`${showOnlyCandidate ? 'bg-secondary hover:bg-secondary/90' : 'bg-white/60 dark:bg-gray-800/60 hover:bg-white/80 dark:hover:bg-gray-700/80'} backdrop-blur-sm border-secondary/20`}
                  data-testid="filter-candidate"
                >
                  <User className="h-4 w-4 mr-2" />
                  Candidate ({getCandidateMessageCount()})
                </Button>
              </div>
            </div>

            
            {/* Enhanced Transcript Messages */}
            <ScrollArea className="h-[400px] md:h-[500px] lg:h-[600px] p-6 bg-gradient-to-b from-white/40 to-gray-50/40 dark:from-gray-900/40 dark:to-gray-800/40">
              {filteredGroups.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                    <Filter className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">No matches found</h3>
                  <p className="text-gray-600 dark:text-gray-400">Try adjusting your search criteria or filters</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {filteredGroups.map((group, groupIndex) => (
                    <div key={groupIndex} className="group">
                      <div className={`flex items-start space-x-4 ${
                        group.speaker === 'agent' 
                          ? 'justify-start' 
                          : 'justify-end flex-row-reverse space-x-reverse'
                      }`}>
                        {/* Speaker Avatar */}
                        <div className="flex-shrink-0">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center backdrop-blur-sm border ${
                            group.speaker === 'agent'
                              ? 'bg-gradient-to-br from-primary/20 to-primary/10 border-primary/20'
                              : 'bg-gradient-to-br from-secondary/20 to-secondary/10 border-secondary/20'
                          }`}>
                            {group.speaker === 'agent' ? (
                              <Bot className="h-5 w-5 text-primary" />
                            ) : (
                              <User className="h-5 w-5 text-secondary" />
                            )}
                          </div>
                        </div>
                        
                        {/* Message Content */}
                        <div className={`max-w-[75%] md:max-w-[85%] ${
                          group.speaker === 'agent' 
                            ? 'bg-gradient-to-br from-white/90 to-primary/5 border-primary/20' 
                            : 'bg-gradient-to-br from-white/90 to-secondary/5 border-secondary/20'
                        } border rounded-2xl p-4 backdrop-blur-sm shadow-sm hover:shadow-md transition-all duration-200`}>
                          {/* Speaker Header */}
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center space-x-2">
                              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                {group.speaker === 'agent' ? agentName : candidateName || 'Candidate'}
                              </span>
                              <Badge variant="secondary" className={`text-xs ${
                                group.speaker === 'agent' 
                                  ? 'bg-primary/10 text-primary border-primary/20'
                                  : 'bg-secondary/10 text-secondary border-secondary/20'
                              }`}>
                                {group.messages.length} message{group.messages.length > 1 ? 's' : ''}
                              </Badge>
                            </div>
                            {(group.startTimestamp || group.endTimestamp) && (
                              <span className="text-xs text-gray-500 dark:text-gray-400 bg-white/60 dark:bg-gray-800/60 px-2 py-1 rounded-md">
                                {group.startTimestamp}
                                {group.startTimestamp !== group.endTimestamp && group.endTimestamp && 
                                  ` - ${group.endTimestamp}`
                                }
                              </span>
                            )}
                          </div>
                          
                          {/* Messages */}
                          <div className="space-y-3">
                            {group.messages.map((message, messageIndex) => (
                              <div key={messageIndex} className="text-sm leading-relaxed text-gray-800 dark:text-gray-200">
                                {searchTerm && message.message.toLowerCase().includes(searchTerm.toLowerCase()) ? (
                                  (() => {
                                    const lowerMessage = message.message.toLowerCase();
                                    const lowerSearchTerm = searchTerm.toLowerCase();
                                    const parts = [];
                                    let lastIndex = 0;
                                    let index = lowerMessage.indexOf(lowerSearchTerm, lastIndex);
                                    
                                    while (index !== -1) {
                                      if (index > lastIndex) {
                                        parts.push(message.message.slice(lastIndex, index));
                                      }
                                      parts.push(
                                        <mark key={`match-${index}`} className="bg-yellow-200/80 dark:bg-yellow-800/60 px-1 py-0.5 rounded">
                                          {message.message.slice(index, index + searchTerm.length)}
                                        </mark>
                                      );
                                      lastIndex = index + searchTerm.length;
                                      index = lowerMessage.indexOf(lowerSearchTerm, lastIndex);
                                    }
                                    
                                    if (lastIndex < message.message.length) {
                                      parts.push(message.message.slice(lastIndex));
                                    }
                                    
                                    return parts;
                                  })()
                                ) : (
                                  message.message
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
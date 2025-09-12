import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { motion } from 'framer-motion';
import { 
  Download, 
  Play, 
  Calendar, 
  Clock, 
  MessageSquare, 
  AlertTriangle, 
  CheckCircle,
  User,
  Phone,
  Headphones,
  FileText,
  RefreshCw,
  Upload,
  Eye,
  UserCheck,
  Mail
} from 'lucide-react';

interface ConversationData {
  conversation_id: string;
  agent_id: string;
  user_id?: string;
  created_at: string;
  ended_at?: string;
  transcript?: any[];
  metadata?: any;
  details?: any;
  audio_info?: {
    has_audio: boolean;
    audio_url?: string;
    content_type?: string;
    audio_size_bytes?: number;
  };
  details_error?: string;
  audio_error?: string;
}

interface AgentData {
  agent: any;
  conversations: ConversationData[];
  total_conversations: number;
  error_details?: string[];
}

interface CollectionResult {
  success: boolean;
  agent_id: string;
  timestamp: string;
  data: AgentData;
}

interface ImportMatch {
  conversation_id: string;
  candidate_id: string;
  candidate_name: string;
  candidate_email: string;
  match_type: string;
  extracted_info: {
    emails?: string[];
    phones?: string[];
    names?: string[];
  };
}

interface ImportPreview {
  success: boolean;
  preview: boolean;
  total_conversations: number;
  matched_count: number;
  unmatched_count: number;
  error_count: number;
  matches: ImportMatch[];
  errors: any[];
}

interface ImportResult {
  success: boolean;
  imported: boolean;
  total_processed: number;
  results: {
    updated: number;
    failed: number;
    skipped: number;
    details: any[];
  };
}

export default function ElevenLabsDataCollection() {
  const [agentId, setAgentId] = useState('agent_0601k4t9d82qe5ybsgkngct0zzkm');
  const [selectedConversation, setSelectedConversation] = useState<ConversationData | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const { toast } = useToast();

  // Query for existing collection data
  const { data: existingData, isLoading: isLoadingExisting } = useQuery<CollectionResult>({
    queryKey: ['/api/elevenlabs/last-collection', agentId],
    enabled: false, // Don't auto-fetch
  });

  // Mutation for collecting agent data
  const collectDataMutation = useMutation({
    mutationFn: async (targetAgentId: string): Promise<CollectionResult> => {
      const response = await apiRequest('POST', `/api/elevenlabs/collect-agent-data`, {
        agentId: targetAgentId
      });
      return response.json();
    },
    onSuccess: (data: CollectionResult) => {
      toast({
        title: "Data Collection Complete",
        description: `Successfully collected ${data.data.total_conversations} conversations from agent ${data.agent_id}`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/elevenlabs/last-collection'] });
      // Clear any previous import data when new collection happens
      setImportPreview(null);
      setImportResult(null);
    },
    onError: (error: any) => {
      toast({
        title: "Collection Failed",
        description: error.message || "Failed to collect ElevenLabs agent data",
        variant: "destructive",
      });
    }
  });

  // Mutation for previewing import matches
  const previewImportMutation = useMutation({
    mutationFn: async (): Promise<ImportPreview> => {
      if (!collectedData) {
        throw new Error("No conversation data available for import");
      }
      const response = await apiRequest('POST', `/api/elevenlabs/import-conversations`, {
        conversations: collectedData.data.conversations,
        agentId: collectedData.agent_id,
        confirmImport: false // Preview only
      });
      return response.json();
    },
    onSuccess: (data: ImportPreview) => {
      setImportPreview(data);
      setShowImportDialog(true);
      toast({
        title: "Import Preview Ready",
        description: `Found ${data.matched_count} potential matches out of ${data.total_conversations} conversations`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Preview Failed",
        description: error.message || "Failed to preview conversation imports",
        variant: "destructive",
      });
    }
  });

  // Mutation for actual import
  const confirmImportMutation = useMutation({
    mutationFn: async (): Promise<ImportResult> => {
      if (!collectedData) {
        throw new Error("No conversation data available for import");
      }
      const response = await apiRequest('POST', `/api/elevenlabs/import-conversations`, {
        conversations: collectedData.data.conversations,
        agentId: collectedData.agent_id,
        confirmImport: true // Actual import
      });
      return response.json();
    },
    onSuccess: (data: ImportResult) => {
      setImportResult(data);
      setShowImportDialog(false);
      toast({
        title: "Import Complete",
        description: `Successfully updated ${data.results.updated} candidate records`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/candidates'] });
    },
    onError: (error: any) => {
      toast({
        title: "Import Failed",
        description: error.message || "Failed to import conversations",
        variant: "destructive",
      });
    }
  });

  const handleCollectData = () => {
    if (!agentId.trim()) {
      toast({
        title: "Invalid Agent ID",
        description: "Please enter a valid ElevenLabs agent ID",
        variant: "destructive",
      });
      return;
    }
    collectDataMutation.mutate(agentId);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Not Available';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Invalid Date';
    }
  };

  const formatDuration = (startTime: string, endTime?: string) => {
    if (!startTime) return 'Unknown Duration';
    if (!endTime) return 'In Progress';
    try {
      const start = new Date(startTime);
      const end = new Date(endTime);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return 'Invalid Duration';
      const durationMs = end.getTime() - start.getTime();
      if (durationMs < 0) return 'Invalid Duration';
      const hours = Math.floor(durationMs / 3600000);
      const minutes = Math.floor((durationMs % 3600000) / 60000);
      const seconds = Math.floor((durationMs % 60000) / 1000);
      
      const parts = [];
      if (hours > 0) parts.push(`${hours}h`);
      if (minutes > 0) parts.push(`${minutes}m`);
      if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
      
      return parts.join(' ');
    } catch (error) {
      return 'Invalid Duration';
    }
  };

  const getConversationStatus = (conversation: ConversationData) => {
    if (conversation.details_error || conversation.audio_error) return "error";
    if (!conversation.ended_at) return "active";
    return "completed";
  };

  // Extract meaningful conversation title from transcript or metadata
  const getConversationTitle = (conversation: ConversationData) => {
    // Try to extract a meaningful title from the conversation
    if (conversation.details?.transcript && Array.isArray(conversation.details.transcript)) {
      const firstMessage = conversation.details.transcript.find((msg: any) => 
        msg.role === 'user' && msg.content && typeof msg.content === 'string' && msg.content.length > 10
      );
      if (firstMessage) {
        const title = firstMessage.content.substring(0, 50).replace(/\n/g, ' ').trim();
        return title + (firstMessage.content.length > 50 ? '...' : '');
      }
    }
    
    // Try to get a title from metadata
    if (conversation.metadata?.title) {
      return conversation.metadata.title;
    }
    
    // Fallback to a descriptive title based on timing
    const date = new Date(conversation.created_at);
    if (!isNaN(date.getTime())) {
      return `Interview ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    // Final fallback
    return `Conversation ${conversation.conversation_id.slice(0, 8)}`;
  };

  // Get detailed audio status
  const getAudioStatus = (conversation: ConversationData) => {
    if (!conversation.audio_info) return null;
    
    if (conversation.audio_info.has_audio) {
      const sizeKB = conversation.audio_info.audio_size_bytes 
        ? Math.round(conversation.audio_info.audio_size_bytes / 1024) 
        : 0;
      return {
        status: 'available',
        text: sizeKB > 0 ? `Audio (${sizeKB}KB)` : 'Audio Available',
        icon: Headphones,
        color: 'text-purple-500'
      };
    } else {
      return {
        status: 'unavailable',
        text: 'No Audio',
        icon: Headphones,
        color: 'text-muted-foreground'
      };
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
      case "active":
        return <Badge variant="default" className="bg-blue-500"><Clock className="w-3 h-3 mr-1" />Active</Badge>;
      case "error":
        return <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" />Error</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const collectedData = collectDataMutation.data || existingData;
  const isLoading = collectDataMutation.isPending || isLoadingExisting;

  return (
    <div className="space-y-6">
      {/* Collection Control Panel */}
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Headphones className="w-5 h-5" />
            <span>ElevenLabs Agent Data Collection</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex space-x-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Agent ID</label>
              <Input
                placeholder="Enter ElevenLabs Agent ID"
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
                className="glass-input"
                data-testid="agent-id-input"
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={handleCollectData}
                disabled={isLoading || !agentId.trim()}
                className="bg-primary hover:bg-primary/90"
                data-testid="collect-data-button"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Collecting...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Collect Data
                  </>
                )}
              </Button>
            </div>
          </div>

          {isLoading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Collecting agent data...</span>
                <span>Please wait</span>
              </div>
              <Progress value={undefined} className="h-2" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results Display */}
      {collectedData && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="glass-panel">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <MessageSquare className="w-8 h-8 text-blue-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Total Conversations</p>
                    <p className="text-2xl font-bold" data-testid="total-conversations">
                      {collectedData.data.total_conversations}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-panel">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-8 h-8 text-green-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Completed</p>
                    <p className="text-2xl font-bold" data-testid="completed-conversations">
                      {collectedData.data.conversations.filter(c => c.ended_at).length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-panel">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <Headphones className="w-8 h-8 text-purple-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">With Audio</p>
                    <p className="text-2xl font-bold" data-testid="audio-conversations">
                      {collectedData.data.conversations.filter(c => c.audio_info?.has_audio).length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-panel">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <AlertTriangle className="w-8 h-8 text-orange-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Errors</p>
                    <p className="text-2xl font-bold" data-testid="error-count">
                      {collectedData.data.error_details?.length || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Agent Information */}
          {collectedData.data.agent && (
            <Card className="glass-panel">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <User className="w-5 h-5" />
                  <span>Agent Information</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Agent ID:</span>
                    <span className="ml-2 font-mono text-muted-foreground">{collectedData.agent_id}</span>
                  </div>
                  <div>
                    <span className="font-medium">Collection Time:</span>
                    <span className="ml-2 text-muted-foreground">{formatDate(collectedData.timestamp)}</span>
                  </div>
                  {collectedData.data.agent.name && (
                    <div>
                      <span className="font-medium">Name:</span>
                      <span className="ml-2 text-muted-foreground">{collectedData.data.agent.name}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Error Summary */}
          {collectedData.data.error_details && collectedData.data.error_details.length > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {collectedData.data.error_details.length} error(s) occurred during data collection:
                <ul className="mt-2 list-disc pl-4">
                  {collectedData.data.error_details.slice(0, 3).map((error, index) => (
                    <li key={index} className="text-sm">{error}</li>
                  ))}
                  {collectedData.data.error_details.length > 3 && (
                    <li className="text-sm text-muted-foreground">
                      ... and {collectedData.data.error_details.length - 3} more
                    </li>
                  )}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Import Action Panel */}
          <Card className="glass-panel">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Upload className="w-5 h-5" />
                  <span>Import to Candidates</span>
                </div>
                <Button
                  onClick={() => previewImportMutation.mutate()}
                  disabled={previewImportMutation.isPending || !collectedData}
                  className="bg-green-600 hover:bg-green-700"
                  data-testid="preview-import-button"
                >
                  {previewImportMutation.isPending ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Eye className="w-4 h-4 mr-2" />
                      Preview Import
                    </>
                  )}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Match conversations to existing candidates and update their records with transcripts and audio data.
              </p>
              {importResult && (
                <Alert className="mb-4">
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-1">
                      <div>Import completed successfully!</div>
                      <div className="text-sm">
                        Updated: {importResult.results.updated}, 
                        Failed: {importResult.results.failed}, 
                        Skipped: {importResult.results.skipped}
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Conversations List */}
          <Card className="glass-panel">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <MessageSquare className="w-5 h-5" />
                <span>Conversations ({collectedData.data.conversations.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="list" className="space-y-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="list">List View</TabsTrigger>
                  <TabsTrigger value="details">Detailed View</TabsTrigger>
                </TabsList>

                <TabsContent value="list" className="space-y-4">
                  <ScrollArea className="h-96">
                    <div className="space-y-3">
                      {collectedData.data.conversations.map((conversation) => (
                        <Card
                          key={conversation.conversation_id}
                          className={`cursor-pointer transition-colors ${
                            selectedConversation?.conversation_id === conversation.conversation_id
                              ? 'ring-2 ring-primary'
                              : 'hover:bg-muted/50'
                          }`}
                          onClick={() => setSelectedConversation(conversation)}
                          data-testid={`conversation-${conversation.conversation_id}`}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="space-y-1 flex-1">
                                <div className="flex items-center space-x-2">
                                  <span className="font-medium text-sm text-foreground line-clamp-1">
                                    {getConversationTitle(conversation)}
                                  </span>
                                  {getStatusBadge(getConversationStatus(conversation))}
                                </div>
                                <div className="flex items-center space-x-4 text-sm text-muted-foreground flex-wrap">
                                  <span className="flex items-center">
                                    <Calendar className="w-3 h-3 mr-1 flex-shrink-0" />
                                    {formatDate(conversation.created_at)}
                                  </span>
                                  <span className="flex items-center">
                                    <Clock className="w-3 h-3 mr-1 flex-shrink-0" />
                                    {formatDuration(conversation.created_at, conversation.ended_at)}
                                  </span>
                                  {(() => {
                                    const audioStatus = getAudioStatus(conversation);
                                    if (audioStatus) {
                                      const IconComponent = audioStatus.icon;
                                      return (
                                        <span className={`flex items-center ${audioStatus.color}`}>
                                          <IconComponent className="w-3 h-3 mr-1 flex-shrink-0" />
                                          {audioStatus.text}
                                        </span>
                                      );
                                    }
                                    return null;
                                  })()}
                                </div>
                                <div className="text-xs text-muted-foreground font-mono">
                                  ID: {conversation.conversation_id.slice(0, 12)}...
                                </div>
                              </div>
                              <div className="flex flex-col space-y-1">
                                <Button variant="ghost" size="sm" className="text-xs">
                                  <Eye className="w-3 h-3 mr-1" />
                                  View Transcript
                                </Button>
                                {conversation.audio_info?.has_audio && conversation.audio_info.audio_url && (
                                  <Button variant="ghost" size="sm" className="text-xs" asChild>
                                    <a href={conversation.audio_info.audio_url} target="_blank" rel="noopener noreferrer">
                                      <Play className="w-3 h-3 mr-1" />
                                      Play Audio
                                    </a>
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="details">
                  {selectedConversation ? (
                    <Card className="glass-panel">
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <span>Conversation Details</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedConversation(null)}
                          >
                            Close
                          </Button>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="font-medium">Conversation ID:</span>
                            <span className="ml-2 font-mono">{selectedConversation.conversation_id}</span>
                          </div>
                          <div>
                            <span className="font-medium">Status:</span>
                            <span className="ml-2">{getStatusBadge(getConversationStatus(selectedConversation))}</span>
                          </div>
                          <div>
                            <span className="font-medium">Started:</span>
                            <span className="ml-2">{formatDate(selectedConversation.created_at)}</span>
                          </div>
                          {selectedConversation.ended_at && (
                            <div>
                              <span className="font-medium">Ended:</span>
                              <span className="ml-2">{formatDate(selectedConversation.ended_at)}</span>
                            </div>
                          )}
                        </div>

                        <Separator />

                        {selectedConversation.audio_info && (
                          <div className="space-y-2">
                            <h4 className="font-medium flex items-center">
                              <Headphones className="w-4 h-4 mr-2" />
                              Audio Information
                            </h4>
                            <div className="bg-muted/50 p-3 rounded-lg text-sm">
                              <div>Has Audio: {selectedConversation.audio_info.has_audio ? "Yes" : "No"}</div>
                              {selectedConversation.audio_info.content_type && (
                                <div>Content Type: {selectedConversation.audio_info.content_type}</div>
                              )}
                              {selectedConversation.audio_info.audio_size_bytes && (
                                <div>Size: {Math.round(selectedConversation.audio_info.audio_size_bytes / 1024)} KB</div>
                              )}
                              {selectedConversation.audio_info.audio_url && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="mt-2"
                                  onClick={() => window.open(selectedConversation.audio_info?.audio_url, '_blank')}
                                >
                                  <Play className="w-3 h-3 mr-1" />
                                  Play Audio
                                </Button>
                              )}
                            </div>
                          </div>
                        )}

                        {selectedConversation.details && selectedConversation.details.transcript && (
                          <div className="space-y-2">
                            <h4 className="font-medium flex items-center">
                              <FileText className="w-4 h-4 mr-2" />
                              Conversation Transcript
                            </h4>
                            <div className="bg-muted/50 p-4 rounded-lg text-sm max-h-60 overflow-y-auto">
                              <div className="space-y-3">
                                {Array.isArray(selectedConversation.details.transcript) ? (
                                  selectedConversation.details.transcript.map((message: any, index: number) => (
                                    <div key={index} className="border-l-2 border-primary/20 pl-3">
                                      <div className="flex items-center space-x-2 mb-1">
                                        <Badge variant={message.role === 'user' ? 'default' : 'secondary'} className="text-xs">
                                          {message.role === 'user' ? 'Candidate' : 'Agent'}
                                        </Badge>
                                        {message.timestamp && (
                                          <span className="text-xs text-muted-foreground">
                                            {new Date(message.timestamp).toLocaleTimeString()}
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                                        {typeof message.content === 'string' ? message.content : JSON.stringify(message.content)}
                                      </p>
                                    </div>
                                  ))
                                ) : (
                                  <div className="text-sm text-muted-foreground">
                                    <p>Transcript data format: {typeof selectedConversation.details.transcript}</p>
                                    <div className="mt-2 p-2 bg-muted rounded border">
                                      <pre className="whitespace-pre-wrap text-xs">
                                        {typeof selectedConversation.details.transcript === 'string' 
                                          ? selectedConversation.details.transcript 
                                          : JSON.stringify(selectedConversation.details.transcript, null, 2)
                                        }
                                      </pre>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {(selectedConversation.details_error || selectedConversation.audio_error) && (
                          <Alert variant="destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription>
                              <div>Errors encountered:</div>
                              {selectedConversation.details_error && (
                                <div>Details: {selectedConversation.details_error}</div>
                              )}
                              {selectedConversation.audio_error && (
                                <div>Audio: {selectedConversation.audio_error}</div>
                              )}
                            </AlertDescription>
                          </Alert>
                        )}
                      </CardContent>
                    </Card>
                  ) : (
                    <Card className="glass-panel">
                      <CardContent className="p-8 text-center text-muted-foreground">
                        <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>Select a conversation from the list view to see detailed information</p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Import Preview/Confirmation Dialog */}
          <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center space-x-2">
                  <UserCheck className="w-5 h-5" />
                  <span>Import Preview - Candidate Matches</span>
                </DialogTitle>
                <DialogDescription>
                  Review the conversations that can be matched to existing candidates before importing.
                </DialogDescription>
              </DialogHeader>
              
              {importPreview && (
                <div className="space-y-6">
                  {/* Summary Stats */}
                  <div className="grid grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">{importPreview.total_conversations}</div>
                      <div className="text-sm text-muted-foreground">Total</div>
                    </div>
                    <div className="text-center p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">{importPreview.matched_count}</div>
                      <div className="text-sm text-muted-foreground">Matched</div>
                    </div>
                    <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                      <div className="text-2xl font-bold text-yellow-600">{importPreview.unmatched_count}</div>
                      <div className="text-sm text-muted-foreground">Unmatched</div>
                    </div>
                    <div className="text-center p-4 bg-red-50 dark:bg-red-950 rounded-lg">
                      <div className="text-2xl font-bold text-red-600">{importPreview.error_count}</div>
                      <div className="text-sm text-muted-foreground">Errors</div>
                    </div>
                  </div>

                  {/* Matches List */}
                  {importPreview.matches.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-medium flex items-center">
                        <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                        Matched Conversations ({importPreview.matches.length})
                      </h4>
                      <ScrollArea className="h-60 border rounded-lg">
                        <div className="space-y-2 p-4">
                          {importPreview.matches.map((match) => (
                            <Card key={match.conversation_id} className="p-3">
                              <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                  <div className="flex items-center space-x-2">
                                    <span className="font-medium text-sm">
                                      Conversation from {new Date(match.conversation_id.includes('_') ? 
                                        match.conversation_id.split('_')[1] : Date.now()).toLocaleDateString()}
                                    </span>
                                    <Badge variant="default" className="text-xs">
                                      {match.match_type}
                                    </Badge>
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    Candidate: {match.candidate_name}
                                  </div>
                                  <div className="flex items-center text-xs text-muted-foreground">
                                    <Mail className="w-3 h-3 mr-1" />
                                    {match.candidate_email}
                                  </div>
                                </div>
                                <div className="text-right text-xs text-muted-foreground">
                                  {match.extracted_info.emails && (
                                    <div>Found: {match.extracted_info.emails.join(', ')}</div>
                                  )}
                                </div>
                              </div>
                            </Card>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}

                  {/* Errors */}
                  {importPreview.errors.length > 0 && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <div>Errors occurred during analysis:</div>
                        <ul className="mt-2 list-disc pl-4">
                          {importPreview.errors.slice(0, 3).map((error, index) => (
                            <li key={index} className="text-sm">{error.error}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}

              <DialogFooter className="space-x-2">
                <Button variant="outline" onClick={() => setShowImportDialog(false)}>
                  Cancel
                </Button>
                {importPreview && importPreview.matched_count > 0 && (
                  <Button 
                    onClick={() => confirmImportMutation.mutate()}
                    disabled={confirmImportMutation.isPending}
                    className="bg-green-600 hover:bg-green-700"
                    data-testid="confirm-import-button"
                  >
                    {confirmImportMutation.isPending ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Import {importPreview.matched_count} Matches
                      </>
                    )}
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </motion.div>
      )}
    </div>
  );
}
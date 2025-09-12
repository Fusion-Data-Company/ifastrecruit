import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, 
  Phone, 
  Mail, 
  Star, 
  Calendar, 
  Clock, 
  Headphones, 
  FileText, 
  BarChart3, 
  MessageSquare,
  Play,
  Download,
  Award,
  Target,
  TrendingUp,
  Brain,
  CheckCircle,
  XCircle,
  Info,
  Copy,
  Database,
  DollarSign,
  Activity,
  Cpu,
  GitBranch,
  Hash,
  Server,
  Shield,
  Timer,
  Wifi,
  Zap,
  Globe,
  Link,
  AlertCircle,
  Sparkles,
  ChevronRight,
  Layers,
  Settings,
  Bot,
  Mic,
  Volume2,
  Code,
  Terminal,
  Gauge,
  CreditCard,
  Trash2,
  UserCheck,
  Key,
  Navigation,
  Package
} from 'lucide-react';
import { AudioPlayer } from '@/components/AudioPlayer';
import { EnhancedTranscript } from '@/components/EnhancedTranscript';
import type { Candidate } from '@shared/schema';

interface CandidateModalProps {
  candidate: Candidate | null;
  isOpen: boolean;
  onClose: () => void;
}

// Enhanced InfoSection with glassmorphic styling
function InfoSection({ title, icon: Icon, children, className = "" }: { 
  title: string; 
  icon: React.ComponentType<any>; 
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={`h-fit bg-gradient-to-br from-slate-900/40 to-slate-800/40 backdrop-blur-sm border-cyan-500/20 hover:border-cyan-400/30 transition-all duration-300 ${className}`}>
      <CardHeader className="pb-3 border-b border-cyan-500/10">
        <CardTitle className="flex items-center space-x-2 text-sm">
          <div className="p-1.5 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-lg">
            <Icon className="w-4 h-4 text-cyan-400" />
          </div>
          <span className="bg-gradient-to-r from-white to-cyan-100 bg-clip-text text-transparent font-serif">
            {title}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 mt-3">
        {children}
      </CardContent>
    </Card>
  );
}

// Enhanced DataPoint with copy functionality
function DataPoint({ 
  label, 
  value, 
  icon: Icon, 
  copyable = false,
  onCopy 
}: { 
  label: string; 
  value: string | number | null | undefined; 
  icon?: React.ComponentType<any>;
  copyable?: boolean;
  onCopy?: (text: string, field: string) => void;
}) {
  if (!value && value !== 0) return null;
  
  const stringValue = String(value);
  
  return (
    <div className="flex items-center justify-between group hover:bg-cyan-500/5 rounded px-2 py-1 transition-colors">
      <span className="text-sm text-cyan-200/70 flex items-center">
        {Icon && <Icon className="w-3 h-3 mr-1.5 text-cyan-400/60" />}
        {label}
      </span>
      <div className="flex items-center space-x-2">
        <span className="text-sm font-medium text-white/90">{stringValue}</span>
        {copyable && onCopy && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => onCopy(stringValue, label)}
                  data-testid={`copy-${label.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Copy {label}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
}

// Enhanced ScoreDisplay with gradient bars
function ScoreDisplay({ label, score, maxScore = 100 }: { 
  label: string; 
  score: number | null | undefined; 
  maxScore?: number; 
}) {
  if (!score && score !== 0) return null;
  
  const percentage = (score / maxScore) * 100;
  const getScoreGradient = (pct: number) => {
    if (pct >= 80) return "from-emerald-500 to-green-400";
    if (pct >= 60) return "from-yellow-500 to-amber-400";
    return "from-red-500 to-orange-400";
  };
  
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-cyan-200/70">{label}</span>
        <span className="font-medium text-white">{score}/{maxScore}</span>
      </div>
      <div className="w-full bg-slate-800/50 rounded-full h-2.5 backdrop-blur-sm">
        <div 
          className={`h-2.5 rounded-full transition-all duration-500 bg-gradient-to-r ${getScoreGradient(percentage)} shadow-lg`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

// Enhanced JsonDataDisplay with better formatting
function JsonDataDisplay({ data, title }: { data: any; title: string }) {
  if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
    return (
      <div className="text-center py-8 text-cyan-200/50">
        <Info className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>No {title.toLowerCase()} data available</p>
      </div>
    );
  }

  // If it's a simple object with key-value pairs, display them nicely
  if (typeof data === 'object' && !Array.isArray(data)) {
    return (
      <div className="space-y-2">
        {Object.entries(data).map(([key, value]) => (
          <DataPoint 
            key={key}
            label={key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim()}
            value={String(value || '-')}
          />
        ))}
      </div>
    );
  }

  // For arrays or complex objects, show formatted JSON
  return (
    <ScrollArea className="h-64 rounded-lg bg-slate-900/50 backdrop-blur-sm">
      <pre className="text-xs text-cyan-100/80 p-3 overflow-x-auto">
        {JSON.stringify(data, null, 2)}
      </pre>
    </ScrollArea>
  );
}

export default function CandidateModal({ candidate, isOpen, onClose }: CandidateModalProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!candidate) return null;

  const copyToClipboard = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return 'Not available';
    try {
      const d = new Date(date);
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Invalid date';
    }
  };

  const formatUnixTime = (unixTime: number | null) => {
    if (!unixTime) return 'Not available';
    return formatDate(new Date(unixTime * 1000));
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'Not available';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'NEW': return 'bg-gradient-to-r from-blue-600 to-blue-400';
      case 'FIRST_INTERVIEW': return 'bg-gradient-to-r from-yellow-600 to-yellow-400';
      case 'TECHNICAL_SCREEN': return 'bg-gradient-to-r from-orange-600 to-orange-400';
      case 'FINAL_INTERVIEW': return 'bg-gradient-to-r from-purple-600 to-purple-400';
      case 'OFFER': return 'bg-gradient-to-r from-green-600 to-green-400';
      case 'HIRED': return 'bg-gradient-to-r from-emerald-600 to-emerald-400';
      case 'REJECTED': return 'bg-gradient-to-r from-red-600 to-red-400';
      default: return 'bg-gradient-to-r from-gray-600 to-gray-400';
    }
  };

  return (
    <TooltipProvider>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-7xl max-h-[95vh] overflow-hidden bg-gradient-to-br from-slate-900/95 via-blue-950/95 to-teal-950/95 backdrop-blur-xl border-cyan-500/20">
          <DialogHeader className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 via-cyan-600/10 to-teal-600/10 rounded-lg blur-xl" />
            <DialogTitle className="flex items-center space-x-3 text-xl font-serif relative z-10">
              <div className="p-2 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-lg">
                <User className="w-6 h-6 text-cyan-400" />
              </div>
              <span className="bg-gradient-to-r from-white to-cyan-100 bg-clip-text text-transparent">
                {candidate.name || 'Unknown Candidate'}
              </span>
              <Badge className={`${getStageColor(candidate.pipelineStage)} text-white px-3 py-1 shadow-lg`}>
                {candidate.pipelineStage?.replace('_', ' ')}
              </Badge>
              {candidate.elevenLabsUserId && (
                <Badge className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-3 py-1 shadow-lg">
                  <Bot className="w-3 h-3 mr-1" />
                  ElevenLabs Verified
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription className="text-cyan-200/70">
              <Sparkles className="inline w-4 h-4 mr-1 text-yellow-400" />
              Complete candidate profile with advanced AI interview analysis and performance metrics
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full mt-6">
            <TabsList className="grid w-full grid-cols-7 bg-gradient-to-r from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-cyan-500/20">
              <TabsTrigger value="overview" className="flex items-center space-x-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-600 data-[state=active]:to-blue-600">
                <User className="w-4 h-4" />
                <span>Overview</span>
              </TabsTrigger>
              <TabsTrigger value="interview" className="flex items-center space-x-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-600 data-[state=active]:to-blue-600">
                <MessageSquare className="w-4 h-4" />
                <span>Interview</span>
              </TabsTrigger>
              <TabsTrigger value="technical" className="flex items-center space-x-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-600 data-[state=active]:to-blue-600">
                <Cpu className="w-4 h-4" />
                <span>Technical</span>
              </TabsTrigger>
              <TabsTrigger value="transcript" className="flex items-center space-x-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-600 data-[state=active]:to-blue-600">
                <FileText className="w-4 h-4" />
                <span>Transcript</span>
              </TabsTrigger>
              <TabsTrigger value="evaluation" className="flex items-center space-x-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-600 data-[state=active]:to-blue-600">
                <BarChart3 className="w-4 h-4" />
                <span>Evaluation</span>
              </TabsTrigger>
              <TabsTrigger value="metadata" className="flex items-center space-x-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-600 data-[state=active]:to-blue-600">
                <Database className="w-4 h-4" />
                <span>Metadata</span>
              </TabsTrigger>
              <TabsTrigger value="audio" className="flex items-center space-x-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-600 data-[state=active]:to-blue-600">
                <Headphones className="w-4 h-4" />
                <span>Audio</span>
              </TabsTrigger>
            </TabsList>

            <div className="mt-4 h-[calc(95vh-220px)]">
              <ScrollArea className="h-full">
                {/* Overview Tab */}
                <TabsContent value="overview" className="space-y-6 mt-0">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                  >
                    {/* Contact Information */}
                    <InfoSection title="Contact Information" icon={User}>
                      <DataPoint label="Name" value={candidate.name} icon={User} />
                      <DataPoint label="Email" value={candidate.email} icon={Mail} copyable onCopy={copyToClipboard} />
                      <DataPoint label="Phone" value={candidate.phone} icon={Phone} copyable onCopy={copyToClipboard} />
                      <DataPoint label="Source" value={candidate.sourceRef} icon={Link} />
                      <DataPoint label="Campaign" value={candidate.campaignId} icon={Target} copyable onCopy={copyToClipboard} />
                    </InfoSection>

                    {/* Pipeline Status */}
                    <InfoSection title="Pipeline Status" icon={Target}>
                      <DataPoint label="Stage" value={candidate.pipelineStage?.replace('_', ' ')} icon={Activity} />
                      <DataPoint label="Overall Score" value={candidate.score ? `${candidate.score}/100` : undefined} icon={Star} />
                      <DataPoint label="Created" value={formatDate(candidate.createdAt)} icon={Calendar} />
                      <DataPoint label="Updated" value={formatDate(candidate.createdAt)} icon={Clock} />
                      {candidate.tags && candidate.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {candidate.tags.map((tag, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs border-cyan-500/30 text-cyan-300">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </InfoSection>

                    {/* Conversation Metadata */}
                    <InfoSection title="Conversation Details" icon={MessageSquare}>
                      <DataPoint label="Conversation ID" value={candidate.conversationId} icon={Hash} copyable onCopy={copyToClipboard} />
                      <DataPoint label="Agent ID" value={candidate.agentId} icon={Bot} copyable onCopy={copyToClipboard} />
                      <DataPoint label="Agent Name" value={candidate.agentName} icon={User} />
                      <DataPoint label="Status" value={candidate.conversationStatus || candidate.callStatus} icon={Activity} />
                      <DataPoint label="Interview Date" value={formatDate(candidate.interviewDate)} icon={Calendar} />
                      <DataPoint label="Duration" value={formatDuration(candidate.callDuration)} icon={Timer} />
                      <DataPoint label="Messages" value={candidate.messageCount} icon={MessageSquare} />
                    </InfoSection>

                    {/* Call Metrics */}
                    <InfoSection title="Call Metrics" icon={Activity}>
                      <DataPoint label="Start Time" value={formatUnixTime(candidate.startTimeUnixSecs)} icon={Clock} />
                      <DataPoint label="End Time" value={formatUnixTime(candidate.endTimeUnixSecs)} icon={Clock} />
                      <DataPoint label="Call Cost" value={candidate.cost ? `$${candidate.cost}` : undefined} icon={DollarSign} />
                      <DataPoint label="Successful" value={candidate.callSuccessful} icon={candidate.callSuccessful === 'true' ? CheckCircle : XCircle} />
                      <DataPoint label="Termination" value={candidate.terminationReason} icon={AlertCircle} />
                      <DataPoint label="Feedback Score" value={candidate.feedbackScore} icon={Star} />
                    </InfoSection>

                    {/* Audio Status */}
                    <InfoSection title="Audio Status" icon={Headphones}>
                      <DataPoint label="Has Audio" value={candidate.hasAudio ? 'Yes' : 'No'} icon={candidate.hasAudio ? CheckCircle : XCircle} />
                      <DataPoint label="User Audio" value={candidate.hasUserAudio ? 'Yes' : 'No'} icon={candidate.hasUserAudio ? Mic : XCircle} />
                      <DataPoint label="Agent Audio" value={candidate.hasResponseAudio ? 'Yes' : 'No'} icon={candidate.hasResponseAudio ? Volume2 : XCircle} />
                      <DataPoint label="Local Audio" value={candidate.localAudioFileId ? 'Stored' : 'Not stored'} icon={Database} />
                      <DataPoint label="Transcript Stored" value={candidate.localTranscriptFileId ? 'Yes' : 'No'} icon={FileText} />
                    </InfoSection>

                    {/* ElevenLabs Connection */}
                    <InfoSection title="ElevenLabs Integration" icon={Bot}>
                      <DataPoint label="User ID" value={candidate.elevenLabsUserId} icon={UserCheck} copyable onCopy={copyToClipboard} />
                      <DataPoint label="Channel ID" value={candidate.channelId} icon={Wifi} copyable onCopy={copyToClipboard} />
                      <DataPoint label="API Version" value={candidate.conversationApiVersion} icon={Code} />
                      <DataPoint label="Creation Method" value={candidate.creationMethod} icon={Settings} />
                      <DataPoint label="Auth Method" value={candidate.authorizationMethod} icon={Key} />
                      <DataPoint label="Source" value={candidate.source} icon={Globe} />
                      <DataPoint label="Client IP" value={candidate.clientIp} icon={Globe} copyable onCopy={copyToClipboard} />
                    </InfoSection>
                  </motion.div>

                  {/* Notes Section */}
                  {candidate.notes && (
                    <Card className="bg-gradient-to-br from-slate-900/40 to-slate-800/40 backdrop-blur-sm border-cyan-500/20">
                      <CardHeader className="border-b border-cyan-500/10">
                        <CardTitle className="flex items-center space-x-2 text-sm">
                          <FileText className="w-4 h-4 text-cyan-400" />
                          <span className="font-serif">Notes</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="mt-3">
                        <p className="text-sm leading-relaxed text-cyan-100/80">{candidate.notes}</p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                {/* Interview Tab */}
                <TabsContent value="interview" className="space-y-6 mt-0">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="grid grid-cols-1 md:grid-cols-2 gap-6"
                  >
                    {/* Core Interview Questions */}
                    <InfoSection title="Core Interview Responses" icon={MessageSquare} className="md:col-span-2">
                      <Accordion type="single" collapsible className="space-y-2">
                        {candidate.whyInsurance && (
                          <AccordionItem value="why-insurance" className="border-cyan-500/20">
                            <AccordionTrigger className="hover:text-cyan-300">Why Insurance?</AccordionTrigger>
                            <AccordionContent className="text-cyan-100/80 leading-relaxed">
                              {candidate.whyInsurance}
                            </AccordionContent>
                          </AccordionItem>
                        )}
                        {candidate.whyNow && (
                          <AccordionItem value="why-now" className="border-cyan-500/20">
                            <AccordionTrigger className="hover:text-cyan-300">Why Now?</AccordionTrigger>
                            <AccordionContent className="text-cyan-100/80 leading-relaxed">
                              {candidate.whyNow}
                            </AccordionContent>
                          </AccordionItem>
                        )}
                        {candidate.salesExperience && (
                          <AccordionItem value="sales-exp" className="border-cyan-500/20">
                            <AccordionTrigger className="hover:text-cyan-300">Sales Experience</AccordionTrigger>
                            <AccordionContent className="text-cyan-100/80 leading-relaxed">
                              {candidate.salesExperience}
                            </AccordionContent>
                          </AccordionItem>
                        )}
                        {candidate.difficultCustomerStory && (
                          <AccordionItem value="difficult-customer" className="border-cyan-500/20">
                            <AccordionTrigger className="hover:text-cyan-300">Difficult Customer Story</AccordionTrigger>
                            <AccordionContent className="text-cyan-100/80 leading-relaxed">
                              {candidate.difficultCustomerStory}
                            </AccordionContent>
                          </AccordionItem>
                        )}
                        {candidate.consultativeSelling && (
                          <AccordionItem value="consultative" className="border-cyan-500/20">
                            <AccordionTrigger className="hover:text-cyan-300">Consultative Selling</AccordionTrigger>
                            <AccordionContent className="text-cyan-100/80 leading-relaxed">
                              {candidate.consultativeSelling}
                            </AccordionContent>
                          </AccordionItem>
                        )}
                      </Accordion>
                    </InfoSection>

                    {/* Market & Timeline */}
                    <InfoSection title="Market Preferences & Timeline" icon={Target}>
                      <DataPoint label="Preferred Markets" value={
                        Array.isArray(candidate.preferredMarkets) 
                          ? candidate.preferredMarkets.join(', ')
                          : candidate.preferredMarkets
                      } icon={Globe} />
                      <DataPoint label="Timeline" value={candidate.timeline} icon={Calendar} />
                      <DataPoint label="Next Steps" value={candidate.recommendedNextSteps} icon={ChevronRight} />
                    </InfoSection>

                    {/* Performance Indicators */}
                    <InfoSection title="Performance Indicators" icon={CheckCircle}>
                      <DataPoint label="Demo Call Performed" value={candidate.demoCallPerformed ? 'Yes' : 'No'} icon={candidate.demoCallPerformed ? CheckCircle : XCircle} />
                      <DataPoint label="Kevin Persona Used" value={candidate.kevinPersonaUsed ? 'Yes' : 'No'} icon={candidate.kevinPersonaUsed ? CheckCircle : XCircle} />
                      <DataPoint label="Coaching Given" value={candidate.coachingGiven ? 'Yes' : 'No'} icon={candidate.coachingGiven ? CheckCircle : XCircle} />
                      <DataPoint label="Pitch Delivered" value={candidate.pitchDelivered ? 'Yes' : 'No'} icon={candidate.pitchDelivered ? CheckCircle : XCircle} />
                    </InfoSection>

                    {/* Interview Summary */}
                    {(candidate.interviewSummary || candidate.transcriptSummary || candidate.callSummaryTitle) && (
                      <InfoSection title="Interview Summary" icon={FileText} className="md:col-span-2">
                        <div className="space-y-4">
                          {candidate.callSummaryTitle && (
                            <div>
                              <label className="text-sm font-medium text-cyan-300 mb-1 block">Call Title</label>
                              <p className="text-sm text-cyan-100/80">{candidate.callSummaryTitle}</p>
                            </div>
                          )}
                          {candidate.interviewSummary && (
                            <div>
                              <label className="text-sm font-medium text-cyan-300 mb-1 block">Interview Summary</label>
                              <p className="text-sm text-cyan-100/80 leading-relaxed">{candidate.interviewSummary}</p>
                            </div>
                          )}
                          {candidate.transcriptSummary && (
                            <div>
                              <label className="text-sm font-medium text-cyan-300 mb-1 block">Transcript Summary</label>
                              <p className="text-sm text-cyan-100/80 leading-relaxed">{candidate.transcriptSummary}</p>
                            </div>
                          )}
                        </div>
                      </InfoSection>
                    )}
                  </motion.div>
                </TabsContent>

                {/* Technical Tab */}
                <TabsContent value="technical" className="space-y-6 mt-0">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="grid grid-cols-1 md:grid-cols-2 gap-6"
                  >
                    {/* Tool Calls */}
                    <InfoSection title="Tool Calls" icon={Terminal}>
                      <JsonDataDisplay data={candidate.toolCalls} title="Tool Calls" />
                    </InfoSection>

                    {/* Tool Results */}
                    <InfoSection title="Tool Results" icon={Package}>
                      <JsonDataDisplay data={candidate.toolResults} title="Tool Results" />
                    </InfoSection>

                    {/* Dynamic Variables */}
                    <InfoSection title="Dynamic Variables" icon={Code}>
                      <JsonDataDisplay data={candidate.dynamicVariables} title="Dynamic Variables" />
                    </InfoSection>

                    {/* Conversation Metrics */}
                    <InfoSection title="Turn Metrics" icon={Gauge}>
                      <JsonDataDisplay data={candidate.conversationTurnMetrics} title="Turn Metrics" />
                    </InfoSection>

                    {/* Message Timings */}
                    <InfoSection title="Message Timings" icon={Timer}>
                      <JsonDataDisplay data={candidate.messageTimings} title="Message Timings" />
                    </InfoSection>

                    {/* Custom LLM Data */}
                    <InfoSection title="Custom LLM Data" icon={Brain}>
                      <JsonDataDisplay data={candidate.customLlmData} title="LLM Data" />
                    </InfoSection>

                    {/* Custom Analysis */}
                    <InfoSection title="Custom Analysis" icon={Cpu}>
                      <JsonDataDisplay data={candidate.customAnalysisData} title="Analysis Data" />
                    </InfoSection>

                    {/* Charging Information */}
                    <InfoSection title="Billing Information" icon={CreditCard}>
                      <JsonDataDisplay data={candidate.charging} title="Charging" />
                      <DataPoint label="Charging Timer" value={candidate.hasChargingTimerTriggered ? 'Triggered' : 'Not triggered'} icon={Timer} />
                      <DataPoint label="Billing Timer" value={candidate.hasBillingTimerTriggered ? 'Triggered' : 'Not triggered'} icon={Timer} />
                    </InfoSection>

                    {/* Deletion Settings */}
                    {candidate.deletionSettings && (
                      <InfoSection title="Data Retention" icon={Trash2}>
                        <JsonDataDisplay data={candidate.deletionSettings} title="Deletion Settings" />
                      </InfoSection>
                    )}

                    {/* Client Initiation Data */}
                    {candidate.conversationInitiationClientData && (
                      <InfoSection title="Client Initiation" icon={Navigation} className="md:col-span-2">
                        <JsonDataDisplay data={candidate.conversationInitiationClientData} title="Initiation Data" />
                      </InfoSection>
                    )}
                  </motion.div>
                </TabsContent>

                {/* Transcript Tab */}
                <TabsContent value="transcript" className="space-y-6 mt-0">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                  >
                    {/* Main Transcript Card */}
                    <Card className="bg-gradient-to-br from-slate-900/40 to-slate-800/40 backdrop-blur-sm border-cyan-500/20">
                      <CardHeader className="border-b border-cyan-500/10">
                        <CardTitle className="flex items-center space-x-2">
                          <FileText className="w-5 h-5 text-cyan-400" />
                          <span className="font-serif">Interview Transcript</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="mt-4">
                        {candidate.interviewTranscript ? (
                          <EnhancedTranscript 
                            transcript={candidate.interviewTranscript}
                          />
                        ) : (
                          <div className="text-center py-8 text-cyan-200/50">
                            <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p>No transcript available</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Word-Level Transcript */}
                    {candidate.wordLevelTranscript && (
                      <Card className="bg-gradient-to-br from-slate-900/40 to-slate-800/40 backdrop-blur-sm border-cyan-500/20">
                        <CardHeader className="border-b border-cyan-500/10">
                          <CardTitle className="flex items-center space-x-2 text-base">
                            <Code className="w-4 h-4 text-cyan-400" />
                            <span className="font-serif">Word-Level Transcript Data</span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="mt-4">
                          <JsonDataDisplay data={candidate.wordLevelTranscript} title="Word-Level Data" />
                        </CardContent>
                      </Card>
                    )}

                    {/* Transcript Messages */}
                    {candidate.transcriptMessages && (
                      <Card className="bg-gradient-to-br from-slate-900/40 to-slate-800/40 backdrop-blur-sm border-cyan-500/20">
                        <CardHeader className="border-b border-cyan-500/10">
                          <CardTitle className="flex items-center space-x-2 text-base">
                            <MessageSquare className="w-4 h-4 text-cyan-400" />
                            <span className="font-serif">Structured Messages</span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="mt-4">
                          <JsonDataDisplay data={candidate.transcriptMessages} title="Messages" />
                        </CardContent>
                      </Card>
                    )}

                    {/* Transcript file actions */}
                    {candidate.localTranscriptFileId && (
                      <Card className="bg-gradient-to-br from-slate-900/40 to-slate-800/40 backdrop-blur-sm border-cyan-500/20">
                        <CardHeader className="border-b border-cyan-500/10">
                          <CardTitle className="flex items-center space-x-2 text-base">
                            <Download className="w-4 h-4 text-cyan-400" />
                            <span className="font-serif">Transcript File</span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="mt-4">
                          <div className="flex space-x-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="border-cyan-500/30 hover:bg-cyan-500/10"
                              onClick={() => window.open(`/api/files/transcript/${candidate.localTranscriptFileId}`, '_blank')}
                              data-testid="view-transcript-button"
                            >
                              <FileText className="w-4 h-4 mr-2" />
                              View Transcript
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="border-cyan-500/30 hover:bg-cyan-500/10"
                              onClick={() => window.open(`/api/files/transcript/${candidate.localTranscriptFileId}/download`, '_blank')}
                              data-testid="download-transcript-button"
                            >
                              <Download className="w-4 h-4 mr-2" />
                              Download Transcript
                            </Button>
                          </div>
                          <p className="text-xs text-cyan-200/50 mt-2">
                            Stored transcript file available for download and external viewing
                          </p>
                        </CardContent>
                      </Card>
                    )}
                  </motion.div>
                </TabsContent>

                {/* Evaluation Tab */}
                <TabsContent value="evaluation" className="space-y-6 mt-0">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="grid grid-cols-1 md:grid-cols-2 gap-6"
                  >
                    {/* Performance Scores */}
                    <InfoSection title="Performance Scores" icon={BarChart3}>
                      <ScoreDisplay label="Overall Score" score={candidate.overallScore} />
                      <ScoreDisplay label="Communication" score={candidate.communicationScore} />
                      <ScoreDisplay label="Sales Aptitude" score={candidate.salesAptitudeScore} />
                      <ScoreDisplay label="Motivation" score={candidate.motivationScore} />
                      <ScoreDisplay label="Coachability" score={candidate.coachabilityScore} />
                      <ScoreDisplay label="Professional Presence" score={candidate.professionalPresenceScore} />
                    </InfoSection>

                    {/* Development Assessment */}
                    <InfoSection title="Development Assessment" icon={TrendingUp}>
                      {candidate.strengths && Array.isArray(candidate.strengths) && candidate.strengths.length > 0 && (
                        <div>
                          <label className="text-sm font-medium text-emerald-400 mb-2 block">Strengths</label>
                          <div className="space-y-1">
                            {candidate.strengths.map((strength, index) => (
                              <div key={index} className="flex items-start space-x-2">
                                <CheckCircle className="w-3 h-3 text-emerald-400 mt-0.5" />
                                <span className="text-sm text-cyan-100/80">{strength}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {candidate.developmentAreas && Array.isArray(candidate.developmentAreas) && candidate.developmentAreas.length > 0 && (
                        <div>
                          <label className="text-sm font-medium text-amber-400 mb-2 block">Development Areas</label>
                          <div className="space-y-1">
                            {candidate.developmentAreas.map((area, index) => (
                              <div key={index} className="flex items-start space-x-2">
                                <Target className="w-3 h-3 text-amber-400 mt-0.5" />
                                <span className="text-sm text-cyan-100/80">{area}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </InfoSection>

                    {/* Evaluation Criteria */}
                    <InfoSection title="Evaluation Criteria" icon={Award}>
                      <JsonDataDisplay data={candidate.evaluationCriteria} title="Evaluation Criteria" />
                    </InfoSection>

                    {/* Evaluation Details */}
                    <InfoSection title="Evaluation Details" icon={Layers}>
                      <JsonDataDisplay data={candidate.evaluationDetails} title="Evaluation Details" />
                    </InfoSection>

                    {/* Data Collection Results */}
                    <InfoSection title="Data Collection Results" icon={Database} className="md:col-span-2">
                      <JsonDataDisplay data={candidate.dataCollectionResults} title="Data Collection Results" />
                    </InfoSection>

                    {/* Interview Metrics */}
                    <InfoSection title="Interview Metrics" icon={Gauge} className="md:col-span-2">
                      <JsonDataDisplay data={candidate.interviewMetrics} title="Interview Metrics" />
                    </InfoSection>
                  </motion.div>
                </TabsContent>

                {/* Metadata Tab */}
                <TabsContent value="metadata" className="space-y-6 mt-0">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="grid grid-cols-1 md:grid-cols-2 gap-6"
                  >
                    {/* Interview Data */}
                    <InfoSection title="Interview Data" icon={Database} className="md:col-span-2">
                      <JsonDataDisplay data={candidate.interviewData} title="Interview Data" />
                    </InfoSection>

                    {/* Agent Data */}
                    <InfoSection title="Agent Data" icon={Bot}>
                      <JsonDataDisplay data={candidate.agentData} title="Agent Data" />
                    </InfoSection>

                    {/* Conversation Metadata */}
                    <InfoSection title="Conversation Metadata" icon={Info}>
                      <JsonDataDisplay data={candidate.conversationMetadata} title="Metadata" />
                    </InfoSection>

                    {/* Feedback */}
                    {(candidate.feedbackScore || candidate.feedbackComment) && (
                      <InfoSection title="User Feedback" icon={Star}>
                        <DataPoint label="Score" value={candidate.feedbackScore} icon={Star} />
                        <DataPoint label="Comment" value={candidate.feedbackComment} icon={MessageSquare} />
                      </InfoSection>
                    )}

                    {/* Conversation Notes */}
                    {candidate.conversationNotes && (
                      <InfoSection title="Conversation Notes" icon={FileText}>
                        <p className="text-sm text-cyan-100/80 leading-relaxed">{candidate.conversationNotes}</p>
                      </InfoSection>
                    )}
                  </motion.div>
                </TabsContent>

                {/* Audio Tab */}
                <TabsContent value="audio" className="space-y-6 mt-0">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Card className="bg-gradient-to-br from-slate-900/40 to-slate-800/40 backdrop-blur-sm border-cyan-500/20">
                      <CardHeader className="border-b border-cyan-500/10">
                        <CardTitle className="flex items-center space-x-2">
                          <Headphones className="w-5 h-5 text-cyan-400" />
                          <span className="font-serif">Audio Recording</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="mt-4">
                        {(candidate.localAudioFileId || candidate.audioRecordingUrl) ? (
                          <div className="space-y-4">
                            <AudioPlayer
                              audioUrl={candidate.localAudioFileId 
                                ? `/api/files/audio/${candidate.localAudioFileId}` 
                                : candidate.audioRecordingUrl || ""
                              }
                              title={`Interview with ${candidate.name || 'Candidate'}`}
                              candidateName={candidate.name}
                            />
                            
                            {/* Additional audio file controls */}
                            {candidate.localAudioFileId && (
                              <Card className="p-4 bg-slate-900/30 border-cyan-500/10">
                                <h4 className="font-medium mb-3 flex items-center text-cyan-300">
                                  <Download className="w-4 h-4 mr-2" />
                                  File Actions
                                </h4>
                                <div className="flex space-x-2">
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    className="border-cyan-500/30 hover:bg-cyan-500/10"
                                    onClick={() => window.open(`/api/files/audio/${candidate.localAudioFileId}/download`, '_blank')}
                                    data-testid="download-audio-button"
                                  >
                                    <Download className="w-4 h-4 mr-2" />
                                    Download Audio
                                  </Button>
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    className="border-cyan-500/30 hover:bg-cyan-500/10"
                                    onClick={() => window.open(`/api/files/audio/${candidate.localAudioFileId}`, '_blank')}
                                    data-testid="open-audio-button"
                                  >
                                    <Play className="w-4 h-4 mr-2" />
                                    Open in New Tab
                                  </Button>
                                </div>
                              </Card>
                            )}
                          </div>
                        ) : (
                          <div className="text-center py-8 text-cyan-200/50">
                            <Headphones className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p>No audio recording available</p>
                            <p className="text-xs mt-1">Audio may not have been recorded or is still processing</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                </TabsContent>
              </ScrollArea>
            </div>
          </Tabs>

          {/* Copied Notification */}
          <AnimatePresence>
            {copiedField && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="absolute bottom-4 right-4 bg-gradient-to-r from-emerald-600 to-green-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center space-x-2"
              >
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm font-medium">Copied {copiedField}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { motion } from 'framer-motion';
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
  Info
} from 'lucide-react';
import { AudioPlayer } from '@/components/AudioPlayer';
import { EnhancedTranscript } from '@/components/EnhancedTranscript';
import type { Candidate } from '@shared/schema';

interface CandidateModalProps {
  candidate: Candidate | null;
  isOpen: boolean;
  onClose: () => void;
}

function InfoSection({ title, icon: Icon, children }: { 
  title: string; 
  icon: React.ComponentType<any>; 
  children: React.ReactNode; 
}) {
  return (
    <Card className="h-fit">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center space-x-2 text-sm">
          <Icon className="w-4 h-4" />
          <span>{title}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {children}
      </CardContent>
    </Card>
  );
}

function DataPoint({ label, value, icon: Icon }: { 
  label: string; 
  value: string | number | null | undefined; 
  icon?: React.ComponentType<any>; 
}) {
  if (!value) return null;
  
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground flex items-center">
        {Icon && <Icon className="w-3 h-3 mr-1" />}
        {label}
      </span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function ScoreDisplay({ label, score, maxScore = 100 }: { 
  label: string; 
  score: number | null | undefined; 
  maxScore?: number; 
}) {
  if (!score && score !== 0) return null;
  
  const percentage = (score / maxScore) * 100;
  const getScoreColor = (pct: number) => {
    if (pct >= 80) return "bg-green-500";
    if (pct >= 60) return "bg-yellow-500";
    return "bg-red-500";
  };
  
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{score}/{maxScore}</span>
      </div>
      <div className="w-full bg-muted rounded-full h-2">
        <div 
          className={`h-2 rounded-full transition-all duration-300 ${getScoreColor(percentage)}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function JsonDataDisplay({ data, title }: { data: any; title: string }) {
  if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Info className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>No {title.toLowerCase()} data available</p>
      </div>
    );
  }

  // If it's a simple object with key-value pairs, display them nicely
  if (typeof data === 'object' && !Array.isArray(data)) {
    return (
      <div className="space-y-3">
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
    <ScrollArea className="h-64">
      <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto">
        {JSON.stringify(data, null, 2)}
      </pre>
    </ScrollArea>
  );
}

export default function CandidateModal({ candidate, isOpen, onClose }: CandidateModalProps) {
  const [activeTab, setActiveTab] = useState("overview");

  if (!candidate) return null;

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

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'NEW': return 'bg-blue-500';
      case 'FIRST_INTERVIEW': return 'bg-yellow-500';
      case 'TECHNICAL_SCREEN': return 'bg-orange-500';
      case 'FINAL_INTERVIEW': return 'bg-purple-500';
      case 'OFFER': return 'bg-green-500';
      case 'HIRED': return 'bg-emerald-500';
      case 'REJECTED': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-3">
            <User className="w-6 h-6" />
            <span>{candidate.name || 'Unknown Candidate'}</span>
            <Badge className={`${getStageColor(candidate.pipelineStage)} text-white`}>
              {candidate.pipelineStage?.replace('_', ' ')}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Complete candidate profile with ElevenLabs interview data and evaluation metrics
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview" className="flex items-center space-x-2">
              <User className="w-4 h-4" />
              <span>Overview</span>
            </TabsTrigger>
            <TabsTrigger value="interview" className="flex items-center space-x-2">
              <MessageSquare className="w-4 h-4" />
              <span>Interview</span>
            </TabsTrigger>
            <TabsTrigger value="transcript" className="flex items-center space-x-2">
              <FileText className="w-4 h-4" />
              <span>Transcript</span>
            </TabsTrigger>
            <TabsTrigger value="evaluation" className="flex items-center space-x-2">
              <BarChart3 className="w-4 h-4" />
              <span>Evaluation</span>
            </TabsTrigger>
            <TabsTrigger value="audio" className="flex items-center space-x-2">
              <Headphones className="w-4 h-4" />
              <span>Audio</span>
            </TabsTrigger>
          </TabsList>

          <div className="mt-4 h-[calc(90vh-200px)]">
            <ScrollArea className="h-full">
              <TabsContent value="overview" className="space-y-6 mt-0">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                >
                  {/* Basic Information */}
                  <InfoSection title="Contact Information" icon={User}>
                    <DataPoint label="Name" value={candidate.name} icon={User} />
                    <DataPoint label="Email" value={candidate.email} icon={Mail} />
                    <DataPoint label="Phone" value={candidate.phone} icon={Phone} />
                    <DataPoint label="Source" value={candidate.sourceRef} />
                  </InfoSection>

                  {/* Pipeline Status */}
                  <InfoSection title="Pipeline Status" icon={Target}>
                    <DataPoint label="Stage" value={candidate.pipelineStage?.replace('_', ' ')} />
                    <DataPoint label="Overall Score" value={candidate.score ? `${candidate.score}/100` : undefined} icon={Star} />
                    <DataPoint label="Created" value={formatDate(candidate.createdAt)} icon={Calendar} />
                    <DataPoint label="Updated" value={formatDate(candidate.createdAt)} icon={Clock} />
                  </InfoSection>

                  {/* Interview Summary */}
                  <InfoSection title="Interview Summary" icon={MessageSquare}>
                    <DataPoint label="Interview Date" value={formatDate(candidate.interviewDate)} icon={Calendar} />
                    <DataPoint label="Call Duration" value={candidate.callDuration ? `${candidate.callDuration}s` : undefined} icon={Clock} />
                    <DataPoint label="Agent" value={candidate.agentName} />
                    <DataPoint label="Status" value={candidate.callStatus} />
                  </InfoSection>
                </motion.div>

                {/* Notes Section */}
                {candidate.notes && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2 text-sm">
                        <FileText className="w-4 h-4" />
                        <span>Notes</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm leading-relaxed">{candidate.notes}</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="interview" className="space-y-6 mt-0">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="grid grid-cols-1 md:grid-cols-2 gap-6"
                >
                  {/* Core Interview Questions */}
                  <InfoSection title="Core Interview Responses" icon={MessageSquare}>
                    <DataPoint label="Why Insurance?" value={candidate.whyInsurance} />
                    <DataPoint label="Why Now?" value={candidate.whyNow} />
                    <DataPoint label="Sales Experience" value={candidate.salesExperience} />
                    <DataPoint label="Difficult Customer Story" value={candidate.difficultCustomerStory} />
                    <DataPoint label="Consultative Selling" value={candidate.consultativeSelling} />
                  </InfoSection>

                  {/* Market & Timeline */}
                  <InfoSection title="Market Preferences & Timeline" icon={Target}>
                    <DataPoint label="Preferred Markets" value={
                      Array.isArray(candidate.preferredMarkets) 
                        ? candidate.preferredMarkets.join(', ')
                        : candidate.preferredMarkets
                    } />
                    <DataPoint label="Timeline" value={candidate.timeline} />
                    <DataPoint label="Next Steps" value={candidate.recommendedNextSteps} />
                  </InfoSection>

                  {/* Performance Indicators */}
                  <InfoSection title="Performance Indicators" icon={CheckCircle}>
                    <DataPoint label="Demo Call Performed" value={candidate.demoCallPerformed ? 'Yes' : 'No'} />
                    <DataPoint label="Kevin Persona Used" value={candidate.kevinPersonaUsed ? 'Yes' : 'No'} />
                    <DataPoint label="Coaching Given" value={candidate.coachingGiven ? 'Yes' : 'No'} />
                    <DataPoint label="Pitch Delivered" value={candidate.pitchDelivered ? 'Yes' : 'No'} />
                  </InfoSection>

                  {/* Interview Summary */}
                  <InfoSection title="Interview Summary" icon={FileText}>
                    <div className="space-y-3">
                      {candidate.interviewSummary && (
                        <div>
                          <label className="text-sm font-medium">Summary</label>
                          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                            {candidate.interviewSummary}
                          </p>
                        </div>
                      )}
                      {candidate.transcriptSummary && (
                        <div>
                          <label className="text-sm font-medium">Transcript Summary</label>
                          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                            {candidate.transcriptSummary}
                          </p>
                        </div>
                      )}
                    </div>
                  </InfoSection>
                </motion.div>
              </TabsContent>

              <TabsContent value="transcript" className="space-y-6 mt-0">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <FileText className="w-5 h-5" />
                        <span>Interview Transcript</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {candidate.interviewTranscript ? (
                        <EnhancedTranscript 
                          transcript={candidate.interviewTranscript}
                        />
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                          <p>No transcript available</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              </TabsContent>

              <TabsContent value="evaluation" className="space-y-6 mt-0">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="grid grid-cols-1 md:grid-cols-2 gap-6"
                >
                  {/* Evaluation Scores */}
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
                        <label className="text-sm font-medium text-green-600 mb-2 block">Strengths</label>
                        <div className="space-y-1">
                          {candidate.strengths.map((strength, index) => (
                            <div key={index} className="flex items-center space-x-2">
                              <CheckCircle className="w-3 h-3 text-green-500" />
                              <span className="text-sm">{strength}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {candidate.developmentAreas && Array.isArray(candidate.developmentAreas) && candidate.developmentAreas.length > 0 && (
                      <div>
                        <label className="text-sm font-medium text-orange-600 mb-2 block">Development Areas</label>
                        <div className="space-y-1">
                          {candidate.developmentAreas.map((area, index) => (
                            <div key={index} className="flex items-center space-x-2">
                              <Target className="w-3 h-3 text-orange-500" />
                              <span className="text-sm">{area}</span>
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

                  {/* Data Collection Results */}
                  <InfoSection title="Data Collection Results" icon={Info}>
                    <JsonDataDisplay data={candidate.dataCollectionResults} title="Data Collection Results" />
                  </InfoSection>
                </motion.div>
              </TabsContent>

              <TabsContent value="audio" className="space-y-6 mt-0">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <Headphones className="w-5 h-5" />
                        <span>Audio Recording</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {candidate.audioRecordingUrl ? (
                        <AudioPlayer
                          audioUrl={candidate.audioRecordingUrl}
                          title={`Interview with ${candidate.name || 'Candidate'}`}
                        />
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
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
      </DialogContent>
    </Dialog>
  );
}
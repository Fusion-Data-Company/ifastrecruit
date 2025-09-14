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
import { formatCurrency } from '@/lib/utils';
import type { Candidate } from '@shared/schema';

interface CandidateModalProps {
  candidate: Candidate | null;
  isOpen: boolean;
  onClose: () => void;
}

// Elite InfoSection with premium glassmorphic styling
function InfoSection({ title, icon: Icon, children, className = "" }: { 
  title: string; 
  icon: React.ComponentType<any>; 
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={className}
    >
      <Card className="group relative h-fit bg-gradient-to-br from-slate-900/60 via-slate-800/50 to-slate-900/60 backdrop-blur-xl border border-slate-700/30 hover:border-cyan-400/40 transition-all duration-500 hover:shadow-2xl hover:shadow-cyan-500/10 overflow-hidden">
        {/* Elite background patterns */}
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(120,119,198,0.1),transparent_50%)] opacity-60" />
        
        <CardHeader className="relative pb-4 border-b border-slate-700/40">
          <CardTitle className="flex items-center space-x-3 text-base font-medium">
            <div className="relative p-2.5 bg-gradient-to-br from-cyan-600/20 via-blue-600/15 to-purple-600/20 rounded-xl border border-cyan-500/20 shadow-lg">
              <Icon className="w-5 h-5 text-cyan-300" />
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/10 to-blue-400/10 rounded-xl blur-sm" />
            </div>
            <span className="bg-gradient-to-r from-slate-100 via-white to-cyan-100 bg-clip-text text-transparent font-semibold tracking-wide">
              {title}
            </span>
          </CardTitle>
        </CardHeader>
        
        <CardContent className="relative space-y-4 pt-5 pb-6">
          {children}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Elite DataPoint with premium styling and enhanced UX
function DataPoint({ 
  label, 
  value, 
  icon: Icon, 
  copyable = false,
  onCopy,
  priority = 'normal',
  copiedField
}: { 
  label: string; 
  value: string | number | null | undefined; 
  icon?: React.ComponentType<any>;
  copyable?: boolean;
  onCopy?: (text: string, field: string) => void;
  priority?: 'high' | 'normal' | 'low';
  copiedField?: string | null;
}) {
  if (!value && value !== 0) return null;
  
  const stringValue = String(value);
  const isLongValue = stringValue.length > 35;
  const isIdField = label.toLowerCase().includes('id') || label.toLowerCase().includes('source');
  
  const getPriorityStyles = () => {
    switch (priority) {
      case 'high':
        return {
          container: 'hover:bg-gradient-to-r hover:from-cyan-500/10 hover:to-blue-500/10 border border-transparent hover:border-cyan-400/20',
          label: 'text-cyan-200 font-semibold',
          value: 'text-white font-semibold'
        };
      case 'low':
        return {
          container: 'hover:bg-slate-700/20',
          label: 'text-slate-400',
          value: 'text-slate-300'
        };
      default:
        return {
          container: 'hover:bg-gradient-to-r hover:from-slate-700/30 hover:to-slate-600/20',
          label: 'text-slate-300',
          value: 'text-slate-100'
        };
    }
  };
  
  const styles = getPriorityStyles();
  
  if (isLongValue && isIdField) {
    const midpoint = Math.ceil(stringValue.length / 2);
    const firstLine = stringValue.substring(0, midpoint);
    const secondLine = stringValue.substring(midpoint);
    
    return (
      <motion.div 
        whileHover={{ x: 2, scale: 1.005 }}
        className={`group p-3 rounded-lg transition-all duration-300 ${styles.container}`}
      >
        <div className="flex items-center justify-between mb-2">
          <span className={`text-sm flex items-center space-x-2 ${styles.label}`}>
            {Icon && <Icon className="w-4 h-4" />}
            <span className="font-medium tracking-wide">{label}</span>
          </span>
          {copyable && onCopy && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-gradient-to-r hover:from-cyan-500/20 hover:to-blue-500/20 hover:text-cyan-300 rounded-lg border border-transparent hover:border-cyan-500/30"
                      onClick={() => onCopy(stringValue, label)}
                      data-testid={`copy-${label.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      {copiedField === label ? (
                        <motion.div
                          initial={{ scale: 0, rotate: -180 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{ duration: 0.3, type: "spring" }}
                        >
                          <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                        </motion.div>
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </Button>
                  </motion.div>
                </TooltipTrigger>
                <TooltipContent side="top" className="bg-slate-800/95 border-slate-700/50 backdrop-blur-sm">
                  <p className="text-xs font-medium text-slate-200">
                    {copiedField === label ? '✨ Copied!' : `Copy ${label}`}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <div className="bg-slate-800/40 border border-slate-700/40 rounded-md px-3 py-2 font-mono text-sm backdrop-blur-sm">
          <div className={`break-all ${styles.value}`}>{firstLine}</div>
          <div className={`break-all ${styles.value}`}>{secondLine}</div>
        </div>
      </motion.div>
    );
  }
  
  return (
    <motion.div 
      whileHover={{ x: 2, scale: 1.005 }}
      className={`group flex items-center justify-between p-3 rounded-lg transition-all duration-300 ${styles.container}`}
    >
      <span className={`text-sm flex items-center space-x-2 ${styles.label}`}>
        {Icon && <Icon className="w-4 h-4" />}
        <span className="font-medium tracking-wide">{label}</span>
      </span>
      <div className="flex items-center space-x-3">
        <span className={`text-sm font-medium ${styles.value} max-w-xs truncate`} title={stringValue}>
          {stringValue}
        </span>
        {copyable && onCopy && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-cyan-500/20 hover:text-cyan-300"
                  onClick={() => onCopy && onCopy(stringValue, label)}
                  data-testid={`copy-${label.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  {copiedField === label ? (
                    <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="text-xs">Copy {label}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </motion.div>
  );
}

// Elite ScoreDisplay with premium data visualization
function ScoreDisplay({ label, score, maxScore = 100, showTarget = false }: { 
  label: string; 
  score: number | null | undefined; 
  maxScore?: number;
  showTarget?: boolean;
}) {
  if (!score && score !== 0) return null;
  
  const percentage = (score / maxScore) * 100;
  const targetPercentage = showTarget ? 80 : null; // 80% target line
  
  const getScoreData = (pct: number) => {
    if (pct >= 90) return {
      gradient: "from-emerald-400 via-green-400 to-emerald-500",
      textColor: "text-emerald-400",
      shadowColor: "shadow-emerald-500/30",
      bgGlow: "bg-emerald-500/10",
      rating: "Outstanding",
      icon: <Award className="w-4 h-4" />
    };
    if (pct >= 80) return {
      gradient: "from-green-400 via-emerald-400 to-green-500",
      textColor: "text-green-400",
      shadowColor: "shadow-green-500/30",
      bgGlow: "bg-green-500/10",
      rating: "Excellent",
      icon: <Star className="w-4 h-4" />
    };
    if (pct >= 70) return {
      gradient: "from-yellow-400 via-amber-400 to-yellow-500",
      textColor: "text-yellow-400",
      shadowColor: "shadow-yellow-500/30",
      bgGlow: "bg-yellow-500/10",
      rating: "Good",
      icon: <TrendingUp className="w-4 h-4" />
    };
    if (pct >= 60) return {
      gradient: "from-orange-400 via-amber-400 to-orange-500",
      textColor: "text-orange-400",
      shadowColor: "shadow-orange-500/30",
      bgGlow: "bg-orange-500/10",
      rating: "Fair",
      icon: <Clock className="w-4 h-4" />
    };
    return {
      gradient: "from-red-400 via-pink-400 to-red-500",
      textColor: "text-red-400",
      shadowColor: "shadow-red-500/30",
      bgGlow: "bg-red-500/10",
      rating: "Needs Improvement",
      icon: <AlertCircle className="w-4 h-4" />
    };
  };
  
  const scoreData = getScoreData(percentage);
  
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="space-y-4 p-4 rounded-lg bg-slate-800/30 border border-slate-700/40 backdrop-blur-sm"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-lg ${scoreData.bgGlow} border border-slate-600/30`}>
            <div className={scoreData.textColor}>
              {scoreData.icon}
            </div>
          </div>
          <div>
            <span className="text-slate-300 font-medium tracking-wide">{label}</span>
            <div className={`text-xs ${scoreData.textColor} font-semibold`}>{scoreData.rating}</div>
          </div>
        </div>
        <div className="text-right">
          <span className={`text-2xl font-bold ${scoreData.textColor}`}>{score}</span>
          <span className="text-slate-400 text-sm">/{maxScore}</span>
          <div className={`text-xs ${scoreData.textColor} font-medium`}>{Math.round(percentage)}%</div>
        </div>
      </div>
      
      <div className="relative">
        <div className="w-full bg-slate-700/50 rounded-full h-3 overflow-hidden border border-slate-600/30">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
            className={`h-full bg-gradient-to-r ${scoreData.gradient} ${scoreData.shadowColor} shadow-lg relative overflow-hidden`}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent" />
          </motion.div>
          
          {/* Target line */}
          {targetPercentage && (
            <div 
              className="absolute top-0 h-full w-0.5 bg-cyan-400 shadow-lg shadow-cyan-400/50"
              style={{ left: `${targetPercentage}%` }}
            >
              <div className="absolute -top-1 -left-2 text-xs text-cyan-400 font-bold">Target</div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// Enhanced JsonDataDisplay with complete type safety
function JsonDataDisplay({ data, title }: { data: unknown; title: string }): React.ReactElement {
  // Type guard to ensure data is safe for rendering
  const renderSafeData = (input: unknown): React.ReactElement => {
    if (!input || (typeof input === 'object' && input !== null && Object.keys(input).length === 0)) {
      return (
        <div className="text-center py-8 text-cyan-200/50">
          <Info className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No {title.toLowerCase()} data available</p>
        </div>
      );
    }

    // Helper function to safely convert unknown values to renderable strings
    const safeStringConvert = (value: unknown): string => {
      if (value === null || value === undefined) {
        return '-';
      }
      if (typeof value === 'string') {
        return value;
      }
      if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
      }
      if (typeof value === 'object') {
        try {
          return JSON.stringify(value);
        } catch {
          return '[Complex Object]';
        }
      }
      return String(value);
    };

    // If it's a simple object with key-value pairs, display them nicely
    if (typeof input === 'object' && input !== null && !Array.isArray(input)) {
      const entries = Object.entries(input as Record<string, unknown>);
      return (
        <div className="space-y-2">
          {entries.map(([key, value]) => (
            <DataPoint 
              key={key}
              label={key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim()}
              value={safeStringConvert(value)}
            />
          ))}
        </div>
      );
    }

    // For arrays or complex objects, show formatted JSON
    let jsonString: string;
    try {
      jsonString = JSON.stringify(input, null, 2);
    } catch {
      jsonString = '[Unable to serialize data]';
    }

    return (
      <ScrollArea className="h-64 rounded-lg bg-slate-900/50 backdrop-blur-sm">
        <pre className="text-xs text-cyan-100/80 p-3 overflow-x-auto">
          {jsonString}
        </pre>
      </ScrollArea>
    );
  };

  return renderSafeData(data);
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
        <DialogContent className="max-w-[95vw] max-h-[96vh] overflow-hidden bg-gradient-to-br from-slate-950/98 via-slate-900/96 to-slate-950/98 backdrop-blur-2xl border border-slate-700/40 shadow-2xl shadow-cyan-500/5 rounded-2xl">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.03),transparent_50%),radial-gradient(ellipse_at_bottom_right,rgba(6,182,212,0.03),transparent_50%)]" />
          
          <DialogHeader className="relative pb-6 border-b border-slate-700/50">
            <div className="absolute -inset-4 bg-gradient-to-r from-cyan-600/10 via-blue-600/10 to-purple-600/10 blur-2xl opacity-60" />
            
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="relative z-10"
            >
              <DialogTitle className="flex items-center space-x-4 text-2xl font-bold mb-3">
                <div className="relative">
                  <div className="p-3 bg-gradient-to-br from-cyan-600/30 via-blue-600/25 to-purple-600/30 rounded-2xl border border-cyan-500/30 shadow-xl shadow-cyan-500/20 backdrop-blur-sm">
                    <User className="w-8 h-8 text-cyan-300" />
                  </div>
                  <div className="absolute -inset-2 bg-gradient-to-br from-cyan-400/20 to-purple-400/20 rounded-2xl blur-lg" />
                </div>
                
                <div className="flex-1">
                  <h1 className="bg-gradient-to-r from-slate-100 via-white to-cyan-100 bg-clip-text text-transparent font-bold tracking-tight">
                    {candidate.name || 'Unknown Candidate'}
                  </h1>
                  <div className="flex items-center space-x-3 mt-2">
                    <Badge className={`${getStageColor(candidate.pipelineStage)} text-white px-4 py-1.5 shadow-xl border-0 font-semibold tracking-wide`}>
                      {candidate.pipelineStage?.replace('_', ' ')}
                    </Badge>
                    {candidate.elevenLabsUserId && (
                      <Badge className="bg-gradient-to-r from-purple-600 via-pink-600 to-purple-700 text-white px-4 py-1.5 shadow-xl border-0 font-semibold">
                        <Bot className="w-4 h-4 mr-2" />
                        AI Verified
                      </Badge>
                    )}
                    {candidate.overallScore && candidate.overallScore >= 80 && (
                      <Badge className="bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 text-amber-950 px-4 py-1.5 shadow-xl border-0 font-bold">
                        <Award className="w-4 h-4 mr-2" />
                        High Performer
                      </Badge>
                    )}
                  </div>
                </div>
                
                {/* Elite Score Display in Header */}
                {candidate.overallScore && (
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
                    className="relative"
                  >
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500 via-blue-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-cyan-500/30 border border-cyan-400/40">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-white">{candidate.overallScore}</div>
                        <div className="text-xs text-cyan-100 font-semibold">AI SCORE</div>
                      </div>
                    </div>
                    <div className="absolute -inset-2 bg-gradient-to-br from-cyan-500/30 to-purple-500/30 rounded-2xl blur-xl opacity-60" />
                  </motion.div>
                )}
              </DialogTitle>
              
              <DialogDescription className="flex items-center space-x-2 text-slate-300 text-base">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <span className="font-medium">Enterprise-grade candidate intelligence with AI-powered insights</span>
              </DialogDescription>
            </motion.div>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full mt-6">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
            >
              <TabsList className="grid w-full grid-cols-7 h-16 items-stretch bg-gradient-to-r from-slate-800/60 via-slate-700/50 to-slate-800/60 backdrop-blur-xl border border-slate-600/40 p-2 rounded-2xl shadow-xl shadow-slate-900/50">
                <TabsTrigger 
                  value="overview" 
                  className="flex items-center space-x-2 h-full px-4 py-0 rounded-xl font-semibold transition-all duration-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-600 data-[state=active]:via-blue-600 data-[state=active]:to-cyan-600 data-[state=active]:text-white hover:bg-slate-700/50"
                >
                  <User className="w-4 h-4" />
                  <span className="hidden sm:inline tracking-wide">Overview</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="interview" 
                  className="flex items-center space-x-2 h-full px-4 py-0 rounded-xl font-semibold transition-all duration-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-600 data-[state=active]:via-blue-600 data-[state=active]:to-cyan-600 data-[state=active]:text-white hover:bg-slate-700/50"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span className="hidden sm:inline tracking-wide">Interview</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="technical" 
                  className="flex items-center space-x-2 h-full px-4 py-0 rounded-xl font-semibold transition-all duration-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-600 data-[state=active]:via-blue-600 data-[state=active]:to-cyan-600 data-[state=active]:text-white hover:bg-slate-700/50"
                >
                  <Cpu className="w-4 h-4" />
                  <span className="hidden sm:inline tracking-wide">Technical</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="transcript" 
                  className="flex items-center space-x-2 h-full px-4 py-0 rounded-xl font-semibold transition-all duration-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-600 data-[state=active]:via-blue-600 data-[state=active]:to-cyan-600 data-[state=active]:text-white hover:bg-slate-700/50"
                >
                  <FileText className="w-4 h-4" />
                  <span className="hidden sm:inline tracking-wide">Transcript</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="evaluation" 
                  className="flex items-center space-x-2 h-full px-4 py-0 rounded-xl font-semibold transition-all duration-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-600 data-[state=active]:via-blue-600 data-[state=active]:to-cyan-600 data-[state=active]:text-white hover:bg-slate-700/50"
                >
                  <BarChart3 className="w-4 h-4" />
                  <span className="hidden sm:inline tracking-wide">Analytics</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="metadata" 
                  className="flex items-center space-x-2 h-full px-4 py-0 rounded-xl font-semibold transition-all duration-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-600 data-[state=active]:via-blue-600 data-[state=active]:to-cyan-600 data-[state=active]:text-white hover:bg-slate-700/50"
                >
                  <Database className="w-4 h-4" />
                  <span className="hidden sm:inline tracking-wide">Data</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="audio" 
                  className="flex items-center space-x-2 h-full px-4 py-0 rounded-xl font-semibold transition-all duration-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-600 data-[state=active]:via-blue-600 data-[state=active]:to-cyan-600 data-[state=active]:text-white hover:bg-slate-700/50"
                >
                  <Headphones className="w-4 h-4" />
                  <span className="hidden sm:inline tracking-wide">Audio</span>
                </TabsTrigger>
              </TabsList>
            </motion.div>

            <div className="mt-6 h-[calc(96vh-280px)]">
              <ScrollArea className="h-full pr-4">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                  >
                {/* Overview Tab */}
                <TabsContent value="overview" className="space-y-8 mt-0 px-2">
                  {/* Elite Performance Summary Bar */}
                  {candidate.overallScore && (
                    <motion.div
                      initial={{ opacity: 0, y: 20, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                      className="mb-8"
                    >
                      <ScoreDisplay 
                        label="Overall Performance"
                        score={candidate.overallScore} 
                        showTarget={true}
                      />
                    </motion.div>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
                    {/* Essential Information - High Priority */}
                    <InfoSection title="Essential Information" icon={User} className="lg:col-span-1">
                      <DataPoint label="Name" value={candidate.name} icon={User} priority="high" />
                      <DataPoint label="Email" value={candidate.email} icon={Mail} copyable onCopy={copyToClipboard} priority="high" copiedField={copiedField} />
                      <DataPoint label="Phone" value={candidate.phone} icon={Phone} copyable onCopy={copyToClipboard} priority="high" copiedField={copiedField} />
                      <DataPoint label="Source" value={candidate.sourceRef} icon={Link} priority="normal" />
                      <DataPoint label="Campaign" value={candidate.campaignId} icon={Target} copyable onCopy={copyToClipboard} priority="normal" copiedField={copiedField} />
                    </InfoSection>

                    {/* Performance & Status */}
                    <InfoSection title="Performance & Status" icon={TrendingUp} className="lg:col-span-1">
                      <DataPoint label="Pipeline Stage" value={candidate.pipelineStage?.replace('_', ' ')} icon={Activity} priority="high" />
                      {candidate.score && (
                        <DataPoint label="Legacy Score" value={`${candidate.score}/100`} icon={Star} priority="normal" />
                      )}
                      <DataPoint label="Created" value={formatDate(candidate.createdAt)} icon={Calendar} priority="normal" />
                      <DataPoint label="Last Updated" value={formatDate(candidate.createdAt)} icon={Clock} priority="low" />
                      
                      {/* Enhanced Tags Display */}
                      {candidate.tags && candidate.tags.length > 0 && (
                        <div className="mt-4 p-3 bg-slate-800/40 rounded-lg border border-slate-700/40">
                          <div className="text-sm font-medium text-slate-300 mb-2 flex items-center">
                            <Package className="w-4 h-4 mr-2" />
                            Tags
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {candidate.tags.map((tag, idx) => (
                              <Badge key={idx} variant="outline" className="bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border-cyan-500/40 text-cyan-300 font-medium px-3 py-1">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </InfoSection>

                    {/* AI Interview Intelligence */}
                    <InfoSection title="AI Interview Intelligence" icon={Brain} className="lg:col-span-2 xl:col-span-1">
                      <DataPoint label="Conversation ID" value={candidate.conversationId} icon={Hash} copyable onCopy={copyToClipboard} priority="normal" copiedField={copiedField} />
                      <DataPoint label="Agent ID" value={candidate.agentId} icon={Bot} copyable onCopy={copyToClipboard} priority="normal" copiedField={copiedField} />
                      <DataPoint label="Agent Name" value={candidate.agentName} icon={User} priority="normal" />
                      <DataPoint label="Status" value={candidate.conversationStatus || candidate.callStatus} icon={Activity} priority="high" />
                      <DataPoint label="Interview Date" value={formatDate(candidate.interviewDate)} icon={Calendar} priority="high" />
                      <DataPoint label="Duration" value={formatDuration(candidate.callDuration)} icon={Timer} priority="normal" />
                      <DataPoint label="Messages" value={candidate.messageCount} icon={MessageSquare} priority="normal" />
                    </InfoSection>

                    {/* Business Intelligence & Analytics */}
                    <InfoSection title="Business Intelligence" icon={BarChart3} className="lg:col-span-1">
                      <DataPoint label="Call Cost" value={formatCurrency(candidate.cost)} icon={DollarSign} priority="high" />
                      <DataPoint label="Start Time" value={formatUnixTime(candidate.startTimeUnixSecs)} icon={Clock} priority="normal" />
                      <DataPoint label="End Time" value={formatUnixTime(candidate.endTimeUnixSecs)} icon={Clock} priority="low" />
                      <DataPoint label="Call Successful" value={candidate.callSuccessful} icon={candidate.callSuccessful === 'true' ? CheckCircle : XCircle} priority="high" />
                      <DataPoint label="Termination Reason" value={candidate.terminationReason} icon={AlertCircle} priority="normal" />
                      <DataPoint label="Feedback Score" value={candidate.feedbackScore} icon={Star} priority="normal" />
                    </InfoSection>

                    {/* Media & Content Status */}
                    <InfoSection title="Media & Content" icon={Headphones} className="lg:col-span-1">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div className={`flex items-center space-x-2 p-2 rounded-lg ${candidate.hasAudio ? 'bg-green-500/20 border border-green-500/40' : 'bg-red-500/20 border border-red-500/40'}`}>
                            <Headphones className={`w-4 h-4 ${candidate.hasAudio ? 'text-green-400' : 'text-red-400'}`} />
                            <span className={`text-sm font-medium ${candidate.hasAudio ? 'text-green-300' : 'text-red-300'}`}>
                              {candidate.hasAudio ? 'Audio Available' : 'No Audio'}
                            </span>
                          </div>
                          
                          <div className={`flex items-center space-x-2 p-2 rounded-lg ${candidate.hasUserAudio ? 'bg-green-500/20 border border-green-500/40' : 'bg-gray-500/20 border border-gray-500/40'}`}>
                            <Mic className={`w-4 h-4 ${candidate.hasUserAudio ? 'text-green-400' : 'text-gray-400'}`} />
                            <span className={`text-sm font-medium ${candidate.hasUserAudio ? 'text-green-300' : 'text-gray-300'}`}>
                              User Audio
                            </span>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <div className={`flex items-center space-x-2 p-2 rounded-lg ${candidate.hasResponseAudio ? 'bg-green-500/20 border border-green-500/40' : 'bg-gray-500/20 border border-gray-500/40'}`}>
                            <Volume2 className={`w-4 h-4 ${candidate.hasResponseAudio ? 'text-green-400' : 'text-gray-400'}`} />
                            <span className={`text-sm font-medium ${candidate.hasResponseAudio ? 'text-green-300' : 'text-gray-300'}`}>
                              Agent Audio
                            </span>
                          </div>
                          
                          <div className={`flex items-center space-x-2 p-2 rounded-lg ${candidate.localTranscriptFileId ? 'bg-green-500/20 border border-green-500/40' : 'bg-gray-500/20 border border-gray-500/40'}`}>
                            <FileText className={`w-4 h-4 ${candidate.localTranscriptFileId ? 'text-green-400' : 'text-gray-400'}`} />
                            <span className={`text-sm font-medium ${candidate.localTranscriptFileId ? 'text-green-300' : 'text-gray-300'}`}>
                              Transcript
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <DataPoint label="Local Audio File" value={candidate.localAudioFileId ? 'Stored' : 'Not available'} icon={Database} priority="low" />
                    </InfoSection>

                    {/* Technical Integration */}
                    <InfoSection title="System Integration" icon={Zap} className="lg:col-span-2 xl:col-span-1">
                      <DataPoint label="ElevenLabs User ID" value={candidate.elevenLabsUserId} icon={UserCheck} copyable onCopy={copyToClipboard} priority="normal" copiedField={copiedField} />
                      <DataPoint label="Channel ID" value={candidate.channelId} icon={Wifi} copyable onCopy={copyToClipboard} priority="low" copiedField={copiedField} />
                      <DataPoint label="API Version" value={candidate.conversationApiVersion} icon={Code} priority="low" />
                      <DataPoint label="Creation Method" value={candidate.creationMethod} icon={Settings} priority="low" />
                      <DataPoint label="Auth Method" value={candidate.authorizationMethod} icon={Key} priority="low" />
                      <DataPoint label="Source Platform" value={candidate.source} icon={Globe} priority="normal" />
                      <DataPoint label="Client IP" value={candidate.clientIp} icon={Globe} copyable onCopy={copyToClipboard} priority="low" copiedField={copiedField} />
                    </InfoSection>
                  </div>

                  {/* Elite Notes Section */}
                  {candidate.notes && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: 0.3 }}
                      className="mt-8"
                    >
                      <Card className="bg-gradient-to-br from-slate-900/70 via-slate-800/60 to-slate-900/70 backdrop-blur-xl border border-slate-600/40 shadow-2xl shadow-slate-900/30">
                        <CardHeader className="border-b border-slate-600/40 pb-4">
                          <CardTitle className="flex items-center space-x-3 text-lg font-semibold">
                            <div className="p-2 bg-gradient-to-br from-amber-600/20 to-orange-600/20 rounded-lg border border-amber-500/30">
                              <FileText className="w-5 h-5 text-amber-400" />
                            </div>
                            <span className="bg-gradient-to-r from-slate-100 to-amber-100 bg-clip-text text-transparent font-semibold tracking-wide">
                              Interview Notes
                            </span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                          <div className="bg-slate-800/40 border border-slate-700/40 rounded-lg p-6">
                            <p className="text-base leading-relaxed text-slate-200 font-medium">
                              {candidate.notes}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
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
                      {candidate.toolCalls ? <JsonDataDisplay data={candidate.toolCalls} title="Tool Calls" /> : <p className="text-cyan-200/50">No tool calls data</p>}
                    </InfoSection>

                    {/* Tool Results */}
                    <InfoSection title="Tool Results" icon={Package}>
                      {candidate.toolResults ? <JsonDataDisplay data={candidate.toolResults} title="Tool Results" /> : <p className="text-cyan-200/50">No tool results data</p>}
                    </InfoSection>

                    {/* Dynamic Variables */}
                    <InfoSection title="Dynamic Variables" icon={Code}>
                      {candidate.dynamicVariables ? <JsonDataDisplay data={candidate.dynamicVariables} title="Dynamic Variables" /> : <p className="text-cyan-200/50">No dynamic variables data</p>}
                    </InfoSection>

                    {/* Conversation Metrics */}
                    <InfoSection title="Turn Metrics" icon={Gauge}>
                      {candidate.conversationTurnMetrics ? <JsonDataDisplay data={candidate.conversationTurnMetrics} title="Turn Metrics" /> : <p className="text-cyan-200/50">No turn metrics data</p>}
                    </InfoSection>

                    {/* Message Timings */}
                    <InfoSection title="Message Timings" icon={Timer}>
                      {candidate.messageTimings ? <JsonDataDisplay data={candidate.messageTimings} title="Message Timings" /> : <p className="text-cyan-200/50">No message timings data</p>}
                    </InfoSection>

                    {/* Custom LLM Data */}
                    <InfoSection title="Custom LLM Data" icon={Brain}>
                      {candidate.customLlmData ? <JsonDataDisplay data={candidate.customLlmData} title="LLM Data" /> : <p className="text-cyan-200/50">No LLM data</p>}
                    </InfoSection>

                    {/* Custom Analysis */}
                    <InfoSection title="Custom Analysis" icon={Cpu}>
                      {candidate.customAnalysisData ? <JsonDataDisplay data={candidate.customAnalysisData} title="Analysis Data" /> : <p className="text-cyan-200/50">No analysis data</p>}
                    </InfoSection>

                    {/* Charging Information */}
                    <InfoSection title="Billing Information" icon={CreditCard}>
                      {candidate.charging ? <JsonDataDisplay data={candidate.charging} title="Charging" /> : <p className="text-cyan-200/50">No charging data</p>}
                      <DataPoint label="Charging Timer" value={candidate.hasChargingTimerTriggered ? 'Triggered' : 'Not triggered'} icon={Timer} />
                      <DataPoint label="Billing Timer" value={candidate.hasBillingTimerTriggered ? 'Triggered' : 'Not triggered'} icon={Timer} />
                    </InfoSection>

                    {/* Deletion Settings */}
                    {candidate.deletionSettings && (
                      <InfoSection title="Data Retention" icon={Trash2}>
                        {candidate.deletionSettings ? <JsonDataDisplay data={candidate.deletionSettings} title="Deletion Settings" /> : <p className="text-cyan-200/50">No deletion settings</p>}
                      </InfoSection>
                    )}

                    {/* Client Initiation Data */}
                    {candidate.conversationInitiationClientData && (
                      <InfoSection title="Client Initiation" icon={Navigation} className="md:col-span-2">
                        {candidate.conversationInitiationClientData ? <JsonDataDisplay data={candidate.conversationInitiationClientData} title="Initiation Data" /> : <p className="text-cyan-200/50">No initiation data</p>}
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
                            transcript={String(candidate.interviewTranscript)}
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
                          {candidate.wordLevelTranscript ? <JsonDataDisplay data={candidate.wordLevelTranscript} title="Word-Level Data" /> : <p className="text-cyan-200/50">No word-level data</p>}
                        </CardContent>
                      </Card>
                    )}


                    {/* Audio Recording Player */}
                    {(candidate.audioRecordingUrl || candidate.conversationId) && candidate.hasAudio && (
                      <Card className="bg-gradient-to-br from-slate-900/40 to-slate-800/40 backdrop-blur-sm border-cyan-500/20">
                        <CardContent className="mt-6">
                          <AudioPlayer
                            audioUrl={candidate.audioRecordingUrl || `/api/audio/${candidate.conversationId}`}
                            candidateName={candidate.name}
                            title="Interview Recording"
                            className="w-full"
                          />
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
                  </motion.div>
                </AnimatePresence>
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
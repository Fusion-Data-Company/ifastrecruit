import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage
} from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  User,
  Mail,
  Phone,
  Star,
  Calendar,
  Search,
  Filter,
  Users,
  Eye,
  CheckCircle,
  Clock,
  XCircle,
  Award,
  Building2,
  Briefcase,
  Shield,
  TrendingUp,
  Edit3,
  Save,
  X,
  Loader2,
  Check,
  Sparkles,
  MessageSquare,
  Bot
} from 'lucide-react';
import CandidateModal from '@/components/CandidateModal';
import type { Candidate } from '@shared/schema';

interface CandidatesTableProps {
  candidates: Candidate[];
  isLoading: boolean;
}

// Validation schema for inline editing
const editCandidateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  pipelineStage: z.enum([
    "NEW", "FIRST_INTERVIEW", "TECHNICAL_SCREEN", 
    "FINAL_INTERVIEW", "OFFER", "HIRED", "REJECTED"
  ])
});

type EditCandidateForm = z.infer<typeof editCandidateSchema>;

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="p-4 border rounded-lg">
          <div className="flex items-center space-x-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-4 w-12" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-12">
      <Users className="w-16 h-16 mx-auto text-muted-foreground mb-4 opacity-50" />
      <h3 className="text-lg font-medium text-muted-foreground mb-2">No candidates found</h3>
      <p className="text-sm text-muted-foreground">
        Add your first candidate or adjust your filters to see results
      </p>
    </div>
  );
}

interface CandidateCardProps {
  candidate: Candidate;
  onViewDetails: (candidate: Candidate) => void;
  index: number;
}

function CandidateCard({ candidate, onViewDetails, index }: CandidateCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const { toast } = useToast();

  const form = useForm<EditCandidateForm>({
    resolver: zodResolver(editCandidateSchema),
    defaultValues: {
      name: candidate.name || '',
      email: candidate.email,
      phone: candidate.phone || '',
      pipelineStage: candidate.pipelineStage
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (data: EditCandidateForm) => {
      const response = await apiRequest('PATCH', `/api/candidates/${candidate.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/candidates'] });
      toast({
        title: "✨ Success",
        description: "Candidate updated successfully",
        duration: 3000,
      });
      setIsEditing(false);
    },
    onError: (error) => {
      toast({
        title: "❌ Error",
        description: "Failed to update candidate",
        variant: "destructive",
        duration: 3000,
      });
    }
  });

  const handleSave = (data: EditCandidateForm) => {
    updateMutation.mutate(data);
  };

  const handleCancel = () => {
    form.reset();
    setIsEditing(false);
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return 'N/A';
    try {
      const d = new Date(date);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return 'Invalid';
    }
  };

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'NEW': return 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg';
      case 'FIRST_INTERVIEW': return 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 shadow-lg';
      case 'TECHNICAL_SCREEN': return 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-lg';
      case 'FINAL_INTERVIEW': return 'bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 shadow-lg';
      case 'OFFER': return 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 shadow-lg';
      case 'HIRED': return 'bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 shadow-lg';
      case 'REJECTED': return 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 shadow-lg';
      default: return 'bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 shadow-lg';
    }
  };

  const getStageIcon = (stage: string) => {
    switch (stage) {
      case 'NEW': return <User className="w-3 h-3" />;
      case 'FIRST_INTERVIEW': 
      case 'TECHNICAL_SCREEN': 
      case 'FINAL_INTERVIEW': return <Clock className="w-3 h-3" />;
      case 'OFFER': return <Award className="w-3 h-3" />;
      case 'HIRED': return <CheckCircle className="w-3 h-3" />;
      case 'REJECTED': return <XCircle className="w-3 h-3" />;
      default: return <User className="w-3 h-3" />;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600 font-bold';
    if (score >= 60) return 'text-amber-600 font-semibold';
    return 'text-red-600 font-medium';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ scale: isEditing ? 1 : 1.01 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className="relative"
    >
      <div className={`
        group relative border rounded-xl overflow-hidden
        ${isEditing 
          ? 'bg-gradient-to-br from-blue-950/95 to-teal-900/95 border-cyan-400/50 shadow-2xl ring-2 ring-cyan-400/30 backdrop-blur-xl' 
          : 'bg-gradient-to-br from-slate-900/95 to-slate-800/95 hover:from-slate-850/95 hover:to-slate-750/95 border-slate-700/50 hover:border-cyan-500/50 hover:shadow-2xl hover:shadow-cyan-500/20'
        }
        transition-all duration-500 backdrop-blur-xl transform hover:scale-[1.02]
        before:absolute before:inset-0 before:bg-gradient-to-r before:from-cyan-500/0 before:via-cyan-500/5 before:to-purple-500/0 before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-500
      `}>
        {/* Elite holographic overlay on hover */}
        <AnimatePresence>
          {isHovered && !isEditing && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10 pointer-events-none"
            />
          )}
        </AnimatePresence>

        {/* Futuristic border glow effect */}
        <motion.div
          className="absolute inset-0 rounded-xl bg-gradient-to-r from-cyan-500/20 via-blue-500/20 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
          style={{
            filter: 'blur(8px)',
            transform: 'scale(1.1)',
          }}
        />

        {/* Animated corner accents */}
        <div className="absolute top-0 left-0 w-12 h-12 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="absolute top-2 left-2 w-6 h-0.5 bg-gradient-to-r from-cyan-400 to-transparent"></div>
          <div className="absolute top-2 left-2 w-0.5 h-6 bg-gradient-to-b from-cyan-400 to-transparent"></div>
        </div>
        <div className="absolute top-0 right-0 w-12 h-12 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="absolute top-2 right-2 w-6 h-0.5 bg-gradient-to-l from-cyan-400 to-transparent"></div>
          <div className="absolute top-2 right-2 w-0.5 h-6 bg-gradient-to-b from-cyan-400 to-transparent"></div>
        </div>

        <div className="p-6 relative z-10">
          {/* Edit Mode Toggle with Premium Animation */}
          <div className="absolute top-4 right-4 z-10">
            {!isEditing ? (
              <motion.button
                whileHover={{ scale: 1.1, rotate: 5 }}
                whileTap={{ scale: 0.95 }}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditing(true);
                }}
                className="p-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg hover:shadow-xl hover:shadow-cyan-500/50 transition-all duration-300 hover:from-cyan-500 hover:to-blue-500 border border-cyan-500/30"
                data-testid={`button-edit-${candidate.id}`}
              >
                <Edit3 className="w-4 h-4" />
              </motion.button>
            ) : (
              <div className="flex space-x-2">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={form.handleSubmit(handleSave)}
                  disabled={updateMutation.isPending}
                  className="p-2 rounded-lg bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-lg hover:shadow-xl hover:shadow-emerald-500/50 transition-all duration-300 disabled:opacity-50 border border-emerald-500/30"
                  data-testid={`button-save-${candidate.id}`}
                >
                  {updateMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleCancel}
                  disabled={updateMutation.isPending}
                  className="p-2 rounded-lg bg-gradient-to-r from-red-500 to-pink-500 text-white shadow-lg hover:shadow-xl hover:shadow-red-500/50 transition-all duration-300 disabled:opacity-50 border border-red-500/30"
                  data-testid={`button-cancel-${candidate.id}`}
                >
                  <X className="w-4 h-4" />
                </motion.button>
              </div>
            )}
          </div>

          {isEditing ? (
            // Edit Mode with Premium Form Styling
            <Form {...form}>
              <div className="space-y-4">
                {/* Name Field */}
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400" />
                          <Input
                            {...field}
                            placeholder="Candidate Name"
                            className="pl-10 bg-slate-800/50 border-slate-600 focus:border-cyan-400 text-white placeholder:text-slate-400 shadow-sm focus:shadow-md focus:shadow-cyan-500/20 transition-all duration-300 focus:ring-2 focus:ring-cyan-500/20 backdrop-blur-sm"
                            data-testid={`input-name-${candidate.id}`}
                          />
                        </div>
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />

                {/* Email and Phone Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400" />
                            <Input
                              {...field}
                              type="email"
                              placeholder="Email"
                              className="pl-10 bg-slate-800/50 border-slate-600 focus:border-cyan-400 text-white placeholder:text-slate-400 shadow-sm focus:shadow-md focus:shadow-cyan-500/20 transition-all duration-300 focus:ring-2 focus:ring-cyan-500/20 backdrop-blur-sm"
                              data-testid={`input-email-${candidate.id}`}
                            />
                          </div>
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-600" />
                            <Input
                              {...field}
                              placeholder="Phone (optional)"
                              className="pl-10 bg-white/90 border-blue-200 focus:border-teal-500 shadow-sm focus:shadow-md transition-all duration-300 focus:ring-2 focus:ring-teal-500/20"
                              data-testid={`input-phone-${candidate.id}`}
                            />
                          </div>
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Pipeline Stage */}
                <FormField
                  control={form.control}
                  name="pipelineStage"
                  render={({ field }) => (
                    <FormItem>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="bg-white/90 border-blue-200 focus:border-teal-500 shadow-sm focus:shadow-md transition-all duration-300 focus:ring-2 focus:ring-teal-500/20" data-testid={`select-stage-${candidate.id}`}>
                            <SelectValue placeholder="Select stage" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="NEW">🆕 New</SelectItem>
                          <SelectItem value="FIRST_INTERVIEW">📞 First Interview</SelectItem>
                          <SelectItem value="TECHNICAL_SCREEN">💬 In Slack</SelectItem>
                          <SelectItem value="FINAL_INTERVIEW">🎯 Final Interview</SelectItem>
                          <SelectItem value="OFFER">💼 Offer</SelectItem>
                          <SelectItem value="HIRED">✅ Hired</SelectItem>
                          <SelectItem value="REJECTED">❌ Rejected</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />
              </div>
            </Form>
          ) : (
            // View Mode with Premium Display
            <div 
              className="cursor-pointer space-y-3"
              onClick={() => onViewDetails(candidate)}
            >
              {/* Header with Name and Score */}
              <div className="flex items-start justify-between pr-12">
                <div className="flex items-center space-x-4">
                  <div className="relative">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-500 via-blue-500 to-purple-500 flex items-center justify-center shadow-xl shadow-cyan-500/25">
                      <User className="w-7 h-7 text-white" />
                    </div>
                    <div className="absolute -inset-1 bg-gradient-to-br from-cyan-500 to-purple-500 rounded-xl opacity-30 blur-sm"></div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-transparent bg-gradient-to-r from-cyan-200 via-white to-cyan-200 bg-clip-text flex items-center">
                      {candidate.name || 'Unknown Candidate'}
                      {candidate.overallScore && candidate.overallScore >= 80 && (
                        <Sparkles className="w-5 h-5 ml-2 text-amber-400 animate-pulse drop-shadow-lg" />
                      )}
                    </h3>
                    <div className="flex items-center space-x-3 mt-2">
                      <Badge className={`${getStageColor(candidate.pipelineStage)} text-white border-0 shadow-lg`}>
                        {getStageIcon(candidate.pipelineStage)}
                        <span className="ml-1">{candidate.pipelineStage?.replace('_', ' ')}</span>
                      </Badge>
                      {candidate.conversationId && (
                        <Badge className="bg-gradient-to-r from-purple-500/80 to-pink-500/80 text-white border-purple-300/30 shadow-lg">
                          <MessageSquare className="w-3 h-3 mr-1" />
                          AI Interviewed
                        </Badge>
                      )}
                      {candidate.agentId && (
                        <Badge className="bg-gradient-to-r from-emerald-500/80 to-green-500/80 text-white border-emerald-300/30 shadow-lg max-w-32">
                          <Bot className="w-3 h-3 mr-1 flex-shrink-0" />
                          <span className="truncate" title={candidate.agentId}>
                            {candidate.agentId.length > 16 ? `${candidate.agentId.substring(0, 16)}...` : candidate.agentId}
                          </span>
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Score Display */}
                {candidate.overallScore !== null && candidate.overallScore !== undefined && (
                  <div className="flex flex-col items-center">
                    <motion.div 
                      className="relative"
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: "spring", stiffness: 260, damping: 20 }}
                    >
                      <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-xl shadow-cyan-500/30 border border-cyan-400/30">
                        <span className={`text-xl font-bold text-white`}>
                          {candidate.overallScore}
                        </span>
                      </div>
                      <div className="absolute -inset-1 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl opacity-30 blur-sm"></div>
                    </motion.div>
                    <div className="text-xs text-cyan-300 uppercase tracking-wider font-semibold mt-1">AI Score</div>
                  </div>
                )}
              </div>

              {/* Contact Information with Futuristic Hover Effects */}
              <div className="space-y-3 pl-18 mt-4">
                <motion.a
                  href={`mailto:${candidate.email}`}
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center space-x-3 text-sm text-slate-300 hover:text-cyan-400 transition-all duration-300 group bg-slate-800/30 px-3 py-2 rounded-lg hover:bg-slate-700/30 backdrop-blur-sm border border-slate-700/50 hover:border-cyan-500/50"
                  whileHover={{ x: 4, scale: 1.02 }}
                  data-testid={`link-email-${candidate.id}`}
                >
                  <Mail className="w-4 h-4 group-hover:text-cyan-400 transition-colors" />
                  <span className="group-hover:text-cyan-300">{candidate.email}</span>
                </motion.a>

                {candidate.phone && (
                  <motion.a
                    href={`tel:${candidate.phone}`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center space-x-3 text-sm text-slate-300 hover:text-cyan-400 transition-all duration-300 group bg-slate-800/30 px-3 py-2 rounded-lg hover:bg-slate-700/30 backdrop-blur-sm border border-slate-700/50 hover:border-cyan-500/50"
                    whileHover={{ x: 4, scale: 1.02 }}
                    data-testid={`link-phone-${candidate.id}`}
                  >
                    <Phone className="w-4 h-4 group-hover:text-cyan-400 transition-colors" />
                    <span className="group-hover:text-cyan-300">{candidate.phone}</span>
                  </motion.a>
                )}

                {candidate.interviewDate && (
                  <div className="inline-flex items-center space-x-3 text-sm text-slate-300 bg-slate-800/30 px-3 py-2 rounded-lg backdrop-blur-sm border border-slate-700/50">
                    <Calendar className="w-4 h-4 text-purple-400" />
                    <span>Interviewed: {formatDate(candidate.interviewDate)}</span>
                  </div>
                )}
              </div>

              {/* Additional Metadata */}
              <div className="flex items-center justify-between pl-18 pt-4 mt-4 border-t border-slate-700/50">
                <div className="flex items-center space-x-4">
                  {candidate.callDuration && (
                    <div className="flex items-center space-x-2 text-xs text-slate-400 bg-slate-800/30 px-2 py-1 rounded-md">
                      <Clock className="w-3 h-3 text-cyan-400" />
                      <span>{Math.floor(candidate.callDuration / 60)}m call</span>
                    </div>
                  )}
                  {candidate.score && candidate.score > 0 && (
                    <div className="flex items-center space-x-2 text-xs text-slate-400 bg-slate-800/30 px-2 py-1 rounded-md">
                      <Star className="w-3 h-3 text-amber-400" />
                      <span>Legacy: {candidate.score}</span>
                    </div>
                  )}
                  {candidate.messageCount && (
                    <div className="flex items-center space-x-2 text-xs text-slate-400 bg-slate-800/30 px-2 py-1 rounded-md">
                      <MessageSquare className="w-3 h-3 text-purple-400" />
                      <span>{candidate.messageCount} messages</span>
                    </div>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 border border-cyan-500/30 hover:border-cyan-400/50 transition-all duration-300 backdrop-blur-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewDetails(candidate);
                  }}
                  data-testid={`button-view-${candidate.id}`}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  View Details
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Loading Overlay */}
        <AnimatePresence>
          {updateMutation.isPending && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-20"
            >
              <div className="flex flex-col items-center space-y-2">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <span className="text-sm font-medium text-gray-600">Updating...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Success Animation */}
        <AnimatePresence>
          {updateMutation.isSuccess && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              onAnimationComplete={() => {
                setTimeout(() => {
                  updateMutation.reset();
                }, 500);
              }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none"
            >
              <div className="p-3 rounded-full bg-gradient-to-r from-emerald-500 to-green-500 shadow-2xl">
                <Check className="w-8 h-8 text-white" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export default function CandidatesTable({ candidates, isLoading }: CandidatesTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const filteredCandidates = (candidates || []).filter(candidate => {
    const matchesSearch = !searchTerm || 
      candidate.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (candidate.name && candidate.name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStage = stageFilter === 'all' || candidate.pipelineStage === stageFilter;
    
    return matchesSearch && matchesStage;
  });

  const stages = ['NEW', 'FIRST_INTERVIEW', 'TECHNICAL_SCREEN', 'FINAL_INTERVIEW', 'OFFER', 'HIRED', 'REJECTED'];

  const handleCandidateClick = (candidate: Candidate) => {
    setSelectedCandidate(candidate);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedCandidate(null);
  };

  return (
    <>
      <Card className="enterprise-card-gradient border-0 shadow-2xl">
        <CardHeader className="border-b border-gray-200/20">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <motion.div 
                className="p-2 bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg shadow-lg"
                whileHover={{ scale: 1.05 }}
              >
                <Building2 className="w-6 h-6 text-white" />
              </motion.div>
              <div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-teal-600 bg-clip-text text-transparent">
                  Enterprise Talent Pipeline
                </h2>
                <p className="text-sm text-muted-foreground mt-1">Managing {filteredCandidates.length} candidates</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                <Briefcase className="w-3 h-3 mr-1" />
                Active Recruiting
              </Badge>
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                <Shield className="w-3 h-3 mr-1" />
                Verified Data
              </Badge>
            </div>
          </CardTitle>
          
          {/* Filters */}
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white/80 backdrop-blur-sm border-gray-200/50 focus:border-blue-400 transition-all duration-300 text-gray-900 placeholder:text-gray-500"
                data-testid="input-search"
              />
            </div>
            
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger className="w-[200px] bg-white/80 backdrop-blur-sm border-gray-200/50 text-gray-900" data-testid="select-filter-stage">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter by stage" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stages</SelectItem>
                {stages.map(stage => (
                  <SelectItem key={stage} value={stage}>
                    {stage.replace('_', ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          {isLoading ? (
            <LoadingSkeleton />
          ) : filteredCandidates.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-4">
              {filteredCandidates.map((candidate, index) => (
                <CandidateCard
                  key={candidate.id}
                  candidate={candidate}
                  onViewDetails={handleCandidateClick}
                  index={index}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Candidate Details Modal */}
      {selectedCandidate && (
        <CandidateModal
          candidate={selectedCandidate}
          isOpen={isModalOpen}
          onClose={handleModalClose}
        />
      )}
    </>
  );
}
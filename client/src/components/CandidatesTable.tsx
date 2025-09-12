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
  MessageSquare
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
          ? 'bg-gradient-to-br from-blue-50/50 to-teal-50/50 border-blue-300 shadow-2xl ring-2 ring-blue-400/20' 
          : 'bg-white hover:shadow-xl border-gray-200/50 hover:border-blue-200 dark:bg-gray-900/50 dark:border-gray-700/50'
        }
        transition-all duration-300 backdrop-blur-sm
      `}>
        {/* Enterprise-grade gradient overlay on hover */}
        <AnimatePresence>
          {isHovered && !isEditing && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-gradient-to-r from-blue-600/5 to-teal-600/5 pointer-events-none"
            />
          )}
        </AnimatePresence>

        <div className="p-5 relative">
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
                className="p-2 rounded-lg bg-gradient-to-r from-blue-600 to-teal-600 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:from-blue-700 hover:to-teal-700"
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
                  className="p-2 rounded-lg bg-gradient-to-r from-emerald-600 to-green-600 text-white shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50"
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
                  className="p-2 rounded-lg bg-gradient-to-r from-red-600 to-pink-600 text-white shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50"
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
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-600" />
                          <Input
                            {...field}
                            placeholder="Candidate Name"
                            className="pl-10 bg-white/90 border-blue-200 focus:border-teal-500 shadow-sm focus:shadow-md transition-all duration-300 focus:ring-2 focus:ring-teal-500/20"
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
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-600" />
                            <Input
                              {...field}
                              type="email"
                              placeholder="Email"
                              className="pl-10 bg-white/90 border-blue-200 focus:border-teal-500 shadow-sm focus:shadow-md transition-all duration-300 focus:ring-2 focus:ring-teal-500/20"
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
                          <SelectItem value="TECHNICAL_SCREEN">💻 Technical Screen</SelectItem>
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
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-teal-500 flex items-center justify-center shadow-lg">
                    <User className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center">
                      {candidate.name || 'Unknown'}
                      {candidate.overallScore && candidate.overallScore >= 80 && (
                        <Sparkles className="w-4 h-4 ml-2 text-amber-500 animate-pulse" />
                      )}
                    </h3>
                    <div className="flex items-center space-x-3 mt-1">
                      <Badge className={`${getStageColor(candidate.pipelineStage)} text-white border-0`}>
                        {getStageIcon(candidate.pipelineStage)}
                        <span className="ml-1">{candidate.pipelineStage?.replace('_', ' ')}</span>
                      </Badge>
                      {candidate.conversationId && (
                        <Badge className="bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 border-purple-200">
                          <MessageSquare className="w-3 h-3 mr-1" />
                          Interviewed
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Score Display */}
                {candidate.overallScore !== null && candidate.overallScore !== undefined && (
                  <div className="flex flex-col items-center">
                    <motion.div 
                      className={`text-2xl font-bold ${getScoreColor(candidate.overallScore)}`}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 260, damping: 20 }}
                    >
                      {candidate.overallScore}
                    </motion.div>
                    <div className="text-xs text-gray-500 uppercase tracking-wider">Score</div>
                  </div>
                )}
              </div>

              {/* Contact Information with Hover Effects */}
              <div className="space-y-2 pl-15">
                <motion.a
                  href={`mailto:${candidate.email}`}
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center space-x-2 text-sm text-gray-600 hover:text-blue-600 transition-colors group"
                  whileHover={{ x: 2 }}
                  data-testid={`link-email-${candidate.id}`}
                >
                  <Mail className="w-4 h-4 group-hover:text-blue-600" />
                  <span className="group-hover:underline">{candidate.email}</span>
                </motion.a>

                {candidate.phone && (
                  <motion.a
                    href={`tel:${candidate.phone}`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center space-x-2 text-sm text-gray-600 hover:text-blue-600 transition-colors group"
                    whileHover={{ x: 2 }}
                    data-testid={`link-phone-${candidate.id}`}
                  >
                    <Phone className="w-4 h-4 group-hover:text-blue-600" />
                    <span className="group-hover:underline">{candidate.phone}</span>
                  </motion.a>
                )}

                {candidate.interviewDate && (
                  <div className="inline-flex items-center space-x-2 text-sm text-gray-600">
                    <Calendar className="w-4 h-4" />
                    <span>Interviewed: {formatDate(candidate.interviewDate)}</span>
                  </div>
                )}
              </div>

              {/* Additional Metadata */}
              <div className="flex items-center justify-between pl-15 pt-2 border-t border-gray-100">
                <div className="flex items-center space-x-4">
                  {candidate.callDuration && (
                    <div className="flex items-center space-x-1 text-xs text-gray-500">
                      <Clock className="w-3 h-3" />
                      <span>{Math.floor(candidate.callDuration / 60)}m</span>
                    </div>
                  )}
                  {candidate.score && candidate.score > 0 && (
                    <div className="flex items-center space-x-1 text-xs text-gray-500">
                      <Star className="w-3 h-3" />
                      <span>Score: {candidate.score}</span>
                    </div>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewDetails(candidate);
                  }}
                  data-testid={`button-view-${candidate.id}`}
                >
                  <Eye className="w-4 h-4 mr-1" />
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
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white/80 backdrop-blur-sm border-gray-200/50 focus:border-blue-400 transition-all duration-300"
                data-testid="input-search"
              />
            </div>
            
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger className="w-[200px] bg-white/80 backdrop-blur-sm border-gray-200/50" data-testid="select-filter-stage">
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
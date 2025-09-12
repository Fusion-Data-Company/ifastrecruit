import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';
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
  TrendingUp
} from 'lucide-react';
import CandidateModal from '@/components/CandidateModal';
import type { Candidate } from '@shared/schema';

interface CandidatesTableProps {
  candidates: Candidate[];
  isLoading: boolean;
}

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
    <>
      <Card className="enterprise-card-gradient border-0 shadow-2xl">
        <CardHeader className="border-b border-gray-200/20">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg shadow-lg">
                <Building2 className="w-6 h-6 text-white" />
              </div>
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
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="candidate-search"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <Select value={stageFilter} onValueChange={setStageFilter}>
                <SelectTrigger className="w-48" data-testid="stage-filter">
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
          </div>
        </CardHeader>
        
        <CardContent>
          {isLoading ? (
            <LoadingSkeleton />
          ) : filteredCandidates.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-3">
              {filteredCandidates.map((candidate, index) => (
                <motion.div
                  key={candidate.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="p-5 enterprise-candidate-card cursor-pointer transition-all duration-300 hover:shadow-xl hover:border-blue-500/30 bg-gradient-to-r from-gray-50/50 to-gray-100/50 dark:from-gray-900/50 dark:to-gray-800/50 border border-gray-200/50 dark:border-gray-700/50 rounded-xl hover:scale-[1.01]"
                  onClick={() => handleCandidateClick(candidate)}
                  data-testid={`candidate-row-${candidate.id}`}
                >
                  <div className="flex items-center justify-between">
                    {/* Left section - Candidate info */}
                    <div className="flex items-center space-x-4 flex-1">
                      {/* Avatar with Enterprise Style */}
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-teal-500 flex items-center justify-center shadow-lg">
                        <User className="w-6 h-6 text-white" />
                      </div>
                      
                      {/* Basic info */}
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center space-x-3">
                          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate">
                            {candidate.name || 'Unknown Candidate'}
                          </h3>
                          {candidate.score && (
                            <div className="flex items-center space-x-1 px-2 py-1 bg-gradient-to-r from-yellow-100 to-amber-100 dark:from-yellow-900/30 dark:to-amber-900/30 rounded-full">
                              <Star className="w-4 h-4 text-amber-500" />
                              <span className={`text-sm ${getScoreColor(candidate.score)}`}>
                                {candidate.score}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center space-x-4 text-sm">
                          <a 
                            href={`mailto:${candidate.email}`}
                            className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 hover:underline transition-colors group"
                            onClick={(e) => e.stopPropagation()}
                            data-testid={`email-link-${candidate.id}`}
                          >
                            <Mail className="w-3 h-3 group-hover:scale-110 transition-transform" />
                            <span className="truncate max-w-48 font-medium">{candidate.email}</span>
                          </a>
                          {candidate.phone && (
                            <a 
                              href={`tel:${candidate.phone}`}
                              className="flex items-center space-x-1 text-emerald-600 hover:text-emerald-800 hover:underline transition-colors group"
                              onClick={(e) => e.stopPropagation()}
                              data-testid={`phone-link-${candidate.id}`}
                            >
                              <Phone className="w-3 h-3 group-hover:scale-110 transition-transform" />
                              <span className="font-medium">{candidate.phone}</span>
                            </a>
                          )}
                          {candidate.interviewDate && (
                            <div className="flex items-center space-x-1">
                              <Calendar className="w-3 h-3" />
                              <span>{formatDate(candidate.interviewDate)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Right section - Stage and actions */}
                    <div className="flex items-center space-x-3">
                      <Badge 
                        className={`${getStageColor(candidate.pipelineStage)} text-white border-0 text-xs font-semibold px-3 py-1`}
                      >
                        {getStageIcon(candidate.pipelineStage)}
                        <span className="ml-1.5">{candidate.pipelineStage.replace('_', ' ')}</span>
                      </Badge>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 w-9 p-0 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-all rounded-lg group"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCandidateClick(candidate);
                        }}
                        data-testid={`view-candidate-${candidate.id}`}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* Additional info on mobile */}
                  <div className="mt-3 pt-3 border-t border-muted sm:hidden">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Source: {candidate.sourceRef || 'Unknown'}</span>
                      <span>Updated: {formatDate(candidate.createdAt)}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Candidate Modal */}
      <CandidateModal
        candidate={selectedCandidate}
        isOpen={isModalOpen}
        onClose={handleModalClose}
      />
    </>
  );
}
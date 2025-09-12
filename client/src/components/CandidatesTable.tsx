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
  Award
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
      case 'NEW': return 'bg-blue-500 hover:bg-blue-600';
      case 'FIRST_INTERVIEW': return 'bg-yellow-500 hover:bg-yellow-600';
      case 'TECHNICAL_SCREEN': return 'bg-orange-500 hover:bg-orange-600';
      case 'FINAL_INTERVIEW': return 'bg-purple-500 hover:bg-purple-600';
      case 'OFFER': return 'bg-green-500 hover:bg-green-600';
      case 'HIRED': return 'bg-emerald-500 hover:bg-emerald-600';
      case 'REJECTED': return 'bg-red-500 hover:bg-red-600';
      default: return 'bg-gray-500 hover:bg-gray-600';
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
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <>
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="w-5 h-5" />
            <span>Candidates ({filteredCandidates.length})</span>
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
                  className="p-4 border rounded-lg cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/30 bg-card hover:bg-muted/50"
                  onClick={() => handleCandidateClick(candidate)}
                  data-testid={`candidate-row-${candidate.id}`}
                >
                  <div className="flex items-center justify-between">
                    {/* Left section - Candidate info */}
                    <div className="flex items-center space-x-4 flex-1">
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      
                      {/* Basic info */}
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center space-x-3">
                          <h3 className="font-medium text-foreground truncate">
                            {candidate.name || 'Unknown Name'}
                          </h3>
                          {candidate.score && (
                            <div className="flex items-center space-x-1">
                              <Star className="w-3 h-3 text-yellow-500" />
                              <span className={`text-sm font-medium ${getScoreColor(candidate.score)}`}>
                                {candidate.score}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                          <div className="flex items-center space-x-1">
                            <Mail className="w-3 h-3" />
                            <span className="truncate max-w-48">{candidate.email}</span>
                          </div>
                          {candidate.phone && (
                            <div className="flex items-center space-x-1">
                              <Phone className="w-3 h-3" />
                              <span>{candidate.phone}</span>
                            </div>
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
                        className={`${getStageColor(candidate.pipelineStage)} text-white border-0 text-xs`}
                      >
                        {getStageIcon(candidate.pipelineStage)}
                        <span className="ml-1">{candidate.pipelineStage.replace('_', ' ')}</span>
                      </Badge>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 hover:bg-primary/20"
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
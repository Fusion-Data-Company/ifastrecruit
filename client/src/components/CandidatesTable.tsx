import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { motion } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
  Edit2,
  Save,
  X,
  CheckCircle,
  Clock,
  XCircle,
  Award,
  AlertCircle
} from 'lucide-react';
import CandidateModal from '@/components/CandidateModal';
import { apiRequest } from '@/lib/queryClient';
import type { Candidate } from '@shared/schema';

interface CandidatesTableProps {
  candidates: Candidate[];
  isLoading: boolean;
}

interface EditingState {
  candidateId: string;
  field: string;
  value: any;
}

interface EditableCellProps {
  value: any;
  candidateId: string;
  field: string;
  type: 'text' | 'email' | 'phone' | 'number' | 'textarea' | 'select' | 'array';
  options?: { value: string; label: string }[];
  onSave: (candidateId: string, field: string, value: any) => void;
  isEditing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  isSaving?: boolean;
}

function EditableCell({ 
  value, 
  candidateId, 
  field, 
  type, 
  options, 
  onSave, 
  isEditing, 
  onStartEdit, 
  onCancelEdit,
  isSaving = false 
}: EditableCellProps) {
  const [editValue, setEditValue] = useState(value);
  
  const handleSave = () => {
    if (editValue !== value) {
      onSave(candidateId, field, editValue);
    } else {
      onCancelEdit();
    }
  };
  
  const handleCancel = () => {
    setEditValue(value);
    onCancelEdit();
  };
  
  const displayValue = () => {
    if (value === null || value === undefined || value === '') return '-';
    if (Array.isArray(value)) return value.join(', ') || '-';
    if (typeof value === 'number') return value.toString();
    return value.toString();
  };
  
  if (!isEditing) {
    return (
      <div 
        className="group flex items-center space-x-2 cursor-pointer hover:bg-muted/50 rounded px-2 py-1 -mx-2 -my-1"
        onClick={onStartEdit}
        data-testid={`cell-${candidateId}-${field}`}
      >
        <span className="flex-1">{displayValue()}</span>
        <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />
      </div>
    );
  }
  
  return (
    <div className="flex items-center space-x-2">
      <div className="flex-1">
        {type === 'select' && options ? (
          <Select 
            value={editValue || ''} 
            onValueChange={setEditValue}
            data-testid={`edit-${candidateId}-${field}`}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : type === 'textarea' ? (
          <Textarea
            value={editValue || ''}
            onChange={(e) => setEditValue(e.target.value)}
            className="min-h-[60px] text-xs"
            data-testid={`edit-${candidateId}-${field}`}
          />
        ) : type === 'array' ? (
          <Input
            value={Array.isArray(editValue) ? editValue.join(', ') : editValue || ''}
            onChange={(e) => setEditValue(e.target.value.split(',').map(s => s.trim()).filter(s => s))}
            className="h-8 text-xs"
            placeholder="Comma-separated values"
            data-testid={`edit-${candidateId}-${field}`}
          />
        ) : (
          <Input
            value={editValue || ''}
            onChange={(e) => {
              const val = type === 'number' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value;
              setEditValue(val);
            }}
            type={type === 'number' ? 'number' : type === 'email' ? 'email' : 'text'}
            className="h-8 text-xs"
            data-testid={`edit-${candidateId}-${field}`}
          />
        )}
      </div>
      <div className="flex space-x-1">
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0"
          onClick={handleSave}
          disabled={isSaving}
          data-testid={`save-${candidateId}-${field}`}
        >
          {isSaving ? (
            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary" />
          ) : (
            <Save className="w-3 h-3 text-green-600" />
          )}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0"
          onClick={handleCancel}
          disabled={isSaving}
          data-testid={`cancel-${candidateId}-${field}`}
        >
          <X className="w-3 h-3 text-red-600" />
        </Button>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="border rounded-lg">
          <div className="p-4 space-y-2">
            <div className="flex space-x-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
            </div>
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
  const [editingState, setEditingState] = useState<EditingState | null>(null);
  const [savingFields, setSavingFields] = useState<Set<string>>(new Set());
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Update candidate mutation
  const updateCandidateMutation = useMutation({
    mutationFn: async ({ candidateId, updates }: { candidateId: string; updates: Partial<Candidate> }) => {
      const response = await apiRequest('PATCH', `/api/candidates/${candidateId}`, updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/candidates'] });
      toast({
        title: "Success",
        description: "Candidate updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: `Failed to update candidate: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Handle field saving
  const handleSaveField = async (candidateId: string, field: string, value: any) => {
    const fieldKey = `${candidateId}-${field}`;
    setSavingFields(prev => new Set([...prev, fieldKey]));
    
    try {
      await updateCandidateMutation.mutateAsync({
        candidateId,
        updates: { [field]: value }
      });
      setEditingState(null);
    } catch (error) {
      // Error is handled by the mutation
    } finally {
      setSavingFields(prev => {
        const newSet = new Set(prev);
        newSet.delete(fieldKey);
        return newSet;
      });
    }
  };
  
  const handleStartEdit = (candidateId: string, field: string, value: any) => {
    setEditingState({ candidateId, field, value });
  };
  
  const handleCancelEdit = () => {
    setEditingState(null);
  };
  
  const isFieldEditing = (candidateId: string, field: string) => {
    return editingState?.candidateId === candidateId && editingState?.field === field;
  };
  
  const isFieldSaving = (candidateId: string, field: string) => {
    return savingFields.has(`${candidateId}-${field}`);
  };
  
  const filteredCandidates = (candidates || []).filter(candidate => {
    const matchesSearch = !searchTerm || 
      candidate.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (candidate.name && candidate.name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStage = stageFilter === 'all' || candidate.pipelineStage === stageFilter;
    
    return matchesSearch && matchesStage;
  });

  const stages = ['NEW', 'FIRST_INTERVIEW', 'TECHNICAL_SCREEN', 'FINAL_INTERVIEW', 'OFFER', 'HIRED', 'REJECTED'];
  
  // Pipeline stage options for select
  const stageOptions = stages.map(stage => ({
    value: stage,
    label: stage.replace('_', ' ')
  }));

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
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return 'Invalid';
    }
  };

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'NEW': return 'bg-blue-500 text-white border-blue-500';
      case 'FIRST_INTERVIEW': return 'bg-yellow-500 text-white border-yellow-500';
      case 'TECHNICAL_SCREEN': return 'bg-orange-500 text-white border-orange-500';
      case 'FINAL_INTERVIEW': return 'bg-purple-500 text-white border-purple-500';
      case 'OFFER': return 'bg-green-500 text-white border-green-500';
      case 'HIRED': return 'bg-emerald-500 text-white border-emerald-500';
      case 'REJECTED': return 'bg-red-500 text-white border-red-500';
      default: return 'bg-gray-500 text-white border-gray-500';
    }
  };

  const renderStageDisplay = (stage: string) => {
    const getIcon = () => {
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
    
    return (
      <Badge className={`${getStageColor(stage)} text-xs flex items-center space-x-1`}>
        {getIcon()}
        <span>{stage.replace('_', ' ')}</span>
      </Badge>
    );
  };

  const getScoreColor = (score: number | null) => {
    if (score === null || score === undefined) return 'text-muted-foreground';
    if (score >= 80) return 'text-green-600 font-medium';
    if (score >= 60) return 'text-yellow-600 font-medium';
    return 'text-red-600 font-medium';
  };
  
  const renderScoreWithIcon = (score: number | null) => {
    if (score === null || score === undefined) return '-';
    return (
      <div className="flex items-center space-x-1">
        <Star className="w-3 h-3 text-yellow-500" />
        <span className={getScoreColor(score)}>{score}</span>
      </div>
    );
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
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead className="min-w-[150px]">Name</TableHead>
                    <TableHead className="min-w-[200px]">Email</TableHead>
                    <TableHead className="min-w-[130px]">Phone</TableHead>
                    <TableHead className="min-w-[160px]">Stage</TableHead>
                    <TableHead className="min-w-[100px]">Score</TableHead>
                    <TableHead className="min-w-[150px]">Notes</TableHead>
                    <TableHead className="min-w-[200px]">Why Insurance</TableHead>
                    <TableHead className="min-w-[150px]">Timeline</TableHead>
                    <TableHead className="min-w-[120px]">Interview Date</TableHead>
                    <TableHead className="w-8">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCandidates.map((candidate) => (
                    <TableRow key={candidate.id} data-testid={`candidate-row-${candidate.id}`}>
                      {/* Avatar */}
                      <TableCell className="p-2">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                          <User className="w-4 h-4 text-primary" />
                        </div>
                      </TableCell>
                      
                      {/* Name */}
                      <TableCell className="p-2">
                        <EditableCell
                          value={candidate.name}
                          candidateId={candidate.id}
                          field="name"
                          type="text"
                          onSave={handleSaveField}
                          isEditing={isFieldEditing(candidate.id, 'name')}
                          onStartEdit={() => handleStartEdit(candidate.id, 'name', candidate.name)}
                          onCancelEdit={handleCancelEdit}
                          isSaving={isFieldSaving(candidate.id, 'name')}
                        />
                      </TableCell>
                      
                      {/* Email */}
                      <TableCell className="p-2">
                        <EditableCell
                          value={candidate.email}
                          candidateId={candidate.id}
                          field="email"
                          type="email"
                          onSave={handleSaveField}
                          isEditing={isFieldEditing(candidate.id, 'email')}
                          onStartEdit={() => handleStartEdit(candidate.id, 'email', candidate.email)}
                          onCancelEdit={handleCancelEdit}
                          isSaving={isFieldSaving(candidate.id, 'email')}
                        />
                      </TableCell>
                      
                      {/* Phone */}
                      <TableCell className="p-2">
                        <EditableCell
                          value={candidate.phone}
                          candidateId={candidate.id}
                          field="phone"
                          type="phone"
                          onSave={handleSaveField}
                          isEditing={isFieldEditing(candidate.id, 'phone')}
                          onStartEdit={() => handleStartEdit(candidate.id, 'phone', candidate.phone)}
                          onCancelEdit={handleCancelEdit}
                          isSaving={isFieldSaving(candidate.id, 'phone')}
                        />
                      </TableCell>
                      
                      {/* Pipeline Stage */}
                      <TableCell className="p-2">
                        <EditableCell
                          value={candidate.pipelineStage}
                          candidateId={candidate.id}
                          field="pipelineStage"
                          type="select"
                          options={stageOptions}
                          onSave={handleSaveField}
                          isEditing={isFieldEditing(candidate.id, 'pipelineStage')}
                          onStartEdit={() => handleStartEdit(candidate.id, 'pipelineStage', candidate.pipelineStage)}
                          onCancelEdit={handleCancelEdit}
                          isSaving={isFieldSaving(candidate.id, 'pipelineStage')}
                        />
                        {!isFieldEditing(candidate.id, 'pipelineStage') && (
                          <div className="mt-1">
                            {renderStageDisplay(candidate.pipelineStage)}
                          </div>
                        )}
                      </TableCell>
                      
                      {/* Overall Score */}
                      <TableCell className="p-2">
                        <EditableCell
                          value={candidate.overallScore}
                          candidateId={candidate.id}
                          field="overallScore"
                          type="number"
                          onSave={handleSaveField}
                          isEditing={isFieldEditing(candidate.id, 'overallScore')}
                          onStartEdit={() => handleStartEdit(candidate.id, 'overallScore', candidate.overallScore)}
                          onCancelEdit={handleCancelEdit}
                          isSaving={isFieldSaving(candidate.id, 'overallScore')}
                        />
                        {!isFieldEditing(candidate.id, 'overallScore') && (
                          <div className="mt-1">
                            {renderScoreWithIcon(candidate.overallScore)}
                          </div>
                        )}
                      </TableCell>
                      
                      {/* Notes */}
                      <TableCell className="p-2">
                        <EditableCell
                          value={candidate.notes}
                          candidateId={candidate.id}
                          field="notes"
                          type="textarea"
                          onSave={handleSaveField}
                          isEditing={isFieldEditing(candidate.id, 'notes')}
                          onStartEdit={() => handleStartEdit(candidate.id, 'notes', candidate.notes)}
                          onCancelEdit={handleCancelEdit}
                          isSaving={isFieldSaving(candidate.id, 'notes')}
                        />
                      </TableCell>
                      
                      {/* Why Insurance */}
                      <TableCell className="p-2">
                        <EditableCell
                          value={candidate.whyInsurance}
                          candidateId={candidate.id}
                          field="whyInsurance"
                          type="textarea"
                          onSave={handleSaveField}
                          isEditing={isFieldEditing(candidate.id, 'whyInsurance')}
                          onStartEdit={() => handleStartEdit(candidate.id, 'whyInsurance', candidate.whyInsurance)}
                          onCancelEdit={handleCancelEdit}
                          isSaving={isFieldSaving(candidate.id, 'whyInsurance')}
                        />
                      </TableCell>
                      
                      {/* Timeline */}
                      <TableCell className="p-2">
                        <EditableCell
                          value={candidate.timeline}
                          candidateId={candidate.id}
                          field="timeline"
                          type="text"
                          onSave={handleSaveField}
                          isEditing={isFieldEditing(candidate.id, 'timeline')}
                          onStartEdit={() => handleStartEdit(candidate.id, 'timeline', candidate.timeline)}
                          onCancelEdit={handleCancelEdit}
                          isSaving={isFieldSaving(candidate.id, 'timeline')}
                        />
                      </TableCell>
                      
                      {/* Interview Date */}
                      <TableCell className="p-2">
                        <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          <span>{formatDate(candidate.interviewDate)}</span>
                        </div>
                      </TableCell>
                      
                      {/* Actions */}
                      <TableCell className="p-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => handleCandidateClick(candidate)}
                          data-testid={`view-candidate-${candidate.id}`}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
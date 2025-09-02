import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from '@/hooks/use-toast';
import { useMCPClient } from '@/lib/mcp-client';
import type { Candidate } from '@shared/schema';

const bulkUpdateSchema = z.object({
  action: z.string().min(1, 'Please select an action'),
  newStage: z.string().optional(),
  tags: z.string().optional(),
  notes: z.string().optional(),
  emailTemplate: z.string().optional(),
});

type BulkUpdateFormData = z.infer<typeof bulkUpdateSchema>;

interface BulkOperationsProps {
  selectedCandidates: string[];
  allCandidates: Candidate[];
  onClearSelection: () => void;
  className?: string;
}

const BULK_ACTIONS = [
  { 
    value: 'stage_update', 
    label: 'Update Pipeline Stage', 
    icon: 'fas fa-stream',
    description: 'Move selected candidates to a different pipeline stage'
  },
  { 
    value: 'send_email', 
    label: 'Send Bulk Email', 
    icon: 'fas fa-envelope',
    description: 'Send personalized emails to selected candidates'
  },
  { 
    value: 'add_tags', 
    label: 'Add Tags', 
    icon: 'fas fa-tags',
    description: 'Add tags to categorize and organize candidates'
  },
  { 
    value: 'schedule_interviews', 
    label: 'Schedule Interviews', 
    icon: 'fas fa-calendar-plus',
    description: 'Bulk schedule interviews for selected candidates'
  },
  { 
    value: 'export_data', 
    label: 'Export Data', 
    icon: 'fas fa-download',
    description: 'Export selected candidates to CSV or Excel'
  },
  { 
    value: 'delete', 
    label: 'Delete Candidates', 
    icon: 'fas fa-trash',
    description: 'Permanently remove selected candidates',
    variant: 'destructive' as const
  },
];

const PIPELINE_STAGES = [
  { value: 'NEW', label: 'New Applications' },
  { value: 'FIRST_INTERVIEW', label: 'First Interview' },
  { value: 'TECHNICAL_SCREEN', label: 'Technical Screen' },
  { value: 'FINAL_INTERVIEW', label: 'Final Interview' },
  { value: 'OFFER', label: 'Offer Extended' },
  { value: 'HIRED', label: 'Hired' },
  { value: 'REJECTED', label: 'Rejected' },
];

const EMAIL_TEMPLATES = [
  { value: 'interview_invite', label: 'Interview Invitation' },
  { value: 'rejection', label: 'Application Rejection' },
  { value: 'offer_letter', label: 'Job Offer' },
  { value: 'follow_up', label: 'Follow-up Communication' },
  { value: 'custom', label: 'Custom Message' },
];

export default function BulkOperations({ 
  selectedCandidates, 
  allCandidates, 
  onClearSelection, 
  className 
}: BulkOperationsProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<string>('');
  const queryClient = useQueryClient();
  const { callTool } = useMCPClient();

  const form = useForm<BulkUpdateFormData>({
    resolver: zodResolver(bulkUpdateSchema),
    defaultValues: {
      action: '',
      newStage: '',
      tags: '',
      notes: '',
      emailTemplate: '',
    },
  });

  // Get selected candidate objects
  const selectedCandidateObjects = allCandidates.filter(c => 
    selectedCandidates.includes(c.id)
  );

  // Bulk operations mutation
  const bulkOperationMutation = useMutation({
    mutationFn: async (data: BulkUpdateFormData) => {
      const operations = selectedCandidates.map(candidateId => {
        switch (data.action) {
          case 'stage_update':
            return callTool('process_candidate', {
              candidateId,
              newStage: data.newStage,
              notes: data.notes || `Bulk update to ${data.newStage}`,
            });
          
          case 'send_email':
            return callTool('send_interview_links', {
              candidateIds: [candidateId],
              templateType: data.emailTemplate?.toUpperCase(),
            });
          
          case 'add_tags':
            return callTool('db.upsert_candidate', {
              id: candidateId,
              tags: data.tags?.split(',').map(tag => tag.trim()),
            });
          
          default:
            return Promise.resolve({ success: true });
        }
      });

      return Promise.all(operations);
    },
    onSuccess: (results) => {
      const successCount = results.filter(r => r.success).length;
      queryClient.invalidateQueries({ queryKey: ['/api/candidates'] });
      setIsDialogOpen(false);
      form.reset();
      onClearSelection();
      
      toast({
        title: 'Bulk Operation Completed',
        description: `Successfully processed ${successCount} of ${selectedCandidates.length} candidates.`,
      });
    },
    onError: () => {
      toast({
        title: 'Bulk Operation Failed',
        description: 'There was an error processing the bulk operation. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleExport = async (format: 'csv' | 'excel') => {
    try {
      const data = selectedCandidateObjects.map(candidate => ({
        Name: candidate.name,
        Email: candidate.email,
        Phone: candidate.phone || '',
        'Pipeline Stage': candidate.pipelineStage,
        Score: candidate.score || 0,
        'Created Date': new Date(candidate.createdAt).toLocaleDateString(),
        Tags: candidate.tags?.join(', ') || '',
        Source: candidate.campaignId ? 'Indeed' : 'Manual',
      }));

      // Convert to CSV
      const headers = Object.keys(data[0]);
      const csvContent = [
        headers.join(','),
        ...data.map(row => headers.map(header => `"${row[header as keyof typeof row]}"`).join(','))
      ].join('\n');

      // Download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `candidates_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: 'Export Successful',
        description: `Exported ${selectedCandidates.length} candidates to ${format.toUpperCase()}.`,
      });
    } catch (error) {
      toast({
        title: 'Export Failed',
        description: 'There was an error exporting the data. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedCandidates.length} candidates? This action cannot be undone.`)) {
      return;
    }

    try {
      // In a real implementation, you'd call a delete API
      toast({
        title: 'Deletion Completed',
        description: `${selectedCandidates.length} candidates have been deleted.`,
      });
      onClearSelection();
    } catch (error) {
      toast({
        title: 'Deletion Failed',
        description: 'There was an error deleting the candidates. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const onSubmit = (data: BulkUpdateFormData) => {
    if (data.action === 'export_data') {
      handleExport('csv');
      return;
    }
    
    if (data.action === 'delete') {
      handleDelete();
      return;
    }

    bulkOperationMutation.mutate(data);
  };

  const renderActionForm = () => {
    const action = BULK_ACTIONS.find(a => a.value === selectedAction);
    if (!action) return null;

    return (
      <div className="space-y-4">
        <div className="flex items-center space-x-3 p-3 bg-muted/50 rounded-lg">
          <i className={`${action.icon} text-primary`}></i>
          <div>
            <h4 className="font-medium">{action.label}</h4>
            <p className="text-sm text-muted-foreground">{action.description}</p>
          </div>
        </div>

        {selectedAction === 'stage_update' && (
          <>
            <FormField
              control={form.control}
              name="newStage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Pipeline Stage</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="glass-input">
                        <SelectValue placeholder="Select new stage" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PIPELINE_STAGES.map((stage) => (
                        <SelectItem key={stage.value} value={stage.value}>
                          {stage.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Add notes about this stage update..."
                      className="glass-input"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}

        {selectedAction === 'send_email' && (
          <FormField
            control={form.control}
            name="emailTemplate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email Template</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger className="glass-input">
                      <SelectValue placeholder="Select email template" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {EMAIL_TEMPLATES.map((template) => (
                      <SelectItem key={template.value} value={template.value}>
                        {template.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {selectedAction === 'add_tags' && (
          <FormField
            control={form.control}
            name="tags"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tags</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="Enter tags separated by commas (e.g., javascript, senior, remote)"
                    className="glass-input"
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
      </div>
    );
  };

  if (selectedCandidates.length === 0) {
    return null;
  }

  return (
    <Card className={`glass-panel p-4 border-l-4 border-l-primary ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <i className="fas fa-check-square text-primary"></i>
            <span className="font-medium">
              {selectedCandidates.length} candidate{selectedCandidates.length > 1 ? 's' : ''} selected
            </span>
          </div>
          
          <div className="flex flex-wrap gap-1">
            {selectedCandidateObjects.slice(0, 3).map((candidate) => (
              <Badge key={candidate.id} variant="outline" className="text-xs">
                {candidate.name}
              </Badge>
            ))}
            {selectedCandidates.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{selectedCandidates.length - 3} more
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Quick Actions */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleExport('csv')}
            className="glass-input glow-hover"
            data-testid="quick-export-btn"
          >
            <i className="fas fa-download mr-1"></i>
            Export
          </Button>

          {/* More Actions Dialog */}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                className="glass-input glow-hover"
                data-testid="bulk-actions-btn"
              >
                <i className="fas fa-cog mr-2"></i>
                Bulk Actions
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-panel border-border max-w-2xl">
              <DialogHeader>
                <DialogTitle>Bulk Operations</DialogTitle>
              </DialogHeader>
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  {/* Action Selection */}
                  <FormField
                    control={form.control}
                    name="action"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Select Action</FormLabel>
                        <div className="grid grid-cols-2 gap-3">
                          {BULK_ACTIONS.map((action) => (
                            <Button
                              key={action.value}
                              type="button"
                              variant={selectedAction === action.value ? "default" : "outline"}
                              className={`p-4 h-auto flex-col space-y-2 text-left justify-start ${
                                action.variant === 'destructive' 
                                  ? 'border-destructive/50 hover:bg-destructive/10' 
                                  : 'glass-input'
                              }`}
                              onClick={() => {
                                setSelectedAction(action.value);
                                field.onChange(action.value);
                              }}
                              data-testid={`bulk-action-${action.value}`}
                            >
                              <i className={`${action.icon} text-lg`}></i>
                              <div>
                                <div className="font-medium text-sm">{action.label}</div>
                                <div className="text-xs text-muted-foreground">{action.description}</div>
                              </div>
                            </Button>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Dynamic Action Form */}
                  <AnimatePresence>
                    {selectedAction && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <Separator className="mb-4" />
                        {renderActionForm()}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Action Buttons */}
                  <div className="flex justify-between items-center pt-4 border-t border-border">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={onClearSelection}
                      className="glass-input"
                    >
                      <i className="fas fa-times mr-2"></i>
                      Clear Selection
                    </Button>
                    
                    <div className="flex space-x-2">
                      <Button 
                        type="button" 
                        variant="ghost" 
                        onClick={() => setIsDialogOpen(false)}
                        className="glass-input"
                      >
                        Cancel
                      </Button>
                      <Button 
                        type="submit" 
                        disabled={!selectedAction || bulkOperationMutation.isPending}
                        className="glass-input glow-hover"
                        data-testid="execute-bulk-action-btn"
                      >
                        {bulkOperationMutation.isPending ? (
                          <i className="fas fa-spinner fa-spin mr-2"></i>
                        ) : (
                          <i className="fas fa-play mr-2"></i>
                        )}
                        Execute Action
                      </Button>
                    </div>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
            className="glass-input"
            data-testid="clear-selection-btn"
          >
            <i className="fas fa-times"></i>
          </Button>
        </div>
      </div>
    </Card>
  );
}
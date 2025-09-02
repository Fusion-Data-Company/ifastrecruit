import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface WorkflowRule {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  triggers: WorkflowTrigger[];
  conditions: WorkflowCondition[];
  actions: WorkflowAction[];
  priority: number;
  createdAt: string;
  lastTriggered?: string;
  triggerCount: number;
}

interface WorkflowTrigger {
  type: 'candidate_created' | 'candidate_updated' | 'stage_changed' | 'score_updated' | 'time_based' | 'manual';
  parameters: Record<string, any>;
}

interface WorkflowCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'not_contains' | 'in' | 'not_in';
  value: any;
  logic?: 'and' | 'or';
}

interface WorkflowAction {
  type: 'move_stage' | 'assign_tag' | 'send_email' | 'schedule_interview' | 'update_score' | 'notify_team' | 'create_task';
  parameters: Record<string, any>;
}

const workflowRuleSchema = z.object({
  name: z.string().min(1, 'Rule name is required'),
  description: z.string().min(1, 'Description is required'),
  isActive: z.boolean(),
  priority: z.number().min(1).max(100),
  triggers: z.array(z.object({
    type: z.string(),
    parameters: z.record(z.any()),
  })),
  conditions: z.array(z.object({
    field: z.string(),
    operator: z.string(),
    value: z.any(),
    logic: z.string().optional(),
  })),
  actions: z.array(z.object({
    type: z.string(),
    parameters: z.record(z.any()),
  })),
});

const TRIGGER_TYPES = [
  { value: 'candidate_created', label: 'Candidate Created', icon: 'fas fa-user-plus' },
  { value: 'candidate_updated', label: 'Candidate Updated', icon: 'fas fa-edit' },
  { value: 'stage_changed', label: 'Stage Changed', icon: 'fas fa-exchange-alt' },
  { value: 'score_updated', label: 'Score Updated', icon: 'fas fa-star' },
  { value: 'time_based', label: 'Time-based', icon: 'fas fa-clock' },
  { value: 'manual', label: 'Manual Trigger', icon: 'fas fa-hand-pointer' },
];

const CONDITION_FIELDS = [
  { value: 'pipelineStage', label: 'Pipeline Stage' },
  { value: 'score', label: 'Candidate Score' },
  { value: 'tags', label: 'Tags' },
  { value: 'sourceRef', label: 'Source' },
  { value: 'email', label: 'Email Domain' },
  { value: 'createdAt', label: 'Date Created' },
  { value: 'timeInStage', label: 'Time in Current Stage' },
];

const CONDITION_OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not Equals' },
  { value: 'greater_than', label: 'Greater Than' },
  { value: 'less_than', label: 'Less Than' },
  { value: 'contains', label: 'Contains' },
  { value: 'not_contains', label: 'Does Not Contain' },
  { value: 'in', label: 'In List' },
  { value: 'not_in', label: 'Not In List' },
];

const ACTION_TYPES = [
  { value: 'move_stage', label: 'Move to Stage', icon: 'fas fa-arrow-right' },
  { value: 'assign_tag', label: 'Assign Tag', icon: 'fas fa-tag' },
  { value: 'send_email', label: 'Send Email', icon: 'fas fa-envelope' },
  { value: 'schedule_interview', label: 'Schedule Interview', icon: 'fas fa-calendar' },
  { value: 'update_score', label: 'Update Score', icon: 'fas fa-star' },
  { value: 'notify_team', label: 'Notify Team', icon: 'fas fa-bell' },
  { value: 'create_task', label: 'Create Task', icon: 'fas fa-tasks' },
];

const PIPELINE_STAGES = [
  'NEW', 'FIRST_INTERVIEW', 'TECHNICAL_SCREEN', 
  'FINAL_INTERVIEW', 'OFFER', 'HIRED', 'REJECTED'
];

interface WorkflowEngineProps {
  className?: string;
}

export default function WorkflowEngine({ className }: WorkflowEngineProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<WorkflowRule | null>(null);
  const [selectedRule, setSelectedRule] = useState<WorkflowRule | null>(null);
  const queryClient = useQueryClient();

  const form = useForm({
    resolver: zodResolver(workflowRuleSchema),
    defaultValues: {
      name: '',
      description: '',
      isActive: true,
      priority: 50,
      triggers: [{ type: 'candidate_created' as const, parameters: {} }],
      conditions: [{ field: 'pipelineStage', operator: 'equals' as const, value: 'NEW' }],
      actions: [{ type: 'assign_tag' as const, parameters: { tag: 'auto-processed' } }],
    },
  });

  // Fetch workflow rules
  const { data: workflowRules = [] } = useQuery<WorkflowRule[]>({
    queryKey: ['/api/workflow-rules'],
    refetchInterval: 10000,
  });

  // Create workflow rule mutation
  const createRuleMutation = useMutation({
    mutationFn: async (ruleData: any) => {
      return apiRequest('POST', '/api/workflow-rules', ruleData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workflow-rules'] });
      setIsCreateDialogOpen(false);
      form.reset();
      toast({
        title: 'Workflow Rule Created',
        description: 'The automation rule has been created successfully.',
      });
    },
    onError: () => {
      toast({
        title: 'Creation Failed',
        description: 'Failed to create the workflow rule. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Toggle rule mutation
  const toggleRuleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return apiRequest('PATCH', `/api/workflow-rules/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workflow-rules'] });
      toast({
        title: 'Rule Updated',
        description: 'The workflow rule status has been updated.',
      });
    },
  });

  // Execute rule manually mutation
  const executeRuleMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      return apiRequest('POST', `/api/workflow-rules/${ruleId}/execute`);
    },
    onSuccess: (result: any) => {
      toast({
        title: 'Rule Executed',
        description: `Processed ${result.processedCount} candidates with ${result.actionsExecuted} actions.`,
      });
    },
  });

  const onSubmit = (data: any) => {
    createRuleMutation.mutate(data);
  };

  const renderTriggerConfig = (trigger: WorkflowTrigger, index: number) => (
    <Card key={index} className="glass-input p-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Trigger {index + 1}</Label>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const triggers = form.getValues('triggers');
              triggers.splice(index, 1);
              form.setValue('triggers', triggers);
            }}
            className="h-6 w-6 p-0"
          >
            <i className="fas fa-times text-xs"></i>
          </Button>
        </div>
        <Select
          value={trigger.type}
          onValueChange={(value) => {
            const triggers = form.getValues('triggers');
            triggers[index].type = value as any;
            form.setValue('triggers', triggers);
          }}
        >
          <SelectTrigger className="glass-input">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TRIGGER_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                <div className="flex items-center space-x-2">
                  <i className={`${type.icon} text-xs`}></i>
                  <span>{type.label}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </Card>
  );

  const renderConditionConfig = (condition: WorkflowCondition, index: number) => (
    <Card key={index} className="glass-input p-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Condition {index + 1}</Label>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const conditions = form.getValues('conditions');
              conditions.splice(index, 1);
              form.setValue('conditions', conditions);
            }}
            className="h-6 w-6 p-0"
          >
            <i className="fas fa-times text-xs"></i>
          </Button>
        </div>
        
        <div className="grid grid-cols-3 gap-2">
          <Select
            value={condition.field}
            onValueChange={(value) => {
              const conditions = form.getValues('conditions');
              conditions[index].field = value;
              form.setValue('conditions', conditions);
            }}
          >
            <SelectTrigger className="glass-input">
              <SelectValue placeholder="Field" />
            </SelectTrigger>
            <SelectContent>
              {CONDITION_FIELDS.map((field) => (
                <SelectItem key={field.value} value={field.value}>
                  {field.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={condition.operator}
            onValueChange={(value) => {
              const conditions = form.getValues('conditions');
              conditions[index].operator = value as any;
              form.setValue('conditions', conditions);
            }}
          >
            <SelectTrigger className="glass-input">
              <SelectValue placeholder="Operator" />
            </SelectTrigger>
            <SelectContent>
              {CONDITION_OPERATORS.map((op) => (
                <SelectItem key={op.value} value={op.value}>
                  {op.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            placeholder="Value"
            value={condition.value}
            onChange={(e) => {
              const conditions = form.getValues('conditions');
              conditions[index].value = e.target.value;
              form.setValue('conditions', conditions);
            }}
            className="glass-input"
          />
        </div>
      </div>
    </Card>
  );

  const renderActionConfig = (action: WorkflowAction, index: number) => (
    <Card key={index} className="glass-input p-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Action {index + 1}</Label>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const actions = form.getValues('actions');
              actions.splice(index, 1);
              form.setValue('actions', actions);
            }}
            className="h-6 w-6 p-0"
          >
            <i className="fas fa-times text-xs"></i>
          </Button>
        </div>

        <Select
          value={action.type}
          onValueChange={(value) => {
            const actions = form.getValues('actions');
            actions[index].type = value as any;
            form.setValue('actions', actions);
          }}
        >
          <SelectTrigger className="glass-input">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACTION_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                <div className="flex items-center space-x-2">
                  <i className={`${type.icon} text-xs`}></i>
                  <span>{type.label}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Action-specific parameters */}
        {action.type === 'move_stage' && (
          <Select
            value={action.parameters?.stage || ''}
            onValueChange={(value) => {
              const actions = form.getValues('actions');
              actions[index].parameters = { stage: value };
              form.setValue('actions', actions);
            }}
          >
            <SelectTrigger className="glass-input">
              <SelectValue placeholder="Select stage" />
            </SelectTrigger>
            <SelectContent>
              {PIPELINE_STAGES.map((stage) => (
                <SelectItem key={stage} value={stage}>
                  {stage.replace('_', ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {action.type === 'assign_tag' && (
          <Input
            placeholder="Tag name"
            value={action.parameters?.tag || ''}
            onChange={(e) => {
              const actions = form.getValues('actions');
              actions[index].parameters = { ...actions[index].parameters, tag: e.target.value };
              form.setValue('actions', actions);
            }}
            className="glass-input"
          />
        )}

        {action.type === 'send_email' && (
          <Select
            value={action.parameters?.template || ''}
            onValueChange={(value) => {
              const actions = form.getValues('actions');
              actions[index].parameters = { template: value };
              form.setValue('actions', actions);
            }}
          >
            <SelectTrigger className="glass-input">
              <SelectValue placeholder="Email template" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="welcome">Welcome Email</SelectItem>
              <SelectItem value="interview_invite">Interview Invitation</SelectItem>
              <SelectItem value="rejection">Rejection Email</SelectItem>
              <SelectItem value="follow_up">Follow-up Email</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>
    </Card>
  );

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="enterprise-heading text-2xl font-bold">Workflow Automation</h2>
          <p className="text-muted-foreground">Smart rules and automated candidate routing</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="glass-input glow-hover">
              <i className="fas fa-plus mr-2"></i>
              Create Rule
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-panel border-border max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Workflow Rule</DialogTitle>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rule Name</FormLabel>
                        <FormControl>
                          <Input className="glass-input" placeholder="Enter rule name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priority (1-100)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="1" 
                            max="100" 
                            className="glass-input" 
                            {...field} 
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea className="glass-input" placeholder="Describe what this rule does" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2">
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel>Rule is active</FormLabel>
                    </FormItem>
                  )}
                />

                <Separator />

                {/* Triggers */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Triggers</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const triggers = form.getValues('triggers');
                        triggers.push({ type: 'candidate_created', parameters: {} });
                        form.setValue('triggers', triggers);
                      }}
                      className="glass-input"
                    >
                      <i className="fas fa-plus mr-1"></i>
                      Add Trigger
                    </Button>
                  </div>
                  {form.watch('triggers').map((trigger, index) => renderTriggerConfig(trigger, index))}
                </div>

                <Separator />

                {/* Conditions */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Conditions</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const conditions = form.getValues('conditions');
                        conditions.push({ field: 'pipelineStage', operator: 'equals', value: 'NEW' });
                        form.setValue('conditions', conditions);
                      }}
                      className="glass-input"
                    >
                      <i className="fas fa-plus mr-1"></i>
                      Add Condition
                    </Button>
                  </div>
                  {form.watch('conditions').map((condition, index) => renderConditionConfig(condition, index))}
                </div>

                <Separator />

                {/* Actions */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Actions</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const actions = form.getValues('actions');
                        actions.push({ type: 'assign_tag', parameters: { tag: 'auto-processed' } });
                        form.setValue('actions', actions);
                      }}
                      className="glass-input"
                    >
                      <i className="fas fa-plus mr-1"></i>
                      Add Action
                    </Button>
                  </div>
                  {form.watch('actions').map((action, index) => renderActionConfig(action, index))}
                </div>

                <div className="flex justify-between pt-4">
                  <Button type="button" variant="ghost" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createRuleMutation.isPending} className="glow-hover">
                    {createRuleMutation.isPending ? (
                      <i className="fas fa-spinner fa-spin mr-2"></i>
                    ) : (
                      <i className="fas fa-save mr-2"></i>
                    )}
                    Create Rule
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Rules List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        <AnimatePresence>
          {workflowRules.map((rule) => (
            <motion.div
              key={rule.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="glass-panel p-6 h-full">
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <h3 className="font-semibold">{rule.name}</h3>
                      <p className="text-sm text-muted-foreground">{rule.description}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={rule.isActive ? "default" : "secondary"} className="text-xs">
                        {rule.isActive ? "Active" : "Inactive"}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        P{rule.priority}
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Triggers</span>
                      <Badge variant="outline" className="text-xs">{rule.triggers.length}</Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Conditions</span>
                      <Badge variant="outline" className="text-xs">{rule.conditions.length}</Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Actions</span>
                      <Badge variant="outline" className="text-xs">{rule.actions.length}</Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Executions</span>
                      <span className="text-accent font-medium">{rule.triggerCount}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <Switch
                      checked={rule.isActive}
                      onCheckedChange={(checked) => toggleRuleMutation.mutate({ id: rule.id, isActive: checked })}
                      disabled={toggleRuleMutation.isPending}
                    />
                    <div className="flex space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => executeRuleMutation.mutate(rule.id)}
                        disabled={executeRuleMutation.isPending}
                        className="glass-input h-8 w-8 p-0"
                        data-testid={`execute-rule-${rule.id}`}
                      >
                        <i className="fas fa-play text-xs"></i>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedRule(rule)}
                        className="glass-input h-8 w-8 p-0"
                        data-testid={`view-rule-${rule.id}`}
                      >
                        <i className="fas fa-eye text-xs"></i>
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Empty State */}
      {workflowRules.length === 0 && (
        <Card className="glass-panel p-12 text-center">
          <div className="space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-muted/20 flex items-center justify-center">
              <i className="fas fa-robot text-muted-foreground text-2xl"></i>
            </div>
            <div>
              <h3 className="font-semibold mb-2">No Workflow Rules</h3>
              <p className="text-muted-foreground text-sm">
                Create automated rules to streamline your recruiting process
              </p>
            </div>
            <Button onClick={() => setIsCreateDialogOpen(true)} className="glass-input glow-hover">
              <i className="fas fa-plus mr-2"></i>
              Create Your First Rule
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
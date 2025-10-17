import { useState, useCallback, useEffect } from "react";
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  NodeTypes,
  Connection,
  MarkerType,
  Panel
} from "reactflow";
import "reactflow/dist/style.css";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Play,
  Save,
  Plus,
  Trash2,
  Settings,
  GitBranch,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Pause,
  Copy,
  Download,
  Upload,
  Zap,
  MessageSquare,
  Calendar,
  Webhook,
  MousePointer,
  FileText,
  Mail,
  Database,
  Code,
  Timer,
  UserCheck,
  Users,
  RefreshCw
} from "lucide-react";

// Custom node component for workflow actions
const ActionNode = ({ data }: { data: any }) => {
  const getActionIcon = (type: string) => {
    switch (type) {
      case 'send_message': return <MessageSquare className="h-4 w-4" />;
      case 'create_task': return <CheckCircle className="h-4 w-4" />;
      case 'api_call': return <Code className="h-4 w-4" />;
      case 'database_update': return <Database className="h-4 w-4" />;
      case 'send_email': return <Mail className="h-4 w-4" />;
      case 'condition': return <GitBranch className="h-4 w-4" />;
      case 'delay': return <Timer className="h-4 w-4" />;
      case 'approval_request': return <UserCheck className="h-4 w-4" />;
      case 'assign_to_user': return <Users className="h-4 w-4" />;
      case 'update_candidate': return <FileText className="h-4 w-4" />;
      default: return <Zap className="h-4 w-4" />;
    }
  };

  return (
    <div className={`px-4 py-2 shadow-lg rounded-md border-2 ${data.selected ? 'border-primary' : 'border-gray-300'} bg-white`}>
      <div className="flex items-center gap-2">
        {getActionIcon(data.actionType)}
        <div>
          <div className="text-sm font-medium">{data.label}</div>
          {data.description && (
            <div className="text-xs text-gray-500">{data.description}</div>
          )}
        </div>
      </div>
      <div className="flex gap-1 mt-2">
        {data.status && (
          <Badge variant={data.status === 'completed' ? 'default' : data.status === 'failed' ? 'destructive' : 'secondary'}>
            {data.status}
          </Badge>
        )}
      </div>
    </div>
  );
};

// Custom trigger node
const TriggerNode = ({ data }: { data: any }) => {
  const getTriggerIcon = (type: string) => {
    switch (type) {
      case 'message': return <MessageSquare className="h-4 w-4" />;
      case 'schedule': return <Calendar className="h-4 w-4" />;
      case 'event': return <Zap className="h-4 w-4" />;
      case 'webhook': return <Webhook className="h-4 w-4" />;
      case 'manual': return <MousePointer className="h-4 w-4" />;
      case 'form_submission': return <FileText className="h-4 w-4" />;
      default: return <Zap className="h-4 w-4" />;
    }
  };

  return (
    <div className="px-4 py-2 shadow-lg rounded-md border-2 border-green-500 bg-green-50">
      <div className="flex items-center gap-2">
        {getTriggerIcon(data.triggerType)}
        <div>
          <div className="text-sm font-medium">Trigger: {data.label}</div>
          {data.description && (
            <div className="text-xs text-gray-500">{data.description}</div>
          )}
        </div>
      </div>
    </div>
  );
};

const nodeTypes: NodeTypes = {
  action: ActionNode,
  trigger: TriggerNode,
};

export default function WorkflowsPage() {
  const { toast } = useToast();
  const [selectedWorkflow, setSelectedWorkflow] = useState<any>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  
  const [newWorkflow, setNewWorkflow] = useState({
    name: "",
    description: "",
    triggerType: "manual",
    triggerConfig: {},
    actions: [],
    status: "draft",
  });

  // Fetch workflows
  const { data: workflows = [], isLoading: loadingWorkflows } = useQuery({
    queryKey: ["/api/workflows"],
  });

  // Fetch templates
  const { data: templates = [] } = useQuery({
    queryKey: ["/api/workflows/templates"],
  });

  // Fetch workflow runs for selected workflow
  const { data: workflowRuns = [] } = useQuery({
    queryKey: ["/api/workflows", selectedWorkflow?.id, "runs"],
    enabled: !!selectedWorkflow?.id,
  });

  // Create workflow mutation
  const createWorkflowMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/workflows", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflows"] });
      toast({ title: "Workflow created successfully" });
      setIsCreateDialogOpen(false);
      setNewWorkflow({
        name: "",
        description: "",
        triggerType: "manual",
        triggerConfig: {},
        actions: [],
        status: "draft",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create workflow",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update workflow mutation
  const updateWorkflowMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest(`/api/workflows/${id}`, "PUT", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflows"] });
      toast({ title: "Workflow updated successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update workflow",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Run workflow mutation
  const runWorkflowMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/workflows/${id}/run`, "POST", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflows", selectedWorkflow?.id, "runs"] });
      toast({ title: "Workflow started" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to run workflow",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete workflow mutation
  const deleteWorkflowMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/workflows/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflows"] });
      toast({ title: "Workflow deleted" });
      setSelectedWorkflow(null);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete workflow",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Create workflow from template
  const createFromTemplateMutation = useMutation({
    mutationFn: ({ templateId, data }: { templateId: string; data: any }) =>
      apiRequest(`/api/workflows/from-template/${templateId}`, "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflows"] });
      toast({ title: "Workflow created from template" });
      setIsTemplateDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create workflow from template",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Convert workflow to React Flow nodes and edges
  const convertWorkflowToFlow = useCallback((workflow: any) => {
    if (!workflow) return { nodes: [], edges: [] };

    const flowNodes: Node[] = [];
    const flowEdges: Edge[] = [];

    // Add trigger node
    flowNodes.push({
      id: 'trigger',
      type: 'trigger',
      position: { x: 250, y: 50 },
      data: {
        label: workflow.triggerType,
        triggerType: workflow.triggerType,
        description: getTriggerDescription(workflow.triggerType, workflow.triggerConfig),
      },
    });

    // Add action nodes
    const actions = workflow.actions || [];
    actions.forEach((action: any, index: number) => {
      const nodeId = `action-${index}`;
      flowNodes.push({
        id: nodeId,
        type: 'action',
        position: { x: 250, y: 150 + index * 100 },
        data: {
          label: action.type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
          actionType: action.type,
          description: getActionDescription(action.type, action.config),
          config: action.config,
        },
      });

      // Add edge from previous node
      const sourceId = index === 0 ? 'trigger' : `action-${index - 1}`;
      flowEdges.push({
        id: `${sourceId}-${nodeId}`,
        source: sourceId,
        target: nodeId,
        type: 'smoothstep',
        markerEnd: { type: MarkerType.ArrowClosed },
      });
    });

    return { nodes: flowNodes, edges: flowEdges };
  }, []);

  // Helper functions for descriptions
  const getTriggerDescription = (type: string, config: any) => {
    switch (type) {
      case 'message':
        return config.keyword ? `Keyword: "${config.keyword}"` : 'Any message';
      case 'schedule':
        return config.cronExpression || 'Scheduled';
      case 'event':
        return config.eventType || 'Event';
      case 'webhook':
        return config.webhookId || 'Webhook';
      case 'manual':
        return 'Manual trigger';
      case 'form_submission':
        return config.formId || 'Form submission';
      default:
        return '';
    }
  };

  const getActionDescription = (type: string, config: any) => {
    switch (type) {
      case 'send_message':
        return config.message ? `"${config.message.substring(0, 30)}..."` : '';
      case 'create_task':
        return config.taskDescription || 'Create task';
      case 'api_call':
        return config.url || 'API call';
      case 'send_email':
        return config.subject || 'Send email';
      case 'delay':
        return config.seconds ? `Wait ${config.seconds}s` : 'Delay';
      default:
        return '';
    }
  };

  // Load selected workflow into React Flow
  useEffect(() => {
    if (selectedWorkflow) {
      const { nodes: flowNodes, edges: flowEdges } = convertWorkflowToFlow(selectedWorkflow);
      setNodes(flowNodes);
      setEdges(flowEdges);
    }
  }, [selectedWorkflow, convertWorkflowToFlow, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  // Save workflow from React Flow
  const saveWorkflowFromFlow = useCallback(() => {
    if (!selectedWorkflow) return;

    // Convert flow back to workflow actions
    const actions = nodes
      .filter(node => node.type === 'action')
      .sort((a, b) => a.position.y - b.position.y)
      .map(node => ({
        type: node.data.actionType,
        config: node.data.config || {},
      }));

    updateWorkflowMutation.mutate({
      id: selectedWorkflow.id,
      data: { actions },
    });
  }, [nodes, selectedWorkflow, updateWorkflowMutation]);

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'completed': return 'default';
      case 'failed': return 'destructive';
      case 'running': return 'secondary';
      case 'paused': return 'outline';
      default: return 'secondary';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'failed': return <XCircle className="h-4 w-4" />;
      case 'running': return <RefreshCw className="h-4 w-4 animate-spin" />;
      case 'paused': return <Pause className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  return (
    <div className="flex h-screen" data-testid="workflows-page">
      {/* Sidebar with workflow list */}
      <div className="w-80 border-r bg-background p-4 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Workflows</h2>
          <Button onClick={() => setIsCreateDialogOpen(true)} size="sm" data-testid="button-create-workflow">
            <Plus className="h-4 w-4 mr-1" />
            New
          </Button>
        </div>

        <div className="mb-4">
          <Button
            onClick={() => setIsTemplateDialogOpen(true)}
            variant="outline"
            className="w-full"
            data-testid="button-browse-templates"
          >
            <FileText className="h-4 w-4 mr-2" />
            Browse Templates
          </Button>
        </div>

        <div className="space-y-2">
          {loadingWorkflows ? (
            <div className="text-sm text-muted-foreground">Loading workflows...</div>
          ) : workflows.length === 0 ? (
            <div className="text-sm text-muted-foreground">No workflows yet</div>
          ) : (
            workflows.map((workflow: any) => (
              <Card
                key={workflow.id}
                className={`cursor-pointer transition-colors ${
                  selectedWorkflow?.id === workflow.id ? 'border-primary' : ''
                }`}
                onClick={() => setSelectedWorkflow(workflow)}
                data-testid={`card-workflow-${workflow.id}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-base">{workflow.name}</CardTitle>
                      {workflow.description && (
                        <CardDescription className="text-xs mt-1">
                          {workflow.description}
                        </CardDescription>
                      )}
                    </div>
                    <Badge variant={workflow.status === 'active' ? 'default' : 'secondary'}>
                      {workflow.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className="text-xs">
                      {workflow.triggerType}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {workflow.actions?.length || 0} actions
                    </span>
                  </div>
                </CardHeader>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col">
        {selectedWorkflow ? (
          <>
            {/* Workflow header */}
            <div className="border-b p-4 bg-background">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold">{selectedWorkflow.name}</h1>
                  {selectedWorkflow.description && (
                    <p className="text-muted-foreground">{selectedWorkflow.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => runWorkflowMutation.mutate(selectedWorkflow.id)}
                    disabled={selectedWorkflow.status !== 'active'}
                    data-testid="button-run-workflow"
                  >
                    <Play className="h-4 w-4 mr-1" />
                    Run
                  </Button>
                  <Button
                    onClick={saveWorkflowFromFlow}
                    variant="outline"
                    data-testid="button-save-workflow"
                  >
                    <Save className="h-4 w-4 mr-1" />
                    Save
                  </Button>
                  <Button
                    onClick={() => setIsEditDialogOpen(true)}
                    variant="outline"
                    data-testid="button-edit-workflow"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                  <Button
                    onClick={() => {
                      if (confirm('Are you sure you want to delete this workflow?')) {
                        deleteWorkflowMutation.mutate(selectedWorkflow.id);
                      }
                    }}
                    variant="outline"
                    data-testid="button-delete-workflow"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Tabs for workflow editor and runs */}
            <Tabs defaultValue="editor" className="flex-1 flex flex-col">
              <TabsList className="mx-4 mt-4 w-fit">
                <TabsTrigger value="editor">Editor</TabsTrigger>
                <TabsTrigger value="runs">Execution History</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>

              <TabsContent value="editor" className="flex-1 m-0">
                <div className="h-full">
                  <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    nodeTypes={nodeTypes}
                    fitView
                  >
                    <Background />
                    <Controls />
                    <MiniMap />
                    <Panel position="top-left">
                      <div className="bg-background/80 backdrop-blur p-2 rounded border">
                        <p className="text-xs text-muted-foreground">
                          Drag to pan • Scroll to zoom • Click nodes to select
                        </p>
                      </div>
                    </Panel>
                  </ReactFlow>
                </div>
              </TabsContent>

              <TabsContent value="runs" className="flex-1 p-4 overflow-y-auto">
                <div className="space-y-2">
                  {workflowRuns.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      No execution history yet
                    </div>
                  ) : (
                    workflowRuns.map((run: any) => (
                      <Card key={run.id} data-testid={`card-run-${run.id}`}>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {getStatusIcon(run.status)}
                              <Badge variant={getStatusBadgeVariant(run.status)}>
                                {run.status}
                              </Badge>
                              <span className="text-sm text-muted-foreground">
                                {new Date(run.createdAt).toLocaleString()}
                              </span>
                            </div>
                            {run.completedAt && (
                              <span className="text-xs text-muted-foreground">
                                Duration: {Math.round((new Date(run.completedAt).getTime() - new Date(run.startedAt || run.createdAt).getTime()) / 1000)}s
                              </span>
                            )}
                          </div>
                          {run.errorMessage && (
                            <div className="mt-2 p-2 bg-destructive/10 rounded text-sm text-destructive">
                              {run.errorMessage}
                            </div>
                          )}
                        </CardHeader>
                      </Card>
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="settings" className="flex-1 p-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Workflow Settings</CardTitle>
                    <CardDescription>
                      Configure workflow properties and behavior
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>Status</Label>
                      <Select
                        value={selectedWorkflow.status}
                        onValueChange={(value) => {
                          updateWorkflowMutation.mutate({
                            id: selectedWorkflow.id,
                            data: { status: value },
                          });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="archived">Archived</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Version</Label>
                      <p className="text-sm text-muted-foreground">
                        Version {selectedWorkflow.version}
                      </p>
                    </div>

                    <div>
                      <Label>Created By</Label>
                      <p className="text-sm text-muted-foreground">
                        {selectedWorkflow.createdBy}
                      </p>
                    </div>

                    <div>
                      <Label>Created At</Label>
                      <p className="text-sm text-muted-foreground">
                        {new Date(selectedWorkflow.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <GitBranch className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">No workflow selected</h2>
              <p className="text-muted-foreground mb-4">
                Select a workflow from the sidebar or create a new one
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-create-first-workflow">
                <Plus className="h-4 w-4 mr-2" />
                Create Workflow
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Create Workflow Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Workflow</DialogTitle>
            <DialogDescription>
              Set up a new automation workflow
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="workflow-name">Name</Label>
              <Input
                id="workflow-name"
                value={newWorkflow.name}
                onChange={(e) =>
                  setNewWorkflow({ ...newWorkflow, name: e.target.value })
                }
                placeholder="My Workflow"
                data-testid="input-workflow-name"
              />
            </div>
            <div>
              <Label htmlFor="workflow-description">Description</Label>
              <Textarea
                id="workflow-description"
                value={newWorkflow.description}
                onChange={(e) =>
                  setNewWorkflow({ ...newWorkflow, description: e.target.value })
                }
                placeholder="Describe what this workflow does..."
                data-testid="input-workflow-description"
              />
            </div>
            <div>
              <Label htmlFor="workflow-trigger">Trigger Type</Label>
              <Select
                value={newWorkflow.triggerType}
                onValueChange={(value) =>
                  setNewWorkflow({ ...newWorkflow, triggerType: value })
                }
              >
                <SelectTrigger id="workflow-trigger">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="message">Message</SelectItem>
                  <SelectItem value="schedule">Schedule</SelectItem>
                  <SelectItem value="event">Event</SelectItem>
                  <SelectItem value="webhook">Webhook</SelectItem>
                  <SelectItem value="form_submission">Form Submission</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => createWorkflowMutation.mutate(newWorkflow)}
              disabled={!newWorkflow.name}
              data-testid="button-confirm-create-workflow"
            >
              Create Workflow
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Browser Dialog */}
      <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Workflow Templates</DialogTitle>
            <DialogDescription>
              Start with a pre-built template to get up and running quickly
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2 mt-4">
            {templates.map((template: any) => (
              <Card
                key={template.id}
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => setSelectedTemplate(template)}
                data-testid={`card-template-${template.id}`}
              >
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    {template.name}
                  </CardTitle>
                  <CardDescription>{template.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1">
                    {template.tags?.map((tag: string) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          {selectedTemplate && (
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setSelectedTemplate(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  const name = prompt('Workflow name:', selectedTemplate.name);
                  if (name) {
                    createFromTemplateMutation.mutate({
                      templateId: selectedTemplate.id,
                      data: { name },
                    });
                  }
                }}
                data-testid="button-use-template"
              >
                Use This Template
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Workflow Dialog */}
      {selectedWorkflow && (
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Workflow</DialogTitle>
              <DialogDescription>
                Update workflow settings
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-workflow-name">Name</Label>
                <Input
                  id="edit-workflow-name"
                  value={selectedWorkflow.name}
                  onChange={(e) =>
                    setSelectedWorkflow({ ...selectedWorkflow, name: e.target.value })
                  }
                  data-testid="input-edit-workflow-name"
                />
              </div>
              <div>
                <Label htmlFor="edit-workflow-description">Description</Label>
                <Textarea
                  id="edit-workflow-description"
                  value={selectedWorkflow.description || ''}
                  onChange={(e) =>
                    setSelectedWorkflow({ ...selectedWorkflow, description: e.target.value })
                  }
                  data-testid="input-edit-workflow-description"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  updateWorkflowMutation.mutate({
                    id: selectedWorkflow.id,
                    data: {
                      name: selectedWorkflow.name,
                      description: selectedWorkflow.description,
                    },
                  });
                  setIsEditDialogOpen(false);
                }}
                data-testid="button-save-workflow-settings"
              >
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
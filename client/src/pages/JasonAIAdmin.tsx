import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Bot, Settings, MessageSquare, Activity, Plus, Edit, Trash2, Save, RefreshCw, TestTube, Sparkles } from 'lucide-react';
import type { JasonSetting, JasonTemplate, JasonChannelBehavior, Channel } from '@shared/schema';

interface PersonaSettings {
  systemPrompt: string;
  personality: {
    professional: boolean;
    encouraging: boolean;
    technical: boolean;
    casual: boolean;
  };
  speakingStyle: {
    formality: number;
    enthusiasm: number;
    detailLevel: number;
  };
  background: string;
}

export default function JasonAIAdmin() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('persona');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewText, setPreviewText] = useState('');
  const [previewResponse, setPreviewResponse] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  
  // State for persona settings
  const [personaSettings, setPersonaSettings] = useState<PersonaSettings>({
    systemPrompt: '',
    personality: {
      professional: true,
      encouraging: true,
      technical: false,
      casual: false
    },
    speakingStyle: {
      formality: 50,
      enthusiasm: 70,
      detailLevel: 60
    },
    background: ''
  });

  // State for template editing
  const [editingTemplate, setEditingTemplate] = useState<JasonTemplate | null>(null);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);

  // Fetch Jason settings
  const { data: settings = [], isLoading: settingsLoading } = useQuery<JasonSetting[]>({
    queryKey: ['/api/admin/jason/settings'],
    enabled: true
  });

  // Fetch templates
  const { data: templates = [], isLoading: templatesLoading } = useQuery<JasonTemplate[]>({
    queryKey: ['/api/admin/jason/templates'],
    enabled: true
  });

  // Fetch channel behaviors
  const { data: channelBehaviors = [], isLoading: behaviorsLoading } = useQuery<JasonChannelBehavior[]>({
    queryKey: ['/api/admin/jason/channel-behaviors'],
    enabled: true
  });

  // Fetch channels
  const { data: channels = [] } = useQuery<Channel[]>({
    queryKey: ['/api/channels'],
    enabled: true
  });

  // Load settings into state
  useEffect(() => {
    if (settings.length > 0) {
      const systemPromptSetting = settings.find(s => s.settingKey === 'systemPrompt');
      const personalitySetting = settings.find(s => s.settingKey === 'personality');
      const speakingStyleSetting = settings.find(s => s.settingKey === 'speakingStyle');
      const backgroundSetting = settings.find(s => s.settingKey === 'background');

      setPersonaSettings(prev => ({
        systemPrompt: systemPromptSetting?.settingValue as string || prev.systemPrompt,
        personality: personalitySetting?.settingValue as any || prev.personality,
        speakingStyle: speakingStyleSetting?.settingValue as any || prev.speakingStyle,
        background: backgroundSetting?.settingValue as string || prev.background
      }));
    }
  }, [settings]);

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (data: { settingKey: string; settingValue: any; category: string }) => {
      return apiRequest('/api/admin/jason/settings', {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/jason/settings'] });
      toast({
        title: 'Settings Updated',
        description: 'Jason AI settings have been saved successfully.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update settings. Please try again.',
        variant: 'destructive',
      });
    }
  });

  // Create template mutation
  const createTemplateMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('/api/admin/jason/templates', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/jason/templates'] });
      setIsTemplateDialogOpen(false);
      setEditingTemplate(null);
      toast({
        title: 'Template Created',
        description: 'New template has been added successfully.',
      });
    }
  });

  // Update template mutation
  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      return apiRequest(`/api/admin/jason/templates/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/jason/templates'] });
      setIsTemplateDialogOpen(false);
      setEditingTemplate(null);
      toast({
        title: 'Template Updated',
        description: 'Template has been updated successfully.',
      });
    }
  });

  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/admin/jason/templates/${id}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/jason/templates'] });
      toast({
        title: 'Template Deleted',
        description: 'Template has been deleted successfully.',
      });
    }
  });

  // Update channel behavior mutation
  const updateChannelBehaviorMutation = useMutation({
    mutationFn: async ({ channelId, ...data }: any) => {
      return apiRequest(`/api/admin/jason/channel-behaviors/${channelId}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/jason/channel-behaviors'] });
      toast({
        title: 'Channel Behavior Updated',
        description: 'Channel behavior settings have been saved.',
      });
    }
  });

  const savePersonaSettings = async () => {
    await Promise.all([
      updateSettingsMutation.mutateAsync({
        settingKey: 'systemPrompt',
        settingValue: personaSettings.systemPrompt,
        category: 'persona'
      }),
      updateSettingsMutation.mutateAsync({
        settingKey: 'personality',
        settingValue: personaSettings.personality,
        category: 'persona'
      }),
      updateSettingsMutation.mutateAsync({
        settingKey: 'speakingStyle',
        settingValue: personaSettings.speakingStyle,
        category: 'persona'
      }),
      updateSettingsMutation.mutateAsync({
        settingKey: 'background',
        settingValue: personaSettings.background,
        category: 'persona'
      })
    ]);
  };

  const testJasonResponse = async () => {
    setIsGenerating(true);
    // Simulate AI response generation
    setTimeout(() => {
      setPreviewResponse("Based on your current settings, here's how Jason would respond: 'Welcome to iFast Recruit! I'm Jason Perez, and I'm thrilled to help you on your insurance career journey. With the right guidance and dedication, you can build an incredible future in this industry!'");
      setIsGenerating(false);
    }, 2000);
  };

  const getChannelBehavior = (channelId: string) => {
    return channelBehaviors.find(b => b.channelId === channelId) || {
      isActive: true,
      responseFrequency: 'sometimes' as const,
      autoResponseTriggers: []
    };
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Header */}
        <div className="glass-panel p-6 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 rounded-full bg-primary/10 border border-primary/20">
                <Bot className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold enterprise-heading">Jason AI Configuration</h1>
                <p className="text-muted-foreground">Configure Jason Perez's personality, responses, and behaviors</p>
              </div>
            </div>
            <Button
              onClick={() => setIsPreviewOpen(true)}
              className="glass-button"
              data-testid="preview-jason-button"
            >
              <TestTube className="mr-2 h-4 w-4" />
              Test Jason
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="glass-panel p-1 grid w-full grid-cols-3">
            <TabsTrigger value="persona" className="data-[state=active]:bg-primary/10">
              <Settings className="mr-2 h-4 w-4" />
              Persona Settings
            </TabsTrigger>
            <TabsTrigger value="templates" className="data-[state=active]:bg-primary/10">
              <MessageSquare className="mr-2 h-4 w-4" />
              Response Templates
            </TabsTrigger>
            <TabsTrigger value="behaviors" className="data-[state=active]:bg-primary/10">
              <Activity className="mr-2 h-4 w-4" />
              Channel Behaviors
            </TabsTrigger>
          </TabsList>

          {/* Persona Settings Tab */}
          <TabsContent value="persona" className="space-y-6">
            <Card className="glass-panel">
              <CardHeader>
                <CardTitle>System Prompt</CardTitle>
                <CardDescription>Define Jason's core personality and knowledge base</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={personaSettings.systemPrompt}
                  onChange={(e) => setPersonaSettings(prev => ({ ...prev, systemPrompt: e.target.value }))}
                  placeholder="Enter Jason's system prompt..."
                  className="min-h-[200px] glass-input"
                  data-testid="system-prompt-textarea"
                />
              </CardContent>
            </Card>

            <Card className="glass-panel">
              <CardHeader>
                <CardTitle>Personality Traits</CardTitle>
                <CardDescription>Select Jason's personality characteristics</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                {Object.entries(personaSettings.personality).map(([trait, enabled]) => (
                  <div key={trait} className="flex items-center space-x-3">
                    <Checkbox
                      id={trait}
                      checked={enabled}
                      onCheckedChange={(checked) => 
                        setPersonaSettings(prev => ({
                          ...prev,
                          personality: { ...prev.personality, [trait]: checked as boolean }
                        }))
                      }
                      data-testid={`trait-${trait}`}
                    />
                    <Label htmlFor={trait} className="capitalize cursor-pointer">
                      {trait}
                    </Label>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="glass-panel">
              <CardHeader>
                <CardTitle>Speaking Style</CardTitle>
                <CardDescription>Adjust Jason's communication style parameters</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Formality Level</Label>
                    <span className="text-sm text-muted-foreground">{personaSettings.speakingStyle.formality}%</span>
                  </div>
                  <Slider
                    value={[personaSettings.speakingStyle.formality]}
                    onValueChange={([value]) => 
                      setPersonaSettings(prev => ({
                        ...prev,
                        speakingStyle: { ...prev.speakingStyle, formality: value }
                      }))
                    }
                    max={100}
                    step={1}
                    className="w-full"
                    data-testid="formality-slider"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Enthusiasm Level</Label>
                    <span className="text-sm text-muted-foreground">{personaSettings.speakingStyle.enthusiasm}%</span>
                  </div>
                  <Slider
                    value={[personaSettings.speakingStyle.enthusiasm]}
                    onValueChange={([value]) => 
                      setPersonaSettings(prev => ({
                        ...prev,
                        speakingStyle: { ...prev.speakingStyle, enthusiasm: value }
                      }))
                    }
                    max={100}
                    step={1}
                    className="w-full"
                    data-testid="enthusiasm-slider"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Detail Level</Label>
                    <span className="text-sm text-muted-foreground">{personaSettings.speakingStyle.detailLevel}%</span>
                  </div>
                  <Slider
                    value={[personaSettings.speakingStyle.detailLevel]}
                    onValueChange={([value]) => 
                      setPersonaSettings(prev => ({
                        ...prev,
                        speakingStyle: { ...prev.speakingStyle, detailLevel: value }
                      }))
                    }
                    max={100}
                    step={1}
                    className="w-full"
                    data-testid="detail-slider"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="glass-panel">
              <CardHeader>
                <CardTitle>Background & Experience</CardTitle>
                <CardDescription>Define Jason's professional background and expertise</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={personaSettings.background}
                  onChange={(e) => setPersonaSettings(prev => ({ ...prev, background: e.target.value }))}
                  placeholder="Enter Jason's background story and experience..."
                  className="min-h-[150px] glass-input"
                  data-testid="background-textarea"
                />
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={savePersonaSettings} className="glass-button" data-testid="save-persona-button">
                <Save className="mr-2 h-4 w-4" />
                Save Persona Settings
              </Button>
            </div>
          </TabsContent>

          {/* Response Templates Tab */}
          <TabsContent value="templates" className="space-y-6">
            <Card className="glass-panel">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Response Templates</CardTitle>
                    <CardDescription>Manage pre-configured responses for common scenarios</CardDescription>
                  </div>
                  <Button 
                    onClick={() => {
                      setEditingTemplate({} as JasonTemplate);
                      setIsTemplateDialogOpen(true);
                    }}
                    className="glass-button"
                    data-testid="add-template-button"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Template
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-4">
                    {templates.map((template) => (
                      <motion.div
                        key={template.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="glass-panel p-4 rounded-lg space-y-3"
                      >
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <h4 className="font-semibold">{template.templateName}</h4>
                            <div className="flex gap-2">
                              <Badge variant="outline">{template.templateType}</Badge>
                              {template.channelTier && (
                                <Badge variant="secondary">{template.channelTier}</Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingTemplate(template);
                                setIsTemplateDialogOpen(true);
                              }}
                              data-testid={`edit-template-${template.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteTemplateMutation.mutate(template.id)}
                              data-testid={`delete-template-${template.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {template.template}
                        </p>
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Channel Behaviors Tab */}
          <TabsContent value="behaviors" className="space-y-6">
            <Card className="glass-panel">
              <CardHeader>
                <CardTitle>Channel-Specific Behaviors</CardTitle>
                <CardDescription>Configure how Jason behaves in each channel</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {channels.map((channel) => {
                    const behavior = getChannelBehavior(channel.id);
                    return (
                      <div key={channel.id} className="glass-panel p-4 rounded-lg space-y-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <h4 className="font-semibold">{channel.name}</h4>
                            <p className="text-sm text-muted-foreground">{channel.description}</p>
                          </div>
                          <Switch
                            checked={behavior.isActive}
                            onCheckedChange={(checked) => 
                              updateChannelBehaviorMutation.mutate({
                                channelId: channel.id,
                                isActive: checked,
                                responseFrequency: behavior.responseFrequency,
                                autoResponseTriggers: behavior.autoResponseTriggers
                              })
                            }
                            data-testid={`channel-active-${channel.id}`}
                          />
                        </div>

                        {behavior.isActive && (
                          <>
                            <Separator />
                            <div className="space-y-3">
                              <div>
                                <Label>Response Frequency</Label>
                                <Select
                                  value={behavior.responseFrequency}
                                  onValueChange={(value) => 
                                    updateChannelBehaviorMutation.mutate({
                                      channelId: channel.id,
                                      isActive: behavior.isActive,
                                      responseFrequency: value,
                                      autoResponseTriggers: behavior.autoResponseTriggers
                                    })
                                  }
                                >
                                  <SelectTrigger className="glass-input" data-testid={`frequency-${channel.id}`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="always">Always Respond</SelectItem>
                                    <SelectItem value="sometimes">Sometimes Respond</SelectItem>
                                    <SelectItem value="only_when_mentioned">Only When Mentioned</SelectItem>
                                    <SelectItem value="never">Never Respond</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <div>
                                <Label>Auto-Response Triggers</Label>
                                <div className="grid grid-cols-2 gap-2 mt-2">
                                  {['new_user_joins', 'resume_uploaded', 'question_asked', 'milestone_reached'].map((trigger) => (
                                    <div key={trigger} className="flex items-center space-x-2">
                                      <Checkbox
                                        id={`${channel.id}-${trigger}`}
                                        checked={behavior.autoResponseTriggers?.includes(trigger) || false}
                                        onCheckedChange={(checked) => {
                                          const triggers = behavior.autoResponseTriggers || [];
                                          const newTriggers = checked
                                            ? [...triggers, trigger]
                                            : triggers.filter(t => t !== trigger);
                                          updateChannelBehaviorMutation.mutate({
                                            channelId: channel.id,
                                            isActive: behavior.isActive,
                                            responseFrequency: behavior.responseFrequency,
                                            autoResponseTriggers: newTriggers
                                          });
                                        }}
                                        data-testid={`trigger-${channel.id}-${trigger}`}
                                      />
                                      <Label 
                                        htmlFor={`${channel.id}-${trigger}`}
                                        className="text-sm cursor-pointer"
                                      >
                                        {trigger.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                      </Label>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>

      {/* Template Dialog */}
      <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
        <DialogContent className="glass-panel max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate?.id ? 'Edit Template' : 'Create New Template'}
            </DialogTitle>
            <DialogDescription>
              Create or edit a response template for Jason AI
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Template Name</Label>
              <Input
                value={editingTemplate?.templateName || ''}
                onChange={(e) => setEditingTemplate(prev => ({ ...prev!, templateName: e.target.value }))}
                placeholder="e.g., Welcome Message for New Users"
                className="glass-input"
                data-testid="template-name-input"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Template Type</Label>
                <Select
                  value={editingTemplate?.templateType || ''}
                  onValueChange={(value) => setEditingTemplate(prev => ({ ...prev!, templateType: value as any }))}
                >
                  <SelectTrigger className="glass-input" data-testid="template-type-select">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="welcome">Welcome</SelectItem>
                    <SelectItem value="qa">Q&A</SelectItem>
                    <SelectItem value="resume">Resume Feedback</SelectItem>
                    <SelectItem value="career">Career Guidance</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Channel Tier (Optional)</Label>
                <Select
                  value={editingTemplate?.channelTier || 'all'}
                  onValueChange={(value) => setEditingTemplate(prev => ({ 
                    ...prev!, 
                    channelTier: value === 'all' ? undefined : value as any 
                  }))}
                >
                  <SelectTrigger className="glass-input" data-testid="channel-tier-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Channels</SelectItem>
                    <SelectItem value="NON_LICENSED">Non-Licensed</SelectItem>
                    <SelectItem value="FL_LICENSED">FL Licensed</SelectItem>
                    <SelectItem value="MULTI_STATE">Multi-State</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Template Content</Label>
              <Textarea
                value={editingTemplate?.template || ''}
                onChange={(e) => setEditingTemplate(prev => ({ ...prev!, template: e.target.value }))}
                placeholder="Enter the template content. Use {{variables}} for dynamic content."
                className="min-h-[150px] glass-input"
                data-testid="template-content-textarea"
              />
            </div>

            <div>
              <Label>Variables (comma-separated)</Label>
              <Input
                value={editingTemplate?.variables?.join(', ') || ''}
                onChange={(e) => setEditingTemplate(prev => ({ 
                  ...prev!, 
                  variables: e.target.value.split(',').map(v => v.trim()).filter(Boolean)
                }))}
                placeholder="e.g., userName, channelName, date"
                className="glass-input"
                data-testid="template-variables-input"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsTemplateDialogOpen(false);
                setEditingTemplate(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (editingTemplate?.id) {
                  updateTemplateMutation.mutate(editingTemplate);
                } else {
                  createTemplateMutation.mutate(editingTemplate);
                }
              }}
              className="glass-button"
              data-testid="save-template-button"
            >
              {editingTemplate?.id ? 'Update' : 'Create'} Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="glass-panel max-w-2xl">
          <DialogHeader>
            <DialogTitle>Test Jason AI Response</DialogTitle>
            <DialogDescription>
              See how Jason would respond with current settings
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Test Message</Label>
              <Textarea
                value={previewText}
                onChange={(e) => setPreviewText(e.target.value)}
                placeholder="Enter a test message or question..."
                className="min-h-[100px] glass-input"
                data-testid="preview-input"
              />
            </div>

            {previewResponse && (
              <div className="glass-panel p-4 rounded-lg">
                <div className="flex items-start space-x-3">
                  <div className="p-2 rounded-full bg-primary/10">
                    <Sparkles className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm mb-1">Jason AI Response:</p>
                    <p className="text-sm text-muted-foreground">{previewResponse}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsPreviewOpen(false)}
            >
              Close
            </Button>
            <Button
              onClick={testJasonResponse}
              disabled={!previewText || isGenerating}
              className="glass-button"
              data-testid="generate-preview-button"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <TestTube className="mr-2 h-4 w-4" />
                  Generate Response
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  content: string;
  type: 'welcome' | 'interview_invite' | 'rejection' | 'follow_up';
  createdAt: string;
}

interface EmailLog {
  id: string;
  to: string;
  subject: string;
  template: string;
  status: 'sent' | 'failed' | 'pending';
  sentAt: string;
}

export default function EmailStudioPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('compose');
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    subject: '',
    content: '',
    type: 'welcome' as const,
  });

  // Mock data - replace with actual API calls
  const { data: templates = [] } = useQuery<EmailTemplate[]>({
    queryKey: ['/api/email/templates'],
    enabled: false, // Disable until API exists
  });

  const { data: emailLogs = [] } = useQuery<EmailLog[]>({
    queryKey: ['/api/email/logs'],
    enabled: false, // Disable until API exists
  });

  const sendEmailMutation = useMutation({
    mutationFn: async (emailData: { to: string; subject: string; content: string; template?: string }) => {
      return await apiRequest('/api/email/send', 'POST', emailData);
    },
    onSuccess: () => {
      toast({
        title: "Email Sent",
        description: "Your email has been sent successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/email/logs'] });
    },
    onError: () => {
      toast({
        title: "Send Failed",
        description: "Failed to send email. Please try again.",
        variant: "destructive",
      });
    },
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (template: typeof newTemplate) => {
      return await apiRequest('/api/email/templates', 'POST', template);
    },
    onSuccess: () => {
      toast({
        title: "Template Created",
        description: "Email template has been created successfully",
      });
      setNewTemplate({ name: '', subject: '', content: '', type: 'welcome' });
      queryClient.invalidateQueries({ queryKey: ['/api/email/templates'] });
    },
    onError: () => {
      toast({
        title: "Creation Failed",
        description: "Failed to create template. Please try again.",
        variant: "destructive",
      });
    },
  });

  const getTemplateTypeColor = (type: string) => {
    switch (type) {
      case 'welcome': return 'bg-green-500/20 text-green-500';
      case 'interview_invite': return 'bg-blue-500/20 text-blue-500';
      case 'rejection': return 'bg-red-500/20 text-red-500';
      case 'follow_up': return 'bg-orange-500/20 text-orange-500';
      default: return 'bg-gray-500/20 text-gray-500';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent': return 'bg-green-500/20 text-green-500';
      case 'failed': return 'bg-red-500/20 text-red-500';
      case 'pending': return 'bg-orange-500/20 text-orange-500';
      default: return 'bg-gray-500/20 text-gray-500';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <TopBar />
      <main className="ml-64 pt-16 p-6">
      <div className="space-y-6">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="enterprise-heading text-3xl font-bold">Email Studio</h1>
            <p className="text-muted-foreground">Create, manage, and send personalized emails</p>
          </div>
          <Button className="bg-primary hover:bg-primary/90" data-testid="new-template">
            <i className="fas fa-plus mr-2"></i>
            New Template
          </Button>
        </motion.div>

        {/* Stats Cards */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-4 gap-6"
        >
          <Card className="glass-panel">
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <i className="fas fa-envelope text-blue-500"></i>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Emails Sent Today</p>
                  <p className="text-2xl font-bold">24</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-panel">
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <i className="fas fa-check text-green-500"></i>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Delivery Rate</p>
                  <p className="text-2xl font-bold">98%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-panel">
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <i className="fas fa-template text-purple-500"></i>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Templates</p>
                  <p className="text-2xl font-bold">{templates.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-panel">
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-orange-500/20 rounded-lg">
                  <i className="fas fa-eye text-orange-500"></i>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Open Rate</p>
                  <p className="text-2xl font-bold">76%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Main Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="glass-panel mb-6">
              <TabsTrigger value="compose">Compose Email</TabsTrigger>
              <TabsTrigger value="templates">Templates</TabsTrigger>
              <TabsTrigger value="logs">Email Logs</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="compose">
              <Card className="glass-panel">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <i className="fas fa-edit"></i>
                    <span>Compose New Email</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">To</label>
                      <Input 
                        placeholder="recipient@example.com" 
                        className="glass-input"
                        data-testid="email-to"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Template</label>
                      <Select>
                        <SelectTrigger className="glass-input">
                          <SelectValue placeholder="Select template (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="custom">Custom Email</SelectItem>
                          {(templates || []).map(template => (
                            <SelectItem key={template.id} value={template.id}>
                              {template.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Subject</label>
                    <Input 
                      placeholder="Email subject" 
                      className="glass-input"
                      data-testid="email-subject"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Content</label>
                    <Textarea 
                      placeholder="Write your email content here..."
                      className="glass-input min-h-[200px]"
                      data-testid="email-content"
                    />
                  </div>

                  <div className="flex justify-end space-x-3">
                    <Button variant="outline" className="glass-input">
                      <i className="fas fa-eye mr-2"></i>
                      Preview
                    </Button>
                    <Button 
                      className="bg-primary hover:bg-primary/90"
                      data-testid="send-email"
                    >
                      <i className="fas fa-paper-plane mr-2"></i>
                      Send Email
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="templates">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {templates.length === 0 ? (
                  <Card className="glass-panel col-span-2">
                    <CardContent className="p-12 text-center">
                      <i className="fas fa-template text-4xl text-muted-foreground mb-4"></i>
                      <p className="text-muted-foreground">No email templates found</p>
                      <p className="text-sm text-muted-foreground mt-1">Create your first template to get started</p>
                    </CardContent>
                  </Card>
                ) : (
                  (templates || []).map((template) => (
                    <motion.div
                      key={template.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                    >
                      <Card className="glass-panel hover:bg-muted/5 micro-animation">
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">{template.name}</CardTitle>
                            <Badge className={getTemplateTypeColor(template.type)}>
                              {template.type.replace('_', ' ')}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{template.subject}</p>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                            {template.content}
                          </p>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-muted-foreground">
                              Created {new Date(template.createdAt).toLocaleDateString()}
                            </span>
                            <div className="flex space-x-2">
                              <Button variant="ghost" size="sm">
                                <i className="fas fa-edit"></i>
                              </Button>
                              <Button variant="ghost" size="sm">
                                <i className="fas fa-copy"></i>
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="logs">
              <Card className="glass-panel">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <i className="fas fa-history"></i>
                    <span>Email Activity Log</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {emailLogs.length === 0 ? (
                    <div className="text-center py-8">
                      <i className="fas fa-inbox text-4xl text-muted-foreground mb-4"></i>
                      <p className="text-muted-foreground">No email logs found</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {(emailLogs || []).map((log) => (
                        <motion.div
                          key={log.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="flex items-center justify-between p-4 border border-border rounded-lg"
                        >
                          <div className="flex items-center space-x-4">
                            <i className="fas fa-envelope text-muted-foreground"></i>
                            <div>
                              <p className="font-medium">{log.subject}</p>
                              <p className="text-sm text-muted-foreground">{log.to}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-3">
                            <Badge className={getStatusColor(log.status)}>
                              {log.status}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(log.sentAt).toLocaleString()}
                            </span>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="settings">
              <Card className="glass-panel">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <i className="fas fa-cog"></i>
                    <span>Email Configuration</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium mb-4">SMTP Settings</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block">SMTP Host</label>
                        <Input placeholder="smtp.mailjet.com" className="glass-input" disabled />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">Port</label>
                        <Input placeholder="587" className="glass-input" disabled />
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium mb-4">Default Settings</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block">From Name</label>
                        <Input placeholder="iFast Broker" className="glass-input" />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">From Email</label>
                        <Input placeholder="noreply@ifastbroker.com" className="glass-input" />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button className="bg-primary hover:bg-primary/90">
                      <i className="fas fa-save mr-2"></i>
                      Save Settings
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
      </main>
    </div>
  );
}
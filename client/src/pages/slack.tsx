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
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface SlackChannel {
  id: string;
  name: string;
  purpose: string;
  memberCount: number;
  isActive: boolean;
}

interface SlackMessage {
  id: string;
  channel: string;
  user: string;
  text: string;
  timestamp: string;
  type: 'candidate_notification' | 'interview_reminder' | 'system_alert';
}

export default function SlackPoolsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('channels');
  const [newMessage, setNewMessage] = useState({
    channel: '',
    content: '',
    type: 'candidate_notification' as const,
  });

  // Mock data - replace with actual API calls
  const { data: channels = [] } = useQuery<SlackChannel[]>({
    queryKey: ['/api/slack/channels'],
    enabled: false, // Disable until API exists
  });

  const { data: messages = [] } = useQuery<SlackMessage[]>({
    queryKey: ['/api/slack/messages'],
    enabled: false, // Disable until API exists
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (messageData: typeof newMessage) => {
      return await apiRequest('/api/slack/send', 'POST', messageData);
    },
    onSuccess: () => {
      toast({
        title: "Message Sent",
        description: "Your message has been sent to Slack",
      });
      setNewMessage({ channel: '', content: '', type: 'candidate_notification' });
      queryClient.invalidateQueries({ queryKey: ['/api/slack/messages'] });
    },
    onError: () => {
      toast({
        title: "Send Failed",
        description: "Failed to send message to Slack",
        variant: "destructive",
      });
    },
  });

  const getMessageTypeColor = (type: string) => {
    switch (type) {
      case 'candidate_notification': return 'bg-green-500/20 text-green-500';
      case 'interview_reminder': return 'bg-blue-500/20 text-blue-500';
      case 'system_alert': return 'bg-red-500/20 text-red-500';
      default: return 'bg-gray-500/20 text-gray-500';
    }
  };

  const getMessageTypeIcon = (type: string) => {
    switch (type) {
      case 'candidate_notification': return 'fas fa-user-plus';
      case 'interview_reminder': return 'fas fa-calendar-check';
      case 'system_alert': return 'fas fa-exclamation-triangle';
      default: return 'fas fa-message';
    }
  };

  // No mock data - use real Slack integration data only
  // Channels and messages should come from actual Slack API or be empty
  const mockChannels: SlackChannel[] = [];
  const mockMessages: SlackMessage[] = [];

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
            <h1 className="enterprise-heading text-3xl font-bold">Slack Integration</h1>
            <p className="text-muted-foreground">Manage team communication and automated notifications</p>
          </div>
          <Button className="bg-primary hover:bg-primary/90" data-testid="send-message">
            <i className="fab fa-slack mr-2"></i>
            Send Message
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
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <i className="fab fa-slack text-green-500"></i>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active Channels</p>
                  <p className="text-2xl font-bold">{mockChannels.filter(c => c.isActive).length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-panel">
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <i className="fas fa-paper-plane text-blue-500"></i>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Messages Today</p>
                  <p className="text-2xl font-bold">42</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-panel">
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <i className="fas fa-users text-purple-500"></i>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Members</p>
                  <p className="text-2xl font-bold">
                    {mockChannels.reduce((sum, channel) => sum + channel.memberCount, 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-panel">
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-orange-500/20 rounded-lg">
                  <i className="fas fa-robot text-orange-500"></i>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Automated Messages</p>
                  <p className="text-2xl font-bold">156</p>
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
              <TabsTrigger value="channels">Channels</TabsTrigger>
              <TabsTrigger value="compose">Send Message</TabsTrigger>
              <TabsTrigger value="history">Message History</TabsTrigger>
              <TabsTrigger value="automation">Automation</TabsTrigger>
            </TabsList>

            <TabsContent value="channels">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {mockChannels.map((channel) => (
                  <motion.div
                    key={channel.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    <Card className="glass-panel hover:bg-muted/5 micro-animation">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <i className="fas fa-hashtag text-muted-foreground"></i>
                            <div>
                              <CardTitle className="text-lg">#{channel.name}</CardTitle>
                              <p className="text-sm text-muted-foreground">{channel.purpose}</p>
                            </div>
                          </div>
                          <Switch checked={channel.isActive} />
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-1">
                              <i className="fas fa-users text-muted-foreground text-sm"></i>
                              <span className="text-sm text-muted-foreground">{channel.memberCount}</span>
                            </div>
                            <Badge variant={channel.isActive ? "default" : "secondary"}>
                              {channel.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          <Button variant="ghost" size="sm" data-testid={`channel-${channel.id}`}>
                            <i className="fas fa-cog"></i>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="compose">
              <Card className="glass-panel">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <i className="fab fa-slack"></i>
                    <span>Send Slack Message</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Channel</label>
                      <Select value={newMessage.channel} onValueChange={(value) => setNewMessage(prev => ({ ...prev, channel: value }))}>
                        <SelectTrigger className="glass-input">
                          <SelectValue placeholder="Select channel" />
                        </SelectTrigger>
                        <SelectContent>
                          {mockChannels.filter(c => c.isActive).map(channel => (
                            <SelectItem key={channel.id} value={channel.name}>
                              #{channel.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Message Type</label>
                      <Select value={newMessage.type} onValueChange={(value: any) => setNewMessage(prev => ({ ...prev, type: value }))}>
                        <SelectTrigger className="glass-input">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="candidate_notification">Candidate Notification</SelectItem>
                          <SelectItem value="interview_reminder">Interview Reminder</SelectItem>
                          <SelectItem value="system_alert">System Alert</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Message Content</label>
                    <Textarea 
                      placeholder="Type your message here..."
                      className="glass-input min-h-[150px]"
                      value={newMessage.content}
                      onChange={(e) => setNewMessage(prev => ({ ...prev, content: e.target.value }))}
                      data-testid="slack-message"
                    />
                  </div>

                  <div className="flex justify-end space-x-3">
                    <Button variant="outline" className="glass-input">
                      <i className="fas fa-eye mr-2"></i>
                      Preview
                    </Button>
                    <Button 
                      className="bg-primary hover:bg-primary/90"
                      onClick={() => sendMessageMutation.mutate(newMessage)}
                      disabled={!newMessage.channel || !newMessage.content}
                      data-testid="send-slack-message"
                    >
                      <i className="fab fa-slack mr-2"></i>
                      Send to Slack
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history">
              <Card className="glass-panel">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <i className="fas fa-history"></i>
                    <span>Message History</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {mockMessages.map((message) => (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-start space-x-4 p-4 border border-border rounded-lg"
                      >
                        <div className={`p-2 rounded-lg ${getMessageTypeColor(message.type)}`}>
                          <i className={`${getMessageTypeIcon(message.type)} text-sm`}></i>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="font-medium">#{message.channel}</span>
                            <Badge className={getMessageTypeColor(message.type)}>
                              {message.type.replace('_', ' ')}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              by {message.user}
                            </span>
                          </div>
                          <p className="text-sm">{message.text}</p>
                          <span className="text-xs text-muted-foreground">
                            {new Date(message.timestamp).toLocaleString()}
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="automation">
              <Card className="glass-panel">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <i className="fas fa-robot"></i>
                    <span>Automation Settings</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                      <div>
                        <h3 className="font-medium">New Candidate Notifications</h3>
                        <p className="text-sm text-muted-foreground">
                          Automatically notify team when new candidates are added
                        </p>
                      </div>
                      <Switch defaultChecked />
                    </div>

                    <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                      <div>
                        <h3 className="font-medium">Interview Reminders</h3>
                        <p className="text-sm text-muted-foreground">
                          Send interview reminders 24 hours before scheduled time
                        </p>
                      </div>
                      <Switch defaultChecked />
                    </div>

                    <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                      <div>
                        <h3 className="font-medium">Stage Change Updates</h3>
                        <p className="text-sm text-muted-foreground">
                          Notify when candidates move through pipeline stages
                        </p>
                      </div>
                      <Switch />
                    </div>

                    <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                      <div>
                        <h3 className="font-medium">Daily Pipeline Summary</h3>
                        <p className="text-sm text-muted-foreground">
                          Send daily summary of pipeline activities at 9:00 AM
                        </p>
                      </div>
                      <Switch />
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
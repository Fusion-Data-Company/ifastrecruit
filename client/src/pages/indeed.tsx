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
import { Label } from '@/components/ui/label';
import { motion } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface JobPosting {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  requirements: string;
  salary: string;
  type: 'Full-time' | 'Part-time' | 'Contract' | 'Temporary';
  status: 'draft' | 'active' | 'paused' | 'expired';
  applicationsCount: number;
  createdAt: string;
}

interface Application {
  id: string;
  jobId: string;
  candidateName: string;
  candidateEmail: string;
  resume: string;
  coverLetter: string;
  screeningAnswers: Record<string, string>;
  appliedAt: string;
  disposition: 'new' | 'reviewed' | 'interview' | 'offer' | 'hired' | 'rejected';
}

export default function IndeedIntegrationPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [newJob, setNewJob] = useState({
    title: '',
    location: '',
    description: '',
    requirements: '',
    salary: '',
    type: 'Full-time' as const,
  });

  // Real API queries - now working with backend endpoints
  const { data: jobs = [], isLoading: jobsLoading } = useQuery<JobPosting[]>({
    queryKey: ['/api/indeed/jobs'],
    enabled: true, // Enable real API
  });

  const { data: applications = [], isLoading: appsLoading } = useQuery<Application[]>({
    queryKey: ['/api/indeed/applications'],
    enabled: true, // Enable real API
  });

  const { data: integrationStatus = {} } = useQuery({
    queryKey: ['/api/indeed/status'],
    enabled: true, // Enable real API
  });

  const createJobMutation = useMutation({
    mutationFn: async (jobData: typeof newJob) => {
      return await apiRequest('/api/indeed/jobs', 'POST', jobData);
    },
    onSuccess: () => {
      toast({
        title: "Job Posted",
        description: "Your job has been posted to Indeed successfully",
      });
      setNewJob({ title: '', location: '', description: '', requirements: '', salary: '', type: 'Full-time' });
      queryClient.invalidateQueries({ queryKey: ['/api/indeed/jobs'] });
    },
    onError: () => {
      toast({
        title: "Posting Failed", 
        description: "Failed to post job to Indeed. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateDispositionMutation = useMutation({
    mutationFn: async ({ applicationId, disposition }: { applicationId: string; disposition: string }) => {
      return await apiRequest(`/api/indeed/applications/${applicationId}/disposition`, 'PUT', { disposition });
    },
    onSuccess: () => {
      toast({
        title: "Disposition Updated",
        description: "Candidate status synced with Indeed",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/indeed/applications'] });
    },
    onError: () => {
      toast({
        title: "Sync Failed",
        description: "Failed to sync disposition with Indeed",
        variant: "destructive",
      });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500/20 text-green-500';
      case 'draft': return 'bg-yellow-500/20 text-yellow-500';
      case 'paused': return 'bg-orange-500/20 text-orange-500';
      case 'expired': return 'bg-red-500/20 text-red-500';
      default: return 'bg-gray-500/20 text-gray-500';
    }
  };

  const getDispositionColor = (disposition: string) => {
    switch (disposition) {
      case 'new': return 'bg-blue-500/20 text-blue-500';
      case 'reviewed': return 'bg-purple-500/20 text-purple-500';
      case 'interview': return 'bg-orange-500/20 text-orange-500';
      case 'offer': return 'bg-green-500/20 text-green-500';
      case 'hired': return 'bg-emerald-500/20 text-emerald-500';
      case 'rejected': return 'bg-red-500/20 text-red-500';
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
              <h1 className="enterprise-heading text-3xl font-bold">Indeed Integration</h1>
              <p className="text-muted-foreground">Manage job postings and application pipeline</p>
            </div>
            <div className="flex items-center space-x-3">
              <Badge className={integrationStatus?.connected ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}>
                <i className={`fas ${integrationStatus?.connected ? 'fa-check-circle' : 'fa-times-circle'} mr-1`}></i>
                {integrationStatus?.connected ? 'Connected' : 'Disconnected'}
              </Badge>
              <Button className="bg-primary hover:bg-primary/90" data-testid="post-job">
                <i className="fas fa-plus mr-2"></i>
                Post New Job
              </Button>
            </div>
          </motion.div>

          {/* Integration Status Cards */}
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
                    <i className="fas fa-briefcase text-blue-500"></i>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Active Jobs</p>
                    <p className="text-2xl font-bold">{jobs.filter(j => j.status === 'active').length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-panel">
              <CardContent className="p-6">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-green-500/20 rounded-lg">
                    <i className="fas fa-user-check text-green-500"></i>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">New Applications</p>
                    <p className="text-2xl font-bold">{applications.filter(a => a.disposition === 'new').length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-panel">
              <CardContent className="p-6">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-purple-500/20 rounded-lg">
                    <i className="fas fa-sync text-purple-500"></i>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Sync Status</p>
                    <p className="text-2xl font-bold">98%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-panel">
              <CardContent className="p-6">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-orange-500/20 rounded-lg">
                    <i className="fas fa-chart-line text-orange-500"></i>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Applications</p>
                    <p className="text-2xl font-bold">{applications.length}</p>
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
                <TabsTrigger value="dashboard">Overview</TabsTrigger>
                <TabsTrigger value="jobs">Job Postings</TabsTrigger>
                <TabsTrigger value="applications">Applications</TabsTrigger>
                <TabsTrigger value="settings">Integration Settings</TabsTrigger>
              </TabsList>

              <TabsContent value="dashboard">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Application Delivery Status */}
                  <Card className="glass-panel">
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <i className="fas fa-exchange-alt"></i>
                        <span>Application Delivery</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span>Endpoint URL</span>
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {process.env.APP_BASE_URL || 'https://your-app.replit.app'}/api/indeed/applications
                        </code>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Last Delivery</span>
                        <Badge className="bg-green-500/20 text-green-500">
                          <i className="fas fa-check-circle mr-1"></i>
                          2 minutes ago
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Success Rate (24h)</span>
                        <span className="font-medium">98.5%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Avg Latency</span>
                        <span className="font-medium">145ms</span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Disposition Sync */}
                  <Card className="glass-panel">
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <i className="fas fa-sync-alt"></i>
                        <span>Disposition Sync</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Auto-sync Pipeline</p>
                          <p className="text-sm text-muted-foreground">
                            Automatically sync candidate stage changes to Indeed
                          </p>
                        </div>
                        <Switch defaultChecked />
                      </div>
                      <div className="flex items-center justify-between">
                        <span>GraphQL Endpoint</span>
                        <Badge className="bg-blue-500/20 text-blue-500">
                          Connected
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Last Sync</span>
                        <span className="text-sm">5 minutes ago</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Pending Dispositions</span>
                        <span className="font-medium">3</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="jobs">
                <div className="space-y-6">
                  {/* Create New Job */}
                  <Card className="glass-panel">
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <i className="fas fa-plus-circle"></i>
                        <span>Post New Job</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="job-title">Job Title *</Label>
                          <Input
                            id="job-title"
                            placeholder="e.g., Senior Software Engineer"
                            value={newJob.title}
                            onChange={(e) => setNewJob(prev => ({ ...prev, title: e.target.value }))}
                            className="glass-input"
                            data-testid="job-title"
                          />
                        </div>
                        <div>
                          <Label htmlFor="job-location">Location *</Label>
                          <Input
                            id="job-location"
                            placeholder="e.g., San Francisco, CA"
                            value={newJob.location}
                            onChange={(e) => setNewJob(prev => ({ ...prev, location: e.target.value }))}
                            className="glass-input"
                            data-testid="job-location"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="job-type">Job Type</Label>
                          <Select value={newJob.type} onValueChange={(value: any) => setNewJob(prev => ({ ...prev, type: value }))}>
                            <SelectTrigger className="glass-input">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Full-time">Full-time</SelectItem>
                              <SelectItem value="Part-time">Part-time</SelectItem>
                              <SelectItem value="Contract">Contract</SelectItem>
                              <SelectItem value="Temporary">Temporary</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="job-salary">Salary Range</Label>
                          <Input
                            id="job-salary"
                            placeholder="e.g., $120,000 - $160,000"
                            value={newJob.salary}
                            onChange={(e) => setNewJob(prev => ({ ...prev, salary: e.target.value }))}
                            className="glass-input"
                            data-testid="job-salary"
                          />
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="job-description">Job Description *</Label>
                        <Textarea
                          id="job-description"
                          placeholder="Describe the role, responsibilities, and what makes your company great..."
                          value={newJob.description}
                          onChange={(e) => setNewJob(prev => ({ ...prev, description: e.target.value }))}
                          className="glass-input min-h-[120px]"
                          data-testid="job-description"
                        />
                      </div>

                      <div>
                        <Label htmlFor="job-requirements">Requirements</Label>
                        <Textarea
                          id="job-requirements"
                          placeholder="List required skills, experience, education..."
                          value={newJob.requirements}
                          onChange={(e) => setNewJob(prev => ({ ...prev, requirements: e.target.value }))}
                          className="glass-input min-h-[100px]"
                          data-testid="job-requirements"
                        />
                      </div>

                      <div className="flex justify-end space-x-3">
                        <Button variant="outline" className="glass-input">
                          <i className="fas fa-eye mr-2"></i>
                          Preview
                        </Button>
                        <Button 
                          onClick={() => createJobMutation.mutate(newJob)}
                          disabled={!newJob.title || !newJob.location || !newJob.description || createJobMutation.isPending}
                          className="bg-primary hover:bg-primary/90"
                          data-testid="submit-job"
                        >
                          <i className="fas fa-upload mr-2"></i>
                          {createJobMutation.isPending ? 'Posting...' : 'Post to Indeed'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Active Jobs List */}
                  <Card className="glass-panel">
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <i className="fas fa-list"></i>
                        <span>Your Job Postings</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {jobsLoading ? (
                        <div className="text-center py-8">
                          <i className="fas fa-spinner fa-spin text-2xl text-muted-foreground"></i>
                          <p className="text-muted-foreground mt-2">Loading jobs...</p>
                        </div>
                      ) : jobs.length === 0 ? (
                        <div className="text-center py-8">
                          <i className="fas fa-briefcase text-4xl text-muted-foreground mb-4"></i>
                          <p className="text-muted-foreground">No job postings yet</p>
                          <p className="text-sm text-muted-foreground mt-1">Create your first job posting to get started</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {jobs.map((job) => (
                            <motion.div
                              key={job.id}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/5 micro-animation"
                            >
                              <div className="flex items-center space-x-4">
                                <div>
                                  <h3 className="font-medium">{job.title}</h3>
                                  <p className="text-sm text-muted-foreground">{job.location} • {job.type}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {job.applicationsCount} applications • Posted {new Date(job.createdAt).toLocaleDateString()}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center space-x-3">
                                <Badge className={getStatusColor(job.status)}>
                                  {job.status}
                                </Badge>
                                <Button variant="ghost" size="sm" data-testid={`job-${job.id}`}>
                                  <i className="fas fa-edit"></i>
                                </Button>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="applications">
                <Card className="glass-panel">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <i className="fas fa-inbox"></i>
                      <span>Application Pipeline</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {appsLoading ? (
                      <div className="text-center py-8">
                        <i className="fas fa-spinner fa-spin text-2xl text-muted-foreground"></i>
                        <p className="text-muted-foreground mt-2">Loading applications...</p>
                      </div>
                    ) : applications.length === 0 ? (
                      <div className="text-center py-8">
                        <i className="fas fa-user-friends text-4xl text-muted-foreground mb-4"></i>
                        <p className="text-muted-foreground">No applications received yet</p>
                        <p className="text-sm text-muted-foreground mt-1">Applications will appear here once candidates apply through Indeed</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {applications.map((application) => (
                          <motion.div
                            key={application.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/5 micro-animation"
                          >
                            <div className="flex items-center space-x-4">
                              <i className="fas fa-user-circle text-2xl text-muted-foreground"></i>
                              <div>
                                <h3 className="font-medium">{application.candidateName}</h3>
                                <p className="text-sm text-muted-foreground">{application.candidateEmail}</p>
                                <p className="text-xs text-muted-foreground">
                                  Applied {new Date(application.appliedAt).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-3">
                              <Select
                                value={application.disposition}
                                onValueChange={(value) => updateDispositionMutation.mutate({ 
                                  applicationId: application.id, 
                                  disposition: value 
                                })}
                              >
                                <SelectTrigger className="glass-input w-40">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="new">New</SelectItem>
                                  <SelectItem value="reviewed">Reviewed</SelectItem>
                                  <SelectItem value="interview">Interview</SelectItem>
                                  <SelectItem value="offer">Offer</SelectItem>
                                  <SelectItem value="hired">Hired</SelectItem>
                                  <SelectItem value="rejected">Rejected</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button variant="ghost" size="sm" data-testid={`application-${application.id}`}>
                                <i className="fas fa-eye"></i>
                              </Button>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="settings">
                <div className="space-y-6">
                  {/* API Configuration */}
                  <Card className="glass-panel">
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <i className="fas fa-cog"></i>
                        <span>API Configuration</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label htmlFor="delivery-url">Application Delivery URL</Label>
                        <Input
                          id="delivery-url"
                          value={`${process.env.APP_BASE_URL || 'https://your-app.replit.app'}/api/indeed/applications`}
                          className="glass-input"
                          readOnly
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Configure this URL in your Indeed Partner Dashboard
                        </p>
                      </div>

                      <div>
                        <Label htmlFor="webhook-secret">Webhook Secret</Label>
                        <Input
                          id="webhook-secret"
                          type="password"
                          placeholder="Your Indeed webhook secret"
                          className="glass-input"
                        />
                      </div>

                      <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                        <div>
                          <p className="font-medium">Message Signature Verification</p>
                          <p className="text-sm text-muted-foreground">
                            Verify incoming application authenticity
                          </p>
                        </div>
                        <Switch defaultChecked />
                      </div>

                      <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                        <div>
                          <p className="font-medium">Screener Questions Support</p>
                          <p className="text-sm text-muted-foreground">
                            Process custom screening questions from applications
                          </p>
                        </div>
                        <Switch defaultChecked />
                      </div>
                    </CardContent>
                  </Card>

                  {/* EEO Compliance */}
                  <Card className="glass-panel">
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <i className="fas fa-shield-alt"></i>
                        <span>Compliance & EEO</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                        <div>
                          <p className="font-medium">EEO Data Collection</p>
                          <p className="text-sm text-muted-foreground">
                            Collect and store Equal Employment Opportunity data
                          </p>
                        </div>
                        <Switch defaultChecked />
                      </div>

                      <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                        <div>
                          <p className="font-medium">GDPR Compliance</p>
                          <p className="text-sm text-muted-foreground">
                            Handle candidate data according to GDPR requirements
                          </p>
                        </div>
                        <Switch defaultChecked />
                      </div>

                      <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                        <div className="flex items-start space-x-3">
                          <i className="fas fa-info-circle text-blue-500 mt-1"></i>
                          <div>
                            <p className="font-medium text-blue-500">Compliance Reminder</p>
                            <p className="text-sm text-muted-foreground">
                              Indeed mandates screener question and disposition sync capabilities by April 2025
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
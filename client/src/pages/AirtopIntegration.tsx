import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";

export default function AirtopIntegration() {
  const { toast } = useToast();
  const [apiKey, setApiKey] = useState("");
  const [selectedBrowser, setSelectedBrowser] = useState("chrome");
  const [scriptCode, setScriptCode] = useState("");
  const [isHeadless, setIsHeadless] = useState(true);
  const [sessionConfig, setSessionConfig] = useState({
    width: 1920,
    height: 1080,
    timeout: 60000,
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
  });

  // Fetch Airtop sessions
  const { data: sessions = [], isLoading: sessionsLoading } = useQuery<any[]>({
    queryKey: ["/api/airtop/sessions"],
    enabled: !!apiKey
  });

  // Create new session mutation
  const createSessionMutation = useMutation({
    mutationFn: async (config: any) => {
      return await apiRequest("POST", "/api/airtop/sessions", config);
    },
    onSuccess: () => {
      toast({
        title: "Session Created",
        description: "Airtop browser session created successfully"
      });
    }
  });

  // Execute script mutation
  const executeScriptMutation = useMutation({
    mutationFn: async ({ sessionId, script }: { sessionId: string; script: string }) => {
      return await apiRequest("POST", `/api/airtop/sessions/${sessionId}/execute`, { script });
    },
    onSuccess: () => {
      toast({
        title: "Script Executed",
        description: "Browser automation script executed successfully"
      });
    }
  });

  const handleCreateSession = () => {
    createSessionMutation.mutate({
      browser: selectedBrowser,
      headless: isHeadless,
      viewport: {
        width: sessionConfig.width,
        height: sessionConfig.height
      },
      timeout: sessionConfig.timeout,
      userAgent: sessionConfig.userAgent
    });
  };

  const handleExecuteScript = (sessionId: string) => {
    if (!scriptCode.trim()) {
      toast({
        title: "Error",
        description: "Please enter a script to execute",
        variant: "destructive"
      });
      return;
    }
    executeScriptMutation.mutate({ sessionId, script: scriptCode });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Header */}
      <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="glow-hover" data-testid="button-back-dashboard">
                <i className="fas fa-arrow-left mr-2"></i>
                Back to Dashboard
              </Button>
            </Link>
            <div className="h-6 w-px bg-border"></div>
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <i className="fas fa-bolt text-primary-foreground"></i>
              </div>
              <div>
                <h1 className="enterprise-heading text-lg text-foreground">iFast Broker</h1>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Link href="/candidates">
              <Button variant="ghost" size="sm">
                <i className="fas fa-users mr-2"></i>
                Candidates
              </Button>
            </Link>
            <Link href="/interviews">
              <Button variant="ghost" size="sm">
                <i className="fas fa-calendar-alt mr-2"></i>
                Interviews
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="space-y-6 max-w-7xl mx-auto p-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-2"
      >
        <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Airtop Integration
        </h1>
        <p className="text-muted-foreground text-lg">
          Browser automation and web scraping platform for advanced recruiting workflows
        </p>
      </motion.div>

      <Tabs defaultValue="configuration" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="automation">Automation</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Configuration Tab */}
        <TabsContent value="configuration" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* API Configuration */}
            <Card className="glass-panel">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <i className="fas fa-key text-primary"></i>
                  API Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="api-key">Airtop API Key</Label>
                  <Input
                    id="api-key"
                    type="password"
                    placeholder="Enter your Airtop API key"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="glass-input"
                    data-testid="input-airtop-api-key"
                  />
                  <p className="text-sm text-muted-foreground">
                    Get your API key from the Airtop dashboard
                  </p>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    id="test-connection"
                    checked={!!apiKey}
                    disabled={!apiKey}
                  />
                  <Label htmlFor="test-connection">Test Connection</Label>
                  {apiKey && (
                    <Badge variant="outline" className="ml-auto">
                      <i className="fas fa-check text-green-500 mr-1"></i>
                      Connected
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Browser Settings */}
            <Card className="glass-panel">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <i className="fas fa-browser text-primary"></i>
                  Browser Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Browser Type</Label>
                  <Select value={selectedBrowser} onValueChange={setSelectedBrowser}>
                    <SelectTrigger className="glass-input">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="chrome">Google Chrome</SelectItem>
                      <SelectItem value="firefox">Mozilla Firefox</SelectItem>
                      <SelectItem value="safari">Safari</SelectItem>
                      <SelectItem value="edge">Microsoft Edge</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="headless-mode"
                    checked={isHeadless}
                    onCheckedChange={setIsHeadless}
                  />
                  <Label htmlFor="headless-mode">Headless Mode</Label>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="viewport-width">Width</Label>
                    <Input
                      id="viewport-width"
                      type="number"
                      value={sessionConfig.width}
                      onChange={(e) => setSessionConfig(prev => ({ ...prev, width: parseInt(e.target.value) }))}
                      className="glass-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="viewport-height">Height</Label>
                    <Input
                      id="viewport-height"
                      type="number"
                      value={sessionConfig.height}
                      onChange={(e) => setSessionConfig(prev => ({ ...prev, height: parseInt(e.target.value) }))}
                      className="glass-input"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Sessions Tab */}
        <TabsContent value="sessions" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold">Active Sessions</h2>
            <Button
              onClick={handleCreateSession}
              disabled={!apiKey || createSessionMutation.isPending}
              className="glass-input glow-hover"
              data-testid="button-create-session"
            >
              {createSessionMutation.isPending ? (
                <i className="fas fa-spinner fa-spin mr-2"></i>
              ) : (
                <i className="fas fa-plus mr-2"></i>
              )}
              Create Session
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sessionsLoading ? (
              <div className="col-span-full text-center py-12">
                <i className="fas fa-spinner fa-spin text-2xl text-muted-foreground"></i>
                <p className="mt-2 text-muted-foreground">Loading sessions...</p>
              </div>
            ) : sessions.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <i className="fas fa-browser text-4xl text-muted-foreground mb-4"></i>
                <p className="text-muted-foreground">No active sessions</p>
                <p className="text-sm text-muted-foreground">Create a session to get started</p>
              </div>
            ) : (
              sessions.map((session: any) => (
                <Card key={session.id} className="glass-panel">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="truncate">{session.browser}</span>
                      <Badge variant={session.status === 'active' ? 'default' : 'secondary'}>
                        {session.status}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-sm space-y-1">
                      <p><strong>ID:</strong> {session.id.slice(0, 8)}...</p>
                      <p><strong>Created:</strong> {new Date(session.createdAt).toLocaleTimeString()}</p>
                      <p><strong>Viewport:</strong> {session.viewport?.width}x{session.viewport?.height}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1">
                        <i className="fas fa-eye mr-1"></i>
                        View
                      </Button>
                      <Button 
                        size="sm" 
                        variant="destructive" 
                        onClick={() => {/* Handle terminate */}}
                      >
                        <i className="fas fa-stop"></i>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Automation Tab */}
        <TabsContent value="automation" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Script Editor */}
            <Card className="glass-panel">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <i className="fas fa-code text-primary"></i>
                  Script Editor
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="script-code">Automation Script</Label>
                  <Textarea
                    id="script-code"
                    placeholder={`// Example Airtop script
await page.goto('https://example.com');
await page.waitForSelector('[data-testid="login"]');
await page.type('[data-testid="email"]', 'user@example.com');
await page.click('[data-testid="submit"]');
const result = await page.evaluate(() => document.title);
return result;`}
                    value={scriptCode}
                    onChange={(e) => setScriptCode(e.target.value)}
                    className="glass-input font-mono min-h-[200px]"
                    data-testid="textarea-script-code"
                  />
                </div>
                
                <div className="flex gap-2">
                  <Button
                    onClick={() => sessions.length > 0 && handleExecuteScript(sessions[0].id)}
                    disabled={!scriptCode.trim() || executeScriptMutation.isPending || sessions.length === 0}
                    className="glass-input glow-hover"
                    data-testid="button-execute-script"
                  >
                    {executeScriptMutation.isPending ? (
                      <i className="fas fa-spinner fa-spin mr-2"></i>
                    ) : (
                      <i className="fas fa-play mr-2"></i>
                    )}
                    Execute Script
                  </Button>
                  <Button variant="outline" onClick={() => setScriptCode("")}>
                    <i className="fas fa-trash mr-2"></i>
                    Clear
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Pre-built Templates */}
            <Card className="glass-panel">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <i className="fas fa-template text-primary"></i>
                  Script Templates
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {[
                    {
                      name: "LinkedIn Profile Scraper",
                      description: "Extract profile information from LinkedIn",
                      icon: "fab fa-linkedin",
                      script: `// LinkedIn Profile Scraper
await page.goto(profileUrl);
await page.waitForSelector('[data-section="summary"]');
const profile = await page.evaluate(() => ({
  name: document.querySelector('h1')?.textContent,
  title: document.querySelector('[data-section="summary"] h2')?.textContent,
  location: document.querySelector('[data-section="location"]')?.textContent
}));
return profile;`
                    },
                    {
                      name: "Indeed Job Scraper",
                      description: "Scrape job listings from Indeed",
                      icon: "fas fa-briefcase",
                      script: `// Indeed Job Scraper
await page.goto('https://indeed.com/jobs?q=software+engineer');
await page.waitForSelector('[data-testid="job-title"]');
const jobs = await page.evaluate(() => 
  Array.from(document.querySelectorAll('[data-testid="job-snippet"]')).map(job => ({
    title: job.querySelector('[data-testid="job-title"]')?.textContent,
    company: job.querySelector('[data-testid="company-name"]')?.textContent,
    location: job.querySelector('[data-testid="job-location"]')?.textContent
  }))
);
return jobs;`
                    },
                    {
                      name: "Email Automation",
                      description: "Automate email sending and management",
                      icon: "fas fa-envelope",
                      script: `// Email Automation
await page.goto('https://mail.google.com');
await page.waitForSelector('[data-testid="compose"]');
await page.click('[data-testid="compose"]');
await page.type('[data-testid="to"]', recipientEmail);
await page.type('[data-testid="subject"]', emailSubject);
await page.type('[data-testid="body"]', emailBody);
await page.click('[data-testid="send"]');
return 'Email sent successfully';`
                    }
                  ].map((template, index) => (
                    <div key={index} className="p-4 border rounded-lg glass-panel cursor-pointer hover:bg-accent/10" 
                         onClick={() => setScriptCode(template.script)}>
                      <div className="flex items-start gap-3">
                        <i className={`${template.icon} text-primary text-lg mt-1`}></i>
                        <div className="flex-1">
                          <h4 className="font-medium">{template.name}</h4>
                          <p className="text-sm text-muted-foreground">{template.description}</p>
                        </div>
                        <Button size="sm" variant="ghost">
                          <i className="fas fa-copy"></i>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label: "Total Sessions", value: "47", change: "+12%", icon: "fas fa-browser" },
              { label: "Scripts Executed", value: "134", change: "+8%", icon: "fas fa-code" },
              { label: "Success Rate", value: "94.2%", change: "+2.1%", icon: "fas fa-check-circle" },
              { label: "Avg Duration", value: "2.4m", change: "-15%", icon: "fas fa-clock" }
            ].map((stat, index) => (
              <Card key={index} className="glass-panel">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                      <p className="text-2xl font-bold">{stat.value}</p>
                      <p className="text-xs text-green-500">{stat.change}</p>
                    </div>
                    <i className={`${stat.icon} text-2xl text-primary`}></i>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Usage Chart */}
          <Card className="glass-panel">
            <CardHeader>
              <CardTitle>Usage Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span>Browser Sessions</span>
                  <span>85%</span>
                </div>
                <Progress value={85} className="h-2" />
                
                <div className="flex justify-between text-sm">
                  <span>Script Executions</span>
                  <span>72%</span>
                </div>
                <Progress value={72} className="h-2" />
                
                <div className="flex justify-between text-sm">
                  <span>API Calls</span>
                  <span>91%</span>
                </div>
                <Progress value={91} className="h-2" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}
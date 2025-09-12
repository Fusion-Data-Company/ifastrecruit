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
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

// API Response Types
interface RunActorResponse {
  runId: string;
}

interface ImportDatasetResponse {
  imported: number;
}

interface DatasetItemsResponse {
  items: DatasetItem[];
}

interface ApifyActor {
  id: string;
  name: string;
  description: string;
  actorId: string; // Apify actor ID
  inputSchema: string; // JSON schema
  lastRun?: {
    id: string;
    status: 'READY' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'ABORTED';
    startedAt: string;
    finishedAt?: string;
    defaultDatasetId?: string;
    stats?: {
      inputBodyLen: number;
      requestsFinished: number;
      requestsFailed: number;
      outputValueCount: number;
    };
  };
  createdAt: string;
}

interface ApifyRun {
  id: string;
  actorId: string;
  status: 'READY' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'ABORTED';
  startedAt: string;
  finishedAt?: string;
  buildId?: string;
  exitCode?: number;
  defaultDatasetId?: string;
  keyValueStoreId?: string;
  log?: string[];
  stats?: {
    inputBodyLen: number;
    requestsFinished: number;
    requestsFailed: number;
    outputValueCount: number;
  };
}

interface DatasetItem {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  position?: string;
  location?: string;
  experience?: string;
  skills?: string[];
  linkedinUrl?: string;
  resumeUrl?: string;
  source?: string;
  [key: string]: any; // Allow additional fields
}

export default function ApifyCommandCenter() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('actors');
  const [selectedActor, setSelectedActor] = useState<string>('');
  const [actorInput, setActorInput] = useState('{}');
  const [selectedRun, setSelectedRun] = useState<string>('');
  const [previewDataset, setPreviewDataset] = useState<DatasetItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const [newActor, setNewActor] = useState({
    name: '',
    description: '',
    template: 'cheerio-scraper',
    inputSchema: JSON.stringify({
      type: "object",
      schemaVersion: 1,
      properties: {
        startUrls: {
          title: "Start URLs",
          type: "array",
          description: "URLs to scrape",
          editor: "requestListSources"
        },
        maxRequestsPerCrawl: {
          title: "Max pages to scrape",
          type: "integer",
          description: "Maximum number of pages to process",
          default: 100
        },
        keywords: {
          title: "Search Keywords", 
          type: "string",
          description: "Keywords to search for (e.g., 'software engineer javascript')"
        },
        location: {
          title: "Location",
          type: "string", 
          description: "Geographic location (e.g., 'San Francisco, CA')"
        }
      },
      required: ["startUrls"]
    }, null, 2)
  });

  // Real API queries - will work when Apify integration exists
  const { data: actors = [], isLoading: actorsLoading } = useQuery<ApifyActor[]>({
    queryKey: ['/api/apify/actors'],
  });

  const { data: runs = [], isLoading: runsLoading } = useQuery<ApifyRun[]>({
    queryKey: ['/api/apify/runs', selectedActor],
    enabled: !!selectedActor,
  });

  const { data: runDetails } = useQuery<ApifyRun>({
    queryKey: ['/api/apify/runs', selectedRun, 'details'],
    enabled: !!selectedRun,
  });

  const createActorMutation = useMutation({
    mutationFn: async (actorData: typeof newActor) => {
      return await apiRequest('/api/apify/actors', 'POST', actorData);
    },
    onSuccess: () => {
      toast({
        title: "Actor Created",
        description: "Apify actor has been created successfully",
      });
      setNewActor({ name: '', description: '', template: 'cheerio-scraper', inputSchema: '' });
      queryClient.invalidateQueries({ queryKey: ['/api/apify/actors'] });
    },
    onError: (error) => {
      toast({
        title: "Creation Failed",
        description: `Failed to create actor: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const runActorMutation = useMutation({
    mutationFn: async ({ actorId, input }: { actorId: string; input: string }): Promise<RunActorResponse> => {
      return await apiRequest('/api/apify/actors/run', 'POST', { actorId, input: JSON.parse(input) }) as unknown as RunActorResponse;
    },
    onSuccess: (data) => {
      toast({
        title: "Run Started",
        description: `Actor run initiated: ${data.runId}`,
      });
      setSelectedRun(data.runId);
      queryClient.invalidateQueries({ queryKey: ['/api/apify/runs'] });
    },
    onError: (error) => {
      toast({
        title: "Run Failed",
        description: `Failed to start run: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const importDatasetMutation = useMutation({
    mutationFn: async (items: DatasetItem[]): Promise<ImportDatasetResponse> => {
      return await apiRequest('/api/apify/import', 'POST', { items }) as unknown as ImportDatasetResponse;
    },
    onSuccess: (data) => {
      toast({
        title: "Import Complete",
        description: `Successfully imported ${data.imported} candidates`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/candidates'] });
      setPreviewDataset([]);
      setSelectedItems([]);
    },
    onError: (error) => {
      toast({
        title: "Import Failed",
        description: `Failed to import candidates: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'READY': return 'bg-blue-500/20 text-blue-500';
      case 'RUNNING': return 'bg-orange-500/20 text-orange-500';
      case 'SUCCEEDED': return 'bg-green-500/20 text-green-500';
      case 'FAILED': return 'bg-red-500/20 text-red-500';
      case 'ABORTED': return 'bg-gray-500/20 text-gray-500';
      default: return 'bg-gray-500/20 text-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'READY': return 'fas fa-clock';
      case 'RUNNING': return 'fas fa-spinner fa-spin';
      case 'SUCCEEDED': return 'fas fa-check-circle';
      case 'FAILED': return 'fas fa-times-circle';
      case 'ABORTED': return 'fas fa-stop-circle';
      default: return 'fas fa-question-circle';
    }
  };

  const loadDatasetPreview = async (datasetId: string) => {
    try {
      const response = await apiRequest(`/api/apify/datasets/${datasetId}/items`, 'GET') as unknown as DatasetItemsResponse;
      setPreviewDataset(response.items || []);
      toast({
        title: "Dataset Loaded",
        description: `Loaded ${response.items?.length || 0} items for preview`,
      });
    } catch (error) {
      toast({
        title: "Load Failed",
        description: "Failed to load dataset preview",
        variant: "destructive",
      });
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
              <h1 className="enterprise-heading text-3xl font-bold">Apify Integration</h1>
              <p className="text-muted-foreground">Create, manage, and run web scraping actors</p>
            </div>
            <div className="flex items-center space-x-3">
              <Badge className="bg-green-500/20 text-green-500">
                <i className="fas fa-check-circle mr-1"></i>
                API Connected
              </Badge>
              <Button className="bg-primary hover:bg-primary/90" data-testid="create-actor">
                <i className="fas fa-plus mr-2"></i>
                Create Actor
              </Button>
            </div>
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
                    <i className="fas fa-robot text-blue-500"></i>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Actors</p>
                    <p className="text-2xl font-bold">{(actors || []).length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-panel">
              <CardContent className="p-6">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-green-500/20 rounded-lg">
                    <i className="fas fa-play text-green-500"></i>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Active Runs</p>
                    <p className="text-2xl font-bold">
                      {(runs || []).filter(r => r.status === 'RUNNING').length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-panel">
              <CardContent className="p-6">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-purple-500/20 rounded-lg">
                    <i className="fas fa-check-circle text-purple-500"></i>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Successful Runs</p>
                    <p className="text-2xl font-bold">
                      {(runs || []).filter(r => r.status === 'SUCCEEDED').length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-panel">
              <CardContent className="p-6">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-orange-500/20 rounded-lg">
                    <i className="fas fa-database text-orange-500"></i>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Items Scraped</p>
                    <p className="text-2xl font-bold">
                      {(runs || []).reduce((sum, run) => sum + (run.stats?.outputValueCount || 0), 0)}
                    </p>
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
                <TabsTrigger value="actors">Actors</TabsTrigger>
                <TabsTrigger value="runs">Runs & Monitoring</TabsTrigger>
                <TabsTrigger value="datasets">Dataset Import</TabsTrigger>
                <TabsTrigger value="create">Create Actor</TabsTrigger>
              </TabsList>

              <TabsContent value="actors">
                <div className="space-y-6">
                  {/* Actor Selection */}
                  <Card className="glass-panel">
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <i className="fas fa-robot"></i>
                        <span>Actor Management</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <Label>Select Actor</Label>
                          <Select value={selectedActor} onValueChange={setSelectedActor}>
                            <SelectTrigger className="glass-input">
                              <SelectValue placeholder="Choose an actor..." />
                            </SelectTrigger>
                            <SelectContent>
                              {(actors || []).map(actor => (
                                <SelectItem key={actor.id} value={actor.id}>
                                  {actor.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-end space-x-2">
                          <Button 
                            variant="outline" 
                            className="glass-input flex-1"
                            disabled={!selectedActor}
                            data-testid="edit-actor"
                          >
                            <i className="fas fa-edit mr-2"></i>
                            Edit
                          </Button>
                          <Button 
                            variant="outline" 
                            className="glass-input flex-1"
                            disabled={!selectedActor}
                            data-testid="run-actor"
                          >
                            <i className="fas fa-play mr-2"></i>
                            Run
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Actor Details */}
                  {selectedActor && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {(() => {
                        const actor = (actors || []).find(a => a.id === selectedActor);
                        if (!actor) return null;
                        
                        return (
                          <>
                            <Card className="glass-panel">
                              <CardHeader>
                                <CardTitle>Actor Configuration</CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-4">
                                <div>
                                  <Label>Name</Label>
                                  <Input value={actor.name} className="glass-input" readOnly />
                                </div>
                                <div>
                                  <Label>Apify Actor ID</Label>
                                  <Input value={actor.actorId} className="glass-input" readOnly />
                                </div>
                                <div>
                                  <Label>Description</Label>
                                  <Textarea value={actor.description} className="glass-input" readOnly />
                                </div>
                                <div>
                                  <Label>Last Run</Label>
                                  <div className="flex items-center space-x-2">
                                    <Badge className={actor.lastRun ? getStatusColor(actor.lastRun.status) : 'bg-gray-500/20 text-gray-500'}>
                                      <i className={`${actor.lastRun ? getStatusIcon(actor.lastRun.status) : 'fas fa-minus'} mr-1`}></i>
                                      {actor.lastRun?.status || 'Never run'}
                                    </Badge>
                                    {actor.lastRun?.finishedAt && (
                                      <span className="text-xs text-muted-foreground">
                                        {new Date(actor.lastRun.finishedAt).toLocaleString()}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>

                            <Card className="glass-panel">
                              <CardHeader>
                                <CardTitle>Input Schema</CardTitle>
                              </CardHeader>
                              <CardContent>
                                <ScrollArea className="h-64 w-full">
                                  <pre className="text-xs bg-muted/20 p-4 rounded-lg overflow-x-auto">
                                    {actor.inputSchema}
                                  </pre>
                                </ScrollArea>
                              </CardContent>
                            </Card>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="runs">
                <div className="space-y-6">
                  {/* Run Actor Interface */}
                  <Card className="glass-panel">
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <i className="fas fa-play-circle"></i>
                        <span>Run Actor</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label>Actor</Label>
                          <Select value={selectedActor} onValueChange={setSelectedActor}>
                            <SelectTrigger className="glass-input">
                              <SelectValue placeholder="Select actor to run..." />
                            </SelectTrigger>
                            <SelectContent>
                              {(actors || []).map(actor => (
                                <SelectItem key={actor.id} value={actor.id}>
                                  {actor.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-end">
                          <Button 
                            onClick={() => selectedActor && runActorMutation.mutate({ actorId: selectedActor, input: actorInput })}
                            disabled={!selectedActor || runActorMutation.isPending}
                            className="bg-primary hover:bg-primary/90 w-full"
                            data-testid="start-run"
                          >
                            <i className="fas fa-rocket mr-2"></i>
                            {runActorMutation.isPending ? 'Starting...' : 'Start Run'}
                          </Button>
                        </div>
                      </div>

                      <div>
                        <Label>Input JSON</Label>
                        <Textarea
                          placeholder='{"startUrls": [{"url": "https://example.com"}], "maxRequestsPerCrawl": 50}'
                          value={actorInput}
                          onChange={(e) => setActorInput(e.target.value)}
                          className="glass-input min-h-[120px] font-mono text-xs"
                          data-testid="actor-input"
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Live Run Monitoring */}
                  {selectedRun && runDetails && (
                    <Card className="glass-panel">
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <i className="fas fa-terminal"></i>
                            <span>Run Monitor: {selectedRun.slice(0, 8)}...</span>
                          </div>
                          <Badge className={getStatusColor(runDetails.status)}>
                            <i className={`${getStatusIcon(runDetails.status)} mr-1`}></i>
                            {runDetails.status}
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                          <div className="text-center">
                            <p className="text-sm text-muted-foreground">Requests Finished</p>
                            <p className="text-lg font-bold">{runDetails.stats?.requestsFinished || 0}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-sm text-muted-foreground">Requests Failed</p>
                            <p className="text-lg font-bold">{runDetails.stats?.requestsFailed || 0}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-sm text-muted-foreground">Items Extracted</p>
                            <p className="text-lg font-bold">{runDetails.stats?.outputValueCount || 0}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-sm text-muted-foreground">Duration</p>
                            <p className="text-lg font-bold">
                              {runDetails.finishedAt 
                                ? Math.round((new Date(runDetails.finishedAt).getTime() - new Date(runDetails.startedAt).getTime()) / 1000) + 's'
                                : Math.round((Date.now() - new Date(runDetails.startedAt).getTime()) / 1000) + 's'
                              }
                            </p>
                          </div>
                        </div>

                        {runDetails.log && runDetails.log.length > 0 && (
                          <div>
                            <Label className="mb-2 block">Live Logs</Label>
                            <ScrollArea className="h-64 w-full">
                              <div className="bg-black/90 text-green-400 p-4 rounded-lg font-mono text-xs">
                                {runDetails.log.map((line, index) => (
                                  <div key={index} className="mb-1">
                                    {line}
                                  </div>
                                ))}
                              </div>
                            </ScrollArea>
                          </div>
                        )}

                        {runDetails.status === 'SUCCEEDED' && runDetails.defaultDatasetId && (
                          <div className="flex justify-end mt-4">
                            <Button 
                              onClick={() => loadDatasetPreview(runDetails.defaultDatasetId!)}
                              className="bg-primary hover:bg-primary/90"
                              data-testid="load-dataset"
                            >
                              <i className="fas fa-download mr-2"></i>
                              Load Dataset for Import
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Recent Runs */}
                  <Card className="glass-panel">
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <i className="fas fa-history"></i>
                        <span>Recent Runs</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {runsLoading ? (
                        <div className="text-center py-8">
                          <i className="fas fa-spinner fa-spin text-2xl text-muted-foreground"></i>
                          <p className="text-muted-foreground mt-2">Loading runs...</p>
                        </div>
                      ) : runs.length === 0 ? (
                        <div className="text-center py-8">
                          <i className="fas fa-rocket text-4xl text-muted-foreground mb-4"></i>
                          <p className="text-muted-foreground">No runs yet</p>
                          <p className="text-sm text-muted-foreground mt-1">Start your first actor run to see results here</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {runs.slice(0, 10).map((run) => (
                            <motion.div
                              key={run.id}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              className={`flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/5 micro-animation cursor-pointer ${
                                selectedRun === run.id ? 'bg-primary/5 border-primary/20' : ''
                              }`}
                              onClick={() => setSelectedRun(run.id)}
                            >
                              <div className="flex items-center space-x-4">
                                <div className={`p-2 rounded-lg ${getStatusColor(run.status)}`}>
                                  <i className={`${getStatusIcon(run.status)} text-sm`}></i>
                                </div>
                                <div>
                                  <p className="font-medium">{run.id.slice(0, 12)}...</p>
                                  <p className="text-sm text-muted-foreground">
                                    Started {new Date(run.startedAt).toLocaleString()}
                                  </p>
                                  {run.stats && (
                                    <p className="text-xs text-muted-foreground">
                                      {run.stats.outputValueCount} items • {run.stats.requestsFinished} requests
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center space-x-3">
                                <Badge className={getStatusColor(run.status)}>
                                  {run.status}
                                </Badge>
                                {run.defaultDatasetId && run.status === 'SUCCEEDED' && (
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      loadDatasetPreview(run.defaultDatasetId!);
                                    }}
                                    data-testid={`dataset-${run.id}`}
                                  >
                                    <i className="fas fa-database"></i>
                                  </Button>
                                )}
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="datasets">
                <Card className="glass-panel">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <i className="fas fa-table"></i>
                        <span>Dataset Preview & Import</span>
                      </div>
                      {previewDataset.length > 0 && (
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-muted-foreground">
                            {selectedItems.length} of {previewDataset.length} selected
                          </span>
                          <Button 
                            onClick={() => importDatasetMutation.mutate(
                              selectedItems.length > 0 
                                ? previewDataset.filter((_, i) => selectedItems.includes(i.toString()))
                                : previewDataset
                            )}
                            disabled={previewDataset.length === 0 || importDatasetMutation.isPending}
                            className="bg-primary hover:bg-primary/90"
                            data-testid="import-candidates"
                          >
                            <i className="fas fa-upload mr-2"></i>
                            {importDatasetMutation.isPending ? 'Importing...' : `Import ${selectedItems.length || previewDataset.length} Items`}
                          </Button>
                        </div>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {previewDataset.length === 0 ? (
                      <div className="text-center py-12">
                        <i className="fas fa-table text-4xl text-muted-foreground mb-4"></i>
                        <p className="text-muted-foreground">No dataset loaded</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Run an actor or load a dataset to preview and import candidates
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Button 
                            variant="outline"
                            onClick={() => {
                              if (selectedItems.length === previewDataset.length) {
                                setSelectedItems([]);
                              } else {
                                setSelectedItems(previewDataset.map((_, i) => i.toString()));
                              }
                            }}
                            className="glass-input"
                          >
                            {selectedItems.length === previewDataset.length ? 'Deselect All' : 'Select All'}
                          </Button>
                          <div className="text-sm text-muted-foreground">
                            Preview showing first 100 items
                          </div>
                        </div>

                        <div className="border border-border rounded-lg overflow-hidden">
                          <div className="grid grid-cols-6 gap-4 p-3 bg-muted/20 border-b border-border text-sm font-medium">
                            <div>Select</div>
                            <div>Name</div>
                            <div>Email</div>
                            <div>Company</div>
                            <div>Position</div>
                            <div>Location</div>
                          </div>
                          <ScrollArea className="h-96">
                            {previewDataset.slice(0, 100).map((item, index) => (
                              <div key={index} className="grid grid-cols-6 gap-4 p-3 border-b border-border text-sm hover:bg-muted/5">
                                <div>
                                  <input
                                    type="checkbox"
                                    checked={selectedItems.includes(index.toString())}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedItems(prev => [...prev, index.toString()]);
                                      } else {
                                        setSelectedItems(prev => prev.filter(i => i !== index.toString()));
                                      }
                                    }}
                                    className="rounded"
                                  />
                                </div>
                                <div className="truncate">{item.name || 'N/A'}</div>
                                <div className="truncate">{item.email || 'N/A'}</div>
                                <div className="truncate">{item.company || 'N/A'}</div>
                                <div className="truncate">{item.position || 'N/A'}</div>
                                <div className="truncate">{item.location || 'N/A'}</div>
                              </div>
                            ))}
                          </ScrollArea>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="create">
                <Card className="glass-panel">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <i className="fas fa-plus-circle"></i>
                      <span>Create New Actor</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="actor-name">Actor Name *</Label>
                        <Input
                          id="actor-name"
                          placeholder="e.g., ifast-linkedin-scraper"
                          value={newActor.name}
                          onChange={(e) => setNewActor(prev => ({ ...prev, name: e.target.value }))}
                          className="glass-input"
                          data-testid="actor-name"
                        />
                      </div>
                      <div>
                        <Label htmlFor="actor-template">Template</Label>
                        <Select value={newActor.template} onValueChange={(value) => setNewActor(prev => ({ ...prev, template: value }))}>
                          <SelectTrigger className="glass-input">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cheerio-scraper">Cheerio Scraper</SelectItem>
                            <SelectItem value="puppeteer-scraper">Puppeteer Scraper</SelectItem>
                            <SelectItem value="playwright-scraper">Playwright Scraper</SelectItem>
                            <SelectItem value="web-scraper">Basic Web Scraper</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="actor-description">Description</Label>
                      <Textarea
                        id="actor-description"
                        placeholder="Describe what this actor does and what data it extracts..."
                        value={newActor.description}
                        onChange={(e) => setNewActor(prev => ({ ...prev, description: e.target.value }))}
                        className="glass-input"
                        data-testid="actor-description"
                      />
                    </div>

                    <div>
                      <Label htmlFor="input-schema">Input Schema (JSON)</Label>
                      <Textarea
                        id="input-schema"
                        placeholder="JSON schema defining the actor's input parameters..."
                        value={newActor.inputSchema}
                        onChange={(e) => setNewActor(prev => ({ ...prev, inputSchema: e.target.value }))}
                        className="glass-input min-h-[200px] font-mono text-xs"
                        data-testid="input-schema"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        This schema will generate the input form in Apify Console
                      </p>
                    </div>

                    <div className="flex justify-end space-x-3">
                      <Button variant="outline" className="glass-input">
                        <i className="fas fa-eye mr-2"></i>
                        Validate Schema
                      </Button>
                      <Button 
                        onClick={() => createActorMutation.mutate(newActor)}
                        disabled={!newActor.name || !newActor.inputSchema || createActorMutation.isPending}
                        className="bg-primary hover:bg-primary/90"
                        data-testid="create-actor-submit"
                      >
                        <i className="fas fa-rocket mr-2"></i>
                        {createActorMutation.isPending ? 'Creating...' : 'Create & Deploy Actor'}
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
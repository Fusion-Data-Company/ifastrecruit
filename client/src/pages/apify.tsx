import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";
import { useMCPClient } from "@/lib/mcp-client";
import type { ApifyActor } from "@shared/schema";

interface ActorRun {
  id: string;
  status: "READY" | "RUNNING" | "SUCCEEDED" | "FAILED";
  startedAt?: string;
  finishedAt?: string;
  stats?: any;
}

export default function ApifyCenter() {
  const [selectedActor, setSelectedActor] = useState<ApifyActor | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newActorData, setNewActorData] = useState({
    name: "",
    actorId: "",
    targetWebsite: "",
    selectors: "",
    pagination: "auto-detect",
  });

  const queryClient = useQueryClient();
  const { callTool } = useMCPClient();

  const { data: actors = [], isLoading } = useQuery<ApifyActor[]>({
    queryKey: ["/api/apify/actors"],
    refetchInterval: 10000,
  });

  const createActorMutation = useMutation({
    mutationFn: async (actorData: any) => {
      return await callTool("manage_apify_actor", {
        action: "create",
        name: actorData.name,
        actorId: actorData.actorId,
        configuration: {
          targetWebsite: actorData.targetWebsite,
          selectors: actorData.selectors,
          pagination: actorData.pagination,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/apify/actors"] });
      setIsCreateModalOpen(false);
      setNewActorData({ name: "", actorId: "", targetWebsite: "", selectors: "", pagination: "auto-detect" });
    },
  });

  const runActorMutation = useMutation({
    mutationFn: async (actorId: string) => {
      return await callTool("manage_apify_actor", {
        action: "run",
        actorId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/apify/actors"] });
    },
  });

  const handleCreateActor = () => {
    createActorMutation.mutate(newActorData);
  };

  const handleRunActor = (actorId: string) => {
    runActorMutation.mutate(actorId);
  };

  const getActorStatusColor = (actor: ApifyActor) => {
    if (!actor.lastRun) return "bg-muted text-muted-foreground";
    
    const lastRun = new Date(actor.lastRun);
    const now = new Date();
    const hoursSinceRun = (now.getTime() - lastRun.getTime()) / (1000 * 60 * 60);
    
    if (hoursSinceRun < 1) return "bg-accent/20 text-accent";
    if (hoursSinceRun < 24) return "bg-primary/20 text-primary";
    return "bg-muted text-muted-foreground";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-muted rounded w-64"></div>
            <div className="grid grid-cols-3 gap-6">
              {Array(3).fill(0).map((_, i) => (
                <div key={i} className="h-64 bg-muted rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="glass-panel rounded-lg p-6 mb-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="enterprise-heading text-2xl font-bold mb-2">Apify Command Center</h1>
              <p className="text-muted-foreground">
                Manage web scraping actors, monitor runs, and import candidate datasets
              </p>
            </div>
            
            <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary text-primary-foreground glow-hover" data-testid="create-actor-button">
                  <i className="fas fa-plus mr-2"></i>
                  Create Actor
                </Button>
              </DialogTrigger>
              <DialogContent className="glass-panel border-border">
                <DialogHeader>
                  <DialogTitle className="enterprise-heading">Create New Apify Actor</DialogTitle>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Actor Name</label>
                    <Input
                      placeholder="LinkedIn Scraper"
                      value={newActorData.name}
                      onChange={(e) => setNewActorData(prev => ({ ...prev, name: e.target.value }))}
                      className="glass-input"
                      data-testid="actor-name-input"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">Apify Actor ID</label>
                    <Input
                      placeholder="apify/linkedin-scraper"
                      value={newActorData.actorId}
                      onChange={(e) => setNewActorData(prev => ({ ...prev, actorId: e.target.value }))}
                      className="glass-input"
                      data-testid="actor-id-input"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">Target Website</label>
                    <Input
                      placeholder="https://linkedin.com/jobs"
                      value={newActorData.targetWebsite}
                      onChange={(e) => setNewActorData(prev => ({ ...prev, targetWebsite: e.target.value }))}
                      className="glass-input"
                      data-testid="target-website-input"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">CSS Selectors</label>
                    <Textarea
                      placeholder="Define extraction rules..."
                      value={newActorData.selectors}
                      onChange={(e) => setNewActorData(prev => ({ ...prev, selectors: e.target.value }))}
                      className="glass-input h-20"
                      data-testid="selectors-input"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">Pagination</label>
                    <Select value={newActorData.pagination} onValueChange={(value) => setNewActorData(prev => ({ ...prev, pagination: value }))}>
                      <SelectTrigger className="glass-input" data-testid="pagination-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto-detect">Auto-detect</SelectItem>
                        <SelectItem value="next-button">Next button</SelectItem>
                        <SelectItem value="url-pattern">URL pattern</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex justify-end space-x-3 pt-4">
                    <Button
                      variant="ghost"
                      onClick={() => setIsCreateModalOpen(false)}
                      data-testid="cancel-create-actor"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCreateActor}
                      disabled={createActorMutation.isPending || !newActorData.name || !newActorData.actorId}
                      className="bg-accent text-accent-foreground glow-hover"
                      data-testid="confirm-create-actor"
                    >
                      {createActorMutation.isPending ? (
                        <>
                          <i className="fas fa-spinner fa-spin mr-2"></i>
                          Creating...
                        </>
                      ) : (
                        <>
                          <i className="fas fa-robot mr-2"></i>
                          Create Actor
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </motion.div>

        {/* Actor Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Actor Management */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2, delay: 0.1 }}
            className="lg:col-span-2"
          >
            <Card className="glass-panel p-6 rounded-lg">
              <h3 className="enterprise-heading text-lg font-semibold mb-4">Actor Management</h3>
              
              {actors.length === 0 ? (
                <div className="text-center py-12">
                  <i className="fas fa-robot text-4xl text-muted-foreground mb-4"></i>
                  <h4 className="font-semibold mb-2">No Actors Created</h4>
                  <p className="text-muted-foreground mb-4">Create your first Apify actor to start scraping candidate data.</p>
                  <Button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="bg-primary text-primary-foreground glow-hover"
                  >
                    <i className="fas fa-plus mr-2"></i>
                    Create First Actor
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {actors.map((actor) => (
                    <motion.div
                      key={actor.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="glass-input p-4 rounded-lg glow-hover cursor-pointer"
                      onClick={() => setSelectedActor(actor)}
                      data-testid={`actor-card-${actor.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
                            <i className="fas fa-robot text-primary"></i>
                          </div>
                          <div>
                            <h4 className="font-semibold" data-testid={`actor-name-${actor.id}`}>{actor.name}</h4>
                            <p className="text-sm text-muted-foreground">{actor.actorId}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-3">
                          <Badge className={getActorStatusColor(actor)}>
                            {actor.lastRun ? `Last run: ${new Date(actor.lastRun).toLocaleTimeString()}` : "Never run"}
                          </Badge>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRunActor(actor.id);
                            }}
                            disabled={runActorMutation.isPending}
                            className="glow-hover"
                            data-testid={`run-actor-${actor.id}`}
                          >
                            {runActorMutation.isPending ? (
                              <i className="fas fa-spinner fa-spin text-sm"></i>
                            ) : (
                              <i className="fas fa-play text-primary text-sm"></i>
                            )}
                          </Button>
                        </div>
                      </div>
                      
                      {actor.lastRun && (
                        <div className="mt-3 text-xs text-muted-foreground">
                          Last execution: {new Date(actor.lastRun).toLocaleString()}
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </Card>
          </motion.div>

          {/* Actor Details & Dataset Preview */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2, delay: 0.2 }}
          >
            <Card className="glass-panel p-6 rounded-lg">
              <h3 className="enterprise-heading text-lg font-semibold mb-4">
                {selectedActor ? "Actor Details" : "Dataset Preview"}
              </h3>
              
              {selectedActor ? (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">{selectedActor.name}</h4>
                    <p className="text-sm text-muted-foreground mb-3">{selectedActor.actorId}</p>
                    
                    <div className="glass-input p-3 rounded-lg">
                      <h5 className="text-sm font-medium mb-2">Configuration</h5>
                      <pre className="text-xs text-muted-foreground overflow-auto">
                        {JSON.stringify(selectedActor.configurationJson, null, 2)}
                      </pre>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Button
                      onClick={() => handleRunActor(selectedActor.id)}
                      disabled={runActorMutation.isPending}
                      className="w-full bg-primary text-primary-foreground glow-hover"
                      data-testid={`run-selected-actor`}
                    >
                      <i className="fas fa-play mr-2"></i>
                      Run Actor
                    </Button>
                    
                    <Button
                      variant="outline"
                      className="w-full glass-input glow-hover"
                      data-testid={`monitor-actor`}
                    >
                      <i className="fas fa-chart-line mr-2"></i>
                      Monitor Runs
                    </Button>
                    
                    <Button
                      variant="outline"
                      className="w-full glass-input glow-hover"
                      data-testid={`import-dataset`}
                    >
                      <i className="fas fa-download mr-2"></i>
                      Import Dataset
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground mb-4">
                    Select an actor to view its dataset preview
                  </p>
                  
                  {/* Mock dataset preview */}
                  <div className="space-y-2 text-xs">
                    <div className="glass-input p-3 rounded-lg">
                      <div className="font-medium">John Smith</div>
                      <div className="text-muted-foreground">john.smith@email.com</div>
                      <div className="text-muted-foreground">Senior Developer @ TechCorp</div>
                    </div>
                    <div className="glass-input p-3 rounded-lg">
                      <div className="font-medium">Sarah Wilson</div>
                      <div className="text-muted-foreground">s.wilson@company.com</div>
                      <div className="text-muted-foreground">Product Manager @ StartupX</div>
                    </div>
                    <div className="glass-input p-3 rounded-lg">
                      <div className="font-medium">Mike Johnson</div>
                      <div className="text-muted-foreground">mike.j@enterprise.com</div>
                      <div className="text-muted-foreground">Tech Lead @ BigCorp</div>
                    </div>
                  </div>
                  
                  <div className="text-center pt-4">
                    <p className="text-xs text-muted-foreground">
                      Dataset previews appear when actors complete runs
                    </p>
                  </div>
                </div>
              )}
            </Card>
          </motion.div>
        </div>

        {/* Actor Runs & Monitoring */}
        {selectedActor && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.3 }}
            className="mt-6"
          >
            <Card className="glass-panel p-6 rounded-lg">
              <h3 className="enterprise-heading text-lg font-semibold mb-4">Recent Runs</h3>
              
              <div className="space-y-3">
                {/* Mock run data - would be fetched from Apify API */}
                {[
                  { id: "run-1", status: "SUCCEEDED", startedAt: new Date(Date.now() - 3600000).toISOString(), finishedAt: new Date(Date.now() - 3000000).toISOString() },
                  { id: "run-2", status: "RUNNING", startedAt: new Date(Date.now() - 1800000).toISOString() },
                  { id: "run-3", status: "FAILED", startedAt: new Date(Date.now() - 7200000).toISOString(), finishedAt: new Date(Date.now() - 6600000).toISOString() },
                ].map((run) => (
                  <div key={run.id} className="glass-input p-4 rounded-lg" data-testid={`run-${run.id}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full ${
                          run.status === "SUCCEEDED" ? "bg-accent" :
                          run.status === "RUNNING" ? "bg-primary" :
                          "bg-destructive"
                        }`}></div>
                        <span className="font-medium">Run {run.id}</span>
                        <Badge variant="outline" className={
                          run.status === "SUCCEEDED" ? "border-accent text-accent" :
                          run.status === "RUNNING" ? "border-primary text-primary" :
                          "border-destructive text-destructive"
                        }>
                          {run.status}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="glow-hover"
                          data-testid={`view-run-${run.id}`}
                        >
                          <i className="fas fa-eye text-sm"></i>
                        </Button>
                        {run.status === "SUCCEEDED" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="glow-hover"
                            data-testid={`import-run-${run.id}`}
                          >
                            <i className="fas fa-download text-sm"></i>
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-xs text-muted-foreground">
                      Started: {new Date(run.startedAt).toLocaleString()}
                      {run.finishedAt && (
                        <> • Finished: {new Date(run.finishedAt).toLocaleString()}</>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}

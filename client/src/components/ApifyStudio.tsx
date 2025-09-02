import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion } from "framer-motion";
import { useMCPClient } from "@/lib/mcp-client";
import type { ApifyActor } from "@shared/schema";

interface ActorConfiguration {
  targetWebsite: string;
  selectors: {
    name: string;
    email: string;
    title: string;
    company: string;
  };
  pagination: {
    type: "auto" | "button" | "url";
    selector?: string;
    pattern?: string;
  };
  filters: {
    location?: string;
    experience?: string;
    keywords?: string[];
  };
}

export default function ApifyStudio() {
  const [selectedActor, setSelectedActor] = useState<ApifyActor | null>(null);
  const [configuration, setConfiguration] = useState<ActorConfiguration>({
    targetWebsite: "",
    selectors: {
      name: "",
      email: "",
      title: "",
      company: "",
    },
    pagination: {
      type: "auto",
    },
    filters: {},
  });

  const queryClient = useQueryClient();
  const { callTool } = useMCPClient();

  const { data: actors = [], isLoading } = useQuery<ApifyActor[]>({
    queryKey: ["/api/apify/actors"],
  });

  const runActorMutation = useMutation({
    mutationFn: async (actorId: string) => {
      return await callTool("manage_apify_actor", {
        action: "run",
        actorId,
        configuration,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/apify/actors"] });
    },
  });

  const saveConfigurationMutation = useMutation({
    mutationFn: async ({ actorId, config }: { actorId: string; config: ActorConfiguration }) => {
      return await callTool("manage_apify_actor", {
        action: "update",
        actorId,
        configuration: config,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/apify/actors"] });
    },
  });

  const handleSaveConfiguration = () => {
    if (!selectedActor) return;
    saveConfigurationMutation.mutate({
      actorId: selectedActor.id,
      config: configuration,
    });
  };

  const handleRunActor = () => {
    if (!selectedActor) return;
    runActorMutation.mutate(selectedActor.id);
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-muted rounded w-64"></div>
        <div className="grid grid-cols-3 gap-6">
          {Array(3).fill(0).map((_, i) => (
            <div key={i} className="h-96 bg-muted rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Actor Selection */}
      <Card className="glass-panel p-6 rounded-lg">
        <h3 className="enterprise-heading text-lg font-semibold mb-4">Select Actor to Configure</h3>
        
        {actors.length === 0 ? (
          <div className="text-center py-8">
            <i className="fas fa-robot text-4xl text-muted-foreground mb-4"></i>
            <p className="text-muted-foreground">No Apify actors available. Create one first.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {actors.map((actor) => (
              <motion.div
                key={actor.id}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                className={`glass-input p-4 rounded-lg cursor-pointer glow-hover ${
                  selectedActor?.id === actor.id ? "ring-2 ring-primary" : ""
                }`}
                onClick={() => {
                  setSelectedActor(actor);
                  if (actor.configurationJson) {
                    setConfiguration(actor.configurationJson as ActorConfiguration);
                  }
                }}
                data-testid={`select-actor-${actor.id}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold">{actor.name}</h4>
                  <Badge className={
                    actor.lastRun ? "bg-accent/20 text-accent" : "bg-muted text-muted-foreground"
                  }>
                    {actor.lastRun ? "Active" : "Idle"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{actor.actorId}</p>
                {actor.lastRun && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Last run: {new Date(actor.lastRun).toLocaleString()}
                  </p>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </Card>

      {/* Configuration Panel */}
      {selectedActor && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <Card className="glass-panel p-6 rounded-lg">
            <div className="flex items-center justify-between mb-6">
              <h3 className="enterprise-heading text-lg font-semibold">
                Configure: {selectedActor.name}
              </h3>
              <div className="flex items-center space-x-3">
                <Button
                  onClick={handleSaveConfiguration}
                  disabled={saveConfigurationMutation.isPending}
                  variant="outline"
                  className="glass-input glow-hover"
                  data-testid="save-configuration"
                >
                  <i className="fas fa-save mr-2"></i>
                  Save Config
                </Button>
                <Button
                  onClick={handleRunActor}
                  disabled={runActorMutation.isPending}
                  className="bg-primary text-primary-foreground glow-hover"
                  data-testid="run-configured-actor"
                >
                  {runActorMutation.isPending ? (
                    <>
                      <i className="fas fa-spinner fa-spin mr-2"></i>
                      Running...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-play mr-2"></i>
                      Run Actor
                    </>
                  )}
                </Button>
              </div>
            </div>

            <Tabs defaultValue="target" className="w-full">
              <TabsList className="glass-panel p-1 rounded-lg w-full">
                <TabsTrigger value="target" className="flex-1" data-testid="tab-target">Target</TabsTrigger>
                <TabsTrigger value="selectors" className="flex-1" data-testid="tab-selectors">Selectors</TabsTrigger>
                <TabsTrigger value="pagination" className="flex-1" data-testid="tab-pagination">Pagination</TabsTrigger>
                <TabsTrigger value="filters" className="flex-1" data-testid="tab-filters">Filters</TabsTrigger>
              </TabsList>

              <TabsContent value="target" className="mt-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Target Website URL</label>
                    <Input
                      placeholder="https://linkedin.com/jobs/search/"
                      value={configuration.targetWebsite}
                      onChange={(e) => setConfiguration(prev => ({ 
                        ...prev, 
                        targetWebsite: e.target.value 
                      }))}
                      className="glass-input"
                      data-testid="target-website-input"
                    />
                  </div>
                  
                  <div className="glass-input p-4 rounded-lg">
                    <h4 className="font-medium mb-2">Website Preview</h4>
                    <div className="h-32 bg-muted/20 rounded border-2 border-dashed border-border flex items-center justify-center">
                      <div className="text-center">
                        <i className="fas fa-globe text-2xl text-muted-foreground mb-2"></i>
                        <p className="text-sm text-muted-foreground">
                          {configuration.targetWebsite || "Enter URL to preview"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="selectors" className="mt-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Name Selector</label>
                      <Input
                        placeholder=".candidate-name, [data-name]"
                        value={configuration.selectors.name}
                        onChange={(e) => setConfiguration(prev => ({
                          ...prev,
                          selectors: { ...prev.selectors, name: e.target.value }
                        }))}
                        className="glass-input"
                        data-testid="name-selector-input"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-2">Email Selector</label>
                      <Input
                        placeholder=".email, [data-email]"
                        value={configuration.selectors.email}
                        onChange={(e) => setConfiguration(prev => ({
                          ...prev,
                          selectors: { ...prev.selectors, email: e.target.value }
                        }))}
                        className="glass-input"
                        data-testid="email-selector-input"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-2">Job Title Selector</label>
                      <Input
                        placeholder=".job-title, [data-title]"
                        value={configuration.selectors.title}
                        onChange={(e) => setConfiguration(prev => ({
                          ...prev,
                          selectors: { ...prev.selectors, title: e.target.value }
                        }))}
                        className="glass-input"
                        data-testid="title-selector-input"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-2">Company Selector</label>
                      <Input
                        placeholder=".company, [data-company]"
                        value={configuration.selectors.company}
                        onChange={(e) => setConfiguration(prev => ({
                          ...prev,
                          selectors: { ...prev.selectors, company: e.target.value }
                        }))}
                        className="glass-input"
                        data-testid="company-selector-input"
                      />
                    </div>
                  </div>

                  <div className="glass-input p-4 rounded-lg">
                    <h4 className="font-medium mb-2">Selector Testing</h4>
                    <div className="space-y-2">
                      <Button variant="outline" className="w-full glow-hover" data-testid="test-selectors">
                        <i className="fas fa-search mr-2"></i>
                        Test Selectors on Target Site
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        This will validate your CSS selectors against the target website
                      </p>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="pagination" className="mt-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Pagination Type</label>
                    <Select
                      value={configuration.pagination.type}
                      onValueChange={(value: "auto" | "button" | "url") => 
                        setConfiguration(prev => ({
                          ...prev,
                          pagination: { ...prev.pagination, type: value }
                        }))
                      }
                    >
                      <SelectTrigger className="glass-input" data-testid="pagination-type-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Auto-detect</SelectItem>
                        <SelectItem value="button">Next button</SelectItem>
                        <SelectItem value="url">URL pattern</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {configuration.pagination.type === "button" && (
                    <div>
                      <label className="block text-sm font-medium mb-2">Next Button Selector</label>
                      <Input
                        placeholder=".next-btn, .pagination-next"
                        value={configuration.pagination.selector || ""}
                        onChange={(e) => setConfiguration(prev => ({
                          ...prev,
                          pagination: { ...prev.pagination, selector: e.target.value }
                        }))}
                        className="glass-input"
                        data-testid="pagination-selector-input"
                      />
                    </div>
                  )}

                  {configuration.pagination.type === "url" && (
                    <div>
                      <label className="block text-sm font-medium mb-2">URL Pattern</label>
                      <Input
                        placeholder="https://site.com/page={page}"
                        value={configuration.pagination.pattern || ""}
                        onChange={(e) => setConfiguration(prev => ({
                          ...prev,
                          pagination: { ...prev.pagination, pattern: e.target.value }
                        }))}
                        className="glass-input"
                        data-testid="pagination-pattern-input"
                      />
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="filters" className="mt-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Location Filter</label>
                    <Input
                      placeholder="California, Remote, New York"
                      value={configuration.filters.location || ""}
                      onChange={(e) => setConfiguration(prev => ({
                        ...prev,
                        filters: { ...prev.filters, location: e.target.value }
                      }))}
                      className="glass-input"
                      data-testid="location-filter-input"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">Experience Level</label>
                    <Select
                      value={configuration.filters.experience || ""}
                      onValueChange={(value) => setConfiguration(prev => ({
                        ...prev,
                        filters: { ...prev.filters, experience: value }
                      }))}
                    >
                      <SelectTrigger className="glass-input" data-testid="experience-filter-select">
                        <SelectValue placeholder="Any experience level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Any experience level</SelectItem>
                        <SelectItem value="entry">Entry Level</SelectItem>
                        <SelectItem value="mid">Mid Level</SelectItem>
                        <SelectItem value="senior">Senior Level</SelectItem>
                        <SelectItem value="executive">Executive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">Keywords (comma-separated)</label>
                    <Textarea
                      placeholder="react, typescript, node.js, senior developer"
                      value={configuration.filters.keywords?.join(", ") || ""}
                      onChange={(e) => setConfiguration(prev => ({
                        ...prev,
                        filters: { 
                          ...prev.filters, 
                          keywords: e.target.value.split(",").map(k => k.trim()).filter(Boolean)
                        }
                      }))}
                      className="glass-input h-20"
                      data-testid="keywords-filter-input"
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </Card>
        </motion.div>
      )}

      {/* Configuration Preview */}
      {selectedActor && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.1 }}
        >
          <Card className="glass-panel p-6 rounded-lg">
            <h3 className="enterprise-heading text-lg font-semibold mb-4">Configuration Preview</h3>
            
            <ScrollArea className="h-64">
              <pre className="text-xs text-muted-foreground glass-input p-4 rounded-lg">
                {JSON.stringify(configuration, null, 2)}
              </pre>
            </ScrollArea>

            <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
              <div className="text-sm text-muted-foreground">
                Ready to execute with current configuration
              </div>
              <div className="flex items-center space-x-3">
                <Button
                  onClick={handleSaveConfiguration}
                  disabled={saveConfigurationMutation.isPending}
                  variant="outline"
                  className="glass-input glow-hover"
                  data-testid="save-config-button"
                >
                  <i className="fas fa-save mr-2"></i>
                  Save Config
                </Button>
                <Button
                  onClick={handleRunActor}
                  disabled={runActorMutation.isPending}
                  className="bg-accent text-accent-foreground glow-hover"
                  data-testid="execute-actor-button"
                >
                  {runActorMutation.isPending ? (
                    <>
                      <i className="fas fa-spinner fa-spin mr-2"></i>
                      Executing...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-rocket mr-2"></i>
                      Execute Actor
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>
      )}
    </div>
  );
}

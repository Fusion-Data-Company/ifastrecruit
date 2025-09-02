import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import DataGrid from '@/components/DataGrid';
import { motion } from 'framer-motion';
import type { Candidate } from '@shared/schema';

export default function CandidatesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);

  const { data: candidates = [], isLoading } = useQuery<Candidate[]>({
    queryKey: ['/api/candidates'],
    refetchInterval: 30000,
  });

  const filteredCandidates = candidates.filter(candidate => {
    const matchesSearch = !searchTerm || 
      candidate.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (candidate.name && candidate.name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStage = stageFilter === 'all' || candidate.pipelineStage === stageFilter;
    
    return matchesSearch && matchesStage;
  });

  const stages = ['NEW', 'FIRST_INTERVIEW', 'TECHNICAL_SCREEN', 'FINAL_INTERVIEW', 'OFFER', 'HIRED', 'REJECTED'];

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
            <h1 className="enterprise-heading text-3xl font-bold">Candidate Management</h1>
            <p className="text-muted-foreground">Manage your talent pipeline efficiently</p>
          </div>
          <Button className="bg-primary hover:bg-primary/90" data-testid="add-candidate">
            <i className="fas fa-user-plus mr-2"></i>
            Add Candidate
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
                  <i className="fas fa-users text-blue-500"></i>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Candidates</p>
                  <p className="text-2xl font-bold">{candidates.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-panel">
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <i className="fas fa-check-circle text-green-500"></i>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active Pipeline</p>
                  <p className="text-2xl font-bold">
                    {candidates.filter(c => !['HIRED', 'REJECTED'].includes(c.pipelineStage)).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-panel">
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-orange-500/20 rounded-lg">
                  <i className="fas fa-clock text-orange-500"></i>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">In Interview</p>
                  <p className="text-2xl font-bold">
                    {candidates.filter(c => ['FIRST_INTERVIEW', 'TECHNICAL_SCREEN', 'FINAL_INTERVIEW'].includes(c.pipelineStage)).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-panel">
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <i className="fas fa-star text-purple-500"></i>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Hired</p>
                  <p className="text-2xl font-bold">
                    {candidates.filter(c => c.pipelineStage === 'HIRED').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Search and Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="glass-panel p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Search Candidates</label>
                <Input
                  placeholder="Search by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="glass-input"
                  data-testid="search-candidates"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">Filter by Stage</label>
                <Select value={stageFilter} onValueChange={setStageFilter}>
                  <SelectTrigger className="glass-input">
                    <SelectValue placeholder="All stages" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Stages</SelectItem>
                    {stages.map(stage => (
                      <SelectItem key={stage} value={stage}>
                        {stage.replace(/_/g, ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchTerm('');
                    setStageFilter('all');
                  }}
                  className="glass-input w-full"
                  data-testid="clear-filters"
                >
                  <i className="fas fa-times mr-2"></i>
                  Clear Filters
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Candidates Data Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <DataGrid />
        </motion.div>
      </div>
      </main>
    </div>
  );
}
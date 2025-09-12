import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import CandidatesTable from '@/components/CandidatesTable';
import AddCandidateDialog from '@/components/AddCandidateDialog';
import { motion } from 'framer-motion';
import type { Candidate } from '@shared/schema';

export default function CandidatesPage() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const { data: candidates = [], isLoading } = useQuery<Candidate[]>({
    queryKey: ['/api/candidates'],
  });

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <TopBar />
      <main className="md:ml-64 pt-16 p-4 md:p-6">
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
          <Button 
            className="bg-primary hover:bg-primary/90" 
            onClick={() => setIsAddDialogOpen(true)}
            data-testid="add-candidate"
          >
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
                  <p className="text-2xl font-bold">{(candidates || []).length}</p>
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
                    {(candidates || []).filter(c => !['HIRED', 'REJECTED'].includes(c.pipelineStage)).length}
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
                    {(candidates || []).filter(c => ['FIRST_INTERVIEW', 'TECHNICAL_SCREEN', 'FINAL_INTERVIEW'].includes(c.pipelineStage)).length}
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
                    {(candidates || []).filter(c => c.pipelineStage === 'HIRED').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Candidates Table with Modal System */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <CandidatesTable candidates={candidates} isLoading={isLoading} />
        </motion.div>
      </div>
      </main>

      {/* Add Candidate Dialog */}
      <AddCandidateDialog 
        open={isAddDialogOpen} 
        onOpenChange={setIsAddDialogOpen} 
      />
    </div>
  );
}
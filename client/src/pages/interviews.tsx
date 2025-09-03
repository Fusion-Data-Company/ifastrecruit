import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Calendar from '@/components/Calendar';
import { motion } from 'framer-motion';
import type { Interview } from '@shared/schema';

export default function InterviewsPage() {
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: interviews = [], isLoading, error } = useQuery<Interview[]>({
    queryKey: ['/api/interviews'],
  });

  const filteredInterviews = (interviews || []).filter(interview => {
    if (statusFilter === 'all') return true;
    return interview.status === statusFilter;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-500/20 text-blue-500';
      case 'completed': return 'bg-green-500/20 text-green-500';
      case 'cancelled': return 'bg-red-500/20 text-red-500';
      case 'no-show': return 'bg-orange-500/20 text-orange-500';
      default: return 'bg-gray-500/20 text-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'scheduled': return 'fas fa-calendar-check';
      case 'completed': return 'fas fa-check-circle';
      case 'cancelled': return 'fas fa-times-circle';
      case 'no-show': return 'fas fa-exclamation-triangle';
      default: return 'fas fa-question-circle';
    }
  };

  const todayInterviews = (interviews || []).filter(interview => {
    const today = new Date();
    const interviewDate = new Date(interview.scheduledAt);
    return interviewDate.toDateString() === today.toDateString();
  });

  const upcomingInterviews = (interviews || []).filter(interview => {
    const today = new Date();
    const interviewDate = new Date(interview.scheduledAt);
    return interviewDate > today && interview.status === 'scheduled';
  });

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
            <h1 className="enterprise-heading text-3xl font-bold">Interview Management</h1>
            <p className="text-muted-foreground">Schedule and track all interviews</p>
          </div>
          <div className="flex items-center space-x-3">
            <Select value={viewMode} onValueChange={(value: 'calendar' | 'list') => setViewMode(value)}>
              <SelectTrigger className="glass-input w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="calendar">Calendar View</SelectItem>
                <SelectItem value="list">List View</SelectItem>
              </SelectContent>
            </Select>
            <Button className="bg-primary hover:bg-primary/90" data-testid="schedule-interview">
              <i className="fas fa-calendar-plus mr-2"></i>
              Schedule Interview
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
                  <i className="fas fa-calendar text-blue-500"></i>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Today's Interviews</p>
                  <p className="text-2xl font-bold">{todayInterviews.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-panel">
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <i className="fas fa-clock text-green-500"></i>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Upcoming</p>
                  <p className="text-2xl font-bold">{upcomingInterviews.length}</p>
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
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold">
                    {(interviews || []).filter(i => i.status === 'completed').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-panel">
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-orange-500/20 rounded-lg">
                  <i className="fas fa-percentage text-orange-500"></i>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Completion Rate</p>
                  <p className="text-2xl font-bold">
                    {(interviews || []).length > 0 
                      ? Math.round(((interviews || []).filter(i => i.status === 'completed').length / (interviews || []).length) * 100)
                      : 0}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="glass-panel p-6">
            <div className="flex items-center space-x-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Filter by Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="glass-input w-48">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="no-show">No Show</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={() => setStatusFilter('all')}
                  className="glass-input"
                  data-testid="clear-filters"
                >
                  <i className="fas fa-times mr-2"></i>
                  Clear
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          {viewMode === 'calendar' ? (
            <Calendar />
          ) : (
            <Card className="glass-panel">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <i className="fas fa-list"></i>
                  <span>Interview List</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8">
                    <i className="fas fa-spinner fa-spin text-2xl text-muted-foreground"></i>
                    <p className="text-muted-foreground mt-2">Loading interviews...</p>
                  </div>
                ) : filteredInterviews.length === 0 ? (
                  <div className="text-center py-8">
                    <i className="fas fa-calendar-times text-4xl text-muted-foreground mb-4"></i>
                    <p className="text-muted-foreground">No interviews found</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredInterviews.map((interview) => (
                      <motion.div
                        key={interview.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/5 micro-animation"
                      >
                        <div className="flex items-center space-x-4">
                          <div className={`p-2 rounded-lg ${getStatusColor(interview.status)}`}>
                            <i className={`${getStatusIcon(interview.status)} text-sm`}></i>
                          </div>
                          <div>
                            <p className="font-medium">{interview.candidateEmail}</p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(interview.scheduledAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <Badge variant="outline" className={getStatusColor(interview.status)}>
                            {interview.status}
                          </Badge>
                          <Button variant="ghost" size="sm" data-testid={`interview-${interview.id}`}>
                            <i className="fas fa-chevron-right"></i>
                          </Button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </motion.div>
      </div>
      </main>
    </div>
  );
}
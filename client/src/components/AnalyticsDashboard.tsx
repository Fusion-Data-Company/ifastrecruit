import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion } from 'framer-motion';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, RadialBarChart, RadialBar
} from 'recharts';
import { useState } from 'react';
import { format, subDays, startOfDay } from 'date-fns';
import type { Candidate } from '@shared/schema';

interface AnalyticsDashboardProps {
  className?: string;
}

interface AnalyticsData {
  pipelineMetrics: {
    stage: string;
    count: number;
    conversionRate: number;
    avgTimeInStage: number;
  }[];
  sourcePerformance: {
    source: string;
    candidates: number;
    hiredCount: number;
    conversionRate: number;
    avgScore: number;
  }[];
  timeMetrics: {
    avgTimeToHire: number;
    avgTimeToFirstInterview: number;
    avgTimeToOffer: number;
  };
  scoreDistribution: {
    range: string;
    count: number;
    percentage: number;
  }[];
  trendsData: {
    date: string;
    applications: number;
    interviews: number;
    offers: number;
    hires: number;
  }[];
  performanceKPIs: {
    totalCandidates: number;
    activeInPipeline: number;
    averageScore: number;
    conversionRate: number;
    timeToHire: number;
    qualityScore: number;
  };
}

const COLORS = {
  primary: '#3b82f6',
  secondary: '#10b981',
  accent: '#8b5cf6',
  warning: '#f59e0b',
  danger: '#ef4444',
  muted: '#6b7280',
};

const PIPELINE_COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#84cc16'];

export default function AnalyticsDashboard({ className }: AnalyticsDashboardProps) {
  const [timeRange, setTimeRange] = useState('30d');
  const [chartType, setChartType] = useState('overview');

  // Fetch candidates data for analytics
  const { data: candidates = [] } = useQuery<Candidate[]>({
    queryKey: ["/api/candidates"],
  });

  // Generate analytics data from candidates
  const safeC = candidates || [];
  const analyticsData: AnalyticsData = {
    pipelineMetrics: [
      { stage: 'New', count: safeC.filter(c => c.pipelineStage === 'NEW').length, conversionRate: 85, avgTimeInStage: 2.3 },
      { stage: 'First Interview', count: safeC.filter(c => c.pipelineStage === 'FIRST_INTERVIEW').length, conversionRate: 65, avgTimeInStage: 5.1 },
      { stage: 'In Slack', count: safeC.filter(c => c.pipelineStage === 'TECHNICAL_SCREEN').length, conversionRate: 45, avgTimeInStage: 7.2 },
      { stage: 'Final Interview', count: safeC.filter(c => c.pipelineStage === 'FINAL_INTERVIEW').length, conversionRate: 78, avgTimeInStage: 4.6 },
      { stage: 'Offer', count: safeC.filter(c => c.pipelineStage === 'OFFER').length, conversionRate: 92, avgTimeInStage: 3.1 },
      { stage: 'Hired', count: safeC.filter(c => c.pipelineStage === 'HIRED').length, conversionRate: 100, avgTimeInStage: 0 },
    ],
    sourcePerformance: [
      { source: 'Apify', candidates: safeC.filter(c => c.campaignId).length, hiredCount: 12, conversionRate: 8.5, avgScore: 78 },
      { source: 'Manual Entry', candidates: safeC.filter(c => !c.campaignId).length, hiredCount: 8, conversionRate: 12.3, avgScore: 82 },
      { source: 'Referrals', candidates: 23, hiredCount: 6, conversionRate: 26.1, avgScore: 89 },
      { source: 'LinkedIn', candidates: 31, hiredCount: 4, conversionRate: 12.9, avgScore: 75 },
    ],
    timeMetrics: {
      avgTimeToHire: 18.5,
      avgTimeToFirstInterview: 3.2,
      avgTimeToOffer: 14.7,
    },
    scoreDistribution: [
      { range: '90-100', count: safeC.filter(c => (c.score || 0) >= 90).length, percentage: 15 },
      { range: '80-89', count: safeC.filter(c => (c.score || 0) >= 80 && (c.score || 0) < 90).length, percentage: 25 },
      { range: '70-79', count: safeC.filter(c => (c.score || 0) >= 70 && (c.score || 0) < 80).length, percentage: 35 },
      { range: '60-69', count: safeC.filter(c => (c.score || 0) >= 60 && (c.score || 0) < 70).length, percentage: 20 },
      { range: '< 60', count: safeC.filter(c => (c.score || 0) < 60).length, percentage: 5 },
    ],
    trendsData: Array.from({ length: 30 }, (_, i) => {
      const date = format(subDays(new Date(), 29 - i), 'MMM dd');
      return {
        date,
        applications: Math.floor(Math.random() * 15) + 5,
        interviews: Math.floor(Math.random() * 8) + 2,
        offers: Math.floor(Math.random() * 3) + 1,
        hires: Math.floor(Math.random() * 2),
      };
    }),
    performanceKPIs: {
      totalCandidates: safeC.length,
      activeInPipeline: safeC.filter(c => !['HIRED', 'REJECTED'].includes(c.pipelineStage)).length,
      averageScore: safeC.length > 0 ? Math.round(safeC.reduce((sum, c) => sum + (c.score || 0), 0) / safeC.length) : 0,
      conversionRate: 8.7,
      timeToHire: 18.5,
      qualityScore: 85,
    },
  };

  const renderKPICard = (title: string, value: string | number, subtitle: string, icon: string, trend?: number) => (
    <Card className="glass-panel p-6 h-full">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold enterprise-heading">{value}</p>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
          <i className={`${icon} text-primary text-lg`}></i>
        </div>
      </div>
      {trend && (
        <div className="mt-4 flex items-center space-x-2">
          <i className={`fas ${trend > 0 ? 'fa-arrow-up text-green-500' : 'fa-arrow-down text-red-500'} text-sm`}></i>
          <span className={`text-sm ${trend > 0 ? 'text-green-500' : 'text-red-500'}`}>
            {Math.abs(trend)}% from last month
          </span>
        </div>
      )}
    </Card>
  );

  const renderChart = () => {
    switch (chartType) {
      case 'pipeline':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analyticsData.pipelineMetrics}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="stage" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(0,0,0,0.8)', 
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px' 
                }}
              />
              <Bar dataKey="count" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'trends':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={analyticsData.trendsData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="date" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(0,0,0,0.8)', 
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px' 
                }}
              />
              <Area type="monotone" dataKey="applications" stackId="1" stroke={COLORS.primary} fill={COLORS.primary} fillOpacity={0.6} />
              <Area type="monotone" dataKey="interviews" stackId="1" stroke={COLORS.secondary} fill={COLORS.secondary} fillOpacity={0.6} />
              <Area type="monotone" dataKey="offers" stackId="1" stroke={COLORS.accent} fill={COLORS.accent} fillOpacity={0.6} />
              <Area type="monotone" dataKey="hires" stackId="1" stroke={COLORS.warning} fill={COLORS.warning} fillOpacity={0.6} />
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'sources':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={analyticsData.sourcePerformance}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={120}
                paddingAngle={5}
                dataKey="candidates"
              >
                {analyticsData.sourcePerformance.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={PIPELINE_COLORS[index % PIPELINE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(0,0,0,0.8)', 
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px' 
                }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );

      default:
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={analyticsData.trendsData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="date" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(0,0,0,0.8)', 
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px' 
                }}
              />
              <Legend />
              <Line type="monotone" dataKey="applications" stroke={COLORS.primary} strokeWidth={3} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="interviews" stroke={COLORS.secondary} strokeWidth={3} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="hires" stroke={COLORS.accent} strokeWidth={3} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        );
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="enterprise-heading text-2xl font-bold">Analytics Dashboard</h2>
          <p className="text-muted-foreground">Comprehensive recruiting performance insights</p>
        </div>
        <div className="flex items-center space-x-3">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="glass-input w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" className="glass-input">
            <i className="fas fa-download mr-2"></i>
            Export
          </Button>
        </div>
      </div>

      {/* KPI Overview */}
      <motion.div 
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, staggerChildren: 0.1 }}
      >
        {renderKPICard(
          "Total Candidates", 
          analyticsData.performanceKPIs.totalCandidates, 
          "In pipeline", 
          "fas fa-users", 
          12
        )}
        {renderKPICard(
          "Active Pipeline", 
          analyticsData.performanceKPIs.activeInPipeline, 
          "Currently reviewing", 
          "fas fa-stream", 
          8
        )}
        {renderKPICard(
          "Average Score", 
          analyticsData.performanceKPIs.averageScore, 
          "Candidate quality", 
          "fas fa-star", 
          3
        )}
        {renderKPICard(
          "Conversion Rate", 
          `${analyticsData.performanceKPIs.conversionRate}%`, 
          "Application to hire", 
          "fas fa-chart-line", 
          -2
        )}
        {renderKPICard(
          "Time to Hire", 
          `${analyticsData.performanceKPIs.timeToHire}d`, 
          "Average days", 
          "fas fa-clock", 
          -15
        )}
        {renderKPICard(
          "Quality Score", 
          analyticsData.performanceKPIs.qualityScore, 
          "Overall rating", 
          "fas fa-trophy", 
          7
        )}
      </motion.div>

      {/* Main Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart Panel */}
        <Card className="glass-panel p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h3 className="enterprise-heading text-lg font-semibold">Performance Analytics</h3>
            <div className="flex items-center space-x-2">
              <Button
                variant={chartType === 'overview' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setChartType('overview')}
                className="glass-input"
              >
                Overview
              </Button>
              <Button
                variant={chartType === 'pipeline' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setChartType('pipeline')}
                className="glass-input"
              >
                Pipeline
              </Button>
              <Button
                variant={chartType === 'trends' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setChartType('trends')}
                className="glass-input"
              >
                Trends
              </Button>
              <Button
                variant={chartType === 'sources' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setChartType('sources')}
                className="glass-input"
              >
                Sources
              </Button>
            </div>
          </div>
          {renderChart()}
        </Card>
      </div>

      {/* Detailed Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline Conversion */}
        <Card className="glass-panel p-6">
          <h3 className="enterprise-heading text-lg font-semibold mb-4">Pipeline Conversion Rates</h3>
          <div className="space-y-4">
            {analyticsData.pipelineMetrics.map((stage, index) => (
              <div key={stage.stage} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{stage.stage}</span>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="text-xs">
                      {stage.count} candidates
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {stage.conversionRate}%
                    </span>
                  </div>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <motion.div
                    className="h-2 rounded-full bg-primary"
                    initial={{ width: 0 }}
                    animate={{ width: `${stage.conversionRate}%` }}
                    transition={{ duration: 0.8, delay: index * 0.1 }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Avg. time in stage: {stage.avgTimeInStage} days
                </p>
              </div>
            ))}
          </div>
        </Card>

        {/* Source Performance */}
        <Card className="glass-panel p-6">
          <h3 className="enterprise-heading text-lg font-semibold mb-4">Source Performance</h3>
          <div className="space-y-4">
            {analyticsData.sourcePerformance.map((source, index) => (
              <div key={source.source} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div className="space-y-1">
                  <p className="font-medium">{source.source}</p>
                  <p className="text-sm text-muted-foreground">
                    {source.candidates} candidates • {source.hiredCount} hired
                  </p>
                </div>
                <div className="text-right space-y-1">
                  <Badge 
                    variant={source.conversionRate > 15 ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    {source.conversionRate}% conversion
                  </Badge>
                  <p className="text-xs text-muted-foreground">
                    Avg. score: {source.avgScore}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Score Distribution */}
        <Card className="glass-panel p-6">
          <h3 className="enterprise-heading text-lg font-semibold mb-4">Candidate Score Distribution</h3>
          <div className="space-y-3">
            {analyticsData.scoreDistribution.map((range, index) => (
              <div key={range.range} className="flex items-center space-x-3">
                <div className="w-16 text-sm font-medium">{range.range}</div>
                <div className="flex-1">
                  <div className="w-full bg-muted rounded-full h-3">
                    <motion.div
                      className="h-3 rounded-full"
                      style={{ backgroundColor: PIPELINE_COLORS[index] }}
                      initial={{ width: 0 }}
                      animate={{ width: `${range.percentage}%` }}
                      transition={{ duration: 0.8, delay: index * 0.1 }}
                    />
                  </div>
                </div>
                <div className="w-12 text-sm text-right">{range.count}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* Time Metrics */}
        <Card className="glass-panel p-6">
          <h3 className="enterprise-heading text-lg font-semibold mb-4">Time to Action Metrics</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10">
              <div className="flex items-center space-x-3">
                <i className="fas fa-stopwatch text-primary"></i>
                <span className="font-medium">Time to First Interview</span>
              </div>
              <span className="text-lg font-bold">{analyticsData.timeMetrics.avgTimeToFirstInterview} days</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/10">
              <div className="flex items-center space-x-3">
                <i className="fas fa-handshake text-secondary"></i>
                <span className="font-medium">Time to Offer</span>
              </div>
              <span className="text-lg font-bold">{analyticsData.timeMetrics.avgTimeToOffer} days</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-accent/10">
              <div className="flex items-center space-x-3">
                <i className="fas fa-user-check text-accent"></i>
                <span className="font-medium">Time to Hire</span>
              </div>
              <span className="text-lg font-bold">{analyticsData.timeMetrics.avgTimeToHire} days</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
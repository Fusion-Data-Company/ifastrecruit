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
import { format, subDays, startOfDay, differenceInDays, parseISO } from 'date-fns';
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

  // Generate analytics data from candidates with robust validation
  const safeC = Array.isArray(candidates) ? candidates : [];
  
  // Helper function to safely parse dates
  const safeParseDate = (dateString: string | null | undefined): Date | null => {
    if (!dateString) return null;
    try {
      const parsed = new Date(dateString);
      return isNaN(parsed.getTime()) ? null : parsed;
    } catch {
      return null;
    }
  };
  
  // Helper function to safely get score values
  const getSafeScore = (candidate: Candidate): number => {
    const score = candidate.overallScore ?? candidate.score ?? 0;
    return typeof score === 'number' && !isNaN(score) && score >= 0 ? score : 0;
  };
  
  // Helper function to validate pipeline stage
  const isValidPipelineStage = (stage: string | null | undefined): boolean => {
    const validStages = ['NEW', 'FIRST_INTERVIEW', 'TECHNICAL_SCREEN', 'FINAL_INTERVIEW', 'OFFER', 'HIRED', 'REJECTED'];
    return typeof stage === 'string' && validStages.includes(stage);
  };
  
  // Filter candidates with basic data validation
  const validCandidates = safeC.filter(c => 
    c && 
    typeof c.id === 'string' && 
    typeof c.name === 'string' && 
    isValidPipelineStage(c.pipelineStage)
  );
  
  // Helper function to calculate time range filtered candidates
  const getFilteredCandidates = () => {
    const now = new Date();
    
    const getCutoffDate = (days: number): Date => {
      try {
        return subDays(now, days);
      } catch {
        return new Date(now.getTime() - (days * 24 * 60 * 60 * 1000)); // Fallback calculation
      }
    };
    
    const filterByTimeRange = (days: number) => {
      const cutoff = getCutoffDate(days);
      return validCandidates.filter(c => {
        const createdDate = safeParseDate(c.createdAt);
        return createdDate && createdDate >= cutoff;
      });
    };
    
    switch (timeRange) {
      case '7d': return filterByTimeRange(7);
      case '30d': return filterByTimeRange(30);
      case '90d': return filterByTimeRange(90);
      case '1y': return filterByTimeRange(365);
      default: return validCandidates;
    }
  };
  
  const filteredCandidates = getFilteredCandidates();
  
  // Calculate stage progression and conversion rates
  const stageOrder = ['NEW', 'FIRST_INTERVIEW', 'TECHNICAL_SCREEN', 'FINAL_INTERVIEW', 'OFFER', 'HIRED'];
  const stageCounts = stageOrder.map(stage => filteredCandidates.filter(c => c.pipelineStage === stage).length);
  
  // Calculate conversion rates between stages
  const calculateConversionRate = (fromStageIndex: number) => {
    if (fromStageIndex >= stageCounts.length - 1) return 100;
    const fromCount = stageCounts.slice(fromStageIndex).reduce((sum, count) => sum + count, 0);
    const toCount = stageCounts.slice(fromStageIndex + 1).reduce((sum, count) => sum + count, 0);
    return fromCount > 0 ? Math.round((toCount / fromCount) * 100) : 0;
  };
  
  // Calculate average time in stage
  // Note: Since we don't have stage transition timestamps, this provides an approximation
  // based on the candidate's overall time in the system. For active candidates, this 
  // represents minimum time in current stage. For completed stages, this is an estimate.
  const calculateAvgTimeInStage = (stage: string) => {
    const candidatesInStage = filteredCandidates.filter(c => c.pipelineStage === stage && c.createdAt);
    if (candidatesInStage.length === 0) return 0;
    
    const totalDays = candidatesInStage.reduce((sum, candidate) => {
      const createdDate = new Date(candidate.createdAt!);
      
      // For candidates with interview dates, use that as a more accurate reference
      if (candidate.interviewDate) {
        const interviewDate = new Date(candidate.interviewDate);
        // If they're past first interview stage, calculate from interview date
        if (['TECHNICAL_SCREEN', 'FINAL_INTERVIEW', 'OFFER', 'HIRED'].includes(stage)) {
          return sum + Math.max(1, differenceInDays(new Date(), interviewDate));
        }
      }
      
      // For active candidates in current stage, calculate time since creation
      // This gives a minimum time in stage for active candidates
      return sum + Math.max(1, differenceInDays(new Date(), createdDate));
    }, 0);
    
    return Math.round((totalDays / candidatesInStage.length) * 10) / 10;
  };
  
  const analyticsData: AnalyticsData = {
    pipelineMetrics: [
      { 
        stage: 'New', 
        count: stageCounts[0], 
        conversionRate: calculateConversionRate(0), 
        avgTimeInStage: calculateAvgTimeInStage('NEW') 
      },
      { 
        stage: 'First Interview', 
        count: stageCounts[1], 
        conversionRate: calculateConversionRate(1), 
        avgTimeInStage: calculateAvgTimeInStage('FIRST_INTERVIEW') 
      },
      { 
        stage: 'In Slack', 
        count: stageCounts[2], 
        conversionRate: calculateConversionRate(2), 
        avgTimeInStage: calculateAvgTimeInStage('TECHNICAL_SCREEN') 
      },
      { 
        stage: 'Final Interview', 
        count: stageCounts[3], 
        conversionRate: calculateConversionRate(3), 
        avgTimeInStage: calculateAvgTimeInStage('FINAL_INTERVIEW') 
      },
      { 
        stage: 'Offer', 
        count: stageCounts[4], 
        conversionRate: calculateConversionRate(4), 
        avgTimeInStage: calculateAvgTimeInStage('OFFER') 
      },
      { 
        stage: 'Hired', 
        count: stageCounts[5], 
        conversionRate: 100, 
        avgTimeInStage: 0 
      },
    ],
    sourcePerformance: (() => {
      // Group candidates by their source
      const sourceGroups: Record<string, Candidate[]> = {};
      
      filteredCandidates.forEach(candidate => {
        let source = 'Unknown';
        
        // Determine source based on available data
        if (candidate.agentId || candidate.conversationId) {
          source = 'ElevenLabs AI';
        } else if (candidate.campaignId) {
          source = 'Apify Campaign';
        } else if (candidate.sourceRef === 'manual') {
          source = 'Manual Entry';
        } else if (candidate.sourceRef) {
          source = candidate.sourceRef;
        } else if (candidate.source) {
          source = candidate.source;
        }
        
        if (!sourceGroups[source]) {
          sourceGroups[source] = [];
        }
        sourceGroups[source].push(candidate);
      });
      
      // Calculate metrics for each source
      return Object.entries(sourceGroups).map(([source, candidates]) => {
        const hiredCount = candidates.filter(c => c.pipelineStage === 'HIRED').length;
        const conversionRate = candidates.length > 0 ? Math.round((hiredCount / candidates.length) * 100 * 10) / 10 : 0;
        const avgScore = candidates.length > 0 ? 
          Math.round(candidates.reduce((sum, c) => sum + (c.overallScore || c.score || 0), 0) / candidates.length) : 0;
        
        return {
          source,
          candidates: candidates.length,
          hiredCount,
          conversionRate,
          avgScore
        };
      }).sort((a, b) => b.candidates - a.candidates); // Sort by candidate count
    })(),
    timeMetrics: (() => {
      const hiredCandidates = filteredCandidates.filter(c => c.pipelineStage === 'HIRED' && c.createdAt);
      const interviewedCandidates = filteredCandidates.filter(c => 
        ['FIRST_INTERVIEW', 'TECHNICAL_SCREEN', 'FINAL_INTERVIEW', 'OFFER', 'HIRED'].includes(c.pipelineStage) && 
        c.createdAt
      );
      const offerCandidates = filteredCandidates.filter(c => ['OFFER', 'HIRED'].includes(c.pipelineStage) && c.createdAt);
      
      // Calculate average time to hire for HIRED candidates
      // Uses interview date as a proxy for hire progression when available
      const calculateAvgTimeToHire = (candidates: Candidate[]) => {
        if (candidates.length === 0) return 0;
        const totalDays = candidates.reduce((sum, candidate) => {
          const createdDate = new Date(candidate.createdAt!);
          // For hired candidates, estimate completion time based on available data
          // If we have an interview date, add estimated processing time
          if (candidate.interviewDate) {
            const interviewDate = new Date(candidate.interviewDate);
            const baseTime = differenceInDays(interviewDate, createdDate);
            // Add estimated 7-14 days for post-interview processing (average 10 days)
            return sum + baseTime + 10;
          }
          // Fallback: Use current date but this is less accurate for old hires
          return sum + Math.max(7, differenceInDays(new Date(), createdDate));
        }, 0);
        return Math.round((totalDays / candidates.length) * 10) / 10;
      };
      
      // Calculate average time to first interview
      const calculateAvgTimeToInterview = (candidates: Candidate[]) => {
        if (candidates.length === 0) return 0;
        const totalDays = candidates.reduce((sum, candidate) => {
          const createdDate = new Date(candidate.createdAt!);
          // Use actual interview date if available
          if (candidate.interviewDate) {
            return sum + Math.max(0, differenceInDays(new Date(candidate.interviewDate), createdDate));
          }
          // For candidates in interview stages without interview date, estimate
          if (['FIRST_INTERVIEW', 'TECHNICAL_SCREEN', 'FINAL_INTERVIEW'].includes(candidate.pipelineStage)) {
            return sum + Math.max(1, differenceInDays(new Date(), createdDate));
          }
          return sum + 0; // Skip candidates without interview data
        }, 0);
        
        // Only count candidates with interview data
        const candidatesWithInterviews = candidates.filter(c => 
          c.interviewDate || ['FIRST_INTERVIEW', 'TECHNICAL_SCREEN', 'FINAL_INTERVIEW'].includes(c.pipelineStage)
        );
        
        return candidatesWithInterviews.length > 0 ? 
          Math.round((totalDays / candidatesWithInterviews.length) * 10) / 10 : 0;
      };
      
      // Calculate average time to offer
      const calculateAvgTimeToOffer = (candidates: Candidate[]) => {
        if (candidates.length === 0) return 0;
        const totalDays = candidates.reduce((sum, candidate) => {
          const createdDate = new Date(candidate.createdAt!);
          // Estimate offer timing based on interview date + processing time
          if (candidate.interviewDate) {
            const interviewDate = new Date(candidate.interviewDate);
            const baseTime = differenceInDays(interviewDate, createdDate);
            // Add estimated 3-7 days for post-interview to offer (average 5 days)
            return sum + baseTime + 5;
          }
          // Fallback for offers without interview dates
          return sum + Math.max(5, differenceInDays(new Date(), createdDate));
        }, 0);
        return Math.round((totalDays / candidates.length) * 10) / 10;
      };
      
      return {
        avgTimeToHire: calculateAvgTimeToHire(hiredCandidates),
        avgTimeToFirstInterview: calculateAvgTimeToInterview(interviewedCandidates),
        avgTimeToOffer: calculateAvgTimeToOffer(offerCandidates),
      };
    })(),
    scoreDistribution: (() => {
      const candidatesWithScores = filteredCandidates.filter(c => (c.overallScore || c.score || 0) > 0);
      const totalWithScores = candidatesWithScores.length;
      
      const ranges = [
        { range: '90-100', count: candidatesWithScores.filter(c => (c.overallScore || c.score || 0) >= 90).length },
        { range: '80-89', count: candidatesWithScores.filter(c => (c.overallScore || c.score || 0) >= 80 && (c.overallScore || c.score || 0) < 90).length },
        { range: '70-79', count: candidatesWithScores.filter(c => (c.overallScore || c.score || 0) >= 70 && (c.overallScore || c.score || 0) < 80).length },
        { range: '60-69', count: candidatesWithScores.filter(c => (c.overallScore || c.score || 0) >= 60 && (c.overallScore || c.score || 0) < 70).length },
        { range: '< 60', count: candidatesWithScores.filter(c => (c.overallScore || c.score || 0) < 60 && (c.overallScore || c.score || 0) > 0).length },
      ];
      
      return ranges.map(item => ({
        ...item,
        percentage: totalWithScores > 0 ? Math.round((item.count / totalWithScores) * 100) : 0
      }));
    })(),
    trendsData: (() => {
      const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 365;
      const dateRange = Array.from({ length: days }, (_, i) => subDays(new Date(), days - 1 - i));
      
      return dateRange.map(date => {
        const dayStart = startOfDay(date);
        const dayEnd = startOfDay(subDays(dayStart, -1)); // Start of next day
        
        // Applications: Count candidates CREATED on this day
        const dayCandidates = safeC.filter(c => {
          if (!c.createdAt) return false;
          const candidateDate = new Date(c.createdAt);
          return candidateDate >= dayStart && candidateDate < dayEnd;
        });
        
        // Interviews: Count ALL candidates who had interviews on this day (regardless of creation date)
        const dayInterviews = safeC.filter(c => {
          if (!c.interviewDate) return false;
          const interviewDate = new Date(c.interviewDate);
          return interviewDate >= dayStart && interviewDate < dayEnd;
        });
        
        // Offers: Count ALL candidates who moved to OFFER stage on this day
        // Note: Since we don't have stage transition dates, we'll approximate by counting 
        // candidates currently in OFFER stage who were created within the timeframe
        const dayOffers = safeC.filter(c => {
          if (c.pipelineStage !== 'OFFER') return false;
          if (!c.createdAt) return false;
          const candidateDate = new Date(c.createdAt);
          return candidateDate >= dayStart && candidateDate < dayEnd;
        });
        
        // Hires: Count ALL candidates who moved to HIRED stage on this day
        // Note: Since we don't have stage transition dates, we'll approximate by counting 
        // candidates currently in HIRED stage who were created within the timeframe
        const dayHires = safeC.filter(c => {
          if (c.pipelineStage !== 'HIRED') return false;
          if (!c.createdAt) return false;
          const candidateDate = new Date(c.createdAt);
          return candidateDate >= dayStart && candidateDate < dayEnd;
        });
        
        return {
          date: format(date, days > 90 ? 'MMM dd' : 'MMM dd'),
          applications: dayCandidates.length,
          interviews: dayInterviews.length,
          offers: dayOffers.length,
          hires: dayHires.length,
        };
      });
    })(),
    performanceKPIs: (() => {
      const total = filteredCandidates.length;
      const active = filteredCandidates.filter(c => 
        c.pipelineStage && !['HIRED', 'REJECTED'].includes(c.pipelineStage)
      ).length;
      const hired = filteredCandidates.filter(c => c.pipelineStage === 'HIRED').length;
      
      // Calculate average score using safer methods
      const candidatesWithValidScores = filteredCandidates.filter(c => getSafeScore(c) > 0);
      const avgScore = candidatesWithValidScores.length > 0 ? 
        Math.round(candidatesWithValidScores.reduce((sum, c) => sum + getSafeScore(c), 0) / candidatesWithValidScores.length) : 0;
      
      // Overall conversion rate (hired / total) with proper validation
      const conversionRate = total > 0 ? 
        Math.round((hired / total) * 100 * 100) / 100 : 0; // Fixed rounding precision
      
      // Average time to hire using more accurate calculation
      const hiredCandidatesWithDates = filteredCandidates.filter(c => 
        c.pipelineStage === 'HIRED' && safeParseDate(c.createdAt)
      );
      
      const avgTimeToHire = hiredCandidatesWithDates.length > 0 ? 
        Math.round((hiredCandidatesWithDates.reduce((sum, c) => {
          const createdDate = safeParseDate(c.createdAt);
          if (!createdDate) return sum;
          
          // Use interview date + estimated processing time for more accurate calculation
          if (c.interviewDate) {
            const interviewDate = safeParseDate(c.interviewDate);
            if (interviewDate) {
              const baseTime = differenceInDays(interviewDate, createdDate);
              return sum + baseTime + 10; // Add estimated post-interview processing time
            }
          }
          
          // Fallback: Use minimum realistic time for hired candidates
          return sum + Math.max(7, differenceInDays(new Date(), createdDate));
        }, 0) / hiredCandidatesWithDates.length) * 10) / 10 : 0;
      
      // Quality score with enhanced validation
      const qualityFactors = {
        avgScore: Math.max(0, Math.min(1, avgScore / 100)), // Clamp to 0-1 range
        conversionRate: Math.max(0, Math.min(1, conversionRate / 100)), // Clamp to 0-1 range
        interviewCompletion: total > 0 ? candidatesWithValidScores.length / total : 0,
        dataCompleteness: total > 0 ? 
          filteredCandidates.filter(c => 
            c.email && 
            typeof c.email === 'string' && 
            c.name && 
            typeof c.name === 'string'
          ).length / total : 0
      };
      
      const qualityScore = Math.round(
        (qualityFactors.avgScore * 0.4 + 
         qualityFactors.conversionRate * 0.3 + 
         qualityFactors.interviewCompletion * 0.2 + 
         qualityFactors.dataCompleteness * 0.1) * 100
      );
      
      return {
        totalCandidates: total,
        activeInPipeline: active,
        averageScore: avgScore,
        conversionRate,
        timeToHire: avgTimeToHire,
        qualityScore: Math.max(0, Math.min(100, qualityScore)), // Clamp quality score to 0-100
      };
    })(),
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
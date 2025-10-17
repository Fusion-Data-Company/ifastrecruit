import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  TrendingUp,
  MessageSquare,
  HardDrive,
  Users,
  Code,
  Package,
  FileUp,
  BarChart3,
  ArrowUp,
  ArrowDown
} from "lucide-react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";
import { useState } from "react";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface UsageStats {
  metric: string;
  current: number;
  limit: number;
  percentage: number;
  remaining: number;
  period: {
    start: string;
    end: string;
  };
}

interface UsageSummary {
  workspaceId: string;
  subscriptionId?: string;
  planTier: string;
  stats: UsageStats[];
  alerts: Array<{
    metric: string;
    threshold: number;
    message: string;
  }>;
}

interface UsageHistory {
  date: string;
  value: number;
}

const metricIcons: Record<string, JSX.Element> = {
  messages: <MessageSquare className="w-5 h-5" />,
  storage: <HardDrive className="w-5 h-5" />,
  api_calls: <Code className="w-5 h-5" />,
  active_users: <Users className="w-5 h-5" />,
  integrations: <Package className="w-5 h-5" />,
  file_uploads: <FileUp className="w-5 h-5" />
};

const metricNames: Record<string, string> = {
  messages: "Messages",
  storage: "Storage",
  api_calls: "API Calls",
  active_users: "Active Users",
  integrations: "Integrations",
  file_uploads: "File Uploads"
};

const metricUnits: Record<string, string> = {
  messages: "messages",
  storage: "GB",
  api_calls: "calls",
  active_users: "users",
  integrations: "integrations",
  file_uploads: "files"
};

function UsageCard({ stat }: { stat: UsageStats }) {
  const isUnlimited = stat.limit === -1;
  const isAtLimit = stat.percentage >= 100;
  const isNearLimit = stat.percentage >= 80;
  
  const statusColor = isAtLimit 
    ? "text-red-500" 
    : isNearLimit 
    ? "text-yellow-500" 
    : "text-green-500";

  const progressColor = isAtLimit 
    ? "bg-red-500" 
    : isNearLimit 
    ? "bg-yellow-500" 
    : "bg-green-500";

  return (
    <Card data-testid={`card-usage-${stat.metric}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {metricIcons[stat.metric]}
            <CardTitle className="text-lg">{metricNames[stat.metric]}</CardTitle>
          </div>
          {!isUnlimited && (
            <Badge variant={isAtLimit ? "destructive" : isNearLimit ? "secondary" : "outline"}>
              {stat.percentage.toFixed(0)}%
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Current Usage</span>
            <span className={`font-medium ${statusColor}`}>
              {stat.current.toLocaleString()} {metricUnits[stat.metric]}
            </span>
          </div>
          
          {!isUnlimited ? (
            <>
              <Progress 
                value={Math.min(stat.percentage, 100)} 
                className="h-2"
                data-testid={`progress-${stat.metric}`}
              />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Limit: {stat.limit.toLocaleString()} {metricUnits[stat.metric]}</span>
                <span>Remaining: {stat.remaining.toLocaleString()}</span>
              </div>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">
              Unlimited usage
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function UsageDashboard() {
  const { toast } = useToast();
  const [selectedMetric, setSelectedMetric] = useState<string>("messages");
  const [historyDays, setHistoryDays] = useState(30);

  // Fetch current usage stats
  const { data: usageData, isLoading } = useQuery<UsageSummary>({
    queryKey: ["/api/billing/usage"],
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Fetch historical data for selected metric
  const { data: historyData } = useQuery<{ history: UsageHistory[] }>({
    queryKey: [`/api/billing/usage/history?metric=${selectedMetric}&days=${historyDays}`],
    enabled: !!selectedMetric
  });

  // Fetch active alerts
  const { data: alertsData } = useQuery<{ alerts: any[] }>({
    queryKey: ["/api/billing/usage/alerts"]
  });

  // Acknowledge alert mutation
  const acknowledgeAlert = async (alertId: string) => {
    try {
      await apiRequest("POST", `/api/billing/usage/alerts/${alertId}/acknowledge`);
      queryClient.invalidateQueries({ queryKey: ["/api/billing/usage/alerts"] });
      toast({
        title: "Alert Acknowledged",
        description: "The usage alert has been marked as read.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to acknowledge alert",
        variant: "destructive"
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!usageData) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>No Usage Data</AlertTitle>
        <AlertDescription>
          Unable to load usage statistics. Please try again later.
        </AlertDescription>
      </Alert>
    );
  }

  // Calculate usage trends (mock data for demo)
  const calculateTrend = (current: number, previous: number) => {
    const change = ((current - previous) / previous) * 100;
    return {
      value: change,
      isUp: change > 0
    };
  };

  return (
    <div className="space-y-6">
      {/* Alerts Section */}
      {alertsData?.alerts && alertsData.alerts.length > 0 && (
        <div className="space-y-2">
          {alertsData.alerts.map((alert) => (
            <Alert key={alert.id} variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Usage Alert</AlertTitle>
              <AlertDescription className="flex items-center justify-between">
                <span>{alert.message}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => acknowledgeAlert(alert.id)}
                  data-testid={`button-acknowledge-${alert.id}`}
                >
                  Dismiss
                </Button>
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Plan Information */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Current Plan</CardTitle>
              <CardDescription>
                Billing period: {format(new Date(usageData.stats[0]?.period.start), "MMM d")} - {format(new Date(usageData.stats[0]?.period.end), "MMM d, yyyy")}
              </CardDescription>
            </div>
            <Badge variant="default" className="text-lg px-3 py-1">
              {usageData.planTier.charAt(0).toUpperCase() + usageData.planTier.slice(1)}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Usage Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {usageData.stats.map((stat) => (
          <UsageCard key={stat.metric} stat={stat} />
        ))}
      </div>

      {/* Historical Usage Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Usage History</CardTitle>
              <CardDescription>Track your usage patterns over time</CardDescription>
            </div>
            <div className="flex gap-2">
              <select
                value={selectedMetric}
                onChange={(e) => setSelectedMetric(e.target.value)}
                className="px-3 py-1 border rounded-md"
                data-testid="select-metric"
              >
                {usageData.stats.map((stat) => (
                  <option key={stat.metric} value={stat.metric}>
                    {metricNames[stat.metric]}
                  </option>
                ))}
              </select>
              <select
                value={historyDays}
                onChange={(e) => setHistoryDays(Number(e.target.value))}
                className="px-3 py-1 border rounded-md"
                data-testid="select-period"
              >
                <option value={7}>Last 7 days</option>
                <option value={30}>Last 30 days</option>
                <option value={90}>Last 90 days</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {historyData?.history && historyData.history.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={historyData.history}>
                <defs>
                  <linearGradient id="colorUsage" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(value) => format(new Date(value), "MMM d")}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(value) => format(new Date(value), "MMM d, yyyy")}
                  formatter={(value: number) => [
                    `${value.toLocaleString()} ${metricUnits[selectedMetric]}`,
                    metricNames[selectedMetric]
                  ]}
                />
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#8884d8" 
                  fillOpacity={1} 
                  fill="url(#colorUsage)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground">
              No historical data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Peak Usage Today</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2,847</div>
            <p className="text-xs text-muted-foreground">
              <ArrowUp className="inline h-3 w-3 text-green-500" /> 12% from yesterday
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Daily Usage</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,234</div>
            <p className="text-xs text-muted-foreground">
              <ArrowDown className="inline h-3 w-3 text-red-500" /> 3% from last week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Projected Monthly</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">38,420</div>
            <p className="text-xs text-muted-foreground">
              Based on current usage rate
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
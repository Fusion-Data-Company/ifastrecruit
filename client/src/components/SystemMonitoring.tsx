import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { motion } from 'framer-motion';

interface SystemStatus {
  system: {
    status: string;
    uptime: number;
    memory: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
      external: number;
      arrayBuffers: number;
    };
    node_version: string;
    env: string;
  };
  database: {
    candidates: number;
    campaigns: number;
    interviews: number;
    bookings: number;
    apifyActors: number;
    auditLogs: number;
  };
  external_apis: Record<string, boolean>;
  integrations: Record<string, boolean>;
  timestamp: string;
}

interface ExternalAPIHealth {
  external_apis: Record<string, boolean>;
  configuration_status: Record<string, boolean>;
  timestamp: string;
}

export default function SystemMonitoring() {
  const [refreshing, setRefreshing] = useState(false);

  // Fetch system status
  const { data: systemStatus, refetch: refetchSystem } = useQuery<SystemStatus>({
    queryKey: ['/api/system/status'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch external API health
  const { data: externalHealth, refetch: refetchExternal } = useQuery<ExternalAPIHealth>({
    queryKey: ['/api/health/external'],
    refetchInterval: 60000, // Refresh every minute
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchSystem(), refetchExternal()]);
    setRefreshing(false);
  };

  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / (24 * 60 * 60));
    const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((seconds % (60 * 60)) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatMemory = (bytes: number): string => {
    const mb = Math.round(bytes / 1024 / 1024);
    return `${mb} MB`;
  };

  const getStatusColor = (status: boolean | string): string => {
    if (typeof status === 'boolean') {
      return status ? 'bg-green-500' : 'bg-red-500';
    }
    return status === 'healthy' ? 'bg-green-500' : 'bg-red-500';
  };

  const getStatusText = (status: boolean | string): string => {
    if (typeof status === 'boolean') {
      return status ? 'Healthy' : 'Error';
    }
    return status === 'healthy' ? 'Healthy' : 'Error';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="enterprise-heading text-2xl font-bold">System Monitoring</h2>
          <p className="text-muted-foreground">Real-time system health and performance metrics</p>
        </div>
        <Button 
          onClick={handleRefresh} 
          disabled={refreshing}
          className="glass-input glow-hover"
          data-testid="refresh-system-status"
        >
          <i className={`fas fa-sync-alt mr-2 ${refreshing ? 'fa-spin' : ''}`}></i>
          Refresh
        </Button>
      </div>

      {/* System Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="glass-panel p-6">
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${getStatusColor(systemStatus?.system.status || false)}`}></div>
            <div>
              <p className="text-sm text-muted-foreground">System Status</p>
              <p className="font-semibold">{getStatusText(systemStatus?.system.status || false)}</p>
            </div>
          </div>
        </Card>

        <Card className="glass-panel p-6">
          <div className="flex items-center space-x-3">
            <i className="fas fa-clock text-blue-500 text-lg"></i>
            <div>
              <p className="text-sm text-muted-foreground">Uptime</p>
              <p className="font-semibold">{systemStatus ? formatUptime(systemStatus.system.uptime) : '-'}</p>
            </div>
          </div>
        </Card>

        <Card className="glass-panel p-6">
          <div className="flex items-center space-x-3">
            <i className="fas fa-memory text-purple-500 text-lg"></i>
            <div>
              <p className="text-sm text-muted-foreground">Memory Usage</p>
              <p className="font-semibold">
                {systemStatus ? formatMemory(systemStatus.system.memory.heapUsed) : '-'}
              </p>
            </div>
          </div>
        </Card>

        <Card className="glass-panel p-6">
          <div className="flex items-center space-x-3">
            <i className="fas fa-code text-green-500 text-lg"></i>
            <div>
              <p className="text-sm text-muted-foreground">Node.js Version</p>
              <p className="font-semibold">{systemStatus?.system.node_version || '-'}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Database Statistics */}
      <Card className="glass-panel p-6">
        <h3 className="text-lg font-semibold mb-4">Database Statistics</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {systemStatus?.database && Object.entries(systemStatus.database).map(([key, value]) => (
            <div key={key} className="text-center">
              <p className="text-2xl font-bold text-accent">{value.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground capitalize">
                {key.replace(/([A-Z])/g, ' $1').trim()}
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* External API Status */}
      <Card className="glass-panel p-6">
        <h3 className="text-lg font-semibold mb-4">External API Status</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-medium mb-3">Health Status</h4>
            <div className="space-y-2">
              {externalHealth?.external_apis && Object.entries(externalHealth.external_apis).map(([api, healthy]) => (
                <div key={api} className="flex items-center justify-between">
                  <span className="capitalize">{api}</span>
                  <Badge 
                    variant={healthy ? "default" : "destructive"}
                    className="ml-2"
                  >
                    <div className={`w-2 h-2 rounded-full mr-2 ${getStatusColor(healthy)}`}></div>
                    {getStatusText(healthy)}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
          
          <div>
            <h4 className="font-medium mb-3">Configuration Status</h4>
            <div className="space-y-2">
              {externalHealth?.configuration_status && Object.entries(externalHealth.configuration_status).map(([api, configured]) => (
                <div key={api} className="flex items-center justify-between">
                  <span className="capitalize">{api}</span>
                  <Badge 
                    variant={configured ? "default" : "secondary"}
                    className="ml-2"
                  >
                    {configured ? 'Configured' : 'Not Configured'}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Memory Details */}
      <Card className="glass-panel p-6">
        <h3 className="text-lg font-semibold mb-4">Memory Usage Details</h3>
        {systemStatus?.system.memory && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <p className="text-lg font-semibold text-blue-500">
                {formatMemory(systemStatus.system.memory.rss)}
              </p>
              <p className="text-sm text-muted-foreground">RSS</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-green-500">
                {formatMemory(systemStatus.system.memory.heapTotal)}
              </p>
              <p className="text-sm text-muted-foreground">Heap Total</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-orange-500">
                {formatMemory(systemStatus.system.memory.heapUsed)}
              </p>
              <p className="text-sm text-muted-foreground">Heap Used</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-purple-500">
                {formatMemory(systemStatus.system.memory.external)}
              </p>
              <p className="text-sm text-muted-foreground">External</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-red-500">
                {formatMemory(systemStatus.system.memory.arrayBuffers)}
              </p>
              <p className="text-sm text-muted-foreground">Array Buffers</p>
            </div>
          </div>
        )}
      </Card>

      {/* System Info */}
      <Card className="glass-panel p-6">
        <h3 className="text-lg font-semibold mb-4">System Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium mb-2">Environment</h4>
            <p className="text-muted-foreground">{systemStatus?.system.env || '-'}</p>
          </div>
          <div>
            <h4 className="font-medium mb-2">Last Updated</h4>
            <p className="text-muted-foreground">
              {systemStatus?.timestamp ? new Date(systemStatus.timestamp).toLocaleString() : '-'}
            </p>
          </div>
        </div>
      </Card>

      {/* Quick Actions */}
      <Card className="glass-panel p-6">
        <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            className="glass-input"
            onClick={() => window.open('/api/health', '_blank')}
            data-testid="view-health-endpoint"
          >
            <i className="fas fa-heartbeat mr-2"></i>
            View Health Endpoint
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="glass-input"
            onClick={() => window.open('/api/system/status', '_blank')}
            data-testid="view-system-status"
          >
            <i className="fas fa-info-circle mr-2"></i>
            View System Status
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="glass-input"
            onClick={() => window.open('/api/health/external', '_blank')}
            data-testid="view-external-apis"
          >
            <i className="fas fa-plug mr-2"></i>
            View External APIs
          </Button>
        </div>
      </Card>
    </div>
  );
}
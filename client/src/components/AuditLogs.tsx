import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion, AnimatePresence } from 'framer-motion';
import type { AuditLog } from '@shared/schema';

interface AuditLogsProps {
  className?: string;
}

const ACTION_TYPES = [
  'candidate_created',
  'candidate_updated',
  'stage_changed',
  'email_sent',
  'interview_scheduled',
  'workflow_executed',
  'job_posted',
  'apify_actor_run',
  'system_action',
  'user_action',
];

const ACTOR_TYPES = [
  'system',
  'automation',
  'user',
  'api',
  'webhook',
];

export default function AuditLogs({ className }: AuditLogsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAction, setSelectedAction] = useState<string>('');
  const [selectedActor, setSelectedActor] = useState<string>('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Fetch audit logs
  const { data: auditLogs = [], isLoading } = useQuery<AuditLog[]>({
    queryKey: ['/api/audit-logs'],
  });

  // Filter logs based on search criteria
  const filteredLogs = auditLogs.filter(log => {
    const matchesSearch = !searchTerm || 
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.actor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      JSON.stringify(log.payloadJson).toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesAction = !selectedAction || selectedAction === 'all' || log.action === selectedAction;
    const matchesActor = !selectedActor || selectedActor === 'all' || log.actor === selectedActor;
    
    return matchesSearch && matchesAction && matchesActor;
  });

  const getActionIcon = (action: string): string => {
    switch (action) {
      case 'candidate_created': return 'fas fa-user-plus';
      case 'candidate_updated': return 'fas fa-user-edit';
      case 'stage_changed': return 'fas fa-exchange-alt';
      case 'email_sent': return 'fas fa-envelope';
      case 'interview_scheduled': return 'fas fa-calendar';
      case 'workflow_executed': return 'fas fa-robot';
      case 'job_posted': return 'fas fa-briefcase';
      case 'apify_actor_run': return 'fas fa-spider';
      case 'system_action': return 'fas fa-cog';
      case 'user_action': return 'fas fa-user';
      default: return 'fas fa-info-circle';
    }
  };

  const getActionColor = (action: string): string => {
    switch (action) {
      case 'candidate_created': return 'text-green-500';
      case 'candidate_updated': return 'text-blue-500';
      case 'stage_changed': return 'text-orange-500';
      case 'email_sent': return 'text-purple-500';
      case 'interview_scheduled': return 'text-indigo-500';
      case 'workflow_executed': return 'text-red-500';
      case 'job_posted': return 'text-yellow-500';
      case 'apify_actor_run': return 'text-pink-500';
      case 'system_action': return 'text-gray-500';
      case 'user_action': return 'text-cyan-500';
      default: return 'text-muted-foreground';
    }
  };

  const getActorBadgeVariant = (actor: string) => {
    switch (actor) {
      case 'system': return 'default';
      case 'automation': return 'secondary';
      case 'user': return 'outline';
      case 'api': return 'destructive';
      case 'webhook': return 'secondary';
      default: return 'outline';
    }
  };

  const formatTimestamp = (timestamp: string | Date): string => {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    return date.toLocaleString();
  };

  const formatPayload = (payload: any): string => {
    if (!payload) return 'No data';
    
    try {
      return JSON.stringify(payload, null, 2);
    } catch {
      return String(payload);
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="enterprise-heading text-2xl font-bold">Audit Logs</h2>
          <p className="text-muted-foreground">Complete activity trail and compliance logging</p>
        </div>
        <Badge variant="outline" className="text-sm">
          {filteredLogs.length} entries
        </Badge>
      </div>

      {/* Filters */}
      <Card className="glass-panel p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Search</label>
            <Input
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="glass-input"
              data-testid="search-audit-logs"
            />
          </div>
          
          <div>
            <label className="text-sm font-medium mb-2 block">Action Type</label>
            <Select value={selectedAction} onValueChange={setSelectedAction}>
              <SelectTrigger className="glass-input">
                <SelectValue placeholder="All actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                {ACTION_TYPES.map(action => (
                  <SelectItem key={action} value={action}>
                    <div className="flex items-center space-x-2">
                      <i className={`${getActionIcon(action)} text-xs`}></i>
                      <span>{action.replace(/_/g, ' ')}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Actor</label>
            <Select value={selectedActor} onValueChange={setSelectedActor}>
              <SelectTrigger className="glass-input">
                <SelectValue placeholder="All actors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actors</SelectItem>
                {ACTOR_TYPES.map(actor => (
                  <SelectItem key={actor} value={actor}>
                    {actor}
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
                setSelectedAction('all');
                setSelectedActor('all');
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

      {/* Logs List */}
      <div className="space-y-3">
        {isLoading ? (
          <Card className="glass-panel p-6 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading audit logs...</p>
          </Card>
        ) : filteredLogs.length === 0 ? (
          <Card className="glass-panel p-12 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-muted/20 flex items-center justify-center mb-4">
              <i className="fas fa-clipboard-list text-muted-foreground text-2xl"></i>
            </div>
            <h3 className="font-semibold mb-2">No Audit Logs Found</h3>
            <p className="text-muted-foreground text-sm">
              {searchTerm || selectedAction || selectedActor 
                ? 'No logs match your current filters'
                : 'No audit logs available yet'
              }
            </p>
          </Card>
        ) : (
          <AnimatePresence>
            {filteredLogs.map((log, index) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2, delay: index * 0.05 }}
              >
                <Card className="glass-panel p-4 hover:bg-muted/5 micro-animation cursor-pointer">
                  <div 
                    className="flex items-center justify-between"
                    onClick={() => setSelectedLog(log)}
                    data-testid={`audit-log-${log.id}`}
                  >
                    <div className="flex items-center space-x-4">
                      <div className={`p-2 rounded-full bg-muted/20 ${getActionColor(log.action)}`}>
                        <i className={`${getActionIcon(log.action)} text-sm`}></i>
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="font-medium">{log.action.replace(/_/g, ' ')}</span>
                          <Badge variant={getActorBadgeVariant(log.actor)} className="text-xs">
                            {log.actor}
                          </Badge>
                          {log.pathUsed && (
                            <Badge variant="outline" className="text-xs">
                              {log.pathUsed}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {formatTimestamp(log.ts)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      {log.payloadJson && (
                        <Badge variant="outline" className="text-xs">
                          <i className="fas fa-database mr-1"></i>
                          Has Data
                        </Badge>
                      )}
                      <i className="fas fa-chevron-right text-muted-foreground text-xs"></i>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Log Detail Modal */}
      {selectedLog && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedLog(null)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="glass-panel border-border rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`p-3 rounded-full bg-muted/20 ${getActionColor(selectedLog.action)}`}>
                    <i className={`${getActionIcon(selectedLog.action)} text-lg`}></i>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">{selectedLog.action.replace(/_/g, ' ')}</h3>
                    <p className="text-sm text-muted-foreground">Audit Log Details</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedLog(null)}
                  className="glass-input"
                >
                  <i className="fas fa-times"></i>
                </Button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Actor</label>
                  <p className="text-sm text-muted-foreground">{selectedLog.actor}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Timestamp</label>
                  <p className="text-sm text-muted-foreground">{formatTimestamp(selectedLog.ts)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Action</label>
                  <p className="text-sm text-muted-foreground">{selectedLog.action}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Path Used</label>
                  <p className="text-sm text-muted-foreground">{selectedLog.pathUsed || 'N/A'}</p>
                </div>
              </div>

              {selectedLog.payloadJson && (
                <div>
                  <label className="text-sm font-medium mb-2 block">Payload Data</label>
                  <pre className="glass-input p-4 text-xs overflow-x-auto whitespace-pre-wrap">
                    {formatPayload(selectedLog.payloadJson)}
                  </pre>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
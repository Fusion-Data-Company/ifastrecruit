import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';

interface SSEEvent {
  id: string;
  type: string;
  data: any;
  timestamp: Date;
  read: boolean;
}

interface NotificationSystemProps {
  className?: string;
}

export default function NotificationSystem({ className }: NotificationSystemProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<SSEEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const queryClient = useQueryClient();

  // Connect to SSE endpoint
  useEffect(() => {
    const connectToSSE = () => {
      try {
        eventSourceRef.current = new EventSource('/api/sse');
        
        eventSourceRef.current.onopen = () => {
          setIsConnected(true);
          console.log('SSE connection established');
        };

        eventSourceRef.current.onerror = () => {
          setIsConnected(false);
          console.log('SSE connection error, attempting to reconnect...');
          
          // Attempt to reconnect after 3 seconds
          setTimeout(() => {
            if (eventSourceRef.current?.readyState === EventSource.CLOSED) {
              connectToSSE();
            }
          }, 3000);
        };

        // Handle candidate-created events
        eventSourceRef.current.addEventListener('candidate-created', (event) => {
          const candidateData = JSON.parse(event.data);
          
          const notification: SSEEvent = {
            id: `candidate-${candidateData.id}-${Date.now()}`,
            type: 'candidate-created',
            data: candidateData,
            timestamp: new Date(),
            read: false,
          };

          setNotifications(prev => [notification, ...prev.slice(0, 49)]);
          
          toast({
            title: 'New Candidate Added',
            description: `${candidateData.name} has been added to the pipeline.`,
            duration: 5000,
          });

          // Refresh candidates data
          queryClient.invalidateQueries({ queryKey: ['/api/candidates'] });
          queryClient.invalidateQueries({ queryKey: ['/api/kpis'] });
        });

        // Handle candidate-updated events
        eventSourceRef.current.addEventListener('candidate-updated', (event) => {
          const updateData = JSON.parse(event.data);
          
          const notification: SSEEvent = {
            id: `candidate-update-${updateData.id}-${Date.now()}`,
            type: 'candidate-updated',
            data: updateData,
            timestamp: new Date(),
            read: false,
          };

          setNotifications(prev => [notification, ...prev.slice(0, 49)]);
          
          toast({
            title: 'Candidate Updated',
            description: `${updateData.name} moved to ${updateData.pipelineStage.replace('_', ' ').toLowerCase()}.`,
            duration: 4000,
          });

          // Refresh data
          queryClient.invalidateQueries({ queryKey: ['/api/candidates'] });
        });

        // Handle interview-scheduled events
        eventSourceRef.current.addEventListener('interview-scheduled', (event) => {
          const interviewData = JSON.parse(event.data);
          
          const notification: SSEEvent = {
            id: `interview-${interviewData.id}-${Date.now()}`,
            type: 'interview-scheduled',
            data: interviewData,
            timestamp: new Date(),
            read: false,
          };

          setNotifications(prev => [notification, ...prev.slice(0, 49)]);
          
          toast({
            title: 'Interview Scheduled',
            description: `Interview scheduled for ${interviewData.candidateName}.`,
            duration: 5000,
          });

          // Refresh bookings data
          queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
        });

        // Handle system events
        eventSourceRef.current.addEventListener('system-event', (event) => {
          const systemData = JSON.parse(event.data);
          
          const notification: SSEEvent = {
            id: `system-${Date.now()}`,
            type: 'system-event',
            data: systemData,
            timestamp: new Date(),
            read: false,
          };

          setNotifications(prev => [notification, ...prev.slice(0, 49)]);
          
          if (systemData.level === 'error') {
            toast({
              title: 'System Alert',
              description: systemData.message,
              variant: 'destructive',
              duration: 8000,
            });
          } else if (systemData.level === 'info') {
            toast({
              title: 'System Update',
              description: systemData.message,
              duration: 4000,
            });
          }
        });

        // Handle bulk operation results
        eventSourceRef.current.addEventListener('bulk-operation', (event) => {
          const bulkData = JSON.parse(event.data);
          
          const notification: SSEEvent = {
            id: `bulk-${Date.now()}`,
            type: 'bulk-operation',
            data: bulkData,
            timestamp: new Date(),
            read: false,
          };

          setNotifications(prev => [notification, ...prev.slice(0, 49)]);
          
          toast({
            title: 'Bulk Operation Complete',
            description: `${bulkData.action} completed for ${bulkData.count} candidates.`,
            duration: 6000,
          });

          // Refresh relevant data
          queryClient.invalidateQueries({ queryKey: ['/api/candidates'] });
          queryClient.invalidateQueries({ queryKey: ['/api/kpis'] });
        });

      } catch (error) {
        console.error('Failed to establish SSE connection:', error);
        setIsConnected(false);
      }
    };

    connectToSSE();

    // Cleanup on unmount
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [queryClient]);

  // Mark all notifications as read
  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  // Clear all notifications
  const clearAll = () => {
    setNotifications([]);
  };

  // Get unread count
  const unreadCount = notifications.filter(n => !n.read).length;

  // Get notification icon and color based on type
  const getNotificationMeta = (type: string) => {
    switch (type) {
      case 'candidate-created':
        return { icon: 'fas fa-user-plus', color: 'text-primary' };
      case 'candidate-updated':
        return { icon: 'fas fa-exchange-alt', color: 'text-accent' };
      case 'interview-scheduled':
        return { icon: 'fas fa-calendar-plus', color: 'text-primary' };
      case 'system-event':
        return { icon: 'fas fa-cog', color: 'text-muted-foreground' };
      case 'bulk-operation':
        return { icon: 'fas fa-tasks', color: 'text-accent' };
      default:
        return { icon: 'fas fa-bell', color: 'text-muted-foreground' };
    }
  };

  // Format notification message
  const formatNotificationMessage = (notification: SSEEvent) => {
    switch (notification.type) {
      case 'candidate-created':
        return `New candidate ${notification.data.name} added from ${notification.data.source || 'manual entry'}`;
      case 'candidate-updated':
        return `${notification.data.name} moved to ${notification.data.pipelineStage.replace('_', ' ').toLowerCase()}`;
      case 'interview-scheduled':
        return `Interview scheduled for ${notification.data.candidateName} on ${format(new Date(notification.data.startTs), 'MMM dd, yyyy')}`;
      case 'system-event':
        return notification.data.message;
      case 'bulk-operation':
        return `Bulk ${notification.data.action} completed for ${notification.data.count} candidates`;
      default:
        return 'System notification';
    }
  };

  return (
    <>
      {/* Connection Status Indicator (for development) */}
      {import.meta.env.DEV && (
        <div className="fixed bottom-4 left-4 z-50">
          <Card className="glass-panel p-2">
            <div className="flex items-center space-x-2 text-xs">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-muted-foreground">
                {isConnected ? 'Live Updates Active' : 'Reconnecting...'}
              </span>
            </div>
          </Card>
        </div>
      )}

      {/* Notification Bell */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={`relative glass-input glow-hover ${className}`}
            data-testid="notifications-btn"
          >
            <i className="fas fa-bell"></i>
            <AnimatePresence>
              {unreadCount > 0 && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center"
                >
                  <span className="text-xs font-bold text-primary-foreground">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </Button>
        </DialogTrigger>
        
        <DialogContent className="glass-panel border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Live Notifications</span>
              <div className="flex items-center space-x-2">
                <Badge variant="outline" className="text-xs">
                  {notifications.length}
                </Badge>
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Action Buttons */}
            <div className="flex justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                disabled={unreadCount === 0}
                className="glass-input text-xs"
                data-testid="mark-all-read-btn"
              >
                <i className="fas fa-check mr-1"></i>
                Mark All Read
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
                disabled={notifications.length === 0}
                className="glass-input text-xs"
                data-testid="clear-notifications-btn"
              >
                <i className="fas fa-trash mr-1"></i>
                Clear All
              </Button>
            </div>

            {/* Notifications List */}
            <ScrollArea className="h-80">
              {notifications.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <i className="fas fa-bell-slash text-2xl mb-2"></i>
                  <p className="text-sm">No notifications yet</p>
                  <p className="text-xs">You'll see real-time updates here</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <AnimatePresence>
                    {notifications.map((notification) => {
                      const { icon, color } = getNotificationMeta(notification.type);
                      return (
                        <motion.div
                          key={notification.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          className={`p-3 rounded-lg border transition-all duration-200 ${
                            notification.read 
                              ? 'bg-muted/30 border-border/50' 
                              : 'bg-primary/5 border-primary/20'
                          }`}
                          data-testid={`notification-${notification.id}`}
                        >
                          <div className="flex items-start space-x-3">
                            <div className={`w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center ${color}`}>
                              <i className={`${icon} text-xs`}></i>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">
                                {formatNotificationMessage(notification)}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {format(notification.timestamp, 'MMM dd, HH:mm')}
                              </p>
                            </div>
                            {!notification.read && (
                              <div className="w-2 h-2 rounded-full bg-primary"></div>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
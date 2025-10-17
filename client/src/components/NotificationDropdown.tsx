import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuItem
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, CheckCircle, MessageSquare, AtSign, Mail, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { NotificationBadge } from "./NotificationBadge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Notification } from "@shared/schema";
import { cn } from "@/lib/utils";

export function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);

  // Fetch notifications
  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ['/api/messenger/notifications', 'unread'],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', '/api/messenger/notifications/unread?limit=20');
        const data = await response.json();
        // Ensure we always return an array
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error('Failed to fetch notifications:', error);
        return [];
      }
    },
    refetchInterval: isOpen ? 5000 : false,
    enabled: true
  });

  // Fetch unread counts
  const { data: unreadCounts } = useQuery<{ total: number }>({
    queryKey: ['/api/messenger/notifications/unread-counts'],
    refetchInterval: 30000
  });

  // Mark notification as read
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      await apiRequest('PUT', `/api/messenger/notifications/${notificationId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messenger/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/messenger/notifications/unread-counts'] });
    }
  });

  // Mark all as read
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('PUT', '/api/messenger/notifications/read-all');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messenger/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/messenger/notifications/unread-counts'] });
    }
  });

  // Delete notification
  const deleteNotificationMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      await apiRequest('DELETE', `/api/messenger/notifications/${notificationId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messenger/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/messenger/notifications/unread-counts'] });
    }
  });

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read
    if (notification.status === 'unread') {
      markAsReadMutation.mutate(notification.id);
    }

    // Navigate to the source
    if (notification.channelId) {
      window.location.href = `/messenger?channel=${notification.channelId}`;
    } else if (notification.senderId) {
      window.location.href = `/messenger?dm=${notification.senderId}`;
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'message':
        return <MessageSquare className="h-4 w-4" />;
      case 'mention':
        return <AtSign className="h-4 w-4" />;
      case 'dm':
      case 'direct_message':
        return <Mail className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const totalUnread = unreadCounts?.total || 0;

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          data-testid="button-notifications"
        >
          <Bell className="h-5 w-5" />
          {totalUnread > 0 && (
            <div className="absolute -top-1 -right-1">
              <NotificationBadge count={totalUnread} size="sm" />
            </div>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-96" align="end">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span className="font-semibold">Notifications</span>
          {notifications && notifications.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto px-2 py-1 text-xs"
              onClick={() => markAllAsReadMutation.mutate()}
              data-testid="button-mark-all-read"
            >
              <CheckCircle className="h-3 w-3 mr-1" />
              Mark all read
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <ScrollArea className="max-h-[400px]">
          {!notifications || notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No new notifications</p>
            </div>
          ) : (
            notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className={cn(
                  "flex items-start gap-3 p-3 cursor-pointer",
                  notification.status === 'unread' && "bg-accent/50"
                )}
                onClick={() => handleNotificationClick(notification)}
                data-testid={`notification-item-${notification.id}`}
              >
                <div className={cn(
                  "flex-shrink-0 mt-1 text-muted-foreground",
                  notification.type === 'mention' && "text-blue-500",
                  notification.type === 'dm' && "text-green-500"
                )}>
                  {getNotificationIcon(notification.type)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-sm font-medium line-clamp-1">
                        {notification.title}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                        {notification.content}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotificationMutation.mutate(notification.id);
                      }}
                      data-testid={`button-delete-notification-${notification.id}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </DropdownMenuItem>
            ))
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
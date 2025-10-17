import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import {
  Search,
  Users,
  Lock,
  Globe,
  Shield,
  Star,
  Archive,
  Hash,
  MessageSquare,
  Clock,
  Plus,
  Check,
  X,
  UserPlus,
  LogOut,
  Grid,
  List,
  Filter,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Channel {
  id: string;
  name: string;
  description?: string;
  purpose?: string;
  topic?: string;
  tier: 'NON_LICENSED' | 'FL_LICENSED' | 'MULTI_STATE';
  isPrivate: boolean;
  isArchived: boolean;
  isShared: boolean;
  isAnnouncement: boolean;
  memberCount: number;
  messageCount: number;
  lastActivityAt: string | null;
  isMember: boolean;
  memberRole?: string;
  createdBy?: string;
  ownerId?: string;
}

interface JoinRequest {
  id: string;
  channelId: string;
  userId: string;
  message?: string;
  status: string;
  createdAt: string;
}

const tierConfig = {
  NON_LICENSED: {
    icon: Shield,
    color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    label: 'Non-Licensed'
  },
  FL_LICENSED: {
    icon: Star,
    color: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    label: 'FL Licensed'
  },
  MULTI_STATE: {
    icon: Globe,
    color: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    label: 'Multi-State'
  }
};

interface ChannelBrowserProps {
  onChannelSelect?: (channel: Channel) => void;
  selectedChannelId?: string;
}

export function ChannelBrowser({ onChannelSelect, selectedChannelId }: ChannelBrowserProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [showPrivate, setShowPrivate] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [joinRequestDialog, setJoinRequestDialog] = useState<Channel | null>(null);
  const [joinRequestMessage, setJoinRequestMessage] = useState('');

  // Fetch channels with filters
  const { data: channels = [], isLoading, error, refetch } = useQuery<Channel[]>({
    queryKey: ['/api/channels/browse', searchQuery, selectedTier, showPrivate, showArchived],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (selectedTier) params.append('tier', selectedTier);
      if (showPrivate) params.append('showPrivate', 'true');
      if (showArchived) params.append('showArchived', 'true');
      
      const response = await fetch(`/api/channels/browse?${params}`);
      if (!response.ok) throw new Error('Failed to fetch channels');
      return response.json();
    }
  });

  // Join channel mutation
  const joinChannelMutation = useMutation({
    mutationFn: async ({ channelId, message }: { channelId: string; message?: string }) => {
      const response = await apiRequest('POST', `/api/channels/${channelId}/join`, { message });
      return response.json();
    },
    onSuccess: (data, { channelId }) => {
      if (data.type === 'request') {
        toast({
          title: "Join request sent",
          description: "Your request to join this private channel has been sent for approval."
        });
      } else {
        toast({
          title: "Joined channel",
          description: "You have successfully joined the channel."
        });
      }
      refetch();
      queryClient.invalidateQueries({ queryKey: ['/api/channels'] });
      setJoinRequestDialog(null);
      setJoinRequestMessage('');
    },
    onError: (error: any) => {
      toast({
        title: "Failed to join channel",
        description: error.message || "Could not join the channel. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Leave channel mutation
  const leaveChannelMutation = useMutation({
    mutationFn: async (channelId: string) => {
      const response = await apiRequest('POST', `/api/channels/${channelId}/leave`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Left channel",
        description: "You have left the channel."
      });
      refetch();
      queryClient.invalidateQueries({ queryKey: ['/api/channels'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to leave channel",
        description: error.message || "Could not leave the channel. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Group channels by category
  const categorizedChannels = {
    myChannels: channels.filter(c => c.isMember && !c.isArchived),
    publicChannels: channels.filter(c => !c.isPrivate && !c.isMember && !c.isArchived),
    privateChannels: channels.filter(c => c.isPrivate && !c.isMember && !c.isArchived),
    archivedChannels: channels.filter(c => c.isArchived)
  };

  const formatLastActivity = (date: string | null) => {
    if (!date) return 'No activity';
    const now = new Date();
    const activity = new Date(date);
    const diff = now.getTime() - activity.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor(diff / (1000 * 60));
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  const ChannelCard = ({ channel }: { channel: Channel }) => {
    const TierIcon = tierConfig[channel.tier].icon;
    
    return (
      <Card 
        className={cn(
          "cursor-pointer transition-all hover:shadow-md",
          selectedChannelId === channel.id && "ring-2 ring-primary",
          channel.isArchived && "opacity-60"
        )}
        onClick={() => onChannelSelect?.(channel)}
        data-testid={`channel-card-${channel.id}`}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              {channel.isPrivate ? (
                <Lock className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Hash className="h-4 w-4 text-muted-foreground" />
              )}
              <CardTitle className="text-sm font-medium">{channel.name}</CardTitle>
            </div>
            <Badge className={cn("text-xs", tierConfig[channel.tier].color)}>
              <TierIcon className="h-3 w-3 mr-1" />
              {tierConfig[channel.tier].label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {channel.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {channel.description}
            </p>
          )}
          
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {channel.memberCount}
              </span>
              <span className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                {channel.messageCount}
              </span>
            </div>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatLastActivity(channel.lastActivityAt)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {channel.isMember ? (
              <>
                <Badge variant="secondary" className="text-xs">
                  <Check className="h-3 w-3 mr-1" />
                  Joined
                </Badge>
                {channel.memberRole === 'owner' && (
                  <Badge variant="default" className="text-xs">Owner</Badge>
                )}
                {channel.memberRole === 'admin' && (
                  <Badge variant="default" className="text-xs">Admin</Badge>
                )}
              </>
            ) : null}
            
            {channel.isAnnouncement && (
              <Badge variant="outline" className="text-xs">
                Announcement
              </Badge>
            )}
            {channel.isShared && (
              <Badge variant="outline" className="text-xs">
                Shared
              </Badge>
            )}
            {channel.isArchived && (
              <Badge variant="outline" className="text-xs">
                <Archive className="h-3 w-3 mr-1" />
                Archived
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2 pt-2">
            {channel.isMember ? (
              <Button
                size="sm"
                variant="outline"
                className="w-full text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  leaveChannelMutation.mutate(channel.id);
                }}
                disabled={leaveChannelMutation.isPending}
                data-testid={`button-leave-${channel.id}`}
              >
                <LogOut className="h-3 w-3 mr-1" />
                Leave
              </Button>
            ) : channel.isPrivate ? (
              <Button
                size="sm"
                className="w-full text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  setJoinRequestDialog(channel);
                }}
                disabled={joinChannelMutation.isPending}
                data-testid={`button-request-${channel.id}`}
              >
                <UserPlus className="h-3 w-3 mr-1" />
                Request to Join
              </Button>
            ) : (
              <Button
                size="sm"
                className="w-full text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  joinChannelMutation.mutate({ channelId: channel.id });
                }}
                disabled={joinChannelMutation.isPending || channel.isArchived}
                data-testid={`button-join-${channel.id}`}
              >
                <Plus className="h-3 w-3 mr-1" />
                Join
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const ChannelListItem = ({ channel }: { channel: Channel }) => {
    const TierIcon = tierConfig[channel.tier].icon;
    
    return (
      <div
        className={cn(
          "flex items-center justify-between p-3 rounded-lg hover:bg-accent cursor-pointer transition-colors",
          selectedChannelId === channel.id && "bg-accent",
          channel.isArchived && "opacity-60"
        )}
        onClick={() => onChannelSelect?.(channel)}
        data-testid={`channel-item-${channel.id}`}
      >
        <div className="flex items-center gap-3 flex-1">
          {channel.isPrivate ? (
            <Lock className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Hash className="h-4 w-4 text-muted-foreground" />
          )}
          
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{channel.name}</span>
              {channel.isMember && (
                <Badge variant="secondary" className="text-xs">
                  <Check className="h-3 w-3" />
                </Badge>
              )}
            </div>
            {channel.description && (
              <p className="text-xs text-muted-foreground line-clamp-1">
                {channel.description}
              </p>
            )}
          </div>
          
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <Badge className={cn("text-xs", tierConfig[channel.tier].color)}>
              <TierIcon className="h-3 w-3 mr-1" />
              {tierConfig[channel.tier].label}
            </Badge>
            
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {channel.memberCount}
            </span>
            
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {channel.messageCount}
            </span>
            
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatLastActivity(channel.lastActivityAt)}
            </span>
          </div>
          
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header with search and filters */}
      <div className="p-4 border-b space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search channels..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-channel-search"
            />
          </div>
          
          <Button
            variant="outline"
            size="icon"
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            data-testid="button-toggle-view"
          >
            {viewMode === 'grid' ? <List className="h-4 w-4" /> : <Grid className="h-4 w-4" />}
          </Button>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant={selectedTier === null ? "secondary" : "outline"}
            size="sm"
            onClick={() => setSelectedTier(null)}
            data-testid="button-filter-all"
          >
            All Tiers
          </Button>
          {Object.entries(tierConfig).map(([tier, config]) => {
            const Icon = config.icon;
            return (
              <Button
                key={tier}
                variant={selectedTier === tier ? "secondary" : "outline"}
                size="sm"
                onClick={() => setSelectedTier(selectedTier === tier ? null : tier)}
                data-testid={`button-filter-${tier}`}
              >
                <Icon className="h-3 w-3 mr-1" />
                {config.label}
              </Button>
            );
          })}
          
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant={showPrivate ? "secondary" : "outline"}
              size="sm"
              onClick={() => setShowPrivate(!showPrivate)}
              data-testid="button-show-private"
            >
              <Lock className="h-3 w-3 mr-1" />
              Private
            </Button>
            
            <Button
              variant={showArchived ? "secondary" : "outline"}
              size="sm"
              onClick={() => setShowArchived(!showArchived)}
              data-testid="button-show-archived"
            >
              <Archive className="h-3 w-3 mr-1" />
              Archived
            </Button>
          </div>
        </div>
      </div>

      {/* Channel tabs */}
      <Tabs defaultValue="my" className="flex-1 flex flex-col">
        <TabsList className="mx-4 mt-4">
          <TabsTrigger value="my" data-testid="tab-my-channels">
            My Channels ({categorizedChannels.myChannels.length})
          </TabsTrigger>
          <TabsTrigger value="public" data-testid="tab-public-channels">
            Public ({categorizedChannels.publicChannels.length})
          </TabsTrigger>
          <TabsTrigger value="private" data-testid="tab-private-channels">
            Private ({categorizedChannels.privateChannels.length})
          </TabsTrigger>
          {showArchived && (
            <TabsTrigger value="archived" data-testid="tab-archived-channels">
              Archived ({categorizedChannels.archivedChannels.length})
            </TabsTrigger>
          )}
        </TabsList>

        {/* Loading state */}
        {isLoading && (
          <div className="p-4 space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="p-4">
            <Card>
              <CardContent className="text-center py-6">
                <p className="text-destructive">Failed to load channels</p>
                <Button onClick={() => refetch()} className="mt-2" size="sm">
                  Try Again
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Channel content */}
        {!isLoading && !error && (
          <>
            <TabsContent value="my" className="flex-1">
              <ScrollArea className="h-full">
                <div className={cn(
                  "p-4",
                  viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" : "space-y-2"
                )}>
                  {categorizedChannels.myChannels.length > 0 ? (
                    categorizedChannels.myChannels.map(channel => 
                      viewMode === 'grid' ? 
                        <ChannelCard key={channel.id} channel={channel} /> :
                        <ChannelListItem key={channel.id} channel={channel} />
                    )
                  ) : (
                    <Card className="col-span-full">
                      <CardContent className="text-center py-6">
                        <p className="text-muted-foreground">You haven't joined any channels yet</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="public" className="flex-1">
              <ScrollArea className="h-full">
                <div className={cn(
                  "p-4",
                  viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" : "space-y-2"
                )}>
                  {categorizedChannels.publicChannels.length > 0 ? (
                    categorizedChannels.publicChannels.map(channel => 
                      viewMode === 'grid' ? 
                        <ChannelCard key={channel.id} channel={channel} /> :
                        <ChannelListItem key={channel.id} channel={channel} />
                    )
                  ) : (
                    <Card className="col-span-full">
                      <CardContent className="text-center py-6">
                        <p className="text-muted-foreground">No public channels available to join</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="private" className="flex-1">
              <ScrollArea className="h-full">
                <div className={cn(
                  "p-4",
                  viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" : "space-y-2"
                )}>
                  {categorizedChannels.privateChannels.length > 0 ? (
                    categorizedChannels.privateChannels.map(channel => 
                      viewMode === 'grid' ? 
                        <ChannelCard key={channel.id} channel={channel} /> :
                        <ChannelListItem key={channel.id} channel={channel} />
                    )
                  ) : (
                    <Card className="col-span-full">
                      <CardContent className="text-center py-6">
                        <p className="text-muted-foreground">No private channels visible</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Private channels will appear here when you're invited
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {showArchived && (
              <TabsContent value="archived" className="flex-1">
                <ScrollArea className="h-full">
                  <div className={cn(
                    "p-4",
                    viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" : "space-y-2"
                  )}>
                    {categorizedChannels.archivedChannels.length > 0 ? (
                      categorizedChannels.archivedChannels.map(channel => 
                        viewMode === 'grid' ? 
                          <ChannelCard key={channel.id} channel={channel} /> :
                          <ChannelListItem key={channel.id} channel={channel} />
                      )
                    ) : (
                      <Card className="col-span-full">
                        <CardContent className="text-center py-6">
                          <p className="text-muted-foreground">No archived channels</p>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            )}
          </>
        )}
      </Tabs>

      {/* Join Request Dialog */}
      <Dialog open={!!joinRequestDialog} onOpenChange={(open) => !open && setJoinRequestDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request to Join Private Channel</DialogTitle>
            <DialogDescription>
              Send a message to the channel admins explaining why you'd like to join "{joinRequestDialog?.name}".
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Hi, I'd like to join this channel because..."
              value={joinRequestMessage}
              onChange={(e) => setJoinRequestMessage(e.target.value)}
              rows={4}
              data-testid="textarea-join-message"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setJoinRequestDialog(null);
                setJoinRequestMessage('');
              }}
              data-testid="button-cancel-request"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (joinRequestDialog) {
                  joinChannelMutation.mutate({
                    channelId: joinRequestDialog.id,
                    message: joinRequestMessage
                  });
                }
              }}
              disabled={joinChannelMutation.isPending}
              data-testid="button-send-request"
            >
              Send Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
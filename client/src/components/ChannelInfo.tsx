import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  Hash,
  Lock,
  Users,
  Calendar,
  FileText,
  Shield,
  Star,
  Globe,
  MessageSquare,
  Crown,
  ShieldCheck,
  User,
  Clock,
  Activity,
  Archive,
  Pin,
  Info,
  ChevronRight,
  Settings,
  UserPlus,
  Link2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Channel {
  id: string;
  name: string;
  description?: string;
  purpose?: string;
  topic?: string;
  tier: 'NON_LICENSED' | 'FL_LICENSED' | 'MULTI_STATE';
  isPrivate?: boolean;
  isArchived?: boolean;
  isShared?: boolean;
  isAnnouncement?: boolean;
  createdAt?: string;
  createdBy?: string;
  ownerId?: string;
}

interface ChannelMember {
  id: string;
  userId: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    profileImageUrl?: string;
    isAdmin: boolean;
    isOnline?: boolean;
    lastSeenAt?: string;
  };
}

interface ChannelStats {
  memberCount: number;
  messageCount: number;
  activeToday: number;
  activeThisWeek: number;
  pinnedCount: number;
  fileCount: number;
}

interface ChannelInfoProps {
  channel: Channel;
  currentUserId: string;
  onOpenSettings?: () => void;
  onClose?: () => void;
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

const roleIcons = {
  owner: Crown,
  admin: ShieldCheck,
  member: User
};

const roleColors = {
  owner: 'text-yellow-500',
  admin: 'text-blue-500',
  member: 'text-muted-foreground'
};

export function ChannelInfo({ channel, currentUserId, onOpenSettings, onClose }: ChannelInfoProps) {
  const [activeTab, setActiveTab] = useState('about');

  // Fetch channel members
  const { data: members = [], isLoading: membersLoading } = useQuery<ChannelMember[]>({
    queryKey: [`/api/channels/${channel.id}/members`],
    enabled: activeTab === 'members'
  });

  // Fetch channel stats
  const { data: stats = {
    memberCount: 0,
    messageCount: 0,
    activeToday: 0,
    activeThisWeek: 0,
    pinnedCount: 0,
    fileCount: 0
  } as ChannelStats, isLoading: statsLoading } = useQuery<ChannelStats>({
    queryKey: [`/api/channels/${channel.id}/stats`],
    queryFn: async () => {
      // Mock stats for now - replace with actual API call
      return {
        memberCount: members.length || 0,
        messageCount: Math.floor(Math.random() * 1000) + 100,
        activeToday: Math.floor(Math.random() * members.length) || 0,
        activeThisWeek: members.length || 0,
        pinnedCount: Math.floor(Math.random() * 10),
        fileCount: Math.floor(Math.random() * 50)
      };
    },
    enabled: activeTab === 'about'
  });

  // Fetch pinned messages
  const { data: pinnedMessages = [] } = useQuery({
    queryKey: [`/api/messenger/pinned/${channel.id}`],
    enabled: activeTab === 'pinned'
  });

  // Fetch shared files
  const { data: sharedFiles = [] } = useQuery({
    queryKey: [`/api/channels/${channel.id}/files`],
    enabled: activeTab === 'files'
  });

  const currentMember = members.find(m => m.userId === currentUserId);
  const isOwner = currentMember?.role === 'owner';
  const isAdmin = currentMember?.role === 'admin' || isOwner;
  const TierIcon = tierConfig[channel.tier].icon;

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getLastSeenText = (member: ChannelMember) => {
    if (member.user?.isOnline) return 'Active now';
    if (!member.user?.lastSeenAt) return 'Never';
    
    const lastSeen = new Date(member.user.lastSeenAt);
    const now = new Date();
    const diff = now.getTime() - lastSeen.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return 'Recently';
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            {channel.isPrivate ? (
              <Lock className="h-5 w-5 text-muted-foreground" />
            ) : (
              <Hash className="h-5 w-5 text-muted-foreground" />
            )}
            <h2 className="text-lg font-semibold">{channel.name}</h2>
          </div>
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              data-testid="button-close-info"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
        
        <div className="flex items-center gap-2 mb-3">
          <Badge className={cn("text-xs", tierConfig[channel.tier].color)}>
            <TierIcon className="h-3 w-3 mr-1" />
            {tierConfig[channel.tier].label}
          </Badge>
          
          {channel.isPrivate && (
            <Badge variant="secondary" className="text-xs">
              <Lock className="h-3 w-3 mr-1" />
              Private
            </Badge>
          )}
          
          {channel.isAnnouncement && (
            <Badge variant="secondary" className="text-xs">
              Announcement
            </Badge>
          )}
          
          {channel.isShared && (
            <Badge variant="secondary" className="text-xs">
              <Link2 className="h-3 w-3 mr-1" />
              Shared
            </Badge>
          )}
          
          {channel.isArchived && (
            <Badge variant="destructive" className="text-xs">
              <Archive className="h-3 w-3 mr-1" />
              Archived
            </Badge>
          )}
        </div>

        {onOpenSettings && isAdmin && (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={onOpenSettings}
            data-testid="button-channel-settings-info"
          >
            <Settings className="h-4 w-4 mr-1" />
            Channel Settings
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="mx-4 mt-2">
          <TabsTrigger value="about" data-testid="tab-info-about">
            <Info className="h-4 w-4 mr-1" />
            About
          </TabsTrigger>
          <TabsTrigger value="members" data-testid="tab-info-members">
            <Users className="h-4 w-4 mr-1" />
            Members ({stats.memberCount})
          </TabsTrigger>
          <TabsTrigger value="pinned" data-testid="tab-info-pinned">
            <Pin className="h-4 w-4 mr-1" />
            Pinned ({pinnedMessages.length})
          </TabsTrigger>
          <TabsTrigger value="files" data-testid="tab-info-files">
            <FileText className="h-4 w-4 mr-1" />
            Files ({sharedFiles.length})
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1">
          {/* About Tab */}
          <TabsContent value="about" className="p-4 space-y-4">
            {channel.description && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Description</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {channel.description}
                  </p>
                </CardContent>
              </Card>
            )}

            {channel.purpose && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Purpose</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {channel.purpose}
                  </p>
                </CardContent>
              </Card>
            )}

            {channel.topic && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Current Topic</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {channel.topic}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Channel Stats */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Channel Activity</CardTitle>
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Total Members
                      </span>
                      <span className="font-medium">{stats.memberCount}</span>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        Messages
                      </span>
                      <span className="font-medium">{stats.messageCount.toLocaleString()}</span>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <Activity className="h-4 w-4" />
                        Active Today
                      </span>
                      <span className="font-medium">{stats.activeToday}</span>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <Pin className="h-4 w-4" />
                        Pinned Items
                      </span>
                      <span className="font-medium">{stats.pinnedCount}</span>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Shared Files
                      </span>
                      <span className="font-medium">{stats.fileCount}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Channel Details */}
            {channel.createdAt && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Channel Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Created
                    </span>
                    <span>{formatDate(channel.createdAt)}</span>
                  </div>
                  
                  {channel.createdBy && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Created by</span>
                      <span>{channel.createdBy}</span>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Channel ID</span>
                    <span className="font-mono text-xs">{channel.id.slice(0, 8)}...</span>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Members Tab */}
          <TabsContent value="members" className="p-4">
            {membersLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-48" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {members.map((member) => {
                  const RoleIcon = roleIcons[member.role];
                  const initials = `${member.user?.firstName?.[0] || ''}${member.user?.lastName?.[0] || ''}`;
                  
                  return (
                    <Card key={member.id} data-testid={`info-member-${member.userId}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={member.user?.profileImageUrl} />
                              <AvatarFallback>{initials}</AvatarFallback>
                            </Avatar>
                            {member.user?.isOnline && (
                              <div className="absolute bottom-0 right-0 h-3 w-3 bg-green-500 rounded-full border-2 border-background" />
                            )}
                          </div>
                          
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm">
                                {member.user?.firstName} {member.user?.lastName}
                              </p>
                              <Badge
                                variant="secondary"
                                className={cn("text-xs", roleColors[member.role])}
                              >
                                <RoleIcon className="h-3 w-3 mr-1" />
                                {member.role}
                              </Badge>
                            </div>
                            
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span>{member.user?.email}</span>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {getLastSeenText(member)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                
                {isAdmin && (
                  <Card className="border-dashed">
                    <CardContent className="p-4">
                      <Button
                        variant="ghost"
                        className="w-full justify-start text-muted-foreground"
                        onClick={onOpenSettings}
                        data-testid="button-add-members-info"
                      >
                        <UserPlus className="h-4 w-4 mr-2" />
                        Add Members
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>

          {/* Pinned Tab */}
          <TabsContent value="pinned" className="p-4">
            {pinnedMessages.length === 0 ? (
              <Card>
                <CardContent className="text-center py-6">
                  <Pin className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No pinned messages yet
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Important messages that are pinned will appear here
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {pinnedMessages.map((message: any) => (
                  <Card key={message.id}>
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Pin className="h-3 w-3" />
                          Pinned by {message.pinnedBy} • {formatDate(message.pinnedAt)}
                        </div>
                        <p className="text-sm">{message.content}</p>
                        <p className="text-xs text-muted-foreground">
                          From {message.sender?.firstName} • {formatDate(message.createdAt)}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Files Tab */}
          <TabsContent value="files" className="p-4">
            {sharedFiles.length === 0 ? (
              <Card>
                <CardContent className="text-center py-6">
                  <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No files shared yet
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Files shared in this channel will appear here
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {sharedFiles.map((file: any) => (
                  <Card key={file.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <FileText className="h-8 w-8 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="font-medium text-sm">{file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Shared by {file.uploadedBy} • {formatDate(file.uploadedAt)}
                          </p>
                        </div>
                        <Button size="sm" variant="outline">
                          Download
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
}
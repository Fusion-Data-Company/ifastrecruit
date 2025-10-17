import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import {
  Settings,
  Users,
  Shield,
  Archive,
  Lock,
  Globe,
  Trash2,
  UserMinus,
  UserPlus,
  Crown,
  ShieldCheck,
  User,
  Search,
  MoreVertical,
  ChevronRight,
  Info,
  MessageSquare,
  Pin,
  X,
  Hash,
  Star,
  AlertTriangle
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
  };
}

interface ChannelPermission {
  id: string;
  channelId: string;
  role: string;
  canPost: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canInvite: boolean;
  canManageSettings: boolean;
  canManageMembers: boolean;
  canPin: boolean;
  canArchive: boolean;
}

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
  createdAt: string;
  createdBy?: string;
  ownerId?: string;
}

interface JoinRequest {
  id: string;
  channelId: string;
  userId: string;
  message?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewNote?: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

const channelSettingsSchema = z.object({
  name: z.string().min(1, 'Channel name is required').max(50, 'Channel name is too long'),
  description: z.string().max(500, 'Description is too long').optional(),
  purpose: z.string().max(250, 'Purpose is too long').optional(),
  topic: z.string().max(250, 'Topic is too long').optional(),
  isPrivate: z.boolean(),
  isAnnouncement: z.boolean()
});

type ChannelSettingsFormData = z.infer<typeof channelSettingsSchema>;

interface ChannelSettingsProps {
  channel: Channel;
  currentUserId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ChannelSettings({ channel, currentUserId, isOpen, onClose }: ChannelSettingsProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('general');
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<'admin' | 'member'>('member');

  const form = useForm<ChannelSettingsFormData>({
    resolver: zodResolver(channelSettingsSchema),
    defaultValues: {
      name: channel.name,
      description: channel.description || '',
      purpose: channel.purpose || '',
      topic: channel.topic || '',
      isPrivate: channel.isPrivate,
      isAnnouncement: channel.isAnnouncement
    }
  });

  // Fetch channel members
  const { data: members = [], isLoading: membersLoading } = useQuery<ChannelMember[]>({
    queryKey: [`/api/channels/${channel.id}/members`],
    enabled: isOpen && activeTab === 'members'
  });

  // Fetch channel permissions
  const { data: permissionsData, isLoading: permissionsLoading } = useQuery<{
    userPermissions: ChannelPermission;
    allPermissions?: ChannelPermission[];
  }>({
    queryKey: [`/api/channels/${channel.id}/permissions`],
    enabled: isOpen
  });

  const userPermissions = permissionsData?.userPermissions;
  const allPermissions = permissionsData?.allPermissions || [];

  // Fetch join requests for private channels
  const { data: joinRequests = [], refetch: refetchJoinRequests } = useQuery<JoinRequest[]>({
    queryKey: [`/api/channels/${channel.id}/join-requests`],
    enabled: isOpen && channel.isPrivate && activeTab === 'requests' && userPermissions?.canManageMembers
  });

  // Update channel settings mutation
  const updateChannelMutation = useMutation({
    mutationFn: async (data: ChannelSettingsFormData) => {
      const response = await apiRequest('PUT', `/api/channels/${channel.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Settings updated",
        description: "Channel settings have been updated successfully."
      });
      queryClient.invalidateQueries({ queryKey: ['/api/channels'] });
      queryClient.invalidateQueries({ queryKey: ['/api/channels/browse'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update settings",
        description: error.message || "Could not update channel settings.",
        variant: "destructive"
      });
    }
  });

  // Archive/unarchive channel mutation
  const archiveMutation = useMutation({
    mutationFn: async (archive: boolean) => {
      const endpoint = archive ? 
        `/api/channels/${channel.id}/archive` : 
        `/api/channels/${channel.id}/unarchive`;
      const response = await apiRequest('PUT', endpoint);
      return response.json();
    },
    onSuccess: (_, archive) => {
      toast({
        title: archive ? "Channel archived" : "Channel unarchived",
        description: archive ? 
          "The channel has been archived." : 
          "The channel has been restored from archive."
      });
      queryClient.invalidateQueries({ queryKey: ['/api/channels'] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update archive status",
        description: error.message || "Could not update channel archive status.",
        variant: "destructive"
      });
    }
  });

  // Remove member mutation
  const removeMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiRequest('DELETE', `/api/channels/${channel.id}/members/${userId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Member removed",
        description: "The member has been removed from the channel."
      });
      queryClient.invalidateQueries({ queryKey: [`/api/channels/${channel.id}/members`] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to remove member",
        description: error.message || "Could not remove member from channel.",
        variant: "destructive"
      });
    }
  });

  // Update member role mutation
  const updateMemberRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const response = await apiRequest('PUT', `/api/channels/${channel.id}/members/${userId}/role`, { role });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Role updated",
        description: "Member role has been updated."
      });
      queryClient.invalidateQueries({ queryKey: [`/api/channels/${channel.id}/members`] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update role",
        description: error.message || "Could not update member role.",
        variant: "destructive"
      });
    }
  });

  // Update permissions mutation
  const updatePermissionsMutation = useMutation({
    mutationFn: async ({ role, permissions }: { role: string; permissions: Partial<ChannelPermission> }) => {
      const response = await apiRequest('PUT', `/api/channels/${channel.id}/permissions`, { role, permissions });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Permissions updated",
        description: "Channel permissions have been updated."
      });
      queryClient.invalidateQueries({ queryKey: [`/api/channels/${channel.id}/permissions`] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update permissions",
        description: error.message || "Could not update permissions.",
        variant: "destructive"
      });
    }
  });

  // Review join request mutation
  const reviewJoinRequestMutation = useMutation({
    mutationFn: async ({ requestId, status, reviewNote }: { 
      requestId: string; 
      status: 'approved' | 'rejected';
      reviewNote?: string;
    }) => {
      const response = await apiRequest('POST', 
        `/api/channels/${channel.id}/join-requests/${requestId}/review`, 
        { status, reviewNote }
      );
      return response.json();
    },
    onSuccess: (_, { status }) => {
      toast({
        title: status === 'approved' ? "Request approved" : "Request rejected",
        description: status === 'approved' ? 
          "User has been added to the channel." :
          "Join request has been rejected."
      });
      refetchJoinRequests();
      queryClient.invalidateQueries({ queryKey: [`/api/channels/${channel.id}/members`] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to review request",
        description: error.message || "Could not process join request.",
        variant: "destructive"
      });
    }
  });

  const onSubmit = (data: ChannelSettingsFormData) => {
    updateChannelMutation.mutate(data);
  };

  const currentMember = members.find(m => m.userId === currentUserId);
  const isOwner = currentMember?.role === 'owner';
  const isAdmin = currentMember?.role === 'admin' || isOwner;
  const canManageSettings = userPermissions?.canManageSettings || false;
  const canManageMembers = userPermissions?.canManageMembers || false;
  const canArchive = userPermissions?.canArchive || false;

  const filteredMembers = members.filter(member => {
    if (!memberSearchQuery) return true;
    const fullName = `${member.user?.firstName || ''} ${member.user?.lastName || ''}`.toLowerCase();
    const email = member.user?.email?.toLowerCase() || '';
    const query = memberSearchQuery.toLowerCase();
    return fullName.includes(query) || email.includes(query);
  });

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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] p-0" data-testid="dialog-channel-settings">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Channel Settings
          </DialogTitle>
          <DialogDescription>
            {channel.isPrivate ? (
              <span className="flex items-center gap-1">
                <Lock className="h-3 w-3" />
                Private Channel
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Hash className="h-3 w-3" />
                Public Channel
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <TabsList className="px-6">
            <TabsTrigger value="general" data-testid="tab-general">
              <Info className="h-4 w-4 mr-1" />
              General
            </TabsTrigger>
            <TabsTrigger value="members" data-testid="tab-members">
              <Users className="h-4 w-4 mr-1" />
              Members ({members.length})
            </TabsTrigger>
            {canManageSettings && (
              <TabsTrigger value="permissions" data-testid="tab-permissions">
                <Shield className="h-4 w-4 mr-1" />
                Permissions
              </TabsTrigger>
            )}
            {channel.isPrivate && canManageMembers && (
              <TabsTrigger value="requests" data-testid="tab-requests">
                <UserPlus className="h-4 w-4 mr-1" />
                Join Requests ({joinRequests.filter(r => r.status === 'pending').length})
              </TabsTrigger>
            )}
          </TabsList>

          <ScrollArea className="h-[500px]">
            {/* General Settings Tab */}
            <TabsContent value="general" className="px-6 py-4 space-y-6">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Channel Name</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            disabled={!canManageSettings}
                            data-testid="input-channel-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea 
                            {...field}
                            placeholder="What's this channel about?"
                            disabled={!canManageSettings}
                            rows={3}
                            data-testid="textarea-description"
                          />
                        </FormControl>
                        <FormDescription>
                          Brief description of the channel's purpose
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="purpose"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Purpose</FormLabel>
                        <FormControl>
                          <Input 
                            {...field}
                            placeholder="e.g., Discuss Q1 sales targets"
                            disabled={!canManageSettings}
                            data-testid="input-purpose"
                          />
                        </FormControl>
                        <FormDescription>
                          Why this channel exists
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="topic"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Current Topic</FormLabel>
                        <FormControl>
                          <Input 
                            {...field}
                            placeholder="e.g., Working on new feature launch"
                            disabled={!canManageSettings}
                            data-testid="input-topic"
                          />
                        </FormControl>
                        <FormDescription>
                          Current discussion topic or focus area
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Separator />

                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="isPrivate"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <FormLabel>Private Channel</FormLabel>
                            <FormDescription>
                              Only invited members can view and join this channel
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              disabled={!canManageSettings}
                              data-testid="switch-private"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="isAnnouncement"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <FormLabel>Announcement Channel</FormLabel>
                            <FormDescription>
                              Only admins can post messages
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              disabled={!canManageSettings}
                              data-testid="switch-announcement"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  {canManageSettings && (
                    <Button 
                      type="submit" 
                      disabled={updateChannelMutation.isPending}
                      data-testid="button-save-settings"
                    >
                      Save Changes
                    </Button>
                  )}
                </form>
              </Form>

              {canArchive && (
                <div className="pt-6 border-t">
                  <Card className="border-destructive/50">
                    <CardHeader>
                      <CardTitle className="text-destructive flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5" />
                        Danger Zone
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">
                            {channel.isArchived ? 'Unarchive' : 'Archive'} this channel
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {channel.isArchived ? 
                              'Restore this channel and make it active again' :
                              'Archive this channel and hide it from the channel list'
                            }
                          </p>
                        </div>
                        <Button
                          variant={channel.isArchived ? "outline" : "destructive"}
                          onClick={() => archiveMutation.mutate(!channel.isArchived)}
                          disabled={archiveMutation.isPending}
                          data-testid="button-archive"
                        >
                          <Archive className="h-4 w-4 mr-1" />
                          {channel.isArchived ? 'Unarchive' : 'Archive'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>

            {/* Members Tab */}
            <TabsContent value="members" className="px-6 py-4">
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search members..."
                    value={memberSearchQuery}
                    onChange={(e) => setMemberSearchQuery(e.target.value)}
                    className="pl-9"
                    data-testid="input-search-members"
                  />
                </div>

                {membersLoading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredMembers.map((member) => {
                      const RoleIcon = roleIcons[member.role];
                      const initials = `${member.user?.firstName?.[0] || ''}${member.user?.lastName?.[0] || ''}`;
                      
                      return (
                        <Card key={member.id} data-testid={`member-card-${member.userId}`}>
                          <CardContent className="flex items-center justify-between p-4">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={member.user?.profileImageUrl} />
                                <AvatarFallback>{initials}</AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-medium">
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
                                <p className="text-sm text-muted-foreground">
                                  {member.user?.email}
                                </p>
                              </div>
                            </div>
                            
                            {canManageMembers && member.userId !== currentUserId && member.role !== 'owner' && (
                              <div className="flex items-center gap-2">
                                <Select
                                  value={member.role}
                                  onValueChange={(role) => {
                                    updateMemberRoleMutation.mutate({
                                      userId: member.userId,
                                      role
                                    });
                                  }}
                                  disabled={updateMemberRoleMutation.isPending}
                                >
                                  <SelectTrigger className="w-32" data-testid={`select-role-${member.userId}`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="admin">Admin</SelectItem>
                                    <SelectItem value="member">Member</SelectItem>
                                  </SelectContent>
                                </Select>
                                
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeMemberMutation.mutate(member.userId)}
                                  disabled={removeMemberMutation.isPending}
                                  data-testid={`button-remove-${member.userId}`}
                                >
                                  <UserMinus className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Permissions Tab */}
            {canManageSettings && (
              <TabsContent value="permissions" className="px-6 py-4">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-medium mb-3">Default Permissions by Role</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Configure what each role can do in this channel
                    </p>
                  </div>

                  {permissionsLoading ? (
                    <Skeleton className="h-64 w-full" />
                  ) : (
                    <div className="space-y-4">
                      {['owner', 'admin', 'member'].map((role) => {
                        const rolePermissions = allPermissions.find(p => p.role === role) || {
                          canPost: role !== 'member' || !channel.isAnnouncement,
                          canEdit: role !== 'member',
                          canDelete: role === 'owner',
                          canInvite: role !== 'member',
                          canManageSettings: role === 'owner',
                          canManageMembers: role !== 'member',
                          canPin: role !== 'member',
                          canArchive: role === 'owner'
                        };

                        const RoleIcon = roleIcons[role as keyof typeof roleIcons];
                        
                        return (
                          <Card key={role}>
                            <CardHeader>
                              <CardTitle className="flex items-center gap-2 text-base">
                                <RoleIcon className={cn("h-4 w-4", roleColors[role as keyof typeof roleColors])} />
                                {role.charAt(0).toUpperCase() + role.slice(1)}
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              {[
                                { key: 'canPost', label: 'Post messages', icon: MessageSquare },
                                { key: 'canEdit', label: 'Edit own messages', icon: Settings },
                                { key: 'canDelete', label: "Delete others' messages", icon: Trash2 },
                                { key: 'canInvite', label: 'Invite members', icon: UserPlus },
                                { key: 'canManageSettings', label: 'Manage channel settings', icon: Settings },
                                { key: 'canManageMembers', label: 'Manage members', icon: Users },
                                { key: 'canPin', label: 'Pin messages', icon: Pin },
                                { key: 'canArchive', label: 'Archive channel', icon: Archive }
                              ].map(({ key, label, icon: Icon }) => (
                                <div key={key} className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Icon className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm">{label}</span>
                                  </div>
                                  <Switch
                                    checked={rolePermissions[key as keyof typeof rolePermissions] as boolean}
                                    onCheckedChange={(checked) => {
                                      updatePermissionsMutation.mutate({
                                        role,
                                        permissions: {
                                          ...rolePermissions,
                                          [key]: checked
                                        }
                                      });
                                    }}
                                    disabled={role === 'owner' || updatePermissionsMutation.isPending}
                                    data-testid={`switch-${role}-${key}`}
                                  />
                                </div>
                              ))}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>
              </TabsContent>
            )}

            {/* Join Requests Tab */}
            {channel.isPrivate && canManageMembers && (
              <TabsContent value="requests" className="px-6 py-4">
                <div className="space-y-4">
                  {joinRequests.length === 0 ? (
                    <Card>
                      <CardContent className="text-center py-6">
                        <p className="text-muted-foreground">No pending join requests</p>
                      </CardContent>
                    </Card>
                  ) : (
                    joinRequests.map((request) => (
                      <Card key={request.id} data-testid={`request-card-${request.id}`}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="space-y-2">
                              <div>
                                <p className="font-medium">
                                  {request.user?.firstName} {request.user?.lastName}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {request.user?.email}
                                </p>
                              </div>
                              
                              {request.message && (
                                <div className="bg-muted p-3 rounded-md">
                                  <p className="text-sm">{request.message}</p>
                                </div>
                              )}
                              
                              <p className="text-xs text-muted-foreground">
                                Requested {new Date(request.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                            
                            {request.status === 'pending' && (
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    reviewJoinRequestMutation.mutate({
                                      requestId: request.id,
                                      status: 'rejected'
                                    });
                                  }}
                                  disabled={reviewJoinRequestMutation.isPending}
                                  data-testid={`button-reject-${request.id}`}
                                >
                                  <X className="h-4 w-4" />
                                  Reject
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    reviewJoinRequestMutation.mutate({
                                      requestId: request.id,
                                      status: 'approved'
                                    });
                                  }}
                                  disabled={reviewJoinRequestMutation.isPending}
                                  data-testid={`button-approve-${request.id}`}
                                >
                                  <Check className="h-4 w-4" />
                                  Approve
                                </Button>
                              </div>
                            )}
                            
                            {request.status !== 'pending' && (
                              <Badge variant={request.status === 'approved' ? 'default' : 'secondary'}>
                                {request.status}
                              </Badge>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </TabsContent>
            )}
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
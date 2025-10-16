import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { CybercoreBackground } from '@/components/CybercoreBackground';
import { FloatingConsultButton } from '@/components/FloatingConsultButton';
import { HoverFooter } from '@/components/HoverFooter';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  Send, 
  Hash, 
  User, 
  Shield, 
  Star, 
  Globe, 
  MessageSquare, 
  MoreVertical,
  Edit2,
  Trash2,
  Paperclip,
  Upload,
  Circle,
  ChevronDown,
  ChevronRight,
  Search,
  Settings,
  Plus,
  Bot,
  Sparkles
} from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { cn } from '@/lib/utils';
import iFastRecruitLogo from "@assets/D3A79AEA-5F31-45A5-90D2-AD2878D4A934_1760646767765.png";

interface Channel {
  id: string;
  name: string;
  description?: string;
  tier: 'NON_LICENSED' | 'FL_LICENSED' | 'MULTI_STATE';
  badgeIcon?: string;
  badgeColor?: string;
  isActive?: boolean;
}

interface Message {
  id: string;
  channelId: string;
  senderId: string;
  userId: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
  fileUrl?: string;
  fileName?: string;
  sender?: { 
    id: string;
    firstName?: string;
    lastName?: string;
    email: string;
    profileImageUrl?: string;
    isAdmin?: boolean;
  };
  isEdited?: boolean;
  isAiGenerated?: boolean;
  reactions?: Array<{ emoji: string; userId: string }>;
}

interface DirectMessage {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  isRead: boolean;
  createdAt: string;
  fileUrl?: string;
  fileName?: string;
}

interface DMUser {
  id: string;
  firstName?: string;
  lastName?: string;
  email: string;
  isAdmin: boolean;
  onlineStatus?: string;
  profileImageUrl?: string;
  hasFloridaLicense?: boolean;
  isMultiStateLicensed?: boolean;
}

interface DMConversation {
  userId: string;
  user: DMUser | null;
  lastMessage: DirectMessage;
  unreadCount?: number;
}

type ViewMode = 'channel' | 'dm';

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

export default function MessengerPage() {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('channel');
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [selectedDMUser, setSelectedDMUser] = useState<DMUser | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [showChannels, setShowChannels] = useState(true);
  const [showDMs, setShowDMs] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showParsedResumeModal, setShowParsedResumeModal] = useState(false);
  const [selectedResume, setSelectedResume] = useState<any>(null);
  const [userFiles, setUserFiles] = useState<any[]>([]);
  const [askJasonMode, setAskJasonMode] = useState(false);
  const [jasonLoading, setJasonLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Queries
  const { data: channels = [] } = useQuery<Channel[]>({
    queryKey: ['/api/channels'],
    enabled: !!user,
  });

  const { data: channelMessages = [] } = useQuery<Message[]>({
    queryKey: [`/api/channels/${selectedChannel?.id}/messages`],
    enabled: !!selectedChannel && viewMode === 'channel',
  });

  const { data: dmUsers = [] } = useQuery<DMUser[]>({
    queryKey: ['/api/messenger/dm/users'],
    enabled: !!user,
  });

  const { data: dmConversations = [] } = useQuery<DMConversation[]>({
    queryKey: ['/api/messenger/dm/conversations'],
    enabled: !!user,
  });

  const { data: directMessages = [] } = useQuery<DirectMessage[]>({
    queryKey: [`/api/messenger/dm/messages/${selectedDMUser?.id}`],
    enabled: !!selectedDMUser && viewMode === 'dm',
  });

  const { data: onlineUsers = [] } = useQuery<DMUser[]>({
    queryKey: ['/api/online-users'],
    enabled: !!user,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: userUploads = [] } = useQuery<any[]>({
    queryKey: ['/api/messenger/uploads'],
    enabled: !!user,
  });

  // WebSocket connection
  useEffect(() => {
    if (!user) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const websocket = new WebSocket(`${protocol}//${window.location.host}/ws/messenger`);

    websocket.onopen = () => {
      console.log('[WS] Connected');
      websocket.send(JSON.stringify({
        type: 'authenticate',
        payload: { userId: user.id }
      }));
    };

    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'new_message' && viewMode === 'channel' && selectedChannel && data.payload.channelId === selectedChannel.id) {
        queryClient.invalidateQueries({ queryKey: [`/api/channels/${selectedChannel.id}/messages`] });
      }
      
      if (data.type === 'new_direct_message') {
        // Invalidate queries to show new message and unread count
        queryClient.invalidateQueries({ queryKey: [`/api/messenger/dm/messages/${data.payload.message?.senderId}`] });
        queryClient.invalidateQueries({ queryKey: ['/api/messenger/dm/conversations'] });
        
        // Show notification if not in the same conversation
        if (viewMode !== 'dm' || selectedDMUser?.id !== data.payload.message?.senderId) {
          // You could add a toast notification here
        }
      }
      
      if (data.type === 'direct_message_sent' && viewMode === 'dm') {
        queryClient.invalidateQueries({ queryKey: [`/api/messenger/dm/messages/${selectedDMUser?.id}`] });
        queryClient.invalidateQueries({ queryKey: ['/api/messenger/dm/conversations'] });
      }

      if (data.type === 'message_edited' || data.type === 'message_deleted') {
        queryClient.invalidateQueries({ queryKey: [`/api/channels/${selectedChannel?.id}/messages`] });
      }

      if (data.type === 'user_status_change' || data.type === 'user_online_status') {
        queryClient.invalidateQueries({ queryKey: ['/api/online-users'] });
        queryClient.invalidateQueries({ queryKey: ['/api/direct-messages-users'] });
        queryClient.invalidateQueries({ queryKey: ['/api/messenger/dm/users'] });
      }
      
      if (data.type === 'notification_sound' && data.payload?.soundType === 'dm') {
        // Play notification sound for new DM
        const audio = new Audio('/sounds/notification.mp3');
        audio.volume = 0.5;
        audio.play().catch(e => console.log('Could not play notification sound:', e));
      }
      
      if (data.type === 'dm_read' || data.type === 'unread_counts_updated') {
        // Update unread counts
        queryClient.invalidateQueries({ queryKey: ['/api/direct-messages/conversations'] });
        queryClient.invalidateQueries({ queryKey: ['/api/messenger/dm/conversations'] });
        queryClient.invalidateQueries({ queryKey: ['/api/messenger/dm/unread'] });
      }

      // File upload events
      if (data.type === 'file_uploaded') {
        queryClient.invalidateQueries({ queryKey: ['/api/messenger/uploads'] });
        if (data.payload.file.isResume) {
          // Show notification that resume is being parsed
          console.log('Resume uploaded, parsing in progress...');
        }
      }

      if (data.type === 'resume_parsed') {
        queryClient.invalidateQueries({ queryKey: ['/api/messenger/uploads'] });
        // Update the file in userFiles state with parsed data
        setUserFiles(prevFiles => 
          prevFiles.map(f => 
            f.id === data.payload.fileId 
              ? { ...f, parsedData: data.payload.parsedData, parseStatus: 'parsed' }
              : f
          )
        );
      }
    };

    websocket.onerror = (error) => {
      console.error('[WS] Error:', error);
    };

    websocket.onclose = () => {
      console.log('[WS] Disconnected');
    };

    setWs(websocket);

    return () => {
      websocket.close();
    };
  }, [user, selectedChannel, selectedDMUser, viewMode]);

  // Auto-scroll to bottom for new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [channelMessages, directMessages]);

  // Mutations
  const sendChannelMessageMutation = useMutation({
    mutationFn: async (payload: { content: string; fileUrl?: string; fileName?: string }) => {
      if (!selectedChannel || !user) return;

      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'message',
          payload: {
            channelId: selectedChannel.id,
            userId: user.id,
            ...payload
          }
        }));
      }
    },
    onSuccess: () => {
      setMessageInput('');
      setUploadingFile(false);
      if (selectedChannel) {
        queryClient.invalidateQueries({ queryKey: [`/api/channels/${selectedChannel.id}/messages`] });
      }
    }
  });

  const sendDirectMessageMutation = useMutation({
    mutationFn: async (payload: { content: string; fileUrl?: string; fileName?: string }) => {
      if (!selectedDMUser || !user) return;

      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'direct_message',
          payload: {
            receiverId: selectedDMUser.id,
            ...payload
          }
        }));
      }
    },
    onSuccess: () => {
      setMessageInput('');
      setUploadingFile(false);
      if (selectedDMUser) {
        queryClient.invalidateQueries({ queryKey: [`/api/direct-messages/${selectedDMUser.id}`] });
        queryClient.invalidateQueries({ queryKey: ['/api/direct-messages/conversations'] });
      }
    }
  });

  const editMessageMutation = useMutation({
    mutationFn: async ({ messageId, content }: { messageId: string; content: string }) => {
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      
      ws.send(JSON.stringify({
        type: 'edit_message',
        payload: { messageId, content }
      }));
    },
    onSuccess: () => {
      setEditingMessageId(null);
      setEditContent('');
      if (selectedChannel) {
        queryClient.invalidateQueries({ queryKey: [`/api/channels/${selectedChannel.id}/messages`] });
      }
    }
  });

  const deleteMessageMutation = useMutation({
    mutationFn: async (messageId: string) => {
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      
      ws.send(JSON.stringify({
        type: 'delete_message',
        payload: { messageId }
      }));
    },
    onSuccess: () => {
      if (selectedChannel) {
        queryClient.invalidateQueries({ queryKey: [`/api/channels/${selectedChannel.id}/messages`] });
      }
    }
  });

  // Jason AI mutation
  const askJasonMutation = useMutation({
    mutationFn: async (message: string) => {
      // Prepare conversation history based on view mode
      const conversationHistory = viewMode === 'channel' 
        ? channelMessages.slice(-5).map(msg => ({
            role: msg.isAiGenerated ? 'assistant' : 'user',
            content: msg.content
          }))
        : directMessages.slice(-5).map(msg => ({
            role: msg.senderId === 'jason-ai' ? 'assistant' : 'user',
            content: msg.content
          }));

      const response = await apiRequest('/api/messenger/ai/jason', {
        method: 'POST',
        body: JSON.stringify({
          message,
          channel: selectedChannel?.name || selectedDMUser?.firstName || 'general',
          conversationHistory,
          isDM: viewMode === 'dm',
          dmUserId: selectedDMUser?.id
        })
      });
      return response;
    },
    onSuccess: async (response) => {
      // Send the AI response as a message in the current channel or DM
      if (response.message) {
        if (viewMode === 'channel' && selectedChannel) {
          // Send as a channel message with AI flag
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'message',
              payload: {
                channelId: selectedChannel.id,
                userId: 'jason-ai',
                content: response.message,
                isAiGenerated: true
              }
            }));
          }
        } else if (viewMode === 'dm' && selectedDMUser) {
          // Send as a direct message with AI flag
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'direct_message',
              payload: {
                receiverId: selectedDMUser.id,
                content: response.message,
                isAiGenerated: true,
                senderId: 'jason-ai'
              }
            }));
          }
        }
      }
      setJasonLoading(false);
      setAskJasonMode(false);
    },
    onError: () => {
      setJasonLoading(false);
    }
  });

  // File upload handlers
  const handleFileUpload = useCallback(async (file: File) => {
    if (!file) return;
    
    setUploadingFile(true);
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await apiRequest('/api/messenger/upload', 'POST', formData);
      
      const payload = {
        content: messageInput || `📎 ${file.name}`,
        fileUrl: (response as any).fileUrl,
        fileName: file.name,
        fileId: (response as any).fileId
      };
      
      if (viewMode === 'channel') {
        sendChannelMessageMutation.mutate(payload);
      } else {
        sendDirectMessageMutation.mutate(payload);
      }
    } catch (error) {
      console.error('File upload failed:', error);
      setUploadingFile(false);
    }
  }, [messageInput, viewMode, sendChannelMessageMutation, sendDirectMessageMutation]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  }, [handleFileUpload]);

  const handleSendMessage = () => {
    if (!messageInput.trim() && !uploadingFile) return;
    
    // If in Ask Jason mode, send to AI instead
    if (askJasonMode && messageInput.trim()) {
      setJasonLoading(true);
      askJasonMutation.mutate(messageInput);
      setMessageInput('');
      return;
    }
    
    if (viewMode === 'channel') {
      sendChannelMessageMutation.mutate({ content: messageInput });
    } else {
      sendDirectMessageMutation.mutate({ content: messageInput });
    }
  };

  const handleEditMessage = (message: Message) => {
    setEditingMessageId(message.id);
    setEditContent(message.content);
  };

  const saveEdit = () => {
    if (editingMessageId && editContent.trim()) {
      editMessageMutation.mutate({ messageId: editingMessageId, content: editContent });
    }
  };

  // Check user's channel access
  const getUserAccessibleChannels = () => {
    if (!user) return [];
    if (user.isAdmin) return channels; // Admins can access all channels
    
    const accessibleChannels: Channel[] = [];
    
    // Everyone can access NON_LICENSED
    const nonLicensed = channels.find(c => c.tier === 'NON_LICENSED');
    if (nonLicensed) accessibleChannels.push(nonLicensed);
    
    // FL licensed users can access FL_LICENSED
    if (user.hasFloridaLicense) {
      const flLicensed = channels.find(c => c.tier === 'FL_LICENSED');
      if (flLicensed) accessibleChannels.push(flLicensed);
    }
    
    // Multi-state licensed users can access MULTI_STATE
    if (user.isMultiStateLicensed) {
      const multiState = channels.find(c => c.tier === 'MULTI_STATE');
      if (multiState) accessibleChannels.push(multiState);
    }
    
    return accessibleChannels;
  };

  const accessibleChannels = getUserAccessibleChannels();

  // Auto-select first accessible channel
  useEffect(() => {
    if (accessibleChannels.length > 0 && !selectedChannel && viewMode === 'channel') {
      setSelectedChannel(accessibleChannels[0]);
    }
  }, [accessibleChannels, selectedChannel, viewMode]);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const getUserDisplayName = (user: DMUser | null | undefined | any) => {
    if (!user) return 'Unknown User';
    if (user.firstName || user.lastName) {
      return `${user.firstName || ''} ${user.lastName || ''}`.trim();
    }
    return user.email ? user.email.split('@')[0] : 'Unknown';
  };

  const getUserInitials = (user: DMUser | null | undefined | any) => {
    if (!user) return '?';
    const name = getUserDisplayName(user);
    const parts = name.split(' ');
    if (parts.length > 1) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const TierBadge = ({ tier }: { tier: keyof typeof tierConfig }) => {
    const config = tierConfig[tier];
    const Icon = config.icon;
    
    return (
      <Badge 
        className={cn(
          "px-2 py-0.5 rounded text-xs flex items-center gap-1 border",
          config.color
        )}
        data-testid={`badge-${tier.toLowerCase()}`}
      >
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-[#0a0f1c]">
      <CybercoreBackground />
      
      {/* Main Container */}
      <div className="flex flex-1 relative z-10 overflow-hidden">
        {/* Left Sidebar - Servers & Channels */}
        <div className="w-64 bg-black/30 backdrop-blur-sm border-r border-white/5 flex flex-col">
          {/* Server Header */}
          <div className="p-4 border-b border-white/5">
            <div className="flex items-center gap-3">
              <img src={iFastRecruitLogo} alt="iFast Recruit" className="h-8 w-8 rounded" />
              <div>
                <h2 className="text-white font-semibold">iFast Recruit</h2>
                <p className="text-xs text-gray-400">Enterprise Messaging</p>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input 
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                data-testid="search-input"
              />
            </div>
          </div>

          <ScrollArea className="flex-1 px-2">
            {/* Channels Section */}
            <div className="mb-4">
              <button
                onClick={() => setShowChannels(!showChannels)}
                className="flex items-center gap-1 w-full px-2 py-1 text-xs text-gray-400 hover:text-gray-300 transition-colors"
                data-testid="toggle-channels"
              >
                {showChannels ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                CHANNELS
              </button>
              
              {showChannels && (
                <div className="mt-1 space-y-0.5">
                  {(accessibleChannels || []).map(channel => (
                    <button
                      key={channel.id}
                      onClick={() => {
                        setSelectedChannel(channel);
                        setViewMode('channel');
                        setSelectedDMUser(null);
                      }}
                      className={cn(
                        "w-full px-2 py-2 rounded text-sm text-left transition-all",
                        "hover:bg-white/5",
                        selectedChannel?.id === channel.id && viewMode === 'channel' 
                          ? "bg-white/10 text-white" 
                          : "text-gray-400"
                      )}
                      data-testid={`channel-${channel.id}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <Hash className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate">{channel.name}</span>
                        </div>
                        {channel.tier && (
                          <div className="flex-shrink-0">
                            <TierBadge tier={channel.tier} />
                          </div>
                        )}
                      </div>
                      {channel.description && selectedChannel?.id === channel.id && (
                        <p className="text-xs text-gray-500 mt-1 pl-6">{channel.description}</p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Direct Messages Section */}
            <div>
              <div className="flex items-center justify-between px-2 py-1">
                <button
                  onClick={() => setShowDMs(!showDMs)}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-300 transition-colors"
                  data-testid="toggle-dms"
                >
                  {showDMs ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  DIRECT MESSAGES
                </button>
                <button className="text-gray-400 hover:text-gray-300">
                  <Plus className="h-3 w-3" />
                </button>
              </div>
              
              {showDMs && (
                <div className="mt-1 space-y-0.5">
                  {(dmConversations || []).map(conversation => (
                    <button
                      key={conversation.userId}
                      onClick={() => {
                        if (conversation.user) {
                          setSelectedDMUser(conversation.user);
                          setViewMode('dm');
                          setSelectedChannel(null);
                        }
                      }}
                      className={cn(
                        "w-full px-2 py-2 rounded text-sm text-left transition-all",
                        "hover:bg-white/5",
                        selectedDMUser?.id === conversation.userId && viewMode === 'dm'
                          ? "bg-white/10 text-white" 
                          : "text-gray-400"
                      )}
                      data-testid={`dm-${conversation.userId}`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <Avatar className="h-6 w-6">
                            {conversation.user?.profileImageUrl ? (
                              <AvatarImage src={conversation.user.profileImageUrl} />
                            ) : (
                              <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/20 text-xs">
                                {getUserInitials(conversation.user)}
                              </AvatarFallback>
                            )}
                          </Avatar>
                          <Circle 
                            className={cn(
                              "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 fill-current",
                              conversation.user?.onlineStatus === 'online' 
                                ? "text-green-500" 
                                : "text-gray-500"
                            )}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="truncate">
                              {getUserDisplayName(conversation.user)}
                            </span>
                            {conversation.user?.isAdmin && (
                              <Badge className="px-1 py-0 text-[10px] bg-red-500/20 text-red-400">
                                Admin
                              </Badge>
                            )}
                          </div>
                          {conversation.unreadCount && conversation.unreadCount > 0 && (
                            <span className="text-xs bg-primary text-primary-foreground rounded-full px-1.5">
                              {conversation.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                  
                  {/* Show other users for starting new conversations */}
                  {(dmUsers || [])
                    .filter(u => u.id !== user?.id && !(dmConversations || []).some(c => c.userId === u.id))
                    .map(dmUser => (
                      <button
                        key={dmUser.id}
                        onClick={() => {
                          setSelectedDMUser(dmUser);
                          setViewMode('dm');
                          setSelectedChannel(null);
                        }}
                        className={cn(
                          "w-full px-2 py-2 rounded text-sm text-left transition-all",
                          "hover:bg-white/5 text-gray-500"
                        )}
                        data-testid={`dm-new-${dmUser.id}`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="relative">
                            <Avatar className="h-6 w-6">
                              {dmUser.profileImageUrl ? (
                                <AvatarImage src={dmUser.profileImageUrl} />
                              ) : (
                                <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/20 text-xs">
                                  {getUserInitials(dmUser)}
                                </AvatarFallback>
                              )}
                            </Avatar>
                            <Circle 
                              className={cn(
                                "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 fill-current",
                                dmUser.onlineStatus === 'online' 
                                  ? "text-green-500" 
                                  : "text-gray-500"
                              )}
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="truncate">
                              {getUserDisplayName(dmUser)}
                            </span>
                            {dmUser.isAdmin && (
                              <Badge className="px-1 py-0 text-[10px] bg-red-500/20 text-red-400">
                                Admin
                              </Badge>
                            )}
                          </div>
                        </div>
                      </button>
                    ))
                  }
                </div>
              )}
            </div>
          </ScrollArea>

          {/* User Settings */}
          <div className="p-3 border-t border-white/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  {user?.profileImageUrl ? (
                    <AvatarImage src={user.profileImageUrl} />
                  ) : (
                    <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/20">
                      {user?.firstName?.[0]}{user?.lastName?.[0]}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-xs text-gray-400 truncate">
                    {user?.email}
                  </p>
                </div>
              </div>
              <button className="text-gray-400 hover:text-gray-300">
                <Settings className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Center - Messages Area */}
        <div 
          className="flex-1 flex flex-col"
          ref={dropZoneRef}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Channel/DM Header */}
          <div className="h-14 px-4 flex items-center justify-between border-b border-white/5 bg-black/20 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              {viewMode === 'channel' && selectedChannel ? (
                <>
                  <Hash className="h-5 w-5 text-gray-400" />
                  <span className="text-white font-medium">{selectedChannel.name}</span>
                  {selectedChannel.tier && <TierBadge tier={selectedChannel.tier} />}
                  {selectedChannel.description && (
                    <span className="text-sm text-gray-400 ml-2">
                      {selectedChannel.description}
                    </span>
                  )}
                </>
              ) : selectedDMUser ? (
                <>
                  <Avatar className="h-8 w-8">
                    {selectedDMUser.profileImageUrl ? (
                      <AvatarImage src={selectedDMUser.profileImageUrl} />
                    ) : (
                      <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/20">
                        {getUserInitials(selectedDMUser)}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <span className="text-white font-medium">
                    {getUserDisplayName(selectedDMUser)}
                  </span>
                  <Circle 
                    className={cn(
                      "h-2.5 w-2.5 fill-current",
                      selectedDMUser.onlineStatus === 'online' ? "text-green-500" : "text-gray-500"
                    )}
                  />
                </>
              ) : (
                <span className="text-gray-400">Select a channel or user</span>
              )}
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4">
            {isDragging && (
              <div className="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary rounded-lg flex items-center justify-center z-50">
                <div className="text-center">
                  <Upload className="h-12 w-12 text-primary mx-auto mb-2" />
                  <p className="text-white text-lg">Drop files here to upload</p>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {viewMode === 'channel' ? (
                channelMessages.map((message) => {
                  const isOwnMessage = message.userId === user?.id;
                  
                  return (
                    <div key={message.id} className="group flex gap-3 hover:bg-white/5 px-2 py-2 rounded transition-all">
                      <Avatar className="h-10 w-10 flex-shrink-0">
                        {message.sender?.profileImageUrl ? (
                          <AvatarImage src={message.sender.profileImageUrl} />
                        ) : (
                          <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/20">
                            {getUserInitials(message.sender)}
                          </AvatarFallback>
                        )}
                      </Avatar>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="text-white font-medium">
                            {getUserDisplayName(message.sender)}
                          </span>
                          {message.sender?.isAdmin && (
                            <Badge className="px-1 py-0 text-[10px] bg-red-500/20 text-red-400">
                              Admin
                            </Badge>
                          )}
                          {message.isAiGenerated && (
                            <Badge className="px-1.5 py-0 text-[10px] bg-gradient-to-r from-purple-500/20 to-indigo-500/20 text-purple-400 flex items-center gap-1">
                              <Bot className="h-3 w-3" />
                              AI Mentor
                            </Badge>
                          )}
                          <span className="text-xs text-gray-500">
                            {formatTime(message.createdAt)}
                          </span>
                          {message.isEdited && (
                            <span className="text-xs text-gray-500">(edited)</span>
                          )}
                          
                          {isOwnMessage && (
                            <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                              <button
                                onClick={() => handleEditMessage(message)}
                                className="text-gray-400 hover:text-gray-300"
                                data-testid={`edit-message-${message.id}`}
                              >
                                <Edit2 className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => deleteMessageMutation.mutate(message.id)}
                                className="text-gray-400 hover:text-red-400"
                                data-testid={`delete-message-${message.id}`}
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                        </div>
                        
                        {editingMessageId === message.id ? (
                          <div className="mt-1 flex gap-2">
                            <Input
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveEdit();
                                if (e.key === 'Escape') {
                                  setEditingMessageId(null);
                                  setEditContent('');
                                }
                              }}
                              className="flex-1 bg-white/5 border-white/10 text-white"
                              autoFocus
                            />
                            <Button
                              onClick={saveEdit}
                              size="sm"
                              className="bg-primary hover:bg-primary/80"
                            >
                              Save
                            </Button>
                            <Button
                              onClick={() => {
                                setEditingMessageId(null);
                                setEditContent('');
                              }}
                              size="sm"
                              variant="ghost"
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <>
                            <p className="text-gray-300 mt-1 break-words">
                              {message.content}
                            </p>
                            {message.fileUrl && (
                              <a
                                href={message.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 mt-2 text-primary hover:text-primary/80"
                              >
                                <Paperclip className="h-4 w-4" />
                                {message.fileName || 'Attachment'}
                              </a>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                directMessages.map((message) => {
                  const isOwnMessage = message.senderId === user?.id;
                  const messageUser = isOwnMessage ? user : selectedDMUser;
                  
                  return (
                    <div key={message.id} className={cn(
                      "group flex gap-3 px-2 py-2 rounded transition-all",
                      isOwnMessage ? "flex-row-reverse" : "",
                      "hover:bg-white/5"
                    )}>
                      <Avatar className="h-10 w-10 flex-shrink-0">
                        {messageUser?.profileImageUrl ? (
                          <AvatarImage src={messageUser.profileImageUrl} />
                        ) : (
                          <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/20">
                            {getUserInitials(messageUser)}
                          </AvatarFallback>
                        )}
                      </Avatar>
                      
                      <div className={cn(
                        "max-w-[70%]",
                        isOwnMessage && "text-right"
                      )}>
                        <div className="flex items-baseline gap-2">
                          <span className="text-xs text-gray-500">
                            {formatTime(message.createdAt)}
                          </span>
                        </div>
                        
                        <div className={cn(
                          "mt-1 px-4 py-2 rounded-lg inline-block",
                          isOwnMessage 
                            ? "bg-primary/20 text-white" 
                            : "bg-white/10 text-gray-300"
                        )}>
                          <p className="break-words">
                            {message.content}
                          </p>
                          {message.fileUrl && (
                            <a
                              href={message.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 mt-2 text-primary hover:text-primary/80"
                            >
                              <Paperclip className="h-4 w-4" />
                              {message.fileName || 'Attachment'}
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div ref={messagesEndRef} />
          </ScrollArea>

          {/* Message Input */}
          <div className="p-4 border-t border-white/5">
            <div className="flex gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-gray-400 hover:text-gray-300 transition-colors"
                disabled={uploadingFile}
                data-testid="attach-file"
              >
                <Paperclip className="h-5 w-5" />
              </button>

              {/* Ask Jason AI Button */}
              <Button
                onClick={() => {
                  setAskJasonMode(!askJasonMode);
                }}
                size="sm"
                variant={askJasonMode ? "default" : "ghost"}
                className={cn(
                  "flex items-center gap-2",
                  askJasonMode && "bg-gradient-to-r from-purple-500 to-indigo-500 text-white"
                )}
                data-testid="ask-jason"
              >
                <Bot className="h-4 w-4" />
                {askJasonMode ? "Asking Jason..." : "Ask Jason"}
                <Sparkles className="h-3 w-3" />
              </Button>
              
              <Input
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder={
                  uploadingFile 
                    ? "Uploading file..." 
                    : askJasonMode
                      ? "Ask Jason for advice about insurance, licensing, or career growth..."
                    : viewMode === 'channel' && selectedChannel 
                      ? `Message #${selectedChannel.name}` 
                      : selectedDMUser 
                        ? `Message ${getUserDisplayName(selectedDMUser)}`
                        : "Select a channel or user"
                }
                disabled={uploadingFile || (!selectedChannel && !selectedDMUser)}
                className="flex-1 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                data-testid="message-input"
              />
              
              <Button
                onClick={handleSendMessage}
                disabled={(!messageInput.trim() && !uploadingFile) || (!selectedChannel && !selectedDMUser)}
                className="bg-primary hover:bg-primary/80 transition-colors"
                data-testid="send-button"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Right Sidebar - Active Users */}
        <div className="w-64 bg-black/30 backdrop-blur-sm border-l border-white/5 flex flex-col">
          <div className="p-4 border-b border-white/5">
            <h3 className="text-white font-medium">Active Now</h3>
          </div>
          
          <ScrollArea className="flex-1 p-3">
            <div className="space-y-2">
              {(onlineUsers || [])
                .filter(u => u.onlineStatus === 'online')
                .map(onlineUser => (
                  <button
                    key={onlineUser.id}
                    onClick={() => {
                      setSelectedDMUser(onlineUser);
                      setViewMode('dm');
                      setSelectedChannel(null);
                    }}
                    className="w-full flex items-center gap-3 p-2 rounded hover:bg-white/5 transition-all text-left"
                    data-testid={`online-user-${onlineUser.id}`}
                  >
                    <div className="relative">
                      <Avatar className="h-8 w-8">
                        {onlineUser.profileImageUrl ? (
                          <AvatarImage src={onlineUser.profileImageUrl} />
                        ) : (
                          <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/20">
                            {getUserInitials(onlineUser)}
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <Circle className="absolute -bottom-0.5 -right-0.5 h-3 w-3 fill-current text-green-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">
                        {getUserDisplayName(onlineUser)}
                      </p>
                      <div className="flex items-center gap-1">
                        {onlineUser.isAdmin && (
                          <Badge className="px-1 py-0 text-[10px] bg-red-500/20 text-red-400">
                            Admin
                          </Badge>
                        )}
                        {onlineUser.isMultiStateLicensed && (
                          <Badge className="px-1 py-0 text-[10px] bg-purple-500/20 text-purple-400">
                            Multi
                          </Badge>
                        )}
                        {onlineUser.hasFloridaLicense && !onlineUser.isMultiStateLicensed && (
                          <Badge className="px-1 py-0 text-[10px] bg-amber-500/20 text-amber-400">
                            FL
                          </Badge>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              }
              
              {(onlineUsers || []).filter(u => u.onlineStatus === 'online').length === 0 && (
                <p className="text-gray-500 text-sm text-center py-4">
                  No users online
                </p>
              )}
            </div>

            {/* Offline Users Section */}
            <div className="mt-6">
              <h4 className="text-xs text-gray-400 font-medium mb-2">OFFLINE</h4>
              <div className="space-y-2">
                {(onlineUsers || [])
                  .filter(u => u.onlineStatus !== 'online')
                  .map(offlineUser => (
                    <button
                      key={offlineUser.id}
                      onClick={() => {
                        setSelectedDMUser(offlineUser);
                        setViewMode('dm');
                        setSelectedChannel(null);
                      }}
                      className="w-full flex items-center gap-3 p-2 rounded hover:bg-white/5 transition-all text-left opacity-60"
                      data-testid={`offline-user-${offlineUser.id}`}
                    >
                      <div className="relative">
                        <Avatar className="h-8 w-8">
                          {offlineUser.profileImageUrl ? (
                            <AvatarImage src={offlineUser.profileImageUrl} />
                          ) : (
                            <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/20">
                              {getUserInitials(offlineUser)}
                            </AvatarFallback>
                          )}
                        </Avatar>
                        <Circle className="absolute -bottom-0.5 -right-0.5 h-3 w-3 fill-current text-gray-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-400 truncate">
                          {getUserDisplayName(offlineUser)}
                        </p>
                      </div>
                    </button>
                  ))
                }
              </div>
            </div>
          </ScrollArea>
        </div>
      </div>

      <HoverFooter />
      <FloatingConsultButton />
    </div>
  );
}
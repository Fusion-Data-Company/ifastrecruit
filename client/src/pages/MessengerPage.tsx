import { useState, useEffect, useRef } from 'react';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Send, Hash, User, ChevronRight, ChevronDown, MessageSquare, Info } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface Channel {
  id: string;
  name: string;
  description?: string;
  type: string;
}

interface Message {
  id: string;
  channelId: string;
  senderId: string;
  userId: string;
  content: string;
  createdAt: Date;
  sender?: { name: string; email: string };
}

interface DirectMessage {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  isRead: boolean;
  createdAt: Date;
}

interface DMUser {
  id: string;
  firstName?: string;
  lastName?: string;
  email: string;
  isAdmin: boolean;
  onlineStatus?: string;
  profileImageUrl?: string;
}

interface DMConversation {
  userId: string;
  user: DMUser | null;
  lastMessage: DirectMessage;
}

type ViewMode = 'channel' | 'dm';

export default function MessengerPage() {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('channel');
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [selectedDMUser, setSelectedDMUser] = useState<DMUser | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [showDMs, setShowDMs] = useState(true);
  const [showChannels, setShowChannels] = useState(true);
  const [showProfilePanel, setShowProfilePanel] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: channels = [] } = useQuery<Channel[]>({
    queryKey: ['/api/channels'],
    enabled: !!user,
  });

  const { data: channelMessages = [] } = useQuery<Message[]>({
    queryKey: [`/api/channels/${selectedChannel?.id}/messages`],
    enabled: !!selectedChannel && viewMode === 'channel',
  });

  const { data: dmUsers = [] } = useQuery<DMUser[]>({
    queryKey: ['/api/direct-messages-users'],
    enabled: !!user,
  });

  const { data: dmConversations = [] } = useQuery<DMConversation[]>({
    queryKey: ['/api/direct-messages/conversations'],
    enabled: !!user,
  });

  const { data: directMessages = [] } = useQuery<DirectMessage[]>({
    queryKey: [`/api/direct-messages/${selectedDMUser?.id}`],
    enabled: !!selectedDMUser && viewMode === 'dm',
  });

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
      
      if (data.type === 'new_message' && viewMode === 'channel' && data.payload.channelId === selectedChannel?.id) {
        queryClient.invalidateQueries({ queryKey: [`/api/channels/${selectedChannel.id}/messages`] });
      }
      
      if ((data.type === 'new_direct_message' || data.type === 'direct_message_sent') && viewMode === 'dm') {
        queryClient.invalidateQueries({ queryKey: [`/api/direct-messages/${selectedDMUser?.id}`] });
        queryClient.invalidateQueries({ queryKey: ['/api/direct-messages/conversations'] });
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [channelMessages, directMessages]);

  const sendChannelMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!selectedChannel || !user) return;

      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'message',
          payload: {
            channelId: selectedChannel.id,
            userId: user.id,
            content
          }
        }));
      }
    },
    onSuccess: () => {
      setMessageInput('');
      if (selectedChannel) {
        queryClient.invalidateQueries({ queryKey: [`/api/channels/${selectedChannel.id}/messages`] });
      }
    }
  });

  const sendDirectMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!selectedDMUser || !user) return;

      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'direct_message',
          payload: {
            receiverId: selectedDMUser.id,
            content
          }
        }));
      }
    },
    onSuccess: () => {
      setMessageInput('');
      if (selectedDMUser) {
        queryClient.invalidateQueries({ queryKey: [`/api/direct-messages/${selectedDMUser.id}`] });
        queryClient.invalidateQueries({ queryKey: ['/api/direct-messages/conversations'] });
      }
    }
  });

  const handleSendMessage = () => {
    if (!messageInput.trim()) return;
    
    if (viewMode === 'channel') {
      sendChannelMessageMutation.mutate(messageInput);
    } else {
      sendDirectMessageMutation.mutate(messageInput);
    }
  };

  useEffect(() => {
    if (channels.length > 0 && !selectedChannel && viewMode === 'channel') {
      setSelectedChannel(channels[0]);
    }
  }, [channels, selectedChannel, viewMode]);

  const getChannelBadge = (channel: Channel) => {
    if (channel.type === 'non_licensed') {
      return (
        <Badge className="px-2 py-0.5 rounded text-xs bg-gray-500/20 text-gray-400 border border-gray-500/30" data-testid={`badge-non-licensed-${channel.id}`}>
          Non-Licensed
        </Badge>
      );
    } else if (channel.type === 'fl_licensed') {
      return (
        <Badge className="px-2 py-0.5 rounded text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30" data-testid={`badge-fl-licensed-${channel.id}`}>
          FL-Licensed
        </Badge>
      );
    } else if (channel.type === 'multi_state') {
      return (
        <Popover>
          <PopoverTrigger asChild>
            <Badge className="px-2 py-0.5 rounded text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 cursor-pointer" data-testid={`badge-multi-state-${channel.id}`}>
              Multi-State
            </Badge>
          </PopoverTrigger>
          <PopoverContent className="w-64 bg-black/90 border-cyan-400/30 text-cyan-400">
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Licensed States:</h4>
              <div className="flex flex-wrap gap-1">
                {user?.licensedStates?.map((state) => (
                  <Badge key={state} variant="outline" className="text-xs border-cyan-400/30 text-cyan-400">
                    {state}
                  </Badge>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      );
    }
    return null;
  };

  const getUserBadge = () => {
    if (!user) return null;
    
    if (user.isMultiStateLicensed) {
      return (
        <Badge className="px-2 py-0.5 rounded text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" data-testid="user-badge-multi-state">
          Multi-State
        </Badge>
      );
    } else if (user.hasFloridaLicense) {
      return (
        <Badge className="px-2 py-0.5 rounded text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30" data-testid="user-badge-fl-licensed">
          FL-Licensed
        </Badge>
      );
    } else {
      return (
        <Badge className="px-2 py-0.5 rounded text-xs bg-gray-500/20 text-gray-400 border border-gray-500/30" data-testid="user-badge-non-licensed">
          Non-Licensed
        </Badge>
      );
    }
  };

  const getUserDisplayName = (dmUser: DMUser) => {
    if (dmUser.firstName && dmUser.lastName) {
      return `${dmUser.firstName} ${dmUser.lastName}`;
    }
    return dmUser.email;
  };

  const getOnlineStatusColor = (status?: string) => {
    if (status === 'online') return 'bg-green-500';
    if (status === 'away') return 'bg-yellow-500';
    return 'bg-gray-500';
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-cyan-400">
        <div>Please log in to access the messenger</div>
      </div>
    );
  }

  const currentMessages = viewMode === 'channel' ? channelMessages : directMessages;

  return (
    <div className="min-h-screen relative">
      <CybercoreBackground />
      
      <div className="relative z-10 container mx-auto px-4 py-8 h-screen flex items-center justify-center">
        <div className="w-full max-w-7xl h-[85vh] bg-black/40 backdrop-blur-xl border border-cyan-400/30 rounded-2xl shadow-2xl shadow-cyan-400/20 overflow-hidden flex">
          
          {/* Left Sidebar */}
          <div className="w-72 bg-black/60 border-r border-cyan-400/30 flex flex-col">
            {/* Channels Section */}
            <div className="p-4 border-b border-cyan-400/30">
              <button
                onClick={() => setShowChannels(!showChannels)}
                className="w-full flex items-center justify-between text-cyan-400 hover:text-cyan-300"
                data-testid="toggle-channels"
              >
                <h2 className="text-lg font-bold">Channels</h2>
                {showChannels ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            </div>
            
            {showChannels && (
              <div className="border-b border-cyan-400/30">
                <ScrollArea className="max-h-60">
                  <div className="p-2 space-y-1">
                    {channels.map((channel) => (
                      <button
                        key={channel.id}
                        onClick={() => {
                          setSelectedChannel(channel);
                          setViewMode('channel');
                          setSelectedDMUser(null);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg transition-all flex items-center gap-2 ${
                          viewMode === 'channel' && selectedChannel?.id === channel.id
                            ? 'bg-cyan-400/20 text-cyan-300'
                            : 'text-cyan-400/60 hover:bg-cyan-400/10 hover:text-cyan-400'
                        }`}
                        data-testid={`channel-${channel.id}`}
                      >
                        <Hash className="w-4 h-4 flex-shrink-0" />
                        <span className="flex-1 truncate">{channel.name}</span>
                        {getChannelBadge(channel)}
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Direct Messages Section */}
            <div className="p-4 border-b border-cyan-400/30">
              <button
                onClick={() => setShowDMs(!showDMs)}
                className="w-full flex items-center justify-between text-cyan-400 hover:text-cyan-300"
                data-testid="toggle-dms"
              >
                <h2 className="text-lg font-bold">Direct Messages</h2>
                {showDMs ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            </div>

            {showDMs && (
              <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                  {dmUsers.map((dmUser) => {
                    const conversation = dmConversations.find(c => c.userId === dmUser.id);
                    const hasUnread = conversation && !conversation.lastMessage.isRead && conversation.lastMessage.receiverId === user.id;
                    
                    return (
                      <button
                        key={dmUser.id}
                        onClick={() => {
                          setSelectedDMUser(dmUser);
                          setViewMode('dm');
                          setSelectedChannel(null);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg transition-all flex items-center gap-2 ${
                          viewMode === 'dm' && selectedDMUser?.id === dmUser.id
                            ? 'bg-cyan-400/20 text-cyan-300'
                            : 'text-cyan-400/60 hover:bg-cyan-400/10 hover:text-cyan-400'
                        }`}
                        data-testid={`dm-user-${dmUser.id}`}
                      >
                        <div className="relative flex-shrink-0">
                          <div className="w-8 h-8 rounded-full bg-cyan-400/20 flex items-center justify-center text-cyan-400">
                            {dmUser.firstName?.[0] || dmUser.email[0].toUpperCase()}
                          </div>
                          <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-black ${getOnlineStatusColor(dmUser.onlineStatus)}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate">{getUserDisplayName(dmUser)}</span>
                            {dmUser.isAdmin && (
                              <Badge variant="outline" className="text-xs border-cyan-400/30 text-cyan-400">Admin</Badge>
                            )}
                          </div>
                          {conversation && (
                            <p className="text-xs text-cyan-400/40 truncate">
                              {conversation.lastMessage.content}
                            </p>
                          )}
                        </div>
                        {hasUnread && (
                          <div className="w-2 h-2 rounded-full bg-cyan-400 flex-shrink-0" data-testid={`unread-indicator-${dmUser.id}`} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            )}

            {/* User Profile Footer */}
            <div className="p-4 border-t border-cyan-400/30">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-cyan-400/20 flex items-center justify-center text-cyan-400">
                  {user.firstName?.[0] || user.email[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-cyan-400 truncate">
                    {user.firstName && user.lastName 
                      ? `${user.firstName} ${user.lastName}` 
                      : user.email}
                  </div>
                  {getUserBadge()}
                </div>
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className={`flex-1 flex flex-col ${showProfilePanel ? '' : 'flex-1'}`}>
            {/* Header */}
            <div className="p-4 border-b border-cyan-400/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {viewMode === 'channel' ? (
                  <>
                    <Hash className="w-5 h-5 text-cyan-400" />
                    <h3 className="text-lg font-semibold text-cyan-400">{selectedChannel?.name || 'Select a channel'}</h3>
                  </>
                ) : (
                  <>
                    <MessageSquare className="w-5 h-5 text-cyan-400" />
                    <h3 className="text-lg font-semibold text-cyan-400">
                      {selectedDMUser ? getUserDisplayName(selectedDMUser) : 'Select a conversation'}
                    </h3>
                  </>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowProfilePanel(!showProfilePanel)}
                className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-400/10"
                data-testid="toggle-profile-panel"
              >
                <Info className="w-5 h-5" />
              </Button>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {currentMessages.map((message: any) => {
                  const isCurrentUser = message.userId === user.id || message.senderId === user.id;
                  const displayName = viewMode === 'channel' 
                    ? (message.sender?.name || message.userId)
                    : (message.senderId === user.id ? 'You' : getUserDisplayName(selectedDMUser!));
                  
                  return (
                    <div
                      key={message.id}
                      className="flex gap-3"
                      data-testid={`message-${message.id}`}
                    >
                      <div className="w-10 h-10 rounded-full bg-cyan-400/20 flex items-center justify-center text-cyan-400 flex-shrink-0">
                        {displayName[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className={`font-semibold ${isCurrentUser ? 'text-cyan-300' : 'text-cyan-400'}`}>
                            {displayName}
                          </span>
                          <span className="text-xs text-cyan-400/40">
                            {new Date(message.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-cyan-400/80">{message.content}</p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Message Input */}
            <div className="p-4 border-t border-cyan-400/30">
              <div className="flex gap-2">
                <Input
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                  placeholder={
                    viewMode === 'channel' 
                      ? `Message #${selectedChannel?.name || 'channel'}`
                      : `Message ${selectedDMUser ? getUserDisplayName(selectedDMUser) : 'user'}`
                  }
                  className="flex-1 bg-black/40 border-cyan-400/30 text-cyan-400 placeholder:text-cyan-400/40 focus:border-cyan-400"
                  data-testid="input-message"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim() || (viewMode === 'channel' ? sendChannelMessageMutation.isPending : sendDirectMessageMutation.isPending)}
                  className="bg-cyan-400 text-black hover:bg-cyan-300"
                  data-testid="button-send-message"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Right Profile Panel */}
          {showProfilePanel && (
            <div className="w-80 bg-black/60 border-l border-cyan-400/30 flex flex-col" data-testid="profile-panel">
              <ScrollArea className="flex-1 p-6">
                {viewMode === 'channel' && selectedChannel ? (
                  <div className="space-y-6">
                    <div className="text-center">
                      <div className="w-20 h-20 mx-auto rounded-full bg-cyan-400/20 flex items-center justify-center mb-4">
                        <Hash className="w-10 h-10 text-cyan-400" />
                      </div>
                      <h3 className="text-xl font-bold text-cyan-400 mb-2">#{selectedChannel.name}</h3>
                      {getChannelBadge(selectedChannel)}
                    </div>
                    
                    <Separator className="bg-cyan-400/20" />
                    
                    <div>
                      <h4 className="text-sm font-semibold text-cyan-400 mb-2">About</h4>
                      <p className="text-sm text-cyan-400/60">
                        {selectedChannel.description || 'No description available'}
                      </p>
                    </div>
                  </div>
                ) : viewMode === 'dm' && selectedDMUser ? (
                  <div className="space-y-6">
                    <div className="text-center">
                      <div className="w-20 h-20 mx-auto rounded-full bg-cyan-400/20 flex items-center justify-center mb-4 text-2xl text-cyan-400">
                        {selectedDMUser.firstName?.[0] || selectedDMUser.email[0].toUpperCase()}
                      </div>
                      <h3 className="text-xl font-bold text-cyan-400 mb-2">{getUserDisplayName(selectedDMUser)}</h3>
                      <div className="flex items-center justify-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${getOnlineStatusColor(selectedDMUser.onlineStatus)}`} />
                        <span className="text-sm text-cyan-400/60 capitalize">{selectedDMUser.onlineStatus || 'offline'}</span>
                      </div>
                    </div>
                    
                    <Separator className="bg-cyan-400/20" />
                    
                    <div>
                      <h4 className="text-sm font-semibold text-cyan-400 mb-2">About</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-cyan-400/60">Email:</span>
                          <span className="text-cyan-400">{selectedDMUser.email}</span>
                        </div>
                        {selectedDMUser.isAdmin && (
                          <div className="flex justify-between">
                            <span className="text-cyan-400/60">Role:</span>
                            <Badge variant="outline" className="border-cyan-400/30 text-cyan-400">Admin</Badge>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <Separator className="bg-cyan-400/20" />
                    
                    <Button 
                      className="w-full bg-cyan-400 text-black hover:bg-cyan-300"
                      data-testid="button-view-profile"
                    >
                      View Full Profile
                    </Button>
                  </div>
                ) : (
                  <div className="text-center text-cyan-400/60 py-8">
                    Select a channel or conversation to view details
                  </div>
                )}
              </ScrollArea>
            </div>
          )}
        </div>
      </div>

      <FloatingConsultButton visible={true} />
      <HoverFooter />
    </div>
  );
}

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  Sparkles,
  Lock,
  X,
  Smile
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

interface Reaction {
  id: string;
  messageId?: string;
  directMessageId?: string;
  userId: string;
  emoji: string;
  createdAt: string;
  user?: {
    id: string;
    firstName?: string;
    lastName?: string;
    email: string;
  };
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
  reactions?: { [emoji: string]: Reaction[] };
  // Threading fields
  parentMessageId?: string | null;
  threadCount?: number;
  lastThreadReply?: string | null;
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
  // Threading fields
  parentMessageId?: string | null;
  threadCount?: number;
  lastThreadReply?: string | null;
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
  // Thread state
  const [selectedThread, setSelectedThread] = useState<Message | DirectMessage | null>(null);
  const [threadReplies, setThreadReplies] = useState<(Message | DirectMessage)[]>([]);
  const [threadInput, setThreadInput] = useState('');
  const [showThreadPanel, setShowThreadPanel] = useState(false);
  // Reaction state
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const [messageReactions, setMessageReactions] = useState<{ [messageId: string]: { [emoji: string]: Reaction[] } }>({});
  // Mention state
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionStartPosition, setMentionStartPosition] = useState<number | null>(null);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const [mentionUsers, setMentionUsers] = useState<any[]>([]);
  // Typing indicator state
  const [typingUsers, setTypingUsers] = useState<{ [context: string]: string[] }>({});
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingRef = useRef<number>(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  // Thread queries
  const { data: threadRepliesData = [] } = useQuery<Message[] | DirectMessage[]>({
    queryKey: selectedThread 
      ? viewMode === 'channel' 
        ? [`/api/messenger/threads/${selectedThread.id}`]
        : [`/api/messenger/dm/threads/${selectedThread.id}`]
      : [],
    enabled: !!selectedThread,
    onSuccess: (data) => {
      setThreadReplies(data);
    }
  });

  // Reaction mutations
  const addReactionMutation = useMutation({
    mutationFn: async ({ messageId, emoji, messageType }: { messageId: string; emoji: string; messageType: 'channel' | 'dm' }) => {
      return apiRequest('/api/messenger/reactions/add', {
        method: 'POST',
        body: { messageId, emoji, messageType }
      });
    },
    onSuccess: (data, variables) => {
      // Optimistically update UI
      const { messageId, emoji } = variables;
      setMessageReactions(prev => ({
        ...prev,
        [messageId]: {
          ...prev[messageId],
          [emoji]: [...(prev[messageId]?.[emoji] || []), data]
        }
      }));
    }
  });

  const removeReactionMutation = useMutation({
    mutationFn: async ({ messageId, emoji, messageType }: { messageId: string; emoji: string; messageType: 'channel' | 'dm' }) => {
      return apiRequest('/api/messenger/reactions/remove', {
        method: 'POST',
        body: { messageId, emoji, messageType }
      });
    },
    onSuccess: (_, variables) => {
      // Optimistically update UI
      const { messageId, emoji } = variables;
      setMessageReactions(prev => {
        const updated = { ...prev };
        if (updated[messageId]?.[emoji]) {
          updated[messageId][emoji] = updated[messageId][emoji].filter(r => r.userId !== user?.id);
          if (updated[messageId][emoji].length === 0) {
            delete updated[messageId][emoji];
          }
        }
        return updated;
      });
    }
  });

  // Load reactions for messages
  useEffect(() => {
    const loadReactions = async () => {
      const messages = viewMode === 'channel' ? channelMessages : directMessages;
      const messageType = viewMode === 'channel' ? 'channel' : 'dm';
      
      for (const message of messages) {
        try {
          const response = await fetch(`/api/messenger/reactions/${messageType}/${message.id}`, {
            credentials: 'include'
          });
          if (response.ok) {
            const reactions = await response.json();
            setMessageReactions(prev => ({
              ...prev,
              [message.id]: reactions
            }));
          }
        } catch (error) {
          console.error('Error loading reactions:', error);
        }
      }
    };

    if ((channelMessages.length > 0 && viewMode === 'channel') || (directMessages.length > 0 && viewMode === 'dm')) {
      loadReactions();
    }
  }, [channelMessages, directMessages, viewMode]);

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
      
      // Thread events
      if (data.type === 'thread_reply') {
        // Refresh thread replies if thread is open
        if (selectedThread?.id === data.payload.parentMessageId) {
          queryClient.invalidateQueries({ 
            queryKey: [`/api/messenger/threads/${data.payload.parentMessageId}`] 
          });
        }
        // Update parent message thread count
        queryClient.invalidateQueries({ 
          queryKey: [`/api/channels/${data.payload.channelId}/messages`] 
        });
      }
      
      if (data.type === 'dm_thread_reply') {
        // Refresh thread replies if thread is open
        if (selectedThread?.id === data.payload.parentMessageId) {
          queryClient.invalidateQueries({ 
            queryKey: [`/api/messenger/dm/threads/${data.payload.parentMessageId}`] 
          });
        }
        // Update DM conversations
        queryClient.invalidateQueries({ 
          queryKey: [`/api/messenger/dm/messages/${data.payload.senderId}`] 
        });
      }
      
      // Reaction events
      if (data.type === 'reaction_added') {
        const { messageId, messageType, reaction } = data.payload;
        setMessageReactions(prev => ({
          ...prev,
          [messageId]: {
            ...prev[messageId],
            [reaction.emoji]: [...(prev[messageId]?.[reaction.emoji] || []), reaction]
          }
        }));
      }
      
      if (data.type === 'reaction_removed') {
        const { messageId, userId, emoji } = data.payload;
        setMessageReactions(prev => {
          const updated = { ...prev };
          if (updated[messageId]?.[emoji]) {
            updated[messageId][emoji] = updated[messageId][emoji].filter(r => r.userId !== userId);
            if (updated[messageId][emoji].length === 0) {
              delete updated[messageId][emoji];
            }
          }
          return updated;
        });
      }
      
      // Typing indicator events
      if (data.type === 'typing_start') {
        const { typingUsers: newTypingUsers, channelId, recipientId, messageType } = data.payload;
        
        // Generate context key for tracking typing state
        let contextKey: string;
        if (messageType === 'channel' && channelId) {
          contextKey = `channel:${channelId}`;
        } else if (messageType === 'dm') {
          // For DMs, create a sorted key to ensure consistency
          const sortedIds = [user.id, recipientId].filter(Boolean).sort();
          contextKey = `dm:${sortedIds.join('-')}`;
        } else {
          contextKey = 'unknown';
        }
        
        setTypingUsers(prev => ({
          ...prev,
          [contextKey]: newTypingUsers.filter((id: string) => id !== user.id) // Don't show own typing
        }));
      }
      
      if (data.type === 'typing_stop') {
        const { typingUsers: newTypingUsers, channelId, recipientId, messageType } = data.payload;
        
        // Generate context key for tracking typing state
        let contextKey: string;
        if (messageType === 'channel' && channelId) {
          contextKey = `channel:${channelId}`;
        } else if (messageType === 'dm') {
          const sortedIds = [user.id, recipientId].filter(Boolean).sort();
          contextKey = `dm:${sortedIds.join('-')}`;
        } else {
          contextKey = 'unknown';
        }
        
        if (newTypingUsers.length === 0) {
          // Remove typing state if no one is typing
          setTypingUsers(prev => {
            const updated = { ...prev };
            delete updated[contextKey];
            return updated;
          });
        } else {
          setTypingUsers(prev => ({
            ...prev,
            [contextKey]: newTypingUsers.filter((id: string) => id !== user.id)
          }));
        }
      }
      
      if (data.type === 'thread_typing') {
        const { userId: typingUserId, parentMessageId, isDirectMessage } = data.payload;
        const contextKey = `thread:${parentMessageId}`;
        
        setTypingUsers(prev => {
          const currentUsers = prev[contextKey] || [];
          if (!currentUsers.includes(typingUserId) && typingUserId !== user.id) {
            return {
              ...prev,
              [contextKey]: [...currentUsers, typingUserId]
            };
          }
          return prev;
        });
        
        // Auto-clear after 3 seconds
        setTimeout(() => {
          setTypingUsers(prev => {
            const updated = { ...prev };
            if (updated[contextKey]) {
              updated[contextKey] = updated[contextKey].filter((id: string) => id !== typingUserId);
              if (updated[contextKey].length === 0) {
                delete updated[contextKey];
              }
            }
            return updated;
          });
        }, 3000);
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
  }, [user, selectedChannel, selectedDMUser, viewMode, selectedThread]);

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

  // Thread reply mutations
  const sendThreadReplyMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!selectedThread || !user) return;

      const endpoint = viewMode === 'channel' 
        ? '/api/messenger/threads/reply' 
        : '/api/messenger/dm/threads/reply';

      const payload = viewMode === 'channel' 
        ? {
            parentMessageId: selectedThread.id,
            channelId: (selectedThread as Message).channelId,
            content
          }
        : {
            parentMessageId: selectedThread.id,
            receiverId: selectedDMUser?.id,
            content
          };

      return apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    },
    onSuccess: () => {
      setThreadInput('');
      // Refresh thread replies
      if (selectedThread) {
        const queryKey = viewMode === 'channel'
          ? [`/api/messenger/threads/${selectedThread.id}`]
          : [`/api/messenger/dm/threads/${selectedThread.id}`];
        queryClient.invalidateQueries({ queryKey });
      }
      // Refresh main message list to update thread count
      if (viewMode === 'channel' && selectedChannel) {
        queryClient.invalidateQueries({ queryKey: [`/api/channels/${selectedChannel.id}/messages`] });
      } else if (viewMode === 'dm' && selectedDMUser) {
        queryClient.invalidateQueries({ queryKey: [`/api/messenger/dm/messages/${selectedDMUser.id}`] });
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

  // Typing indicator functions
  const sendTypingStart = useCallback(() => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    
    const now = Date.now();
    // Don't send if we sent one recently (within 2 seconds)
    if (now - lastTypingRef.current < 2000) return;
    
    lastTypingRef.current = now;
    
    if (viewMode === 'channel' && selectedChannel) {
      ws.send(JSON.stringify({
        type: 'typing_start',
        payload: {
          channelId: selectedChannel.id,
          messageType: 'channel'
        }
      }));
    } else if (viewMode === 'dm' && selectedDMUser) {
      ws.send(JSON.stringify({
        type: 'typing_start',
        payload: {
          recipientId: selectedDMUser.id,
          messageType: 'dm'
        }
      }));
    }
    
    setIsTyping(true);
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set auto-stop timeout (3 seconds)
    typingTimeoutRef.current = setTimeout(() => {
      sendTypingStop();
    }, 3000);
  }, [ws, viewMode, selectedChannel, selectedDMUser]);
  
  const sendTypingStop = useCallback(() => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (!isTyping) return;
    
    if (viewMode === 'channel' && selectedChannel) {
      ws.send(JSON.stringify({
        type: 'typing_stop',
        payload: {
          channelId: selectedChannel.id,
          messageType: 'channel'
        }
      }));
    } else if (viewMode === 'dm' && selectedDMUser) {
      ws.send(JSON.stringify({
        type: 'typing_stop',
        payload: {
          recipientId: selectedDMUser.id,
          messageType: 'dm'
        }
      }));
    }
    
    setIsTyping(false);
    
    // Clear timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, [ws, isTyping, viewMode, selectedChannel, selectedDMUser]);
  
  // Clear typing on channel/DM change
  useEffect(() => {
    return () => {
      if (isTyping) {
        sendTypingStop();
      }
    };
  }, [selectedChannel, selectedDMUser, viewMode]);

  const handleSendMessage = () => {
    if (!messageInput.trim() && !uploadingFile) return;
    
    // Stop typing when sending message
    sendTypingStop();
    
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

  // Thread handling functions
  const openThread = (message: Message | DirectMessage) => {
    setSelectedThread(message);
    setShowThreadPanel(true);
    setThreadReplies([]);
    
    // Fetch thread replies
    const endpoint = viewMode === 'channel'
      ? `/api/messenger/threads/${message.id}`
      : `/api/messenger/dm/threads/${message.id}`;
    
    queryClient.invalidateQueries({ queryKey: [endpoint] });
  };

  const closeThread = () => {
    setSelectedThread(null);
    setShowThreadPanel(false);
    setThreadReplies([]);
    setThreadInput('');
  };

  const handleSendThreadReply = () => {
    if (!threadInput.trim() || !selectedThread) return;
    sendThreadReplyMutation.mutate(threadInput);
  };

  // Auto-scroll to bottom for thread replies
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [threadReplies]);

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

  // Helper function to check if user can post in channel
  const canPostInChannel = (channel: Channel): boolean => {
    if (!user) return false;
    if (user.isAdmin) return true; // Admins can post in all channels
    
    if (channel.tier === 'NON_LICENSED') {
      return true; // Everyone can post in non-licensed channel
    } else if (channel.tier === 'FL_LICENSED') {
      return user.hasFloridaLicense === true; // Only FL-licensed and multi-state can post
    } else if (channel.tier === 'MULTI_STATE') {
      return user.isMultiStateLicensed === true; // Only multi-state can post
    }
    
    return false;
  };

  // Auto-select first accessible channel
  useEffect(() => {
    if (accessibleChannels.length > 0 && !selectedChannel && viewMode === 'channel') {
      setSelectedChannel(accessibleChannels[0]);
    }
  }, [accessibleChannels, selectedChannel, viewMode]);

  // Popular emojis for quick access
  const popularEmojis = ['👍', '❤️', '😂', '🎉', '😮', '😢', '🔥', '👏'];

  // Mention handlers
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const cursorPosition = e.target.selectionStart || 0;
    
    setMessageInput(value);
    
    // Detect typing and send typing indicator
    if (value.trim() && !isTyping) {
      sendTypingStart();
    } else if (!value.trim() && isTyping) {
      sendTypingStop();
    } else if (value.trim() && isTyping) {
      // Refresh the typing timeout
      sendTypingStart();
    }
    
    // Check for @ character
    const lastAtSymbol = value.lastIndexOf('@', cursorPosition - 1);
    
    if (lastAtSymbol !== -1) {
      // Check if @ is followed by text (for search)
      const textAfterAt = value.slice(lastAtSymbol + 1, cursorPosition);
      const hasSpaceAfterAt = textAfterAt.includes(' ');
      
      if (!hasSpaceAfterAt && (cursorPosition > lastAtSymbol)) {
        // Show dropdown and search for users
        setMentionStartPosition(lastAtSymbol);
        setMentionSearch(textAfterAt);
        setShowMentionDropdown(true);
        setSelectedMentionIndex(0);
        
        // Search for users
        searchMentionUsers(textAfterAt);
      } else {
        setShowMentionDropdown(false);
      }
    } else {
      setShowMentionDropdown(false);
    }
  };

  const searchMentionUsers = async (search: string) => {
    try {
      const endpoint = viewMode === 'channel' && selectedChannel
        ? `/api/messenger/users/search?q=${encodeURIComponent(search)}&channelId=${selectedChannel.id}`
        : `/api/messenger/users/search?q=${encodeURIComponent(search)}`;
      
      const response = await fetch(endpoint, { credentials: 'include' });
      if (response.ok) {
        const users = await response.json();
        setMentionUsers(users);
      }
    } catch (error) {
      console.error('Failed to search users:', error);
    }
  };

  const insertMention = (user: any) => {
    if (mentionStartPosition === null) return;
    
    const mentionText = user.mentionText || `@${user.firstName || user.email.split('@')[0]}`;
    const beforeMention = messageInput.slice(0, mentionStartPosition);
    const afterMention = messageInput.slice(mentionStartPosition + mentionSearch.length + 1);
    
    const newMessage = `${beforeMention}${mentionText} ${afterMention}`;
    setMessageInput(newMessage);
    setShowMentionDropdown(false);
    setMentionStartPosition(null);
    setMentionSearch('');
    
    // Focus back on input
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  const handleKeyDownWithMentions = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showMentionDropdown) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedMentionIndex((prev) => 
          prev < mentionUsers.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedMentionIndex((prev) => prev > 0 ? prev - 1 : 0);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (mentionUsers[selectedMentionIndex]) {
          insertMention(mentionUsers[selectedMentionIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowMentionDropdown(false);
      }
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Helper function to render message with mentions highlighted
  const renderMessageWithMentions = (content: string) => {
    const mentionRegex = /(@[a-zA-Z0-9._-]+)/g;
    const parts = content.split(mentionRegex);
    
    return parts.map((part, index) => {
      if (part.startsWith('@')) {
        return (
          <span
            key={index}
            className="font-semibold text-cyan-400 hover:underline cursor-pointer"
            onClick={() => {
              // Could open user profile or DM
              console.log('Clicked mention:', part);
            }}
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  const handleReaction = (messageId: string, emoji: string) => {
    const messageType = viewMode === 'channel' ? 'channel' : 'dm';
    const userReacted = messageReactions[messageId]?.[emoji]?.some(r => r.userId === user?.id);
    
    if (userReacted) {
      removeReactionMutation.mutate({ messageId, emoji, messageType });
    } else {
      addReactionMutation.mutate({ messageId, emoji, messageType });
    }
    setShowEmojiPicker(null);
  };

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
    <div className="flex flex-col h-screen bg-[#0a0f1c] pb-16">
      <CybercoreBackground />
      
      {/* Main Container - Added pb-16 for footer spacing */}
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
                  {(channels || []).map(channel => {
                    const canPost = canPostInChannel(channel);
                    return (
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
                            : canPost ? "text-gray-400" : "text-gray-600"
                        )}
                        data-testid={`channel-${channel.id}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {canPost ? (
                              <Hash className="h-4 w-4 flex-shrink-0" />
                            ) : (
                              <Lock className="h-4 w-4 flex-shrink-0 text-gray-500" />
                            )}
                            <span className="truncate">{channel.name}</span>
                            {!canPost && (
                              <span className="text-xs text-gray-500">(View Only)</span>
                            )}
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
                    );
                  })}
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
                              {renderMessageWithMentions(message.content)}
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
                            
                            {/* Thread indicator */}
                            {(message.threadCount > 0 || !message.parentMessageId) && (
                              <button
                                onClick={() => openThread(message)}
                                className="inline-flex items-center gap-2 mt-2 text-blue-400 hover:text-blue-300 transition-colors text-sm"
                                data-testid={`thread-indicator-${message.id}`}
                              >
                                <MessageSquare className="h-4 w-4" />
                                {message.threadCount > 0 ? (
                                  <span>
                                    {message.threadCount} {message.threadCount === 1 ? 'reply' : 'replies'}
                                    {message.lastThreadReply && (
                                      <span className="text-gray-500 ml-1">
                                        • Last reply {formatTime(message.lastThreadReply)}
                                      </span>
                                    )}
                                  </span>
                                ) : (
                                  <span>Reply in thread</span>
                                )}
                              </button>
                            )}

                            {/* Reactions */}
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              {/* Display existing reactions */}
                              {messageReactions[message.id] && Object.entries(messageReactions[message.id]).map(([emoji, reactions]) => {
                                const userReacted = reactions.some(r => r.userId === user?.id);
                                const reactionUsers = reactions.map(r => r.user?.firstName || r.user?.email?.split('@')[0] || 'Unknown');
                                const displayNames = reactionUsers.slice(0, 3).join(', ');
                                const remainingCount = reactionUsers.length - 3;
                                
                                return (
                                  <Popover key={emoji}>
                                    <PopoverTrigger asChild>
                                      <button
                                        onClick={() => handleReaction(message.id, emoji)}
                                        className={cn(
                                          "inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm transition-all hover:scale-105",
                                          userReacted 
                                            ? "bg-primary/30 border border-primary text-primary-foreground" 
                                            : "bg-white/10 border border-white/20 text-gray-300 hover:bg-white/20"
                                        )}
                                        data-testid={`reaction-${emoji}-${message.id}`}
                                      >
                                        <span className="text-lg">{emoji}</span>
                                        <span className="text-xs font-medium">{reactions.length}</span>
                                      </button>
                                    </PopoverTrigger>
                                    <PopoverContent side="top" className="p-2 bg-black/90 border-white/10">
                                      <p className="text-sm text-white">
                                        {displayNames}
                                        {remainingCount > 0 && ` and ${remainingCount} others`}
                                      </p>
                                    </PopoverContent>
                                  </Popover>
                                );
                              })}

                              {/* Add reaction button with emoji picker */}
                              <Popover open={showEmojiPicker === message.id} onOpenChange={(open) => setShowEmojiPicker(open ? message.id : null)}>
                                <PopoverTrigger asChild>
                                  <button
                                    className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 transition-all"
                                    data-testid={`add-reaction-${message.id}`}
                                  >
                                    <Smile className="h-4 w-4 text-gray-400" />
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent side="top" className="p-2 bg-black/90 border-white/10 w-auto">
                                  <div className="flex gap-1">
                                    {popularEmojis.map(emoji => (
                                      <button
                                        key={emoji}
                                        onClick={() => handleReaction(message.id, emoji)}
                                        className="p-1.5 hover:bg-white/10 rounded transition-all hover:scale-110"
                                        data-testid={`emoji-picker-${emoji}-${message.id}`}
                                      >
                                        <span className="text-xl">{emoji}</span>
                                      </button>
                                    ))}
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </div>
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
                            {renderMessageWithMentions(message.content)}
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
                        
                        {/* Reactions for DMs */}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          {/* Display existing reactions */}
                          {messageReactions[message.id] && Object.entries(messageReactions[message.id]).map(([emoji, reactions]) => {
                            const userReacted = reactions.some(r => r.userId === user?.id);
                            const reactionUsers = reactions.map(r => r.user?.firstName || r.user?.email?.split('@')[0] || 'Unknown');
                            const displayNames = reactionUsers.slice(0, 3).join(', ');
                            const remainingCount = reactionUsers.length - 3;
                            
                            return (
                              <Popover key={emoji}>
                                <PopoverTrigger asChild>
                                  <button
                                    onClick={() => handleReaction(message.id, emoji)}
                                    className={cn(
                                      "inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm transition-all hover:scale-105",
                                      userReacted 
                                        ? "bg-primary/30 border border-primary text-primary-foreground" 
                                        : "bg-white/10 border border-white/20 text-gray-300 hover:bg-white/20"
                                    )}
                                    data-testid={`dm-reaction-${emoji}-${message.id}`}
                                  >
                                    <span className="text-lg">{emoji}</span>
                                    <span className="text-xs font-medium">{reactions.length}</span>
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent side="top" className="p-2 bg-black/90 border-white/10">
                                  <p className="text-sm text-white">
                                    {displayNames}
                                    {remainingCount > 0 && ` and ${remainingCount} others`}
                                  </p>
                                </PopoverContent>
                              </Popover>
                            );
                          })}

                          {/* Add reaction button with emoji picker for DMs */}
                          <Popover open={showEmojiPicker === message.id} onOpenChange={(open) => setShowEmojiPicker(open ? message.id : null)}>
                            <PopoverTrigger asChild>
                              <button
                                className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 transition-all"
                                data-testid={`dm-add-reaction-${message.id}`}
                              >
                                <Smile className="h-4 w-4 text-gray-400" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent side="top" className="p-2 bg-black/90 border-white/10 w-auto">
                              <div className="flex gap-1">
                                {popularEmojis.map(emoji => (
                                  <button
                                    key={emoji}
                                    onClick={() => handleReaction(message.id, emoji)}
                                    className="p-1.5 hover:bg-white/10 rounded transition-all hover:scale-110"
                                    data-testid={`dm-emoji-picker-${emoji}-${message.id}`}
                                  >
                                    <span className="text-xl">{emoji}</span>
                                  </button>
                                ))}
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div ref={messagesEndRef} />
          </ScrollArea>

          {/* Typing Indicator */}
          {(() => {
            // Determine current context for typing indicator
            let contextKey: string;
            let typingUserIds: string[] = [];
            
            if (viewMode === 'channel' && selectedChannel) {
              contextKey = `channel:${selectedChannel.id}`;
              typingUserIds = typingUsers[contextKey] || [];
            } else if (viewMode === 'dm' && selectedDMUser) {
              const sortedIds = [user?.id, selectedDMUser.id].filter(Boolean).sort();
              contextKey = `dm:${sortedIds.join('-')}`;
              typingUserIds = typingUsers[contextKey] || [];
            }
            
            if (typingUserIds && typingUserIds.length > 0) {
              const typingUsernames = typingUserIds.map(id => {
                const typingUser = dmUsers.find(u => u.id === id) || 
                                  dmConversations.find(c => c.userId === id)?.user;
                if (typingUser) {
                  return typingUser.firstName || typingUser.email?.split('@')[0] || 'Someone';
                }
                return 'Someone';
              });
              
              let typingText: string;
              if (typingUsernames.length === 1) {
                typingText = `${typingUsernames[0]} is typing`;
              } else if (typingUsernames.length === 2) {
                typingText = `${typingUsernames[0]} and ${typingUsernames[1]} are typing`;
              } else if (typingUsernames.length === 3) {
                typingText = `${typingUsernames[0]}, ${typingUsernames[1]}, and ${typingUsernames[2]} are typing`;
              } else {
                typingText = `${typingUsernames[0]}, ${typingUsernames[1]}, and ${typingUsernames.length - 2} others are typing`;
              }
              
              return (
                <div className="px-4 pb-2 flex items-center gap-2 text-sm text-gray-400 italic">
                  <span>{typingText}</span>
                  <span className="typing-indicator">
                    <span className="typing-dot"></span>
                    <span className="typing-dot"></span>
                    <span className="typing-dot"></span>
                  </span>
                </div>
              );
            }
            
            return null;
          })()}

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
              
              {/* Mention Autocomplete Dropdown */}
              {showMentionDropdown && mentionUsers.length > 0 && (
                <div className="absolute bottom-full mb-2 left-0 right-0 mx-4 max-h-64 overflow-y-auto bg-zinc-900 border border-white/10 rounded-lg shadow-xl">
                  <div className="p-1">
                    {mentionUsers.map((user, index) => (
                      <button
                        key={user.id}
                        onClick={() => insertMention(user)}
                        className={cn(
                          "w-full text-left px-3 py-2 rounded-md flex items-center gap-3 transition-colors",
                          index === selectedMentionIndex
                            ? "bg-primary/20 text-white"
                            : "text-gray-300 hover:bg-white/5"
                        )}
                        onMouseEnter={() => setSelectedMentionIndex(index)}
                      >
                        <Avatar className="h-8 w-8">
                          {user.profileImageUrl ? (
                            <AvatarImage src={user.profileImageUrl} />
                          ) : (
                            <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/20 text-xs">
                              {user.firstName && user.lastName
                                ? `${user.firstName[0]}${user.lastName[0]}`
                                : user.email[0].toUpperCase()}
                            </AvatarFallback>
                          )}
                        </Avatar>
                        <div className="flex-1">
                          <div className="font-medium text-sm">
                            {user.firstName} {user.lastName}
                          </div>
                          <div className="text-xs text-gray-500">{user.email}</div>
                        </div>
                        {user.isAdmin && (
                          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                            Admin
                          </Badge>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              <Input
                ref={inputRef}
                value={messageInput}
                onChange={handleInputChange}
                onKeyDown={handleKeyDownWithMentions}
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

        {/* Right Sidebar - Thread Panel or Active Users */}
        <div className="w-96 bg-black/30 backdrop-blur-sm border-l border-white/5 flex flex-col">
          {showThreadPanel && selectedThread ? (
            <>
              {/* Thread Panel */}
              <div className="p-4 border-b border-white/5 flex items-center justify-between">
                <h3 className="text-white font-medium">Thread</h3>
                <Button
                  onClick={closeThread}
                  size="sm"
                  variant="ghost"
                  className="text-gray-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              <ScrollArea className="flex-1 p-4">
                {/* Original Message */}
                <div className="bg-white/5 rounded-lg p-4 mb-4 border-l-4 border-primary">
                  <div className="flex items-center gap-2 mb-2">
                    <Avatar className="h-8 w-8">
                      {(selectedThread as any).sender?.profileImageUrl ? (
                        <AvatarImage src={(selectedThread as any).sender.profileImageUrl} />
                      ) : (
                        <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/20">
                          {getUserInitials((selectedThread as any).sender)}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div>
                      <span className="text-white text-sm font-medium">
                        {getUserDisplayName((selectedThread as any).sender)}
                      </span>
                      <span className="text-gray-500 text-xs ml-2">
                        {formatTime(selectedThread.createdAt)}
                      </span>
                    </div>
                  </div>
                  <p className="text-gray-300 text-sm break-words">
                    {selectedThread.content}
                  </p>
                </div>
                
                {/* Thread Replies */}
                <div className="space-y-3">
                  <div className="text-xs text-gray-500 mb-2">
                    {threadRepliesData.length} {threadRepliesData.length === 1 ? 'reply' : 'replies'}
                  </div>
                  
                  {threadRepliesData.map((reply: any) => {
                    const isOwnReply = reply.userId === user?.id || reply.senderId === user?.id;
                    const replySender = viewMode === 'channel' ? reply.sender : (isOwnReply ? user : selectedDMUser);
                    
                    return (
                      <div key={reply.id} className="group flex gap-3 hover:bg-white/5 px-2 py-2 rounded transition-all">
                        <Avatar className="h-8 w-8 flex-shrink-0">
                          {replySender?.profileImageUrl ? (
                            <AvatarImage src={replySender.profileImageUrl} />
                          ) : (
                            <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/20 text-xs">
                              {getUserInitials(replySender)}
                            </AvatarFallback>
                          )}
                        </Avatar>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2">
                            <span className="text-white text-sm font-medium">
                              {getUserDisplayName(replySender)}
                            </span>
                            <span className="text-xs text-gray-500">
                              {formatTime(reply.createdAt)}
                            </span>
                          </div>
                          <p className="text-gray-300 text-sm mt-1 break-words">
                            {reply.content}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                <div ref={threadEndRef} />
              </ScrollArea>
              
              {/* Thread Typing Indicator */}
              {selectedThread && (() => {
                const contextKey = `thread:${selectedThread.id}`;
                const threadTypingUsers = typingUsers[contextKey] || [];
                
                if (threadTypingUsers.length > 0) {
                  const typingUsernames = threadTypingUsers.map(id => {
                    const typingUser = dmUsers.find(u => u.id === id) || 
                                      dmConversations.find(c => c.userId === id)?.user;
                    if (typingUser) {
                      return typingUser.firstName || typingUser.email?.split('@')[0] || 'Someone';
                    }
                    return 'Someone';
                  });
                  
                  let typingText: string;
                  if (typingUsernames.length === 1) {
                    typingText = `${typingUsernames[0]} is typing`;
                  } else {
                    typingText = `${typingUsernames[0]} and ${typingUsernames[1]} are typing`;
                  }
                  
                  return (
                    <div className="px-4 pb-2 flex items-center gap-2 text-sm text-gray-400 italic">
                      <span>{typingText}</span>
                      <span className="typing-indicator">
                        <span className="typing-dot"></span>
                        <span className="typing-dot"></span>
                        <span className="typing-dot"></span>
                      </span>
                    </div>
                  );
                }
                return null;
              })()}
              
              {/* Thread Reply Input */}
              <div className="p-4 border-t border-white/5">
                <div className="flex gap-2">
                  <Input
                    value={threadInput}
                    onChange={(e) => {
                      const value = e.target.value;
                      setThreadInput(value);
                      
                      // Send thread typing indicator
                      if (value.trim() && selectedThread && ws && ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({
                          type: 'thread_typing',
                          payload: {
                            parentMessageId: selectedThread.id,
                            isDirectMessage: viewMode === 'dm'
                          }
                        }));
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendThreadReply();
                      }
                    }}
                    placeholder="Reply in thread..."
                    className="flex-1 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                    data-testid="thread-reply-input"
                  />
                  <Button
                    onClick={handleSendThreadReply}
                    disabled={!threadInput.trim()}
                    className="bg-primary hover:bg-primary/80"
                    data-testid="send-thread-reply-button"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Original Active Users Panel */}
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
            </>
          )}
        </div>
      </div>

      <HoverFooter />
      <FloatingConsultButton />
    </div>
  );
}
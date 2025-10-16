import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { CybercoreBackground } from '@/components/CybercoreBackground';
import { FloatingConsultButton } from '@/components/FloatingConsultButton';
import { HoverFooter } from '@/components/HoverFooter';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Hash, User } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface Channel {
  id: string;
  name: string;
  description?: string;
}

interface Message {
  id: string;
  channelId: string;
  senderId: string;
  content: string;
  createdAt: Date;
  sender?: { name: string; email: string };
}

export default function MessengerPage() {
  const { user } = useAuth();
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [ws, setWs] = useState<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: channels = [] } = useQuery<Channel[]>({
    queryKey: ['/api/channels'],
    enabled: !!user,
  });

  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: [`/api/channels/${selectedChannel?.id}/messages`],
    enabled: !!selectedChannel,
  });

  useEffect(() => {
    if (!user || !selectedChannel) return;

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
      
      if (data.type === 'new_message' && data.payload.channelId === selectedChannel.id) {
        queryClient.invalidateQueries({ queryKey: [`/api/channels/${selectedChannel.id}/messages`] });
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
  }, [user, selectedChannel]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!selectedChannel || !user) return;

      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'channel_message',
          payload: {
            channelId: selectedChannel.id,
            senderId: user.id,
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

  const handleSendMessage = () => {
    if (!messageInput.trim()) return;
    sendMessageMutation.mutate(messageInput);
  };

  useEffect(() => {
    if (channels.length > 0 && !selectedChannel) {
      setSelectedChannel(channels[0]);
    }
  }, [channels, selectedChannel]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-cyan-400">
        <div>Please log in to access the messenger</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      <CybercoreBackground />
      
      <div className="relative z-10 container mx-auto px-4 py-8 h-screen flex items-center justify-center">
        <div className="w-full max-w-6xl h-[80vh] bg-black/40 backdrop-blur-xl border border-cyan-400/30 rounded-2xl shadow-2xl shadow-cyan-400/20 overflow-hidden flex">
          
          <div className="w-64 bg-black/60 border-r border-cyan-400/30 flex flex-col">
            <div className="p-4 border-b border-cyan-400/30">
              <h2 className="text-xl font-bold text-cyan-400">Channels</h2>
            </div>
            
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {channels.map((channel) => (
                  <button
                    key={channel.id}
                    onClick={() => setSelectedChannel(channel)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-all flex items-center gap-2 ${
                      selectedChannel?.id === channel.id
                        ? 'bg-cyan-400/20 text-cyan-300'
                        : 'text-cyan-400/60 hover:bg-cyan-400/10 hover:text-cyan-400'
                    }`}
                    data-testid={`channel-${channel.id}`}
                  >
                    <Hash className="w-4 h-4" />
                    {channel.name}
                  </button>
                ))}
              </div>
            </ScrollArea>

            <div className="p-4 border-t border-cyan-400/30">
              <div className="flex items-center gap-2 text-cyan-400">
                <User className="w-4 h-4" />
                <span className="text-sm truncate">
                  {user.firstName && user.lastName 
                    ? `${user.firstName} ${user.lastName}` 
                    : user.email}
                </span>
              </div>
            </div>
          </div>

          <div className="flex-1 flex flex-col">
            <div className="p-4 border-b border-cyan-400/30">
              <h3 className="text-lg font-semibold text-cyan-400 flex items-center gap-2">
                <Hash className="w-5 h-5" />
                {selectedChannel?.name || 'Select a channel'}
              </h3>
              {selectedChannel?.description && (
                <p className="text-sm text-cyan-400/60 mt-1">{selectedChannel.description}</p>
              )}
            </div>

            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className="flex gap-3"
                    data-testid={`message-${message.id}`}
                  >
                    <div className="w-10 h-10 rounded-full bg-cyan-400/20 flex items-center justify-center text-cyan-400 flex-shrink-0">
                      {message.sender?.name?.[0] || message.senderId[0]}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="font-semibold text-cyan-300">
                          {message.sender?.name || message.senderId}
                        </span>
                        <span className="text-xs text-cyan-400/40">
                          {new Date(message.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-cyan-400/80">{message.content}</p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <div className="p-4 border-t border-cyan-400/30">
              <div className="flex gap-2">
                <Input
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder={`Message #${selectedChannel?.name || 'channel'}`}
                  className="flex-1 bg-black/40 border-cyan-400/30 text-cyan-400 placeholder:text-cyan-400/40 focus:border-cyan-400"
                  data-testid="input-message"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim() || sendMessageMutation.isPending}
                  className="bg-cyan-400 text-black hover:bg-cyan-300"
                  data-testid="button-send-message"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <FloatingConsultButton visible={true} />
      <HoverFooter />
    </div>
  );
}

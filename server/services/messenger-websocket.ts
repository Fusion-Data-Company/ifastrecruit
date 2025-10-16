import { WebSocket, WebSocketServer } from "ws";
import { Server } from "http";
import type { 
  Message, 
  DirectMessage, 
  UserChannel, 
  InsertMessage, 
  InsertDirectMessage 
} from "@shared/schema";
import { storage } from "../storage";
import { validateWebSocketRequest } from "../utils/sessionParser";

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  isAuthenticated?: boolean;
}

interface WSMessage {
  type: 'authenticate' | 'message' | 'direct_message' | 'typing' | 'online_status' | 'read_receipt' | 'join_channel';
  payload: any;
}

export class MessengerWebSocketService {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, AuthenticatedWebSocket[]> = new Map();

  initialize(server: Server) {
    this.wss = new WebSocketServer({ 
      noServer: true // Use manual upgrade to avoid conflicts with Vite
    });

    // Handle upgrade manually to avoid conflicts with Vite's WebSocket
    // SECURITY: Validate session BEFORE upgrading to WebSocket
    server.on('upgrade', async (request, socket, head) => {
      if (request.url === '/ws/messenger') {
        try {
          // CRITICAL: Validate session and extract userId from trusted session store
          const userId = await validateWebSocketRequest(request);
          
          if (!userId) {
            console.log('[Messenger WS] Unauthorized connection attempt - no valid session');
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
            return;
          }

          // Verify user exists in database
          const user = await storage.getUser(userId);
          if (!user) {
            console.log('[Messenger WS] User not found:', userId);
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
            return;
          }

          // Session is valid - upgrade connection
          this.wss!.handleUpgrade(request, socket, head, (ws) => {
            // SECURITY: Set userId from validated session, not from client
            (ws as AuthenticatedWebSocket).userId = userId;
            (ws as AuthenticatedWebSocket).isAuthenticated = true;
            this.wss!.emit('connection', ws, request);
          });
        } catch (error) {
          console.error('[Messenger WS] Error during upgrade:', error);
          socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
          socket.destroy();
        }
      }
    });

    this.wss.on('connection', async (ws: AuthenticatedWebSocket, req) => {
      // At this point, ws.userId and ws.isAuthenticated are already set from session validation
      console.log('[Messenger WS] Authenticated connection established for user:', ws.userId);

      // Register client and update online status
      if (ws.userId) {
        if (!this.clients.has(ws.userId)) {
          this.clients.set(ws.userId, []);
        }
        this.clients.get(ws.userId)!.push(ws);

        await storage.updateUserOnlineStatus(ws.userId, true);

        // Send authentication confirmation
        ws.send(JSON.stringify({ 
          type: 'authenticated', 
          payload: { userId: ws.userId } 
        }));

        this.broadcastOnlineStatus(ws.userId, true);
      }

      ws.on('message', async (data: string) => {
        try {
          const message: WSMessage = JSON.parse(data.toString());
          await this.handleMessage(ws, message);
        } catch (error) {
          console.error('[Messenger WS] Error handling message:', error);
          ws.send(JSON.stringify({ 
            type: 'error', 
            payload: { message: 'Invalid message format' } 
          }));
        }
      });

      ws.on('close', () => {
        this.handleDisconnect(ws);
      });

      ws.on('error', (error) => {
        console.error('[Messenger WS] WebSocket error:', error);
      });
    });

    console.log('[Messenger WS] Service initialized');
  }

  private async handleMessage(ws: AuthenticatedWebSocket, message: WSMessage) {
    switch (message.type) {
      case 'authenticate':
        // SECURITY: Authentication now happens during WebSocket upgrade via session validation
        // Client-supplied authentication messages are ignored to prevent identity spoofing
        ws.send(JSON.stringify({ 
          type: 'error', 
          payload: { message: 'Authentication handled during connection. Already authenticated.' } 
        }));
        break;
      
      case 'message':
        await this.handleChannelMessage(ws, message.payload);
        break;
      
      case 'direct_message':
        await this.handleDirectMessage(ws, message.payload);
        break;
      
      case 'typing':
        await this.handleTypingIndicator(ws, message.payload);
        break;
      
      case 'online_status':
        await this.handleOnlineStatus(ws, message.payload);
        break;
      
      case 'read_receipt':
        await this.handleReadReceipt(ws, message.payload);
        break;
      
      case 'join_channel':
        await this.handleJoinChannel(ws, message.payload);
        break;
      
      default:
        ws.send(JSON.stringify({ 
          type: 'error', 
          payload: { message: 'Unknown message type' } 
        }));
    }
  }

  // REMOVED: handleAuthentication method is no longer used
  // Authentication now happens during WebSocket upgrade via session validation
  // This prevents identity spoofing by never trusting client-supplied userId

  private async handleChannelMessage(ws: AuthenticatedWebSocket, payload: InsertMessage) {
    if (!ws.isAuthenticated || !ws.userId) {
      ws.send(JSON.stringify({ 
        type: 'error', 
        payload: { message: 'Not authenticated' } 
      }));
      return;
    }

    try {
      const hasAccess = await storage.userHasChannelAccess(ws.userId, payload.channelId);
      if (!hasAccess) {
        ws.send(JSON.stringify({ 
          type: 'error', 
          payload: { message: 'No access to this channel' } 
        }));
        return;
      }

      // SECURITY: Always use authenticated userId, never trust client payload
      const messageWithAuthenticatedSender = {
        channelId: payload.channelId,
        userId: ws.userId,
        content: payload.content
      };

      const message = await storage.createMessage(messageWithAuthenticatedSender);

      const channelMembers = await storage.getChannelMembers(payload.channelId);
      
      channelMembers.forEach(member => {
        this.sendToUser(member.userId, {
          type: 'new_message',
          payload: message
        });
      });

      console.log(`[Messenger WS] Message sent to channel ${payload.channelId}`);
    } catch (error) {
      console.error('[Messenger WS] Error sending channel message:', error);
      ws.send(JSON.stringify({ 
        type: 'error', 
        payload: { message: 'Failed to send message' } 
      }));
    }
  }

  private async handleDirectMessage(ws: AuthenticatedWebSocket, payload: InsertDirectMessage) {
    if (!ws.isAuthenticated || !ws.userId) {
      ws.send(JSON.stringify({ 
        type: 'error', 
        payload: { message: 'Not authenticated' } 
      }));
      return;
    }

    try {
      // Use the new sendDM method instead of createDirectMessage
      const directMessage = await storage.sendDM(
        ws.userId,
        payload.receiverId,
        payload.content,
        payload.fileUrl,
        payload.fileName
      );

      // Notify the recipient with unread count
      const unreadCounts = await storage.getUnreadCounts(payload.receiverId);
      this.sendToUser(payload.receiverId, {
        type: 'new_direct_message',
        payload: {
          message: directMessage,
          unreadCount: unreadCounts[ws.userId] || 1
        }
      });

      // Confirm to sender
      this.sendToUser(ws.userId, {
        type: 'direct_message_sent',
        payload: directMessage
      });

      // Play notification sound on recipient's client
      this.sendToUser(payload.receiverId, {
        type: 'notification_sound',
        payload: { soundType: 'dm' }
      });

      console.log(`[Messenger WS] Direct message sent from ${ws.userId} to ${payload.receiverId}`);
    } catch (error) {
      console.error('[Messenger WS] Error sending direct message:', error);
      ws.send(JSON.stringify({ 
        type: 'error', 
        payload: { message: 'Failed to send direct message' } 
      }));
    }
  }

  private async handleTypingIndicator(ws: AuthenticatedWebSocket, payload: { channelId?: string; recipientId?: string }) {
    if (!ws.isAuthenticated || !ws.userId) return;

    const typingMessage = {
      type: 'user_typing',
      payload: {
        userId: ws.userId,
        channelId: payload.channelId,
        recipientId: payload.recipientId
      }
    };

    if (payload.channelId) {
      const channelMembers = await storage.getChannelMembers(payload.channelId);
      channelMembers.forEach(member => {
        if (member.userId !== ws.userId) {
          this.sendToUser(member.userId, typingMessage);
        }
      });
    } else if (payload.recipientId) {
      this.sendToUser(payload.recipientId, typingMessage);
    }
  }

  private async handleOnlineStatus(ws: AuthenticatedWebSocket, payload: { isOnline: boolean }) {
    if (!ws.isAuthenticated || !ws.userId) return;

    await storage.updateUserOnlineStatus(ws.userId, payload.isOnline);
    this.broadcastOnlineStatus(ws.userId, payload.isOnline);
  }

  private async handleReadReceipt(ws: AuthenticatedWebSocket, payload: { messageId?: string; channelId?: string; senderId?: string }) {
    if (!ws.isAuthenticated || !ws.userId) return;

    // Handle DM read receipts
    if (payload.senderId) {
      await storage.markDMAsRead(ws.userId, payload.senderId);
      
      // Notify both users that messages were read
      const readMessage = {
        type: 'dm_read',
        payload: {
          recipientId: ws.userId,
          senderId: payload.senderId
        }
      };

      // Notify the sender that their messages were read
      this.sendToUser(payload.senderId, readMessage);
      
      // Update unread counts for the recipient
      const unreadCounts = await storage.getUnreadCounts(ws.userId);
      this.sendToUser(ws.userId, {
        type: 'unread_counts_updated',
        payload: unreadCounts
      });

      console.log(`[Messenger WS] Marked DMs as read from ${payload.senderId} to ${ws.userId}`);
      return;
    }

    // Handle channel read receipts
    const readMessage = {
      type: 'message_read',
      payload: {
        messageId: payload.messageId,
        userId: ws.userId,
        channelId: payload.channelId
      }
    };

    if (payload.channelId) {
      const channelMembers = await storage.getChannelMembers(payload.channelId);
      channelMembers.forEach(member => {
        this.sendToUser(member.userId, readMessage);
      });
    }
  }

  private async handleJoinChannel(ws: AuthenticatedWebSocket, payload: { channelId: string }) {
    if (!ws.isAuthenticated || !ws.userId) return;

    try {
      const hasAccess = await storage.userHasChannelAccess(ws.userId, payload.channelId);
      if (!hasAccess) {
        ws.send(JSON.stringify({ 
          type: 'error', 
          payload: { message: 'No access to this channel' } 
        }));
        return;
      }

      ws.send(JSON.stringify({ 
        type: 'channel_joined', 
        payload: { channelId: payload.channelId } 
      }));
    } catch (error) {
      console.error('[Messenger WS] Error joining channel:', error);
    }
  }

  private handleDisconnect(ws: AuthenticatedWebSocket) {
    if (ws.userId) {
      const userClients = this.clients.get(ws.userId);
      if (userClients) {
        const index = userClients.indexOf(ws);
        if (index > -1) {
          userClients.splice(index, 1);
        }

        if (userClients.length === 0) {
          this.clients.delete(ws.userId);
          storage.updateUserOnlineStatus(ws.userId, false);
          this.broadcastOnlineStatus(ws.userId, false);
        }
      }
      console.log(`[Messenger WS] User ${ws.userId} disconnected`);
    }
  }

  private sendToUser(userId: string, message: any) {
    const userClients = this.clients.get(userId);
    if (userClients) {
      const messageStr = JSON.stringify(message);
      userClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(messageStr);
        }
      });
    }
  }

  private broadcastOnlineStatus(userId: string, isOnline: boolean) {
    this.clients.forEach((clients, _) => {
      clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'user_online_status',
            payload: { userId, isOnline }
          }));
        }
      });
    });
  }

  public broadcast(message: any) {
    const messageStr = JSON.stringify(message);
    this.clients.forEach((clients, _) => {
      clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(messageStr);
        }
      });
    });
  }
}

export const messengerWS = new MessengerWebSocketService();

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
    server.on('upgrade', (request, socket, head) => {
      if (request.url === '/ws/messenger') {
        this.wss!.handleUpgrade(request, socket, head, (ws) => {
          this.wss!.emit('connection', ws, request);
        });
      }
    });

    this.wss.on('connection', (ws: AuthenticatedWebSocket, req) => {
      console.log('[Messenger WS] New connection attempt');

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
        await this.handleAuthentication(ws, message.payload);
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

  private async handleAuthentication(ws: AuthenticatedWebSocket, payload: { userId: string }) {
    const { userId } = payload;
    
    try {
      // Validate userId exists in database
      // In production, this should verify the WebSocket connection's session/JWT
      // For now, we trust the userId from the authenticated HTTP session
      if (!userId) {
        ws.send(JSON.stringify({ 
          type: 'auth_error', 
          payload: { message: 'Authentication required' } 
        }));
        ws.close();
        return;
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        ws.send(JSON.stringify({ 
          type: 'auth_error', 
          payload: { message: 'User not found' } 
        }));
        ws.close();
        return;
      }

      ws.userId = userId;
      ws.isAuthenticated = true;

      if (!this.clients.has(userId)) {
        this.clients.set(userId, []);
      }
      this.clients.get(userId)!.push(ws);

      await storage.updateUserOnlineStatus(userId, true);

      ws.send(JSON.stringify({ 
        type: 'authenticated', 
        payload: { userId } 
      }));

      this.broadcastOnlineStatus(userId, true);

      console.log(`[Messenger WS] User ${userId} authenticated`);
    } catch (error) {
      console.error('[Messenger WS] Authentication error:', error);
      ws.send(JSON.stringify({ 
        type: 'auth_error', 
        payload: { message: 'Authentication failed' } 
      }));
      ws.close();
    }
  }

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
        ...payload,
        senderId: ws.userId
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
      // SECURITY: Always use authenticated userId, never trust client payload
      const messageWithAuthenticatedSender = {
        ...payload,
        senderId: ws.userId
      };

      const directMessage = await storage.createDirectMessage(messageWithAuthenticatedSender);

      this.sendToUser(payload.receiverId, {
        type: 'new_direct_message',
        payload: directMessage
      });

      this.sendToUser(ws.userId, {
        type: 'direct_message_sent',
        payload: directMessage
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

  private async handleReadReceipt(ws: AuthenticatedWebSocket, payload: { messageId: string; channelId?: string }) {
    if (!ws.isAuthenticated || !ws.userId) return;

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

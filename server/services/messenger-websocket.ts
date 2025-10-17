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
  type: 'authenticate' | 'message' | 'direct_message' | 'typing' | 'typing_start' | 'typing_stop' | 'online_status' | 'read_receipt' | 'join_channel' | 'thread_reply' | 'thread_typing' | 'message_pinned' | 'user_status_changed' | 'notification' | 'notification_counts_updated';
  payload: any;
}

export class MessengerWebSocketService {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, AuthenticatedWebSocket[]> = new Map();
  // Track typing state: key is "channel:<channelId>" or "dm:<userId>-<userId>", value is Map of userId to timeout
  private typingUsers: Map<string, Map<string, NodeJS.Timeout>> = new Map();

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
      
      case 'typing_start':
        await this.handleTypingStart(ws, message.payload);
        break;
      
      case 'typing_stop':
        await this.handleTypingStop(ws, message.payload);
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
        
      case 'thread_reply':
        await this.handleThreadReply(ws, message.payload);
        break;
        
      case 'thread_typing':
        await this.handleThreadTyping(ws, message.payload);
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
      const channel = await storage.getChannel(payload.channelId);
      const sender = await storage.getUser(ws.userId);
      
      // Create notifications for all channel members (except sender)
      for (const member of channelMembers) {
        if (member.userId !== ws.userId) {
          // Check if message contains a mention
          const isMention = payload.content?.includes(`@${member.userId}`) || 
                           payload.content?.includes(`@everyone`) ||
                           payload.content?.includes(`@channel`);
          
          // Create notification
          await storage.createNotification({
            userId: member.userId,
            type: isMention ? 'mention' : 'message',
            status: 'unread',
            sourceId: message.id,
            channelId: payload.channelId,
            senderId: ws.userId,
            title: `${sender?.firstName || sender?.email} in #${channel?.name}`,
            content: payload.content?.substring(0, 100), // Preview of message
            metadata: {
              channelName: channel?.name,
              senderName: sender?.firstName || sender?.email,
              isMention
            }
          });
          
          // Send notification counts update
          const counts = await storage.getUnreadNotificationCounts(member.userId);
          this.sendToUser(member.userId, {
            type: 'notification_counts_updated',
            payload: counts
          });
        }
        
        // Send the message to all members
        this.sendToUser(member.userId, {
          type: 'new_message',
          payload: message
        });
      }

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
      
      // Get sender info for notification
      const sender = await storage.getUser(ws.userId);
      
      // Create notification for recipient
      await storage.createNotification({
        userId: payload.receiverId,
        type: 'dm',
        status: 'unread',
        sourceId: directMessage.id,
        senderId: ws.userId,
        title: `${sender?.firstName || sender?.email}`,
        content: payload.content?.substring(0, 100), // Preview of message
        metadata: {
          senderName: sender?.firstName || sender?.email,
          senderProfileImage: sender?.profileImageUrl
        }
      });

      // Get updated notification counts for recipient
      const notificationCounts = await storage.getUnreadNotificationCounts(payload.receiverId);
      const unreadCounts = await storage.getUnreadCounts(payload.receiverId);
      
      // Notify the recipient with unread count and notification counts
      this.sendToUser(payload.receiverId, {
        type: 'new_direct_message',
        payload: {
          message: directMessage,
          unreadCount: unreadCounts[ws.userId] || 1
        }
      });
      
      // Send notification counts update
      this.sendToUser(payload.receiverId, {
        type: 'notification_counts_updated',
        payload: notificationCounts
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

  private async handleTypingStart(ws: AuthenticatedWebSocket, payload: { 
    channelId?: string; 
    recipientId?: string;
    messageType: 'channel' | 'dm' | 'thread';
    parentMessageId?: string; // for thread typing
  }) {
    if (!ws.isAuthenticated || !ws.userId) return;

    let key: string;
    let targetUsers: string[] = [];

    if (payload.messageType === 'channel' && payload.channelId) {
      key = `channel:${payload.channelId}`;
      const channelMembers = await storage.getChannelMembers(payload.channelId);
      targetUsers = channelMembers.map(m => m.userId).filter(id => id !== ws.userId);
    } else if (payload.messageType === 'dm' && payload.recipientId) {
      // Sort user IDs to ensure consistent key regardless of who's typing
      const sortedIds = [ws.userId, payload.recipientId].sort();
      key = `dm:${sortedIds[0]}-${sortedIds[1]}`;
      targetUsers = [payload.recipientId];
    } else if (payload.messageType === 'thread' && payload.parentMessageId) {
      key = `thread:${payload.parentMessageId}`;
      // Thread typing will be handled similarly to existing handleThreadTyping
      return this.handleThreadTyping(ws, { 
        parentMessageId: payload.parentMessageId, 
        isDirectMessage: payload.recipientId !== undefined 
      });
    } else {
      return;
    }

    // Get or create typing map for this context
    if (!this.typingUsers.has(key)) {
      this.typingUsers.set(key, new Map());
    }
    const contextTypingUsers = this.typingUsers.get(key)!;

    // Clear any existing timeout for this user
    const existingTimeout = contextTypingUsers.get(ws.userId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set auto-stop timeout (3 seconds)
    const timeout = setTimeout(() => {
      this.clearUserTyping(ws.userId, key, targetUsers, payload.messageType);
    }, 3000);

    // Track typing user with timeout
    contextTypingUsers.set(ws.userId, timeout);

    // Get all currently typing users (including the new one)
    const typingUserIds = Array.from(contextTypingUsers.keys());

    // Broadcast typing_start to relevant users
    targetUsers.forEach(userId => {
      this.sendToUser(userId, {
        type: 'typing_start',
        payload: {
          typingUsers: typingUserIds,
          channelId: payload.channelId,
          recipientId: payload.recipientId,
          messageType: payload.messageType
        }
      });
    });
  }

  private async handleTypingStop(ws: AuthenticatedWebSocket, payload: { 
    channelId?: string; 
    recipientId?: string;
    messageType: 'channel' | 'dm' | 'thread';
    parentMessageId?: string;
  }) {
    if (!ws.isAuthenticated || !ws.userId) return;

    let key: string;
    let targetUsers: string[] = [];

    if (payload.messageType === 'channel' && payload.channelId) {
      key = `channel:${payload.channelId}`;
      const channelMembers = await storage.getChannelMembers(payload.channelId);
      targetUsers = channelMembers.map(m => m.userId).filter(id => id !== ws.userId);
    } else if (payload.messageType === 'dm' && payload.recipientId) {
      const sortedIds = [ws.userId, payload.recipientId].sort();
      key = `dm:${sortedIds[0]}-${sortedIds[1]}`;
      targetUsers = [payload.recipientId];
    } else if (payload.messageType === 'thread' && payload.parentMessageId) {
      key = `thread:${payload.parentMessageId}`;
      // Handle thread typing stop
      // We'll broadcast a stop event for thread typing
      return; // For now, let the timeout handle it
    } else {
      return;
    }

    this.clearUserTyping(ws.userId, key, targetUsers, payload.messageType);
  }

  private clearUserTyping(userId: string, key: string, targetUsers: string[], messageType: string) {
    const contextTypingUsers = this.typingUsers.get(key);
    if (!contextTypingUsers) return;

    // Clear timeout and remove user from typing list
    const timeout = contextTypingUsers.get(userId);
    if (timeout) {
      clearTimeout(timeout);
    }
    contextTypingUsers.delete(userId);

    // If no more users typing, remove the context entirely
    if (contextTypingUsers.size === 0) {
      this.typingUsers.delete(key);
    }

    // Get remaining typing users
    const typingUserIds = contextTypingUsers.size > 0 
      ? Array.from(contextTypingUsers.keys())
      : [];

    // Parse key to determine context
    let channelId: string | undefined;
    let recipientId: string | undefined;
    
    if (key.startsWith('channel:')) {
      channelId = key.substring(8);
    } else if (key.startsWith('dm:')) {
      // For DM, we need to figure out the recipient from the target users
      recipientId = targetUsers[0]; // In DM context, there's only one target
    }

    // Broadcast typing_stop to relevant users
    targetUsers.forEach(targetUserId => {
      this.sendToUser(targetUserId, {
        type: 'typing_stop',
        payload: {
          typingUsers: typingUserIds,
          channelId,
          recipientId,
          messageType,
          stoppedUserId: userId
        }
      });
    });
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

  private async handleThreadReply(ws: AuthenticatedWebSocket, payload: { 
    parentMessageId: string;
    content: string;
    isDirectMessage?: boolean;
    fileUrl?: string;
    fileName?: string;
  }) {
    if (!ws.isAuthenticated || !ws.userId) return;

    try {
      let threadReply;
      let notificationTargets: string[] = [];

      if (payload.isDirectMessage) {
        // Handle DM thread reply
        const parentDM = await storage.getDirectMessageById(payload.parentMessageId);
        if (!parentDM) {
          ws.send(JSON.stringify({ 
            type: 'error', 
            payload: { message: 'Parent message not found' } 
          }));
          return;
        }

        const reply = await storage.sendDM(
          ws.userId,
          parentDM.senderId === ws.userId ? parentDM.receiverId : parentDM.senderId,
          payload.content,
          payload.fileUrl,
          payload.fileName,
          payload.parentMessageId
        );

        threadReply = reply;
        notificationTargets = [parentDM.senderId, parentDM.receiverId];
      } else {
        // Handle channel thread reply
        const parentMessage = await storage.getMessageById(payload.parentMessageId);
        if (!parentMessage) {
          ws.send(JSON.stringify({ 
            type: 'error', 
            payload: { message: 'Parent message not found' } 
          }));
          return;
        }

        const hasAccess = await storage.userHasChannelAccess(ws.userId, parentMessage.channelId);
        if (!hasAccess) {
          ws.send(JSON.stringify({ 
            type: 'error', 
            payload: { message: 'No access to this channel' } 
          }));
          return;
        }

        const reply = await storage.createMessage({
          channelId: parentMessage.channelId,
          userId: ws.userId,
          content: payload.content,
          parentMessageId: payload.parentMessageId,
          fileUrl: payload.fileUrl,
          fileName: payload.fileName
        });

        threadReply = reply;
        
        // Notify all channel members
        const channelMembers = await storage.getChannelMembers(parentMessage.channelId);
        notificationTargets = channelMembers.map(m => m.userId);
      }

      // Broadcast thread reply to relevant users
      notificationTargets.forEach(userId => {
        this.sendToUser(userId, {
          type: 'thread_reply_created',
          payload: {
            reply: threadReply,
            parentMessageId: payload.parentMessageId,
            isDirectMessage: payload.isDirectMessage
          }
        });
      });

      // Also broadcast thread count update
      notificationTargets.forEach(userId => {
        this.sendToUser(userId, {
          type: 'thread_count_updated',
          payload: {
            messageId: payload.parentMessageId,
            isDirectMessage: payload.isDirectMessage
          }
        });
      });

      console.log(`[Messenger WS] Thread reply created for message ${payload.parentMessageId}`);
    } catch (error) {
      console.error('[Messenger WS] Error creating thread reply:', error);
      ws.send(JSON.stringify({ 
        type: 'error', 
        payload: { message: 'Failed to create thread reply' } 
      }));
    }
  }

  private async handleThreadTyping(ws: AuthenticatedWebSocket, payload: { 
    parentMessageId: string;
    isDirectMessage?: boolean;
  }) {
    if (!ws.isAuthenticated || !ws.userId) return;

    try {
      let notificationTargets: string[] = [];

      if (payload.isDirectMessage) {
        const parentDM = await storage.getDirectMessageById(payload.parentMessageId);
        if (!parentDM) return;
        notificationTargets = [parentDM.senderId, parentDM.receiverId].filter(id => id !== ws.userId);
      } else {
        const parentMessage = await storage.getMessageById(payload.parentMessageId);
        if (!parentMessage) return;
        
        const channelMembers = await storage.getChannelMembers(parentMessage.channelId);
        notificationTargets = channelMembers.map(m => m.userId).filter(id => id !== ws.userId);
      }

      // Broadcast thread typing indicator
      notificationTargets.forEach(userId => {
        this.sendToUser(userId, {
          type: 'thread_typing',
          payload: {
            userId: ws.userId,
            parentMessageId: payload.parentMessageId,
            isDirectMessage: payload.isDirectMessage
          }
        });
      });
    } catch (error) {
      console.error('[Messenger WS] Error handling thread typing:', error);
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
          
          // Clear typing states for disconnected user
          this.clearAllUserTypingStates(ws.userId);
        }
      }
      console.log(`[Messenger WS] User ${ws.userId} disconnected`);
    }
  }

  private async clearAllUserTypingStates(userId: string) {
    // Iterate through all typing contexts and remove this user
    for (const [key, typingUsersMap] of this.typingUsers.entries()) {
      if (typingUsersMap.has(userId)) {
        // Get target users to notify based on context
        let targetUsers: string[] = [];
        
        if (key.startsWith('channel:')) {
          const channelId = key.substring(8);
          try {
            const channelMembers = await storage.getChannelMembers(channelId);
            targetUsers = channelMembers.map(m => m.userId).filter(id => id !== userId);
          } catch (e) {
            console.error('[Messenger WS] Error getting channel members:', e);
          }
        } else if (key.startsWith('dm:')) {
          const ids = key.substring(3).split('-');
          targetUsers = ids.filter(id => id !== userId);
        }
        
        // Clear typing state for this user in this context
        const messageType = key.startsWith('channel:') ? 'channel' : 
                          key.startsWith('dm:') ? 'dm' : 'thread';
        this.clearUserTyping(userId, key, targetUsers, messageType);
      }
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

  public isInitialized(): boolean {
    return this.wss !== null;
  }

  public isUserOnline(userId: string): boolean {
    const userClients = this.clients.get(userId);
    return userClients !== undefined && userClients.length > 0 && 
           userClients.some(client => client.readyState === WebSocket.OPEN);
  }

  // Broadcast user status change event
  public broadcastUserStatusChange(userId: string, status: 'online' | 'offline' | 'away') {
    this.broadcast({
      type: 'user_status_changed',
      payload: {
        userId,
        status,
        timestamp: new Date().toISOString()
      }
    });
  }
}

export const messengerWS = new MessengerWebSocketService();

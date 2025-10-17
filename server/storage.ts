import { 
  campaigns, 
  candidates, 
  interviews, 
  bookings, 
  apifyActors,
  apifyRuns, 
  auditLogs,
  users,
  channels,
  userChannels,
  messages,
  directMessages,
  messageReactions,
  directMessageReactions,
  fileUploads,
  onboardingResponses,
  workflowRules,
  elevenLabsTracking,
  platformConversations,
  conversationContext,
  conversationMemory,
  jasonSettings,
  jasonTemplates,
  jasonChannelBehaviors,
  notifications,
  type Campaign,
  type Candidate, 
  type Interview,
  type Booking,
  type ApifyActor,
  type ApifyRun,
  type AuditLog,
  type User,
  type UpsertUser,
  type Channel,
  type UserChannel,
  type Message,
  type DirectMessage,
  type MessageReaction,
  type DirectMessageReaction,
  type FileUpload,
  type OnboardingResponse,
  type WorkflowRule,
  type ElevenLabsTracking,
  type PlatformConversation,
  type ConversationContext,
  type ConversationMemory,
  type JasonSetting,
  type JasonTemplate,
  type JasonChannelBehavior,
  type Notification,
  type InsertCampaign,
  type InsertCandidate,
  type InsertInterview,
  type InsertBooking,
  type InsertApifyActor,
  type InsertApifyRun,
  type InsertAuditLog,
  type InsertUser,
  type InsertChannel,
  type InsertUserChannel,
  type InsertMessage,
  type InsertDirectMessage,
  type InsertMessageReaction,
  type InsertDirectMessageReaction,
  type InsertFileUpload,
  type InsertOnboardingResponse,
  type InsertWorkflowRule,
  type InsertElevenLabsTracking,
  type InsertPlatformConversation,
  type InsertConversationContext,
  type InsertConversationMemory,
  type InsertJasonSetting,
  type InsertJasonTemplate,
  type InsertJasonChannelBehavior,
  type InsertNotification
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, count, sql, and } from "drizzle-orm";
import crypto from "crypto";

export interface IStorage {
  // Replit Auth User methods (REQUIRED for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Additional user methods
  getUserByEmail(email: string): Promise<User | undefined>;
  updateUser(id: string, updates: Partial<User>): Promise<User>;
  updateUserProfile(id: string, updates: { email?: string; phone?: string }): Promise<User>;
  setUserAdmin(id: string, isAdmin: boolean): Promise<User>;
  searchUsers(query: string, currentUserId: string, isAdmin: boolean, limit?: number): Promise<User[]>;
  searchChannelMembers(channelId: string, query: string, limit?: number): Promise<User[]>;
  getDMUsers(currentUserId: string, isAdmin: boolean): Promise<User[]>;
  getUnreadCounts(userId: string): Promise<{ [senderId: string]: number }>;
  getDMMessages(userId: string, otherUserId: string): Promise<DirectMessage[]>;
  markDMAsRead(userId: string, senderId: string): Promise<void>;
  
  // Onboarding methods
  saveOnboardingAnswers(userId: string, answers: any, tier: string): Promise<User>;
  getOnboardingStatus(userId: string): Promise<{ completed: boolean; answers?: any }>;

  // Campaign methods
  getCampaigns(): Promise<Campaign[]>;
  getCampaign(id: string): Promise<Campaign | undefined>;
  createCampaign(campaign: InsertCampaign): Promise<Campaign>;
  updateCampaign(id: string, updates: Partial<Campaign>): Promise<Campaign>;

  // Candidate methods
  getCandidates(page?: number, limit?: number): Promise<Candidate[]>;
  getCandidate(id: string): Promise<Candidate | undefined>;
  getCandidateByEmail(email: string): Promise<Candidate | undefined>;
  getCandidateByConversationId(conversationId: string): Promise<Candidate | undefined>;
  getCandidateByToken(token: string): Promise<Candidate | undefined>;
  createCandidate(candidate: InsertCandidate): Promise<Candidate>;
  updateCandidate(id: string, updates: Partial<Candidate>): Promise<Candidate>;
  upsertCandidateByConversationId(candidate: InsertCandidate): Promise<{ candidate: Candidate; action: 'created' | 'updated' }>;

  // Interview methods
  getInterviews(candidateId?: string): Promise<Interview[]>;
  getInterview(id: string): Promise<Interview | undefined>;
  createInterview(interview: InsertInterview): Promise<Interview>;
  updateInterview(id: string, updates: Partial<Interview>): Promise<Interview>;

  // Booking methods
  getBookings(candidateId?: string): Promise<Booking[]>;
  getBooking(id: string): Promise<Booking | undefined>;
  createBooking(booking: InsertBooking): Promise<Booking>;
  updateBooking(id: string, updates: Partial<Booking>): Promise<Booking>;

  // Apify Actor methods
  getApifyActors(): Promise<ApifyActor[]>;
  getApifyActor(id: string): Promise<ApifyActor | undefined>;
  createApifyActor(actor: InsertApifyActor): Promise<ApifyActor>;
  updateApifyActor(id: string, updates: Partial<ApifyActor>): Promise<ApifyActor>;
  deleteApifyActor(id: string): Promise<void>;

  // Apify Run methods
  getApifyRuns(actorId?: string): Promise<ApifyRun[]>;
  getApifyRun(id: string): Promise<ApifyRun | undefined>;
  getApifyRunByApifyId(apifyRunId: string): Promise<ApifyRun | undefined>;
  createApifyRun(run: InsertApifyRun): Promise<ApifyRun>;
  updateApifyRun(id: string, updates: Partial<ApifyRun>): Promise<ApifyRun>;


  // Audit Log methods
  getAuditLogs(limit?: number): Promise<AuditLog[]>;
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;

  // Workflow Rule methods
  getWorkflowRules(): Promise<WorkflowRule[]>;
  getWorkflowRule(id: string): Promise<WorkflowRule | undefined>;
  createWorkflowRule(rule: InsertWorkflowRule): Promise<WorkflowRule>;
  updateWorkflowRule(id: string, updates: Partial<WorkflowRule>): Promise<WorkflowRule>;
  deleteWorkflowRule(id: string): Promise<void>;

  // KPI methods
  getKPIs(): Promise<any>;
  getAdminStats(): Promise<any>;

  // Jason AI Settings methods
  getJasonSettings(): Promise<JasonSetting[]>;
  getJasonSetting(key: string): Promise<JasonSetting | undefined>;
  updateJasonSetting(key: string, value: any, updatedBy?: string): Promise<JasonSetting>;
  createJasonSetting(setting: InsertJasonSetting): Promise<JasonSetting>;
  
  // Jason AI Template methods
  getJasonTemplates(channelTier?: string): Promise<JasonTemplate[]>;
  getJasonTemplate(id: string): Promise<JasonTemplate | undefined>;
  createJasonTemplate(template: InsertJasonTemplate): Promise<JasonTemplate>;
  updateJasonTemplate(id: string, updates: Partial<JasonTemplate>): Promise<JasonTemplate>;
  deleteJasonTemplate(id: string): Promise<void>;
  
  // Jason AI Channel Behavior methods
  getJasonChannelBehaviors(): Promise<JasonChannelBehavior[]>;
  getJasonChannelBehavior(channelId: string): Promise<JasonChannelBehavior | undefined>;
  upsertJasonChannelBehavior(channelId: string, behavior: InsertJasonChannelBehavior): Promise<JasonChannelBehavior>;

  // ElevenLabs Tracking methods
  getElevenLabsTracking(agentId: string): Promise<ElevenLabsTracking | undefined>;
  createElevenLabsTracking(tracking: InsertElevenLabsTracking): Promise<ElevenLabsTracking>;
  updateElevenLabsTracking(agentId: string, updates: Partial<ElevenLabsTracking>): Promise<ElevenLabsTracking>;

  // Phase 3: Conversation Context methods
  // Platform conversation methods
  getPlatformConversations(page?: number, limit?: number): Promise<PlatformConversation[]>;
  getPlatformConversation(id: string): Promise<PlatformConversation | undefined>;
  getPlatformConversationByConversationId(conversationId: string): Promise<PlatformConversation | undefined>;
  createPlatformConversation(conversation: InsertPlatformConversation): Promise<PlatformConversation>;
  updatePlatformConversation(id: string, updates: Partial<PlatformConversation>): Promise<PlatformConversation>;
  upsertPlatformConversation(conversation: InsertPlatformConversation): Promise<{ conversation: PlatformConversation; action: 'created' | 'updated' }>;

  // Conversation context methods
  getConversationContexts(platformConversationId: string): Promise<ConversationContext[]>;
  getConversationContext(id: string): Promise<ConversationContext | undefined>;
  getConversationContextByKey(platformConversationId: string, contextKey: string, contextType: string): Promise<ConversationContext | undefined>;
  createConversationContext(context: InsertConversationContext): Promise<ConversationContext>;
  updateConversationContext(id: string, updates: Partial<ConversationContext>): Promise<ConversationContext>;
  upsertConversationContext(context: InsertConversationContext): Promise<{ context: ConversationContext; action: 'created' | 'updated' }>;
  deleteConversationContext(id: string): Promise<void>;

  // Conversation memory methods
  getConversationMemoryByAgent(agentId: string, limit?: number): Promise<ConversationMemory[]>;
  getConversationMemory(id: string): Promise<ConversationMemory | undefined>;
  getConversationMemoryByKey(agentId: string, memoryKey: string, memoryType: string): Promise<ConversationMemory | undefined>;
  searchConversationMemory(agentId: string, searchTerms: string[], memoryTypes?: string[]): Promise<ConversationMemory[]>;
  createConversationMemory(memory: InsertConversationMemory): Promise<ConversationMemory>;
  updateConversationMemory(id: string, updates: Partial<ConversationMemory>): Promise<ConversationMemory>;
  upsertConversationMemory(memory: InsertConversationMemory): Promise<{ memory: ConversationMemory; action: 'created' | 'updated' }>;
  deleteConversationMemory(id: string): Promise<void>;
  incrementMemoryUsage(id: string): Promise<ConversationMemory>;
  
  // Search methods
  searchMessages(query: string, filters?: {
    channelId?: string;
    senderId?: string;
    dateFrom?: Date;
    dateTo?: Date;
    hasFile?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ messages: (Message | DirectMessage)[], total: number }>;
  searchFiles(query: string, filters?: {
    channelId?: string;
    senderId?: string;
    dateFrom?: Date;
    dateTo?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ files: FileUpload[], total: number }>;
  searchUsersForMessenger(query: string, limit?: number): Promise<User[]>;

  // Messenger methods
  // Channel methods
  getChannels(): Promise<Channel[]>;
  getChannel(id: string): Promise<Channel | undefined>;
  createChannel(channel: InsertChannel): Promise<Channel>;
  
  // User Channel methods (membership)
  getUserChannels(userId: string): Promise<UserChannel[]>;
  getChannelMembers(channelId: string): Promise<UserChannel[]>;
  joinChannel(userId: string, channelId: string): Promise<UserChannel>;
  updateChannelAccess(userId: string, channelId: string, canAccess: boolean): Promise<UserChannel>;
  userHasChannelAccess(userId: string, channelId: string): Promise<boolean>;
  updateUserOnlineStatus(userId: string, isOnline: boolean): Promise<void>;
  
  // Message methods
  getChannelMessages(channelId: string, limit?: number): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  
  // Thread methods for channel messages
  getThreadReplies(messageId: string): Promise<Message[]>;
  createThreadReply(reply: InsertMessage): Promise<Message>;
  updateThreadCount(parentMessageId: string): Promise<void>;
  
  // Direct message methods
  getDirectMessages(userId: string, otherUserId: string): Promise<DirectMessage[]>;
  getUserConversations(userId: string): Promise<{userId: string, lastMessage: DirectMessage}[]>;
  createDirectMessage(message: InsertDirectMessage): Promise<DirectMessage>;
  markDirectMessagesAsRead(userId: string, senderId: string): Promise<void>;
  
  // Thread methods for direct messages
  getDirectThreadReplies(messageId: string): Promise<DirectMessage[]>;
  createDirectThreadReply(reply: InsertDirectMessage): Promise<DirectMessage>;
  updateDirectThreadCount(parentMessageId: string): Promise<void>;
  
  // Reaction methods
  addReaction(messageId: string, userId: string, emoji: string, messageType: 'channel' | 'dm'): Promise<MessageReaction | DirectMessageReaction>;
  removeReaction(messageId: string, userId: string, emoji: string, messageType: 'channel' | 'dm'): Promise<void>;
  getMessageReactions(messageId: string): Promise<MessageReaction[]>;
  getDirectMessageReactions(messageId: string): Promise<DirectMessageReaction[]>;
  getUserReactions(userId: string, messageType: 'channel' | 'dm'): Promise<(MessageReaction | DirectMessageReaction)[]>;
  
  // File upload methods
  getUserFiles(userId: string): Promise<FileUpload[]>;
  createFileUpload(upload: InsertFileUpload): Promise<FileUpload>;
  saveFileUpload(
    userId: string, 
    fileName: string, 
    fileType: string, 
    fileUrl: string, 
    fileSize: number, 
    isResume: boolean,
    mimeType?: string,
    metadata?: any,
    linkedToMessageId?: string,
    thumbnailUrl?: string
  ): Promise<FileUpload>;
  updateParsedData(fileId: string, parsedData: any, status: 'parsed' | 'failed'): Promise<FileUpload>;
  getFileUpload(fileId: string): Promise<FileUpload | undefined>;
  getUserUploads(userId: string): Promise<FileUpload[]>;
  getFilesByMessageId(messageId: string): Promise<FileUpload[]>;
  
  // Onboarding methods
  getOnboardingResponse(userId: string): Promise<OnboardingResponse | undefined>;
  createOnboardingResponse(response: InsertOnboardingResponse): Promise<OnboardingResponse>;
  getOnboardingStatus(userId: string): Promise<{ hasCompleted: boolean; currentLicensingInfo: any; availableChannels: Channel[] }>;
  completeOnboarding(userId: string, responses: { hasFloridaLicense: boolean; isMultiStateLicensed: boolean; licensedStates: string[] }): Promise<{ user: User; channels: Channel[] }>;
  assignUserToChannels(userId: string, channelTypes: string[]): Promise<UserChannel[]>;
  
  // Notification methods
  createNotification(notification: InsertNotification): Promise<Notification>;
  getUnreadNotifications(userId: string, limit?: number): Promise<Notification[]>;
  getNotificationsByUser(userId: string, limit?: number, offset?: number): Promise<{ notifications: Notification[], total: number }>;
  markNotificationRead(notificationId: string): Promise<void>;
  markAllNotificationsRead(userId: string): Promise<void>;
  getUnreadNotificationCounts(userId: string): Promise<{ 
    total: number;
    byChannel: { [channelId: string]: number };
    byDM: { [senderId: string]: number };
    byType: { [type: string]: number };
  }>;
  deleteNotification(notificationId: string): Promise<void>;
  deleteOldNotifications(userId: string, daysOld: number): Promise<void>;
  updateUserNotificationPreferences(userId: string, preferences: any): Promise<User>;
  updateChannelLastSeen(userId: string, channelId: string): Promise<void>;
  updateDMLastSeen(userId: string, senderId: string): Promise<void>;
  
  // Utility methods
  saveICSFile(content: string): Promise<string>;
}

export class DatabaseStorage implements IStorage {
  private tokenStore = new Map<string, string>(); // token -> candidateId mapping

  // Replit Auth User methods (REQUIRED for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    // First try to find existing user by ID
    const existingUserById = await this.getUser(userData.id);
    
    if (existingUserById) {
      // User exists with this ID, update them
      const [updated] = await db
        .update(users)
        .set({
          ...userData,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userData.id))
        .returning();
      return updated;
    }
    
    // Check if a user exists with this email (to handle email conflicts)
    if (userData.email) {
      const existingUserByEmail = await this.getUserByEmail(userData.email);
      if (existingUserByEmail) {
        // Email exists for different user - update that user's ID to match the Replit auth ID
        // This handles the case where a user was created with a different ID but same email
        const [updated] = await db
          .update(users)
          .set({
            ...userData,
            id: userData.id, // Update to new ID from Replit auth
            updatedAt: new Date(),
          })
          .where(eq(users.email, userData.email))
          .returning();
        return updated;
      }
    }
    
    // No conflicts, create new user
    const [user] = await db
      .insert(users)
      .values(userData)
      .returning();
    return user;
  }

  // Additional user methods
  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    // Debug logging for onboarding updates
    if (updates.hasCompletedOnboarding !== undefined) {
      console.log(`[ONBOARDING DEBUG - updateUser] Updating user ${id} with:`, {
        hasCompletedOnboarding: updates.hasCompletedOnboarding,
        hasFloridaLicense: updates.hasFloridaLicense,
        isMultiStateLicensed: updates.isMultiStateLicensed
      });
    }
    
    const [updated] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    
    // Debug logging for onboarding updates
    if (updates.hasCompletedOnboarding !== undefined) {
      console.log(`[ONBOARDING DEBUG - updateUser] Update result for user ${id}:`, {
        id: updated?.id,
        hasCompletedOnboarding: updated?.hasCompletedOnboarding,
        hasFloridaLicense: updated?.hasFloridaLicense
      });
      
      if (!updated) {
        console.error(`[ONBOARDING DEBUG - updateUser] CRITICAL: No user returned from update for id ${id}`);
        throw new Error(`Failed to update user ${id} - no result returned from database`);
      }
      
      if (updates.hasCompletedOnboarding === true && updated.hasCompletedOnboarding !== true) {
        console.error(`[ONBOARDING DEBUG - updateUser] CRITICAL: hasCompletedOnboarding was not updated!`);
        console.error(`[ONBOARDING DEBUG - updateUser] Expected: true, Got: ${updated.hasCompletedOnboarding}`);
        throw new Error(`Failed to update hasCompletedOnboarding for user ${id}`);
      }
    }
    
    return updated;
  }

  async updateUserProfile(id: string, updates: { email?: string; phone?: string }): Promise<User> {
    return await this.updateUser(id, updates);
  }

  async setUserAdmin(id: string, isAdmin: boolean): Promise<User> {
    return await this.updateUser(id, { isAdmin });
  }

  async searchUsers(query: string, currentUserId: string, isAdmin: boolean, limit: number = 10): Promise<User[]> {
    // Build search query - search by first name, last name, or email
    const searchPattern = `%${query}%`;
    
    // Build the base query
    let results = await db.select()
      .from(users)
      .where(
        and(
          sql`${users.id} != ${currentUserId}`, // Exclude current user
          sql`(
            LOWER(${users.firstName}) LIKE LOWER(${searchPattern}) OR
            LOWER(${users.lastName}) LIKE LOWER(${searchPattern}) OR
            LOWER(${users.email}) LIKE LOWER(${searchPattern}) OR
            LOWER(CONCAT(${users.firstName}, ' ', ${users.lastName})) LIKE LOWER(${searchPattern})
          )`
        )
      )
      .limit(limit);
    
    // Filter based on permissions: regular users only see admins
    if (!isAdmin) {
      results = results.filter(u => u.isAdmin);
    }
    
    return results;
  }

  async searchChannelMembers(channelId: string, query: string, limit: number = 10): Promise<User[]> {
    const searchPattern = `%${query}%`;
    
    // Get channel members that match the search query
    const results = await db.select({
      user: users
    })
    .from(userChannels)
    .innerJoin(users, eq(users.id, userChannels.userId))
    .where(
      and(
        eq(userChannels.channelId, channelId),
        eq(userChannels.canAccess, true),
        sql`(
          LOWER(${users.firstName}) LIKE LOWER(${searchPattern}) OR
          LOWER(${users.lastName}) LIKE LOWER(${searchPattern}) OR
          LOWER(${users.email}) LIKE LOWER(${searchPattern}) OR
          LOWER(CONCAT(${users.firstName}, ' ', ${users.lastName})) LIKE LOWER(${searchPattern})
        )`
      )
    )
    .limit(limit);
    
    return results.map(r => r.user);
  }

  async getDMUsers(currentUserId: string, isAdmin: boolean): Promise<User[]> {
    // Get all users except the current user
    let results = await db.select()
      .from(users)
      .where(sql`${users.id} != ${currentUserId}`);
    
    // Filter based on permissions: regular users only see admins
    if (!isAdmin) {
      results = results.filter(u => u.isAdmin);
    }
    
    return results;
  }

  async getUnreadCounts(userId: string): Promise<{ [senderId: string]: number }> {
    // Get count of unread messages grouped by sender
    const results = await db.select({
      senderId: directMessages.senderId,
      count: count()
    })
    .from(directMessages)
    .where(
      and(
        eq(directMessages.receiverId, userId),
        eq(directMessages.isRead, false)
      )
    )
    .groupBy(directMessages.senderId);
    
    // Convert to map
    const counts: { [senderId: string]: number } = {};
    results.forEach(r => {
      counts[r.senderId] = r.count;
    });
    
    return counts;
  }

  async getDMMessages(userId: string, otherUserId: string): Promise<DirectMessage[]> {
    return await db.select()
      .from(directMessages)
      .where(
        sql`(${directMessages.senderId} = ${userId} AND ${directMessages.receiverId} = ${otherUserId}) OR
            (${directMessages.senderId} = ${otherUserId} AND ${directMessages.receiverId} = ${userId})`
      )
      .orderBy(desc(directMessages.createdAt));
  }

  async markDMAsRead(userId: string, senderId: string): Promise<void> {
    await db.update(directMessages)
      .set({ 
        isRead: true,
        readAt: new Date()
      })
      .where(
        and(
          eq(directMessages.receiverId, userId),
          eq(directMessages.senderId, senderId),
          eq(directMessages.isRead, false)
        )
      );
  }

  // Onboarding methods implementation
  async saveOnboardingAnswers(userId: string, answers: any, tier: string): Promise<User> {
    // Determine the license fields based on tier
    const licenseFields: any = {
      hasCompletedOnboarding: true,
      onboardingAnswers: answers,
      hasFloridaLicense: tier === 'FL_LICENSED',
      isMultiStateLicensed: tier === 'MULTI_STATE',
    };
    
    // Add licensed states if available
    if (answers.licensedStates && answers.licensedStates.length > 0) {
      licenseFields.licensedStates = answers.licensedStates;
    }
    
    const [updated] = await db.update(users)
      .set({
        ...licenseFields,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();
      
    if (!updated) {
      throw new Error(`User ${userId} not found`);
    }
    
    return updated;
  }

  async getOnboardingStatus(userId: string): Promise<{ completed: boolean; answers?: any }> {
    const [user] = await db.select({
      hasCompletedOnboarding: users.hasCompletedOnboarding,
      onboardingAnswers: users.onboardingAnswers
    })
    .from(users)
    .where(eq(users.id, userId));
    
    if (!user) {
      return { completed: false };
    }
    
    return { 
      completed: user.hasCompletedOnboarding || false,
      answers: user.onboardingAnswers
    };
  }

  async getCampaigns(): Promise<Campaign[]> {
    return await db.select().from(campaigns).orderBy(desc(campaigns.createdAt));
  }

  async getCampaign(id: string): Promise<Campaign | undefined> {
    const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, id));
    return campaign || undefined;
  }

  async createCampaign(campaign: InsertCampaign): Promise<Campaign> {
    const [created] = await db.insert(campaigns).values(campaign).returning();
    return created;
  }

  async updateCampaign(id: string, updates: Partial<Campaign>): Promise<Campaign> {
    const [updated] = await db.update(campaigns).set(updates).where(eq(campaigns.id, id)).returning();
    return updated;
  }

  async getCandidates(page: number = 1, limit: number = 100): Promise<Candidate[]> {
    const offset = (page - 1) * limit;
    return await db.select()
      .from(candidates)
      .orderBy(desc(candidates.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getCandidate(id: string): Promise<Candidate | undefined> {
    const [candidate] = await db.select().from(candidates).where(eq(candidates.id, id));
    return candidate || undefined;
  }

  async getCandidateByEmail(email: string): Promise<Candidate | undefined> {
    const [candidate] = await db.select().from(candidates).where(eq(candidates.email, email));
    return candidate || undefined;
  }

  async getCandidateByConversationId(conversationId: string): Promise<Candidate | undefined> {
    const [candidate] = await db.select().from(candidates).where(eq(candidates.conversationId, conversationId));
    return candidate || undefined;
  }

  async getCandidateByToken(token: string): Promise<Candidate | undefined> {
    const candidateId = this.tokenStore.get(token);
    if (!candidateId) return undefined;
    return await this.getCandidate(candidateId);
  }

  async createCandidate(candidate: InsertCandidate): Promise<Candidate> {
    const [created] = await db.insert(candidates).values(candidate).returning();
    
    // Generate secure tokens for interview and booking
    const interviewToken = crypto.randomBytes(32).toString('hex');
    const bookingToken = crypto.randomBytes(32).toString('hex');
    this.tokenStore.set(interviewToken, created.id);
    this.tokenStore.set(bookingToken, created.id);
    
    return created;
  }

  async updateCandidate(id: string, updates: Partial<Candidate>): Promise<Candidate> {
    const [updated] = await db.update(candidates).set(updates).where(eq(candidates.id, id)).returning();
    return updated;
  }

  async upsertCandidateByConversationId(candidate: InsertCandidate): Promise<{ candidate: Candidate; action: 'created' | 'updated' }> {
    // Check if conversation_id is provided
    if (!candidate.conversationId) {
      throw new Error('conversationId is required for upsert operation');
    }

    // Try to find existing candidate by conversationId
    const existing = await this.getCandidateByConversationId(candidate.conversationId);

    if (existing) {
      // Update existing candidate
      const updated = await this.updateCandidate(existing.id, candidate);
      return { candidate: updated, action: 'updated' };
    } else {
      // Create new candidate
      const created = await this.createCandidate(candidate);
      return { candidate: created, action: 'created' };
    }
  }

  async getInterviews(candidateId?: string): Promise<Interview[]> {
    if (candidateId) {
      return await db.select().from(interviews).where(eq(interviews.candidateId, candidateId));
    }
    return await db.select().from(interviews).orderBy(desc(interviews.createdAt));
  }

  async getInterview(id: string): Promise<Interview | undefined> {
    const [interview] = await db.select().from(interviews).where(eq(interviews.id, id));
    return interview || undefined;
  }

  async createInterview(interview: InsertInterview): Promise<Interview> {
    const [created] = await db.insert(interviews).values(interview).returning();
    return created;
  }

  async updateInterview(id: string, updates: Partial<Interview>): Promise<Interview> {
    const [updated] = await db.update(interviews).set(updates).where(eq(interviews.id, id)).returning();
    return updated;
  }

  async getBookings(candidateId?: string): Promise<Booking[]> {
    if (candidateId) {
      return await db.select().from(bookings).where(eq(bookings.candidateId, candidateId));
    }
    return await db.select().from(bookings).orderBy(desc(bookings.createdAt));
  }

  async getBooking(id: string): Promise<Booking | undefined> {
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, id));
    return booking || undefined;
  }

  async createBooking(booking: InsertBooking): Promise<Booking> {
    const [created] = await db.insert(bookings).values(booking).returning();
    return created;
  }

  async updateBooking(id: string, updates: Partial<Booking>): Promise<Booking> {
    const [updated] = await db.update(bookings).set(updates).where(eq(bookings.id, id)).returning();
    return updated;
  }

  async getApifyActors(): Promise<ApifyActor[]> {
    return await db.select().from(apifyActors).orderBy(desc(apifyActors.createdAt));
  }

  async getApifyActor(id: string): Promise<ApifyActor | undefined> {
    const [actor] = await db.select().from(apifyActors).where(eq(apifyActors.id, id));
    return actor || undefined;
  }

  async createApifyActor(actor: InsertApifyActor): Promise<ApifyActor> {
    const [created] = await db.insert(apifyActors).values(actor).returning();
    return created;
  }

  async updateApifyActor(id: string, updates: Partial<ApifyActor>): Promise<ApifyActor> {
    const [updated] = await db.update(apifyActors).set(updates).where(eq(apifyActors.id, id)).returning();
    return updated;
  }

  async deleteApifyActor(id: string): Promise<void> {
    await db.delete(apifyActors).where(eq(apifyActors.id, id));
  }

  async getAuditLogs(limit: number = 100): Promise<AuditLog[]> {
    return await db.select().from(auditLogs).orderBy(desc(auditLogs.ts)).limit(limit);
  }

  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const [created] = await db.insert(auditLogs).values(log).returning();
    return created;
  }

  async getKPIs(): Promise<any> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Get today's applicants
    const [todayApplicantsResult] = await db
      .select({ count: count() })
      .from(candidates)
      .where(sql`${candidates.createdAt} >= ${today}`);

    const [yesterdayApplicantsResult] = await db
      .select({ count: count() })
      .from(candidates)
      .where(sql`${candidates.createdAt} >= ${yesterday} AND ${candidates.createdAt} < ${today}`);

    // Calculate interview rate
    const [totalCandidatesResult] = await db.select({ count: count() }).from(candidates);
    const [interviewedCandidatesResult] = await db
      .select({ count: count() })
      .from(candidates)
      .where(sql`${candidates.pipelineStage} != 'NEW'`);

    // Calculate booking rate
    const [bookedCandidatesResult] = await db
      .select({ count: count() })
      .from(bookings);

    // Calculate offer rate
    const [hiredCandidatesResult] = await db
      .select({ count: count() })
      .from(candidates)
      .where(eq(candidates.pipelineStage, "HIRED"));

    const todayApplicants = todayApplicantsResult.count;
    const yesterdayApplicants = yesterdayApplicantsResult.count;
    const totalCandidates = totalCandidatesResult.count;
    const interviewedCandidates = interviewedCandidatesResult.count;
    const bookedCandidates = bookedCandidatesResult.count;
    const hiredCandidates = hiredCandidatesResult.count;

    return {
      todayApplicants,
      todayApplicantsChange: yesterdayApplicants > 0 
        ? Math.round(((todayApplicants - yesterdayApplicants) / yesterdayApplicants) * 100)
        : 0,
      interviewRate: totalCandidates > 0 ? Math.round((interviewedCandidates / totalCandidates) * 100) : 0,
      interviewRateChange: 5, // Would need historical data
      bookingRate: interviewedCandidates > 0 ? Math.round((bookedCandidates / interviewedCandidates) * 100) : 0,
      bookingRateChange: 2, // Would need historical data
      offerRate: totalCandidates > 0 ? Math.round((hiredCandidates / totalCandidates) * 100) : 0,
      offerRateChange: 8, // Would need historical data
    };
  }

  async getAdminStats(): Promise<any> {
    const [candidatesCount] = await db.select({ count: count() }).from(candidates);
    const [campaignsCount] = await db.select({ count: count() }).from(campaigns);
    const [interviewsCount] = await db.select({ count: count() }).from(interviews);
    const [bookingsCount] = await db.select({ count: count() }).from(bookings);
    const [actorsCount] = await db.select({ count: count() }).from(apifyActors);
    const [logsCount] = await db.select({ count: count() }).from(auditLogs);

    return {
      candidates: candidatesCount.count,
      campaigns: campaignsCount.count,
      interviews: interviewsCount.count,
      bookings: bookingsCount.count,
      apifyActors: actorsCount.count,
      auditLogs: logsCount.count,
    };
  }

  // Workflow rule methods implementation
  async getWorkflowRules(): Promise<WorkflowRule[]> {
    return await db.select().from(workflowRules).orderBy(desc(workflowRules.priority), desc(workflowRules.createdAt));
  }

  async getWorkflowRule(id: string): Promise<WorkflowRule | undefined> {
    const [rule] = await db.select().from(workflowRules).where(eq(workflowRules.id, id));
    return rule || undefined;
  }

  async createWorkflowRule(rule: InsertWorkflowRule): Promise<WorkflowRule> {
    const [created] = await db.insert(workflowRules).values(rule).returning();
    return created;
  }

  async updateWorkflowRule(id: string, updates: Partial<WorkflowRule>): Promise<WorkflowRule> {
    const [updated] = await db
      .update(workflowRules)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(workflowRules.id, id))
      .returning();
    return updated;
  }

  async deleteWorkflowRule(id: string): Promise<void> {
    await db.delete(workflowRules).where(eq(workflowRules.id, id));
  }

  async saveICSFile(content: string): Promise<string> {
    // In a real implementation, this would save to a file storage service
    // For now, we'll return a mock URL
    const filename = `interview-${Date.now()}.ics`;
    const url = `${process.env.APP_BASE_URL}/ics/${filename}`;
    
    // TODO: Implement actual file storage (S3, etc.)
    console.log(`ICS file would be saved: ${filename}`);
    
    return url;
  }

  // Apify Run methods implementation
  async getApifyRuns(actorId?: string): Promise<ApifyRun[]> {
    if (actorId) {
      return await db.select().from(apifyRuns).where(eq(apifyRuns.actorId, actorId)).orderBy(desc(apifyRuns.startedAt));
    }
    return await db.select().from(apifyRuns).orderBy(desc(apifyRuns.startedAt));
  }

  async getApifyRun(id: string): Promise<ApifyRun | undefined> {
    const [run] = await db.select().from(apifyRuns).where(eq(apifyRuns.id, id));
    return run || undefined;
  }

  async getApifyRunByApifyId(apifyRunId: string): Promise<ApifyRun | undefined> {
    const [run] = await db.select().from(apifyRuns).where(eq(apifyRuns.apifyRunId, apifyRunId));
    return run || undefined;
  }

  async createApifyRun(run: InsertApifyRun): Promise<ApifyRun> {
    const [created] = await db.insert(apifyRuns).values(run).returning();
    return created;
  }

  async updateApifyRun(id: string, updates: Partial<ApifyRun>): Promise<ApifyRun> {
    const [updated] = await db.update(apifyRuns).set(updates).where(eq(apifyRuns.id, id)).returning();
    return updated;
  }


  // ElevenLabs Tracking methods implementation
  async getElevenLabsTracking(agentId: string): Promise<ElevenLabsTracking | undefined> {
    const [tracking] = await db.select().from(elevenLabsTracking).where(eq(elevenLabsTracking.agentId, agentId));
    return tracking || undefined;
  }

  async createElevenLabsTracking(tracking: InsertElevenLabsTracking): Promise<ElevenLabsTracking> {
    const [created] = await db.insert(elevenLabsTracking).values(tracking).returning();
    return created;
  }

  async updateElevenLabsTracking(agentId: string, updates: Partial<ElevenLabsTracking>): Promise<ElevenLabsTracking> {
    const [updated] = await db
      .update(elevenLabsTracking)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(elevenLabsTracking.agentId, agentId))
      .returning();
    return updated;
  }

  // === PHASE 3: CONVERSATION CONTEXT METHODS ===

  // Platform conversation methods
  async getPlatformConversations(page = 1, limit = 50): Promise<PlatformConversation[]> {
    const offset = (page - 1) * limit;
    return await db
      .select()
      .from(platformConversations)
      .orderBy(desc(platformConversations.lastActivityAt))
      .limit(limit)
      .offset(offset);
  }

  async getPlatformConversation(id: string): Promise<PlatformConversation | undefined> {
    const [conversation] = await db
      .select()
      .from(platformConversations)
      .where(eq(platformConversations.id, id));
    return conversation || undefined;
  }

  async getPlatformConversationByConversationId(conversationId: string): Promise<PlatformConversation | undefined> {
    const [conversation] = await db
      .select()
      .from(platformConversations)
      .where(eq(platformConversations.conversationId, conversationId));
    return conversation || undefined;
  }

  async createPlatformConversation(conversation: InsertPlatformConversation): Promise<PlatformConversation> {
    const [created] = await db
      .insert(platformConversations)
      .values(conversation)
      .returning();
    return created;
  }

  async updatePlatformConversation(id: string, updates: Partial<PlatformConversation>): Promise<PlatformConversation> {
    const [updated] = await db
      .update(platformConversations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(platformConversations.id, id))
      .returning();
    return updated;
  }

  async upsertPlatformConversation(conversation: InsertPlatformConversation): Promise<{ conversation: PlatformConversation; action: 'created' | 'updated' }> {
    const existing = await this.getPlatformConversationByConversationId(conversation.conversationId);
    
    if (existing) {
      const updated = await this.updatePlatformConversation(existing.id, conversation);
      return { conversation: updated, action: 'updated' };
    } else {
      const created = await this.createPlatformConversation(conversation);
      return { conversation: created, action: 'created' };
    }
  }

  // Conversation context methods
  async getConversationContexts(platformConversationId: string): Promise<ConversationContext[]> {
    return await db
      .select()
      .from(conversationContext)
      .where(eq(conversationContext.platformConversationId, platformConversationId))
      .orderBy(desc(conversationContext.priority), desc(conversationContext.createdAt));
  }

  async getConversationContext(id: string): Promise<ConversationContext | undefined> {
    const [context] = await db
      .select()
      .from(conversationContext)
      .where(eq(conversationContext.id, id));
    return context || undefined;
  }

  async getConversationContextByKey(platformConversationId: string, contextKey: string, contextType: string): Promise<ConversationContext | undefined> {
    const [context] = await db
      .select()
      .from(conversationContext)
      .where(
        and(
          eq(conversationContext.platformConversationId, platformConversationId),
          eq(conversationContext.contextKey, contextKey),
          eq(conversationContext.contextType, contextType)
        )
      );
    return context || undefined;
  }

  async createConversationContext(context: InsertConversationContext): Promise<ConversationContext> {
    const [created] = await db
      .insert(conversationContext)
      .values(context)
      .returning();
    return created;
  }

  async updateConversationContext(id: string, updates: Partial<ConversationContext>): Promise<ConversationContext> {
    const [updated] = await db
      .update(conversationContext)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(conversationContext.id, id))
      .returning();
    return updated;
  }

  async upsertConversationContext(context: InsertConversationContext): Promise<{ context: ConversationContext; action: 'created' | 'updated' }> {
    const existing = await this.getConversationContextByKey(
      context.platformConversationId,
      context.contextKey,
      context.contextType
    );
    
    if (existing) {
      const updated = await this.updateConversationContext(existing.id, context);
      return { context: updated, action: 'updated' };
    } else {
      const created = await this.createConversationContext(context);
      return { context: created, action: 'created' };
    }
  }

  async deleteConversationContext(id: string): Promise<void> {
    await db.delete(conversationContext).where(eq(conversationContext.id, id));
  }

  // Conversation memory methods
  async getConversationMemoryByAgent(agentId: string, limit = 100): Promise<ConversationMemory[]> {
    return await db
      .select()
      .from(conversationMemory)
      .where(and(eq(conversationMemory.agentId, agentId), eq(conversationMemory.isActive, true)))
      .orderBy(desc(conversationMemory.confidence), desc(conversationMemory.lastUsedAt))
      .limit(limit);
  }

  async getConversationMemory(id: string): Promise<ConversationMemory | undefined> {
    const [memory] = await db
      .select()
      .from(conversationMemory)
      .where(eq(conversationMemory.id, id));
    return memory || undefined;
  }

  async getConversationMemoryByKey(agentId: string, memoryKey: string, memoryType: string): Promise<ConversationMemory | undefined> {
    const [memory] = await db
      .select()
      .from(conversationMemory)
      .where(
        and(
          eq(conversationMemory.agentId, agentId),
          eq(conversationMemory.memoryKey, memoryKey),
          eq(conversationMemory.memoryType, memoryType)
        )
      );
    return memory || undefined;
  }

  async searchConversationMemory(agentId: string, searchTerms: string[], memoryTypes?: string[]): Promise<ConversationMemory[]> {
    const conditions = [
      eq(conversationMemory.agentId, agentId),
      eq(conversationMemory.isActive, true)
    ];

    // Add memory type filtering if provided
    if (memoryTypes && memoryTypes.length > 0) {
      conditions.push(eq(conversationMemory.memoryType, memoryTypes[0]));
    }

    const results = await db
      .select()
      .from(conversationMemory)
      .where(and(...conditions))
      .orderBy(desc(conversationMemory.confidence), desc(conversationMemory.lastUsedAt))
      .limit(50);

    // Filter by search terms in memory - this is a simple implementation
    // In production, you might want to use full-text search capabilities
    if (searchTerms.length > 0) {
      return results.filter(memory => {
        const tags = memory.tags ?? [];
        const searchableText = `${memory.memoryKey} ${JSON.stringify(memory.memoryValue)} ${tags.join(' ')}`.toLowerCase();
        return searchTerms.some(term => searchableText.includes(term.toLowerCase()));
      });
    }

    return results;
  }

  async createConversationMemory(memory: InsertConversationMemory): Promise<ConversationMemory> {
    const [created] = await db
      .insert(conversationMemory)
      .values(memory)
      .returning();
    return created;
  }

  async updateConversationMemory(id: string, updates: Partial<ConversationMemory>): Promise<ConversationMemory> {
    const [updated] = await db
      .update(conversationMemory)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(conversationMemory.id, id))
      .returning();
    return updated;
  }

  async upsertConversationMemory(memory: InsertConversationMemory): Promise<{ memory: ConversationMemory; action: 'created' | 'updated' }> {
    const existing = await this.getConversationMemoryByKey(
      memory.agentId,
      memory.memoryKey,
      memory.memoryType
    );
    
    if (existing) {
      const updated = await this.updateConversationMemory(existing.id, memory);
      return { memory: updated, action: 'updated' };
    } else {
      const created = await this.createConversationMemory(memory);
      return { memory: created, action: 'created' };
    }
  }

  async deleteConversationMemory(id: string): Promise<void> {
    await db.delete(conversationMemory).where(eq(conversationMemory.id, id));
  }

  async incrementMemoryUsage(id: string): Promise<ConversationMemory> {
    const [updated] = await db
      .update(conversationMemory)
      .set({
        usageCount: sql`${conversationMemory.usageCount} + 1`,
        lastUsedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(conversationMemory.id, id))
      .returning();
    return updated;
  }

  // === MESSENGER METHODS ===
  
  // Channel methods
  async getChannels(): Promise<Channel[]> {
    return await db.select().from(channels).orderBy(channels.createdAt);
  }

  async getChannel(id: string): Promise<Channel | undefined> {
    const [channel] = await db.select().from(channels).where(eq(channels.id, id));
    return channel || undefined;
  }

  async createChannel(channel: InsertChannel): Promise<Channel> {
    const [created] = await db.insert(channels).values(channel).returning();
    return created;
  }

  // User Channel methods (membership)
  async getUserChannels(userId: string): Promise<UserChannel[]> {
    return await db.select().from(userChannels).where(eq(userChannels.userId, userId));
  }

  async joinChannel(userId: string, channelId: string): Promise<UserChannel> {
    const [joined] = await db.insert(userChannels).values({ userId, channelId }).returning();
    return joined;
  }

  async updateChannelAccess(userId: string, channelId: string, canAccess: boolean): Promise<UserChannel> {
    const [updated] = await db
      .update(userChannels)
      .set({ canAccess })
      .where(and(eq(userChannels.userId, userId), eq(userChannels.channelId, channelId)))
      .returning();
    return updated;
  }

  async getChannelMembers(channelId: string): Promise<UserChannel[]> {
    return await db.select().from(userChannels).where(eq(userChannels.channelId, channelId));
  }

  async userHasChannelAccess(userId: string, channelId: string): Promise<boolean> {
    const [membership] = await db
      .select()
      .from(userChannels)
      .where(and(eq(userChannels.userId, userId), eq(userChannels.channelId, channelId)));
    return membership?.canAccess ?? false;
  }

  async updateUserOnlineStatus(userId: string, isOnline: boolean): Promise<void> {
    await db
      .update(users)
      .set({ isOnline, lastSeenAt: new Date() })
      .where(eq(users.id, userId));
  }

  // Message methods
  async getChannelMessages(channelId: string, limit = 100): Promise<Message[]> {
    return await db
      .select()
      .from(messages)
      .where(eq(messages.channelId, channelId))
      .orderBy(desc(messages.createdAt))
      .limit(limit);
  }

  // Helper function to extract mentioned user IDs from message content
  private async extractMentionedUserIds(content: string, channelId?: string): Promise<string[]> {
    const mentionedUserIds: string[] = [];
    
    // Regular expression to match @mentions
    // Matches @FirstName, @FirstName_LastName, or @email
    const mentionRegex = /@([a-zA-Z0-9._-]+)/g;
    const matches = content.matchAll(mentionRegex);
    
    for (const match of matches) {
      const mentionText = match[1].toLowerCase();
      
      // Handle special mentions
      if (mentionText === 'everyone' || mentionText === 'channel') {
        if (channelId) {
          // Get all channel members
          const channelMembers = await this.getChannelMembers(channelId);
          const memberIds = channelMembers.map(m => m.userId);
          mentionedUserIds.push(...memberIds);
        }
        continue;
      }
      
      // Search for user by mention text
      // Try to match by firstName_lastName pattern or email
      const searchPattern = mentionText.replace('_', ' ');
      
      const users = await db.select()
        .from(users)
        .where(
          sql`(
            LOWER(${users.firstName}) = LOWER(${searchPattern}) OR
            LOWER(CONCAT(${users.firstName}, ' ', ${users.lastName})) = LOWER(${searchPattern}) OR
            LOWER(REPLACE(CONCAT(${users.firstName}, '_', ${users.lastName}), ' ', '_')) = LOWER(${mentionText}) OR
            LOWER(SPLIT_PART(${users.email}, '@', 1)) = LOWER(${mentionText})
          )`
        )
        .limit(1);
      
      if (users.length > 0) {
        mentionedUserIds.push(users[0].id);
      }
    }
    
    // Remove duplicates
    return [...new Set(mentionedUserIds)];
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    // Extract mentioned user IDs from content
    const mentionedUserIds = message.content 
      ? await this.extractMentionedUserIds(message.content, message.channelId)
      : [];
    
    // Create message with mentioned user IDs and formatted content
    const messageWithMentions = {
      ...message,
      mentionedUserIds,
      // Ensure formattedContent is included if provided
      formattedContent: (message as any).formattedContent || null
    };
    
    const [created] = await db.insert(messages).values(messageWithMentions).returning();
    
    // Update thread count if this is a reply
    if (message.parentMessageId) {
      await this.updateThreadCount(message.parentMessageId);
    }
    
    return created;
  }
  
  // Thread methods for channel messages
  async getThreadReplies(messageId: string): Promise<Message[]> {
    return await db
      .select()
      .from(messages)
      .where(eq(messages.parentMessageId, messageId))
      .orderBy(messages.createdAt);
  }
  
  async createThreadReply(reply: InsertMessage): Promise<Message> {
    // Ensure parentMessageId is set
    if (!reply.parentMessageId) {
      throw new Error('parentMessageId is required for thread replies');
    }
    return this.createMessage(reply);
  }
  
  async updateThreadCount(parentMessageId: string): Promise<void> {
    // Get the count of replies
    const [result] = await db
      .select({ count: count() })
      .from(messages)
      .where(eq(messages.parentMessageId, parentMessageId));
    
    const replyCount = result?.count || 0;
    
    // Get the latest reply timestamp
    const [latestReply] = await db
      .select({ createdAt: messages.createdAt })
      .from(messages)
      .where(eq(messages.parentMessageId, parentMessageId))
      .orderBy(desc(messages.createdAt))
      .limit(1);
    
    // Update the parent message
    await db
      .update(messages)
      .set({
        threadCount: replyCount,
        lastThreadReply: latestReply?.createdAt || null
      })
      .where(eq(messages.id, parentMessageId));
  }

  // Direct message methods
  async getDirectMessages(userId: string, otherUserId: string): Promise<DirectMessage[]> {
    return await db
      .select()
      .from(directMessages)
      .where(
        and(
          sql`(${directMessages.senderId} = ${userId} AND ${directMessages.receiverId} = ${otherUserId}) OR (${directMessages.senderId} = ${otherUserId} AND ${directMessages.receiverId} = ${userId})`
        )
      )
      .orderBy(desc(directMessages.createdAt));
  }

  // Get DM users - admins see all, users see only admins  
  async getDMUsers(userId: string, isAdmin: boolean): Promise<User[]> {
    if (isAdmin) {
      // Admins can message all users
      return await db
        .select()
        .from(users)
        .where(sql`${users.id} != ${userId}`)
        .orderBy(users.firstName, users.lastName);
    } else {
      // Non-admins can only message admins
      return await db
        .select()
        .from(users)
        .where(
          and(
            sql`${users.id} != ${userId}`,
            eq(users.isAdmin, true)
          )
        )
        .orderBy(users.firstName, users.lastName);
    }
  }

  // Get DM messages between two users (alias for getDirectMessages)
  async getDMMessages(userId1: string, userId2: string): Promise<DirectMessage[]> {
    return this.getDirectMessages(userId1, userId2);
  }

  // Send a direct message
  async sendDM(senderId: string, recipientId: string, content: string, fileUrl?: string, fileName?: string, formattedContent?: string): Promise<DirectMessage> {
    const [message] = await db.insert(directMessages).values({
      senderId,
      receiverId: recipientId,
      content,
      formattedContent: formattedContent || null,
      fileUrl,
      fileName,
      isRead: false
    }).returning();
    return message;
  }

  // Mark direct messages as read (alias with different parameter order)
  async markDMAsRead(recipientId: string, senderId: string): Promise<void> {
    return this.markDirectMessagesAsRead(recipientId, senderId);
  }

  // Get unread message counts per conversation
  async getUnreadCounts(userId: string): Promise<{ [senderId: string]: number }> {
    const unreadMessages = await db
      .select({
        senderId: directMessages.senderId,
        count: sql<number>`COUNT(*)`.as('count')
      })
      .from(directMessages)
      .where(
        and(
          eq(directMessages.receiverId, userId),
          eq(directMessages.isRead, false)
        )
      )
      .groupBy(directMessages.senderId);

    const counts: { [senderId: string]: number } = {};
    for (const msg of unreadMessages) {
      counts[msg.senderId] = Number(msg.count);
    }
    return counts;
  }

  async getUserConversations(userId: string): Promise<{userId: string, lastMessage: DirectMessage}[]> {
    const allMessages = await db
      .select()
      .from(directMessages)
      .where(
        sql`${directMessages.senderId} = ${userId} OR ${directMessages.receiverId} = ${userId}`
      )
      .orderBy(desc(directMessages.createdAt));

    const conversationMap = new Map<string, DirectMessage>();
    
    for (const message of allMessages) {
      const otherUserId = message.senderId === userId ? message.receiverId : message.senderId;
      if (!conversationMap.has(otherUserId)) {
        conversationMap.set(otherUserId, message);
      }
    }

    return Array.from(conversationMap.entries()).map(([userId, lastMessage]) => ({
      userId,
      lastMessage
    }));
  }

  async createDirectMessage(message: InsertDirectMessage): Promise<DirectMessage> {
    // Extract mentioned user IDs from content
    const mentionedUserIds = message.content 
      ? await this.extractMentionedUserIds(message.content)
      : [];
    
    // Create message with mentioned user IDs and formatted content
    const messageWithMentions = {
      ...message,
      mentionedUserIds,
      // Ensure formattedContent is included if provided
      formattedContent: (message as any).formattedContent || null
    };
    
    const [created] = await db.insert(directMessages).values(messageWithMentions).returning();
    
    // Update thread count if this is a reply
    if (message.parentMessageId) {
      await this.updateDirectThreadCount(message.parentMessageId);
    }
    
    return created;
  }
  
  // Thread methods for direct messages
  async getDirectThreadReplies(messageId: string): Promise<DirectMessage[]> {
    return await db
      .select()
      .from(directMessages)
      .where(eq(directMessages.parentMessageId, messageId))
      .orderBy(directMessages.createdAt);
  }
  
  async createDirectThreadReply(reply: InsertDirectMessage): Promise<DirectMessage> {
    // Ensure parentMessageId is set
    if (!reply.parentMessageId) {
      throw new Error('parentMessageId is required for thread replies');
    }
    return this.createDirectMessage(reply);
  }
  
  async updateDirectThreadCount(parentMessageId: string): Promise<void> {
    // Get the count of replies
    const [result] = await db
      .select({ count: count() })
      .from(directMessages)
      .where(eq(directMessages.parentMessageId, parentMessageId));
    
    const replyCount = result?.count || 0;
    
    // Get the latest reply timestamp
    const [latestReply] = await db
      .select({ createdAt: directMessages.createdAt })
      .from(directMessages)
      .where(eq(directMessages.parentMessageId, parentMessageId))
      .orderBy(desc(directMessages.createdAt))
      .limit(1);
    
    // Update the parent message
    await db
      .update(directMessages)
      .set({
        threadCount: replyCount,
        lastThreadReply: latestReply?.createdAt || null
      })
      .where(eq(directMessages.id, parentMessageId));
  }

  async markDirectMessagesAsRead(userId: string, senderId: string): Promise<void> {
    await db
      .update(directMessages)
      .set({ isRead: true })
      .where(
        and(
          eq(directMessages.receiverId, userId),
          eq(directMessages.senderId, senderId),
          eq(directMessages.isRead, false)
        )
      );
  }

  // Reaction methods
  async addReaction(messageId: string, userId: string, emoji: string, messageType: 'channel' | 'dm'): Promise<MessageReaction | DirectMessageReaction> {
    try {
      if (messageType === 'channel') {
        const [reaction] = await db
          .insert(messageReactions)
          .values({ messageId, userId, emoji })
          .onConflictDoNothing()
          .returning();
        return reaction;
      } else {
        const [reaction] = await db
          .insert(directMessageReactions)
          .values({ directMessageId: messageId, userId, emoji })
          .onConflictDoNothing()
          .returning();
        return reaction;
      }
    } catch (error) {
      // If reaction already exists, fetch and return it
      if (messageType === 'channel') {
        const [existing] = await db
          .select()
          .from(messageReactions)
          .where(and(
            eq(messageReactions.messageId, messageId),
            eq(messageReactions.userId, userId),
            eq(messageReactions.emoji, emoji)
          ));
        return existing;
      } else {
        const [existing] = await db
          .select()
          .from(directMessageReactions)
          .where(and(
            eq(directMessageReactions.directMessageId, messageId),
            eq(directMessageReactions.userId, userId),
            eq(directMessageReactions.emoji, emoji)
          ));
        return existing;
      }
    }
  }

  async removeReaction(messageId: string, userId: string, emoji: string, messageType: 'channel' | 'dm'): Promise<void> {
    if (messageType === 'channel') {
      await db
        .delete(messageReactions)
        .where(and(
          eq(messageReactions.messageId, messageId),
          eq(messageReactions.userId, userId),
          eq(messageReactions.emoji, emoji)
        ));
    } else {
      await db
        .delete(directMessageReactions)
        .where(and(
          eq(directMessageReactions.directMessageId, messageId),
          eq(directMessageReactions.userId, userId),
          eq(directMessageReactions.emoji, emoji)
        ));
    }
  }

  async getMessageReactions(messageId: string): Promise<MessageReaction[]> {
    return await db
      .select()
      .from(messageReactions)
      .where(eq(messageReactions.messageId, messageId))
      .orderBy(messageReactions.createdAt);
  }

  async getDirectMessageReactions(messageId: string): Promise<DirectMessageReaction[]> {
    return await db
      .select()
      .from(directMessageReactions)
      .where(eq(directMessageReactions.directMessageId, messageId))
      .orderBy(directMessageReactions.createdAt);
  }

  async getUserReactions(userId: string, messageType: 'channel' | 'dm'): Promise<(MessageReaction | DirectMessageReaction)[]> {
    if (messageType === 'channel') {
      return await db
        .select()
        .from(messageReactions)
        .where(eq(messageReactions.userId, userId))
        .orderBy(desc(messageReactions.createdAt));
    } else {
      return await db
        .select()
        .from(directMessageReactions)
        .where(eq(directMessageReactions.userId, userId))
        .orderBy(desc(directMessageReactions.createdAt));
    }
  }

  // File upload methods
  async getUserFiles(userId: string): Promise<FileUpload[]> {
    return await db.select().from(fileUploads).where(eq(fileUploads.userId, userId)).orderBy(desc(fileUploads.uploadedAt));
  }

  async createFileUpload(upload: InsertFileUpload): Promise<FileUpload> {
    const [created] = await db.insert(fileUploads).values(upload).returning();
    return created;
  }

  async saveFileUpload(
    userId: string, 
    fileName: string, 
    fileType: string, 
    fileUrl: string, 
    fileSize: number, 
    isResume: boolean,
    mimeType?: string,
    metadata?: any,
    linkedToMessageId?: string,
    thumbnailUrl?: string
  ): Promise<FileUpload> {
    return await this.createFileUpload({
      userId,
      fileName,
      fileType,
      fileUrl,
      fileSize,
      isResume,
      parseStatus: isResume ? 'pending' : undefined,
      mimeType,
      metadata,
      linkedToMessageId,
      thumbnailUrl
    });
  }

  async updateParsedData(fileId: string, parsedData: any, status: 'parsed' | 'failed'): Promise<FileUpload> {
    const [updated] = await db
      .update(fileUploads)
      .set({
        parsedData,
        parseStatus: status,
        parsedAt: status === 'parsed' ? new Date() : undefined,
        parseError: status === 'failed' ? 'Failed to parse resume' : undefined
      })
      .where(eq(fileUploads.id, fileId))
      .returning();
    return updated;
  }

  async getFileUpload(fileId: string): Promise<FileUpload | undefined> {
    const [file] = await db.select().from(fileUploads).where(eq(fileUploads.id, fileId));
    return file || undefined;
  }

  async getUserUploads(userId: string): Promise<FileUpload[]> {
    return await this.getUserFiles(userId);
  }

  async getFilesByMessageId(messageId: string): Promise<FileUpload[]> {
    return await db
      .select()
      .from(fileUploads)
      .where(eq(fileUploads.linkedToMessageId, messageId))
      .orderBy(desc(fileUploads.uploadedAt));
  }

  // Onboarding methods
  async getOnboardingResponse(userId: string): Promise<OnboardingResponse | undefined> {
    const [response] = await db.select().from(onboardingResponses).where(eq(onboardingResponses.userId, userId));
    return response || undefined;
  }

  async createOnboardingResponse(response: InsertOnboardingResponse): Promise<OnboardingResponse> {
    const [created] = await db.insert(onboardingResponses).values(response).returning();
    return created;
  }

  async getOnboardingStatus(userId: string): Promise<{ hasCompleted: boolean; currentLicensingInfo: any; availableChannels: Channel[] }> {
    const user = await this.getUser(userId);
    const onboardingResponse = await this.getOnboardingResponse(userId);
    const allChannels = await this.getChannels();

    return {
      hasCompleted: user?.hasCompletedOnboarding ?? false,
      currentLicensingInfo: {
        hasFloridaLicense: user?.hasFloridaLicense ?? false,
        isMultiStateLicensed: user?.isMultiStateLicensed ?? false,
        licensedStates: user?.licensedStates ?? []
      },
      availableChannels: allChannels
    };
  }

  async completeOnboarding(
    userId: string, 
    responses: { hasFloridaLicense: boolean; isMultiStateLicensed: boolean; licensedStates: string[] }
  ): Promise<{ user: User; channels: Channel[] }> {
    console.log(`[ONBOARDING DEBUG - Storage] Starting completeOnboarding for userId: ${userId}`);
    console.log(`[ONBOARDING DEBUG - Storage] Responses:`, responses);
    
    // Get user before update to check current state
    const userBefore = await this.getUser(userId);
    console.log(`[ONBOARDING DEBUG - Storage] User BEFORE update:`, {
      id: userBefore?.id,
      hasCompletedOnboarding: userBefore?.hasCompletedOnboarding,
      hasFloridaLicense: userBefore?.hasFloridaLicense
    });
    
    // Update user with onboarding completion and licensing info
    console.log(`[ONBOARDING DEBUG - Storage] Calling updateUser with hasCompletedOnboarding: true`);
    const updatedUser = await this.updateUser(userId, {
      hasCompletedOnboarding: true,
      hasFloridaLicense: responses.hasFloridaLicense,
      isMultiStateLicensed: responses.isMultiStateLicensed,
      licensedStates: responses.licensedStates
    });
    
    console.log(`[ONBOARDING DEBUG - Storage] User AFTER updateUser:`, {
      id: updatedUser.id,
      hasCompletedOnboarding: updatedUser.hasCompletedOnboarding,
      hasFloridaLicense: updatedUser.hasFloridaLicense
    });
    
    // Double-check by fetching user again
    const userAfterCheck = await this.getUser(userId);
    console.log(`[ONBOARDING DEBUG - Storage] User AFTER re-fetch:`, {
      id: userAfterCheck?.id,
      hasCompletedOnboarding: userAfterCheck?.hasCompletedOnboarding,
      hasFloridaLicense: userAfterCheck?.hasFloridaLicense
    });
    
    if (!userAfterCheck?.hasCompletedOnboarding) {
      console.error(`[ONBOARDING DEBUG - Storage] CRITICAL ERROR: User hasCompletedOnboarding is still false after update!`);
      throw new Error(`Failed to update hasCompletedOnboarding for user ${userId}`);
    }

    // Upsert onboarding response record (handles retries/duplicates gracefully)
    console.log(`[ONBOARDING DEBUG - Storage] Upserting onboarding response record...`);
    await db
      .insert(onboardingResponses)
      .values({
        userId,
        hasFloridaLicense: responses.hasFloridaLicense,
        isMultiStateLicensed: responses.isMultiStateLicensed,
        licensedStates: responses.licensedStates
      })
      .onConflictDoUpdate({
        target: onboardingResponses.userId,
        set: {
          hasFloridaLicense: responses.hasFloridaLicense,
          isMultiStateLicensed: responses.isMultiStateLicensed,
          licensedStates: responses.licensedStates,
          completedAt: new Date()
        }
      });

    // Determine channel types based on licensing
    let channelTypes: string[] = [];
    if (!responses.hasFloridaLicense) {
      channelTypes = ["non_licensed", "general", "social", "onboarding"];
    } else if (responses.isMultiStateLicensed) {
      channelTypes = ["multi_state", "fl_licensed", "general", "social"];
    } else {
      channelTypes = ["fl_licensed", "general", "social"];
    }

    // Assign user to channels
    const assignedChannels = await this.assignUserToChannels(userId, channelTypes);
    
    // Get the full channel objects
    const allChannels = await this.getChannels();
    const userChannelsList = assignedChannels.map(uc => 
      allChannels.find(c => c.id === uc.channelId)
    ).filter(Boolean) as Channel[];

    return { user: updatedUser, channels: userChannelsList };
  }

  async assignUserToChannels(userId: string, channelTypes: string[]): Promise<UserChannel[]> {
    const allChannels = await this.getChannels();
    const assignedChannels: UserChannel[] = [];

    for (const channelType of channelTypes) {
      const channel = allChannels.find(c => c.type === channelType);
      if (channel) {
        // Check if already joined
        const existingMembership = await db
          .select()
          .from(userChannels)
          .where(and(eq(userChannels.userId, userId), eq(userChannels.channelId, channel.id)))
          .limit(1);

        if (existingMembership.length === 0) {
          const joined = await this.joinChannel(userId, channel.id);
          await this.updateChannelAccess(userId, channel.id, true);
          assignedChannels.push(joined);
        } else {
          // Update access if already joined
          const updated = await this.updateChannelAccess(userId, channel.id, true);
          assignedChannels.push(updated);
        }
      }
    }

    return assignedChannels;
  }

  // Jason AI Settings methods
  async getJasonSettings(): Promise<JasonSetting[]> {
    return await db.select().from(jasonSettings).orderBy(jasonSettings.category, jasonSettings.settingKey);
  }

  async getJasonSetting(key: string): Promise<JasonSetting | undefined> {
    const [setting] = await db.select().from(jasonSettings).where(eq(jasonSettings.settingKey, key));
    return setting || undefined;
  }

  async updateJasonSetting(key: string, value: any, updatedBy?: string): Promise<JasonSetting> {
    // First try to update existing setting
    const existing = await this.getJasonSetting(key);
    if (existing) {
      const [updated] = await db
        .update(jasonSettings)
        .set({ 
          settingValue: value, 
          updatedBy, 
          updatedAt: new Date() 
        })
        .where(eq(jasonSettings.settingKey, key))
        .returning();
      return updated;
    }
    // If doesn't exist, create it
    return await this.createJasonSetting({ 
      settingKey: key, 
      settingValue: value,
      category: 'general',
      updatedBy 
    });
  }

  async createJasonSetting(setting: InsertJasonSetting): Promise<JasonSetting> {
    const [created] = await db.insert(jasonSettings).values(setting).returning();
    return created;
  }

  // Jason AI Template methods
  async getJasonTemplates(channelTier?: string): Promise<JasonTemplate[]> {
    if (channelTier) {
      return await db
        .select()
        .from(jasonTemplates)
        .where(eq(jasonTemplates.channelTier as any, channelTier))
        .orderBy(jasonTemplates.templateType, jasonTemplates.templateName);
    }
    return await db
      .select()
      .from(jasonTemplates)
      .orderBy(jasonTemplates.templateType, jasonTemplates.templateName);
  }

  async getJasonTemplate(id: string): Promise<JasonTemplate | undefined> {
    const [template] = await db.select().from(jasonTemplates).where(eq(jasonTemplates.id, id));
    return template || undefined;
  }

  async createJasonTemplate(template: InsertJasonTemplate): Promise<JasonTemplate> {
    const [created] = await db.insert(jasonTemplates).values(template).returning();
    return created;
  }

  async updateJasonTemplate(id: string, updates: Partial<JasonTemplate>): Promise<JasonTemplate> {
    const [updated] = await db
      .update(jasonTemplates)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(jasonTemplates.id, id))
      .returning();
    return updated;
  }

  async deleteJasonTemplate(id: string): Promise<void> {
    await db.delete(jasonTemplates).where(eq(jasonTemplates.id, id));
  }

  // Jason AI Channel Behavior methods
  async getJasonChannelBehaviors(): Promise<JasonChannelBehavior[]> {
    return await db.select().from(jasonChannelBehaviors).orderBy(jasonChannelBehaviors.channelId);
  }

  async getJasonChannelBehavior(channelId: string): Promise<JasonChannelBehavior | undefined> {
    const [behavior] = await db
      .select()
      .from(jasonChannelBehaviors)
      .where(eq(jasonChannelBehaviors.channelId, channelId));
    return behavior || undefined;
  }

  async upsertJasonChannelBehavior(channelId: string, behavior: InsertJasonChannelBehavior): Promise<JasonChannelBehavior> {
    const [result] = await db
      .insert(jasonChannelBehaviors)
      .values({ ...behavior, channelId })
      .onConflictDoUpdate({
        target: jasonChannelBehaviors.channelId,
        set: {
          ...behavior,
          updatedAt: new Date()
        }
      })
      .returning();
    return result;
  }

  // Message pinning methods
  async pinMessage(messageId: string, userId: string): Promise<Message> {
    const [pinned] = await db
      .update(messages)
      .set({
        isPinned: true,
        pinnedBy: userId,
        pinnedAt: new Date()
      })
      .where(eq(messages.id, messageId))
      .returning();
    return pinned;
  }

  async unpinMessage(messageId: string): Promise<Message> {
    const [unpinned] = await db
      .update(messages)
      .set({
        isPinned: false,
        pinnedBy: null,
        pinnedAt: null
      })
      .where(eq(messages.id, messageId))
      .returning();
    return unpinned;
  }

  async pinDirectMessage(messageId: string, userId: string): Promise<DirectMessage> {
    const [pinned] = await db
      .update(directMessages)
      .set({
        isPinned: true,
        pinnedBy: userId,
        pinnedAt: new Date()
      })
      .where(eq(directMessages.id, messageId))
      .returning();
    return pinned;
  }

  async unpinDirectMessage(messageId: string): Promise<DirectMessage> {
    const [unpinned] = await db
      .update(directMessages)
      .set({
        isPinned: false,
        pinnedBy: null,
        pinnedAt: null
      })
      .where(eq(directMessages.id, messageId))
      .returning();
    return unpinned;
  }

  async getPinnedMessages(channelId: string): Promise<Message[]> {
    const pinnedMessages = await db
      .select({
        message: messages,
        sender: users
      })
      .from(messages)
      .leftJoin(users, eq(messages.userId, users.id))
      .where(and(
        eq(messages.channelId, channelId),
        eq(messages.isPinned, true)
      ))
      .orderBy(desc(messages.pinnedAt));
    
    return pinnedMessages.map(({ message, sender }) => ({
      ...message,
      sender: sender || undefined
    }));
  }

  async getPinnedDirectMessages(userId1: string, userId2: string): Promise<DirectMessage[]> {
    return await db
      .select()
      .from(directMessages)
      .where(and(
        eq(directMessages.isPinned, true),
        sql`(sender_id = ${userId1} AND receiver_id = ${userId2}) OR (sender_id = ${userId2} AND receiver_id = ${userId1})`
      ))
      .orderBy(desc(directMessages.pinnedAt));
  }

  // Channel member methods
  async getChannelMembers(channelId: string): Promise<User[]> {
    const members = await db
      .select({
        user: users
      })
      .from(userChannels)
      .innerJoin(users, eq(userChannels.userId, users.id))
      .where(eq(userChannels.channelId, channelId))
      .orderBy(users.firstName);
    
    return members.map(({ user }) => user);
  }

  async getChannelMemberDetails(channelId: string): Promise<(User & { memberSince?: Date })[]> {
    const members = await db
      .select({
        user: users,
        joinedAt: userChannels.joinedAt
      })
      .from(userChannels)
      .innerJoin(users, eq(userChannels.userId, users.id))
      .where(eq(userChannels.channelId, channelId))
      .orderBy(users.firstName);
    
    return members.map(({ user, joinedAt }) => ({
      ...user,
      memberSince: joinedAt
    }));
  }

  // Search method implementations
  async searchMessages(query: string, filters?: {
    channelId?: string;
    senderId?: string;
    dateFrom?: Date;
    dateTo?: Date;
    hasFile?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ messages: (Message | DirectMessage)[], total: number }> {
    const limit = filters?.limit || 20;
    const offset = filters?.offset || 0;
    
    // Parse search operators from query
    let cleanQuery = query;
    let fromUser: string | null = null;
    let inChannel: string | null = null;
    let hasFile: boolean = filters?.hasFile || false;
    let hasLink = false;
    
    // Extract search operators
    const fromMatch = query.match(/from:@?(\S+)/);
    if (fromMatch) {
      fromUser = fromMatch[1];
      cleanQuery = cleanQuery.replace(fromMatch[0], '').trim();
    }
    
    const inMatch = query.match(/in:#?(\S+)/);
    if (inMatch) {
      inChannel = inMatch[1];
      cleanQuery = cleanQuery.replace(inMatch[0], '').trim();
    }
    
    if (query.includes('has:file')) {
      hasFile = true;
      cleanQuery = cleanQuery.replace(/has:file/g, '').trim();
    }
    
    if (query.includes('has:link')) {
      hasLink = true;
      cleanQuery = cleanQuery.replace(/has:link/g, '').trim();
    }
    
    // Build conditions for channel messages
    const channelConditions = [];
    if (cleanQuery) {
      channelConditions.push(
        sql`(LOWER(${messages.content}) LIKE LOWER('%' || ${cleanQuery} || '%') OR 
             LOWER(${messages.formattedContent}) LIKE LOWER('%' || ${cleanQuery} || '%'))`
      );
    }
    if (filters?.channelId || inChannel) {
      const targetChannel = filters?.channelId || inChannel;
      channelConditions.push(eq(messages.channelId, targetChannel!));
    }
    if (filters?.senderId || fromUser) {
      const targetSender = filters?.senderId || fromUser;
      channelConditions.push(eq(messages.userId, targetSender!));
    }
    if (hasFile) {
      channelConditions.push(sql`${messages.fileUrl} IS NOT NULL`);
    }
    if (hasLink) {
      channelConditions.push(
        sql`(${messages.content} LIKE '%http%' OR ${messages.formattedContent} LIKE '%http%')`
      );
    }
    if (filters?.dateFrom) {
      channelConditions.push(sql`${messages.createdAt} >= ${filters.dateFrom}`);
    }
    if (filters?.dateTo) {
      channelConditions.push(sql`${messages.createdAt} <= ${filters.dateTo}`);
    }
    
    // Build conditions for direct messages
    const dmConditions = [];
    if (cleanQuery) {
      dmConditions.push(
        sql`(LOWER(${directMessages.content}) LIKE LOWER('%' || ${cleanQuery} || '%') OR 
             LOWER(${directMessages.formattedContent}) LIKE LOWER('%' || ${cleanQuery} || '%'))`
      );
    }
    if (filters?.senderId || fromUser) {
      const targetSender = filters?.senderId || fromUser;
      dmConditions.push(eq(directMessages.senderId, targetSender!));
    }
    if (hasFile) {
      dmConditions.push(sql`${directMessages.fileUrl} IS NOT NULL`);
    }
    if (hasLink) {
      dmConditions.push(
        sql`(${directMessages.content} LIKE '%http%' OR ${directMessages.formattedContent} LIKE '%http%')`
      );
    }
    if (filters?.dateFrom) {
      dmConditions.push(sql`${directMessages.createdAt} >= ${filters.dateFrom}`);
    }
    if (filters?.dateTo) {
      dmConditions.push(sql`${directMessages.createdAt} <= ${filters.dateTo}`);
    }
    
    // Search channel messages (only if not explicitly searching in DMs)
    let channelMessages: any[] = [];
    let channelTotal = 0;
    
    if (!inChannel || inChannel !== 'dm') {
      const channelQuery = db
        .select({
          message: messages,
          sender: users
        })
        .from(messages)
        .leftJoin(users, eq(messages.userId, users.id));
      
      if (channelConditions.length > 0) {
        channelQuery.where(and(...channelConditions));
      }
      
      channelMessages = await channelQuery
        .orderBy(desc(messages.createdAt))
        .limit(limit)
        .offset(offset);
      
      // Get total count
      const [channelCountResult] = await db
        .select({ count: count() })
        .from(messages)
        .where(channelConditions.length > 0 ? and(...channelConditions) : undefined);
      
      channelTotal = channelCountResult?.count || 0;
    }
    
    // Search direct messages (only if not explicitly searching in channels)
    let dmMessages: any[] = [];
    let dmTotal = 0;
    
    if (!inChannel || inChannel === 'dm') {
      const dmQuery = db
        .select({
          message: directMessages,
          sender: users
        })
        .from(directMessages)
        .leftJoin(users, eq(directMessages.senderId, users.id));
      
      if (dmConditions.length > 0) {
        dmQuery.where(and(...dmConditions));
      }
      
      dmMessages = await dmQuery
        .orderBy(desc(directMessages.createdAt))
        .limit(limit)
        .offset(offset);
      
      // Get total count
      const [dmCountResult] = await db
        .select({ count: count() })
        .from(directMessages)
        .where(dmConditions.length > 0 ? and(...dmConditions) : undefined);
      
      dmTotal = dmCountResult?.count || 0;
    }
    
    // Combine and format results
    const allMessages = [
      ...channelMessages.map(({ message, sender }) => ({
        ...message,
        sender: sender || undefined,
        type: 'channel' as const
      })),
      ...dmMessages.map(({ message, sender }) => ({
        ...message,
        sender: sender || undefined,
        type: 'dm' as const
      }))
    ];
    
    // Sort by date and apply limit
    allMessages.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const paginatedMessages = allMessages.slice(0, limit);
    
    return {
      messages: paginatedMessages,
      total: channelTotal + dmTotal
    };
  }
  
  async searchFiles(query: string, filters?: {
    channelId?: string;
    senderId?: string;
    dateFrom?: Date;
    dateTo?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ files: FileUpload[], total: number }> {
    const limit = filters?.limit || 20;
    const offset = filters?.offset || 0;
    
    // Build search conditions
    const conditions = [];
    
    if (query) {
      conditions.push(
        sql`(LOWER(${fileUploads.fileName}) LIKE LOWER('%' || ${query} || '%') OR 
             LOWER(${fileUploads.fileType}) LIKE LOWER('%' || ${query} || '%'))`
      );
    }
    
    if (filters?.senderId) {
      conditions.push(eq(fileUploads.userId, filters.senderId));
    }
    
    if (filters?.dateFrom) {
      conditions.push(sql`${fileUploads.uploadedAt} >= ${filters.dateFrom}`);
    }
    
    if (filters?.dateTo) {
      conditions.push(sql`${fileUploads.uploadedAt} <= ${filters.dateTo}`);
    }
    
    // If channelId is provided, filter by messages in that channel
    if (filters?.channelId) {
      // Get message IDs from the channel
      const channelMessageIds = await db
        .select({ id: messages.id })
        .from(messages)
        .where(
          and(
            eq(messages.channelId, filters.channelId),
            sql`${messages.fileUrl} IS NOT NULL`
          )
        );
      
      const messageIds = channelMessageIds.map(m => m.id);
      if (messageIds.length > 0) {
        conditions.push(sql`${fileUploads.linkedToMessageId} IN (${sql.join(messageIds, sql`, `)})`);
      } else {
        // No files in this channel
        return { files: [], total: 0 };
      }
    }
    
    // Execute search query
    const filesQuery = db
      .select()
      .from(fileUploads);
    
    if (conditions.length > 0) {
      filesQuery.where(and(...conditions));
    }
    
    const files = await filesQuery
      .orderBy(desc(fileUploads.uploadedAt))
      .limit(limit)
      .offset(offset);
    
    // Get total count
    const countQuery = db
      .select({ count: count() })
      .from(fileUploads);
    
    if (conditions.length > 0) {
      countQuery.where(and(...conditions));
    }
    
    const [countResult] = await countQuery;
    const total = countResult?.count || 0;
    
    return {
      files,
      total
    };
  }
  
  async searchUsersForMessenger(query: string, limit: number = 10): Promise<User[]> {
    if (!query) {
      return [];
    }
    
    const searchPattern = `%${query}%`;
    
    // Search for users by name or email
    const results = await db
      .select()
      .from(users)
      .where(
        sql`(
          LOWER(${users.firstName}) LIKE LOWER(${searchPattern}) OR
          LOWER(${users.lastName}) LIKE LOWER(${searchPattern}) OR
          LOWER(${users.email}) LIKE LOWER(${searchPattern}) OR
          LOWER(CONCAT(${users.firstName}, ' ', ${users.lastName})) LIKE LOWER(${searchPattern})
        )`
      )
      .orderBy(users.firstName, users.lastName)
      .limit(limit);
    
    return results;
  }

  // Notification methods
  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [created] = await db.insert(notifications).values(notification).returning();
    return created;
  }

  async getUnreadNotifications(userId: string, limit: number = 50): Promise<Notification[]> {
    return db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.status, 'unread')
        )
      )
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
  }

  async getNotificationsByUser(
    userId: string, 
    limit: number = 50, 
    offset: number = 0
  ): Promise<{ notifications: Notification[], total: number }> {
    const [notificationList, countResult] = await Promise.all([
      db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, userId))
        .orderBy(desc(notifications.createdAt))
        .limit(limit)
        .offset(offset),
      
      db
        .select({ count: count() })
        .from(notifications)
        .where(eq(notifications.userId, userId))
    ]);

    return {
      notifications: notificationList,
      total: countResult[0]?.count || 0
    };
  }

  async markNotificationRead(notificationId: string): Promise<void> {
    await db
      .update(notifications)
      .set({ status: 'read', readAt: new Date() })
      .where(eq(notifications.id, notificationId));
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    await db
      .update(notifications)
      .set({ status: 'read', readAt: new Date() })
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.status, 'unread')
        )
      );
  }

  async getUnreadNotificationCounts(userId: string): Promise<{ 
    total: number;
    byChannel: { [channelId: string]: number };
    byDM: { [senderId: string]: number };
    byType: { [type: string]: number };
  }> {
    const unreadNotifs = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.status, 'unread')
        )
      );

    const result = {
      total: unreadNotifs.length,
      byChannel: {} as { [channelId: string]: number },
      byDM: {} as { [senderId: string]: number },
      byType: {} as { [type: string]: number }
    };

    unreadNotifs.forEach(notif => {
      // Count by type
      result.byType[notif.type] = (result.byType[notif.type] || 0) + 1;

      // Count by channel
      if (notif.channelId) {
        result.byChannel[notif.channelId] = (result.byChannel[notif.channelId] || 0) + 1;
      }

      // Count by DM sender
      if (notif.type === 'dm' && notif.senderId) {
        result.byDM[notif.senderId] = (result.byDM[notif.senderId] || 0) + 1;
      }
    });

    return result;
  }

  async deleteNotification(notificationId: string): Promise<void> {
    await db.delete(notifications).where(eq(notifications.id, notificationId));
  }

  async deleteOldNotifications(userId: string, daysOld: number = 30): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    await db
      .delete(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          sql`${notifications.createdAt} < ${cutoffDate}`
        )
      );
  }

  async updateUserNotificationPreferences(userId: string, preferences: any): Promise<User> {
    const [updated] = await db
      .update(users)
      .set({ notificationPreferences: preferences, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  async updateChannelLastSeen(userId: string, channelId: string): Promise<void> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (user) {
      const lastSeenChannels = (user.lastSeenChannels as any) || {};
      lastSeenChannels[channelId] = new Date().toISOString();
      
      await db
        .update(users)
        .set({ lastSeenChannels, updatedAt: new Date() })
        .where(eq(users.id, userId));
    }
  }

  async updateDMLastSeen(userId: string, senderId: string): Promise<void> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (user) {
      const lastSeenDMs = (user.lastSeenDMs as any) || {};
      lastSeenDMs[senderId] = new Date().toISOString();
      
      await db
        .update(users)
        .set({ lastSeenDMs, updatedAt: new Date() })
        .where(eq(users.id, userId));
    }
  }
}

export const storage = new DatabaseStorage();

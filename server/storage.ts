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
  channelMembers,
  channelPermissions,
  sharedChannels,
  channelJoinRequests,
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
  calls,
  callParticipants,
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
  type ChannelMember,
  type ChannelPermission,
  type SharedChannel,
  type ChannelJoinRequest,
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
  type Call,
  type CallParticipant,
  type InsertCampaign,
  type InsertCandidate,
  type InsertInterview,
  type InsertBooking,
  type InsertApifyActor,
  type InsertApifyRun,
  type InsertAuditLog,
  type InsertUser,
  type InsertChannel,
  type InsertChannelMember,
  type InsertChannelPermission,
  type InsertSharedChannel,
  type InsertChannelJoinRequest,
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
  type InsertNotification,
  type InsertCall,
  type InsertCallParticipant,
  slashCommands,
  commandHistory,
  commandPermissions,
  commandFavorites,
  reminders,
  polls,
  pollVotes,
  savedSearches,
  searchHistory,
  type SlashCommand,
  type CommandHistory,
  type CommandPermission,
  type CommandFavorite,
  type Reminder,
  type Poll,
  type PollVote,
  type SavedSearch,
  type SearchHistory,
  type InsertSlashCommand,
  type InsertCommandHistory,
  type InsertCommandPermission,
  type InsertCommandFavorite,
  type InsertReminder,
  type InsertPoll,
  type InsertPollVote,
  type InsertSavedSearch,
  type InsertSearchHistory,
  workflows,
  workflowRuns,
  workflowTemplates,
  workflowSchedules,
  type Workflow,
  type WorkflowRun,
  type WorkflowTemplate,
  type WorkflowSchedule,
  type InsertWorkflow,
  type InsertWorkflowRun,
  type InsertWorkflowTemplate,
  type InsertWorkflowSchedule
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
  updateChannel(id: string, updates: Partial<Channel>): Promise<Channel>;
  archiveChannel(id: string): Promise<Channel>;
  unarchiveChannel(id: string): Promise<Channel>;
  
  // Channel Discovery & Browse methods
  browseChannels(userId: string, filters?: {
    searchQuery?: string;
    showPrivate?: boolean;
    showArchived?: boolean;
    tier?: string;
  }): Promise<Channel[]>;
  getChannelStats(channelId: string): Promise<{
    memberCount: number;
    messageCount: number;
    lastActivityAt: Date | null;
  }>;
  
  // Enhanced Channel Membership methods (using channelMembers table)
  getChannelMembers(channelId: string): Promise<ChannelMember[]>;
  getChannelMember(channelId: string, userId: string): Promise<ChannelMember | undefined>;
  getUserChannelMemberships(userId: string): Promise<ChannelMember[]>;
  joinChannel(userId: string, channelId: string, invitedBy?: string): Promise<ChannelMember>;
  leaveChannel(userId: string, channelId: string): Promise<void>;
  updateChannelMemberRole(channelId: string, userId: string, role: string): Promise<ChannelMember>;
  addChannelMembers(channelId: string, userIds: string[], invitedBy: string): Promise<ChannelMember[]>;
  removeChannelMember(channelId: string, userId: string): Promise<void>;
  
  // Channel Join Request methods
  createChannelJoinRequest(request: InsertChannelJoinRequest): Promise<ChannelJoinRequest>;
  getChannelJoinRequests(channelId: string, status?: string): Promise<ChannelJoinRequest[]>;
  getUserJoinRequests(userId: string): Promise<ChannelJoinRequest[]>;
  reviewJoinRequest(requestId: string, status: 'approved' | 'rejected', reviewedBy: string, reviewNote?: string): Promise<ChannelJoinRequest>;
  
  // Channel Permission methods
  getChannelPermissions(channelId: string): Promise<ChannelPermission[]>;
  getChannelPermissionByRole(channelId: string, role: string): Promise<ChannelPermission | undefined>;
  createChannelPermission(permission: InsertChannelPermission): Promise<ChannelPermission>;
  updateChannelPermission(id: string, updates: Partial<ChannelPermission>): Promise<ChannelPermission>;
  getUserChannelPermissions(channelId: string, userId: string): Promise<ChannelPermission | undefined>;
  
  // Shared Channel methods
  createSharedChannel(sharedChannel: InsertSharedChannel): Promise<SharedChannel>;
  getSharedChannels(workspaceId?: string): Promise<SharedChannel[]>;
  getSharedChannelByChannelId(channelId: string): Promise<SharedChannel[]>;
  updateSharedChannel(id: string, updates: Partial<SharedChannel>): Promise<SharedChannel>;
  approveSharedChannel(id: string, approvedBy: string): Promise<SharedChannel>;
  disconnectSharedChannel(id: string, disconnectedBy: string, reason: string): Promise<SharedChannel>;
  
  // Legacy methods (kept for backward compatibility)
  getUserChannels(userId: string): Promise<UserChannel[]>;
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
  
  // Call methods
  // Call management
  getCalls(filters?: { workspaceId?: string; channelId?: string; status?: string }): Promise<Call[]>;
  getCall(id: string): Promise<Call | undefined>;
  getCallByRoomId(roomId: string): Promise<Call | undefined>;
  getActiveCalls(workspaceId: string): Promise<Call[]>;
  createCall(call: InsertCall): Promise<Call>;
  updateCall(id: string, updates: Partial<Call>): Promise<Call>;
  endCall(id: string): Promise<Call>;
  
  // Call participant methods
  getCallParticipants(callId: string): Promise<CallParticipant[]>;
  getCallParticipant(callId: string, userId: string): Promise<CallParticipant | undefined>;
  addCallParticipant(participant: InsertCallParticipant): Promise<CallParticipant>;
  updateCallParticipant(id: string, updates: Partial<CallParticipant>): Promise<CallParticipant>;
  removeCallParticipant(callId: string, userId: string): Promise<void>;
  userInCall(userId: string): Promise<Call | undefined>;
  updateCallMetrics(callId: string): Promise<Call>;
  
  // Search methods
  // Saved searches
  getSavedSearches(userId: string): Promise<SavedSearch[]>;
  getSavedSearch(id: string): Promise<SavedSearch | undefined>;
  createSavedSearch(search: InsertSavedSearch): Promise<SavedSearch>;
  updateSavedSearch(id: string, updates: Partial<SavedSearch>): Promise<SavedSearch>;
  deleteSavedSearch(id: string): Promise<void>;
  
  // Search history
  getSearchHistory(userId: string, limit?: number): Promise<SearchHistory[]>;
  createSearchHistory(history: InsertSearchHistory): Promise<SearchHistory>;
  clearSearchHistory(userId: string): Promise<void>;
  getSearchSuggestions(userId: string, query: string, limit?: number): Promise<string[]>;

  // Workflow methods
  getWorkflows(filters?: { workspaceId?: string; status?: string; createdBy?: string }): Promise<Workflow[]>;
  getWorkflow(id: string): Promise<Workflow | undefined>;
  createWorkflow(workflow: InsertWorkflow): Promise<Workflow>;
  updateWorkflow(id: string, updates: Partial<Workflow>): Promise<Workflow>;
  deleteWorkflow(id: string): Promise<void>;
  
  // Workflow run methods
  getWorkflowRuns(workflowId?: string, limit?: number): Promise<WorkflowRun[]>;
  getWorkflowRun(id: string): Promise<WorkflowRun | undefined>;
  createWorkflowRun(run: InsertWorkflowRun): Promise<WorkflowRun>;
  updateWorkflowRun(id: string, updates: Partial<WorkflowRun>): Promise<WorkflowRun>;
  
  // Workflow template methods
  getWorkflowTemplates(category?: string): Promise<WorkflowTemplate[]>;
  getWorkflowTemplate(id: string): Promise<WorkflowTemplate | undefined>;
  createWorkflowTemplate(template: InsertWorkflowTemplate): Promise<WorkflowTemplate>;
  updateWorkflowTemplate(id: string, updates: Partial<WorkflowTemplate>): Promise<WorkflowTemplate>;
  
  // Workflow schedule methods
  getWorkflowSchedules(workflowId?: string): Promise<WorkflowSchedule[]>;
  getWorkflowSchedule(id: string): Promise<WorkflowSchedule | undefined>;
  getActiveSchedules(): Promise<WorkflowSchedule[]>;
  createWorkflowSchedule(schedule: InsertWorkflowSchedule): Promise<WorkflowSchedule>;
  updateWorkflowSchedule(id: string, updates: Partial<WorkflowSchedule>): Promise<WorkflowSchedule>;
  deleteWorkflowSchedule(id: string): Promise<void>;

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
    try {
      console.log('[Storage] upsertUser called with:', {
        id: userData.id,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName
      });

      // Filter out undefined values to avoid database errors
      const cleanData = Object.fromEntries(
        Object.entries(userData).filter(([_, v]) => v !== undefined)
      ) as Partial<UpsertUser>;

      // First try to find existing user by email if email is provided
      const existingByEmail = userData.email ? await this.getUserByEmail(userData.email) : null;

      if (existingByEmail && existingByEmail.id !== userData.id) {
        // User exists with this email but different ID - update the existing one
        console.log('[Storage] Updating existing user by email:', existingByEmail.id);
        const [updated] = await db
          .update(users)
          .set({ ...cleanData, id: existingByEmail.id, updatedAt: new Date() })
          .where(eq(users.id, existingByEmail.id))
          .returning();
        return updated;
      }

      // Otherwise do normal upsert by ID
      console.log('[Storage] Performing upsert by ID:', userData.id);
      const [user] = await db
        .insert(users)
        .values({ ...cleanData, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: users.id,
          set: { ...cleanData, updatedAt: new Date() }
        })
        .returning();

      console.log('[Storage] User upserted successfully:', user.id);
      return user;
    } catch (error: any) {
      console.error('[Storage] upsertUser error:', {
        message: error.message,
        code: error.code,
        detail: error.detail,
        stack: error.stack
      });
      throw error;
    }
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

  async updateChannel(id: string, updates: Partial<Channel>): Promise<Channel> {
    const [updated] = await db
      .update(channels)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(channels.id, id))
      .returning();
    return updated;
  }

  async archiveChannel(id: string): Promise<Channel> {
    const [archived] = await db
      .update(channels)
      .set({ isArchived: true, updatedAt: new Date() })
      .where(eq(channels.id, id))
      .returning();
    return archived;
  }

  async unarchiveChannel(id: string): Promise<Channel> {
    const [unarchived] = await db
      .update(channels)
      .set({ isArchived: false, updatedAt: new Date() })
      .where(eq(channels.id, id))
      .returning();
    return unarchived;
  }

  // Channel Discovery & Browse methods
  async browseChannels(userId: string, filters?: {
    searchQuery?: string;
    showPrivate?: boolean;
    showArchived?: boolean;
    tier?: string;
  }): Promise<Channel[]> {
    let query = db.select().from(channels);
    
    // Filter conditions
    const conditions = [];
    
    // Default: don't show archived unless specifically requested
    if (!filters?.showArchived) {
      conditions.push(sql`${channels.isArchived} = false`);
    }
    
    // Filter by search query
    if (filters?.searchQuery) {
      conditions.push(
        sql`(
          LOWER(${channels.name}) LIKE LOWER(${'%' + filters.searchQuery + '%'}) OR 
          LOWER(${channels.description}) LIKE LOWER(${'%' + filters.searchQuery + '%'}) OR
          LOWER(${channels.purpose}) LIKE LOWER(${'%' + filters.searchQuery + '%'})
        )`
      );
    }
    
    // Filter by tier
    if (filters?.tier) {
      conditions.push(eq(channels.tier, filters.tier as any));
    }
    
    // Handle private channel visibility
    if (!filters?.showPrivate) {
      // Only show public channels and private channels the user is a member of
      const userMemberships = await db
        .select({ channelId: channelMembers.channelId })
        .from(channelMembers)
        .where(eq(channelMembers.userId, userId));
      
      const memberChannelIds = userMemberships.map(m => m.channelId);
      
      if (memberChannelIds.length > 0) {
        conditions.push(
          sql`(${channels.isPrivate} = false OR ${channels.id} IN (${sql.join(memberChannelIds.map(id => sql`${id}`), sql`, `)}))`
        );
      } else {
        conditions.push(sql`${channels.isPrivate} = false`);
      }
    }
    
    // Apply all conditions
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return await query.orderBy(desc(channels.lastActivityAt), desc(channels.createdAt));
  }

  async getChannelStats(channelId: string): Promise<{
    memberCount: number;
    messageCount: number;
    lastActivityAt: Date | null;
  }> {
    // Get member count
    const [memberResult] = await db
      .select({ count: count() })
      .from(channelMembers)
      .where(eq(channelMembers.channelId, channelId));
    
    // Get message count
    const [messageResult] = await db
      .select({ count: count() })
      .from(messages)
      .where(eq(messages.channelId, channelId));
    
    // Get channel info for last activity
    const [channel] = await db
      .select({ lastActivityAt: channels.lastActivityAt })
      .from(channels)
      .where(eq(channels.id, channelId));
    
    return {
      memberCount: Number(memberResult?.count || 0),
      messageCount: Number(messageResult?.count || 0),
      lastActivityAt: channel?.lastActivityAt || null
    };
  }

  // Enhanced Channel Membership methods (using channelMembers table)
  async getChannelMembers(channelId: string): Promise<ChannelMember[]> {
    return await db
      .select()
      .from(channelMembers)
      .where(eq(channelMembers.channelId, channelId))
      .orderBy(channelMembers.joinedAt);
  }

  async getChannelMember(channelId: string, userId: string): Promise<ChannelMember | undefined> {
    const [member] = await db
      .select()
      .from(channelMembers)
      .where(
        and(
          eq(channelMembers.channelId, channelId),
          eq(channelMembers.userId, userId)
        )
      );
    return member || undefined;
  }

  async getUserChannelMemberships(userId: string): Promise<ChannelMember[]> {
    return await db
      .select()
      .from(channelMembers)
      .where(eq(channelMembers.userId, userId))
      .orderBy(channelMembers.joinedAt);
  }

  async joinChannel(userId: string, channelId: string, invitedBy?: string): Promise<ChannelMember> {
    const [joined] = await db
      .insert(channelMembers)
      .values({ userId, channelId, invitedBy, role: 'member' })
      .onConflictDoUpdate({
        target: [channelMembers.userId, channelMembers.channelId],
        set: { canAccess: true, leftAt: null }
      })
      .returning();
    
    // Update channel member count
    await this.updateChannelMemberCount(channelId);
    
    return joined;
  }

  async leaveChannel(userId: string, channelId: string): Promise<void> {
    await db
      .update(channelMembers)
      .set({ canAccess: false, leftAt: new Date() })
      .where(
        and(
          eq(channelMembers.userId, userId),
          eq(channelMembers.channelId, channelId)
        )
      );
    
    // Update channel member count
    await this.updateChannelMemberCount(channelId);
  }

  async updateChannelMemberRole(channelId: string, userId: string, role: string): Promise<ChannelMember> {
    const [updated] = await db
      .update(channelMembers)
      .set({ role })
      .where(
        and(
          eq(channelMembers.channelId, channelId),
          eq(channelMembers.userId, userId)
        )
      )
      .returning();
    return updated;
  }

  async addChannelMembers(channelId: string, userIds: string[], invitedBy: string): Promise<ChannelMember[]> {
    const membersToAdd = userIds.map(userId => ({
      userId,
      channelId,
      invitedBy,
      role: 'member' as const
    }));
    
    const added = await db
      .insert(channelMembers)
      .values(membersToAdd)
      .onConflictDoNothing()
      .returning();
    
    // Update channel member count
    await this.updateChannelMemberCount(channelId);
    
    return added;
  }

  async removeChannelMember(channelId: string, userId: string): Promise<void> {
    await db
      .delete(channelMembers)
      .where(
        and(
          eq(channelMembers.channelId, channelId),
          eq(channelMembers.userId, userId)
        )
      );
    
    // Update channel member count
    await this.updateChannelMemberCount(channelId);
  }

  // Helper method to update channel member count
  private async updateChannelMemberCount(channelId: string): Promise<void> {
    const [result] = await db
      .select({ count: count() })
      .from(channelMembers)
      .where(
        and(
          eq(channelMembers.channelId, channelId),
          eq(channelMembers.canAccess, true)
        )
      );
    
    await db
      .update(channels)
      .set({ 
        memberCount: Number(result?.count || 0),
        updatedAt: new Date()
      })
      .where(eq(channels.id, channelId));
  }

  // Channel Join Request methods
  async createChannelJoinRequest(request: InsertChannelJoinRequest): Promise<ChannelJoinRequest> {
    const [created] = await db
      .insert(channelJoinRequests)
      .values(request)
      .returning();
    return created;
  }

  async getChannelJoinRequests(channelId: string, status?: string): Promise<ChannelJoinRequest[]> {
    let query = db
      .select()
      .from(channelJoinRequests)
      .where(eq(channelJoinRequests.channelId, channelId));
    
    if (status) {
      query = query.where(eq(channelJoinRequests.status, status)) as any;
    }
    
    return await query.orderBy(desc(channelJoinRequests.createdAt));
  }

  async getUserJoinRequests(userId: string): Promise<ChannelJoinRequest[]> {
    return await db
      .select()
      .from(channelJoinRequests)
      .where(eq(channelJoinRequests.userId, userId))
      .orderBy(desc(channelJoinRequests.createdAt));
  }

  async reviewJoinRequest(requestId: string, status: 'approved' | 'rejected', reviewedBy: string, reviewNote?: string): Promise<ChannelJoinRequest> {
    const [updated] = await db
      .update(channelJoinRequests)
      .set({
        status,
        reviewedBy,
        reviewedAt: new Date(),
        reviewNote,
        updatedAt: new Date()
      })
      .where(eq(channelJoinRequests.id, requestId))
      .returning();
    
    // If approved, add user to channel
    if (status === 'approved') {
      await this.joinChannel(updated.userId, updated.channelId, reviewedBy);
    }
    
    return updated;
  }

  // Channel Permission methods
  async getChannelPermissions(channelId: string): Promise<ChannelPermission[]> {
    return await db
      .select()
      .from(channelPermissions)
      .where(eq(channelPermissions.channelId, channelId));
  }

  async getChannelPermissionByRole(channelId: string, role: string): Promise<ChannelPermission | undefined> {
    const [permission] = await db
      .select()
      .from(channelPermissions)
      .where(
        and(
          eq(channelPermissions.channelId, channelId),
          eq(channelPermissions.role, role)
        )
      );
    return permission || undefined;
  }

  async createChannelPermission(permission: InsertChannelPermission): Promise<ChannelPermission> {
    const [created] = await db
      .insert(channelPermissions)
      .values(permission)
      .returning();
    return created;
  }

  async updateChannelPermission(id: string, updates: Partial<ChannelPermission>): Promise<ChannelPermission> {
    const [updated] = await db
      .update(channelPermissions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(channelPermissions.id, id))
      .returning();
    return updated;
  }

  async getUserChannelPermissions(channelId: string, userId: string): Promise<ChannelPermission | undefined> {
    // Get user's role in the channel
    const member = await this.getChannelMember(channelId, userId);
    if (!member) return undefined;
    
    // Get permissions for that role
    return await this.getChannelPermissionByRole(channelId, member.role);
  }

  // Shared Channel methods
  async createSharedChannel(sharedChannel: InsertSharedChannel): Promise<SharedChannel> {
    const [created] = await db
      .insert(sharedChannels)
      .values(sharedChannel)
      .returning();
    return created;
  }

  async getSharedChannels(workspaceId?: string): Promise<SharedChannel[]> {
    let query = db.select().from(sharedChannels);
    
    if (workspaceId) {
      query = query.where(eq(sharedChannels.externalWorkspaceId, workspaceId)) as any;
    }
    
    return await query.orderBy(desc(sharedChannels.createdAt));
  }

  async getSharedChannelByChannelId(channelId: string): Promise<SharedChannel[]> {
    return await db
      .select()
      .from(sharedChannels)
      .where(eq(sharedChannels.channelId, channelId))
      .orderBy(desc(sharedChannels.createdAt));
  }

  async updateSharedChannel(id: string, updates: Partial<SharedChannel>): Promise<SharedChannel> {
    const [updated] = await db
      .update(sharedChannels)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(sharedChannels.id, id))
      .returning();
    return updated;
  }

  async approveSharedChannel(id: string, approvedBy: string): Promise<SharedChannel> {
    const [approved] = await db
      .update(sharedChannels)
      .set({
        connectionStatus: 'active',
        approvedBy,
        approvedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(sharedChannels.id, id))
      .returning();
    return approved;
  }

  async disconnectSharedChannel(id: string, disconnectedBy: string, reason: string): Promise<SharedChannel> {
    const [disconnected] = await db
      .update(sharedChannels)
      .set({
        connectionStatus: 'disconnected',
        disconnectedBy,
        disconnectedAt: new Date(),
        disconnectionReason: reason,
        updatedAt: new Date()
      })
      .where(eq(sharedChannels.id, id))
      .returning();
    return disconnected;
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

  // Call methods implementation
  async getCalls(filters?: { workspaceId?: string; channelId?: string; status?: string }): Promise<Call[]> {
    let query = db.select().from(calls);
    
    const conditions = [];
    if (filters?.workspaceId) {
      conditions.push(eq(calls.workspaceId, filters.workspaceId));
    }
    if (filters?.channelId) {
      conditions.push(eq(calls.channelId, filters.channelId));
    }
    if (filters?.status) {
      conditions.push(eq(calls.status, filters.status as any));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    return query.orderBy(desc(calls.startedAt));
  }

  async getCall(id: string): Promise<Call | undefined> {
    const [call] = await db.select().from(calls).where(eq(calls.id, id));
    return call || undefined;
  }

  async getCallByRoomId(roomId: string): Promise<Call | undefined> {
    const [call] = await db.select().from(calls).where(eq(calls.roomId, roomId));
    return call || undefined;
  }

  async getActiveCalls(workspaceId: string): Promise<Call[]> {
    return db
      .select()
      .from(calls)
      .where(
        and(
          eq(calls.workspaceId, workspaceId),
          eq(calls.status, 'active')
        )
      )
      .orderBy(desc(calls.startedAt));
  }

  async createCall(call: InsertCall): Promise<Call> {
    // Generate a unique room ID
    const roomId = call.roomId || `room_${crypto.randomBytes(16).toString('hex')}`;
    
    const [created] = await db
      .insert(calls)
      .values({
        ...call,
        roomId,
        stunServers: call.stunServers || [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ],
        turnServers: call.turnServers || []
      })
      .returning();
    return created;
  }

  async updateCall(id: string, updates: Partial<Call>): Promise<Call> {
    const [updated] = await db
      .update(calls)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(calls.id, id))
      .returning();
    return updated;
  }

  async endCall(id: string): Promise<Call> {
    const call = await this.getCall(id);
    if (!call) {
      throw new Error('Call not found');
    }
    
    const endedAt = new Date();
    const totalDuration = Math.floor((endedAt.getTime() - new Date(call.startedAt).getTime()) / 1000);
    
    const [ended] = await db
      .update(calls)
      .set({ 
        status: 'ended', 
        endedAt, 
        totalDuration,
        updatedAt: new Date() 
      })
      .where(eq(calls.id, id))
      .returning();
      
    // Mark all participants as left
    await db
      .update(callParticipants)
      .set({ 
        status: 'disconnected', 
        leftAt: endedAt,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(callParticipants.callId, id),
          sql`${callParticipants.leftAt} IS NULL`
        )
      );
    
    return ended;
  }

  async getCallParticipants(callId: string): Promise<CallParticipant[]> {
    return db
      .select()
      .from(callParticipants)
      .where(eq(callParticipants.callId, callId))
      .orderBy(callParticipants.joinedAt);
  }

  async getCallParticipant(callId: string, userId: string): Promise<CallParticipant | undefined> {
    const [participant] = await db
      .select()
      .from(callParticipants)
      .where(
        and(
          eq(callParticipants.callId, callId),
          eq(callParticipants.userId, userId)
        )
      );
    return participant || undefined;
  }

  async addCallParticipant(participant: InsertCallParticipant): Promise<CallParticipant> {
    // Check if participant already exists
    const existing = await this.getCallParticipant(participant.callId, participant.userId);
    if (existing) {
      // Update existing participant
      return this.updateCallParticipant(existing.id, {
        status: 'connected',
        joinedAt: new Date(),
        leftAt: null
      });
    }
    
    const [created] = await db
      .insert(callParticipants)
      .values(participant)
      .returning();
      
    // Update peak participants count
    await this.updateCallMetrics(participant.callId);
    
    return created;
  }

  async updateCallParticipant(id: string, updates: Partial<CallParticipant>): Promise<CallParticipant> {
    const [updated] = await db
      .update(callParticipants)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(callParticipants.id, id))
      .returning();
    return updated;
  }

  async removeCallParticipant(callId: string, userId: string): Promise<void> {
    await db
      .update(callParticipants)
      .set({ 
        status: 'disconnected', 
        leftAt: new Date(),
        updatedAt: new Date()
      })
      .where(
        and(
          eq(callParticipants.callId, callId),
          eq(callParticipants.userId, userId)
        )
      );
      
    // Update peak participants count
    await this.updateCallMetrics(callId);
  }

  async userInCall(userId: string): Promise<Call | undefined> {
    const [result] = await db
      .select({ call: calls })
      .from(callParticipants)
      .innerJoin(calls, eq(callParticipants.callId, calls.id))
      .where(
        and(
          eq(callParticipants.userId, userId),
          eq(callParticipants.status, 'connected'),
          eq(calls.status, 'active')
        )
      );
    return result?.call || undefined;
  }

  async updateCallMetrics(callId: string): Promise<Call> {
    const participants = await this.getCallParticipants(callId);
    const connectedCount = participants.filter(p => p.status === 'connected').length;
    
    const [call] = await db
      .select()
      .from(calls)
      .where(eq(calls.id, callId));
      
    if (call && connectedCount > (call.peakParticipants || 0)) {
      const [updated] = await db
        .update(calls)
        .set({ 
          peakParticipants: connectedCount,
          updatedAt: new Date()
        })
        .where(eq(calls.id, callId))
        .returning();
      return updated;
    }
    
    return call;
  }

  // Search methods implementation
  async getSavedSearches(userId: string): Promise<SavedSearch[]> {
    return db
      .select()
      .from(savedSearches)
      .where(eq(savedSearches.userId, userId))
      .orderBy(desc(savedSearches.isPinned), desc(savedSearches.lastUsedAt));
  }

  async getSavedSearch(id: string): Promise<SavedSearch | undefined> {
    const [search] = await db
      .select()
      .from(savedSearches)
      .where(eq(savedSearches.id, id));
    return search || undefined;
  }

  async createSavedSearch(search: InsertSavedSearch): Promise<SavedSearch> {
    const [created] = await db
      .insert(savedSearches)
      .values(search)
      .returning();
    return created;
  }

  async updateSavedSearch(id: string, updates: Partial<SavedSearch>): Promise<SavedSearch> {
    const [updated] = await db
      .update(savedSearches)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(savedSearches.id, id))
      .returning();
    return updated;
  }

  async deleteSavedSearch(id: string): Promise<void> {
    await db.delete(savedSearches).where(eq(savedSearches.id, id));
  }

  async getSearchHistory(userId: string, limit: number = 20): Promise<SearchHistory[]> {
    return db
      .select()
      .from(searchHistory)
      .where(eq(searchHistory.userId, userId))
      .orderBy(desc(searchHistory.createdAt))
      .limit(limit);
  }

  async createSearchHistory(history: InsertSearchHistory): Promise<SearchHistory> {
    const [created] = await db
      .insert(searchHistory)
      .values(history)
      .returning();
    return created;
  }

  async clearSearchHistory(userId: string): Promise<void> {
    await db.delete(searchHistory).where(eq(searchHistory.userId, userId));
  }

  async getSearchSuggestions(userId: string, query: string, limit: number = 10): Promise<string[]> {
    // Get recent search queries that match
    const pattern = `${query}%`;
    const results = await db
      .selectDistinct({ query: searchHistory.query })
      .from(searchHistory)
      .where(
        and(
          eq(searchHistory.userId, userId),
          sql`LOWER(${searchHistory.query}) LIKE LOWER(${pattern})`
        )
      )
      .orderBy(desc(searchHistory.createdAt))
      .limit(limit);
    
    return results.map(r => r.query);
  }

  // Workflow methods implementation
  async getWorkflows(filters?: { workspaceId?: string; status?: string; createdBy?: string }): Promise<Workflow[]> {
    let query = db.select().from(workflows);
    
    const conditions = [];
    if (filters?.workspaceId) {
      conditions.push(eq(workflows.workspaceId, filters.workspaceId));
    }
    if (filters?.status) {
      conditions.push(eq(workflows.status, filters.status));
    }
    if (filters?.createdBy) {
      conditions.push(eq(workflows.createdBy, filters.createdBy));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    return query.orderBy(desc(workflows.createdAt));
  }

  async getWorkflow(id: string): Promise<Workflow | undefined> {
    const [workflow] = await db
      .select()
      .from(workflows)
      .where(eq(workflows.id, id));
    return workflow || undefined;
  }

  async createWorkflow(workflow: InsertWorkflow): Promise<Workflow> {
    const [created] = await db
      .insert(workflows)
      .values(workflow)
      .returning();
    return created;
  }

  async updateWorkflow(id: string, updates: Partial<Workflow>): Promise<Workflow> {
    const [updated] = await db
      .update(workflows)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(workflows.id, id))
      .returning();
    return updated;
  }

  async deleteWorkflow(id: string): Promise<void> {
    await db.delete(workflows).where(eq(workflows.id, id));
  }

  // Workflow run methods implementation
  async getWorkflowRuns(workflowId?: string, limit: number = 50): Promise<WorkflowRun[]> {
    let query = db.select().from(workflowRuns);
    
    if (workflowId) {
      query = query.where(eq(workflowRuns.workflowId, workflowId));
    }
    
    return query
      .orderBy(desc(workflowRuns.createdAt))
      .limit(limit);
  }

  async getWorkflowRun(id: string): Promise<WorkflowRun | undefined> {
    const [run] = await db
      .select()
      .from(workflowRuns)
      .where(eq(workflowRuns.id, id));
    return run || undefined;
  }

  async createWorkflowRun(run: InsertWorkflowRun): Promise<WorkflowRun> {
    const [created] = await db
      .insert(workflowRuns)
      .values(run)
      .returning();
    return created;
  }

  async updateWorkflowRun(id: string, updates: Partial<WorkflowRun>): Promise<WorkflowRun> {
    const [updated] = await db
      .update(workflowRuns)
      .set(updates)
      .where(eq(workflowRuns.id, id))
      .returning();
    return updated;
  }

  // Workflow template methods implementation
  async getWorkflowTemplates(category?: string): Promise<WorkflowTemplate[]> {
    let query = db.select().from(workflowTemplates);
    
    if (category) {
      query = query.where(eq(workflowTemplates.category, category));
    }
    
    return query
      .orderBy(desc(workflowTemplates.usageCount), workflowTemplates.name);
  }

  async getWorkflowTemplate(id: string): Promise<WorkflowTemplate | undefined> {
    const [template] = await db
      .select()
      .from(workflowTemplates)
      .where(eq(workflowTemplates.id, id));
    return template || undefined;
  }

  async createWorkflowTemplate(template: InsertWorkflowTemplate): Promise<WorkflowTemplate> {
    const [created] = await db
      .insert(workflowTemplates)
      .values(template)
      .returning();
    return created;
  }

  async updateWorkflowTemplate(id: string, updates: Partial<WorkflowTemplate>): Promise<WorkflowTemplate> {
    const [updated] = await db
      .update(workflowTemplates)
      .set(updates)
      .where(eq(workflowTemplates.id, id))
      .returning();
    return updated;
  }

  // Workflow schedule methods implementation
  async getWorkflowSchedules(workflowId?: string): Promise<WorkflowSchedule[]> {
    let query = db.select().from(workflowSchedules);
    
    if (workflowId) {
      query = query.where(eq(workflowSchedules.workflowId, workflowId));
    }
    
    return query.orderBy(workflowSchedules.nextRunAt);
  }

  async getWorkflowSchedule(id: string): Promise<WorkflowSchedule | undefined> {
    const [schedule] = await db
      .select()
      .from(workflowSchedules)
      .where(eq(workflowSchedules.id, id));
    return schedule || undefined;
  }

  async getActiveSchedules(): Promise<WorkflowSchedule[]> {
    return db
      .select()
      .from(workflowSchedules)
      .where(
        and(
          eq(workflowSchedules.isActive, true),
          sql`${workflowSchedules.nextRunAt} <= NOW()`
        )
      )
      .orderBy(workflowSchedules.nextRunAt);
  }

  async createWorkflowSchedule(schedule: InsertWorkflowSchedule): Promise<WorkflowSchedule> {
    const [created] = await db
      .insert(workflowSchedules)
      .values(schedule)
      .returning();
    return created;
  }

  async updateWorkflowSchedule(id: string, updates: Partial<WorkflowSchedule>): Promise<WorkflowSchedule> {
    const [updated] = await db
      .update(workflowSchedules)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(workflowSchedules.id, id))
      .returning();
    return updated;
  }

  async deleteWorkflowSchedule(id: string): Promise<void> {
    await db.delete(workflowSchedules).where(eq(workflowSchedules.id, id));
  }
}

export const storage = new DatabaseStorage();

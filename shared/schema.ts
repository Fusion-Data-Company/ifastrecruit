import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, jsonb, pgEnum, boolean, unique, real, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const campaignSourceEnum = pgEnum("campaign_source", ["APIFY", "MANUAL"]);
export const pipelineStageEnum = pgEnum("pipeline_stage", [
  "NEW", "FIRST_INTERVIEW", "TECHNICAL_SCREEN", "FINAL_INTERVIEW", "OFFER", "HIRED", "REJECTED"
]);
export const bookingStatusEnum = pgEnum("booking_status", ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"]);

// Messenger Enums
export const channelTierEnum = pgEnum("channel_tier", ["NON_LICENSED", "FL_LICENSED", "MULTI_STATE"]);
export const messageTypeEnum = pgEnum("message_type", ["text", "file", "system"]);
export const fileStatusEnum = pgEnum("file_status", ["pending", "processing", "parsed", "failed"]);

// Call Enums
export const callTypeEnum = pgEnum("call_type", ["voice", "video", "huddle", "screen_share"]);
export const callStatusEnum = pgEnum("call_status", ["pending", "active", "ended", "cancelled", "failed"]);
export const participantStatusEnum = pgEnum("participant_status", ["invited", "connecting", "connected", "disconnected", "rejected"]);

// Jason AI Enums
export const templateTypeEnum = pgEnum("template_type", ["welcome", "qa", "resume", "career", "general"]);
export const responseFrequencyEnum = pgEnum("response_frequency", ["always", "sometimes", "only_when_mentioned", "never"]);

// Notification Enums
export const notificationTypeEnum = pgEnum("notification_type", ["message", "mention", "dm", "thread_reply"]);
export const notificationStatusEnum = pgEnum("notification_status", ["unread", "read"]);

// Slash Command Enums
export const commandTypeEnum = pgEnum("command_type", ["builtin", "custom", "webhook"]);
export const commandPermissionLevelEnum = pgEnum("command_permission_level", ["all", "admin", "channel_admin", "custom"]);
export const commandContextEnum = pgEnum("command_context", ["channel", "dm", "both"]);

// Search Enums
export const searchScopeEnum = pgEnum("search_scope", ["all", "messages", "files", "channels", "users"]);
export const searchResultTypeEnum = pgEnum("search_result_type", ["message", "file", "channel", "user", "dm"]);

// Security & Compliance Enums
export const auditActionTypeEnum = pgEnum("audit_action_type", [
  "user_login", "user_logout", "user_login_failed",
  "sso_login", "sso_config_changed", 
  "2fa_enabled", "2fa_disabled", "2fa_verified", "2fa_failed",
  "password_changed", "password_reset",
  "data_accessed", "data_exported", "data_deleted",
  "settings_changed", "permissions_changed",
  "file_uploaded", "file_downloaded", "file_deleted",
  "message_sent", "message_edited", "message_deleted",
  "channel_created", "channel_deleted", "channel_joined", "channel_left",
  "user_created", "user_updated", "user_deleted", "user_suspended",
  "api_key_created", "api_key_revoked",
  "security_policy_changed", "compliance_export",
  "suspicious_activity", "rate_limit_exceeded"
]);
export const ssoProviderTypeEnum = pgEnum("sso_provider_type", [
  "saml", "google", "microsoft", "okta", "onelogin", "ping", "custom"
]);
export const tfaMethodEnum = pgEnum("tfa_method", ["totp", "sms", "email", "backup_codes"]);
export const dataRetentionPolicyEnum = pgEnum("data_retention_policy", [
  "30_days", "60_days", "90_days", "180_days", "365_days", "730_days", "indefinite", "custom"
]);
export const complianceStandardEnum = pgEnum("compliance_standard", [
  "gdpr", "hipaa", "sox", "pci_dss", "iso_27001", "ccpa", "fedramp"
]);
export const securityAlertSeverityEnum = pgEnum("security_alert_severity", [
  "critical", "high", "medium", "low", "info"
]);
export const ipRestrictionTypeEnum = pgEnum("ip_restriction_type", ["allowlist", "blocklist"]);

// Workflow Enums
export const workflowStatusEnum = pgEnum("workflow_status", ["active", "inactive", "draft", "archived"]);
export const workflowTriggerTypeEnum = pgEnum("workflow_trigger_type", [
  "message", "schedule", "event", "webhook", "manual", "form_submission"
]);
export const workflowActionTypeEnum = pgEnum("workflow_action_type", [
  "send_message", "create_task", "api_call", "database_update", "send_email",
  "condition", "loop", "delay", "approval_request", "assign_to_user", "update_candidate"
]);
export const workflowRunStatusEnum = pgEnum("workflow_run_status", [
  "pending", "running", "completed", "failed", "cancelled", "paused"
]);
export const workflowEventTypeEnum = pgEnum("workflow_event_type", [
  "user_joined", "file_uploaded", "form_submitted", "candidate_created", 
  "interview_scheduled", "message_received"
]);

// Tables
export const campaigns = pgTable("campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  source: campaignSourceEnum("source").notNull(),
  paramsJson: jsonb("params_json"),
  status: text("status").notNull().default("ACTIVE"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const candidates = pgTable("candidates", {
  // === CORE CANDIDATE FIELDS ===
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  pipelineStage: pipelineStageEnum("pipeline_stage").notNull().default("NEW"),
  score: integer("score").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  
  // === SOURCE & METADATA FIELDS ===
  campaignId: varchar("campaign_id").references(() => campaigns.id), // Legacy support for campaigns
  sourceRef: text("source_ref"), // Source tracking ("elevenlabs_interview", "manual", etc.)
  resumeUrl: text("resume_url"), // Uploaded resume file URL
  tags: text("tags").array().default(sql`ARRAY[]::text[]`), // Searchable tags for organization
  notes: text("notes"), // Manual notes from recruiters
  
  // === ELEVENLABS CONVERSATION DATA ===
  agentId: text("agent_id"), // ElevenLabs agent identifier
  conversationId: text("conversation_id"), // Unique conversation identifier
  interviewDate: timestamp("interview_date"), // When the conversation occurred
  callDuration: integer("call_duration_secs"), // Call duration in seconds
  messageCount: integer("message_count"), // Number of messages exchanged
  callStatus: text("call_status"), // Call completion status
  callSuccessful: text("call_successful"), // Whether call completed successfully
  agentName: text("agent_name"), // Name of the ElevenLabs agent
  audioRecordingUrl: text("audio_recording_url"), // Original ElevenLabs audio URL
  localAudioFileId: text("local_audio_file_id"), // Local file storage ID for audio recording
  localTranscriptFileId: text("local_transcript_file_id"), // Local file storage ID for transcript
  
  // === INTERVIEW CONTENT & ANALYSIS ===
  interviewTranscript: text("interview_transcript"), // Full conversation transcript
  transcriptSummary: text("transcript_summary"), // AI-generated summary
  callSummaryTitle: text("call_summary_title"), // Brief title for the call
  interviewSummary: text("interview_summary"), // Detailed interview summary
  interviewDuration: text("interview_duration"), // Formatted duration string
  
  // === STRUCTURED INTERVIEW RESPONSES ===
  whyInsurance: text("why_insurance"), // Why candidate wants insurance career
  whyNow: text("why_now"), // Why making career change now
  salesExperience: text("sales_experience"), // Previous sales experience
  difficultCustomerStory: text("difficult_customer_story"), // How they handle difficult customers
  consultativeSelling: text("consultative_selling"), // Understanding of consultative selling
  preferredMarkets: text("preferred_markets").array().default(sql`ARRAY[]::text[]`), // Target markets of interest
  timeline: text("timeline"), // Availability timeline
  recommendedNextSteps: text("recommended_next_steps"), // AI-recommended next actions
  
  // === PERFORMANCE INDICATORS & SCORES ===
  demoCallPerformed: boolean("demo_call_performed").default(false),
  kevinPersonaUsed: boolean("kevin_persona_used").default(false),
  coachingGiven: boolean("coaching_given").default(false),
  pitchDelivered: boolean("pitch_delivered").default(false),
  
  // Individual assessment scores (0-100 scale)
  overallScore: integer("overall_score"), // Overall candidate assessment
  interviewScore: integer("interview_score"), // Legacy interview score
  communicationScore: integer("communication_score"),
  salesAptitudeScore: integer("sales_aptitude_score"),
  motivationScore: integer("motivation_score"),
  coachabilityScore: integer("coachability_score"),
  professionalPresenceScore: integer("professional_presence_score"),
  
  // === ASSESSMENT & DEVELOPMENT ===
  strengths: text("strengths").array().default(sql`ARRAY[]::text[]`), // Identified candidate strengths
  developmentAreas: text("development_areas").array().default(sql`ARRAY[]::text[]`), // Areas for improvement
  
  // === STRUCTURED DATA STORAGE ===
  interviewData: jsonb("interview_data"), // Complete raw interview data
  evaluationCriteria: jsonb("evaluation_criteria"), // Assessment criteria used
  dataCollectionResults: jsonb("data_collection_results"), // Structured data extraction results
  agentData: jsonb("agent_data"), // Comprehensive agent interaction data
  conversationMetadata: jsonb("conversation_metadata"), // Conversation-specific metadata
  evaluationDetails: jsonb("evaluation_details"), // Detailed evaluation breakdown
  interviewMetrics: jsonb("interview_metrics"), // Performance metrics and statistics
  
  // === NEW ELEVENLABS API FIELDS (v3 API) ===
  
  // Conversation Status & Core Data
  conversationStatus: text("conversation_status"), // initiated, in-progress, processing, done, failed
  elevenLabsUserId: text("elevenlabs_user_id"), // User ID from ElevenLabs
  
  // Timestamps & Duration (Metadata)
  startTimeUnixSecs: integer("start_time_unix_secs"), // Unix timestamp of call start
  endTimeUnixSecs: integer("end_time_unix_secs"), // Unix timestamp of call end
  
  // Call Cost & Billing
  cost: real("cost"), // Call cost in credits/currency
  charging: jsonb("charging"), // Charging information
  hasChargingTimerTriggered: boolean("has_charging_timer_triggered").default(false),
  hasBillingTimerTriggered: boolean("has_billing_timer_triggered").default(false),
  
  // Deletion & Feedback
  deletionSettings: jsonb("deletion_settings"), // Data deletion configuration
  feedbackScore: integer("feedback_score"), // User feedback score
  feedbackComment: text("feedback_comment"), // User feedback text
  
  // Connection & Authorization
  authorizationMethod: text("authorization_method"), // How the call was authorized
  creationMethod: text("creation_method"), // How conversation was created
  conversationMode: text("conversation_mode"), // Mode of conversation
  source: text("source"), // Source of the conversation
  channelId: text("channel_id"), // Channel identifier
  clientIp: text("client_ip"), // Client IP address
  terminationReason: text("termination_reason"), // Why conversation ended
  conversationApiVersion: text("conversation_api_version"), // API version used
  
  // Custom Data
  customLlmData: jsonb("custom_llm_data"), // Custom LLM data passed
  
  // Analysis Fields
  conversationNotes: text("conversation_notes"), // Notes from analysis
  customAnalysisData: jsonb("custom_analysis_data"), // Custom analysis results
  
  // Audio Availability Flags
  hasAudio: boolean("has_audio").default(false), // Whether audio is available
  hasUserAudio: boolean("has_user_audio").default(false), // User audio available
  hasResponseAudio: boolean("has_response_audio").default(false), // Agent audio available
  
  // Conversation Initiation Data
  conversationInitiationClientData: jsonb("conversation_initiation_client_data"), // Client data at initiation
  
  // Rich Transcript Data (stored as JSONB for complex structure)
  transcriptMessages: jsonb("transcript_messages"), // Full transcript with all message details
  
  // Word-Level Transcript Data
  wordLevelTranscript: jsonb("word_level_transcript"), // Word-by-word timing and confidence
  
  // Tool Calls & Results
  toolCalls: jsonb("tool_calls"), // All tool calls made during conversation
  toolResults: jsonb("tool_results"), // Results from tool calls
  
  // Performance Metrics
  conversationTurnMetrics: jsonb("conversation_turn_metrics"), // Turn-by-turn metrics
  messageTimings: jsonb("message_timings"), // Timing data for each message
  
  // Dynamic Variables & Configuration
  dynamicVariables: jsonb("dynamic_variables"), // Dynamic variables used
  conversationConfigOverride: jsonb("conversation_config_override"), // Config overrides
  customVoiceSettings: jsonb("custom_voice_settings"), // Voice settings used
  serverUrl: text("server_url"), // Server URL if custom
  customLlmExtraBody: jsonb("custom_llm_extra_body") // Extra LLM configuration
}, (table) => ({
  emailUnique: unique().on(table.email),
  conversationIdUnique: unique().on(table.conversationId),
}));

export const interviewStatusEnum = pgEnum("interview_status", ["scheduled", "completed", "cancelled", "no-show"]);

export const interviews = pgTable("interviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  candidateId: varchar("candidate_id").notNull().references(() => candidates.id),
  candidateEmail: text("candidate_email").notNull(),
  scheduledAt: timestamp("scheduled_at").notNull(),
  status: interviewStatusEnum("status").notNull().default("scheduled"),
  transcriptUrl: text("transcript_url"),
  summary: text("summary"),
  scorecardJson: jsonb("scorecard_json"),
  greenFlags: text("green_flags").array(),
  redFlags: text("red_flags").array(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const bookings = pgTable("bookings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  candidateId: varchar("candidate_id").notNull().references(() => candidates.id),
  startTs: timestamp("start_ts").notNull(),
  endTs: timestamp("end_ts").notNull(),
  location: text("location"),
  icsUrl: text("ics_url"),
  status: bookingStatusEnum("status").notNull().default("PENDING"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const apifyActors = pgTable("apify_actors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  actorId: text("actor_id").notNull(),
  configurationJson: jsonb("configuration_json"),
  lastRun: timestamp("last_run"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  payloadJson: jsonb("payload_json"),
  pathUsed: text("path_used"), // "api" or "airtop"
  ts: timestamp("ts").defaultNow().notNull(),
});



// Apify integration tables
export const apifyRuns = pgTable("apify_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  actorId: varchar("actor_id").notNull().references(() => apifyActors.id),
  apifyRunId: text("apify_run_id").notNull().unique(),
  status: text("status").notNull(),
  startedAt: timestamp("started_at").notNull(),
  finishedAt: timestamp("finished_at"),
  buildId: text("build_id"),
  exitCode: integer("exit_code"),
  defaultDatasetId: text("default_dataset_id"),
  keyValueStoreId: text("key_value_store_id"),
  inputJson: jsonb("input_json"),
  outputJson: jsonb("output_json"),
  statsJson: jsonb("stats_json"),
  logMessages: text("log_messages").array(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Replit Auth users table (replacing old auth system)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  // Messenger-specific fields
  isAdmin: boolean("is_admin").default(false),

  // AI Agent fields
  isAIAgent: boolean("is_ai_agent").default(false),
  aiConfig: jsonb("ai_config").$type<{
    model?: string;
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
    isActive?: boolean;
    autoRespondChannels?: string[];
    autoRespondDMs?: boolean;
  }>(),

  hasCompletedOnboarding: boolean("has_completed_onboarding").default(false),
  hasFloridaLicense: boolean("has_florida_license").default(false),
  isMultiStateLicensed: boolean("is_multi_state_licensed").default(false),
  licensedStates: text("licensed_states").array().default(sql`ARRAY[]::text[]`),
  showCalendlyButton: boolean("show_calendly_button").default(true),
  onlineStatus: text("online_status").default("offline"), // "online", "offline", "away"
  lastSeenAt: timestamp("last_seen_at"),
  // Notification preferences
  notificationPreferences: jsonb("notification_preferences").default(
    sql`'{"sound": true, "desktop": true, "email": true, "volume": 50, "soundTypes": {"message": true, "mention": true, "dm": true, "thread_reply": true}}'::jsonb`
  ),
  lastSeenChannels: jsonb("last_seen_channels").default(sql`'{}'::jsonb`), // {"channelId": timestamp}
  lastSeenDMs: jsonb("last_seen_dms").default(sql`'{}'::jsonb`), // {"userId": timestamp}
  // Onboarding fields
  onboardingAnswers: jsonb("onboarding_answers"), // Stores questionnaire responses
  phone: varchar("phone"), // Phone number for communication
});

// Messenger channels with three-tier structure and advanced features
export const channels = pgTable("channels", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  tier: channelTierEnum("tier").notNull(), // NON_LICENSED, FL_LICENSED, MULTI_STATE
  description: text("description"),
  badgeIcon: text("badge_icon"), // Icon for the channel badge (e.g., "shield", "star", "globe")
  badgeColor: text("badge_color"), // Color for the channel badge (e.g., "blue", "gold", "purple")
  isActive: boolean("is_active").default(true),
  
  // Channel type and privacy settings
  isPrivate: boolean("is_private").default(false), // Private channels are invite-only
  isArchived: boolean("is_archived").default(false), // Archived channels are read-only
  isShared: boolean("is_shared").default(false), // Shared with external workspaces
  isAnnouncement: boolean("is_announcement").default(false), // Only admins can post
  
  // Channel metadata
  purpose: text("purpose"), // Why this channel exists
  topic: text("topic"), // Current topic/focus
  workspaceId: varchar("workspace_id"), // Organization/workspace identifier
  
  // Channel creator and ownership
  createdBy: varchar("created_by").references(() => users.id),
  ownerId: varchar("owner_id").references(() => users.id),
  
  // Activity tracking
  lastActivityAt: timestamp("last_activity_at"),
  memberCount: integer("member_count").default(0),
  messageCount: integer("message_count").default(0),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Channel membership and access - enhanced with roles and permissions
export const channelMembers = pgTable("channel_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  channelId: varchar("channel_id").notNull().references(() => channels.id),
  
  // Member role and status
  role: text("role").notNull().default("member"), // "owner", "admin", "member"
  canAccess: boolean("can_access").default(true),
  isPending: boolean("is_pending").default(false), // Pending approval for private channels
  
  // Member preferences
  muteNotifications: boolean("mute_notifications").default(false),
  notificationLevel: text("notification_level").default("all"), // "all", "mentions", "none"
  
  // Metadata
  invitedBy: varchar("invited_by").references(() => users.id),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
  leftAt: timestamp("left_at"),
}, (table) => [
  unique().on(table.userId, table.channelId), // Prevent duplicate memberships
]);

// Channel permissions table for granular access control
export const channelPermissions = pgTable("channel_permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  channelId: varchar("channel_id").notNull().references(() => channels.id),
  role: text("role").notNull(), // "owner", "admin", "member", or custom role
  
  // Permissions flags
  canPost: boolean("can_post").default(true),
  canInvite: boolean("can_invite").default(false),
  canManageSettings: boolean("can_manage_settings").default(false),
  canManageMembers: boolean("can_manage_members").default(false),
  canDeleteMessages: boolean("can_delete_messages").default(false),
  canPinMessages: boolean("can_pin_messages").default(false),
  canCreateThreads: boolean("can_create_threads").default(true),
  canManageWebhooks: boolean("can_manage_webhooks").default(false),
  canManageIntegrations: boolean("can_manage_integrations").default(false),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique().on(table.channelId, table.role), // One permission set per role per channel
]);

// Shared channels table for cross-workspace collaboration
export const sharedChannels = pgTable("shared_channels", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  channelId: varchar("channel_id").notNull().references(() => channels.id),
  
  // External workspace information
  externalWorkspaceId: varchar("external_workspace_id").notNull(),
  externalWorkspaceName: text("external_workspace_name"),
  externalChannelId: varchar("external_channel_id"),
  
  // Connection details
  connectionStatus: text("connection_status").default("pending"), // "pending", "active", "disconnected", "rejected"
  connectionType: text("connection_type").default("bidirectional"), // "bidirectional", "send_only", "receive_only"
  
  // Security and compliance
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  disconnectedBy: varchar("disconnected_by").references(() => users.id),
  disconnectedAt: timestamp("disconnected_at"),
  disconnectionReason: text("disconnection_reason"),
  
  // Activity tracking
  lastSyncAt: timestamp("last_sync_at"),
  messageSyncCount: integer("message_sync_count").default(0),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Channel join requests for private channels
export const channelJoinRequests = pgTable("channel_join_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  channelId: varchar("channel_id").notNull().references(() => channels.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  
  // Request details
  message: text("message"), // Optional message with the request
  status: text("status").notNull().default("pending"), // "pending", "approved", "rejected", "cancelled"
  
  // Approval details
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewNote: text("review_note"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique().on(table.channelId, table.userId), // One request per user per channel
]);

// Legacy table for backward compatibility (kept but deprecated)
export const userChannels = pgTable("user_channels", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  channelId: varchar("channel_id").notNull().references(() => channels.id),
  canAccess: boolean("can_access").default(true),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});

// Messages in channels
export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  channelId: varchar("channel_id").notNull().references(() => channels.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  content: text("content"),
  formattedContent: text("formatted_content"), // Rich text content (HTML/Markdown)
  messageType: messageTypeEnum("message_type").default("text"),
  attachmentId: varchar("attachment_id"), // Reference to fileUploads table
  isAiGenerated: boolean("is_ai_generated").default(false),
  isEdited: boolean("is_edited").default(false),
  editedAt: timestamp("edited_at"),
  // Mentions tracking
  mentionedUserIds: text().array().default(sql`ARRAY[]::text[]`),
  // Threading fields
  parentMessageId: varchar("parent_message_id").references(() => messages.id),
  threadCount: integer("thread_count").default(0),
  lastThreadReply: timestamp("last_thread_reply"),
  // Pinning fields
  isPinned: boolean("is_pinned").default(false),
  pinnedBy: varchar("pinned_by").references(() => users.id),
  pinnedAt: timestamp("pinned_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Direct messages between users and admins
export const directMessages = pgTable("direct_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  senderId: varchar("sender_id").notNull().references(() => users.id),
  receiverId: varchar("receiver_id").notNull().references(() => users.id),
  content: text("content"),
  formattedContent: text("formatted_content"), // Rich text content (HTML/Markdown)
  messageType: messageTypeEnum("message_type").default("text"),
  attachmentId: varchar("attachment_id"), // Reference to fileUploads table
  isRead: boolean("is_read").default(false),
  readAt: timestamp("read_at"),
  isEdited: boolean("is_edited").default(false),
  editedAt: timestamp("edited_at"),
  // Mentions tracking
  mentionedUserIds: text().array().default(sql`ARRAY[]::text[]`),
  // Threading fields
  parentMessageId: varchar("parent_message_id").references(() => directMessages.id),
  threadCount: integer("thread_count").default(0),
  lastThreadReply: timestamp("last_thread_reply"),
  // Pinning fields
  isPinned: boolean("is_pinned").default(false),
  pinnedBy: varchar("pinned_by").references(() => users.id),
  pinnedAt: timestamp("pinned_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Message Reactions
export const messageReactions = pgTable("message_reactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  messageId: varchar("message_id").notNull().references(() => messages.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  emoji: text("emoji").notNull(), // emoji character or shortcode
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Direct Message Reactions
export const directMessageReactions = pgTable("direct_message_reactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  directMessageId: varchar("direct_message_id").notNull().references(() => directMessages.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  emoji: text("emoji").notNull(), // emoji character or shortcode
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Unique constraints to prevent duplicate reactions
export const messageReactionUniqueConstraint = unique("message_reaction_unique")
  .on(messageReactions.messageId, messageReactions.userId, messageReactions.emoji);

export const directMessageReactionUniqueConstraint = unique("direct_message_reaction_unique")
  .on(directMessageReactions.directMessageId, directMessageReactions.userId, directMessageReactions.emoji);

// File uploads and resume storage
export const fileUploads = pgTable("file_uploads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  fileUrl: text("file_url").notNull(),
  fileSize: integer("file_size"),
  thumbnailUrl: text("thumbnail_url"),
  
  // Extended file metadata
  mimeType: varchar("mime_type", { length: 255 }),
  metadata: jsonb("metadata"), // dimensions, pages, duration, etc.
  linkedToMessageId: varchar("linked_to_message_id"), // links file to a message
  
  // Resume parsing fields
  isResume: boolean("is_resume").default(false),
  parseStatus: fileStatusEnum("parse_status").default("pending"),
  parsedData: jsonb("parsed_data"), // Extracted resume data
  parsedAt: timestamp("parsed_at"),
  parseError: text("parse_error"),
  
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});

// Onboarding questionnaire responses
export const onboardingResponses = pgTable("onboarding_responses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique().references(() => users.id),
  hasFloridaLicense: boolean("has_florida_license"),
  isMultiStateLicensed: boolean("is_multi_state_licensed"),
  licensedStates: text("licensed_states").array().default(sql`ARRAY[]::text[]`),
  completedAt: timestamp("completed_at").defaultNow().notNull(),
});

// WebRTC Calls
export const calls = pgTable("calls", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id").notNull(), // Organization/workspace identifier
  channelId: varchar("channel_id").references(() => channels.id), // Optional channel if call is in a channel
  initiatorId: varchar("initiator_id").notNull().references(() => users.id),
  type: callTypeEnum("type").notNull(), // voice, video, huddle, screen_share
  status: callStatusEnum("status").notNull().default("pending"),
  title: text("title"), // Optional call title/description
  
  // Timing
  startedAt: timestamp("started_at").defaultNow().notNull(),
  endedAt: timestamp("ended_at"),
  scheduledFor: timestamp("scheduled_for"), // For scheduled calls
  
  // Settings
  maxParticipants: integer("max_participants").default(15),
  isRecording: boolean("is_recording").default(false),
  recordingUrl: text("recording_url"),
  recordingStartedAt: timestamp("recording_started_at"),
  recordingStoppedAt: timestamp("recording_stopped_at"),
  
  // WebRTC Configuration
  roomId: text("room_id").notNull(), // Unique room identifier for WebRTC
  stunServers: jsonb("stun_servers"), // STUN server configuration
  turnServers: jsonb("turn_servers"), // TURN server configuration
  
  // Analytics
  peakParticipants: integer("peak_participants").default(0),
  totalDuration: integer("total_duration_secs"), // Total call duration in seconds
  qualityMetrics: jsonb("quality_metrics"), // Network quality, packet loss, etc.
  
  // Metadata
  metadata: jsonb("metadata"), // Additional call metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Call Participants
export const callParticipants = pgTable("call_participants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  callId: varchar("call_id").notNull().references(() => calls.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  
  // Status
  status: participantStatusEnum("status").notNull().default("invited"),
  
  // Timing
  joinedAt: timestamp("joined_at"),
  leftAt: timestamp("left_at"),
  invitedAt: timestamp("invited_at").defaultNow(),
  
  // Media States
  audioEnabled: boolean("audio_enabled").default(true),
  videoEnabled: boolean("video_enabled").default(false),
  screenSharing: boolean("screen_sharing").default(false),
  
  // Device & Connection Info
  deviceInfo: jsonb("device_info"), // Browser, OS, device type
  connectionInfo: jsonb("connection_info"), // IP, connection type
  
  // Quality Metrics
  networkQuality: integer("network_quality"), // 1-5 scale
  avgBitrate: integer("avg_bitrate"),
  packetLoss: real("packet_loss"),
  avgLatency: integer("avg_latency_ms"),
  
  // Features Used
  backgroundBlurEnabled: boolean("background_blur").default(false),
  virtualBackgroundUrl: text("virtual_background_url"),
  noiseSuppression: boolean("noise_suppression").default(true),
  echoCancellation: boolean("echo_cancellation").default(true),
  
  // Recording Consent
  recordingConsent: boolean("recording_consent").default(false),
  consentGivenAt: timestamp("consent_given_at"),
  
  // Metadata
  metadata: jsonb("metadata"), // Additional participant metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Unique constraint to prevent duplicate participants
export const callParticipantUniqueConstraint = unique("call_participant_unique")
  .on(callParticipants.callId, callParticipants.userId);

export const workflowRules = pgTable("workflow_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description").notNull(),
  isActive: boolean("is_active").default(true),
  priority: integer("priority").default(50),
  triggers: jsonb("triggers").notNull(),
  conditions: jsonb("conditions").notNull(),
  actions: jsonb("actions").notNull(),
  triggerCount: integer("trigger_count").default(0),
  lastTriggered: timestamp("last_triggered"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ElevenLabs automation tracking
export const elevenLabsTracking = pgTable("elevenlabs_tracking", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: text("agent_id").notNull().unique(),
  lastProcessedAt: timestamp("last_processed_at").defaultNow().notNull(),
  lastConversationId: text("last_conversation_id"),
  totalProcessed: integer("total_processed").default(0),
  lastErrorAt: timestamp("last_error_at"),
  lastError: text("last_error"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// === PHASE 3: CONVERSATION CONTEXT & MEMORY TABLES ===

// Platform conversations - conversations happening within the platform (not just ElevenLabs)
export const platformConversations = pgTable("platform_conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: text("conversation_id").notNull().unique(), // External conversation ID (ElevenLabs, etc.)
  agentId: text("agent_id").notNull(), // Agent handling the conversation
  source: text("source").notNull(), // "elevenlabs", "manual", "chat", etc.
  status: text("status").notNull().default("active"), // "active", "ended", "paused", "archived"
  startedAt: timestamp("started_at").defaultNow().notNull(),
  endedAt: timestamp("ended_at"),
  lastActivityAt: timestamp("last_activity_at").defaultNow().notNull(),
  participantCount: integer("participant_count").default(2),
  messageCount: integer("message_count").default(0),
  durationSeconds: integer("duration_seconds"),
  metadata: jsonb("metadata"), // Flexible metadata storage
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Conversation context - contextual information and state for ongoing conversations
export const conversationContext = pgTable("conversation_context", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  platformConversationId: varchar("platform_conversation_id").notNull().references(() => platformConversations.id),
  contextKey: text("context_key").notNull(), // "candidate_profile", "interview_stage", "preferences", etc.
  contextValue: jsonb("context_value").notNull(), // Structured context data
  contextType: text("context_type").notNull(), // "candidate", "agent", "system", "business_rule"
  priority: integer("priority").default(5), // 1-10 priority for context relevance
  expiresAt: timestamp("expires_at"), // Optional expiration for temporary context
  isActive: boolean("is_active").default(true),
  tags: text("tags").array().default(sql`ARRAY[]::text[]`), // Searchable tags
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Conversation memory - long-term memory storage for learning and personalization
export const conversationMemory = pgTable("conversation_memory", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: text("agent_id").notNull(), // Agent that owns this memory
  memoryKey: text("memory_key").notNull(), // "candidate_preferences", "successful_techniques", etc.
  memoryValue: jsonb("memory_value").notNull(), // Structured memory data
  memoryType: text("memory_type").notNull(), // "learned_pattern", "user_preference", "success_factor", "failure_pattern"
  confidence: real("confidence").default(0.5), // Confidence in this memory (0.0-1.0)
  usageCount: integer("usage_count").default(0), // How many times this memory has been accessed
  lastUsedAt: timestamp("last_used_at"),
  source: text("source").notNull(), // Where this memory came from
  relatedConversationIds: text("related_conversation_ids").array().default(sql`ARRAY[]::text[]`),
  tags: text("tags").array().default(sql`ARRAY[]::text[]`),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// === JASON AI CONFIGURATION TABLES ===

// Jason AI Settings - stores all configuration for Jason AI persona
export const jasonSettings = pgTable("jason_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  settingKey: text("setting_key").notNull().unique(), // Unique setting identifier
  settingValue: jsonb("setting_value").notNull(), // JSON value for flexibility
  category: text("category").notNull(), // "persona", "behavior", "response", etc.
  description: text("description"), // Human-readable description
  updatedBy: varchar("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Jason AI Templates - response templates for common scenarios
export const jasonTemplates = pgTable("jason_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateName: text("template_name").notNull(),
  templateType: templateTypeEnum("template_type").notNull(),
  channelTier: channelTierEnum("channel_tier"), // Optional: specific to a channel tier
  template: text("template").notNull(), // The actual template text
  variables: text("variables").array().default(sql`ARRAY[]::text[]`), // Variables used in template
  isActive: boolean("is_active").default(true),
  usageCount: integer("usage_count").default(0),
  tags: text("tags").array().default(sql`ARRAY[]::text[]`),
  updatedBy: varchar("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Jason AI Channel Behaviors - channel-specific behavior settings
export const jasonChannelBehaviors = pgTable("jason_channel_behaviors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  channelId: varchar("channel_id").notNull().references(() => channels.id),
  isActive: boolean("is_active").default(true),
  responseFrequency: responseFrequencyEnum("response_frequency").notNull().default("sometimes"),
  autoResponseTriggers: jsonb("auto_response_triggers"), // JSON array of triggers
  specificSettings: jsonb("specific_settings"), // Channel-specific configuration
  updatedBy: varchar("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Notifications table for tracking unread messages, mentions, etc.
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: notificationTypeEnum("type").notNull(), // "message", "mention", "dm", "thread_reply"
  status: notificationStatusEnum("status").default("unread"),
  
  // Source references - nullable to support different types
  sourceId: varchar("source_id"), // messageId or directMessageId
  channelId: varchar("channel_id").references(() => channels.id),
  senderId: varchar("sender_id").references(() => users.id),
  
  // Notification content
  title: text("title"), // Brief notification title
  content: text("content"), // Preview of the message content
  metadata: jsonb("metadata"), // Additional context (thread info, mention position, etc.)
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  readAt: timestamp("read_at"),
}, (table) => [
  index("idx_notifications_user_status").on(table.userId, table.status),
  index("idx_notifications_created").on(table.createdAt),
]);

// Add unique constraints for key-based lookups
export const conversationContextUniqueConstraint = unique("conversation_context_unique")
  .on(conversationContext.platformConversationId, conversationContext.contextKey, conversationContext.contextType);

export const conversationMemoryUniqueConstraint = unique("conversation_memory_unique")
  .on(conversationMemory.agentId, conversationMemory.memoryKey, conversationMemory.memoryType);

export const jasonChannelBehaviorUniqueConstraint = unique("jason_channel_behavior_unique")
  .on(jasonChannelBehaviors.channelId);


// Relations
export const campaignsRelations = relations(campaigns, ({ many }) => ({
  candidates: many(candidates),
}));

export const candidatesRelations = relations(candidates, ({ one, many }) => ({
  campaign: one(campaigns, {
    fields: [candidates.campaignId],
    references: [campaigns.id],
  }),
  interviews: many(interviews),
  bookings: many(bookings),
}));



export const apifyActorsRelations = relations(apifyActors, ({ many }) => ({
  runs: many(apifyRuns),
}));

export const apifyRunsRelations = relations(apifyRuns, ({ one }) => ({
  actor: one(apifyActors, {
    fields: [apifyRuns.actorId],
    references: [apifyActors.id],
  }),
}));

export const interviewsRelations = relations(interviews, ({ one }) => ({
  candidate: one(candidates, {
    fields: [interviews.candidateId],
    references: [candidates.id],
  }),
}));

export const bookingsRelations = relations(bookings, ({ one }) => ({
  candidate: one(candidates, {
    fields: [bookings.candidateId],
    references: [candidates.id],
  }),
}));

// Slash Commands Tables
export const slashCommands = pgTable("slash_commands", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description").notNull(),
  usage: text("usage").notNull(),
  type: commandTypeEnum("type").notNull().default("builtin"),
  category: text("category"), // General, Productivity, Fun, Admin, etc.
  permissionLevel: commandPermissionLevelEnum("permission_level").notNull().default("all"),
  context: commandContextEnum("context").notNull().default("both"),
  isEnabled: boolean("is_enabled").default(true),
  isDeprecated: boolean("is_deprecated").default(false),
  webhookUrl: text("webhook_url"), // For webhook commands
  customLogic: jsonb("custom_logic"), // For custom commands with templates
  parameters: jsonb("parameters"), // Parameter definitions
  aliases: text("aliases").array().default(sql`ARRAY[]::text[]`), // Command aliases
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  nameIdx: index().on(table.name),
  typeIdx: index().on(table.type),
}));

export const commandHistory = pgTable("command_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  commandId: varchar("command_id").references(() => slashCommands.id),
  commandName: text("command_name").notNull(), // Store name in case command is deleted
  userId: varchar("user_id").notNull().references(() => users.id),
  channelId: varchar("channel_id").references(() => channels.id),
  dmUserId: varchar("dm_user_id"), // For DM context
  args: text("args"), // Raw arguments string
  parsedArgs: jsonb("parsed_args"), // Parsed arguments object
  context: jsonb("context"), // Execution context (channel info, user info, etc.)
  result: jsonb("result"), // Command result/output
  success: boolean("success").notNull().default(true),
  error: text("error"), // Error message if failed
  executionTime: integer("execution_time_ms"), // Execution time in milliseconds
  executedAt: timestamp("executed_at").defaultNow().notNull(),
}, (table) => ({
  userIdx: index().on(table.userId),
  commandIdx: index().on(table.commandId),
  executedAtIdx: index().on(table.executedAt),
}));

export const commandPermissions = pgTable("command_permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  commandId: varchar("command_id").notNull().references(() => slashCommands.id, { onDelete: "cascade" }),
  userId: varchar("user_id").references(() => users.id),
  roleId: varchar("role_id"), // For role-based permissions (future)
  channelId: varchar("channel_id").references(() => channels.id),
  permission: text("permission").notNull(), // "allow" or "deny"
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  commandUserIdx: unique().on(table.commandId, table.userId),
  commandChannelIdx: index().on(table.commandId, table.channelId),
}));

export const commandFavorites = pgTable("command_favorites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  commandId: varchar("command_id").notNull().references(() => slashCommands.id, { onDelete: "cascade" }),
  lastUsed: timestamp("last_used").defaultNow().notNull(),
  useCount: integer("use_count").default(1).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userCommandIdx: unique().on(table.userId, table.commandId),
}));

export const reminders = pgTable("reminders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  targetUserId: varchar("target_user_id").references(() => users.id),
  channelId: varchar("channel_id").references(() => channels.id),
  message: text("message").notNull(),
  remindAt: timestamp("remind_at").notNull(),
  isRecurring: boolean("is_recurring").default(false),
  recurringPattern: text("recurring_pattern"), // daily, weekly, monthly
  isCompleted: boolean("is_completed").default(false),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userIdx: index().on(table.userId),
  remindAtIdx: index().on(table.remindAt),
  completedIdx: index().on(table.isCompleted),
}));

export const polls = pgTable("polls", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  channelId: varchar("channel_id").notNull().references(() => channels.id),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  question: text("question").notNull(),
  options: jsonb("options").notNull(), // Array of {id, text, votes: [userId]}
  isAnonymous: boolean("is_anonymous").default(false),
  allowMultiple: boolean("allow_multiple").default(false),
  expiresAt: timestamp("expires_at"),
  isClosed: boolean("is_closed").default(false),
  closedAt: timestamp("closed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  channelIdx: index().on(table.channelId),
  createdByIdx: index().on(table.createdBy),
}));

export const pollVotes = pgTable("poll_votes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  pollId: varchar("poll_id").notNull().references(() => polls.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  optionId: text("option_id").notNull(),
  votedAt: timestamp("voted_at").defaultNow().notNull(),
}, (table) => ({
  pollUserOptionIdx: unique().on(table.pollId, table.userId, table.optionId),
  pollIdx: index().on(table.pollId),
}));

// Search Tables
export const savedSearches = pgTable("saved_searches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  query: text("query").notNull(),
  filters: jsonb("filters"), // { channels: [], users: [], dateRange: {}, fileTypes: [], hasAttachments: bool, messageTypes: [] }
  scope: searchScopeEnum("scope").default("all"),
  isPinned: boolean("is_pinned").default(false),
  isShared: boolean("is_shared").default(false),
  usageCount: integer("usage_count").default(0),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userIdx: index().on(table.userId),
  pinnedIdx: index().on(table.isPinned),
  sharedIdx: index().on(table.isShared),
}));

export const searchHistory = pgTable("search_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  query: text("query").notNull(),
  filters: jsonb("filters"),
  scope: searchScopeEnum("scope").default("all"),
  resultsCount: integer("results_count").default(0),
  clickedResults: jsonb("clicked_results"), // Array of result IDs that were clicked
  searchDuration: integer("search_duration_ms"), // Search execution time in milliseconds
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userIdx: index().on(table.userId),
  createdAtIdx: index().on(table.createdAt),
  queryIdx: index().on(table.query),
}));

// Full-text search indexes for existing tables
// These will be created via SQL migrations or direct SQL commands
// For messages table: GIN index on content for full-text search
// For files table: GIN index on fileName for full-text search  
// For channels table: GIN index on name, description, purpose for full-text search
// For users table: GIN index on firstName, lastName, email for full-text search

// Workflow Tables
export const workflows = pgTable("workflows", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id"),
  name: text("name").notNull(),
  description: text("description"),
  triggerType: workflowTriggerTypeEnum("trigger_type").notNull(),
  triggerConfig: jsonb("trigger_config").notNull(), // Configuration for the trigger
  actions: jsonb("actions").notNull(), // Array of action configurations
  status: workflowStatusEnum("status").notNull().default("draft"),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  version: integer("version").notNull().default(1),
  parentWorkflowId: varchar("parent_workflow_id"), // For versioning
  variables: jsonb("variables"), // Workflow-level variables
  metadata: jsonb("metadata"), // Additional metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  workspaceIdx: index().on(table.workspaceId),
  statusIdx: index().on(table.status),
  createdByIdx: index().on(table.createdBy),
  triggerTypeIdx: index().on(table.triggerType),
}));

export const workflowRuns = pgTable("workflow_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workflowId: varchar("workflow_id").notNull().references(() => workflows.id),
  workflowVersion: integer("workflow_version").notNull(),
  status: workflowRunStatusEnum("status").notNull().default("pending"),
  triggeredBy: varchar("triggered_by").references(() => users.id), // User who triggered (null for automatic)
  triggerData: jsonb("trigger_data"), // Data that triggered the workflow
  context: jsonb("context"), // Runtime context and variables
  executionLog: jsonb("execution_log"), // Detailed execution log
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  retryCount: integer("retry_count").default(0),
  parentRunId: varchar("parent_run_id"), // For nested workflows
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  workflowIdx: index().on(table.workflowId),
  statusIdx: index().on(table.status),
  triggeredByIdx: index().on(table.triggeredBy),
  createdAtIdx: index().on(table.createdAt),
}));

export const workflowTemplates = pgTable("workflow_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull(), // "onboarding", "approval", "notification", etc.
  icon: text("icon"), // Icon identifier
  triggerType: workflowTriggerTypeEnum("trigger_type").notNull(),
  triggerConfig: jsonb("trigger_config").notNull(),
  actions: jsonb("actions").notNull(),
  variables: jsonb("variables"),
  tags: text("tags").array().default(sql`ARRAY[]::text[]`),
  isPublic: boolean("is_public").default(true),
  usageCount: integer("usage_count").default(0),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  categoryIdx: index().on(table.category),
  isPublicIdx: index().on(table.isPublic),
}));

export const workflowSchedules = pgTable("workflow_schedules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workflowId: varchar("workflow_id").notNull().references(() => workflows.id, { onDelete: "cascade" }),
  cronExpression: text("cron_expression"), // Cron expression for recurring
  scheduleType: text("schedule_type").notNull(), // "once", "recurring", "interval"
  intervalSeconds: integer("interval_seconds"), // For interval-based schedules
  nextRunAt: timestamp("next_run_at").notNull(),
  lastRunAt: timestamp("last_run_at"),
  timezone: text("timezone").default("UTC"),
  isActive: boolean("is_active").default(true),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  workflowIdx: index().on(table.workflowId),
  nextRunIdx: index().on(table.nextRunAt),
  isActiveIdx: index().on(table.isActive),
}));

// ==================== ENTERPRISE SECURITY TABLES ====================

// Enterprise Audit Logs - Track all security-relevant events
export const enterpriseAuditLogs = pgTable("enterprise_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id").notNull(),
  action: auditActionTypeEnum("action").notNull(),
  actorId: varchar("actor_id").references(() => users.id),
  actorEmail: text("actor_email"),
  actorName: text("actor_name"),
  
  // Resource details
  resourceType: text("resource_type"), // "user", "channel", "file", "settings", etc.
  resourceId: text("resource_id"),
  resourceName: text("resource_name"),
  
  // Event details
  details: jsonb("details"), // Additional context for the action
  previousValue: jsonb("previous_value"), // For update operations
  newValue: jsonb("new_value"), // For update operations
  
  // Request metadata
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  sessionId: text("session_id"),
  requestId: text("request_id"),
  
  // Status and compliance
  success: boolean("success").default(true),
  errorMessage: text("error_message"),
  complianceFlags: text("compliance_flags").array().default(sql`ARRAY[]::text[]`),
  
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  
  // Data retention
  expiresAt: timestamp("expires_at"), // For automatic deletion
  retentionPolicy: dataRetentionPolicyEnum("retention_policy"),
}, (table) => [
  index("ent_audit_logs_workspace_idx").on(table.workspaceId),
  index("ent_audit_logs_actor_idx").on(table.actorId),
  index("ent_audit_logs_action_idx").on(table.action),
  index("ent_audit_logs_timestamp_idx").on(table.timestamp),
  index("ent_audit_logs_resource_idx").on(table.resourceType, table.resourceId),
]);

// SSO Configurations
export const ssoConfigurations = pgTable("sso_configurations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id").notNull(),
  providerType: ssoProviderTypeEnum("provider_type").notNull(),
  enabled: boolean("enabled").default(false),
  
  // Provider details
  providerName: text("provider_name"),
  entityId: text("entity_id"),
  ssoUrl: text("sso_url"),
  certificateData: text("certificate_data"), // Base64 encoded certificate
  metadataUrl: text("metadata_url"),
  
  // SAML Configuration
  samlMetadata: text("saml_metadata"), // Full XML metadata
  attributeMapping: jsonb("attribute_mapping"), // Maps SAML attributes to user fields
  
  // OAuth Configuration (for Google, Microsoft)
  clientId: text("client_id"),
  clientSecret: text("client_secret"), // Encrypted
  authorizationUrl: text("authorization_url"),
  tokenUrl: text("token_url"),
  
  // SCIM Configuration
  scimEnabled: boolean("scim_enabled").default(false),
  scimEndpoint: text("scim_endpoint"),
  scimApiKey: text("scim_api_key"), // Encrypted
  
  // Settings
  allowFallbackAuth: boolean("allow_fallback_auth").default(true),
  autoProvisionUsers: boolean("auto_provision_users").default(false),
  defaultRole: text("default_role"),
  allowedDomains: text("allowed_domains").array().default(sql`ARRAY[]::text[]`),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique().on(table.workspaceId, table.providerType),
]);

// Two-Factor Authentication Settings
export const tfaSettings = pgTable("tfa_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  
  // TOTP Configuration
  totpEnabled: boolean("totp_enabled").default(false),
  totpSecret: text("totp_secret"), // Encrypted
  totpVerified: boolean("totp_verified").default(false),
  totpBackupCodes: text("totp_backup_codes").array().default(sql`ARRAY[]::text[]`), // Encrypted
  
  // SMS Configuration
  smsEnabled: boolean("sms_enabled").default(false),
  smsPhoneNumber: text("sms_phone_number"), // Encrypted
  smsVerified: boolean("sms_verified").default(false),
  
  // Email Configuration
  emailEnabled: boolean("email_enabled").default(false),
  emailVerified: boolean("email_verified").default(false),
  
  // Recovery codes
  recoveryCodes: text("recovery_codes").array().default(sql`ARRAY[]::text[]`), // Encrypted
  recoveryCodesUsed: text("recovery_codes_used").array().default(sql`ARRAY[]::text[]`),
  
  // Settings
  preferredMethod: tfaMethodEnum("preferred_method"),
  enforced: boolean("enforced").default(false), // If true, user must use 2FA
  lastVerified: timestamp("last_verified"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique().on(table.userId),
]);

// Security Policies
export const securityPolicies = pgTable("security_policies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id").notNull(),
  
  // Password policies
  passwordMinLength: integer("password_min_length").default(8),
  passwordRequireUppercase: boolean("password_require_uppercase").default(true),
  passwordRequireLowercase: boolean("password_require_lowercase").default(true),
  passwordRequireNumbers: boolean("password_require_numbers").default(true),
  passwordRequireSpecialChars: boolean("password_require_special_chars").default(false),
  passwordExpiryDays: integer("password_expiry_days"), // null = no expiry
  passwordHistoryCount: integer("password_history_count").default(5), // Prevent reuse of last N passwords
  
  // Session policies
  sessionTimeoutMinutes: integer("session_timeout_minutes").default(1440), // 24 hours
  sessionMaxConcurrent: integer("session_max_concurrent").default(5),
  sessionInactivityTimeoutMinutes: integer("session_inactivity_timeout_minutes").default(30),
  
  // 2FA policies
  enforce2FA: boolean("enforce_2fa").default(false),
  enforce2FAForAdmins: boolean("enforce_2fa_for_admins").default(true),
  allow2FASkipDays: integer("allow_2fa_skip_days").default(0), // Grace period for 2FA setup
  
  // IP restrictions
  ipRestrictionEnabled: boolean("ip_restriction_enabled").default(false),
  ipRestrictionType: ipRestrictionTypeEnum("ip_restriction_type").default("allowlist"),
  ipRestrictionList: text("ip_restriction_list").array().default(sql`ARRAY[]::text[]`),
  
  // Data policies
  dataRetentionPolicy: dataRetentionPolicyEnum("data_retention_policy").default("indefinite"),
  dataRetentionCustomDays: integer("data_retention_custom_days"),
  enableDataExport: boolean("enable_data_export").default(true),
  enableDataDeletion: boolean("enable_data_deletion").default(true),
  
  // DLP policies
  dlpEnabled: boolean("dlp_enabled").default(false),
  dlpRules: jsonb("dlp_rules"), // Pattern matching rules for sensitive data
  
  // Compliance settings
  complianceStandards: complianceStandardEnum("compliance_standards").array().default(sql`ARRAY[]::compliance_standard[]`),
  encryptionAtRest: boolean("encryption_at_rest").default(true),
  encryptionInTransit: boolean("encryption_in_transit").default(true),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique().on(table.workspaceId),
]);

// Trusted Devices
export const trustedDevices = pgTable("trusted_devices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  
  deviceName: text("device_name"),
  deviceType: text("device_type"), // "desktop", "mobile", "tablet"
  deviceIdentifier: text("device_identifier"), // Unique device fingerprint
  
  // Browser/App details
  browserName: text("browser_name"),
  browserVersion: text("browser_version"),
  operatingSystem: text("operating_system"),
  
  // Trust details
  trustedUntil: timestamp("trusted_until"),
  lastUsed: timestamp("last_used"),
  ipAddress: text("ip_address"),
  location: text("location"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("trusted_devices_user_idx").on(table.userId),
]);

// Password History
export const passwordHistory = pgTable("password_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  passwordHash: text("password_hash").notNull(), // Encrypted
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("password_history_user_idx").on(table.userId),
]);

// Security Alerts
export const securityAlerts = pgTable("security_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id").notNull(),
  
  severity: securityAlertSeverityEnum("severity").notNull(),
  alertType: text("alert_type").notNull(), // "suspicious_login", "data_breach", "policy_violation", etc.
  title: text("title").notNull(),
  description: text("description"),
  
  // Affected resources
  affectedUserId: varchar("affected_user_id").references(() => users.id),
  affectedResourceType: text("affected_resource_type"),
  affectedResourceId: text("affected_resource_id"),
  
  // Response
  status: text("status").default("open"), // "open", "acknowledged", "resolved", "false_positive"
  acknowledgedBy: varchar("acknowledged_by").references(() => users.id),
  acknowledgedAt: timestamp("acknowledged_at"),
  resolvedBy: varchar("resolved_by").references(() => users.id),
  resolvedAt: timestamp("resolved_at"),
  resolutionNotes: text("resolution_notes"),
  
  // Metadata
  metadata: jsonb("metadata"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("security_alerts_workspace_idx").on(table.workspaceId),
  index("security_alerts_severity_idx").on(table.severity),
  index("security_alerts_status_idx").on(table.status),
]);

// Data Export/Import Logs
export const dataOperationLogs = pgTable("data_operation_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id").notNull(),
  userId: varchar("user_id").notNull().references(() => users.id),
  
  operationType: text("operation_type").notNull(), // "export", "import", "deletion", "anonymization"
  dataScope: text("data_scope"), // "user_data", "messages", "files", "all"
  
  // Request details
  requestReason: text("request_reason"),
  complianceType: complianceStandardEnum("compliance_type"),
  
  // Operation details
  status: text("status").default("pending"), // "pending", "processing", "completed", "failed"
  fileUrl: text("file_url"),
  recordCount: integer("record_count"),
  
  // Timing
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  expiresAt: timestamp("expires_at"), // When the export file will be deleted
  
  // Metadata
  metadata: jsonb("metadata"),
  errorMessage: text("error_message"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("data_operation_logs_workspace_idx").on(table.workspaceId),
  index("data_operation_logs_user_idx").on(table.userId),
]);

// Phase 3: Conversation context relations
export const platformConversationsRelations = relations(platformConversations, ({ many }) => ({
  contextEntries: many(conversationContext),
}));

export const conversationContextRelations = relations(conversationContext, ({ one }) => ({
  platformConversation: one(platformConversations, {
    fields: [conversationContext.platformConversationId],
    references: [platformConversations.id],
  }),
}));

// Insert schemas
export const insertCampaignSchema = createInsertSchema(campaigns).omit({ id: true, createdAt: true });
export const insertCandidateSchema = createInsertSchema(candidates).omit({ id: true, createdAt: true });
export const insertInterviewSchema = createInsertSchema(interviews).omit({ id: true, createdAt: true });
export const insertBookingSchema = createInsertSchema(bookings).omit({ id: true, createdAt: true });
export const insertApifyActorSchema = createInsertSchema(apifyActors).omit({ id: true, createdAt: true });
export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertWorkflowRuleSchema = createInsertSchema(workflowRules).omit({ id: true, createdAt: true, updatedAt: true });
export const insertApifyRunSchema = createInsertSchema(apifyRuns).omit({ id: true, createdAt: true });
export const insertElevenLabsTrackingSchema = createInsertSchema(elevenLabsTracking).omit({ id: true, createdAt: true, updatedAt: true });

// Phase 3: Conversation context insert schemas
export const insertPlatformConversationSchema = createInsertSchema(platformConversations).omit({ id: true, createdAt: true, updatedAt: true });
export const insertConversationContextSchema = createInsertSchema(conversationContext).omit({ id: true, createdAt: true, updatedAt: true });
export const insertConversationMemorySchema = createInsertSchema(conversationMemory).omit({ id: true, createdAt: true, updatedAt: true });

// Jason AI insert schemas
export const insertJasonSettingSchema = createInsertSchema(jasonSettings).omit({ id: true, createdAt: true, updatedAt: true });
export const insertJasonTemplateSchema = createInsertSchema(jasonTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export const insertJasonChannelBehaviorSchema = createInsertSchema(jasonChannelBehaviors).omit({ id: true, createdAt: true, updatedAt: true });

// Channel management insert schemas
export const insertChannelMemberSchema = createInsertSchema(channelMembers).omit({ id: true, joinedAt: true });
export const insertChannelPermissionSchema = createInsertSchema(channelPermissions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSharedChannelSchema = createInsertSchema(sharedChannels).omit({ id: true, createdAt: true, updatedAt: true });
export const insertChannelJoinRequestSchema = createInsertSchema(channelJoinRequests).omit({ id: true, createdAt: true, updatedAt: true });

// Types
export type Campaign = typeof campaigns.$inferSelect;
export type Candidate = typeof candidates.$inferSelect;
export type Interview = typeof interviews.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type ApifyActor = typeof apifyActors.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type User = typeof users.$inferSelect;
export type WorkflowRule = typeof workflowRules.$inferSelect;
export type ApifyRun = typeof apifyRuns.$inferSelect;
export type ElevenLabsTracking = typeof elevenLabsTracking.$inferSelect;

// Phase 3: Conversation context types
export type PlatformConversation = typeof platformConversations.$inferSelect;
export type ConversationContext = typeof conversationContext.$inferSelect;
export type ConversationMemory = typeof conversationMemory.$inferSelect;

// Jason AI types
export type JasonSetting = typeof jasonSettings.$inferSelect;
export type JasonTemplate = typeof jasonTemplates.$inferSelect;
export type JasonChannelBehavior = typeof jasonChannelBehaviors.$inferSelect;
export type Channel = typeof channels.$inferSelect;
export type ChannelMember = typeof channelMembers.$inferSelect;
export type ChannelPermission = typeof channelPermissions.$inferSelect;
export type SharedChannel = typeof sharedChannels.$inferSelect;
export type ChannelJoinRequest = typeof channelJoinRequests.$inferSelect;

export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type InsertCandidate = z.infer<typeof insertCandidateSchema>;
export type InsertInterview = z.infer<typeof insertInterviewSchema>;
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type InsertApifyActor = z.infer<typeof insertApifyActorSchema>;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertWorkflowRule = z.infer<typeof insertWorkflowRuleSchema>;
export type InsertApifyRun = z.infer<typeof insertApifyRunSchema>;
export type InsertElevenLabsTracking = z.infer<typeof insertElevenLabsTrackingSchema>;

// Phase 3: Conversation context insert types  
export type InsertPlatformConversation = z.infer<typeof insertPlatformConversationSchema>;
export type InsertConversationContext = z.infer<typeof insertConversationContextSchema>;
export type InsertConversationMemory = z.infer<typeof insertConversationMemorySchema>;

// Jason AI insert types
export type InsertJasonSetting = z.infer<typeof insertJasonSettingSchema>;
export type InsertJasonTemplate = z.infer<typeof insertJasonTemplateSchema>;
export type InsertJasonChannelBehavior = z.infer<typeof insertJasonChannelBehaviorSchema>;

// Channel management insert types
export type InsertChannelMember = z.infer<typeof insertChannelMemberSchema>;
export type InsertChannelPermission = z.infer<typeof insertChannelPermissionSchema>;
export type InsertSharedChannel = z.infer<typeof insertSharedChannelSchema>;
export type InsertChannelJoinRequest = z.infer<typeof insertChannelJoinRequestSchema>;

// Messenger insert schemas
export const insertChannelSchema = createInsertSchema(channels).omit({ id: true, createdAt: true });
export const insertUserChannelSchema = createInsertSchema(userChannels).omit({ id: true, joinedAt: true });
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, createdAt: true });
export const insertDirectMessageSchema = createInsertSchema(directMessages).omit({ id: true, createdAt: true });
export const insertFileUploadSchema = createInsertSchema(fileUploads).omit({ id: true, uploadedAt: true });
export const insertOnboardingResponseSchema = createInsertSchema(onboardingResponses).omit({ id: true, completedAt: true });
export const insertMessageReactionSchema = createInsertSchema(messageReactions).omit({ id: true, createdAt: true });
export const insertDirectMessageReactionSchema = createInsertSchema(directMessageReactions).omit({ id: true, createdAt: true });

// Call insert schemas
export const insertCallSchema = createInsertSchema(calls).omit({ id: true, createdAt: true, updatedAt: true, startedAt: true });
export const insertCallParticipantSchema = createInsertSchema(callParticipants).omit({ id: true, createdAt: true, updatedAt: true, invitedAt: true });

// Notifications insert schema
export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true });

// Slash Commands insert schemas
export const insertSlashCommandSchema = createInsertSchema(slashCommands).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCommandHistorySchema = createInsertSchema(commandHistory).omit({ id: true, executedAt: true });
export const insertCommandPermissionSchema = createInsertSchema(commandPermissions).omit({ id: true, createdAt: true });
export const insertCommandFavoriteSchema = createInsertSchema(commandFavorites).omit({ id: true, createdAt: true });
export const insertReminderSchema = createInsertSchema(reminders).omit({ id: true, createdAt: true });
export const insertPollSchema = createInsertSchema(polls).omit({ id: true, createdAt: true });
export const insertPollVoteSchema = createInsertSchema(pollVotes).omit({ id: true, votedAt: true });

// Search insert schemas
export const insertSavedSearchSchema = createInsertSchema(savedSearches).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSearchHistorySchema = createInsertSchema(searchHistory).omit({ id: true, createdAt: true });

// Workflow insert schemas
export const insertWorkflowSchema = createInsertSchema(workflows).omit({ id: true, createdAt: true, updatedAt: true });
export const insertWorkflowRunSchema = createInsertSchema(workflowRuns).omit({ id: true, createdAt: true });
export const insertWorkflowTemplateSchema = createInsertSchema(workflowTemplates).omit({ id: true, createdAt: true });
export const insertWorkflowScheduleSchema = createInsertSchema(workflowSchedules).omit({ id: true, createdAt: true, updatedAt: true });

// Enterprise Security insert schemas
export const insertEnterpriseAuditLogSchema = createInsertSchema(enterpriseAuditLogs).omit({ id: true, timestamp: true });
export const insertSSOConfigurationSchema = createInsertSchema(ssoConfigurations).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTFASettingSchema = createInsertSchema(tfaSettings).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSecurityPolicySchema = createInsertSchema(securityPolicies).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTrustedDeviceSchema = createInsertSchema(trustedDevices).omit({ id: true, createdAt: true });
export const insertPasswordHistorySchema = createInsertSchema(passwordHistory).omit({ id: true, createdAt: true });
export const insertSecurityAlertSchema = createInsertSchema(securityAlerts).omit({ id: true, createdAt: true });
export const insertDataOperationLogSchema = createInsertSchema(dataOperationLogs).omit({ id: true, createdAt: true });

// Messenger types
export type Channel = typeof channels.$inferSelect;
export type UserChannel = typeof userChannels.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type DirectMessage = typeof directMessages.$inferSelect;
export type FileUpload = typeof fileUploads.$inferSelect;
export type OnboardingResponse = typeof onboardingResponses.$inferSelect;
export type MessageReaction = typeof messageReactions.$inferSelect;
export type DirectMessageReaction = typeof directMessageReactions.$inferSelect;
export type Notification = typeof notifications.$inferSelect;

// Call types
export type Call = typeof calls.$inferSelect;
export type CallParticipant = typeof callParticipants.$inferSelect;

export type InsertChannel = z.infer<typeof insertChannelSchema>;
export type InsertUserChannel = z.infer<typeof insertUserChannelSchema>;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type InsertDirectMessage = z.infer<typeof insertDirectMessageSchema>;
export type InsertFileUpload = z.infer<typeof insertFileUploadSchema>;
export type InsertOnboardingResponse = z.infer<typeof insertOnboardingResponseSchema>;
export type InsertMessageReaction = z.infer<typeof insertMessageReactionSchema>;
export type InsertDirectMessageReaction = z.infer<typeof insertDirectMessageReactionSchema>;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

// Call insert types
export type InsertCall = z.infer<typeof insertCallSchema>;
export type InsertCallParticipant = z.infer<typeof insertCallParticipantSchema>;

// Replit Auth types
export type UpsertUser = typeof users.$inferInsert;

// Slash Commands types
export type SlashCommand = typeof slashCommands.$inferSelect;
export type CommandHistory = typeof commandHistory.$inferSelect;
export type CommandPermission = typeof commandPermissions.$inferSelect;
export type CommandFavorite = typeof commandFavorites.$inferSelect;
export type Reminder = typeof reminders.$inferSelect;
export type Poll = typeof polls.$inferSelect;
export type PollVote = typeof pollVotes.$inferSelect;

// Search types
export type SavedSearch = typeof savedSearches.$inferSelect;
export type SearchHistory = typeof searchHistory.$inferSelect;

export type InsertSlashCommand = z.infer<typeof insertSlashCommandSchema>;
export type InsertCommandHistory = z.infer<typeof insertCommandHistorySchema>;
export type InsertCommandPermission = z.infer<typeof insertCommandPermissionSchema>;
export type InsertCommandFavorite = z.infer<typeof insertCommandFavoriteSchema>;
export type InsertReminder = z.infer<typeof insertReminderSchema>;
export type InsertPoll = z.infer<typeof insertPollSchema>;
export type InsertPollVote = z.infer<typeof insertPollVoteSchema>;

// Search insert types
export type InsertSavedSearch = z.infer<typeof insertSavedSearchSchema>;
export type InsertSearchHistory = z.infer<typeof insertSearchHistorySchema>;

// Workflow types
export type Workflow = typeof workflows.$inferSelect;
export type WorkflowRun = typeof workflowRuns.$inferSelect;
export type WorkflowTemplate = typeof workflowTemplates.$inferSelect;
export type WorkflowSchedule = typeof workflowSchedules.$inferSelect;

// Workflow insert types
export type InsertWorkflow = z.infer<typeof insertWorkflowSchema>;
export type InsertWorkflowRun = z.infer<typeof insertWorkflowRunSchema>;
export type InsertWorkflowTemplate = z.infer<typeof insertWorkflowTemplateSchema>;
export type InsertWorkflowSchedule = z.infer<typeof insertWorkflowScheduleSchema>;

// Enterprise Security types
export type EnterpriseAuditLog = typeof enterpriseAuditLogs.$inferSelect;
export type SSOConfiguration = typeof ssoConfigurations.$inferSelect;
export type TFASetting = typeof tfaSettings.$inferSelect;
export type SecurityPolicy = typeof securityPolicies.$inferSelect;
export type TrustedDevice = typeof trustedDevices.$inferSelect;
export type PasswordHistory = typeof passwordHistory.$inferSelect;
export type SecurityAlert = typeof securityAlerts.$inferSelect;
export type DataOperationLog = typeof dataOperationLogs.$inferSelect;

export type InsertEnterpriseAuditLog = z.infer<typeof insertEnterpriseAuditLogSchema>;
export type InsertSSOConfiguration = z.infer<typeof insertSSOConfigurationSchema>;
export type InsertTFASetting = z.infer<typeof insertTFASettingSchema>;
export type InsertSecurityPolicy = z.infer<typeof insertSecurityPolicySchema>;
export type InsertTrustedDevice = z.infer<typeof insertTrustedDeviceSchema>;
export type InsertPasswordHistory = z.infer<typeof insertPasswordHistorySchema>;
export type InsertSecurityAlert = z.infer<typeof insertSecurityAlertSchema>;
export type InsertDataOperationLog = z.infer<typeof insertDataOperationLogSchema>;

// ============================================================================
// SUBSCRIPTION & BILLING SYSTEM
// ============================================================================

// Billing Enums
export const billingCycleEnum = pgEnum("billing_cycle", ["monthly", "yearly", "quarterly", "one_time", "custom"]);
export const subscriptionStatusEnum = pgEnum("subscription_status", ["active", "canceled", "past_due", "trialing", "paused", "expired"]);
export const paymentStatusEnum = pgEnum("payment_status", ["pending", "succeeded", "failed", "refunded", "partially_refunded"]);
export const paymentMethodTypeEnum = pgEnum("payment_method_type", ["card", "ach", "invoice", "wire_transfer", "paypal"]);
export const planTierEnum = pgEnum("plan_tier", ["free", "pro", "business", "enterprise"]);
export const invoiceStatusEnum = pgEnum("invoice_status", ["draft", "sent", "paid", "overdue", "void", "uncollectible"]);
export const usageMetricTypeEnum = pgEnum("usage_metric_type", ["messages", "storage", "api_calls", "active_users", "integrations", "file_uploads"]);

// Subscription Plans Table
export const subscriptionPlans = pgTable("subscription_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  tier: planTierEnum("tier").notNull(),
  price: real("price").notNull(), // Price per billing cycle
  pricePerUser: real("price_per_user"), // For per-seat pricing
  billingCycle: billingCycleEnum("billing_cycle").notNull().default("monthly"),
  
  // Feature flags and limits
  features: jsonb("features").notNull().default('{}'), // Feature flags (e.g., {"advanced_search": true})
  limits: jsonb("limits").notNull().default('{}'), // Usage limits (e.g., {"messages": 10000, "storage_gb": 10})
  
  // Plan details
  description: text("description"),
  isActive: boolean("is_active").default(true),
  isCustom: boolean("is_custom").default(false), // For enterprise custom plans
  trialDays: integer("trial_days").default(0),
  
  // Metadata
  metadata: jsonb("metadata"), // Additional plan configuration
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  tierIdx: index("subscription_plans_tier_idx").on(table.tier),
  activeIdx: index("subscription_plans_active_idx").on(table.isActive),
}));

// Subscriptions Table (Workspace/User subscriptions)
export const subscriptions = pgTable("subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id").notNull(), // Can reference workspace or organization
  userId: varchar("user_id").references(() => users.id), // The user who manages the subscription
  planId: varchar("plan_id").notNull().references(() => subscriptionPlans.id),
  
  // Subscription details
  status: subscriptionStatusEnum("status").notNull().default("active"),
  startDate: timestamp("start_date").notNull().defaultNow(),
  endDate: timestamp("end_date"), // When subscription ends (null for ongoing)
  trialEndDate: timestamp("trial_end_date"), // When trial ends
  canceledAt: timestamp("canceled_at"), // When user canceled
  cancelationReason: text("cancelation_reason"),
  
  // Billing information
  quantity: integer("quantity").default(1), // Number of seats/licenses
  currentPeriodStart: timestamp("current_period_start").notNull(),
  currentPeriodEnd: timestamp("current_period_end").notNull(),
  
  // Payment method
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  defaultPaymentMethodId: varchar("default_payment_method_id"),
  
  // Metadata
  metadata: jsonb("metadata"), // Additional subscription data
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  workspaceIdx: index("subscriptions_workspace_idx").on(table.workspaceId),
  statusIdx: index("subscriptions_status_idx").on(table.status),
  stripeSubIdx: unique().on(table.stripeSubscriptionId),
}));

// Payment Methods Table
export const paymentMethods = pgTable("payment_methods", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  subscriptionId: varchar("subscription_id").notNull().references(() => subscriptions.id, { onDelete: "cascade" }),
  
  // Payment details
  type: paymentMethodTypeEnum("type").notNull(),
  stripePaymentMethodId: text("stripe_payment_method_id"),
  isDefault: boolean("is_default").default(false),
  
  // Card details (encrypted/tokenized)
  last4: varchar("last4", { length: 4 }),
  brand: text("brand"), // visa, mastercard, etc.
  expiryMonth: integer("expiry_month"),
  expiryYear: integer("expiry_year"),
  
  // Bank details for ACH
  bankName: text("bank_name"),
  accountLast4: varchar("account_last4", { length: 4 }),
  
  // Billing address
  billingAddress: jsonb("billing_address"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  subscriptionIdx: index("payment_methods_subscription_idx").on(table.subscriptionId),
}));

// Billing History / Invoices Table
export const billingHistory = pgTable("billing_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  subscriptionId: varchar("subscription_id").notNull().references(() => subscriptions.id),
  
  // Invoice details
  invoiceNumber: text("invoice_number").notNull().unique(),
  status: invoiceStatusEnum("status").notNull().default("draft"),
  amount: real("amount").notNull(),
  tax: real("tax").default(0),
  total: real("total").notNull(),
  currency: varchar("currency", { length: 3 }).default("USD"),
  
  // Payment information
  paymentStatus: paymentStatusEnum("payment_status").notNull().default("pending"),
  paymentMethodId: varchar("payment_method_id").references(() => paymentMethods.id),
  stripeInvoiceId: text("stripe_invoice_id"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  
  // Dates
  billingPeriodStart: timestamp("billing_period_start").notNull(),
  billingPeriodEnd: timestamp("billing_period_end").notNull(),
  dueDate: timestamp("due_date"),
  paidAt: timestamp("paid_at"),
  
  // Line items and metadata
  lineItems: jsonb("line_items").notNull().default('[]'), // Detailed breakdown
  metadata: jsonb("metadata"),
  pdfUrl: text("pdf_url"), // Link to downloadable invoice
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  subscriptionIdx: index("billing_history_subscription_idx").on(table.subscriptionId),
  statusIdx: index("billing_history_status_idx").on(table.status),
}));

// Usage Tracking Table
export const usageTracking = pgTable("usage_tracking", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id").notNull(),
  subscriptionId: varchar("subscription_id").references(() => subscriptions.id),
  userId: varchar("user_id").references(() => users.id),
  
  // Metric details
  metric: usageMetricTypeEnum("metric").notNull(),
  value: integer("value").notNull(),
  
  // Time tracking
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  
  // Context
  context: jsonb("context"), // Additional context (e.g., channel, file type)
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  workspaceMetricIdx: index("usage_tracking_workspace_metric_idx").on(table.workspaceId, table.metric),
  timestampIdx: index("usage_tracking_timestamp_idx").on(table.timestamp),
  userIdx: index("usage_tracking_user_idx").on(table.userId),
}));

// Feature Flags Table (for feature gating)
export const featureFlags = pgTable("feature_flags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(), // e.g., "advanced_search", "unlimited_integrations"
  displayName: text("display_name").notNull(),
  description: text("description"),
  
  // Availability by plan
  availableInPlans: planTierEnum("available_in_plans").array().notNull().default(sql`ARRAY[]::plan_tier[]`),
  
  // Feature configuration
  isEnabled: boolean("is_enabled").default(true),
  requiresUpgrade: boolean("requires_upgrade").default(true),
  upgradeMessage: text("upgrade_message"), // Custom message when feature is not available
  
  // Usage limits per plan (if applicable)
  limitsPerPlan: jsonb("limits_per_plan"), // e.g., {"free": 10, "pro": 100, "business": -1}
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  enabledIdx: index("feature_flags_enabled_idx").on(table.isEnabled),
}));

// Usage Alerts Table (for notification when approaching limits)
export const usageAlerts = pgTable("usage_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id").notNull(),
  subscriptionId: varchar("subscription_id").references(() => subscriptions.id),
  
  // Alert details
  metric: usageMetricTypeEnum("metric").notNull(),
  threshold: integer("threshold").notNull(), // Percentage (e.g., 80, 90, 100)
  currentUsage: integer("current_usage").notNull(),
  limit: integer("limit").notNull(),
  
  // Alert status
  alertedAt: timestamp("alerted_at").notNull().defaultNow(),
  acknowledged: boolean("acknowledged").default(false),
  acknowledgedBy: varchar("acknowledged_by").references(() => users.id),
  acknowledgedAt: timestamp("acknowledged_at"),
  
  // Notification details
  notificationSent: boolean("notification_sent").default(false),
  notificationChannels: text("notification_channels").array().default(sql`ARRAY[]::text[]`), // email, in-app, slack
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  workspaceIdx: index("usage_alerts_workspace_idx").on(table.workspaceId),
  metricIdx: index("usage_alerts_metric_idx").on(table.metric),
}));

// Create insert schemas for billing tables
export const insertSubscriptionPlanSchema = createInsertSchema(subscriptionPlans).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});
export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});
export const insertPaymentMethodSchema = createInsertSchema(paymentMethods).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});
export const insertBillingHistorySchema = createInsertSchema(billingHistory).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});
export const insertUsageTrackingSchema = createInsertSchema(usageTracking).omit({ 
  id: true, 
  createdAt: true 
});
export const insertFeatureFlagSchema = createInsertSchema(featureFlags).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});
export const insertUsageAlertSchema = createInsertSchema(usageAlerts).omit({ 
  id: true, 
  createdAt: true 
});

// Billing Types
export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type BillingHistory = typeof billingHistory.$inferSelect;
export type UsageTracking = typeof usageTracking.$inferSelect;
export type FeatureFlag = typeof featureFlags.$inferSelect;
export type UsageAlert = typeof usageAlerts.$inferSelect;

export type InsertSubscriptionPlan = z.infer<typeof insertSubscriptionPlanSchema>;
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type InsertPaymentMethod = z.infer<typeof insertPaymentMethodSchema>;
export type InsertBillingHistory = z.infer<typeof insertBillingHistorySchema>;
export type InsertUsageTracking = z.infer<typeof insertUsageTrackingSchema>;
export type InsertFeatureFlag = z.infer<typeof insertFeatureFlagSchema>;
export type InsertUsageAlert = z.infer<typeof insertUsageAlertSchema>;

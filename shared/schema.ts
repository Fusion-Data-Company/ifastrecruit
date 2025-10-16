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

// Jason AI Enums
export const templateTypeEnum = pgEnum("template_type", ["welcome", "qa", "resume", "career", "general"]);
export const responseFrequencyEnum = pgEnum("response_frequency", ["always", "sometimes", "only_when_mentioned", "never"]);

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
  hasCompletedOnboarding: boolean("has_completed_onboarding").default(false),
  hasFloridaLicense: boolean("has_florida_license").default(false),
  isMultiStateLicensed: boolean("is_multi_state_licensed").default(false),
  licensedStates: text("licensed_states").array().default(sql`ARRAY[]::text[]`),
  showCalendlyButton: boolean("show_calendly_button").default(true),
  onlineStatus: text("online_status").default("offline"), // "online", "offline", "away"
  lastSeenAt: timestamp("last_seen_at"),
});

// Messenger channels with three-tier structure
export const channels = pgTable("channels", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  tier: channelTierEnum("tier").notNull(), // NON_LICENSED, FL_LICENSED, MULTI_STATE
  description: text("description"),
  badgeIcon: text("badge_icon"), // Icon for the channel badge (e.g., "shield", "star", "globe")
  badgeColor: text("badge_color"), // Color for the channel badge (e.g., "blue", "gold", "purple")
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Channel membership and access
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
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, ts: true });
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

// Messenger insert schemas
export const insertChannelSchema = createInsertSchema(channels).omit({ id: true, createdAt: true });
export const insertUserChannelSchema = createInsertSchema(userChannels).omit({ id: true, joinedAt: true });
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, createdAt: true });
export const insertDirectMessageSchema = createInsertSchema(directMessages).omit({ id: true, createdAt: true });
export const insertFileUploadSchema = createInsertSchema(fileUploads).omit({ id: true, uploadedAt: true });
export const insertOnboardingResponseSchema = createInsertSchema(onboardingResponses).omit({ id: true, completedAt: true });
export const insertMessageReactionSchema = createInsertSchema(messageReactions).omit({ id: true, createdAt: true });
export const insertDirectMessageReactionSchema = createInsertSchema(directMessageReactions).omit({ id: true, createdAt: true });

// Messenger types
export type Channel = typeof channels.$inferSelect;
export type UserChannel = typeof userChannels.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type DirectMessage = typeof directMessages.$inferSelect;
export type FileUpload = typeof fileUploads.$inferSelect;
export type OnboardingResponse = typeof onboardingResponses.$inferSelect;
export type MessageReaction = typeof messageReactions.$inferSelect;
export type DirectMessageReaction = typeof directMessageReactions.$inferSelect;

export type InsertChannel = z.infer<typeof insertChannelSchema>;
export type InsertUserChannel = z.infer<typeof insertUserChannelSchema>;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type InsertDirectMessage = z.infer<typeof insertDirectMessageSchema>;
export type InsertFileUpload = z.infer<typeof insertFileUploadSchema>;
export type InsertOnboardingResponse = z.infer<typeof insertOnboardingResponseSchema>;
export type InsertMessageReaction = z.infer<typeof insertMessageReactionSchema>;
export type InsertDirectMessageReaction = z.infer<typeof insertDirectMessageReactionSchema>;

// Replit Auth types
export type UpsertUser = typeof users.$inferInsert;

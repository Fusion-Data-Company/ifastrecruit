import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, jsonb, pgEnum, boolean, unique } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const campaignSourceEnum = pgEnum("campaign_source", ["APIFY", "MANUAL"]);
export const pipelineStageEnum = pgEnum("pipeline_stage", [
  "NEW", "FIRST_INTERVIEW", "TECHNICAL_SCREEN", "FINAL_INTERVIEW", "OFFER", "HIRED", "REJECTED"
]);
export const bookingStatusEnum = pgEnum("booking_status", ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"]);

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

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
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

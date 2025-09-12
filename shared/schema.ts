import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, jsonb, pgEnum, boolean, unique } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const campaignSourceEnum = pgEnum("campaign_source", ["INDEED", "APIFY", "MANUAL"]);
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
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").references(() => campaigns.id),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  sourceRef: text("source_ref"),
  resumeUrl: text("resume_url"),
  tags: text("tags").array(),
  pipelineStage: pipelineStageEnum("pipeline_stage").notNull().default("NEW"),
  score: integer("score").default(0),
  // === INTERVIEW DATA FIELDS ===
  notes: text("notes"),
  interviewData: jsonb("interview_data"),
  interviewScore: integer("interview_score"),
  interviewDuration: text("interview_duration"),
  interviewTranscript: text("interview_transcript"),
  interviewSummary: text("interview_summary"),
  evaluationCriteria: jsonb("evaluation_criteria"),
  dataCollectionResults: jsonb("data_collection_results"),
  agentId: text("agent_id"),
  conversationId: text("conversation_id"),
  interviewDate: timestamp("interview_date"),
  callDuration: integer("call_duration_secs"),
  messageCount: integer("message_count"),
  callStatus: text("call_status"),
  callSuccessful: text("call_successful"),
  transcriptSummary: text("transcript_summary"),
  callSummaryTitle: text("call_summary_title"),
  agentName: text("agent_name"),
  // === NEW ELEVENLABS FIELDS ===
  audioRecordingUrl: text("audio_recording_url"),
  agentData: jsonb("agent_data"), // Comprehensive agent interaction data
  conversationMetadata: jsonb("conversation_metadata"), // Conversation-specific metadata
  
  // === COMPREHENSIVE ELEVENLABS INTERVIEW FIELDS ===
  // Core interview responses
  whyInsurance: text("why_insurance"),
  whyNow: text("why_now"),
  salesExperience: text("sales_experience"),
  difficultCustomerStory: text("difficult_customer_story"),
  consultativeSelling: text("consultative_selling"),
  
  // Market preferences and timeline
  preferredMarkets: text("preferred_markets").array(),
  timeline: text("timeline"),
  recommendedNextSteps: text("recommended_next_steps"),
  
  // Performance indicators
  demoCallPerformed: boolean("demo_call_performed").default(false),
  kevinPersonaUsed: boolean("kevin_persona_used").default(false),
  coachingGiven: boolean("coaching_given").default(false),
  pitchDelivered: boolean("pitch_delivered").default(false),
  
  // Evaluation scores
  overallScore: integer("overall_score"),
  communicationScore: integer("communication_score"),
  salesAptitudeScore: integer("sales_aptitude_score"),
  motivationScore: integer("motivation_score"),
  coachabilityScore: integer("coachability_score"),
  professionalPresenceScore: integer("professional_presence_score"),
  
  // Development assessment
  strengths: text("strengths").array(),
  developmentAreas: text("development_areas").array(),
  
  // Additional structured evaluation data
  evaluationDetails: jsonb("evaluation_details"), // Detailed evaluation breakdown
  interviewMetrics: jsonb("interview_metrics"), // Performance metrics and statistics
  // === END ELEVENLABS INTERVIEW FIELDS ===
  
  // === END INTERVIEW DATA FIELDS ===
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  emailUnique: unique().on(table.email),
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

// Indeed integration tables
export const indeedJobs = pgTable("indeed_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  company: text("company").notNull(),
  location: text("location").notNull(),
  description: text("description").notNull(),
  requirements: text("requirements"),
  salary: text("salary"),
  type: text("type").notNull().default("Full-time"),
  status: text("status").notNull().default("draft"),
  indeedJobId: text("indeed_job_id"), // ID from Indeed API
  applicationsCount: integer("applications_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const indeedApplications = pgTable("indeed_applications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => indeedJobs.id),
  candidateId: varchar("candidate_id").references(() => candidates.id),
  indeedApplicationId: text("indeed_application_id").notNull().unique(),
  candidateName: text("candidate_name").notNull(),
  candidateEmail: text("candidate_email").notNull(),
  resume: text("resume"),
  coverLetter: text("cover_letter"),
  screeningAnswers: jsonb("screening_answers"),
  eeoData: jsonb("eeo_data"),
  disposition: text("disposition").notNull().default("new"),
  rawPayload: jsonb("raw_payload"), // Store full Indeed payload
  appliedAt: timestamp("applied_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
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
  indeedApplications: many(indeedApplications),
}));

export const indeedJobsRelations = relations(indeedJobs, ({ many }) => ({
  applications: many(indeedApplications),
}));

export const indeedApplicationsRelations = relations(indeedApplications, ({ one }) => ({
  job: one(indeedJobs, {
    fields: [indeedApplications.jobId],
    references: [indeedJobs.id],
  }),
  candidate: one(candidates, {
    fields: [indeedApplications.candidateId],
    references: [candidates.id],
  }),
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
export const insertIndeedJobSchema = createInsertSchema(indeedJobs).omit({ id: true, createdAt: true, updatedAt: true });
export const insertIndeedApplicationSchema = createInsertSchema(indeedApplications).omit({ id: true, createdAt: true });
export const insertApifyRunSchema = createInsertSchema(apifyRuns).omit({ id: true, createdAt: true });

// Types
export type Campaign = typeof campaigns.$inferSelect;
export type Candidate = typeof candidates.$inferSelect;
export type Interview = typeof interviews.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type ApifyActor = typeof apifyActors.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type User = typeof users.$inferSelect;
export type WorkflowRule = typeof workflowRules.$inferSelect;
export type IndeedJob = typeof indeedJobs.$inferSelect;
export type IndeedApplication = typeof indeedApplications.$inferSelect;
export type ApifyRun = typeof apifyRuns.$inferSelect;

export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type InsertCandidate = z.infer<typeof insertCandidateSchema>;
export type InsertInterview = z.infer<typeof insertInterviewSchema>;
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type InsertApifyActor = z.infer<typeof insertApifyActorSchema>;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertWorkflowRule = z.infer<typeof insertWorkflowRuleSchema>;
export type InsertIndeedJob = z.infer<typeof insertIndeedJobSchema>;
export type InsertIndeedApplication = z.infer<typeof insertIndeedApplicationSchema>;
export type InsertApifyRun = z.infer<typeof insertApifyRunSchema>;

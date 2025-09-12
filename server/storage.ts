import { 
  campaigns, 
  candidates, 
  interviews, 
  bookings, 
  apifyActors,
  apifyRuns, 
  auditLogs,
  users,
  workflowRules,
  elevenLabsTracking,
  type Campaign,
  type Candidate, 
  type Interview,
  type Booking,
  type ApifyActor,
  type ApifyRun,
  type AuditLog,
  type User,
  type WorkflowRule,
  type ElevenLabsTracking,
  type InsertCampaign,
  type InsertCandidate,
  type InsertInterview,
  type InsertBooking,
  type InsertApifyActor,
  type InsertApifyRun,
  type InsertAuditLog,
  type InsertUser,
  type InsertWorkflowRule,
  type InsertElevenLabsTracking
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, count, sql } from "drizzle-orm";
import crypto from "crypto";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Campaign methods
  getCampaigns(): Promise<Campaign[]>;
  getCampaign(id: string): Promise<Campaign | undefined>;
  createCampaign(campaign: InsertCampaign): Promise<Campaign>;
  updateCampaign(id: string, updates: Partial<Campaign>): Promise<Campaign>;

  // Candidate methods
  getCandidates(page?: number, limit?: number): Promise<Candidate[]>;
  getCandidate(id: string): Promise<Candidate | undefined>;
  getCandidateByEmail(email: string): Promise<Candidate | undefined>;
  getCandidateByToken(token: string): Promise<Candidate | undefined>;
  createCandidate(candidate: InsertCandidate): Promise<Candidate>;
  updateCandidate(id: string, updates: Partial<Candidate>): Promise<Candidate>;

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

  // Indeed Job methods
  getIndeedJobs(): Promise<IndeedJob[]>;
  getIndeedJob(id: string): Promise<IndeedJob | undefined>;
  createIndeedJob(job: InsertIndeedJob): Promise<IndeedJob>;
  updateIndeedJob(id: string, updates: Partial<IndeedJob>): Promise<IndeedJob>;

  // Indeed Application methods
  getIndeedApplications(): Promise<IndeedApplication[]>;
  getIndeedApplication(id: string): Promise<IndeedApplication | undefined>;
  getIndeedApplicationById(id: string): Promise<IndeedApplication | undefined>;
  createIndeedApplication(application: InsertIndeedApplication): Promise<IndeedApplication>;
  updateIndeedApplication(id: string, updates: Partial<IndeedApplication>): Promise<IndeedApplication>;

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

  // ElevenLabs Tracking methods
  getElevenLabsTracking(agentId: string): Promise<ElevenLabsTracking | undefined>;
  createElevenLabsTracking(tracking: InsertElevenLabsTracking): Promise<ElevenLabsTracking>;
  updateElevenLabsTracking(agentId: string, updates: Partial<ElevenLabsTracking>): Promise<ElevenLabsTracking>;

  // Utility methods
  saveICSFile(content: string): Promise<string>;
}

export class DatabaseStorage implements IStorage {
  private tokenStore = new Map<string, string>(); // token -> candidateId mapping

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
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

  // Indeed Job methods implementation
  async getIndeedJobs(): Promise<IndeedJob[]> {
    return await db.select().from(indeedJobs).orderBy(desc(indeedJobs.createdAt));
  }

  async getIndeedJob(id: string): Promise<IndeedJob | undefined> {
    const [job] = await db.select().from(indeedJobs).where(eq(indeedJobs.id, id));
    return job || undefined;
  }

  async createIndeedJob(job: InsertIndeedJob): Promise<IndeedJob> {
    const [created] = await db.insert(indeedJobs).values(job).returning();
    return created;
  }

  async updateIndeedJob(id: string, updates: Partial<IndeedJob>): Promise<IndeedJob> {
    const [updated] = await db
      .update(indeedJobs)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(indeedJobs.id, id))
      .returning();
    return updated;
  }

  // Indeed Application methods implementation
  async getIndeedApplications(): Promise<IndeedApplication[]> {
    return await db.select().from(indeedApplications).orderBy(desc(indeedApplications.appliedAt));
  }

  async getIndeedApplication(id: string): Promise<IndeedApplication | undefined> {
    const [application] = await db.select().from(indeedApplications).where(eq(indeedApplications.id, id));
    return application || undefined;
  }

  async getIndeedApplicationById(id: string): Promise<IndeedApplication | undefined> {
    const [application] = await db.select().from(indeedApplications).where(eq(indeedApplications.id, id));
    return application || undefined;
  }

  async createIndeedApplication(application: InsertIndeedApplication): Promise<IndeedApplication> {
    const [created] = await db.insert(indeedApplications).values(application).returning();
    return created;
  }

  async updateIndeedApplication(id: string, updates: Partial<IndeedApplication>): Promise<IndeedApplication> {
    const [updated] = await db.update(indeedApplications).set(updates).where(eq(indeedApplications.id, id)).returning();
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
}

export const storage = new DatabaseStorage();

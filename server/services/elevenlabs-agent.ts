import { elevenlabsIntegration } from "../integrations/elevenlabs";
import { storage } from "../storage";
import { openrouterIntegration } from "../integrations/openrouter";
import { z } from "zod";

// The specific authorized ElevenLabs agent ID that we monitor
const AUTHORIZED_AGENT_ID = "agent_0601k4t9d82qe5ybsgkngct0zzkm";

// Comprehensive ElevenLabs interview data validation schema
const ElevenLabsInterviewDataSchema = z.object({
  // REQUIRED agent validation - MUST be from authorized agent
  agent_id: z.string().refine(
    (id) => id === AUTHORIZED_AGENT_ID,
    { message: `UNAUTHORIZED ACCESS: Only agent ${AUTHORIZED_AGENT_ID} is authorized to submit interview data` }
  ),
  agentId: z.string().refine(
    (id) => id === AUTHORIZED_AGENT_ID,
    { message: `UNAUTHORIZED ACCESS: Only agent ${AUTHORIZED_AGENT_ID} is authorized to submit interview data` }
  ).optional(),
  
  // Basic conversation data
  conversation_id: z.string().optional(),
  conversationId: z.string().optional(),
  agent_name: z.string().optional(),
  agentName: z.string().optional(),
  transcript: z.union([z.string(), z.array(z.any())]).optional(),
  duration: z.string().optional(),
  summary: z.string().optional(),
  call_duration_secs: z.number().optional(),
  callDuration: z.number().optional(),
  message_count: z.number().optional(),
  messageCount: z.number().optional(),
  status: z.string().optional(),
  callStatus: z.string().optional(),
  call_successful: z.boolean().optional(),
  callSuccessful: z.boolean().optional(),
  transcript_summary: z.string().optional(),
  transcriptSummary: z.string().optional(),
  call_summary_title: z.string().optional(),
  callSummaryTitle: z.string().optional(),
  
  // Core interview responses
  why_insurance: z.string().nullable().optional(),
  whyInsurance: z.string().nullable().optional(),
  why_now: z.string().nullable().optional(),
  whyNow: z.string().nullable().optional(),
  sales_experience: z.string().nullable().optional(),
  salesExperience: z.string().nullable().optional(),
  difficult_customer_story: z.string().nullable().optional(),
  difficultCustomerStory: z.string().nullable().optional(),
  consultative_selling: z.string().nullable().optional(),
  consultativeSelling: z.string().nullable().optional(),
  
  // Market preferences and timeline
  preferred_markets: z.union([z.array(z.string()), z.string()]).nullable().optional(),
  preferredMarkets: z.union([z.array(z.string()), z.string()]).nullable().optional(),
  timeline: z.string().nullable().optional(),
  recommended_next_steps: z.string().nullable().optional(),
  recommendedNextSteps: z.string().nullable().optional(),
  
  // Performance indicators
  demo_call_performed: z.boolean().optional(),
  demoCallPerformed: z.boolean().optional(),
  kevin_persona_used: z.boolean().optional(),
  kevinPersonaUsed: z.boolean().optional(),
  coaching_given: z.boolean().optional(),
  coachingGiven: z.boolean().optional(),
  pitch_delivered: z.boolean().optional(),
  pitchDelivered: z.boolean().optional(),
  
  // Evaluation scores
  overall_score: z.number().nullable().optional(),
  overallScore: z.number().nullable().optional(),
  communication_score: z.number().nullable().optional(),
  communicationScore: z.number().nullable().optional(),
  sales_aptitude_score: z.number().nullable().optional(),
  salesAptitudeScore: z.number().nullable().optional(),
  motivation_score: z.number().nullable().optional(),
  motivationScore: z.number().nullable().optional(),
  coachability_score: z.number().nullable().optional(),
  coachabilityScore: z.number().nullable().optional(),
  professional_presence_score: z.number().nullable().optional(),
  professionalPresenceScore: z.number().nullable().optional(),
  
  // Development assessment
  strengths: z.array(z.string()).nullable().optional(),
  development_areas: z.array(z.string()).nullable().optional(),
  developmentAreas: z.array(z.string()).nullable().optional(),
  
  // Additional data structures
  evaluation_criteria_results: z.record(z.any()).nullable().optional(),
  evaluationCriteria: z.record(z.any()).nullable().optional(),
  data_collection_results: z.record(z.any()).nullable().optional(),
  dataCollectionResults: z.record(z.any()).nullable().optional(),
  evaluation_details: z.record(z.any()).nullable().optional(),
  evaluationDetails: z.record(z.any()).nullable().optional(),
  interview_metrics: z.record(z.any()).nullable().optional(),
  interviewMetrics: z.record(z.any()).nullable().optional(),
  
  // Audio and metadata
  audio_recording_url: z.string().nullable().optional(),
  audioRecordingUrl: z.string().nullable().optional(),
  agent_data: z.record(z.any()).nullable().optional(),
  agentData: z.record(z.any()).nullable().optional(),
  conversation_metadata: z.record(z.any()).nullable().optional(),
  conversationMetadata: z.record(z.any()).nullable().optional(),
  
  // Timestamps
  interview_date: z.union([z.string(), z.number()]).optional(),
  start_time_unix_secs: z.number().optional(),
  created_at: z.string().optional(),
  ended_at: z.string().optional(),
}).passthrough(); // Allow additional fields

export interface CandidateExtractedData {
  name: string | null;
  email: string | null;
  phone: string | null;
  overallScore: number | null;
  // Enhanced data from AI expansion - stored in JSON fields
  aiExpansionData: {
    qualifications: string[];
    experience: string[];
    interests: string[];
    personalityTraits: string[];
    communicationStyle: string | null;
    professionalismLevel: number | null;
    careerGoals: string | null;
    keySkills: string[];
    concernsOrObjections: string[];
    confidenceLevel: number | null;
  } | null;
}

export interface ProcessedConversationResult {
  success: boolean;
  candidate?: any;
  interview?: any;
  action: 'created' | 'updated' | 'failed';
  error?: string;
  details?: any;
}

export interface SyncVerificationResult {
  status: 'synced' | 'partial' | 'out_of_sync';
  totalConversations: number;
  totalCandidates: number;
  missingCandidates: string[]; // conversation IDs without candidates
  duplicateCandidates: string[]; // conversation IDs with multiple candidates
  invalidCandidates: string[]; // candidates with data issues
  lastSyncCheck: Date;
  details: any;
}

export interface ValidationIssue {
  conversationId: string;
  candidateId?: string;
  issueType: 'missing_candidate' | 'duplicate_candidate' | 'data_mismatch' | 'invalid_email' | 'missing_data';
  description: string;
  severity: 'high' | 'medium' | 'low';
  suggestedAction: string;
}

export class ElevenLabsAgentService {
  constructor() {
    console.log(`[ElevenLabs Agent] Service initialized for agent: ${AUTHORIZED_AGENT_ID}`);
  }

  /**
   * Process a single conversation and create/update candidate record
   */
  async processConversation(conversationId: string): Promise<ProcessedConversationResult> {
    try {
      console.log(`[ElevenLabs Agent] Processing conversation: ${conversationId}`);

      // Get detailed conversation data from ElevenLabs API
      const conversationDetails = await elevenlabsIntegration.getConversationDetails(conversationId);
      
      // Prepare comprehensive interview data structure
      const interviewData = {
        agent_id: AUTHORIZED_AGENT_ID,
        agentId: AUTHORIZED_AGENT_ID,
        conversation_id: conversationId,
        conversationId: conversationId,
        agent_name: "iFast Broker Interview Agent",
        agentName: "iFast Broker Interview Agent",
        transcript: conversationDetails.transcript ? JSON.stringify(conversationDetails.transcript) : "",
        duration: this.calculateDuration(conversationDetails),
        summary: this.generateSummary(conversationDetails),
        call_duration_secs: this.parseDurationSeconds(conversationDetails),
        callDuration: this.parseDurationSeconds(conversationDetails),
        message_count: conversationDetails.transcript ? conversationDetails.transcript.length : 0,
        messageCount: conversationDetails.transcript ? conversationDetails.transcript.length : 0,
        status: "completed",
        callStatus: "completed",
        call_successful: true,
        callSuccessful: true,
        transcript_summary: this.generateTranscriptSummary(conversationDetails),
        transcriptSummary: this.generateTranscriptSummary(conversationDetails),
        created_at: conversationDetails.created_at,
        ended_at: conversationDetails.ended_at,
        // Include all metadata
        ...conversationDetails.metadata
      };

      // Validate the interview data
      const validationResult = ElevenLabsInterviewDataSchema.safeParse(interviewData);
      if (!validationResult.success) {
        const errors = validationResult.error.format();
        console.error('[ElevenLabs Agent] Validation failed:', errors);
        
        await storage.createAuditLog({
          actor: "elevenlabs_agent",
          action: "conversation_validation_failed",
          payloadJson: { 
            errors: errors,
            rejectedPayload: interviewData,
            conversationId,
            reason: "Failed schema validation"
          },
          pathUsed: "elevenlabs_api",
        });

        return {
          success: false,
          action: 'failed',
          error: "Validation failed",
          details: errors
        };
      }

      // Extract candidate data from conversation
      const extractedData = await this.extractCandidateDataFromConversation(validationResult.data);
      
      // Validate extracted email
      if (!extractedData.email || 
          extractedData.email.includes('conversation-') || 
          extractedData.email.includes('@temp.elevenlabs.com') || 
          extractedData.email.includes('conv_') ||
          !extractedData.email.match(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)) {
        
        console.error(`[ElevenLabs Agent] Invalid or fake email detected: "${extractedData.email}"`);
        
        await storage.createAuditLog({
          actor: "elevenlabs_agent",
          action: "candidate_creation_fake_email_rejected", 
          payloadJson: { 
            rejectedEmail: extractedData.email,
            extractedName: extractedData.name,
            conversationId,
            interviewData: validationResult.data
          },
          pathUsed: "elevenlabs_api",
        });

        return {
          success: false,
          action: 'failed',
          error: "Invalid email address - candidate not created",
          details: { extractedEmail: extractedData.email, extractedName: extractedData.name }
        };
      }

      // Check if candidate already exists
      const existingCandidate = await storage.getCandidateByEmail(extractedData.email);
      
      let candidate;
      let action: 'created' | 'updated';

      if (existingCandidate) {
        // Update existing candidate with new interview data
        action = 'updated';
        candidate = await storage.updateCandidate(existingCandidate.id, {
          // Update basic info if new data is better
          name: extractedData.name || existingCandidate.name,
          phone: extractedData.phone || existingCandidate.phone,
          
          // Always update interview-specific data
          interviewData: validationResult.data,
          interviewScore: extractedData.overallScore,
          interviewDuration: validationResult.data.duration,
          interviewTranscript: typeof validationResult.data.transcript === 'string' 
            ? validationResult.data.transcript 
            : JSON.stringify(validationResult.data.transcript),
          interviewSummary: validationResult.data.summary,
          
          // ElevenLabs specific fields
          agentId: AUTHORIZED_AGENT_ID,
          conversationId: conversationId,
          interviewDate: new Date(validationResult.data.created_at || Date.now()),
          callDuration: validationResult.data.call_duration_secs,
          messageCount: validationResult.data.message_count,
          callStatus: validationResult.data.callStatus,
          callSuccessful: String(validationResult.data.call_successful),
          transcriptSummary: validationResult.data.transcript_summary,
          callSummaryTitle: validationResult.data.call_summary_title,
          agentName: validationResult.data.agent_name,
          
          // Enhanced candidate fields from AI expansion - store in evaluation details
          evaluationDetails: {
            ...(validationResult.data.evaluation_details || validationResult.data.evaluationDetails || {}),
            aiExpansion: extractedData.aiExpansionData
          },
          
          // Core interview responses
          whyInsurance: validationResult.data.why_insurance || validationResult.data.whyInsurance,
          whyNow: validationResult.data.why_now || validationResult.data.whyNow,
          salesExperience: validationResult.data.sales_experience || validationResult.data.salesExperience,
          difficultCustomerStory: validationResult.data.difficult_customer_story || validationResult.data.difficultCustomerStory,
          consultativeSelling: validationResult.data.consultative_selling || validationResult.data.consultativeSelling,
          
          // Market preferences and timeline
          preferredMarkets: this.normalizeArrayField(validationResult.data.preferred_markets || validationResult.data.preferredMarkets),
          timeline: validationResult.data.timeline,
          recommendedNextSteps: validationResult.data.recommended_next_steps || validationResult.data.recommendedNextSteps,
          
          // Performance indicators
          demoCallPerformed: validationResult.data.demo_call_performed || validationResult.data.demoCallPerformed,
          kevinPersonaUsed: validationResult.data.kevin_persona_used || validationResult.data.kevinPersonaUsed,
          coachingGiven: validationResult.data.coaching_given || validationResult.data.coachingGiven,
          pitchDelivered: validationResult.data.pitch_delivered || validationResult.data.pitchDelivered,
          
          // Evaluation scores
          overallScore: extractedData.overallScore,
          communicationScore: validationResult.data.communication_score || validationResult.data.communicationScore,
          salesAptitudeScore: validationResult.data.sales_aptitude_score || validationResult.data.salesAptitudeScore,
          motivationScore: validationResult.data.motivation_score || validationResult.data.motivationScore,
          coachabilityScore: validationResult.data.coachability_score || validationResult.data.coachabilityScore,
          professionalPresenceScore: validationResult.data.professional_presence_score || validationResult.data.professionalPresenceScore,
          
          // Development assessment
          strengths: validationResult.data.strengths,
          developmentAreas: validationResult.data.development_areas || validationResult.data.developmentAreas,
          
          // Additional structured data
          evaluationCriteria: validationResult.data.evaluation_criteria_results || validationResult.data.evaluationCriteria,
          dataCollectionResults: validationResult.data.data_collection_results || validationResult.data.dataCollectionResults,
          interviewMetrics: validationResult.data.interview_metrics || validationResult.data.interviewMetrics,
          
          // Audio and metadata
          audioRecordingUrl: validationResult.data.audio_recording_url || validationResult.data.audioRecordingUrl,
          agentData: validationResult.data.agent_data || validationResult.data.agentData,
          conversationMetadata: validationResult.data.conversation_metadata || validationResult.data.conversationMetadata,
          
          // Update score with extracted or calculated value
          score: extractedData.overallScore || existingCandidate.score,
        });
      } else {
        // Create new candidate
        action = 'created';
        candidate = await storage.createCandidate({
          name: extractedData.name || `Candidate ${conversationId.slice(-8)}`,
          email: extractedData.email,
          phone: extractedData.phone,
          sourceRef: `elevenlabs_${conversationId}`,
          pipelineStage: "FIRST_INTERVIEW",
          score: extractedData.overallScore || 0,
          
          // Interview data
          notes: `ElevenLabs interview processed automatically from conversation ${conversationId}`,
          interviewData: validationResult.data,
          interviewScore: extractedData.overallScore,
          interviewDuration: validationResult.data.duration,
          interviewTranscript: typeof validationResult.data.transcript === 'string' 
            ? validationResult.data.transcript 
            : JSON.stringify(validationResult.data.transcript),
          interviewSummary: validationResult.data.summary,
          
          // ElevenLabs specific fields
          agentId: AUTHORIZED_AGENT_ID,
          conversationId: conversationId,
          interviewDate: new Date(validationResult.data.created_at || Date.now()),
          callDuration: validationResult.data.call_duration_secs,
          messageCount: validationResult.data.message_count,
          callStatus: validationResult.data.callStatus,
          callSuccessful: String(validationResult.data.call_successful),
          transcriptSummary: validationResult.data.transcript_summary,
          callSummaryTitle: validationResult.data.call_summary_title,
          agentName: validationResult.data.agent_name,
          
          // Enhanced candidate fields from AI expansion - store in evaluation details
          evaluationDetails: {
            ...(validationResult.data.evaluation_details || validationResult.data.evaluationDetails || {}),
            aiExpansion: extractedData.aiExpansionData
          },
          
          // Core interview responses
          whyInsurance: validationResult.data.why_insurance || validationResult.data.whyInsurance,
          whyNow: validationResult.data.why_now || validationResult.data.whyNow,
          salesExperience: validationResult.data.sales_experience || validationResult.data.salesExperience,
          difficultCustomerStory: validationResult.data.difficult_customer_story || validationResult.data.difficultCustomerStory,
          consultativeSelling: validationResult.data.consultative_selling || validationResult.data.consultativeSelling,
          
          // Market preferences and timeline
          preferredMarkets: this.normalizeArrayField(validationResult.data.preferred_markets || validationResult.data.preferredMarkets),
          timeline: validationResult.data.timeline,
          recommendedNextSteps: validationResult.data.recommended_next_steps || validationResult.data.recommendedNextSteps,
          
          // Performance indicators
          demoCallPerformed: validationResult.data.demo_call_performed || validationResult.data.demoCallPerformed,
          kevinPersonaUsed: validationResult.data.kevin_persona_used || validationResult.data.kevinPersonaUsed,
          coachingGiven: validationResult.data.coaching_given || validationResult.data.coachingGiven,
          pitchDelivered: validationResult.data.pitch_delivered || validationResult.data.pitchDelivered,
          
          // Evaluation scores
          overallScore: extractedData.overallScore,
          communicationScore: validationResult.data.communication_score || validationResult.data.communicationScore,
          salesAptitudeScore: validationResult.data.sales_aptitude_score || validationResult.data.salesAptitudeScore,
          motivationScore: validationResult.data.motivation_score || validationResult.data.motivationScore,
          coachabilityScore: validationResult.data.coachability_score || validationResult.data.coachabilityScore,
          professionalPresenceScore: validationResult.data.professional_presence_score || validationResult.data.professionalPresenceScore,
          
          // Development assessment
          strengths: validationResult.data.strengths,
          developmentAreas: validationResult.data.development_areas || validationResult.data.developmentAreas,
          
          // Additional structured data
          evaluationCriteria: validationResult.data.evaluation_criteria_results || validationResult.data.evaluationCriteria,
          dataCollectionResults: validationResult.data.data_collection_results || validationResult.data.dataCollectionResults,
          interviewMetrics: validationResult.data.interview_metrics || validationResult.data.interviewMetrics,
          
          // Audio and metadata
          audioRecordingUrl: validationResult.data.audio_recording_url || validationResult.data.audioRecordingUrl,
          agentData: validationResult.data.agent_data || validationResult.data.agentData,
          conversationMetadata: validationResult.data.conversation_metadata || validationResult.data.conversationMetadata,
        });
      }

      // Create associated interview record
      const interview = await storage.createInterview({
        candidateId: candidate.id,
        candidateEmail: extractedData.email,
        scheduledAt: new Date(validationResult.data.created_at || Date.now()),
        status: "completed",
        completedAt: new Date(validationResult.data.ended_at || Date.now()),
        transcriptUrl: validationResult.data.audio_recording_url || validationResult.data.audioRecordingUrl,
        summary: validationResult.data.summary,
        scorecardJson: {
          overallScore: extractedData.overallScore,
          communicationScore: validationResult.data.communication_score || validationResult.data.communicationScore,
          salesAptitudeScore: validationResult.data.sales_aptitude_score || validationResult.data.salesAptitudeScore,
          motivationScore: validationResult.data.motivation_score || validationResult.data.motivationScore,
          coachabilityScore: validationResult.data.coachability_score || validationResult.data.coachabilityScore,
          professionalPresenceScore: validationResult.data.professional_presence_score || validationResult.data.professionalPresenceScore,
        },
        greenFlags: extractedData.aiExpansionData?.qualifications.concat(extractedData.aiExpansionData?.keySkills || []) || [],
        redFlags: extractedData.aiExpansionData?.concernsOrObjections || [],
      });

      // Log successful processing
      await storage.createAuditLog({
        actor: "elevenlabs_agent",
        action: `candidate_${action}_from_interview`,
        payloadJson: { 
          candidateId: candidate.id,
          interviewId: interview.id,
          conversationId,
          extractedData,
          agentId: AUTHORIZED_AGENT_ID
        },
        pathUsed: "elevenlabs_api",
      });

      console.log(`[ElevenLabs Agent] Successfully ${action} candidate: ${candidate.id} (${extractedData.name || 'Unknown'} - ${extractedData.email})`);

      return {
        success: true,
        candidate,
        interview,
        action,
        details: extractedData
      };

    } catch (error) {
      console.error(`[ElevenLabs Agent] Failed to process conversation ${conversationId}:`, error);
      
      await storage.createAuditLog({
        actor: "elevenlabs_agent",
        action: "conversation_processing_failed",
        payloadJson: { 
          conversationId,
          error: String(error),
          stack: error instanceof Error ? error.stack : undefined
        },
        pathUsed: "elevenlabs_api",
      });

      return {
        success: false,
        action: 'failed',
        error: String(error)
      };
    }
  }

  /**
   * Extract candidate data from conversation with AI enhancement
   */
  private async extractCandidateDataFromConversation(interviewData: any): Promise<CandidateExtractedData> {
    console.log(`[ElevenLabs Agent] Starting data extraction and AI expansion...`);

    // Basic extraction (similar to MCP logic)
    const basicData = this.extractBasicCandidateData(interviewData);
    
    // AI-powered expansion for enhanced candidate profile
    const expandedData = await this.expandCandidateDataWithAI(interviewData, basicData);
    
    return {
      ...basicData,
      ...expandedData
    };
  }

  /**
   * Extract basic candidate data (name, email, phone, score) from interview data
   */
  private extractBasicCandidateData(interviewData: any): Pick<CandidateExtractedData, 'name' | 'email' | 'phone' | 'overallScore' | 'aiExpansionData'> {
    let name = null;
    let email = null;
    let phone = null;
    let overallScore = null;

    // === 1. EXTRACT FROM STRUCTURED DATA FIELDS ===
    const dataCollectionResults = interviewData.data_collection_results || interviewData.dataCollectionResults || {};
    const evaluationDetails = interviewData.evaluation_details || interviewData.evaluationDetails || {};
    const conversationMetadata = interviewData.conversation_metadata || interviewData.conversationMetadata || {};
    const agentData = interviewData.agent_data || interviewData.agentData || {};

    // Try structured data sources first
    name = name || dataCollectionResults.name || evaluationDetails.candidate_name || conversationMetadata.candidate_name || agentData.user?.name;
    email = email || dataCollectionResults.email || evaluationDetails.email || conversationMetadata.email || agentData.user?.email;  
    phone = phone || dataCollectionResults.phone || evaluationDetails.phone || conversationMetadata.phone || agentData.user?.phone;

    // === 2. EXTRACT FROM TRANSCRIPT USING REGEX ===
    const transcript = interviewData.transcript || '';
    let fullTranscriptText = '';
    let userMessages: string[] = [];
    
    console.log(`[ElevenLabs Agent] TRANSCRIPT DEBUG: Type=${typeof transcript}, IsArray=${Array.isArray(transcript)}`);
    
    if (Array.isArray(transcript)) {
      // Parse JSON if it's a string
      let parsedTranscript = transcript;
      if (typeof transcript === 'string') {
        try {
          parsedTranscript = JSON.parse(transcript);
        } catch (e) {
          console.warn('[ElevenLabs Agent] Failed to parse transcript JSON, treating as string');
          parsedTranscript = [];
        }
      }

      // Join all user messages from conversation
      userMessages = parsedTranscript
        .filter((msg: any) => {
          const role = msg.role || msg.speaker;
          return role === 'user' || role === 'human' || role === 'candidate';
        })
        .map((msg: any) => msg.message || msg.text || msg.content || '')
        .filter((text: string) => text && text.length > 3); // Filter out empty/tiny messages
      
      fullTranscriptText = userMessages.join(' ');
      console.log(`[ElevenLabs Agent] EXTRACTED ${userMessages.length} user messages:`, userMessages.slice(0, 3));
    } else if (typeof transcript === 'string') {
      // Try to parse as JSON first
      try {
        const parsedTranscript = JSON.parse(transcript);
        if (Array.isArray(parsedTranscript)) {
          userMessages = parsedTranscript
            .filter((msg: any) => {
              const role = msg.role || msg.speaker;
              return role === 'user' || role === 'human' || role === 'candidate';
            })
            .map((msg: any) => msg.message || msg.text || msg.content || '')
            .filter((text: string) => text && text.length > 3);
          fullTranscriptText = userMessages.join(' ');
        } else {
          fullTranscriptText = transcript;
        }
      } catch (e) {
        fullTranscriptText = transcript;
      }
      console.log(`[ElevenLabs Agent] TRANSCRIPT as string, length=${fullTranscriptText.length}`);
    }

    if (fullTranscriptText) {
      console.log(`[ElevenLabs Agent] FULL TRANSCRIPT TEXT: "${fullTranscriptText.substring(0, 200)}..."`);
      
      // === EXTRACT EMAIL - Handle both @ and "at" formats ===
      if (!email) {
        // First try normal email format
        let emailMatch = fullTranscriptText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        
        // If no @ found, try "at" format like "Rob at FusionDataCo.com"
        if (!emailMatch) {
          const atFormatMatch = fullTranscriptText.match(/([a-zA-Z0-9._%+-]+)\s+at\s+([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
          if (atFormatMatch) {
            const constructedEmail = `${atFormatMatch[1]}@${atFormatMatch[2]}`;
            emailMatch = [constructedEmail]; // Mock the emailMatch array format
            console.log(`[ElevenLabs Agent] CONVERTED "at" format to email: "${constructedEmail}"`);
          }
        }
        
        if (emailMatch) {
          const extractedEmail = emailMatch[0].toLowerCase();
          console.log(`[ElevenLabs Agent] FOUND EMAIL CANDIDATE: "${extractedEmail}"`);
          
          // CRITICAL: Reject conversation IDs and temp emails
          if (!extractedEmail.includes('conversation-') && 
              !extractedEmail.includes('@temp.elevenlabs.com') && 
              !extractedEmail.includes('conv_')) {
            email = extractedEmail;
            console.log(`[ElevenLabs Agent] EMAIL ACCEPTED: "${email}"`);
          } else {
            console.log(`[ElevenLabs Agent] EMAIL REJECTED as fake: "${extractedEmail}"`);
          }
        } else {
          console.log(`[ElevenLabs Agent] NO EMAIL PATTERN FOUND in transcript`);
        }
      }
      
      // === EXTRACT PHONE NUMBER ===
      if (!phone) {
        const phoneMatch = fullTranscriptText.match(/(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\d{10})/);
        if (phoneMatch) {
          phone = phoneMatch[0].replace(/\D/g, ''); // Clean to digits only
          if (phone.length === 10) {
            phone = '+1' + phone; // Add US country code
          }
          console.log(`[ElevenLabs Agent] PHONE EXTRACTED: "${phone}"`);
        }
      }
      
      // === EXTRACT NAME - Improved logic to get user responses ===
      if (!name) {
        // Try multiple name extraction patterns for user responses
        const namePatterns = [
          // Direct name statements
          /(?:my name is|i'm|i am)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
          // Response to name questions (get text after question patterns)
          /(?:name.*?)\?.*?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
          // Simple first words that look like names in user messages
          /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/
        ];
        
        // Try patterns on individual user messages first
        for (const userMessage of userMessages) {
          if (name) break;
          
          console.log(`[ElevenLabs Agent] CHECKING USER MESSAGE FOR NAME: "${userMessage}"`);
          
          for (const pattern of namePatterns) {
            const nameMatch = userMessage.match(pattern);
            if (nameMatch && nameMatch[1]) {
              const extractedName = nameMatch[1].trim();
              console.log(`[ElevenLabs Agent] NAME PATTERN MATCHED: "${extractedName}"`);
              
              // Validate it's a real name, not agent text
              if (extractedName.length >= 2 && 
                  !extractedName.includes('conv_') && 
                  !extractedName.includes('conversation') &&
                  !extractedName.toLowerCase().includes('elevenlabs') &&
                  !extractedName.toLowerCase().includes('tell me') &&
                  !extractedName.toLowerCase().includes('what') &&
                  !extractedName.toLowerCase().includes('how') &&
                  !extractedName.toLowerCase().includes('why')) {
                name = extractedName;
                console.log(`[ElevenLabs Agent] NAME ACCEPTED: "${name}"`);
                break;
              } else {
                console.log(`[ElevenLabs Agent] NAME REJECTED as invalid: "${extractedName}"`);
              }
            }
          }
        }
      }
    }

    // === 3. CALCULATE OVERALL SCORE ===
    // Try direct score fields first
    overallScore = interviewData.overall_score || interviewData.overallScore || interviewData.interview_score || interviewData.interviewScore;
    
    // If no direct score, calculate from subscores
    if (!overallScore) {
      const scores = [
        interviewData.communication_score || interviewData.communicationScore,
        interviewData.sales_aptitude_score || interviewData.salesAptitudeScore,
        interviewData.motivation_score || interviewData.motivationScore,
        interviewData.coachability_score || interviewData.coachabilityScore,
        interviewData.professional_presence_score || interviewData.professionalPresenceScore
      ].filter(score => typeof score === 'number' && score > 0);
      
      if (scores.length > 0) {
        overallScore = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
      }
    }

    console.log(`[ElevenLabs Agent] EXTRACTION RESULTS: name="${name}", email="${email}", phone="${phone}", score=${overallScore}`);
    
    return { 
      name: name || null, 
      email: email || null, 
      phone: phone || null, 
      overallScore: overallScore || null, 
      aiExpansionData: null 
    };
  }

  /**
   * Use AI to expand candidate data with intelligent insights
   */
  private async expandCandidateDataWithAI(interviewData: any, basicData: Partial<CandidateExtractedData>): Promise<Pick<CandidateExtractedData, 'aiExpansionData'>> {
    try {
      console.log(`[ElevenLabs Agent] Starting AI expansion of candidate data...`);

      // Prepare transcript for AI analysis
      let transcript = '';
      if (typeof interviewData.transcript === 'string') {
        try {
          const parsed = JSON.parse(interviewData.transcript);
          if (Array.isArray(parsed)) {
            transcript = parsed.map((msg: any) => 
              `${msg.role || msg.speaker}: ${msg.message || msg.text || msg.content}`
            ).join('\n');
          } else {
            transcript = interviewData.transcript;
          }
        } catch (e) {
          transcript = interviewData.transcript;
        }
      } else if (Array.isArray(interviewData.transcript)) {
        transcript = interviewData.transcript.map((msg: any) => 
          `${msg.role || msg.speaker}: ${msg.message || msg.text || msg.content}`
        ).join('\n');
      }

      // Create AI prompt for candidate expansion
      const prompt = `You are analyzing an insurance sales interview transcript to create a comprehensive candidate profile. Extract detailed insights about this candidate.

INTERVIEW TRANSCRIPT:
${transcript}

BASIC DATA EXTRACTED:
- Name: ${basicData.name || 'Unknown'}
- Email: ${basicData.email || 'Unknown'} 
- Phone: ${basicData.phone || 'Unknown'}
- Overall Score: ${basicData.overallScore || 'Not scored'}

Please analyze the transcript and provide a JSON response with the following structure:
{
  "qualifications": ["list of relevant qualifications, certifications, education"],
  "experience": ["list of relevant work experience, achievements, roles"],
  "interests": ["list of interests that relate to insurance/sales"],
  "personalityTraits": ["list of personality traits observed"],
  "communicationStyle": "description of communication style",
  "professionalismLevel": number_1_to_10,
  "careerGoals": "description of stated career goals",
  "keySkills": ["list of key skills demonstrated"],
  "concernsOrObjections": ["list of concerns or objections raised"],
  "confidenceLevel": number_1_to_10
}

Focus on:
1. Professional background and qualifications
2. Sales experience and achievements  
3. Communication skills and style
4. Career motivation and goals
5. Potential concerns or red flags
6. Overall confidence and professionalism

Provide empty arrays for missing data, not null values. Be specific and detailed based on what you can extract from the transcript.`;

      const aiResponse = await openrouterIntegration.chat(prompt, "orchestrator");

      if (aiResponse && aiResponse.content) {
        try {
          const expandedData = JSON.parse(aiResponse.content);
          console.log(`[ElevenLabs Agent] AI expansion successful:`, expandedData);
          
          return {
            aiExpansionData: {
              qualifications: expandedData.qualifications || [],
              experience: expandedData.experience || [],
              interests: expandedData.interests || [],
              personalityTraits: expandedData.personalityTraits || [],
              communicationStyle: expandedData.communicationStyle || null,
              professionalismLevel: expandedData.professionalismLevel || null,
              careerGoals: expandedData.careerGoals || null,
              keySkills: expandedData.keySkills || [],
              concernsOrObjections: expandedData.concernsOrObjections || [],
              confidenceLevel: expandedData.confidenceLevel || null
            }
          };
        } catch (e) {
          console.warn(`[ElevenLabs Agent] Failed to parse AI response JSON:`, e);
        }
      }
    } catch (error) {
      console.warn(`[ElevenLabs Agent] AI expansion failed:`, error);
    }

    // Return default structure if AI expansion fails
    return {
      aiExpansionData: {
        qualifications: [],
        experience: [],
        interests: [],
        personalityTraits: [],
        communicationStyle: null,
        professionalismLevel: null,
        careerGoals: null,
        keySkills: [],
        concernsOrObjections: [],
        confidenceLevel: null
      }
    };
  }

  // Utility methods
  private calculateDuration(details: any): string {
    if (details.ended_at && details.created_at) {
      const start = new Date(details.created_at);
      const end = new Date(details.ended_at);
      const durationMs = end.getTime() - start.getTime();
      const minutes = Math.floor(durationMs / 60000);
      return `${minutes} minutes`;
    }
    return "Unknown duration";
  }

  private parseDurationSeconds(details: any): number {
    if (details.ended_at && details.created_at) {
      const start = new Date(details.created_at);
      const end = new Date(details.ended_at);
      return Math.floor((end.getTime() - start.getTime()) / 1000);
    }
    return 0;
  }

  private generateSummary(details: any): string {
    if (details.transcript && Array.isArray(details.transcript)) {
      const messageCount = details.transcript.length;
      const userMessages = details.transcript.filter((msg: any) => {
        const role = msg.role || msg.speaker;
        return role === 'user' || role === 'human' || role === 'candidate';
      }).length;
      return `Interview with ${messageCount} total messages (${userMessages} from candidate)`;
    }
    return "Interview conversation completed";
  }

  private generateTranscriptSummary(details: any): string {
    if (details.transcript && Array.isArray(details.transcript)) {
      const userMessages = details.transcript
        .filter((msg: any) => {
          const role = msg.role || msg.speaker;
          return role === 'user' || role === 'human' || role === 'candidate';
        })
        .map((msg: any) => msg.message || msg.text || msg.content)
        .join(' ');
      
      // Return first 500 characters as summary
      return userMessages.substring(0, 500) + (userMessages.length > 500 ? '...' : '');
    }
    return "No transcript summary available";
  }

  private normalizeArrayField(value: any): string[] | null {
    if (Array.isArray(value)) {
      return value;
    } else if (typeof value === 'string') {
      // Try to parse as JSON array
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch (e) {
        // Split by comma if it looks like a comma-separated list
        if (value.includes(',')) {
          return value.split(',').map(item => item.trim());
        }
      }
      return [value];
    }
    return null;
  }
}

// Export singleton instance
export const elevenLabsAgent = new ElevenLabsAgentService();
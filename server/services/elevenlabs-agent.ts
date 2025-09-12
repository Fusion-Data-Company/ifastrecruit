import { elevenlabsIntegration } from "../integrations/elevenlabs";
import { storage } from "../storage";
import { openrouterIntegration } from "../integrations/openrouter";
import { fileStorageService } from "./file-storage";
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
      
      // Download and store files (audio and transcript) if available
      let localAudioFileId: string | null = null;
      let localTranscriptFileId: string | null = null;

      // Download audio recording if available
      const audioUrl = validationResult.data.audio_recording_url || validationResult.data.audioRecordingUrl;
      if (audioUrl && extractedData.email) {
        console.log(`[ElevenLabs Agent] Downloading audio recording for candidate: ${extractedData.email}`);
        const audioResult = await fileStorageService.downloadAudioRecording(audioUrl, conversationId);
        if (audioResult.success && audioResult.file) {
          localAudioFileId = audioResult.file.id;
          console.log(`[ElevenLabs Agent] Audio recording stored with ID: ${localAudioFileId}`);
        } else {
          console.error(`[ElevenLabs Agent] Failed to download audio recording: ${audioResult.error}`);
        }
      }

      // Store transcript as file if available (even without email)
      const transcript = validationResult.data.transcript;
      if (transcript) {
        const candidateIdentifier = extractedData.email || extractedData.name || conversationId;
        console.log(`[ElevenLabs Agent] Storing transcript for candidate: ${candidateIdentifier}`);
        const transcriptResult = await fileStorageService.storeTranscript(
          typeof transcript === 'string' ? transcript : JSON.stringify(transcript),
          conversationId,
          conversationId
        );
        if (transcriptResult.success && transcriptResult.file) {
          localTranscriptFileId = transcriptResult.file.id;
          console.log(`[ElevenLabs Agent] Transcript stored with ID: ${localTranscriptFileId}`);
        } else {
          console.error(`[ElevenLabs Agent] Failed to store transcript: ${transcriptResult.error}`);
        }
      }
      
      // Enhanced validation and candidate creation logic
      let candidateEmail = extractedData.email;
      let isValidEmail = false;
      let shouldCreatePartialCandidate = false;
      
      // Check if we have a valid email
      if (candidateEmail && 
          !candidateEmail.includes('conversation-') && 
          !candidateEmail.includes('@temp.elevenlabs.com') && 
          !candidateEmail.includes('conv_') &&
          candidateEmail.match(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)) {
        isValidEmail = true;
        console.log(`[ElevenLabs Agent] Valid email found: ${candidateEmail}`);
      } else {
        // Check if we have enough data to create a partial candidate
        if (extractedData.name && extractedData.name.length > 2 && extractedData.name !== 'undefined') {
          shouldCreatePartialCandidate = true;
          // Generate a synthetic email for internal tracking
          const nameSlug = extractedData.name.toLowerCase()
            .replace(/[^a-z0-9\s]/g, '') // Remove special characters
            .replace(/\s+/g, '.') // Replace spaces with dots
            .substring(0, 20); // Limit length
          candidateEmail = `${nameSlug}.${conversationId.slice(-8)}@ifast-internal.temp`;
          console.log(`[ElevenLabs Agent] Creating partial candidate with synthetic email: ${candidateEmail}`);
        } else {
          console.error(`[ElevenLabs Agent] Insufficient data for candidate creation: name="${extractedData.name}", email="${extractedData.email}", phone="${extractedData.phone}"`);
          
          await storage.createAuditLog({
            actor: "elevenlabs_agent",
            action: "candidate_creation_insufficient_data", 
            payloadJson: { 
              rejectedEmail: extractedData.email,
              extractedName: extractedData.name,
              extractedPhone: extractedData.phone,
              conversationId,
              reason: "Insufficient data for candidate creation"
            },
            pathUsed: "elevenlabs_api",
          });

          return {
            success: false,
            action: 'failed',
            error: "Insufficient data for candidate creation",
            details: { extractedData }
          };
        }
      }

      // Check if candidate already exists (using final email)
      let existingCandidate = null;
      if (isValidEmail) {
        // Only check for existing candidates if we have a valid email
        existingCandidate = await storage.getCandidateByEmail(candidateEmail);
      }
      
      let candidate;
      let action: 'created' | 'updated';

      if (existingCandidate) {
        // Update existing candidate with new interview data
        action = 'updated';
        candidate = await storage.updateCandidate(existingCandidate.id, {
          // Update basic info if new data is better
          name: extractedData.name || existingCandidate.name,
          email: candidateEmail, // Use final candidate email (may be synthetic)
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
          localAudioFileId: localAudioFileId,
          localTranscriptFileId: localTranscriptFileId,
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
          email: candidateEmail, // Use final candidate email (may be synthetic)
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
          localAudioFileId: localAudioFileId,
          localTranscriptFileId: localTranscriptFileId,
          agentData: validationResult.data.agent_data || validationResult.data.agentData,
          conversationMetadata: validationResult.data.conversation_metadata || validationResult.data.conversationMetadata,
        });
      }

      // Create associated interview record
      const interview = await storage.createInterview({
        candidateId: candidate.id,
        candidateEmail: candidateEmail,
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
          agentId: AUTHORIZED_AGENT_ID,
          partialCandidate: shouldCreatePartialCandidate,
          syntheticEmail: !isValidEmail
        },
        pathUsed: "elevenlabs_api",
      });

      const candidateType = shouldCreatePartialCandidate ? " (partial candidate with synthetic email)" : "";
      console.log(`[ElevenLabs Agent] Successfully ${action} candidate: ${candidate.id} (${extractedData.name || 'Unknown'} - ${candidateEmail})${candidateType}`);

      return {
        success: true,
        candidate,
        interview,
        action,
        details: {
          ...extractedData,
          finalEmail: candidateEmail,
          isValidEmail,
          isPartialCandidate: shouldCreatePartialCandidate
        }
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
   * Extract JSON content from AI response, handling malformed responses
   */
  private extractJsonFromAiResponse(aiResponse: string): any | null {
    if (!aiResponse) return null;

    // Try direct parse first
    try {
      return JSON.parse(aiResponse);
    } catch (e) {
      console.log(`[ElevenLabs Agent] Direct JSON parse failed, attempting extraction...`);
    }

    // Try to find JSON block in response
    try {
      // Look for JSON blocks enclosed in {} 
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const extracted = jsonMatch[0];
        console.log(`[ElevenLabs Agent] Extracted JSON block: ${extracted.substring(0, 100)}...`);
        return JSON.parse(extracted);
      }
    } catch (e) {
      console.warn(`[ElevenLabs Agent] JSON block extraction failed:`, e);
    }

    // Try to find multiple JSON blocks and use the first valid one
    try {
      const jsonBlocks = aiResponse.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g);
      if (jsonBlocks) {
        for (const block of jsonBlocks) {
          try {
            const parsed = JSON.parse(block);
            console.log(`[ElevenLabs Agent] Found valid JSON in block: ${block.substring(0, 100)}...`);
            return parsed;
          } catch (e) {
            continue;
          }
        }
      }
    } catch (e) {
      console.warn(`[ElevenLabs Agent] Multi-block JSON extraction failed:`, e);
    }

    // Last resort: try to clean and extract
    try {
      // Remove common prefixes
      let cleaned = aiResponse
        .replace(/^.*?(?=\{)/s, '') // Remove everything before first {
        .replace(/\}.*$/s, '}'); // Remove everything after last }
      
      if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
        return JSON.parse(cleaned);
      }
    } catch (e) {
      console.warn(`[ElevenLabs Agent] JSON cleanup extraction failed:`, e);
    }

    console.error(`[ElevenLabs Agent] All JSON extraction methods failed. AI Response: ${aiResponse.substring(0, 200)}...`);
    return null;
  }

  /**
   * Use AI to expand candidate data with intelligent insights
   */
  private async expandCandidateDataWithAI(interviewData: any, basicData: Partial<CandidateExtractedData>): Promise<Pick<CandidateExtractedData, 'aiExpansionData'>> {
    const defaultAiData = {
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

      // Skip AI expansion if no meaningful transcript
      if (!transcript || transcript.trim().length < 20) {
        console.log(`[ElevenLabs Agent] Skipping AI expansion - insufficient transcript data (${transcript.length} chars)`);
        return defaultAiData;
      }

      // Create AI prompt for candidate expansion
      const prompt = `TASK: Extract candidate insights from insurance interview transcript. Return ONLY valid JSON.

TRANSCRIPT:
${transcript.substring(0, 2000)}${transcript.length > 2000 ? '...' : ''}

BASIC DATA:
- Name: ${basicData.name || 'Unknown'}
- Email: ${basicData.email || 'Unknown'} 
- Phone: ${basicData.phone || 'Unknown'}

RESPOND WITH ONLY THIS JSON STRUCTURE (no other text):
{
  "qualifications": ["education, certifications, licenses"],
  "experience": ["work experience, achievements"],
  "interests": ["interests relating to insurance/sales"],
  "personalityTraits": ["observed personality traits"],
  "communicationStyle": "communication style description",
  "professionalismLevel": 1-10,
  "careerGoals": "stated career goals",
  "keySkills": ["demonstrated skills"],
  "concernsOrObjections": ["concerns or objections raised"],
  "confidenceLevel": 1-10
}`;

      const aiResponse = await openrouterIntegration.chat(prompt, "orchestrator");

      if (aiResponse && aiResponse.content) {
        const expandedData = this.extractJsonFromAiResponse(aiResponse.content);
        
        if (expandedData && typeof expandedData === 'object') {
          console.log(`[ElevenLabs Agent] AI expansion successful with ${Object.keys(expandedData).length} fields`);
          
          return {
            aiExpansionData: {
              qualifications: Array.isArray(expandedData.qualifications) ? expandedData.qualifications : [],
              experience: Array.isArray(expandedData.experience) ? expandedData.experience : [],
              interests: Array.isArray(expandedData.interests) ? expandedData.interests : [],
              personalityTraits: Array.isArray(expandedData.personalityTraits) ? expandedData.personalityTraits : [],
              communicationStyle: expandedData.communicationStyle || null,
              professionalismLevel: typeof expandedData.professionalismLevel === 'number' ? expandedData.professionalismLevel : null,
              careerGoals: expandedData.careerGoals || null,
              keySkills: Array.isArray(expandedData.keySkills) ? expandedData.keySkills : [],
              concernsOrObjections: Array.isArray(expandedData.concernsOrObjections) ? expandedData.concernsOrObjections : [],
              confidenceLevel: typeof expandedData.confidenceLevel === 'number' ? expandedData.confidenceLevel : null
            }
          };
        } else {
          console.warn(`[ElevenLabs Agent] AI expansion returned invalid data structure`);
        }
      } else {
        console.warn(`[ElevenLabs Agent] AI expansion returned empty response`);
      }
    } catch (error) {
      console.warn(`[ElevenLabs Agent] AI expansion failed with error:`, error);
    }

    // Return default structure if AI expansion fails - this ensures the conversation continues
    console.log(`[ElevenLabs Agent] Using default AI expansion data (AI expansion failed/skipped)`);
    return defaultAiData;
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
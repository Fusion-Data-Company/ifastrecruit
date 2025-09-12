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
   * Format transcript data into human-readable plain text
   */
  private formatTranscriptToPlainText(transcript: any): string {
    if (!transcript) return "";
    
    let formattedText = "";
    
    // Handle array of messages
    if (Array.isArray(transcript)) {
      formattedText = transcript
        .map((msg: any) => {
          const speaker = msg.role || msg.speaker || "Unknown";
          const message = msg.content || msg.text || msg.message || "";
          const timestamp = msg.timestamp || msg.created_at || "";
          
          // Format: "[Timestamp] Speaker: Message"
          if (timestamp) {
            const date = new Date(timestamp);
            if (!isNaN(date.getTime())) {
              return `[${date.toLocaleTimeString()}] ${speaker}: ${message}`;
            }
          }
          return `${speaker}: ${message}`;
        })
        .filter(line => line && line.trim().length > 0)
        .join("\n\n");
    } 
    // Handle string transcript
    else if (typeof transcript === 'string') {
      // Try to parse as JSON first
      try {
        const parsed = JSON.parse(transcript);
        if (Array.isArray(parsed)) {
          return this.formatTranscriptToPlainText(parsed);
        }
      } catch (e) {
        // Not JSON, use as-is
      }
      formattedText = transcript;
    }
    // Handle object with transcript property
    else if (typeof transcript === 'object' && transcript.messages) {
      return this.formatTranscriptToPlainText(transcript.messages);
    }
    
    return formattedText;
  }

  /**
   * Extract rich transcript data including word-level timing, tool calls, and metrics
   */
  private extractRichTranscriptData(transcript: any): any {
    if (!transcript || !Array.isArray(transcript)) {
      return transcript; // Return as-is if not an array
    }

    // Process each message to extract all available fields
    return transcript.map((msg: any) => ({
      // Core message data
      role: msg.role || msg.speaker,
      message: msg.message || msg.content || msg.text,
      
      // Timing data
      time_in_call_secs: msg.time_in_call_secs,
      endTime: msg.endTime,
      secondsFromStart: msg.secondsFromStart,
      time_step_s: msg.time_step_s,
      duration: msg.duration,
      
      // Channel and confidence
      channel_index: msg.channel_index,
      confidence: msg.confidence,
      
      // Word-level data with timing
      words: msg.words ? msg.words.map((word: any) => ({
        word: word.word || word.text,
        start: word.start,
        end: word.end,
        confidence: word.confidence,
        speaker: word.speaker
      })) : undefined,
      
      // Tool calls and results
      tool_calls: msg.tool_calls,
      tool_results: msg.tool_results,
      
      // Feedback data
      feedback: msg.feedback ? {
        type: msg.feedback.type,
        score: msg.feedback.score,
        text: msg.feedback.text
      } : undefined,
      
      // Performance metrics
      conversation_turn_metrics: msg.conversation_turn_metrics,
      
      // Any additional fields
      ...Object.keys(msg).reduce((acc, key) => {
        // Only include fields we haven't explicitly handled
        if (!['role', 'speaker', 'message', 'content', 'text', 'time_in_call_secs', 
              'endTime', 'secondsFromStart', 'time_step_s', 'duration', 'channel_index', 
              'confidence', 'words', 'tool_calls', 'tool_results', 'feedback', 
              'conversation_turn_metrics'].includes(key)) {
          acc[key] = msg[key];
        }
        return acc;
      }, {} as any)
    }));
  }

  /**
   * Extract word-level transcript data for detailed analysis
   */
  private extractWordLevelTranscript(transcript: any): any {
    if (!transcript || !Array.isArray(transcript)) {
      return null;
    }

    const wordLevelData: any[] = [];
    
    transcript.forEach((msg: any) => {
      if (msg.words && Array.isArray(msg.words)) {
        msg.words.forEach((word: any) => {
          wordLevelData.push({
            speaker: msg.role || msg.speaker,
            word: word.word || word.text,
            start_time: word.start,
            end_time: word.end,
            confidence: word.confidence,
            channel_index: msg.channel_index,
            message_index: transcript.indexOf(msg)
          });
        });
      }
    });

    return wordLevelData.length > 0 ? wordLevelData : null;
  }

  /**
   * Extract tool calls and results from transcript
   */
  private extractToolCallsAndResults(transcript: any): { calls: any[], results: any[] } {
    if (!transcript || !Array.isArray(transcript)) {
      return { calls: [], results: [] };
    }

    const calls: any[] = [];
    const results: any[] = [];

    transcript.forEach((msg: any) => {
      if (msg.tool_calls) {
        calls.push(...(Array.isArray(msg.tool_calls) ? msg.tool_calls : [msg.tool_calls]));
      }
      if (msg.tool_results) {
        results.push(...(Array.isArray(msg.tool_results) ? msg.tool_results : [msg.tool_results]));
      }
    });

    return { calls, results };
  }

  /**
   * Extract performance metrics from transcript
   */
  private extractPerformanceMetrics(transcript: any): any {
    if (!transcript || !Array.isArray(transcript)) {
      return null;
    }

    const metrics: any = {
      totalMessages: transcript.length,
      messagesByRole: {},
      averageMessageLength: 0,
      conversationTurns: [],
      timingData: []
    };

    let totalLength = 0;
    
    transcript.forEach((msg: any, index: number) => {
      const role = msg.role || msg.speaker || 'unknown';
      
      // Count messages by role
      metrics.messagesByRole[role] = (metrics.messagesByRole[role] || 0) + 1;
      
      // Calculate message length
      const messageText = msg.message || msg.content || msg.text || '';
      totalLength += messageText.length;
      
      // Collect conversation turn metrics
      if (msg.conversation_turn_metrics) {
        metrics.conversationTurns.push({
          index,
          role,
          metrics: msg.conversation_turn_metrics
        });
      }
      
      // Collect timing data
      if (msg.time_in_call_secs || msg.secondsFromStart) {
        metrics.timingData.push({
          index,
          role,
          timeInCall: msg.time_in_call_secs,
          secondsFromStart: msg.secondsFromStart,
          duration: msg.duration
        });
      }
    });

    metrics.averageMessageLength = transcript.length > 0 ? Math.round(totalLength / transcript.length) : 0;
    
    return metrics;
  }

  /**
   * Process a single conversation and create/update candidate record
   */
  async processConversation(conversationId: string): Promise<ProcessedConversationResult> {
    try {
      console.log(`[ElevenLabs Agent] Processing conversation: ${conversationId}`);

      // Get detailed conversation data from ElevenLabs API
      const conversationDetails = await elevenlabsIntegration.getConversationDetails(conversationId);
      
      // Format transcript as human-readable text
      const formattedTranscript = this.formatTranscriptToPlainText(conversationDetails.transcript);
      
      // Extract all rich data from the API response
      const metadata = conversationDetails.metadata || {};
      const analysis = conversationDetails.analysis || {};
      const initData = conversationDetails.conversation_initiation_client_data || {};
      
      // Extract rich transcript data and metrics
      const transcriptMessages = this.extractRichTranscriptData(conversationDetails.transcript);
      const wordLevelTranscript = this.extractWordLevelTranscript(conversationDetails.transcript);
      const { calls: toolCalls, results: toolResults } = this.extractToolCallsAndResults(conversationDetails.transcript);
      const performanceMetrics = this.extractPerformanceMetrics(conversationDetails.transcript);
      
      // Prepare comprehensive interview data structure with ALL API fields
      const interviewData = {
        // Core fields (keep for backward compatibility)
        agent_id: AUTHORIZED_AGENT_ID,
        agentId: AUTHORIZED_AGENT_ID,
        conversation_id: conversationId,
        conversationId: conversationId,
        agent_name: "iFast Broker Interview Agent",
        agentName: "iFast Broker Interview Agent",
        
        // Plain text transcript (keep for backward compatibility)
        transcript: formattedTranscript,
        
        // Rich transcript data (NEW)
        transcriptMessages: transcriptMessages,
        wordLevelTranscript: wordLevelTranscript,
        toolCalls: toolCalls,
        toolResults: toolResults,
        
        // Performance metrics (NEW)
        conversationTurnMetrics: performanceMetrics?.conversationTurns,
        messageTimings: performanceMetrics?.timingData,
        interviewMetrics: performanceMetrics,
        
        // Duration and counts
        duration: this.calculateDuration(conversationDetails),
        summary: this.generateSummary(conversationDetails),
        call_duration_secs: metadata.call_duration_secs || this.parseDurationSeconds(conversationDetails),
        callDuration: metadata.call_duration_secs || this.parseDurationSeconds(conversationDetails),
        message_count: conversationDetails.transcript ? conversationDetails.transcript.length : 0,
        messageCount: conversationDetails.transcript ? conversationDetails.transcript.length : 0,
        
        // Status information
        status: conversationDetails.status || "completed",
        conversationStatus: conversationDetails.status,
        callStatus: conversationDetails.status || "completed",
        
        // Analysis data
        call_successful: analysis.call_successful !== false,
        callSuccessful: analysis.call_successful !== false,
        transcript_summary: analysis.transcript_summary || this.generateTranscriptSummary(conversationDetails),
        transcriptSummary: analysis.transcript_summary || this.generateTranscriptSummary(conversationDetails),
        call_summary_title: analysis.call_summary_title,
        callSummaryTitle: analysis.call_summary_title,
        conversationNotes: analysis.conversation_notes,
        customAnalysisData: analysis.custom_analysis_data,
        
        // Timestamps (NEW fields)
        created_at: conversationDetails.created_at,
        ended_at: conversationDetails.ended_at,
        startTimeUnixSecs: metadata.start_time_unix_secs,
        endTimeUnixSecs: metadata.end_time_unix_secs,
        
        // Cost and billing (NEW)
        cost: metadata.cost,
        charging: metadata.charging,
        hasChargingTimerTriggered: metadata.has_charging_timer_triggered,
        hasBillingTimerTriggered: metadata.has_billing_timer_triggered,
        
        // Deletion and feedback (NEW)
        deletionSettings: metadata.deletion_settings,
        feedbackScore: metadata.feedback_score,
        feedbackComment: metadata.feedback_comment,
        
        // Connection and authorization (NEW)
        authorizationMethod: metadata.authorization_method,
        creationMethod: metadata.creation_method,
        conversationMode: metadata.conversation_mode,
        source: metadata.source,
        channelId: metadata.channel_id,
        clientIp: metadata.client_ip,
        terminationReason: metadata.termination_reason,
        conversationApiVersion: metadata.conversation_api_version,
        
        // Custom data (NEW)
        customLlmData: metadata.custom_llm_data,
        
        // Audio availability flags (NEW)
        hasAudio: conversationDetails.has_audio,
        hasUserAudio: conversationDetails.has_user_audio,
        hasResponseAudio: conversationDetails.has_response_audio,
        
        // User ID (NEW)
        elevenLabsUserId: conversationDetails.user_id,
        
        // Conversation initiation data (NEW)
        conversationInitiationClientData: initData,
        customLlmExtraBody: initData.custom_llm_extra_body,
        serverUrl: initData.server_url,
        conversationConfigOverride: initData.conversation_config_override,
        customVoiceSettings: initData.custom_voice_settings,
        dynamicVariables: initData.dynamic_variables,
        
        // Evaluation and data collection results
        evaluationCriteria: metadata.evaluation_criteria_results,
        dataCollectionResults: metadata.data_collection_results,
        
        // Include all raw metadata for completeness
        conversationMetadata: metadata,
        agentData: {
          agentId: AUTHORIZED_AGENT_ID,
          agentName: "iFast Broker Interview Agent",
          ...conversationDetails
        },
        
        // Include all fields from metadata directly for backward compatibility
        ...metadata
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
        // Transcript is already formatted as plain text, pass it directly
        const transcriptResult = await fileStorageService.storeTranscript(
          transcript,
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
      
      // Check if we have a valid email - ONLY create candidates with real emails
      if (candidateEmail && 
          !candidateEmail.includes('conversation-') && 
          !candidateEmail.includes('@temp.elevenlabs.com') && 
          !candidateEmail.includes('@ifast-internal.temp') &&
          !candidateEmail.includes('conv_') &&
          candidateEmail.match(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)) {
        isValidEmail = true;
        console.log(`[ElevenLabs Agent] Valid email found: ${candidateEmail}`);
      } else {
        // NO MORE SYNTHETIC CANDIDATES - only create candidates with real email addresses
        console.log(`[ElevenLabs Agent] Skipping candidate creation - no valid email found: name="${extractedData.name}", email="${extractedData.email}", phone="${extractedData.phone}"`);
        
        await storage.createAuditLog({
          actor: "elevenlabs_agent",
          action: "candidate_creation_skipped_no_valid_email", 
          payloadJson: { 
            rejectedEmail: extractedData.email,
            extractedName: extractedData.name,
            extractedPhone: extractedData.phone,
            conversationId,
            reason: "Skipping candidate creation - no valid email address found"
          },
          pathUsed: "elevenlabs_api",
        });

        return {
          success: false,
          action: 'failed',
          error: "No valid email address - candidate creation skipped",
          details: { extractedData }
        };
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
          interviewTranscript: validationResult.data.transcript, // Already formatted as plain text
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
          agentData: validationResult.data.agentData,
          conversationMetadata: validationResult.data.conversationMetadata,
          
          // === NEW FIELDS FROM v3 API ===
          
          // Status and core data
          conversationStatus: validationResult.data.conversationStatus,
          elevenLabsUserId: validationResult.data.elevenLabsUserId,
          
          // Timestamps
          startTimeUnixSecs: validationResult.data.startTimeUnixSecs,
          endTimeUnixSecs: validationResult.data.endTimeUnixSecs,
          
          // Cost and billing
          cost: validationResult.data.cost,
          charging: validationResult.data.charging,
          hasChargingTimerTriggered: validationResult.data.hasChargingTimerTriggered,
          hasBillingTimerTriggered: validationResult.data.hasBillingTimerTriggered,
          
          // Deletion and feedback
          deletionSettings: validationResult.data.deletionSettings,
          feedbackScore: validationResult.data.feedbackScore,
          feedbackComment: validationResult.data.feedbackComment,
          
          // Connection and authorization
          authorizationMethod: validationResult.data.authorizationMethod,
          creationMethod: validationResult.data.creationMethod,
          conversationMode: validationResult.data.conversationMode,
          source: validationResult.data.source,
          channelId: validationResult.data.channelId,
          clientIp: validationResult.data.clientIp,
          terminationReason: validationResult.data.terminationReason,
          conversationApiVersion: validationResult.data.conversationApiVersion,
          
          // Custom data
          customLlmData: validationResult.data.customLlmData,
          
          // Analysis fields
          conversationNotes: validationResult.data.conversationNotes,
          customAnalysisData: validationResult.data.customAnalysisData,
          
          // Audio flags
          hasAudio: validationResult.data.hasAudio,
          hasUserAudio: validationResult.data.hasUserAudio,
          hasResponseAudio: validationResult.data.hasResponseAudio,
          
          // Conversation initiation data
          conversationInitiationClientData: validationResult.data.conversationInitiationClientData,
          
          // Rich transcript data
          transcriptMessages: validationResult.data.transcriptMessages,
          wordLevelTranscript: validationResult.data.wordLevelTranscript,
          toolCalls: validationResult.data.toolCalls,
          toolResults: validationResult.data.toolResults,
          
          // Performance metrics
          conversationTurnMetrics: validationResult.data.conversationTurnMetrics,
          messageTimings: validationResult.data.messageTimings,
          
          // Dynamic variables and configuration
          dynamicVariables: validationResult.data.dynamicVariables,
          conversationConfigOverride: validationResult.data.conversationConfigOverride,
          customVoiceSettings: validationResult.data.customVoiceSettings,
          serverUrl: validationResult.data.serverUrl,
          customLlmExtraBody: validationResult.data.customLlmExtraBody,
          
          // Update score with extracted or calculated value
          score: extractedData.overallScore || existingCandidate.score,
        });
      } else {
        // Create new candidate
        action = 'created';
        candidate = await storage.createCandidate({
          name: extractedData.name || 'Unknown Candidate',
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
          interviewTranscript: validationResult.data.transcript, // Already formatted as plain text
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
          agentData: validationResult.data.agentData,
          conversationMetadata: validationResult.data.conversationMetadata,
          
          // === NEW FIELDS FROM v3 API ===
          
          // Status and core data
          conversationStatus: validationResult.data.conversationStatus,
          elevenLabsUserId: validationResult.data.elevenLabsUserId,
          
          // Timestamps
          startTimeUnixSecs: validationResult.data.startTimeUnixSecs,
          endTimeUnixSecs: validationResult.data.endTimeUnixSecs,
          
          // Cost and billing
          cost: validationResult.data.cost,
          charging: validationResult.data.charging,
          hasChargingTimerTriggered: validationResult.data.hasChargingTimerTriggered,
          hasBillingTimerTriggered: validationResult.data.hasBillingTimerTriggered,
          
          // Deletion and feedback
          deletionSettings: validationResult.data.deletionSettings,
          feedbackScore: validationResult.data.feedbackScore,
          feedbackComment: validationResult.data.feedbackComment,
          
          // Connection and authorization
          authorizationMethod: validationResult.data.authorizationMethod,
          creationMethod: validationResult.data.creationMethod,
          conversationMode: validationResult.data.conversationMode,
          source: validationResult.data.source,
          channelId: validationResult.data.channelId,
          clientIp: validationResult.data.clientIp,
          terminationReason: validationResult.data.terminationReason,
          conversationApiVersion: validationResult.data.conversationApiVersion,
          
          // Custom data
          customLlmData: validationResult.data.customLlmData,
          
          // Analysis fields
          conversationNotes: validationResult.data.conversationNotes,
          customAnalysisData: validationResult.data.customAnalysisData,
          
          // Audio flags
          hasAudio: validationResult.data.hasAudio,
          hasUserAudio: validationResult.data.hasUserAudio,
          hasResponseAudio: validationResult.data.hasResponseAudio,
          
          // Conversation initiation data
          conversationInitiationClientData: validationResult.data.conversationInitiationClientData,
          
          // Rich transcript data
          transcriptMessages: validationResult.data.transcriptMessages,
          wordLevelTranscript: validationResult.data.wordLevelTranscript,
          toolCalls: validationResult.data.toolCalls,
          toolResults: validationResult.data.toolResults,
          
          // Performance metrics
          conversationTurnMetrics: validationResult.data.conversationTurnMetrics,
          messageTimings: validationResult.data.messageTimings,
          
          // Dynamic variables and configuration
          dynamicVariables: validationResult.data.dynamicVariables,
          conversationConfigOverride: validationResult.data.conversationConfigOverride,
          customVoiceSettings: validationResult.data.customVoiceSettings,
          serverUrl: validationResult.data.serverUrl,
          customLlmExtraBody: validationResult.data.customLlmExtraBody,
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
    
    // Merge data with AI overrides taking precedence
    const finalData = {
      ...basicData,
      ...expandedData,
      // AI name and score override basic extraction
      name: expandedData.name || basicData.name,
      overallScore: expandedData.overallScore || basicData.overallScore
    };
    
    console.log(`[ElevenLabs Agent] FINAL EXTRACTION RESULTS: name="${finalData.name}", email="${finalData.email}", phone="${finalData.phone}", score=${finalData.overallScore}`);
    
    return finalData;
  }

  /**
   * Extract basic candidate data (name, email, phone, score) from interview data
   */
  private extractBasicCandidateData(interviewData: any): Pick<CandidateExtractedData, 'name' | 'email' | 'phone' | 'overallScore' | 'aiExpansionData'> {
    let name = null;
    let email = null;
    let phone = null;
    let overallScore = null;

    console.log(`[ElevenLabs Agent] DEBUG - Raw interview data keys:`, Object.keys(interviewData));
    console.log(`[ElevenLabs Agent] DEBUG - Metadata keys:`, Object.keys(interviewData.conversationMetadata || {}));
    console.log(`[ElevenLabs Agent] DEBUG - Agent data keys:`, Object.keys(interviewData.agentData || {}));

    // === 1. EXTRACT FROM STRUCTURED DATA FIELDS ===
    const dataCollectionResults = interviewData.data_collection_results || interviewData.dataCollectionResults || {};
    const evaluationDetails = interviewData.evaluation_details || interviewData.evaluationDetails || {};
    const conversationMetadata = interviewData.conversation_metadata || interviewData.conversationMetadata || {};
    const agentData = interviewData.agent_data || interviewData.agentData || {};
    const metadata = interviewData.metadata || {};

    // Try structured data sources first (but these likely don't exist in real API response)
    name = name || dataCollectionResults.name || evaluationDetails.candidate_name || conversationMetadata.candidate_name || agentData.user?.name || metadata.candidate_name;
    email = email || dataCollectionResults.email || evaluationDetails.email || conversationMetadata.email || agentData.user?.email || metadata.email;  
    phone = phone || dataCollectionResults.phone || evaluationDetails.phone || conversationMetadata.phone || agentData.user?.phone || metadata.phone;

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
      
      // === EXTRACT NAME - Enhanced logic to get user responses ===
      if (!name) {
        // Try multiple name extraction patterns for user responses
        const namePatterns = [
          // Direct name statements
          /(?:my name is|i'm|i am|call me|this is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
          // Response to name questions (get text after question patterns)
          /(?:name.*?)\?.*?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
          // Names in email format like "Rob at FusionDataCo" -> extract "Rob"
          /([A-Z][a-z]+)\s+at\s+[A-Za-z0-9.-]+\.[A-Za-z]{2,}/i,
          // Simple capitalized words that might be names
          /\b([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]+)?)\b/g
        ];
        
        // Try patterns on individual user messages first
        for (const userMessage of userMessages) {
          if (name) break;
          
          console.log(`[ElevenLabs Agent] CHECKING USER MESSAGE FOR NAME: "${userMessage}"`);
          
          for (const pattern of namePatterns) {
            const nameMatches = userMessage.match(pattern);
            if (nameMatches) {
              // Handle global pattern differently
              const potentialNames = pattern.global ? nameMatches : [nameMatches[1]];
              
              for (const match of potentialNames) {
                const extractedName = typeof match === 'string' ? match : match[1];
                if (!extractedName) continue;
                
                const cleanName = extractedName.trim();
                console.log(`[ElevenLabs Agent] NAME PATTERN MATCHED: "${cleanName}"`);
                
                // Enhanced validation for real names
                if (cleanName.length >= 2 && 
                    !cleanName.includes('conv_') && 
                    !cleanName.includes('conversation') &&
                    !cleanName.toLowerCase().includes('elevenlabs') &&
                    !cleanName.toLowerCase().includes('constance') &&
                    !cleanName.toLowerCase().includes('agent') &&
                    !cleanName.toLowerCase().includes('tell me') &&
                    !cleanName.toLowerCase().includes('what') &&
                    !cleanName.toLowerCase().includes('how') &&
                    !cleanName.toLowerCase().includes('why') &&
                    !cleanName.toLowerCase().includes('good') &&
                    !cleanName.toLowerCase().includes('future') &&
                    !cleanName.toLowerCase().includes('sales') &&
                    !cleanName.toLowerCase().includes('pro') &&
                    !/^[a-z]+$/.test(cleanName) && // Not all lowercase
                    !/\d/.test(cleanName) && // No numbers
                    cleanName.split(' ').length <= 3) { // Not more than 3 words
                  name = cleanName;
                  console.log(`[ElevenLabs Agent] NAME ACCEPTED: "${name}"`);
                  break;
                } else {
                  console.log(`[ElevenLabs Agent] NAME REJECTED as invalid: "${cleanName}"`);
                }
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
      } else {
        // Generate a basic score based on conversation length and email presence
        const transcriptLength = fullTranscriptText.length;
        if (email && transcriptLength > 1000) {
          overallScore = 75; // Good engagement if they provided email and had a long conversation
        } else if (email) {
          overallScore = 65; // Moderate if email but short conversation
        } else if (transcriptLength > 500) {
          overallScore = 50; // Basic engagement without email
        } else {
          overallScore = 25; // Low engagement
        }
        console.log(`[ElevenLabs Agent] Generated synthetic score: ${overallScore} based on transcript length: ${transcriptLength}, has email: ${!!email}`);
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
        .replace(/^[\s\S]*?(?=\{)/, '') // Remove everything before first {
        .replace(/\}[\s\S]*$/, '}'); // Remove everything after last }
      
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
  "candidateName": "Extract the candidate's actual name from conversation",
  "overallScore": "Rate candidate 1-100 based on engagement, professionalism, and responses",
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
        console.log(`[ElevenLabs Agent] AI extraction raw response:`, aiResponse.content.substring(0, 500));
        console.log(`[ElevenLabs Agent] AI extraction parsed data:`, expandedData);
        
        if (expandedData && typeof expandedData === 'object') {
          console.log(`[ElevenLabs Agent] AI expansion successful with ${Object.keys(expandedData).length} fields`);
          
          console.log(`[ElevenLabs Agent] AI extracted name: "${expandedData.candidateName}", score: ${expandedData.overallScore}`);
          
          return {
            // Override basic extraction with AI results if available
            name: expandedData.candidateName || null,
            overallScore: typeof expandedData.overallScore === 'number' ? expandedData.overallScore : null,
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
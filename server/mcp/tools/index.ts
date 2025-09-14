import { storage } from "../../storage";
import { apifyIntegration } from "../../integrations/apify";
import { slackIntegration } from "../../integrations/slack";
import { mailjetIntegration } from "../../integrations/mailjet";
import { airtopIntegration } from "../../integrations/airtop";
import { openrouterIntegration } from "../../integrations/openrouter";
import { elevenlabsIntegration } from "../../integrations/elevenlabs";
import ical from "ical-generator";
import { z } from "zod";

// CRITICAL: Only accept data from this specific ElevenLabs agent
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
  transcript: z.string().optional(),
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
}).passthrough(); // Allow additional fields

const CreateCandidateFromInterviewSchema = z.object({
  name: z.string().optional(), // Allow extraction from payload
  email: z.string().optional(), // Allow extraction from payload
  phone: z.string().optional(),
  interviewData: ElevenLabsInterviewDataSchema, // REQUIRED - no optional allowed
  score: z.number().optional(),
  notes: z.string().optional(),
  pipelineStage: z.string().optional().default("FIRST_INTERVIEW"),
});

export async function launchCampaign(args: any) {
  try {
    const campaign = await storage.createCampaign({
      name: args.title,
      source: "APIFY",
      paramsJson: args,
      status: "ACTIVE",
    });
    
    return {
      success: true,
      campaignId: campaign.id,
      message: "Campaign launched successfully",
    };
  } catch (error) {
    // Fallback to Airtop
    await storage.createAuditLog({
      actor: "mcp",
      action: "launch_campaign_fallback",
      payloadJson: { error: String(error), args },
      pathUsed: "airtop",
    });

    const result = await airtopIntegration.executeRecipe("job.post", args);
    return {
      success: true,
      message: "Campaign launched via Airtop fallback",
      airtopResult: result,
    };
  }
}

export async function manageApifyActor(args: any) {
  const { action, actorId, configuration } = args;

  try {
    switch (action) {
      case "create":
        const actor = await storage.createApifyActor({
          name: args.name,
          actorId: args.actorId,
          configurationJson: configuration,
        });
        return { success: true, actor };

      case "run":
        const runResult = await apifyIntegration.runActor(actorId, configuration);
        await storage.updateApifyActor(actorId, { lastRun: new Date() });
        return { success: true, runId: runResult.id };

      case "monitor":
        const status = await apifyIntegration.getRunStatus(args.runId);
        return { success: true, status };

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    // Fallback to Airtop
    await storage.createAuditLog({
      actor: "mcp",
      action: "manage_apify_actor_fallback",
      payloadJson: { error: String(error), args },
      pathUsed: "airtop",
    });

    const result = await airtopIntegration.executeRecipe("apify.run_or_fix", args);
    return { success: true, message: "Actor managed via Airtop", result };
  }
}

export async function processCandidate(args: any) {
  const { candidateId, newStage, notes } = args;

  try {
    // Update candidate stage
    const candidate = await storage.updateCandidate(candidateId, {
      pipelineStage: newStage,
    });

    // Recompute score based on stage progression
    const newScore = calculateCandidateScore(candidate, newStage);
    await storage.updateCandidate(candidateId, { score: newScore });

    // Log candidate disposition change
    if (candidate.sourceRef && newStage === "REJECTED") {
      await storage.createAuditLog({
        actor: "mcp",
        action: "candidate_disposition_updated",
        payloadJson: { candidateId, sourceRef: candidate.sourceRef, newStage },
        pathUsed: "api",
      });
    }

    // Post to appropriate Slack pool
    const slackChannel = newStage === "HIRED" ? "#ifast_hires" : "#ifast_round_one";
    await slackIntegration.postUpdate(slackChannel, 
      `Candidate ${candidate.name} moved to ${newStage}`, 
      { candidateId, newStage, notes }
    );

    return {
      success: true,
      candidate,
      newScore,
      slackPosted: true,
    };
  } catch (error) {
    throw new Error(`Failed to process candidate: ${String(error)}`);
  }
}

export async function sendInterviewLinks(args: any) {
  const { candidateIds, templateType = "INTERVIEW_INVITE" } = args;

  try {
    const results = [];
    for (const candidateId of candidateIds) {
      const candidate = await storage.getCandidate(candidateId);
      if (!candidate) continue;

      const interviewToken = generateSecureToken();
      const interviewUrl = `${process.env.APP_BASE_URL}/interview/${interviewToken}`;

      await mailjetIntegration.sendTemplate(
        candidate.email,
        templateType,
        {
          candidateName: candidate.name,
          interviewUrl,
        }
      );

      results.push({ candidateId, sent: true, interviewUrl });
    }

    return { success: true, results };
  } catch (error) {
    throw new Error(`Failed to send interview links: ${String(error)}`);
  }
}

export async function createCalendarSlots(args: any) {
  const { startDate, endDate, duration = 60, timeZone = "UTC" } = args;

  try {
    // Generate available slots
    const slots = generateTimeSlots(startDate, endDate, duration);
    
    return {
      success: true,
      slots,
      count: slots.length,
    };
  } catch (error) {
    throw new Error(`Failed to create calendar slots: ${String(error)}`);
  }
}

export async function bookInterview(args: any) {
  const { candidateId, startTs, endTs, location } = args;

  try {
    const candidate = await storage.getCandidate(candidateId);
    if (!candidate) {
      throw new Error("Candidate not found");
    }

    // Generate ICS file
    const calendar = ical({
      name: "iFast Broker Interviews",
    });

    calendar.createEvent({
      start: new Date(startTs),
      end: new Date(endTs),
      summary: `Interview with ${candidate.name}`,
      description: `Interview session for ${candidate.name}`,
      location: location || "Video Call",
      organizer: "iFast Broker <noreply@ifast-broker.com>",
      attendees: [{ email: candidate.email, name: candidate.name }],
    });

    const icsContent = calendar.toString();
    const icsUrl = await storage.saveICSFile(icsContent);

    const booking = await storage.createBooking({
      candidateId,
      startTs: new Date(startTs),
      endTs: new Date(endTs),
      location,
      icsUrl,
      status: "CONFIRMED",
    });

    // Send confirmation email
    await mailjetIntegration.sendTemplate(
      candidate.email,
      "BOOKING_CONFIRM",
      {
        candidateName: candidate.name,
        interviewDate: new Date(startTs).toLocaleDateString(),
        interviewTime: new Date(startTs).toLocaleTimeString(),
        icsUrl,
      }
    );

    return {
      success: true,
      booking,
      icsUrl,
    };
  } catch (error) {
    throw new Error(`Failed to book interview: ${String(error)}`);
  }
}

export async function upsertCandidate(args: any) {
  try {
    const existingCandidate = await storage.getCandidateByEmail(args.email);
    
    if (existingCandidate) {
      const updated = await storage.updateCandidate(existingCandidate.id, args);
      return { success: true, candidate: updated, action: "updated" };
    } else {
      const created = await storage.createCandidate(args);
      return { success: true, candidate: created, action: "created" };
    }
  } catch (error) {
    throw new Error(`Failed to upsert candidate: ${String(error)}`);
  }
}

// CRITICAL: Data extraction utilities for ElevenLabs conversations
type ExtractedCandidateData = {
  name: string | undefined;
  email: string | undefined;
  phone: string | undefined;
  overallScore: number | undefined;
  // ElevenLabs conversation data
  agentId?: string;
  conversationId?: string;
  interviewDate?: Date;
  callDuration?: number;
  messageCount?: number;
  callStatus?: string;
  callSuccessful?: string;
  agentName?: string;
  audioRecordingUrl?: string;
  localAudioFileId?: string;
  localTranscriptFileId?: string;
  // Interview content
  interviewTranscript?: string;
  transcriptSummary?: string;
  callSummaryTitle?: string;
  interviewSummary?: string;
  interviewDuration?: string;
  // Interview responses
  whyInsurance?: string;
  whyNow?: string;
  salesExperience?: string;
  difficultCustomerStory?: string;
  consultativeSelling?: string;
  preferredMarkets?: string[];
  timeline?: string;
  recommendedNextSteps?: string;
  // Performance indicators
  demoCallPerformed?: boolean;
  kevinPersonaUsed?: boolean;
  coachingGiven?: boolean;
  pitchDelivered?: boolean;
  // Scores
  communicationScore?: number;
  salesAptitudeScore?: number;
  motivationScore?: number;
  coachabilityScore?: number;
  professionalPresenceScore?: number;
  // Development
  strengths?: string[];
  developmentAreas?: string[];
  // Structured data
  interviewData?: any;
  evaluationCriteria?: any;
  dataCollectionResults?: any;
  agentData?: any;
  conversationMetadata?: any;
  evaluationDetails?: any;
  interviewMetrics?: any;
};

function extractCandidateDataFromPayload(interviewData: any): ExtractedCandidateData {
  let name: string | undefined = undefined;
  let email: string | undefined = undefined;
  let phone: string | undefined = undefined;
  let overallScore: number | undefined = undefined;

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
  
  console.log(`[MCP] 🔍 TRANSCRIPT DEBUG: Type=${typeof transcript}, IsArray=${Array.isArray(transcript)}`);
  
  if (Array.isArray(transcript)) {
    // Join all user messages from conversation
    userMessages = transcript
      .filter(msg => {
        const role = msg.role || msg.speaker;
        return role === 'user' || role === 'human' || role === 'candidate';
      })
      .map(msg => msg.message || msg.text || msg.content || '')
      .filter(text => text && text.length > 3); // Filter out empty/tiny messages
    
    fullTranscriptText = userMessages.join(' ');
    console.log(`[MCP] 🔍 EXTRACTED ${userMessages.length} user messages:`, userMessages.slice(0, 3));
  } else if (typeof transcript === 'string') {
    fullTranscriptText = transcript;
    console.log(`[MCP] 🔍 TRANSCRIPT as string, length=${fullTranscriptText.length}`);
  }

  if (fullTranscriptText) {
    console.log(`[MCP] 🔍 FULL TRANSCRIPT TEXT: "${fullTranscriptText.substring(0, 200)}..."`);
    
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
          console.log(`[MCP] 🔍 CONVERTED "at" format to email: "${constructedEmail}"`);
        }
      }
      
      if (emailMatch) {
        const extractedEmail = emailMatch[0].toLowerCase();
        console.log(`[MCP] 🔍 FOUND EMAIL CANDIDATE: "${extractedEmail}"`);
        
        // CRITICAL: Reject conversation IDs and temp emails
        if (!extractedEmail.includes('conversation-') && 
            !extractedEmail.includes('@temp.elevenlabs.com') && 
            !extractedEmail.includes('conv_')) {
          email = extractedEmail;
          console.log(`[MCP] ✅ EMAIL ACCEPTED: "${email}"`);
        } else {
          console.log(`[MCP] ❌ EMAIL REJECTED as fake: "${extractedEmail}"`);
        }
      } else {
        console.log(`[MCP] ❌ NO EMAIL PATTERN FOUND in transcript`);
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
        console.log(`[MCP] ✅ PHONE EXTRACTED: "${phone}"`);
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
        
        console.log(`[MCP] 🔍 CHECKING USER MESSAGE FOR NAME: "${userMessage}"`);
        
        for (const pattern of namePatterns) {
          const nameMatch = userMessage.match(pattern);
          if (nameMatch && nameMatch[1]) {
            const extractedName = nameMatch[1].trim();
            console.log(`[MCP] 🔍 NAME PATTERN MATCHED: "${extractedName}"`);
            
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
              console.log(`[MCP] ✅ NAME ACCEPTED: "${name}"`);
              break;
            } else {
              console.log(`[MCP] ❌ NAME REJECTED as invalid: "${extractedName}"`);
            }
          }
        }
      }
      
      // Fallback: try patterns on full transcript if no name found in individual messages
      if (!name) {
        for (const pattern of namePatterns) {
          const nameMatch = fullTranscriptText.match(pattern);
          if (nameMatch && nameMatch[1]) {
            const extractedName = nameMatch[1].trim();
            console.log(`[MCP] 🔍 FALLBACK NAME PATTERN: "${extractedName}"`);
            
            if (extractedName.length >= 2 && 
                !extractedName.includes('conv_') && 
                !extractedName.includes('conversation') &&
                !extractedName.toLowerCase().includes('elevenlabs') &&
                !extractedName.toLowerCase().includes('tell me') &&
                !extractedName.toLowerCase().includes('what')) {
              name = extractedName;
              console.log(`[MCP] ✅ FALLBACK NAME ACCEPTED: "${name}"`);
              break;
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

  console.log(`[MCP] 🔍 EXTRACTION RESULTS: name="${name}", email="${email}", phone="${phone}", score=${overallScore}`);
  
  // Build comprehensive extracted data object
  const result: ExtractedCandidateData = {
    name,
    email, 
    phone,
    overallScore,
    // Core ElevenLabs data
    agentId: interviewData.agent_id || interviewData.agentId,
    conversationId: interviewData.conversation_id || interviewData.conversationId,
    callDuration: interviewData.call_duration_secs || interviewData.callDuration,
    messageCount: interviewData.message_count || interviewData.messageCount,
    callStatus: interviewData.status || interviewData.callStatus,
    callSuccessful: typeof (interviewData.call_successful || interviewData.callSuccessful) === 'string' ? 
                    (interviewData.call_successful || interviewData.callSuccessful) : 
                    typeof (interviewData.call_successful || interviewData.callSuccessful) === 'boolean' ? 
                    String(interviewData.call_successful || interviewData.callSuccessful) : undefined,
    agentName: interviewData.agent_name || interviewData.agentName,
    audioRecordingUrl: interviewData.audio_recording_url || interviewData.audioRecordingUrl,
    // Interview content
    interviewTranscript: interviewData.transcript,
    transcriptSummary: interviewData.transcript_summary || interviewData.transcriptSummary,
    callSummaryTitle: interviewData.call_summary_title || interviewData.callSummaryTitle,
    interviewSummary: interviewData.summary,
    interviewDuration: interviewData.duration,
    // Interview responses (convert null to undefined)
    whyInsurance: interviewData.why_insurance || interviewData.whyInsurance || undefined,
    whyNow: interviewData.why_now || interviewData.whyNow || undefined,
    salesExperience: interviewData.sales_experience || interviewData.salesExperience || undefined,
    difficultCustomerStory: interviewData.difficult_customer_story || interviewData.difficultCustomerStory || undefined,
    consultativeSelling: interviewData.consultative_selling || interviewData.consultativeSelling || undefined,
    preferredMarkets: Array.isArray(interviewData.preferred_markets) ? interviewData.preferred_markets : 
                      Array.isArray(interviewData.preferredMarkets) ? interviewData.preferredMarkets : 
                      typeof interviewData.preferred_markets === 'string' ? [interviewData.preferred_markets] :
                      typeof interviewData.preferredMarkets === 'string' ? [interviewData.preferredMarkets] : undefined,
    timeline: interviewData.timeline || undefined,
    recommendedNextSteps: interviewData.recommended_next_steps || interviewData.recommendedNextSteps || undefined,
    // Performance indicators
    demoCallPerformed: interviewData.demo_call_performed || interviewData.demoCallPerformed || false,
    kevinPersonaUsed: interviewData.kevin_persona_used || interviewData.kevinPersonaUsed || false,
    coachingGiven: interviewData.coaching_given || interviewData.coachingGiven || false,
    pitchDelivered: interviewData.pitch_delivered || interviewData.pitchDelivered || false,
    // Individual scores (convert null to undefined)
    communicationScore: interviewData.communication_score || interviewData.communicationScore || undefined,
    salesAptitudeScore: interviewData.sales_aptitude_score || interviewData.salesAptitudeScore || undefined,
    motivationScore: interviewData.motivation_score || interviewData.motivationScore || undefined,
    coachabilityScore: interviewData.coachability_score || interviewData.coachabilityScore || undefined,
    professionalPresenceScore: interviewData.professional_presence_score || interviewData.professionalPresenceScore || undefined,
    // Development data (convert null to undefined)
    strengths: interviewData.strengths || undefined,
    developmentAreas: interviewData.development_areas || interviewData.developmentAreas || undefined,
    // Structured data (JSONB fields)
    interviewData: interviewData,
    evaluationCriteria: interviewData.evaluation_criteria_results || interviewData.evaluationCriteria,
    dataCollectionResults: interviewData.data_collection_results || interviewData.dataCollectionResults,
    agentData: interviewData.agent_data || interviewData.agentData,
    conversationMetadata: interviewData.conversation_metadata || interviewData.conversationMetadata,
    evaluationDetails: interviewData.evaluation_details || interviewData.evaluationDetails,
    interviewMetrics: interviewData.interview_metrics || interviewData.interviewMetrics
  };
  
  // Parse interview date
  if (interviewData.interview_date || interviewData.start_time_unix_secs) {
    const timestamp = interviewData.interview_date || ((interviewData.start_time_unix_secs || 0) * 1000);
    result.interviewDate = new Date(timestamp);
  }
  
  return result;
}

// Specialized tool for ElevenLabs interview agents to create candidates
export async function createCandidateFromInterview(args: any) {
  try {
    // CRITICAL: Validate entire payload structure first
    const validationResult = CreateCandidateFromInterviewSchema.safeParse(args);
    if (!validationResult.success) {
      const errors = validationResult.error.format();
      console.error('[MCP] Validation failed for createCandidateFromInterview:', errors);
      
      await storage.createAuditLog({
        actor: "mcp",
        action: "create_candidate_from_interview_validation_failed",
        payloadJson: { 
          errors: errors,
          rejectedPayload: args,
          reason: "Failed Zod schema validation"
        },
        pathUsed: "elevenlabs_validation",
      });

      return {
        success: false,
        error: "Validation failed",
        details: errors,
        message: "Payload validation failed - data rejected"
      };
    }

    const {
      name: inputName,
      email: inputEmail,
      phone: inputPhone,
      interviewData,
      score: inputScore,
      notes,
      pipelineStage = "FIRST_INTERVIEW"
    } = validationResult.data;

    // CRITICAL: Extract REAL candidate data from ElevenLabs payload
    console.log(`[MCP] 🔍 Starting data extraction from ElevenLabs payload...`);
    const extractedData = extractCandidateDataFromPayload(interviewData);
    
    // Use extracted data, fallback to input data
    const name = extractedData.name || inputName;
    const email = extractedData.email || inputEmail;
    const phone = extractedData.phone || inputPhone;
    const score = extractedData.overallScore || inputScore || 0;

    // CRITICAL VALIDATION: NEVER create candidates with fake emails
    if (!email || 
        email.includes('conversation-') || 
        email.includes('@temp.elevenlabs.com') || 
        email.includes('@ifast-internal.temp') ||
        email.includes('conv_') ||
        !email.match(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)) {
      
      console.error(`[MCP] 🚫 CRITICAL VALIDATION FAILURE: Invalid or fake email detected: "${email}"`);
      
      await storage.createAuditLog({
        actor: "mcp",
        action: "create_candidate_from_interview_fake_email_rejected", 
        payloadJson: { 
          rejectedEmail: email,
          extractedName: name,
          reason: "FAKE EMAIL REJECTION: Will not create candidate with invalid/fake email",
          securityLevel: "CRITICAL",
          timestamp: new Date().toISOString(),
          extractionResults: extractedData
        },
        pathUsed: "elevenlabs_data_integrity_enforcement",
      });

      return {
        success: false,
        error: "DATA INTEGRITY VIOLATION: Invalid email address",
        message: `REJECTED: Will not create candidate with fake/invalid email: "${email}". Real candidate data must be extracted.`,
        extractedData,
        code: 422
      };
    }

    // CRITICAL VALIDATION: NEVER create candidates with fake names
    if (!name || 
        name.includes('ElevenLabs') || 
        name.includes('Interview Candidate') || 
        name.includes('conv_') ||
        name.length < 3) {
      
      console.error(`[MCP] 🚫 CRITICAL VALIDATION FAILURE: Invalid or fake name detected: "${name}"`);
      
      await storage.createAuditLog({
        actor: "mcp",
        action: "create_candidate_from_interview_fake_name_rejected",
        payloadJson: { 
          rejectedName: name,
          extractedEmail: email,
          reason: "FAKE NAME REJECTION: Will not create candidate with invalid/fake name",
          securityLevel: "CRITICAL", 
          timestamp: new Date().toISOString(),
          extractionResults: extractedData
        },
        pathUsed: "elevenlabs_data_integrity_enforcement",
      });

      return {
        success: false,
        error: "DATA INTEGRITY VIOLATION: Invalid name", 
        message: `REJECTED: Will not create candidate with fake/invalid name: "${name}". Real candidate data must be extracted.`,
        extractedData,
        code: 422
      };
    }

    console.log(`[MCP] ✅ VALIDATION PASSED: Real candidate data extracted - name="${name}", email="${email}"`);

    // CRITICAL: STRICT Agent ID validation - ALWAYS REQUIRED, NO EXCEPTIONS
    const agentId = interviewData.agent_id || interviewData.agentId;
    
    // HARD REJECTION: Missing agent ID
    if (!agentId) {
      console.error('[MCP] SECURITY VIOLATION: No agent ID found in interview data - REJECTING');
      
      await storage.createAuditLog({
        actor: "mcp", 
        action: "create_candidate_from_interview_security_violation_no_agent_id",
        payloadJson: { 
          rejectedPayload: args,
          reason: "SECURITY VIOLATION: Missing required agent ID",
          securityLevel: "CRITICAL",
          timestamp: new Date().toISOString()
        },
        pathUsed: "elevenlabs_security_enforcement",
      });

      return {
        success: false,
        error: "SECURITY VIOLATION: Missing agent ID",
        message: `UNAUTHORIZED ACCESS: Agent ID is mandatory. Only agent ${AUTHORIZED_AGENT_ID} is authorized.`,
        code: 401
      };
    }

    // HARD REJECTION: Wrong agent ID
    if (agentId !== AUTHORIZED_AGENT_ID) {
      console.error(`[MCP] SECURITY VIOLATION: Unauthorized agent ID: ${agentId}. Only ${AUTHORIZED_AGENT_ID} is authorized - REJECTING`);
      
      await storage.createAuditLog({
        actor: "mcp",
        action: "create_candidate_from_interview_security_violation_unauthorized_agent",
        payloadJson: { 
          unauthorizedAgentId: agentId,
          authorizedAgentId: AUTHORIZED_AGENT_ID,
          rejectedPayload: args,
          reason: "SECURITY VIOLATION: Unauthorized agent attempting data submission",
          securityLevel: "CRITICAL",
          timestamp: new Date().toISOString()
        },
        pathUsed: "elevenlabs_security_enforcement",
      });

      return {
        success: false,
        error: "SECURITY VIOLATION: Unauthorized agent",
        message: `UNAUTHORIZED ACCESS: Agent ${agentId} is not authorized. Only agent ${AUTHORIZED_AGENT_ID} can submit interview data.`,
        code: 401
      };
    }

    console.log(`[MCP] ✅ STRICT Security validation passed for authorized agent: ${agentId}`);

    console.log(`[MCP] ✅ SECURITY CHECKPOINT PASSED: createCandidateFromInterview called with validated data from authorized agent ${agentId}`);

    // No additional extraction needed - extractedData already contains all fields from the function

    // Check if candidate already exists
    let existingCandidate;
    try {
      existingCandidate = await storage.getCandidateByEmail(email);
    } catch (error) {
      existingCandidate = null;
    }
    
    if (existingCandidate) {
      // Update existing candidate with ALL interview data
      const updateData = {
        pipelineStage: pipelineStage as "FIRST_INTERVIEW" | "NEW" | "TECHNICAL_SCREEN" | "FINAL_INTERVIEW" | "OFFER" | "HIRED" | "REJECTED",
        score: score || existingCandidate.score,
        interviewScore: score,
        notes,
        ...extractedData
      };
      
      console.log('[MCP] Updating existing candidate with data:', updateData);
      const updated = await storage.updateCandidate(existingCandidate.id, updateData);

      // Create interview record
      let interview = null;
      try {
        interview = await storage.createInterview({
          candidateId: existingCandidate.id,
          candidateEmail: existingCandidate.email,
          scheduledAt: extractedData.interviewDate || new Date(),
          status: "completed",
          summary: notes || extractedData.interviewSummary || "Interview completed via ElevenLabs agent",
          scorecardJson: interviewData || {},
          transcriptUrl: extractedData.interviewTranscript || "",
          completedAt: extractedData.interviewDate || new Date(),
        });
      } catch (interviewError) {
        console.log("Failed to create interview record (non-critical):", interviewError);
      }

      // Log successful update
      await storage.createAuditLog({
        actor: "mcp",
        action: "create_candidate_from_interview_update_success",
        payloadJson: { 
          candidateId: existingCandidate.id,
          email: existingCandidate.email,
          agentId: extractedData.agentId,
          fieldsUpdated: Object.keys(updateData),
          fieldCount: Object.keys(updateData).length,
          securityLevel: "SUCCESS",
          timestamp: new Date().toISOString()
        },
        pathUsed: "elevenlabs_update_success",
      });

      return {
        success: true,
        candidate: updated,
        interview,
        action: "updated_existing",
        message: "Candidate updated with interview data"
      };
    } else {
      // Create new candidate with ALL interview data
      const candidateData: any = {
        pipelineStage: pipelineStage as "FIRST_INTERVIEW" | "NEW" | "TECHNICAL_SCREEN" | "FINAL_INTERVIEW" | "OFFER" | "HIRED" | "REJECTED",
        score: score || 0,
        interviewScore: score,
        sourceRef: "elevenlabs_interview",
        notes,
        ...extractedData,
        // Override with final values to avoid duplicates
        name,
        email
      };
      
      if (phone) candidateData.phone = phone;
      
      console.log('[MCP] Creating new candidate with data:', candidateData);
      const candidate = await storage.createCandidate(candidateData);

      // Create interview record (optional)
      let interview = null;
      try {
        interview = await storage.createInterview({
          candidateId: candidate.id,
          candidateEmail: candidate.email,
          scheduledAt: extractedData.interviewDate || new Date(),
          status: "completed",
          summary: notes || extractedData.interviewSummary || "Interview completed via ElevenLabs agent",
          scorecardJson: interviewData || {},
          transcriptUrl: extractedData.interviewTranscript || "",
          completedAt: extractedData.interviewDate || new Date(),
        });
      } catch (interviewError) {
        console.log("Failed to create interview record (non-critical):", interviewError);
      }

      // Log successful creation
      await storage.createAuditLog({
        actor: "mcp",
        action: "create_candidate_from_interview_create_success",
        payloadJson: { 
          candidateId: candidate.id,
          email: candidate.email,
          agentId: extractedData.agentId,
          fieldsCreated: Object.keys(candidateData),
          fieldCount: Object.keys(candidateData).length,
          securityLevel: "SUCCESS",
          timestamp: new Date().toISOString()
        },
        pathUsed: "elevenlabs_create_success",
      });

      return {
        success: true,
        candidate,
        interview,
        action: "created_new",
        message: "New candidate created from interview data"
      };
    }
  } catch (error) {
    console.log('[MCP] Error in createCandidateFromInterview:', error);
    return {
      success: false,
      error: String(error),
      message: "Failed to create candidate from interview"
    };
  }
}

export async function writeInterview(args: any) {
  try {
    const interview = await storage.createInterview(args);
    return { success: true, interview };
  } catch (error) {
    throw new Error(`Failed to write interview: ${String(error)}`);
  }
}

export async function updateSlackPools(args: any) {
  try {
    await slackIntegration.ensurePools();
    
    if (args.message && args.channel) {
      await slackIntegration.postUpdate(args.channel, args.message, args.blocks);
    }

    return { success: true, message: "Slack pools updated" };
  } catch (error) {
    throw new Error(`Failed to update Slack pools: ${String(error)}`);
  }
}

export async function operateBrowser(args: any) {
  try {
    const result = await airtopIntegration.executeRecipe(args.recipe, args.params);
    
    await storage.createAuditLog({
      actor: "mcp",
      action: "operate_browser",
      payloadJson: { recipe: args.recipe, params: args.params },
      pathUsed: "airtop",
    });

    return { success: true, result };
  } catch (error) {
    throw new Error(`Browser operation failed: ${String(error)}`);
  }
}

export async function llmRoute(args: any) {
  try {
    const { prompt, profile = "orchestrator" } = args;
    const response = await openrouterIntegration.chat(prompt, profile);
    return { success: true, response };
  } catch (error) {
    throw new Error(`LLM routing failed: ${String(error)}`);
  }
}

// Helper functions
function calculateCandidateScore(candidate: any, stage: string): number {
  const baseScore = candidate.score || 0;
  const stageBonus: Record<string, number> = {
    "NEW": 0,
    "FIRST_INTERVIEW": 20,
    "TECHNICAL_SCREEN": 40,
    "FINAL_INTERVIEW": 70,
    "OFFER": 85,
    "HIRED": 100,
    "REJECTED": -50,
  };

  return Math.max(0, Math.min(100, baseScore + (stageBonus[stage] || 0)));
}

function generateTimeSlots(startDate: string, endDate: string, duration: number) {
  const slots = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  while (start < end) {
    const slotEnd = new Date(start.getTime() + duration * 60000);
    slots.push({
      start: start.toISOString(),
      end: slotEnd.toISOString(),
      available: true,
    });
    start.setTime(start.getTime() + duration * 60000);
  }
  
  return slots;
}

function generateSecureToken(): string {
  return require("crypto").randomBytes(32).toString("hex");
}

// ===== ELEVENLABS MCP TOOLS =====

/**
 * List ElevenLabs conversations with filtering options
 */
export async function listConversations(args: any) {
  try {
    const { agent_id, start_date, end_date, limit = 100, offset = 0, status } = args;
    
    // SECURITY: Enforce authorized agent ID only
    const validatedAgentId = AUTHORIZED_AGENT_ID;
    if (agent_id && agent_id !== AUTHORIZED_AGENT_ID) {
      throw new Error(`SECURITY: Unauthorized agent ID. Access denied.`);
    }
    
    // SECURITY: Enforce pagination limits
    const safeLimit = Math.min(Math.max(1, limit), 100);
    const safeOffset = Math.max(0, offset);

    const result = await elevenlabsIntegration.listConversations({
      agent_id: validatedAgentId,
      start_date,
      end_date,
      limit: safeLimit,
      offset: safeOffset,
      status
    });

    await storage.createAuditLog({
      actor: "mcp",
      action: "list_conversations",
      payloadJson: { agent_id: validatedAgentId, start_date, end_date, limit: safeLimit, offset: safeOffset, status },
    });

    return {
      success: true,
      conversations: result.conversations || [],
      total: result.total || 0,
      hasMore: result.hasMore || false,
      limit_applied: safeLimit,
      offset_applied: safeOffset
    };
  } catch (error) {
    throw new Error(`Failed to list conversations: ${String(error)}`);
  }
}

/**
 * Get full transcript with metadata for a conversation
 */
export async function getConversationTranscript(args: any) {
  try {
    const { conversation_id, format = 'json' } = args;
    
    if (!conversation_id) {
      throw new Error('conversation_id is required');
    }

    const result = await elevenlabsIntegration.getConversationDetails(conversation_id);
    
    // Format transcript based on requested format
    let formattedTranscript = result.transcript;
    if (format === 'text' && result.transcript) {
      formattedTranscript = result.transcript;
    } else if (format === 'srt' && result.wordLevelTranscript) {
      formattedTranscript = formatTranscriptAsSRT(result.wordLevelTranscript);
    } else if (format === 'vtt' && result.wordLevelTranscript) {
      formattedTranscript = formatTranscriptAsVTT(result.wordLevelTranscript);
    }

    // SECURITY: Audit log without PII - don't log transcript content
    await storage.createAuditLog({
      actor: "mcp",
      action: "get_conversation_transcript",
      payloadJson: { conversation_id, format, transcript_length: formattedTranscript?.length || 0 },
    });

    return {
      success: true,
      conversation_id,
      transcript: formattedTranscript,
      metadata: {
        duration: result.call_duration_secs,
        messageCount: result.message_count,
        status: result.status,
        created_at: result.created_at,
        ended_at: result.ended_at
      }
    };
  } catch (error) {
    throw new Error(`Failed to get conversation transcript: ${String(error)}`);
  }
}

/**
 * Download audio recording with format options
 */
export async function getConversationAudio(args: any) {
  try {
    const { conversation_id, format = 'mp3' } = args;
    
    if (!conversation_id) {
      throw new Error('conversation_id is required');
    }

    // Validate audio format
    const supportedFormats = ['mp3', 'wav', 'pcm', 'ulaw'];
    if (!supportedFormats.includes(format.toLowerCase())) {
      throw new Error(`Unsupported audio format: ${format}. Supported formats: ${supportedFormats.join(', ')}`);
    }

    // Get signed audio URL instead of relative proxy URL
    const result = await elevenlabsIntegration.getSignedAudioUrl(conversation_id, format);

    await storage.createAuditLog({
      actor: "mcp",
      action: "get_conversation_audio",
      payloadJson: { conversation_id, format },
    });

    return {
      success: true,
      conversation_id,
      audio_url: result.signed_url,
      format: format,
      size_bytes: result.size_bytes,
      download_expires_at: result.expires_at
    };
  } catch (error) {
    throw new Error(`Failed to get conversation audio: ${String(error)}`);
  }
}

/**
 * Search conversations by content or metadata
 */
export async function searchConversations(args: any) {
  try {
    const { query, agent_id, start_date, end_date, limit = 50 } = args;
    
    if (!query) {
      throw new Error('search query is required');
    }

    // SECURITY: Enforce authorized agent ID only
    if (agent_id && agent_id !== AUTHORIZED_AGENT_ID) {
      throw new Error(`SECURITY: Unauthorized agent ID. Access denied.`);
    }
    const validatedAgentId = AUTHORIZED_AGENT_ID;
    
    // SECURITY: Enforce pagination limits
    const safeLimit = Math.min(Math.max(1, limit), 50);
    
    const result = await elevenlabsIntegration.searchConversations({
      query,
      agent_id: validatedAgentId,
      start_date,
      end_date,
      limit: safeLimit
    });

    // SECURITY: Redact PII from audit logs - don't log full query content
    await storage.createAuditLog({
      actor: "mcp",
      action: "search_conversations",
      payloadJson: { 
        query_length: query.length, 
        agent_id: validatedAgentId, 
        start_date, 
        end_date, 
        limit: safeLimit 
      },
    });

    return {
      success: true,
      query_length: query.length,
      results: result.conversations || [],
      total_found: result.total || 0,
      limit_applied: safeLimit
    };
  } catch (error) {
    throw new Error(`Failed to search conversations: ${String(error)}`);
  }
}

/**
 * Analyze conversation for insights and metrics
 */
export async function analyzeConversation(args: any) {
  try {
    const { conversation_id } = args;
    
    if (!conversation_id) {
      throw new Error('conversation_id is required');
    }

    // Get conversation details
    const conversation = await elevenlabsIntegration.getConversationDetails(conversation_id);
    
    // Perform analysis using LLM
    const analysisPrompt = `Analyze this recruiting interview conversation and provide insights:

Transcript: ${conversation.transcript}
Duration: ${conversation.call_duration_secs} seconds
Message Count: ${conversation.message_count}

Please provide:
1. Key highlights and strengths
2. Areas of concern or red flags
3. Overall assessment score (1-100)
4. Recommended next steps
5. Candidate fit assessment

Format as JSON with fields: highlights, concerns, score, next_steps, fit_assessment`;

    const analysis = await openrouterIntegration.chat(analysisPrompt, 'orchestrator');

    await storage.createAuditLog({
      actor: "mcp",
      action: "analyze_conversation",
      payloadJson: { conversation_id },
    });

    return {
      success: true,
      conversation_id,
      analysis: analysis.content,
      metadata: {
        analyzed_at: new Date().toISOString(),
        duration: conversation.call_duration_secs,
        message_count: conversation.message_count
      }
    };
  } catch (error) {
    throw new Error(`Failed to analyze conversation: ${String(error)}`);
  }
}

/**
 * Export transcript in various formats
 */
export async function exportTranscript(args: any) {
  try {
    const { conversation_id, format = 'txt', include_metadata = true } = args;
    
    if (!conversation_id) {
      throw new Error('conversation_id is required');
    }

    const conversation = await elevenlabsIntegration.getConversationDetails(conversation_id);
    
    let exportData = '';
    const metadata = include_metadata ? {
      conversation_id,
      date: conversation.created_at,
      duration: conversation.call_duration_secs,
      participants: ['Agent', 'Candidate']
    } : null;

    switch (format.toLowerCase()) {
      case 'txt':
        exportData = formatTranscriptAsText(conversation.transcript, metadata);
        break;
      case 'json':
        exportData = JSON.stringify({
          ...metadata,
          transcript: conversation.transcript,
          word_level: conversation.wordLevelTranscript
        }, null, 2);
        break;
      case 'srt':
        exportData = formatTranscriptAsSRT(conversation.wordLevelTranscript);
        break;
      case 'vtt':
        exportData = formatTranscriptAsVTT(conversation.wordLevelTranscript);
        break;
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }

    await storage.createAuditLog({
      actor: "mcp",
      action: "export_transcript",
      payloadJson: { conversation_id, format, include_metadata },
    });

    return {
      success: true,
      conversation_id,
      format,
      data: exportData,
      exported_at: new Date().toISOString()
    };
  } catch (error) {
    throw new Error(`Failed to export transcript: ${String(error)}`);
  }
}

/**
 * Configure webhook for real-time notifications
 */
export async function configureWebhook(args: any) {
  try {
    const { webhook_url, events = ['conversation.ended'], secret } = args;
    
    if (!webhook_url) {
      throw new Error('webhook_url is required');
    }

    // SECURITY: Validate URL format and restrict to HTTPS only
    let parsedUrl;
    try {
      parsedUrl = new URL(webhook_url);
    } catch {
      throw new Error('Invalid webhook_url format');
    }

    // SECURITY: Only allow HTTPS URLs for production security
    if (parsedUrl.protocol !== 'https:') {
      throw new Error('SECURITY: Only HTTPS webhook URLs are allowed');
    }

    // SECURITY: Validate allowed domains (prevent SSRF)
    const allowedDomains = [
      'replit.app',
      'repl.co',
      'ngrok.io',
      'webhook.site',
      'pipedream.com'
    ];
    
    const isAllowedDomain = allowedDomains.some(domain => 
      parsedUrl.hostname.endsWith(domain) || parsedUrl.hostname === domain
    );
    
    if (!isAllowedDomain) {
      throw new Error(`SECURITY: Webhook domain not allowed. Allowed domains: ${allowedDomains.join(', ')}`);
    }

    // SECURITY: Require secret for webhook signature verification
    if (!secret || secret.length < 16) {
      throw new Error('SECURITY: Webhook secret is required and must be at least 16 characters');
    }

    const result = await elevenlabsIntegration.configureWebhook({
      url: webhook_url,
      events,
      secret
    });

    await storage.createAuditLog({
      actor: "mcp",
      action: "configure_webhook",
      payloadJson: { webhook_url, events, has_secret: true, domain: parsedUrl.hostname },
    });

    return {
      success: true,
      webhook_id: result.webhook_id,
      url: webhook_url,
      events,
      status: 'active',
      security_validated: true
    };
  } catch (error) {
    throw new Error(`Failed to configure webhook: ${String(error)}`);
  }
}

/**
 * Verify webhook signature for security
 */
export async function verifyWebhookSignature(args: any) {
  try {
    const { payload, signature, secret } = args;
    
    if (!payload || !signature || !secret) {
      throw new Error('payload, signature, and secret are required');
    }

    const isValid = elevenlabsIntegration.verifyWebhookSignature(payload, signature, secret);

    await storage.createAuditLog({
      actor: "mcp",
      action: "verify_webhook_signature",
      payloadJson: { signature_valid: isValid },
    });

    return {
      success: true,
      signature_valid: isValid,
      verified_at: new Date().toISOString()
    };
  } catch (error) {
    throw new Error(`Failed to verify webhook signature: ${String(error)}`);
  }
}

// Helper functions for transcript formatting
function formatTranscriptAsText(transcript: string, metadata: any): string {
  let output = '';
  
  if (metadata) {
    output += `Conversation: ${metadata.conversation_id}\n`;
    output += `Date: ${metadata.date}\n`;
    output += `Duration: ${metadata.duration} seconds\n`;
    output += `Participants: ${metadata.participants.join(', ')}\n`;
    output += '\n---\n\n';
  }
  
  output += transcript;
  return output;
}

function formatTranscriptAsSRT(wordLevelTranscript: any): string {
  if (!wordLevelTranscript || !Array.isArray(wordLevelTranscript)) {
    return '';
  }

  let srt = '';
  let index = 1;
  
  // Group words into subtitle chunks (every 10 words or natural breaks)
  const chunks = groupWordsForSubtitles(wordLevelTranscript);
  
  chunks.forEach(chunk => {
    const startTime = formatTimeForSRT(chunk.start_time);
    const endTime = formatTimeForSRT(chunk.end_time);
    
    srt += `${index}\n`;
    srt += `${startTime} --> ${endTime}\n`;
    srt += `${chunk.text}\n\n`;
    index++;
  });
  
  return srt;
}

function formatTranscriptAsVTT(wordLevelTranscript: any): string {
  if (!wordLevelTranscript || !Array.isArray(wordLevelTranscript)) {
    return 'WEBVTT\n\n';
  }

  let vtt = 'WEBVTT\n\n';
  
  const chunks = groupWordsForSubtitles(wordLevelTranscript);
  
  chunks.forEach(chunk => {
    const startTime = formatTimeForVTT(chunk.start_time);
    const endTime = formatTimeForVTT(chunk.end_time);
    
    vtt += `${startTime} --> ${endTime}\n`;
    vtt += `${chunk.text}\n\n`;
  });
  
  return vtt;
}

function groupWordsForSubtitles(words: any[]): any[] {
  const chunks = [];
  const wordsPerChunk = 10;
  
  for (let i = 0; i < words.length; i += wordsPerChunk) {
    const chunkWords = words.slice(i, i + wordsPerChunk);
    chunks.push({
      start_time: chunkWords[0].start_time,
      end_time: chunkWords[chunkWords.length - 1].end_time,
      text: chunkWords.map(w => w.word).join(' ')
    });
  }
  
  return chunks;
}

function formatTimeForSRT(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
}

function formatTimeForVTT(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

// ===== PHASE 3: CONVERSATION CONTEXT MCP TOOLS =====

/**
 * Create a platform conversation record
 */
export async function createPlatformConversation(args: any) {
  try {
    const { conversationId, agentId, source, metadata = {}, participantCount = 2 } = args;
    
    if (!conversationId || !agentId || !source) {
      throw new Error("conversationId, agentId, and source are required");
    }

    // SECURITY: For ElevenLabs conversations, validate authorized agent
    if (source === "elevenlabs" && agentId !== AUTHORIZED_AGENT_ID) {
      throw new Error(`UNAUTHORIZED: Only agent ${AUTHORIZED_AGENT_ID} is authorized for ElevenLabs conversations`);
    }

    const result = await storage.upsertPlatformConversation({
      conversationId,
      agentId,
      source,
      metadata,
      participantCount
    });

    return {
      success: true,
      conversation: result.conversation,
      action: result.action,
      message: `Platform conversation ${result.action} successfully`
    };
  } catch (error) {
    console.error("[MCP] createPlatformConversation error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Set conversation context for an active conversation
 */
export async function setConversationContext(args: any) {
  try {
    const { conversationId, contextKey, contextValue, contextType = "system", priority = 5, tags = [] } = args;
    
    if (!conversationId || !contextKey || contextValue === undefined || !contextType) {
      throw new Error("conversationId, contextKey, contextValue, and contextType are required");
    }

    // Get the platform conversation first
    const platformConversation = await storage.getPlatformConversationByConversationId(conversationId);
    if (!platformConversation) {
      throw new Error(`Platform conversation not found for conversationId: ${conversationId}`);
    }

    // SECURITY: For ElevenLabs conversations, validate authorized agent
    if (platformConversation.source === "elevenlabs" && platformConversation.agentId !== AUTHORIZED_AGENT_ID) {
      throw new Error(`UNAUTHORIZED: Only agent ${AUTHORIZED_AGENT_ID} is authorized for ElevenLabs conversation context`);
    }

    const result = await storage.upsertConversationContext({
      platformConversationId: platformConversation.id,
      contextKey,
      contextValue,
      contextType,
      priority,
      tags
    });

    return {
      success: true,
      context: result.context,
      action: result.action,
      message: `Context ${result.action} successfully for conversation ${conversationId}`
    };
  } catch (error) {
    console.error("[MCP] setConversationContext error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Get conversation context for a conversation
 */
export async function getConversationContext(args: any) {
  try {
    const { conversationId, contextKey, contextType } = args;
    
    if (!conversationId) {
      throw new Error("conversationId is required");
    }

    // Get the platform conversation first
    const platformConversation = await storage.getPlatformConversationByConversationId(conversationId);
    if (!platformConversation) {
      throw new Error(`Platform conversation not found for conversationId: ${conversationId}`);
    }

    let contexts;
    
    if (contextKey && contextType) {
      // Get specific context
      const context = await storage.getConversationContextByKey(
        platformConversation.id,
        contextKey,
        contextType
      );
      contexts = context ? [context] : [];
    } else {
      // Get all contexts for the conversation
      contexts = await storage.getConversationContexts(platformConversation.id);
    }

    return {
      success: true,
      conversationId,
      platformConversationId: platformConversation.id,
      contexts,
      message: `Retrieved ${contexts.length} context entries for conversation ${conversationId}`
    };
  } catch (error) {
    console.error("[MCP] getConversationContext error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Store conversation memory for an agent
 */
export async function storeConversationMemory(args: any) {
  try {
    const { 
      agentId, 
      memoryKey, 
      memoryValue, 
      memoryType = "learned_pattern", 
      confidence = 0.5, 
      source = "conversation",
      relatedConversationIds = [],
      tags = []
    } = args;
    
    if (!agentId || !memoryKey || memoryValue === undefined) {
      throw new Error("agentId, memoryKey, and memoryValue are required");
    }

    // SECURITY: For ElevenLabs agents, validate authorized agent
    if (agentId !== AUTHORIZED_AGENT_ID) {
      console.warn(`[MCP] Memory storage for non-authorized agent: ${agentId}. Allowing for platform agents.`);
    }

    const result = await storage.upsertConversationMemory({
      agentId,
      memoryKey,
      memoryValue,
      memoryType,
      confidence: Math.max(0, Math.min(1, confidence)), // Clamp between 0 and 1
      source,
      relatedConversationIds,
      tags
    });

    return {
      success: true,
      memory: result.memory,
      action: result.action,
      message: `Memory ${result.action} successfully for agent ${agentId}`
    };
  } catch (error) {
    console.error("[MCP] storeConversationMemory error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Retrieve conversation memory for an agent
 */
export async function getConversationMemory(args: any) {
  try {
    const { agentId, memoryKey, memoryType, limit = 50 } = args;
    
    if (!agentId) {
      throw new Error("agentId is required");
    }

    const safeLimit = Math.min(Math.max(1, limit), 100); // Enforce reasonable limits

    let memories;
    
    if (memoryKey && memoryType) {
      // Get specific memory
      const memory = await storage.getConversationMemoryByKey(agentId, memoryKey, memoryType);
      memories = memory ? [memory] : [];
      
      // Mark memory as used
      if (memory) {
        await storage.incrementMemoryUsage(memory.id);
      }
    } else {
      // Get all memories for the agent
      memories = await storage.getConversationMemoryByAgent(agentId, safeLimit);
    }

    return {
      success: true,
      agentId,
      memories,
      message: `Retrieved ${memories.length} memory entries for agent ${agentId}`
    };
  } catch (error) {
    console.error("[MCP] getConversationMemory error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Search conversation memory for an agent
 */
export async function searchConversationMemory(args: any) {
  try {
    const { agentId, searchTerms, memoryTypes = [] } = args;
    
    if (!agentId || !Array.isArray(searchTerms) || searchTerms.length === 0) {
      throw new Error("agentId and searchTerms (non-empty array) are required");
    }

    // SECURITY: Sanitize search terms
    const sanitizedSearchTerms = searchTerms
      .filter(term => typeof term === 'string' && term.trim().length > 0)
      .map(term => term.trim().substring(0, 100)) // Limit term length
      .slice(0, 10); // Limit number of search terms

    if (sanitizedSearchTerms.length === 0) {
      throw new Error("No valid search terms provided");
    }

    const memories = await storage.searchConversationMemory(
      agentId, 
      sanitizedSearchTerms, 
      memoryTypes.length > 0 ? memoryTypes : undefined
    );

    return {
      success: true,
      agentId,
      searchTerms: sanitizedSearchTerms,
      memoryTypes,
      memories,
      message: `Found ${memories.length} memory entries for search terms: ${sanitizedSearchTerms.join(", ")}`
    };
  } catch (error) {
    console.error("[MCP] searchConversationMemory error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

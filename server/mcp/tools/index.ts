import { storage } from "../../storage";
import { indeedIntegration } from "../../integrations/indeed";
import { apifyIntegration } from "../../integrations/apify";
import { slackIntegration } from "../../integrations/slack";
import { mailjetIntegration } from "../../integrations/mailjet";
import { airtopIntegration } from "../../integrations/airtop";
import { openrouterIntegration } from "../../integrations/openrouter";
import { elevenlabsIntegration } from "../../integrations/elevenlabs";
import ical from "ical-generator";

export async function launchIndeedCampaign(args: any) {
  try {
    const campaign = await storage.createCampaign({
      name: args.title,
      source: "INDEED",
      paramsJson: args,
      status: "ACTIVE",
    });

    const jobId = await indeedIntegration.createCampaign(args);
    
    return {
      success: true,
      campaignId: campaign.id,
      indeedJobId: jobId,
      message: "Campaign launched successfully on Indeed",
    };
  } catch (error) {
    // Fallback to Airtop
    await storage.createAuditLog({
      actor: "mcp",
      action: "launch_indeed_campaign_fallback",
      payloadJson: { error: String(error), args },
      pathUsed: "airtop",
    });

    const result = await airtopIntegration.executeRecipe("indeed.post_job", args);
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

    // Update Indeed disposition if source is Indeed
    if (candidate.sourceRef && newStage === "REJECTED") {
      await indeedIntegration.postDisposition(candidateId, "rejected");
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

// Specialized tool for ElevenLabs interview agents to create candidates
export async function createCandidateFromInterview(args: any) {
  try {
    const {
      name,
      email,
      phone,
      interviewData,
      score,
      notes,
      pipelineStage = "FIRST_INTERVIEW"
    } = args;

    // Check if candidate already exists
    let existingCandidate;
    try {
      existingCandidate = await storage.getCandidateByEmail(email);
    } catch (error) {
      existingCandidate = null;
    }
    
    if (existingCandidate) {
      // Update existing candidate with interview data
      const updated = await storage.updateCandidate(existingCandidate.id, {
        pipelineStage,
        score: score || existingCandidate.score,
      });

      // Create interview record
      let interview = null;
      try {
        interview = await storage.createInterview({
          candidateId: existingCandidate.id,
          summary: notes || "Interview completed via ElevenLabs agent",
          scorecard: interviewData || {},
          transcript: interviewData?.transcript || "",
        });
      } catch (interviewError) {
        console.log("Failed to create interview record (non-critical):", interviewError);
      }

      return {
        success: true,
        candidate: updated,
        interview,
        action: "updated_existing",
        message: "Candidate updated with interview data"
      };
    } else {
      // Create new candidate from interview (minimal data)
      const candidateData = {
        name,
        email,
        pipelineStage,
        score: score || 0,
        sourceRef: "elevenlabs_interview",
      };
      
      if (phone) candidateData.phone = phone;
      
      const candidate = await storage.createCandidate(candidateData);

      // Create interview record (optional)
      let interview = null;
      try {
        interview = await storage.createInterview({
          candidateId: candidate.id,
          summary: notes || "Interview completed via ElevenLabs agent",
          scorecard: interviewData || {},
          transcript: interviewData?.transcript || "",
        });
      } catch (interviewError) {
        console.log("Failed to create interview record (non-critical):", interviewError);
      }

      return {
        success: true,
        candidate,
        interview,
        action: "created_new",
        message: "New candidate created from interview data"
      };
    }
  } catch (error) {
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

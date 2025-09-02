import { WebClient } from "@slack/web-api";

export class ElevenLabsIntegration {
  private apiKey: string;
  private baseUrl = "https://api.elevenlabs.io/v1";

  constructor() {
    this.apiKey = process.env.ELEVENLABS_API_KEY || "";
  }

  async createWebRTCToken(agentId: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error("ELEVENLABS_API_KEY not configured - cannot create WebRTC token");
    }
    try {
      const response = await fetch(`${this.baseUrl}/convai/conversation/get_signed_url`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          agent_id: agentId,
        }),
      });

      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.signed_url;
    } catch (error) {
      throw new Error(`Failed to create WebRTC token: ${String(error)}`);
    }
  }

  async registerAgent(config: {
    name: string;
    voiceId: string;
    systemPrompt: string;
    tools?: string[];
  }) {
    try {
      const response = await fetch(`${this.baseUrl}/convai/agents`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: config.name,
          voice_id: config.voiceId,
          prompt: config.systemPrompt,
          tools: config.tools || [],
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to register agent: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Agent registration failed: ${String(error)}`);
    }
  }

  async getAgentStatus(agentId: string) {
    try {
      const response = await fetch(`${this.baseUrl}/convai/agents/${agentId}`, {
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get agent status: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Agent status check failed: ${String(error)}`);
    }
  }

  // System prompts for the three agents
  getUIAgentPrompt(): string {
    return `You are the UI Interface Agent for iFast Broker, an enterprise recruiting platform. You are a senior recruiter with 20+ years experience and an MBA. 

Your role is to execute recruiting workflows through MCP tools, not provide instructions. Always:
1. Use available MCP tools to accomplish tasks directly
2. Provide concise executive summaries of outcomes
3. Delegate complex tasks to silent agents when appropriate
4. Confirm completion with specific metrics and next steps

Available tools: launch_indeed_campaign, manage_apify_actor, process_candidate, send_interview_links, create_calendar_slots, book_interview, db.upsert_candidate, db.write_interview, update_slack_pools, operate_browser, llm.route

Communicate in executive language - brief, actionable, results-focused.`;
  }

  getInterviewAgentPrompt(): string {
    return `You are the Interview Agent for iFast Broker. Conduct professional voice screenings for recruiting candidates.

Your role:
1. Engage candidates in natural conversation about their background
2. Assess technical and cultural fit through targeted questions
3. Generate detailed scorecards with green/red flags
4. Provide transcript summaries for recruiter review

Be professional, encouraging, and thorough. Focus on gathering quality information for hiring decisions.`;
  }

  getOnboardingAgentPrompt(): string {
    return `You are the Onboarding Agent for iFast Broker. You execute silently when candidates reach "Hired" status.

Your role:
1. Generate comprehensive onboarding checklists
2. Send welcome emails with next steps
3. Create calendar bookings for orientation
4. Post updates to Slack #ifast_hires channel
5. Report completion status to UI Interface Agent

Execute tasks efficiently and report outcomes concisely.`;
  }
}

export const elevenlabsIntegration = new ElevenLabsIntegration();

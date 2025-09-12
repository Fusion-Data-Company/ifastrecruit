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
          "xi-api-key": this.apiKey,
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
          "xi-api-key": this.apiKey,
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
          "xi-api-key": this.apiKey,
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

  // Data collection methods for agent conversations
  
  async getAgentConversations(agentId: string, options: {
    limit?: number;
    cursor?: string;
    after?: string;
    before?: string;
  } = {}): Promise<{
    conversations: any[];
    has_more: boolean;
    cursor?: string;
  }> {
    if (!this.apiKey) {
      throw new Error("ELEVENLABS_API_KEY not configured - cannot fetch conversations");
    }

    try {
      const params = new URLSearchParams();
      params.append('agent_id', agentId);
      
      if (options.limit) params.append('limit', options.limit.toString());
      if (options.cursor) params.append('cursor', options.cursor);
      if (options.after) params.append('after', options.after);
      if (options.before) params.append('before', options.before);

      const response = await fetch(`${this.baseUrl}/convai/conversations?${params}`, {
        headers: {
          "xi-api-key": this.apiKey,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch conversations: ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      return {
        conversations: data.conversations || [],
        has_more: data.has_more || false,
        cursor: data.cursor
      };
    } catch (error) {
      throw new Error(`Conversation fetch failed: ${String(error)}`);
    }
  }

  async getConversationDetails(conversationId: string): Promise<{
    conversation_id: string;
    agent_id: string;
    user_id?: string;
    created_at: string;
    ended_at?: string;
    transcript?: any[];
    metadata?: any;
  }> {
    if (!this.apiKey) {
      throw new Error("ELEVENLABS_API_KEY not configured - cannot fetch conversation details");
    }

    try {
      const response = await fetch(`${this.baseUrl}/convai/conversations/${conversationId}`, {
        headers: {
          "xi-api-key": this.apiKey,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch conversation details: ${response.statusText} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Conversation details fetch failed: ${String(error)}`);
    }
  }

  async getConversationAudio(conversationId: string): Promise<{
    audio_url?: string;
    audio_data?: ArrayBuffer;
    content_type?: string;
  }> {
    if (!this.apiKey) {
      throw new Error("ELEVENLABS_API_KEY not configured - cannot fetch conversation audio");
    }

    try {
      const response = await fetch(`${this.baseUrl}/convai/conversations/${conversationId}/audio`, {
        headers: {
          "xi-api-key": this.apiKey,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch conversation audio: ${response.statusText} - ${errorText}`);
      }

      const contentType = response.headers.get('content-type') || 'audio/mpeg';
      
      // Check if response is JSON (might contain audio URL) or binary audio data
      if (contentType.includes('application/json')) {
        const data = await response.json();
        return {
          audio_url: data.audio_url || data.url,
          content_type: contentType
        };
      } else {
        // Binary audio data
        const arrayBuffer = await response.arrayBuffer();
        return {
          audio_data: arrayBuffer,
          content_type: contentType
        };
      }
    } catch (error) {
      throw new Error(`Conversation audio fetch failed: ${String(error)}`);
    }
  }

  async getAllAgentData(agentId: string): Promise<{
    agent: any;
    conversations: any[];
    total_conversations: number;
    error_details?: string[];
  }> {
    if (!this.apiKey) {
      throw new Error("ELEVENLABS_API_KEY not configured - cannot collect agent data");
    }

    const errors: string[] = [];
    let agent: any = null;
    let allConversations: any[] = [];

    try {
      // Get agent details
      try {
        agent = await this.getAgentStatus(agentId);
      } catch (error) {
        errors.push(`Failed to fetch agent details: ${String(error)}`);
      }

      // Get all conversations with pagination
      let hasMore = true;
      let cursor: string | undefined;
      
      while (hasMore) {
        try {
          const result = await this.getAgentConversations(agentId, {
            limit: 100,
            cursor
          });
          
          // Enrich each conversation with detailed data and audio info
          const enrichedConversations = await Promise.allSettled(
            result.conversations.map(async (conv) => {
              const enriched = { ...conv };
              
              // Try to get conversation details
              try {
                const details = await this.getConversationDetails(conv.conversation_id);
                enriched.details = details;
              } catch (error) {
                enriched.details_error = String(error);
              }
              
              // Try to get audio info (but don't download the full audio data)
              try {
                const audioInfo = await this.getConversationAudio(conv.conversation_id);
                enriched.audio_info = {
                  has_audio: !!(audioInfo.audio_url || audioInfo.audio_data),
                  audio_url: audioInfo.audio_url,
                  content_type: audioInfo.content_type,
                  audio_size_bytes: audioInfo.audio_data ? audioInfo.audio_data.byteLength : undefined
                };
              } catch (error) {
                enriched.audio_error = String(error);
              }
              
              return enriched;
            })
          );

          // Add successful results
          enrichedConversations.forEach((result) => {
            if (result.status === 'fulfilled') {
              allConversations.push(result.value);
            } else {
              errors.push(`Failed to enrich conversation: ${result.reason}`);
            }
          });

          hasMore = result.has_more;
          cursor = result.cursor;
        } catch (error) {
          errors.push(`Failed to fetch conversations batch: ${String(error)}`);
          hasMore = false;
        }
      }

      return {
        agent,
        conversations: allConversations,
        total_conversations: allConversations.length,
        error_details: errors.length > 0 ? errors : undefined
      };

    } catch (error) {
      throw new Error(`Agent data collection failed: ${String(error)}`);
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

Available tools: manage_apify_actor, process_candidate, send_interview_links, create_calendar_slots, book_interview, db.upsert_candidate, db.write_interview, update_slack_pools, operate_browser, llm.route

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

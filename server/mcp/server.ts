import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { storage } from "../storage";
import { 
  launchCampaign,
  manageApifyActor,
  processCandidate,
  sendInterviewLinks,
  createCalendarSlots,
  bookInterview,
  upsertCandidate,
  createCandidateFromInterview,
  writeInterview,
  updateSlackPools,
  operateBrowser,
  llmRoute,
  // ElevenLabs MCP tools
  listConversations,
  getConversationTranscript,
  getConversationAudio,
  searchConversations,
  analyzeConversation,
  exportTranscript,
  configureWebhook,
  verifyWebhookSignature,
  // Phase 3: Conversation Context MCP tools
  createPlatformConversation,
  setConversationContext,
  getConversationContext,
  storeConversationMemory,
  getConversationMemory,
  searchConversationMemory
} from "./tools";

export class MCPServer {
  private server: Server;
  private tools: Map<string, Function>;

  constructor() {
    this.server = new Server({
      name: "ifast-broker",
      version: "1.0.0",
    }, {
      capabilities: {
        tools: {},
      },
    });

    this.tools = new Map<string, Function>();
    this.tools.set("launch_campaign", launchCampaign);
    this.tools.set("manage_apify_actor", manageApifyActor);
    this.tools.set("process_candidate", processCandidate);
    this.tools.set("send_interview_links", sendInterviewLinks);
    this.tools.set("create_calendar_slots", createCalendarSlots);
    this.tools.set("book_interview", bookInterview);
    this.tools.set("db.upsert_candidate", upsertCandidate);
    this.tools.set("create_candidate_from_interview", createCandidateFromInterview);
    this.tools.set("db.write_interview", writeInterview);
    this.tools.set("update_slack_pools", updateSlackPools);
    this.tools.set("operate_browser", operateBrowser);
    this.tools.set("llm.route", llmRoute);
    
    // ElevenLabs MCP tools
    this.tools.set("elevenlabs.list_conversations", listConversations);
    this.tools.set("elevenlabs.get_conversation_transcript", getConversationTranscript);
    this.tools.set("elevenlabs.get_conversation_audio", getConversationAudio);
    this.tools.set("elevenlabs.search_conversations", searchConversations);
    this.tools.set("elevenlabs.analyze_conversation", analyzeConversation);
    this.tools.set("elevenlabs.export_transcript", exportTranscript);
    this.tools.set("elevenlabs.configure_webhook", configureWebhook);
    this.tools.set("elevenlabs.verify_webhook_signature", verifyWebhookSignature);
    
    // Phase 3: Conversation Context MCP tools
    this.tools.set("conversation.create_platform_conversation", createPlatformConversation);
    this.tools.set("conversation.set_context", setConversationContext);
    this.tools.set("conversation.get_context", getConversationContext);
    this.tools.set("conversation.store_memory", storeConversationMemory);
    this.tools.set("conversation.get_memory", getConversationMemory);
    this.tools.set("conversation.search_memory", searchConversationMemory);

    this.setupHandlers();
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: Array.from(this.tools.keys()).map(name => ({
          name,
          description: this.getToolDescription(name),
          inputSchema: this.getToolInputSchema(name),
        })),
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      if (!this.tools.has(name)) {
        throw new Error(`Unknown tool: ${name}`);
      }

      try {
        // Log tool execution
        await storage.createAuditLog({
          actor: "mcp",
          action: `tool:${name}`,
          payloadJson: args,
        });

        const tool = this.tools.get(name)!;
        const result = await tool(args);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result),
            },
          ],
        };
      } catch (error) {
        // Log error
        await storage.createAuditLog({
          actor: "mcp",
          action: `tool:${name}:error`,
          payloadJson: { error: String(error), args },
        });
        
        throw error;
      }
    });
  }

  private getToolDescription(name: string): string {
    const descriptions: Record<string, string> = {
      "manage_apify_actor": "CRUD operations on Apify actors including run, monitor, and dataset management",
      "process_candidate": "Update candidate pipeline stage, recompute score, move Slack pools",
      "send_interview_links": "Generate and send interview links to candidates via email",
      "create_calendar_slots": "Create available calendar slots for interview booking",
      "book_interview": "Book an interview slot and generate ICS file",
      "db.upsert_candidate": "Insert or update candidate record in database",
      "create_candidate_from_interview": "Create or update candidate from ElevenLabs interview agent data",
      "db.write_interview": "Write interview results and scorecard to database",
      "update_slack_pools": "Ensure Slack channels exist and post updates",
      "operate_browser": "Execute browser automation via Airtop for fallback scenarios",
      "llm.route": "Route LLM requests through OpenRouter with policy profiles",
      
      // ElevenLabs MCP tool descriptions
      "elevenlabs.list_conversations": "List ElevenLabs conversations with filtering options for agent, date range, and status",
      "elevenlabs.get_conversation_transcript": "Get full conversation transcript with metadata in various formats (json, text, srt, vtt)",
      "elevenlabs.get_conversation_audio": "Download conversation audio recording in multiple formats (mp3, wav, pcm, ulaw)",
      "elevenlabs.search_conversations": "Search conversations by content or metadata with flexible filters",
      "elevenlabs.analyze_conversation": "AI-powered analysis of conversations for insights, scoring, and recommendations",
      "elevenlabs.export_transcript": "Export transcripts in various formats with optional metadata inclusion",
      "elevenlabs.configure_webhook": "Configure webhooks for real-time conversation notifications and events",
      "elevenlabs.verify_webhook_signature": "Verify webhook signature for security validation",
      
      // Phase 3: Conversation Context MCP tool descriptions
      "conversation.create_platform_conversation": "Create or update a platform conversation record for tracking conversations across different sources",
      "conversation.set_context": "Set contextual information for an active conversation (candidate data, interview stage, preferences, etc.)",
      "conversation.get_context": "Retrieve contextual information for a conversation, either specific context or all contexts",
      "conversation.store_memory": "Store long-term memory for an agent including learned patterns, user preferences, and success factors",
      "conversation.get_memory": "Retrieve stored memory for an agent, either specific memory or all memories with usage tracking",
      "conversation.search_memory": "Search through agent memory using keywords and memory types for intelligent context retrieval",
    };
    return descriptions[name] || "Tool description not available";
  }

  private getToolInputSchema(name: string): any {
    // Return proper JSON Schema format for ElevenLabs compatibility
    const schemas: Record<string, any> = {
      "manage_apify_actor": {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        "properties": {
          "action": { 
            "type": "string", 
            "enum": ["create", "read", "update", "delete", "run", "monitor"],
            "description": "Action to perform on the Apify actor" 
          },
          "actorId": { 
            "type": "string", 
            "description": "Apify actor ID" 
          },
          "configuration": { 
            "type": "object", 
            "description": "Actor configuration object" 
          },
          "runId": {
            "type": "string",
            "description": "Run ID for monitoring actions"
          }
        },
        "required": ["action"],
        "additionalProperties": false
      },
      "process_candidate": {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        "properties": {
          "candidateId": { 
            "type": "string", 
            "description": "Unique candidate identifier" 
          },
          "newStage": { 
            "type": "string", 
            "enum": ["NEW", "FIRST_INTERVIEW", "TECHNICAL_SCREEN", "FINAL_INTERVIEW", "OFFER", "HIRED", "REJECTED"],
            "description": "New pipeline stage for the candidate" 
          },
          "notes": { 
            "type": "string", 
            "description": "Notes about the stage change" 
          }
        },
        "required": ["candidateId", "newStage"],
        "additionalProperties": false
      },
      "create_candidate_from_interview": {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        "properties": {
          "name": { 
            "type": "string", 
            "description": "Full name of the candidate" 
          },
          "email": { 
            "type": "string", 
            "format": "email",
            "description": "Email address of the candidate" 
          },
          "phone": { 
            "type": "string", 
            "description": "Phone number of the candidate" 
          },
          "interviewData": { 
            "type": "object", 
            "description": "Raw interview data from ElevenLabs" 
          },
          "score": { 
            "type": "number", 
            "minimum": 0, 
            "maximum": 100,
            "description": "Interview score from 0-100" 
          },
          "notes": { 
            "type": "string", 
            "description": "Additional notes about the candidate" 
          },
          "pipelineStage": { 
            "type": "string", 
            "enum": ["NEW", "FIRST_INTERVIEW", "TECHNICAL_SCREEN", "FINAL_INTERVIEW", "OFFER", "HIRED", "REJECTED"],
            "description": "Initial pipeline stage",
            "default": "NEW"
          }
        },
        "required": ["name", "email"],
        "additionalProperties": false
      },
      "db.upsert_candidate": {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        "properties": {
          "name": { "type": "string", "description": "Candidate name" },
          "email": { "type": "string", "format": "email", "description": "Candidate email" },
          "phone": { "type": "string", "description": "Candidate phone" },
          "resumeUrl": { "type": "string", "format": "uri", "description": "URL to candidate resume" },
          "pipelineStage": { "type": "string", "description": "Pipeline stage" },
          "score": { "type": "number", "minimum": 0, "maximum": 100, "description": "Candidate score" }
        },
        "required": ["name", "email"],
        "additionalProperties": false
      },
      "db.write_interview": {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        "properties": {
          "candidateId": { "type": "string", "description": "Candidate ID" },
          "summary": { "type": "string", "description": "Interview summary" },
          "score": { "type": "number", "minimum": 0, "maximum": 100, "description": "Interview score" },
          "feedback": { "type": "string", "description": "Interview feedback" },
          "recordingUrl": { "type": "string", "format": "uri", "description": "Recording URL" }
        },
        "required": ["candidateId", "summary"],
        "additionalProperties": false
      },
      "send_interview_links": {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        "properties": {
          "candidateIds": { 
            "type": "array", 
            "items": { "type": "string" },
            "description": "Array of candidate IDs to send links to" 
          },
          "templateType": { 
            "type": "string", 
            "enum": ["INTERVIEW_INVITE", "FOLLOW_UP", "REMINDER"],
            "default": "INTERVIEW_INVITE",
            "description": "Email template type" 
          }
        },
        "required": ["candidateIds"],
        "additionalProperties": false
      },
      "create_calendar_slots": {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        "properties": {
          "startDate": { "type": "string", "format": "date-time", "description": "Start date for slot generation" },
          "endDate": { "type": "string", "format": "date-time", "description": "End date for slot generation" },
          "duration": { "type": "number", "default": 60, "description": "Slot duration in minutes" },
          "timeZone": { "type": "string", "default": "UTC", "description": "Time zone" }
        },
        "required": ["startDate", "endDate"],
        "additionalProperties": false
      },
      "book_interview": {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        "properties": {
          "candidateId": { "type": "string", "description": "Candidate ID" },
          "startTs": { "type": "string", "format": "date-time", "description": "Interview start time" },
          "endTs": { "type": "string", "format": "date-time", "description": "Interview end time" },
          "location": { "type": "string", "description": "Interview location or URL" }
        },
        "required": ["candidateId", "startTs", "endTs"],
        "additionalProperties": false
      },
      "update_slack_pools": {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        "properties": {
          "channel": { "type": "string", "description": "Slack channel name" },
          "message": { "type": "string", "description": "Message to post" },
          "metadata": { "type": "object", "description": "Additional metadata" }
        },
        "required": ["channel", "message"],
        "additionalProperties": false
      },
      "operate_browser": {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        "properties": {
          "recipe": { "type": "string", "description": "Airtop recipe to execute" },
          "parameters": { "type": "object", "description": "Recipe parameters" }
        },
        "required": ["recipe"],
        "additionalProperties": false
      },
      "llm.route": {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        "properties": {
          "prompt": { "type": "string", "description": "LLM prompt" },
          "model": { "type": "string", "description": "Model to use" },
          "profile": { "type": "string", "description": "Policy profile" }
        },
        "required": ["prompt"],
        "additionalProperties": false
      },
      
      // ElevenLabs MCP tool schemas
      "elevenlabs.list_conversations": {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        "properties": {
          "agent_id": { 
            "type": "string", 
            "description": "Agent ID to filter conversations (defaults to authorized agent)" 
          },
          "start_date": { 
            "type": "string", 
            "format": "date-time", 
            "description": "Start date for conversation filtering" 
          },
          "end_date": { 
            "type": "string", 
            "format": "date-time", 
            "description": "End date for conversation filtering" 
          },
          "limit": { 
            "type": "number", 
            "default": 100, 
            "minimum": 1, 
            "maximum": 1000,
            "description": "Maximum number of conversations to return" 
          },
          "offset": { 
            "type": "number", 
            "default": 0, 
            "minimum": 0,
            "description": "Number of conversations to skip for pagination" 
          },
          "status": { 
            "type": "string", 
            "enum": ["active", "ended", "failed"],
            "description": "Filter conversations by status" 
          }
        },
        "additionalProperties": false
      },
      
      "elevenlabs.get_conversation_transcript": {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        "properties": {
          "conversation_id": { 
            "type": "string", 
            "description": "Conversation ID to get transcript for" 
          },
          "format": { 
            "type": "string", 
            "enum": ["json", "text", "srt", "vtt"],
            "default": "json",
            "description": "Format to return transcript in" 
          }
        },
        "required": ["conversation_id"],
        "additionalProperties": false
      },
      
      "elevenlabs.get_conversation_audio": {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        "properties": {
          "conversation_id": { 
            "type": "string", 
            "description": "Conversation ID to get audio for" 
          },
          "format": { 
            "type": "string", 
            "enum": ["mp3", "wav", "pcm", "ulaw"],
            "default": "mp3",
            "description": "Audio format to download" 
          }
        },
        "required": ["conversation_id"],
        "additionalProperties": false
      },
      
      "elevenlabs.search_conversations": {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        "properties": {
          "query": { 
            "type": "string", 
            "description": "Search query for conversation content" 
          },
          "agent_id": { 
            "type": "string", 
            "description": "Agent ID to filter search results" 
          },
          "start_date": { 
            "type": "string", 
            "format": "date-time", 
            "description": "Start date for search filtering" 
          },
          "end_date": { 
            "type": "string", 
            "format": "date-time", 
            "description": "End date for search filtering" 
          },
          "limit": { 
            "type": "number", 
            "default": 50, 
            "minimum": 1, 
            "maximum": 500,
            "description": "Maximum number of results to return" 
          }
        },
        "required": ["query"],
        "additionalProperties": false
      },
      
      "elevenlabs.analyze_conversation": {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        "properties": {
          "conversation_id": { 
            "type": "string", 
            "description": "Conversation ID to analyze" 
          }
        },
        "required": ["conversation_id"],
        "additionalProperties": false
      },
      
      "elevenlabs.export_transcript": {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        "properties": {
          "conversation_id": { 
            "type": "string", 
            "description": "Conversation ID to export transcript for" 
          },
          "format": { 
            "type": "string", 
            "enum": ["txt", "json", "srt", "vtt"],
            "default": "txt",
            "description": "Export format for transcript" 
          },
          "include_metadata": { 
            "type": "boolean", 
            "default": true,
            "description": "Whether to include conversation metadata in export" 
          }
        },
        "required": ["conversation_id"],
        "additionalProperties": false
      },
      
      "elevenlabs.configure_webhook": {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        "properties": {
          "webhook_url": { 
            "type": "string", 
            "format": "uri",
            "description": "URL endpoint for webhook notifications" 
          },
          "events": { 
            "type": "array",
            "items": {
              "type": "string",
              "enum": ["conversation.started", "conversation.ended", "conversation.failed", "conversation.updated"]
            },
            "default": ["conversation.ended"],
            "description": "List of events to subscribe to" 
          },
          "secret": { 
            "type": "string", 
            "description": "Secret key for webhook signature verification" 
          }
        },
        "required": ["webhook_url"],
        "additionalProperties": false
      },
      
      "elevenlabs.verify_webhook_signature": {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        "properties": {
          "payload": { 
            "type": "string", 
            "description": "Webhook payload body as string" 
          },
          "signature": { 
            "type": "string", 
            "description": "Webhook signature from headers" 
          },
          "secret": { 
            "type": "string", 
            "description": "Secret key used for signature verification" 
          }
        },
        "required": ["payload", "signature", "secret"],
        "additionalProperties": false
      },
      
      // Phase 3: Conversation Context MCP tool schemas
      "conversation.create_platform_conversation": {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        "properties": {
          "conversationId": { 
            "type": "string", 
            "description": "External conversation ID (ElevenLabs conversation ID, etc.)" 
          },
          "agentId": { 
            "type": "string", 
            "description": "Agent handling the conversation" 
          },
          "source": { 
            "type": "string", 
            "description": "Source of the conversation (elevenlabs, manual, chat, etc.)" 
          },
          "metadata": { 
            "type": "object", 
            "description": "Additional metadata for the conversation" 
          },
          "participantCount": { 
            "type": "integer", 
            "minimum": 1,
            "default": 2,
            "description": "Number of participants in the conversation" 
          }
        },
        "required": ["conversationId", "agentId", "source"],
        "additionalProperties": false
      },
      
      "conversation.set_context": {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        "properties": {
          "conversationId": { 
            "type": "string", 
            "description": "External conversation ID" 
          },
          "contextKey": { 
            "type": "string", 
            "description": "Key for the context (candidate_profile, interview_stage, preferences, etc.)" 
          },
          "contextValue": { 
            "description": "Value of the context (JSON object or primitive)" 
          },
          "contextType": { 
            "type": "string", 
            "enum": ["candidate", "agent", "system", "business_rule"],
            "default": "system",
            "description": "Type of context being stored" 
          },
          "priority": { 
            "type": "integer", 
            "minimum": 1,
            "maximum": 10,
            "default": 5,
            "description": "Priority of this context (1-10)" 
          },
          "tags": { 
            "type": "array", 
            "items": { "type": "string" },
            "description": "Tags for searchability" 
          }
        },
        "required": ["conversationId", "contextKey", "contextValue"],
        "additionalProperties": false
      },
      
      "conversation.get_context": {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        "properties": {
          "conversationId": { 
            "type": "string", 
            "description": "External conversation ID" 
          },
          "contextKey": { 
            "type": "string", 
            "description": "Specific context key to retrieve (optional)" 
          },
          "contextType": { 
            "type": "string", 
            "description": "Specific context type to retrieve (optional)" 
          }
        },
        "required": ["conversationId"],
        "additionalProperties": false
      },
      
      "conversation.store_memory": {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        "properties": {
          "agentId": { 
            "type": "string", 
            "description": "Agent ID owning this memory" 
          },
          "memoryKey": { 
            "type": "string", 
            "description": "Key for the memory (candidate_preferences, successful_techniques, etc.)" 
          },
          "memoryValue": { 
            "description": "Value of the memory (JSON object or primitive)" 
          },
          "memoryType": { 
            "type": "string", 
            "enum": ["learned_pattern", "user_preference", "success_factor", "failure_pattern"],
            "default": "learned_pattern",
            "description": "Type of memory being stored" 
          },
          "confidence": { 
            "type": "number", 
            "minimum": 0,
            "maximum": 1,
            "default": 0.5,
            "description": "Confidence in this memory (0.0-1.0)" 
          },
          "source": { 
            "type": "string", 
            "default": "conversation",
            "description": "Source where this memory came from" 
          },
          "relatedConversationIds": { 
            "type": "array", 
            "items": { "type": "string" },
            "description": "Related conversation IDs" 
          },
          "tags": { 
            "type": "array", 
            "items": { "type": "string" },
            "description": "Tags for searchability" 
          }
        },
        "required": ["agentId", "memoryKey", "memoryValue"],
        "additionalProperties": false
      },
      
      "conversation.get_memory": {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        "properties": {
          "agentId": { 
            "type": "string", 
            "description": "Agent ID to retrieve memory for" 
          },
          "memoryKey": { 
            "type": "string", 
            "description": "Specific memory key to retrieve (optional)" 
          },
          "memoryType": { 
            "type": "string", 
            "description": "Specific memory type to retrieve (optional)" 
          },
          "limit": { 
            "type": "integer", 
            "minimum": 1,
            "maximum": 100,
            "default": 50,
            "description": "Maximum number of memories to retrieve" 
          }
        },
        "required": ["agentId"],
        "additionalProperties": false
      },
      
      "conversation.search_memory": {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        "properties": {
          "agentId": { 
            "type": "string", 
            "description": "Agent ID to search memory for" 
          },
          "searchTerms": { 
            "type": "array", 
            "items": { "type": "string" },
            "minItems": 1,
            "description": "Search terms to look for in memory" 
          },
          "memoryTypes": { 
            "type": "array", 
            "items": { 
              "type": "string",
              "enum": ["learned_pattern", "user_preference", "success_factor", "failure_pattern"]
            },
            "description": "Filter by specific memory types (optional)" 
          }
        },
        "required": ["agentId", "searchTerms"],
        "additionalProperties": false
      }
    };
    return schemas[name] || {
      "$schema": "http://json-schema.org/draft-07/schema#",
      "type": "object",
      "additionalProperties": true
    };
  }

  async listTools() {
    return {
      tools: Array.from(this.tools.keys()).map(name => ({
        name,
        description: this.getToolDescription(name),
        inputSchema: this.getToolInputSchema(name),
      })),
    };
  }

  async callTool(name: string, args: any) {
    if (!this.tools.has(name)) {
      throw new Error(`Unknown tool: ${name}`);
    }

    try {
      const tool = this.tools.get(name)!;
      const result = await tool(args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result),
          },
        ],
      };
    } catch (error) {
      throw new Error(`Tool execution failed: ${String(error)}`);
    }
  }

  getServer() {
    return this.server;
  }
}

export const mcpServer = new MCPServer();

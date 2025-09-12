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
  llmRoute
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
      "launch_indeed_campaign": "Launch a job posting campaign on Indeed with specified parameters",
      "manage_apify_actor": "CRUD operations on Apify actors including run, monitor, and dataset management",
      "process_candidate": "Update candidate pipeline stage, recompute score, update Indeed disposition, move Slack pools",
      "send_interview_links": "Generate and send interview links to candidates via email",
      "create_calendar_slots": "Create available calendar slots for interview booking",
      "book_interview": "Book an interview slot and generate ICS file",
      "db.upsert_candidate": "Insert or update candidate record in database",
      "create_candidate_from_interview": "Create or update candidate from ElevenLabs interview agent data",
      "db.write_interview": "Write interview results and scorecard to database",
      "update_slack_pools": "Ensure Slack channels exist and post updates",
      "operate_browser": "Execute browser automation via Airtop for fallback scenarios",
      "llm.route": "Route LLM requests through OpenRouter with policy profiles",
    };
    return descriptions[name] || "Tool description not available";
  }

  private getToolInputSchema(name: string): any {
    // Return proper JSON Schema format for ElevenLabs compatibility
    const schemas: Record<string, any> = {
      "launch_indeed_campaign": {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        "properties": {
          "title": { 
            "type": "string", 
            "description": "Job title for the Indeed campaign" 
          },
          "location": { 
            "type": "string", 
            "description": "Job location (e.g., 'San Francisco, CA' or 'Remote')" 
          },
          "description": { 
            "type": "string", 
            "description": "Detailed job description" 
          },
          "requirements": { 
            "type": "array", 
            "items": { "type": "string" },
            "description": "Array of job requirements" 
          },
          "salary": {
            "type": "string",
            "description": "Salary range (optional)"
          }
        },
        "required": ["title", "location", "description"],
        "additionalProperties": false
      },
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

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { storage } from "../storage";
import { 
  launchIndeedCampaign,
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
    this.tools.set("launch_indeed_campaign", launchIndeedCampaign);
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
    // Return JSON schema for tool inputs
    const schemas: Record<string, any> = {
      "launch_indeed_campaign": {
        type: "object",
        properties: {
          title: { type: "string" },
          location: { type: "string" },
          description: { type: "string" },
          requirements: { type: "array", items: { type: "string" } },
        },
        required: ["title", "location", "description"],
      },
      "manage_apify_actor": {
        type: "object",
        properties: {
          action: { type: "string", enum: ["create", "read", "update", "delete", "run", "monitor"] },
          actorId: { type: "string" },
          configuration: { type: "object" },
        },
        required: ["action"],
      },
      "process_candidate": {
        type: "object",
        properties: {
          candidateId: { type: "string" },
          newStage: { type: "string" },
          notes: { type: "string" },
        },
        required: ["candidateId", "newStage"],
      },
      "create_candidate_from_interview": {
        type: "object",
        properties: {
          name: { type: "string" },
          email: { type: "string" },
          phone: { type: "string" },
          interviewData: { type: "object" },
          score: { type: "number", minimum: 0, maximum: 100 },
          notes: { type: "string" },
          pipelineStage: { type: "string", enum: ["NEW", "FIRST_INTERVIEW", "TECHNICAL_SCREEN", "FINAL_INTERVIEW", "OFFER", "HIRED", "REJECTED"] },
        },
        required: ["name", "email"],
      },
      // Add other tool schemas as needed
    };
    return schemas[name] || { type: "object" };
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

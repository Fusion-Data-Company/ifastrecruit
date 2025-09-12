import { useState } from "react";
import { apiRequest } from "./queryClient";

interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
}

interface MCPResponse {
  content: Array<{
    type: string;
    text: string;
  }>;
}

export function useMCPClient() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listTools = async (): Promise<MCPTool[]> => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await apiRequest("POST", "/api/mcp/tools/list", {});
      const data = await response.json();
      
      return data.tools || [];
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to list tools";
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const callTool = async (name: string, args: any = {}): Promise<any> => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await apiRequest("POST", "/api/mcp/tools/call", {
        name,
        arguments: args,
      });
      
      const data: MCPResponse = await response.json();
      
      // Parse the response content
      if (data.content && data.content.length > 0) {
        const textContent = data.content[0].text;
        try {
          return JSON.parse(textContent);
        } catch {
          return { success: true, message: textContent };
        }
      }
      
      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Tool execution failed";
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Convenience methods for specific tools
  const launchCampaign = async (params: {
    title: string;
    location: string;
    description: string;
    requirements?: string[];
  }) => {
    return await callTool("launch_campaign", params);
  };

  const processCandidate = async (candidateId: string, newStage: string, notes?: string) => {
    return await callTool("process_candidate", {
      candidateId,
      newStage,
      notes,
    });
  };

  const sendInterviewLinks = async (candidateIds: string[]) => {
    return await callTool("send_interview_links", {
      candidateIds,
      templateType: "INTERVIEW_INVITE",
    });
  };

  const manageApifyActor = async (action: string, actorId?: string, configuration?: any) => {
    return await callTool("manage_apify_actor", {
      action,
      actorId,
      configuration,
    });
  };

  const routeLLM = async (prompt: string, profile: "orchestrator" | "research" | "fast" = "orchestrator") => {
    return await callTool("llm.route", {
      prompt,
      profile,
    });
  };

  const operateBrowser = async (recipe: string, params: any) => {
    return await callTool("operate_browser", {
      recipe,
      params,
    });
  };

  const updateSlackPools = async (channel?: string, message?: string, blocks?: any) => {
    return await callTool("update_slack_pools", {
      channel,
      message,
      blocks,
    });
  };

  const createCalendarSlots = async (startDate: string, endDate: string, duration: number = 60) => {
    return await callTool("create_calendar_slots", {
      startDate,
      endDate,
      duration,
    });
  };

  const bookInterview = async (candidateId: string, startTs: string, endTs: string, location?: string) => {
    return await callTool("book_interview", {
      candidateId,
      startTs,
      endTs,
      location,
    });
  };

  return {
    isLoading,
    error,
    listTools,
    callTool,
    // Convenience methods
    launchCampaign,
    processCandidate,
    sendInterviewLinks,
    manageApifyActor,
    routeLLM,
    operateBrowser,
    updateSlackPools,
    createCalendarSlots,
    bookInterview,
  };
}

// Hook for getting available tools
export function useMCPTools() {
  const [tools, setTools] = useState<MCPTool[]>([]);
  const { listTools, isLoading, error } = useMCPClient();

  const refreshTools = async () => {
    try {
      const toolList = await listTools();
      setTools(toolList);
    } catch (err) {
      console.error("Failed to fetch tools:", err);
    }
  };

  // Load tools on mount
  useState(() => {
    refreshTools();
  });

  return {
    tools,
    isLoading,
    error,
    refreshTools,
  };
}

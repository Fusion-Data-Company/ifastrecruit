import { airtopIntegration } from "./airtop";
import { storage } from "../storage";

export class IndeedIntegration {
  private apiKey: string;
  private baseUrl = "https://api.indeed.com/ads/apisearch";

  constructor() {
    this.apiKey = process.env.INDEED_API_KEY || "";
  }

  async createCampaign(params: {
    title: string;
    location: string;
    description: string;
    requirements?: string[];
  }): Promise<string> {
    try {
      // Try API first
      const response = await fetch(`${this.baseUrl}/campaigns`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: params.title,
          location: params.location,
          description: params.description,
          requirements: params.requirements || [],
        }),
      });

      if (!response.ok) {
        throw new Error(`Indeed API error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.jobId;
    } catch (error) {
      // Fallback to Airtop browser automation
      console.warn("Indeed API failed, falling back to Airtop browser automation");
      
      await storage.createAuditLog({
        actor: "indeed",
        action: "create_campaign_fallback",
        payloadJson: { error: String(error), params },
        pathUsed: "airtop",
      });

      const result = await airtopIntegration.executeRecipe("indeed.post_job", params);
      return result.jobId || "airtop-job-" + Date.now();
    }
  }

  async postDisposition(candidateId: string, status: "accepted" | "rejected"): Promise<void> {
    try {
      const candidate = await storage.getCandidate(candidateId);
      if (!candidate || !candidate.sourceRef) {
        throw new Error("Candidate not found or missing Indeed reference");
      }

      const response = await fetch(`${this.baseUrl}/applications/${candidate.sourceRef}/disposition`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        throw new Error(`Indeed disposition API error: ${response.statusText}`);
      }
    } catch (error) {
      // Fallback to Airtop
      await airtopIntegration.executeRecipe("indeed.update_disposition", {
        candidateId,
        status,
        sourceRef: (await storage.getCandidate(candidateId))?.sourceRef,
      });
    }
  }

  async ingestApplication(payload: any): Promise<void> {
    try {
      const candidateData = {
        name: payload.name,
        email: payload.email,
        phone: payload.phone,
        sourceRef: payload.applicationId,
        resumeUrl: payload.resumeUrl,
        pipelineStage: "NEW" as const,
        score: 0,
      };

      await storage.createCandidate(candidateData);
      
      await storage.createAuditLog({
        actor: "indeed",
        action: "ingest_application",
        payloadJson: payload,
        pathUsed: "api",
      });
    } catch (error) {
      throw new Error(`Failed to ingest Indeed application: ${String(error)}`);
    }
  }
}

export const indeedIntegration = new IndeedIntegration();

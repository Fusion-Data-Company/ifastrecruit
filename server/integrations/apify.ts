import ApifyClient from 'apify-client';
import { storage } from "../storage";
import { airtopIntegration } from "./airtop";

export class ApifyIntegration {
  private client: any;

  constructor() {
    const apiKey = process.env.APIFY_API_TOKEN || "";
    if (apiKey) {
      this.client = ApifyClient({ token: apiKey });
    }
  }

  async runActor(actorId: string, input: any): Promise<any> {
    if (!this.client) {
      throw new Error("APIFY_API_TOKEN not configured - cannot run actor");
    }
    try {
      const run = await this.client.actor(actorId).call(input);
      return run;
    } catch (error) {
      // Fallback to Airtop
      await storage.createAuditLog({
        actor: "apify",
        action: "run_actor_fallback",
        payloadJson: { error: String(error), actorId, input },
        pathUsed: "airtop",
      });

      return await airtopIntegration.executeRecipe("apify.run_or_fix", {
        actorId,
        input,
      });
    }
  }

  async getRunStatus(runId: string): Promise<any> {
    try {
      const run = await this.client.run(runId).get();
      return {
        status: run.status,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        stats: run.stats,
      };
    } catch (error) {
      throw new Error(`Failed to get run status: ${String(error)}`);
    }
  }

  async getDataset(runId: string): Promise<any[]> {
    try {
      const run = await this.client.run(runId).get();
      if (!run.defaultDatasetId) {
        return [];
      }

      const dataset = await this.client.dataset(run.defaultDatasetId).listItems();
      return dataset.items;
    } catch (error) {
      throw new Error(`Failed to get dataset: ${String(error)}`);
    }
  }

  async importDatasetToCandidates(runId: string, campaignId?: string): Promise<number> {
    try {
      const items = await this.getDataset(runId);
      let imported = 0;

      for (const item of items) {
        try {
          await storage.createCandidate({
            campaignId,
            name: item.name || "Unknown",
            email: item.email,
            phone: item.phone,
            sourceRef: item.id || item.url,
            pipelineStage: "NEW",
            tags: item.tags || [],
          });
          imported++;
        } catch (error) {
          // Skip duplicates or invalid entries
          console.warn(`Skipped candidate import: ${String(error)}`);
        }
      }

      await storage.createAuditLog({
        actor: "apify",
        action: "import_dataset",
        payloadJson: { runId, imported, total: items.length },
        pathUsed: "api",
      });

      return imported;
    } catch (error) {
      throw new Error(`Failed to import dataset: ${String(error)}`);
    }
  }
}

export const apifyIntegration = new ApifyIntegration();

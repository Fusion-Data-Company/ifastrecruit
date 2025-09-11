import { WebClient } from "@slack/web-api";
import { storage } from "../storage";

export class SlackIntegration {
  private client?: WebClient;
  private roundOneChannel: string;
  private hiresChannel: string;

  constructor() {
    const token = process.env.SLACK_BOT_TOKEN;
    if (token) {
      this.client = new WebClient(token);
    }
    this.roundOneChannel = process.env.SLACK_ROUND_ONE_CHANNEL || "ifast_round_one";
    this.hiresChannel = process.env.SLACK_HIRES_CHANNEL || "ifast_hires";
  }

  async ensurePools(): Promise<void> {
    if (!this.client) {
      console.log("Slack not configured - skipping pool creation");
      return;
    }
    try {
      // Ensure round one channel exists
      await this.ensureChannel(this.roundOneChannel, "First round interview candidates");
      
      // Ensure hires channel exists
      await this.ensureChannel(this.hiresChannel, "Successfully hired candidates");

      await storage.createAuditLog({
        actor: "slack",
        action: "ensure_pools",
        payloadJson: { 
          roundOneChannel: this.roundOneChannel, 
          hiresChannel: this.hiresChannel 
        },
        pathUsed: "api",
      });
    } catch (error) {
      console.log("Failed to ensure Slack pools (non-critical):", error);
    }
  }

  private async ensureChannel(channelName: string, purpose: string): Promise<string> {
    try {
      // Try to find existing channel
      const channels = await this.client!.conversations.list({
        types: "public_channel,private_channel",
      });

      const existingChannel = channels.channels?.find(
        channel => channel.name === channelName.replace("#", "")
      );

      if (existingChannel) {
        return existingChannel.id!;
      }

      // Create new channel
      const result = await this.client!.conversations.create({
        name: channelName.replace("#", ""),
        is_private: false,
      });

      // Set channel purpose
      if (result.channel?.id) {
        await this.client!.conversations.setPurpose({
          channel: result.channel.id,
          purpose,
        });
      }

      return result.channel?.id || "";
    } catch (error) {
      throw new Error(`Failed to ensure channel ${channelName}: ${String(error)}`);
    }
  }

  async postUpdate(channel: string, message: string, blocks?: any): Promise<string | undefined> {
    if (!this.client) {
      console.log(`Slack not configured - would have posted: ${message}`);
      return undefined;
    }
    try {
      // Resolve channel name to ID if needed
      const channelId = channel.startsWith("#") 
        ? await this.getChannelId(channel.slice(1))
        : channel;

      const response = await this.client.chat.postMessage({
        channel: channelId,
        text: message,
        blocks,
      });

      await storage.createAuditLog({
        actor: "slack",
        action: "post_update",
        payloadJson: { channel, message, messageTs: response.ts },
        pathUsed: "api",
      });

      return response.ts;
    } catch (error) {
      console.log("Failed to post Slack update (non-critical):", error);
      return undefined;
    }
  }

  private async getChannelId(channelName: string): Promise<string> {
    const channels = await this.client!.conversations.list({
      types: "public_channel,private_channel",
    });

    const channel = channels.channels?.find(ch => ch.name === channelName);
    if (!channel) {
      throw new Error(`Channel #${channelName} not found`);
    }

    return channel.id!;
  }

  async postCandidateUpdate(candidateId: string, stage: string, notes?: string): Promise<void> {
    if (!this.client) {
      console.log(`Slack not configured - would have posted candidate update for ${candidateId}`);
      return;
    }
    try {
      const candidate = await storage.getCandidate(candidateId);
      if (!candidate) {
        console.log("Candidate not found for Slack update");
        return;
      }

      const channel = stage === "HIRED" ? this.hiresChannel : this.roundOneChannel;
      
      const blocks = [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*${candidate.name}* moved to *${stage}*`,
          },
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Email:*\n${candidate.email}`,
            },
            {
              type: "mrkdwn",
              text: `*Score:*\n${candidate.score}%`,
            },
          ],
        },
      ];

      if (notes) {
        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Notes:*\n${notes}`,
          },
        });
      }

      await this.postUpdate(channel, `Candidate ${candidate.name} moved to ${stage}`, blocks);
    } catch (error) {
      console.log("Failed to post candidate update (non-critical):", error);
    }
  }
}

export const slackIntegration = new SlackIntegration();

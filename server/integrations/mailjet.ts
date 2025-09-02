import Mailjet from "node-mailjet";
import { storage } from "../storage";

export class MailjetIntegration {
  private client: any;
  private templates: Record<string, string>;

  constructor() {
    const apiKey = process.env.MAILJET_API_KEY;
    const apiSecret = process.env.MAILJET_API_SECRET;

    if (apiKey && apiSecret) {
      this.client = new Mailjet({
        apiKey,
        apiSecret,
      });
    }

    this.templates = {
      INTERVIEW_INVITE: process.env.MAILJET_TEMPLATE_INTERVIEW || "interview-invite",
      BOOKING_CONFIRM: process.env.MAILJET_TEMPLATE_BOOKING || "booking-confirm",
    };
  }

  async sendTemplate(
    toEmail: string,
    templateKey: string,
    variables: Record<string, any>
  ): Promise<void> {
    if (!this.client) {
      throw new Error("Mailjet not configured - cannot send template");
    }
    try {
      const templateId = this.templates[templateKey];
      if (!templateId) {
        throw new Error(`Template ${templateKey} not configured`);
      }

      const request = this.client.post("send", { version: "v3.1" }).request({
        Messages: [
          {
            From: {
              Email: "noreply@ifast-broker.com",
              Name: "iFast Broker",
            },
            To: [
              {
                Email: toEmail,
                Name: variables.candidateName || "Candidate",
              },
            ],
            TemplateID: parseInt(templateId),
            TemplateLanguage: true,
            Variables: variables,
          },
        ],
      });

      const result = await request;

      await storage.createAuditLog({
        actor: "mailjet",
        action: "send_template",
        payloadJson: {
          toEmail,
          templateKey,
          messageId: result.body.Messages[0].To[0].MessageID,
        },
        pathUsed: "api",
      });
    } catch (error) {
      throw new Error(`Failed to send email template: ${String(error)}`);
    }
  }

  async sendTransactional(
    toEmail: string,
    subject: string,
    htmlContent: string,
    textContent?: string
  ): Promise<void> {
    try {
      const request = this.client.post("send", { version: "v3.1" }).request({
        Messages: [
          {
            From: {
              Email: "noreply@ifast-broker.com",
              Name: "iFast Broker",
            },
            To: [
              {
                Email: toEmail,
              },
            ],
            Subject: subject,
            HTMLPart: htmlContent,
            TextPart: textContent || "",
          },
        ],
      });

      await request;

      await storage.createAuditLog({
        actor: "mailjet",
        action: "send_transactional",
        payloadJson: { toEmail, subject },
        pathUsed: "api",
      });
    } catch (error) {
      throw new Error(`Failed to send transactional email: ${String(error)}`);
    }
  }

  async processWebhook(eventData: any): Promise<void> {
    try {
      // Process Mailjet webhook events (delivery, bounce, open, click)
      await storage.createAuditLog({
        actor: "mailjet",
        action: "webhook_received",
        payloadJson: eventData,
        pathUsed: "api",
      });

      // Handle specific events
      for (const event of eventData.events || []) {
        switch (event.event) {
          case "delivered":
            console.log(`Email delivered to ${event.email}`);
            break;
          case "bounce":
            console.warn(`Email bounced for ${event.email}: ${event.error}`);
            break;
          case "open":
            console.log(`Email opened by ${event.email}`);
            break;
          case "click":
            console.log(`Email link clicked by ${event.email}`);
            break;
        }
      }
    } catch (error) {
      throw new Error(`Failed to process Mailjet webhook: ${String(error)}`);
    }
  }
}

export const mailjetIntegration = new MailjetIntegration();

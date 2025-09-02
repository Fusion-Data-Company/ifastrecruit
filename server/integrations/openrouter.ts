import { storage } from "../storage";

export class OpenRouterIntegration {
  private apiKey: string;
  private baseUrl = "https://openrouter.ai/api/v1";

  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY || "";
    if (!this.apiKey) {
      throw new Error("OPENROUTER_API_KEY environment variable is required");
    }
  }

  async chat(prompt: string, profile: "orchestrator" | "research" | "fast" = "orchestrator"): Promise<any> {
    try {
      const models = {
        orchestrator: "anthropic/claude-3.5-sonnet",
        research: "openai/gpt-4-turbo",
        fast: "openai/gpt-3.5-turbo",
      };

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "X-Title": "iFast Broker",
        },
        body: JSON.stringify({
          model: models[profile],
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
          max_tokens: profile === "fast" ? 1000 : 4000,
          temperature: profile === "research" ? 0.1 : 0.7,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.statusText}`);
      }

      const data = await response.json();

      await storage.createAuditLog({
        actor: "openrouter",
        action: "chat_completion",
        payloadJson: {
          profile,
          model: models[profile],
          promptLength: prompt.length,
          responseLength: data.choices[0]?.message?.content?.length || 0,
        },
        pathUsed: "api",
      });

      return {
        content: data.choices[0]?.message?.content || "",
        usage: data.usage,
        model: models[profile],
      };
    } catch (error) {
      // Retry with fast profile as fallback
      if (profile !== "fast") {
        console.warn(`OpenRouter ${profile} failed, retrying with fast profile`);
        return await this.chat(prompt, "fast");
      }
      
      throw new Error(`OpenRouter request failed: ${String(error)}`);
    }
  }

  async streamChat(prompt: string, profile: "orchestrator" | "research" | "fast" = "orchestrator"): Promise<ReadableStream> {
    const models = {
      orchestrator: "anthropic/claude-3.5-sonnet",
      research: "openai/gpt-4-turbo", 
      fast: "openai/gpt-3.5-turbo",
    };

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "X-Title": "iFast Broker",
      },
      body: JSON.stringify({
        model: models[profile],
        messages: [{ role: "user", content: prompt }],
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter streaming failed: ${response.statusText}`);
    }

    return response.body!;
  }
}

export const openrouterIntegration = new OpenRouterIntegration();

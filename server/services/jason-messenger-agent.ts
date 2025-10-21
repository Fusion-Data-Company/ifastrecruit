/**
 * Jason Messenger Agent Service
 *
 * Handles AI-powered responses in the Messenger platform
 * Uses OpenRouter API with the unified Jason persona
 */

import { openrouterIntegration } from '../integrations/openrouter';
import { storage } from '../storage';
import { db } from '../db';
import { messages, directMessages, users, channelMembers, channels } from '../../shared/schema';
import { eq, desc, and, or, sql } from 'drizzle-orm';
import { JASON_UNIFIED_PERSONA } from './jason-unified-persona';

interface MessageContext {
  channelId?: string;
  dmUserId?: string; // The user sending the DM to Jason
  messageText: string;
  senderId: string;
  senderName: string;
  senderInfo?: {
    hasFloridaLicense?: boolean;
    isMultiStateLicensed?: boolean;
    licensedStates?: string[];
    hasCompletedOnboarding?: boolean;
  };
  mentionedUsers?: string[];
  isDirectMention: boolean; // @Jason explicitly mentioned
  threadParentId?: string;
  channelInfo?: {
    name: string;
    tier: string;
    description?: string;
  };
}

interface AIResponse {
  content: string;
  usage: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  model: string;
  responseTime: number; // milliseconds
  contextSize: number; // number of messages used for context
}

export class JasonMessengerAgent {
  private JASON_USER_ID: string;
  private MAX_CONTEXT_MESSAGES = 20; // Last 20 messages for context
  private RESPONSE_TIMEOUT = 30000; // 30 seconds
  private MAX_RETRIES = 2;

  constructor(jasonUserId: string) {
    this.JASON_USER_ID = jasonUserId;
  }

  /**
   * Determine if Jason should respond to a message
   *
   * Jason responds when:
   * 1. Directly @mentioned in any channel
   * 2. Receives a DM
   * 3. Someone replies in a thread where Jason participated
   */
  async shouldRespond(context: MessageContext): Promise<{should: boolean; reason: string}> {
    // Always respond to direct mentions
    if (context.isDirectMention) {
      return { should: true, reason: "direct_mention" };
    }

    // Always respond to DMs
    if (context.dmUserId) {
      return { should: true, reason: "direct_message" };
    }

    // Respond to thread replies where Jason is participating
    if (context.threadParentId) {
      const isParticipating = await this.isParticipatingInThread(context.threadParentId);
      if (isParticipating) {
        return { should: true, reason: "thread_participation" };
      }
    }

    // Don't respond to general channel chatter
    return { should: false, reason: "not_applicable" };
  }

  /**
   * Check if Jason has replied in a thread
   */
  async isParticipatingInThread(parentMessageId: string): Promise<boolean> {
    const replies = await db
      .select()
      .from(messages)
      .where(eq(messages.parentMessageId, parentMessageId))
      .limit(100); // Check up to 100 replies

    return replies.some(reply => reply.userId === this.JASON_USER_ID);
  }

  /**
   * Build conversation context from recent messages
   * Returns array of messages in OpenAI format
   */
  async buildContext(context: MessageContext): Promise<{
    messages: Array<{role: string; content: string}>;
    count: number;
  }> {
    let recentMessages: any[] = [];

    if (context.channelId) {
      // Get channel messages
      recentMessages = await db
        .select({
          content: messages.content,
          userId: messages.userId,
          createdAt: messages.createdAt,
          userName: users.firstName,
          userLastName: users.lastName,
        })
        .from(messages)
        .leftJoin(users, eq(messages.userId, users.id))
        .where(
          and(
            eq(messages.channelId, context.channelId),
            // Don't include thread replies in channel context
            sql`${messages.parentMessageId} IS NULL`
          )
        )
        .orderBy(desc(messages.createdAt))
        .limit(this.MAX_CONTEXT_MESSAGES);

    } else if (context.dmUserId) {
      // Get DM conversation between user and Jason
      recentMessages = await db
        .select({
          content: directMessages.content,
          userId: directMessages.senderId,
          createdAt: directMessages.createdAt,
          userName: users.firstName,
          userLastName: users.lastName,
        })
        .from(directMessages)
        .leftJoin(users, eq(directMessages.senderId, users.id))
        .where(
          or(
            and(
              eq(directMessages.senderId, context.senderId),
              eq(directMessages.recipientId, this.JASON_USER_ID)
            ),
            and(
              eq(directMessages.senderId, this.JASON_USER_ID),
              eq(directMessages.recipientId, context.senderId)
            )
          )
        )
        .orderBy(desc(directMessages.createdAt))
        .limit(this.MAX_CONTEXT_MESSAGES);
    }

    // Reverse to chronological order (oldest first)
    recentMessages.reverse();

    // Convert to OpenAI message format
    const contextMessages = recentMessages.map(msg => {
      const fullName = `${msg.userName || 'User'} ${msg.userLastName || ''}`.trim();

      return {
        role: msg.userId === this.JASON_USER_ID ? 'assistant' : 'user',
        content: msg.userId === this.JASON_USER_ID
          ? msg.content // Jason's previous responses
          : `${fullName}: ${msg.content}` // User messages with name
      };
    });

    return {
      messages: contextMessages,
      count: contextMessages.length
    };
  }

  /**
   * Build context-enhanced system prompt
   */
  private buildSystemPrompt(context: MessageContext): string {
    let enhancedPrompt = JASON_UNIFIED_PERSONA;

    // Add channel context if in a channel
    if (context.channelInfo) {
      enhancedPrompt += `\n\n## CURRENT CONTEXT\n\n`;
      enhancedPrompt += `You are currently in the "${context.channelInfo.name}" channel.\n`;
      enhancedPrompt += `Channel tier: ${context.channelInfo.tier}\n`;

      if (context.channelInfo.tier === 'NON_LICENSED') {
        enhancedPrompt += `Focus on: Licensing process, class schedules, costs, getting started.\n`;
      } else if (context.channelInfo.tier === 'FL_LICENSED') {
        enhancedPrompt += `Focus on: Immediate job opportunities, commission structures, inbound call positions.\n`;
      } else if (context.channelInfo.tier === 'MULTI_STATE') {
        enhancedPrompt += `Focus on: Nationwide opportunities, sponsor connections, multi-market access.\n`;
      }
    }

    // Add user context if available
    if (context.senderInfo) {
      enhancedPrompt += `\n## USER INFORMATION\n\n`;
      enhancedPrompt += `User: ${context.senderName}\n`;

      if (context.senderInfo.hasFloridaLicense) {
        enhancedPrompt += `- Has Florida license ✅\n`;
      } else {
        enhancedPrompt += `- Needs Florida license\n`;
      }

      if (context.senderInfo.isMultiStateLicensed) {
        enhancedPrompt += `- Multi-state licensed ✅\n`;
        if (context.senderInfo.licensedStates?.length) {
          enhancedPrompt += `  States: ${context.senderInfo.licensedStates.join(', ')}\n`;
        }
      }
    }

    return enhancedPrompt;
  }

  /**
   * Generate AI response (COMPLETE, NON-STREAMING)
   *
   * This is the main method called by the WebSocket handler
   */
  async respondToMessage(context: MessageContext): Promise<AIResponse> {
    const startTime = Date.now();

    try {
      // Build conversation history
      const { messages: contextMessages, count } = await this.buildContext(context);

      // Build enhanced system prompt with context
      const systemPrompt = this.buildSystemPrompt(context);

      // Prepare messages for OpenRouter
      const allMessages = [
        { role: 'system', content: systemPrompt },
        ...contextMessages,
        { role: 'user', content: `${context.senderName}: ${context.messageText}` }
      ];

      console.log(`[Jason AI] Generating response with ${count} context messages`);

      // Call OpenRouter with retry logic
      const response = await this.callOpenRouterWithRetry(allMessages);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      console.log(`[Jason AI] Response generated in ${responseTime}ms`);

      // Log interaction for audit
      await storage.createAuditLog({
        actor: 'jason_ai',
        action: 'messenger_response',
        payloadJson: {
          channelId: context.channelId,
          dmUserId: context.dmUserId,
          senderId: context.senderId,
          messageLength: context.messageText.length,
          responseLength: response.content.length,
          contextSize: count,
          responseTime,
          model: response.model,
        },
      });

      return {
        content: response.content,
        usage: response.usage || {},
        model: response.model,
        responseTime,
        contextSize: count,
      };

    } catch (error) {
      console.error('[Jason AI] Error generating response:', error);

      // Log error
      await storage.createAuditLog({
        actor: 'jason_ai',
        action: 'messenger_response_error',
        payloadJson: {
          error: String(error),
          channelId: context.channelId,
          dmUserId: context.dmUserId,
        },
      });

      // Return fallback response
      return {
        content: this.getFallbackResponse(),
        usage: {},
        model: 'fallback',
        responseTime: Date.now() - startTime,
        contextSize: 0,
      };
    }
  }

  /**
   * Call OpenRouter with retry logic
   */
  private async callOpenRouterWithRetry(
    messages: Array<{role: string; content: string}>,
    attempt: number = 0
  ): Promise<{content: string; model: string; usage: any}> {
    try {
      // Create timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('AI response timeout')), this.RESPONSE_TIMEOUT);
      });

      // Race between API call and timeout
      const response = await Promise.race([
        this.callOpenRouter(messages),
        timeoutPromise
      ]) as any;

      return response;

    } catch (error: any) {
      console.error(`[Jason AI] Attempt ${attempt + 1} failed:`, error.message);

      // If we haven't exhausted retries, try again
      if (attempt < this.MAX_RETRIES) {
        console.log(`[Jason AI] Retrying... (attempt ${attempt + 2}/${this.MAX_RETRIES + 1})`);

        // Exponential backoff: wait 1s, then 2s, then 4s
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));

        return this.callOpenRouterWithRetry(messages, attempt + 1);
      }

      // All retries failed
      throw error;
    }
  }

  /**
   * Actual OpenRouter API call
   */
  private async callOpenRouter(
    messages: Array<{role: string; content: string}>
  ): Promise<{content: string; model: string; usage: any}> {

    // Convert to single prompt (OpenRouter integration uses prompt, not messages array)
    const prompt = messages.map(m => {
      if (m.role === 'system') return `System: ${m.content}`;
      if (m.role === 'assistant') return `Jason: ${m.content}`;
      return m.content; // user messages already formatted
    }).join('\n\n');

    const response = await openrouterIntegration.chat(prompt, 'orchestrator');

    return {
      content: response.content,
      model: response.model,
      usage: response.usage,
    };
  }

  /**
   * Get fallback response when AI fails
   */
  private getFallbackResponse(): string {
    return `I'm experiencing some technical difficulties right now.

Please reach out directly:
📧 TheInsuranceSchool@gmail.com
📞 407.332.6645

Or try again in a moment - I should be back shortly!`;
  }

  /**
   * Save AI message to database
   */
  async saveMessage(options: {
    channelId?: string;
    dmRecipientId?: string;
    content: string;
    formattedContent?: string;
    parentMessageId?: string;
  }) {
    if (options.channelId) {
      // Save channel message
      const [savedMessage] = await db.insert(messages).values({
        channelId: options.channelId,
        userId: this.JASON_USER_ID,
        content: options.content,
        formattedContent: options.formattedContent || options.content,
        parentMessageId: options.parentMessageId || null,
        createdAt: new Date(),
      }).returning();

      return savedMessage;

    } else if (options.dmRecipientId) {
      // Save DM
      const [savedMessage] = await db.insert(directMessages).values({
        senderId: this.JASON_USER_ID,
        recipientId: options.dmRecipientId,
        content: options.content,
        formattedContent: options.formattedContent || options.content,
        parentMessageId: options.parentMessageId || null,
        createdAt: new Date(),
        isRead: false,
      }).returning();

      return savedMessage;
    }

    throw new Error('Must specify channelId or dmRecipientId');
  }
}

// Singleton instance - will be initialized with JASON_USER_ID from env
let jasonAgentInstance: JasonMessengerAgent | null = null;

export function getJasonAgent(): JasonMessengerAgent {
  if (!jasonAgentInstance) {
    const jasonUserId = process.env.JASON_USER_ID;
    if (!jasonUserId) {
      throw new Error('JASON_USER_ID environment variable not set');
    }
    jasonAgentInstance = new JasonMessengerAgent(jasonUserId);
  }
  return jasonAgentInstance;
}

export const jasonAgent = getJasonAgent;

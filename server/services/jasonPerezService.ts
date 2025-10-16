import axios from 'axios';

interface JasonAIResponse {
  message: string;
  shouldGreet: boolean;
  isAiGenerated?: boolean;
}

interface ResumeData {
  name?: string;
  email?: string;
  phone?: string;
  skills?: string[];
  experience?: any[];
  education?: any[];
  salesExperience?: boolean;
  customerServiceExperience?: boolean;
}

import { storage } from '../storage';
import type { JasonSetting, JasonTemplate } from '@shared/schema';

export class JasonPerezService {
  private readonly openAIKey: string;
  private readonly openRouterKey: string;
  private readonly useOpenAI: boolean;
  private readonly baseURL: string;
  private settings: Map<string, any> = new Map();
  private templates: JasonTemplate[] = [];
  private lastSettingsRefresh: number = 0;
  private readonly SETTINGS_CACHE_TTL = 60000; // Refresh settings every minute
  
  private defaultSystemPrompt = `You are Jason Perez, a successful insurance broker mentor and founder of The Insurance School, Florida's Oldest & Largest Private Insurance Education Provider supporting over 9,000 Brokers throughout Florida.

CORE PERSONALITY TRAITS:
- Warm, enthusiastic, and approachable with greetings like "Hey there!" or "Welcome!"
- Educational and explanatory - you love teaching people about insurance
- Professional yet personable - balance expertise with genuine care for candidates' success
- Use emojis sparingly and professionally: ✅ 🎯 💪 🌟 📚
- Focus on building confidence and providing clear next steps

KEY MESSAGING POINTS TO WEAVE IN NATURALLY:
1. **Florida 2-15 License**: The foundation for a successful insurance career
2. **Commission-Based Income**: "Build residual income, not hourly wages"
3. **Multi-State Opportunities**: Expanding beyond Florida multiplies earning potential
4. **Work-From-Home Options**: Modern insurance allows flexible remote work
5. **Career Growth**: From licensed agent to independent broker to agency owner

YOUR MENTORING APPROACH:
- Start with understanding their background and goals
- Connect their existing skills to insurance success
- Provide specific, actionable guidance
- Share realistic expectations and timelines
- Emphasize the support system available
- Always end with clear next steps

CONVERSATION STYLE:
- Professional but conversational tone
- Use "we" and "our" to build connection
- Break complex topics into digestible pieces
- Ask follow-up questions to show engagement
- Reference specific details from their background
- Celebrate wins and milestones

CONTEXTUAL RESPONSES:
- For NON_LICENSED: Focus on licensing benefits and process
- For FL_LICENSED: Emphasize immediate opportunities and income potential
- For MULTI_STATE: Highlight expanded markets and higher commissions
- For resumes: Connect their experience to insurance success
- For questions: Provide thorough but concise answers

Remember: You're a mentor who genuinely wants to see every candidate succeed. Be encouraging but honest, professional but personable, and always focused on their journey to success.`;

  constructor() {
    this.openAIKey = process.env.OPENAI_API_KEY || '';
    this.openRouterKey = process.env.OPENROUTER_API_KEY || '';
    
    // Prefer OpenAI if available, fallback to OpenRouter
    this.useOpenAI = !!this.openAIKey;
    
    if (this.useOpenAI) {
      this.baseURL = 'https://api.openai.com/v1';
      console.log('[Jason AI] Using OpenAI API');
    } else if (this.openRouterKey) {
      this.baseURL = 'https://openrouter.ai/api/v1';
      console.log('[Jason AI] Using OpenRouter API');
    } else {
      this.baseURL = ''; // Initialize with empty string when no API keys are present
      console.warn('[Jason AI] No API keys configured - AI responses will be disabled');
    }

    // Load initial settings
    this.refreshSettings();
  }

  private async refreshSettings(): Promise<void> {
    try {
      const now = Date.now();
      if (now - this.lastSettingsRefresh < this.SETTINGS_CACHE_TTL) {
        return; // Use cached settings
      }

      // Load settings from database
      const settings = await storage.getJasonSettings();
      this.settings.clear();
      for (const setting of settings) {
        this.settings.set(setting.settingKey, setting.settingValue);
      }

      // Load templates from database
      this.templates = await storage.getJasonTemplates();

      this.lastSettingsRefresh = now;
      console.log('[Jason AI] Settings refreshed from database');
    } catch (error) {
      console.error('[Jason AI] Error refreshing settings:', error);
      // Continue with default settings if database fails
    }
  }

  private async getSystemPrompt(): Promise<string> {
    await this.refreshSettings();
    
    const systemPromptSetting = this.settings.get('systemPrompt');
    if (systemPromptSetting) {
      return systemPromptSetting as string;
    }

    // Build dynamic system prompt based on personality settings
    const personality = this.settings.get('personality') || {
      professional: true,
      encouraging: true,
      technical: false,
      casual: false
    };

    const speakingStyle = this.settings.get('speakingStyle') || {
      formality: 50,
      enthusiasm: 70,
      detailLevel: 60
    };

    const background = this.settings.get('background') || '';

    let prompt = this.defaultSystemPrompt;

    // Add personality modifiers
    const traits: string[] = [];
    if (personality.professional) traits.push('professional');
    if (personality.encouraging) traits.push('encouraging and supportive');
    if (personality.technical) traits.push('technically knowledgeable');
    if (personality.casual) traits.push('casual and friendly');

    if (traits.length > 0) {
      prompt += `\n\nYour personality is ${traits.join(', ')}.`;
    }

    // Add speaking style modifiers
    if (speakingStyle.formality > 70) {
      prompt += '\nMaintain a formal and professional tone.';
    } else if (speakingStyle.formality < 30) {
      prompt += '\nUse a casual and conversational tone.';
    }

    if (speakingStyle.enthusiasm > 70) {
      prompt += '\nBe very enthusiastic and energetic.';
    } else if (speakingStyle.enthusiasm < 30) {
      prompt += '\nMaintain a calm and measured tone.';
    }

    if (speakingStyle.detailLevel > 70) {
      prompt += '\nProvide detailed and comprehensive responses.';
    } else if (speakingStyle.detailLevel < 30) {
      prompt += '\nKeep responses brief and to the point.';
    }

    if (background) {
      prompt += `\n\nBackground: ${background}`;
    }

    return prompt;
  }

  private async getTemplate(type: string, channelTier?: string): Promise<string | null> {
    await this.refreshSettings();
    
    // Find matching template
    const template = this.templates.find(t => 
      t.templateType === type && 
      (t.channelTier === channelTier || !t.channelTier) &&
      t.isActive
    );

    return template?.template || null;
  }

  private async callLLM(messages: any[]): Promise<string> {
    if (!this.openAIKey && !this.openRouterKey) {
      throw new Error('No API key configured');
    }

    const apiKey = this.useOpenAI ? this.openAIKey : this.openRouterKey;
    const model = this.useOpenAI ? 'gpt-4-turbo-preview' : 'anthropic/claude-3.5-sonnet';

    const response = await axios.post(
      `${this.baseURL}/chat/completions`,
      {
        model,
        messages,
        temperature: 0.7,
        max_tokens: 800,
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          ...(this.useOpenAI ? {} : {
            'HTTP-Referer': process.env.REPLIT_DOMAINS || 'https://ifastrecruit.com',
            'X-Title': 'iFast Recruit Messenger'
          })
        }
      }
    );

    return response.data.choices[0]?.message?.content || '';
  }

  async generateResponse(
    userMessage: string,
    conversationHistory: { role: 'user' | 'assistant'; content: string }[] = [],
    context?: {
      userName?: string;
      channel?: string;
      hasLicense?: boolean;
      licenseType?: string;
      isNewUser?: boolean;
      experienceLevel?: string;
    }
  ): Promise<JasonAIResponse> {
    if (!this.openAIKey && !this.openRouterKey) {
      return {
        message: "I'm currently unavailable, but our team is here to help! Please reach out directly through the platform.",
        shouldGreet: false,
        isAiGenerated: false
      };
    }

    try {
      // Get dynamic system prompt from settings
      let enhancedSystemPrompt = await this.getSystemPrompt();
      
      if (context?.channel) {
        enhancedSystemPrompt += `\n\nThe user is in the "${context.channel}" channel. Tailor your response appropriately.`;
      }

      if (context?.userName) {
        enhancedSystemPrompt += `\n\nThe candidate's name is ${context.userName}. Use their name naturally.`;
      }

      if (context?.hasLicense) {
        enhancedSystemPrompt += `\n\nThe candidate is already licensed. Focus on opportunities and next steps.`;
      }

      const messages = [
        { role: 'system', content: enhancedSystemPrompt },
        ...conversationHistory,
        { role: 'user', content: userMessage }
      ];

      const aiMessage = await this.callLLM(messages);

      return {
        message: aiMessage,
        shouldGreet: context?.isNewUser || false,
        isAiGenerated: true
      };

    } catch (error: any) {
      console.error('[Jason AI] Error generating response:', error.message);
      return this.getFallbackResponse(context);
    }
  }

  async generateWelcomeMessage(
    userName: string, 
    channel: string,
    licensingInfo?: {
      hasFloridaLicense: boolean;
      isMultiStateLicensed: boolean;
      states?: string[];
    }
  ): Promise<string> {
    const context = {
      userName,
      channel,
      hasLicense: licensingInfo?.hasFloridaLicense,
      isNewUser: true
    };

    const prompt = licensingInfo?.hasFloridaLicense 
      ? `${userName} just joined the ${channel} channel. They have a Florida insurance license. Welcome them warmly and provide relevant guidance.`
      : `${userName} just joined the ${channel} channel. They're new to insurance. Welcome them and explain the first steps.`;

    const response = await this.generateResponse(prompt, [], context);
    return response.message;
  }

  async generateChannelContextMessage(
    channel: string,
    trigger: 'join' | 'question' | 'milestone',
    additionalContext?: string
  ): Promise<string> {
    const prompts = {
      'NON_LICENSED': {
        join: "Generate a helpful message for someone who just joined the non-licensed channel. Focus on the benefits of getting licensed and the support we provide.",
        question: `Answer this licensing question: ${additionalContext}`,
        milestone: "Congratulate someone on taking the first step toward their insurance career."
      },
      'FL_LICENSED': {
        join: "Welcome a newly Florida-licensed broker. Emphasize immediate income opportunities and career growth paths.",
        question: `Answer this question from a Florida-licensed broker: ${additionalContext}`,
        milestone: "Congratulate a broker on getting their Florida license and outline next steps."
      },
      'MULTI_STATE': {
        join: "Welcome a multi-state licensed professional. Highlight the expanded opportunities and higher earning potential.",
        question: `Answer this question from a multi-state broker: ${additionalContext}`,
        milestone: "Congratulate someone on expanding their licenses to multiple states."
      }
    };

    const channelKey = channel.includes('NON_LICENSED') ? 'NON_LICENSED' : 
                      channel.includes('FL_LICENSED') ? 'FL_LICENSED' : 
                      channel.includes('MULTI_STATE') ? 'MULTI_STATE' : 'NON_LICENSED';

    const prompt = prompts[channelKey][trigger];
    const response = await this.generateResponse(prompt, [], { channel });
    return response.message;
  }

  async generateResumeFeedback(
    resumeData: ResumeData,
    userName?: string
  ): Promise<string> {
    const hasSalesExperience = resumeData.salesExperience || 
      resumeData.skills?.some(s => s.toLowerCase().includes('sales')) ||
      resumeData.experience?.some(e => JSON.stringify(e).toLowerCase().includes('sales'));

    const prompt = `Review this candidate's background and provide encouraging feedback connecting their experience to insurance success:
    
    Name: ${resumeData.name || userName || 'Candidate'}
    Skills: ${resumeData.skills?.join(', ') || 'Not specified'}
    Has Sales Experience: ${hasSalesExperience ? 'Yes' : 'No'}
    Has Customer Service Experience: ${resumeData.customerServiceExperience ? 'Yes' : 'No'}
    
    Provide specific, encouraging feedback about how their background translates to insurance success. Be specific about which skills are valuable.`;

    const response = await this.generateResponse(prompt, [], { userName });
    return response.message;
  }

  async generateCareerPathGuidance(
    currentStatus: 'non_licensed' | 'fl_licensed' | 'multi_state',
    goals?: string
  ): Promise<string> {
    const prompts = {
      non_licensed: "Explain the career path from getting licensed to building a successful insurance business. Include realistic timelines and income expectations.",
      fl_licensed: "Outline the career progression for a Florida-licensed broker, including specialization options and growth strategies.",
      multi_state: "Describe advanced career opportunities for multi-state brokers, including building an agency and passive income strategies."
    };

    const basePrompt = prompts[currentStatus];
    const fullPrompt = goals ? `${basePrompt} The candidate's goals are: ${goals}` : basePrompt;

    const response = await this.generateResponse(fullPrompt, []);
    return response.message;
  }

  async handleDirectQuestion(
    question: string,
    channel?: string,
    userName?: string
  ): Promise<JasonAIResponse> {
    return this.generateResponse(question, [], { channel, userName });
  }

  private getFallbackResponse(context?: any): JasonAIResponse {
    const fallbacks = {
      welcome: "Welcome to iFast Recruit! I'm Jason Perez, your mentor on this journey to insurance success. Whether you're just starting or already licensed, we're here to help you build a thriving career. What questions can I answer for you today?",
      licensing: "Getting your Florida 2-15 license is the first step to unlimited earning potential. The process is straightforward, and we'll guide you every step of the way. Ready to transform your career?",
      opportunity: "Insurance offers incredible opportunities - flexible hours, residual income, and the chance to truly help people. Let's discuss how you can get started!",
      general: "I'm here to help guide your insurance career journey. Feel free to ask about licensing, opportunities, or anything else!"
    };

    const message = context?.isNewUser ? fallbacks.welcome :
                   context?.channel?.includes('NON_LICENSED') ? fallbacks.licensing :
                   context?.channel?.includes('LICENSED') ? fallbacks.opportunity :
                   fallbacks.general;

    return {
      message,
      shouldGreet: context?.isNewUser || false,
      isAiGenerated: false
    };
  }
}

export const jasonPerez = new JasonPerezService();
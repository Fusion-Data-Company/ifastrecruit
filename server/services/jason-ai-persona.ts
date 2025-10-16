import axios from 'axios';

interface JasonAIResponse {
  message: string;
  shouldGreet: boolean;
}

export class JasonAIPersonaService {
  private readonly apiKey: string;
  private readonly baseURL = 'https://openrouter.ai/api/v1';
  
  private readonly systemPrompt = `You are Jason Perez, the founder and CEO of The Insurance School, Florida's Oldest & Largest Private Insurance Education Provider supporting over 9,000 Brokers throughout Florida.

CORE PERSONALITY TRAITS:
- Warm, enthusiastic, and approachable with greetings like "GOOD MORNING EVERYONE!" or "HELLO EVERYONE!"
- Educational and explanatory - you love teaching people about insurance
- Anti-hourly payment mindset: "Hourly is for grocery stores" - you push commission-based independent broker careers
- Very accessible - you're the CEO but you make yourself visible and available to candidates
- Use emojis naturally: 🌅 :sunrise_over_mountains: ⭐ 🔥 👍

KEY MESSAGING POINTS TO WEAVE IN:
1. **Licensing Costs** (mention when relevant): "$55 for Florida's Department of Financial Services application, $70 fingerprinting, $44 state exam"
2. **Commission Rates**: "Independent Brokers make 17% to 20% commission on indemnity products"
3. **Your YouTube**: "Check out @BeatEveryone on YouTube - That's my class"
4. **Company Identity**: "Florida's Oldest & Largest Private Insurance Education Provider supporting 9k+ Brokers"
5. **Anti-Hourly Philosophy**: "Hourly is for grocery stores. As a rule of thumb... Discuss Salaries."
6. **Agent vs Broker**: "Agent in Insurance means EMPLOYEE. Broker means INDEPENDENT"
7. **Contact Info**: TheInsuranceSchool@gmail.com, Central Florida Insurance School 407.332.6645

YOUR TEACHING APPROACH:
- Start with simple indemnity products (Accident insurance, think AFLAC)
- Explain residual income: "Every time your client pays their premium you also get paid"
- Example numbers: "An indemnity policy for an older couple w/ kids costs ~$500/month = $90-$100 monthly residual at 17-20%"
- Emphasize work-from-home opportunities with sales support
- Connect insurance to helping neighbors and local community
- No participation trophies - rewards for hungry go-getters

CONVERSATION STYLE:
- Use casual, friendly language
- Break messages into multiple short paragraphs (like texting)
- Ask questions to understand candidate's situation
- Tailor responses based on experience level
- Reference specific details from their background
- Always provide next steps or action items

IMPORTANT CONTEXTS:
- Your next 2-15 licensing class typically starts soon (mention dates when scheduling)
- Classes are 9:30am-1:30pm, Monday + Tuesday + Thursday + Friday
- WEB Wednesdays introduce work-from-home sponsors and personal broker website building
- You have sponsors like Peter Colon for scholarships, Neil Schwabe (MGA with United Healthcare) for iFastBroker positions
- Licensed candidates can start immediately with inbound Fixed Indemnity calls

Remember: You're not just recruiting - you're helping people build real careers. Be genuine, educational, and always focused on the candidate's success.`;

  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY || '';
    if (!this.apiKey) {
      console.warn('[Jason AI] OPENROUTER_API_KEY not set - AI responses will be disabled');
    }
  }

  async generateResponse(
    userMessage: string,
    conversationHistory: { role: 'user' | 'assistant'; content: string }[] = [],
    context?: {
      userName?: string;
      hasLicense?: boolean;
      licenseType?: string;
      isNewUser?: boolean;
      experienceLevel?: string;
    }
  ): Promise<JasonAIResponse> {
    if (!this.apiKey) {
      return {
        message: "AI responses are currently unavailable. Please contact our team directly at TheInsuranceSchool@gmail.com or 407.332.6645",
        shouldGreet: false
      };
    }

    try {
      // Build context-aware system prompt
      let enhancedSystemPrompt = this.systemPrompt;
      
      if (context?.isNewUser) {
        enhancedSystemPrompt += `\n\nIMPORTANT: This is a NEW candidate who just joined. Give them a warm welcome and thank them for taking the time to communicate with the AI interviewer. Introduce yourself as Jason Perez and explain what The Insurance School does.`;
      }

      if (context?.userName) {
        enhancedSystemPrompt += `\n\nThe candidate's name is ${context.userName}. Use their name naturally in conversation.`;
      }

      if (context?.hasLicense && context?.licenseType) {
        enhancedSystemPrompt += `\n\nThe candidate already has a ${context.licenseType} license. Acknowledge this and explain how they can start immediately or what additional licensing they might need.`;
      }

      if (context?.experienceLevel) {
        enhancedSystemPrompt += `\n\nCandidate's experience level: ${context.experienceLevel}. Tailor your response appropriately.`;
      }

      const messages = [
        { role: 'system', content: enhancedSystemPrompt },
        ...conversationHistory,
        { role: 'user', content: userMessage }
      ];

      const response = await axios.post(
        `${this.baseURL}/chat/completions`,
        {
          model: 'anthropic/claude-3.5-sonnet', // Can be configured per user preference
          messages,
          temperature: 0.8, // Slightly creative but consistent
          max_tokens: 800,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': process.env.REPLIT_DOMAINS || 'https://theinsuranceschool.com',
            'X-Title': 'The Insurance School Messenger'
          }
        }
      );

      const aiMessage = response.data.choices[0]?.message?.content || 
        "Thanks for reaching out! Let's connect soon. Text us at 407.332.6645 or email TheInsuranceSchool@gmail.com";

      return {
        message: aiMessage,
        shouldGreet: context?.isNewUser || false
      };

    } catch (error: any) {
      console.error('[Jason AI] Error generating response:', error.response?.data || error.message);
      
      // Fallback to template responses
      if (context?.isNewUser) {
        return {
          message: `HELLO! I'm Jason Perez & we're looking forward to connecting with you.\n\nThank you for taking the time to communicate with our AI Interviewer!\n\nWe're Florida's Oldest & Largest Private Insurance Education Provider. Currently we support over 9k Agents & Brokers throughout Florida.\n\nLet's discuss your career goals and how we can help you succeed in insurance. What interests you most - working from home, building an independent broker business, or something else?`,
          shouldGreet: true
        };
      }

      return {
        message: "I'm experiencing some technical difficulties. Please reach out to our team at TheInsuranceSchool@gmail.com or text 407.332.6645",
        shouldGreet: false
      };
    }
  }

  async generateWelcomeMessage(userName: string, hasLicense: boolean = false, licenseType?: string): Promise<string> {
    const context = {
      userName,
      hasLicense,
      licenseType,
      isNewUser: true
    };

    const response = await this.generateResponse(
      `Hi, I'm ${userName}. I just joined the platform.`,
      [],
      context
    );

    return response.message;
  }

  async generateChannelAssignmentMessage(
    userName: string, 
    channelName: string,
    licensingInfo?: {
      hasFloridaLicense: boolean;
      hasMultiStateLicense: boolean;
      states?: string[];
    }
  ): Promise<string> {
    let message = `@${userName} - Welcome to the ${channelName} channel!\n\n`;

    if (channelName === 'Onboarding') {
      message += `This is where you'll get all your initial setup information.\n\n`;
      message += `Our NEXT 2-15 Insurance licensing course will begin soon. Classes are 9:30am-1:30pm Monday + Tuesday + Thursday + Friday.\n\n`;
      message += `Applicants are responsible for ALL State Licensing costs:\n`;
      message += `💵 $55 to Florida's Department of Financial Services\n`;
      message += `💵 $70 Fingerprinting\n`;
      message += `💵 $44 State Exam\n\n`;
      message += `Questions? Text us at 407.332.6645 or email TheInsuranceSchool@gmail.com`;
    } else if (channelName === 'Non-Licensed Candidates') {
      message += `You're in the right place to start your insurance career!\n\n`;
      message += `Check out our licensing prep materials and don't forget - @BeatEveryone on YouTube is my class with tons of helpful content.\n\n`;
      message += `Remember: Hourly is for grocery stores. We're building Independent Brokers here! 💪`;
    } else if (channelName === 'Florida Licensed Brokers') {
      message += `Great to have a licensed Florida broker here!\n\n`;
      message += `Our most IMMEDIATE positions are taking inbound calls from prospects interested in Hospital Indemnity, Accident and small life policies.\n\n`;
      message += `Independent Brokers make 17% to 20% commission - that's $90-$100 monthly residual on a $500 policy. Every time your client pays, you get paid! 💰`;
    } else if (channelName === 'Multi-State Licensed') {
      message += `FANTASTIC! Multi-state brokers are in HIGH demand!\n\n`;
      if (licensingInfo?.states && licensingInfo.states.length > 0) {
        message += `I see you're licensed in: ${licensingInfo.states.join(', ')}.\n\n`;
      }
      message += `You have access to opportunities across multiple markets. Let's get you connected with our sponsors who work nationwide.\n\n`;
      message += `Text your name and email to 407.332.6645 and reference #iFastBroker - this tells our systems you're being sponsored by Neil Schwabe, MGA w/ United Healthcare.`;
    }

    return message;
  }

  async generateOnboardingResponse(question: string, answer: string): Promise<string> {
    const responses: Record<string, (ans: string) => string> = {
      'florida_license': (ans: string) => {
        if (ans.toLowerCase() === 'yes') {
          return `AWESOME! Having a Florida license puts you ahead of the curve. Let's talk about immediate opportunities - are you interested in taking inbound calls from home or building an independent broker business?`;
        }
        return `No worries! That's exactly why we're here. Our next 2-15 licensing class will get you ready for Florida. The course is 60 hours: $55 + $70 + $44 in state fees. Worth every penny for the career ahead!`;
      },
      'multi_state': (ans: string) => {
        if (ans.toLowerCase() === 'yes') {
          return `FANTASTIC! Multi-state licenses open up SO many opportunities. Which states are you licensed in? Some of our sponsors like United Healthcare work across 17 states with amazing indemnity products.`;
        }
        return `That's totally fine! Florida alone has incredible opportunities. We can always expand your licensing later once you're established and seeing that residual income roll in. 💵`;
      },
      'experience_level': (ans: string) => {
        if (ans.includes('experienced') || ans.includes('years')) {
          return `Love it! Experience in ${ans} gives you a strong foundation. In insurance, your communication skills and relationship-building are what matter most. Let's leverage what you know!`;
        }
        return `Perfect! Everyone starts somewhere. We've helped thousands of people with no insurance experience build six-figure careers. Your willingness to learn is what counts. 🚀`;
      },
      'availability': (ans: string) => {
        return `${ans} works great! We have both live class sessions and work-from-home opportunities that fit various schedules. WEB Wednesdays are especially flexible for building your online presence.`;
      }
    };

    const responseGen = responses[question];
    if (responseGen) {
      return responseGen(answer);
    }

    return `Thanks for sharing that! Let's keep moving forward. Remember, your career decision comes AFTER you've been licensed. First, let's get you the credentials you need to succeed.`;
  }
}

export const jasonAI = new JasonAIPersonaService();

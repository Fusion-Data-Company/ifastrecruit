import { z } from 'zod';

// Email templates
export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  variables: string[];
}

export const emailTemplates: Record<string, EmailTemplate> = {
  welcome: {
    id: 'welcome',
    name: 'Welcome Email',
    subject: 'Welcome to our recruiting process, {{candidateName}}!',
    htmlContent: `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2563eb;">Welcome, {{candidateName}}!</h1>
          <p>Thank you for your interest in joining our team. We've received your application and are excited to learn more about you.</p>
          <p><strong>Next Steps:</strong></p>
          <ul>
            <li>Our team will review your application within 2-3 business days</li>
            <li>If your qualifications match our requirements, we'll reach out to schedule an initial interview</li>
            <li>You'll receive updates on your application status via email</li>
          </ul>
          <p>If you have any questions, feel free to reply to this email.</p>
          <p>Best regards,<br>The Recruiting Team</p>
        </body>
      </html>
    `,
    textContent: `Welcome, {{candidateName}}!

Thank you for your interest in joining our team. We've received your application and are excited to learn more about you.

Next Steps:
- Our team will review your application within 2-3 business days
- If your qualifications match our requirements, we'll reach out to schedule an initial interview
- You'll receive updates on your application status via email

If you have any questions, feel free to reply to this email.

Best regards,
The Recruiting Team`,
    variables: ['candidateName'],
  },
  
  interview_invite: {
    id: 'interview_invite',
    name: 'Interview Invitation',
    subject: 'Interview Invitation - {{positionTitle}}',
    htmlContent: `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2563eb;">Interview Invitation</h1>
          <p>Dear {{candidateName}},</p>
          <p>We're pleased to invite you for an interview for the <strong>{{positionTitle}}</strong> position.</p>
          
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Interview Details</h3>
            <p><strong>Date:</strong> {{interviewDate}}</p>
            <p><strong>Time:</strong> {{interviewTime}}</p>
            <p><strong>Duration:</strong> {{duration}} minutes</p>
            <p><strong>Format:</strong> {{format}}</p>
            {{#if meetingLink}}
            <p><strong>Meeting Link:</strong> <a href="{{meetingLink}}">{{meetingLink}}</a></p>
            {{/if}}
            {{#if location}}
            <p><strong>Location:</strong> {{location}}</p>
            {{/if}}
          </div>
          
          <p><strong>What to expect:</strong></p>
          <ul>
            <li>Discussion about your background and experience</li>
            <li>Overview of the role and responsibilities</li>
            <li>Opportunity for you to ask questions</li>
          </ul>
          
          <p>Please confirm your attendance by replying to this email.</p>
          <p>We look forward to speaking with you!</p>
          <p>Best regards,<br>The Recruiting Team</p>
        </body>
      </html>
    `,
    textContent: `Interview Invitation

Dear {{candidateName}},

We're pleased to invite you for an interview for the {{positionTitle}} position.

Interview Details:
- Date: {{interviewDate}}
- Time: {{interviewTime}}
- Duration: {{duration}} minutes
- Format: {{format}}
{{#if meetingLink}}
- Meeting Link: {{meetingLink}}
{{/if}}
{{#if location}}
- Location: {{location}}
{{/if}}

What to expect:
- Discussion about your background and experience
- Overview of the role and responsibilities
- Opportunity for you to ask questions

Please confirm your attendance by replying to this email.

We look forward to speaking with you!

Best regards,
The Recruiting Team`,
    variables: ['candidateName', 'positionTitle', 'interviewDate', 'interviewTime', 'duration', 'format', 'meetingLink', 'location'],
  },
  
  follow_up: {
    id: 'follow_up',
    name: 'Follow-up Email',
    subject: 'Following up on your application',
    htmlContent: `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2563eb;">Application Update</h1>
          <p>Dear {{candidateName}},</p>
          <p>We wanted to provide you with an update on your application for the <strong>{{positionTitle}}</strong> position.</p>
          
          <p>{{updateMessage}}</p>
          
          {{#if nextSteps}}
          <p><strong>Next Steps:</strong></p>
          <p>{{nextSteps}}</p>
          {{/if}}
          
          <p>Thank you for your continued interest in our company. If you have any questions, please don't hesitate to reach out.</p>
          <p>Best regards,<br>The Recruiting Team</p>
        </body>
      </html>
    `,
    textContent: `Application Update

Dear {{candidateName}},

We wanted to provide you with an update on your application for the {{positionTitle}} position.

{{updateMessage}}

{{#if nextSteps}}
Next Steps:
{{nextSteps}}
{{/if}}

Thank you for your continued interest in our company. If you have any questions, please don't hesitate to reach out.

Best regards,
The Recruiting Team`,
    variables: ['candidateName', 'positionTitle', 'updateMessage', 'nextSteps'],
  },
  
  rejection: {
    id: 'rejection',
    name: 'Rejection Email',
    subject: 'Update on your application',
    htmlContent: `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2563eb;">Thank you for your interest</h1>
          <p>Dear {{candidateName}},</p>
          <p>Thank you for taking the time to apply for the <strong>{{positionTitle}}</strong> position and for your interest in our company.</p>
          
          <p>After careful consideration, we have decided to move forward with other candidates whose qualifications more closely match our current requirements.</p>
          
          <p>We were impressed by {{positiveNote}} and encourage you to apply for future opportunities that match your skills and experience.</p>
          
          <p>We'll keep your information on file and will reach out if a suitable position becomes available.</p>
          
          <p>Thank you again for your interest, and we wish you the best in your job search.</p>
          <p>Best regards,<br>The Recruiting Team</p>
        </body>
      </html>
    `,
    textContent: `Thank you for your interest

Dear {{candidateName}},

Thank you for taking the time to apply for the {{positionTitle}} position and for your interest in our company.

After careful consideration, we have decided to move forward with other candidates whose qualifications more closely match our current requirements.

We were impressed by {{positiveNote}} and encourage you to apply for future opportunities that match your skills and experience.

We'll keep your information on file and will reach out if a suitable position becomes available.

Thank you again for your interest, and we wish you the best in your job search.

Best regards,
The Recruiting Team`,
    variables: ['candidateName', 'positionTitle', 'positiveNote'],
  },
};

// Email service interface
export interface EmailService {
  sendEmail(to: string, templateId: string, variables: Record<string, any>): Promise<EmailResult>;
  sendBulkEmail(recipients: EmailRecipient[], templateId: string): Promise<BulkEmailResult>;
  validateTemplate(templateId: string, variables: Record<string, any>): boolean;
}

export interface EmailRecipient {
  email: string;
  variables: Record<string, any>;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface BulkEmailResult {
  success: boolean;
  sent: number;
  failed: number;
  errors: string[];
}

// Mailjet implementation
export class MailjetEmailService implements EmailService {
  private apiKey: string;
  private secretKey: string;
  private fromEmail: string;
  private fromName: string;

  constructor() {
    this.apiKey = process.env.MAILJET_API_KEY || '';
    this.secretKey = process.env.MAILJET_API_SECRET || '';
    this.fromEmail = process.env.FROM_EMAIL || 'noreply@company.com';
    this.fromName = process.env.FROM_NAME || 'Recruiting Team';

    if (!this.apiKey || !this.secretKey) {
      console.warn('Mailjet credentials not configured. Email functionality will be limited.');
    }
  }

  private interpolateTemplate(template: string, variables: Record<string, any>): string {
    let result = template;
    
    // Handle simple {{variable}} interpolation
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, String(value || ''));
    });
    
    // Handle basic {{#if variable}} conditional blocks
    const conditionalRegex = /{{#if (\w+)}}([\s\S]*?){{\/if}}/g;
    result = result.replace(conditionalRegex, (match, variable, content) => {
      return variables[variable] ? content : '';
    });
    
    return result;
  }

  validateTemplate(templateId: string, variables: Record<string, any>): boolean {
    const template = emailTemplates[templateId];
    if (!template) return false;
    
    // Check if all required variables are provided
    const missingVariables = template.variables.filter(
      variable => !(variable in variables)
    );
    
    return missingVariables.length === 0;
  }

  async sendEmail(to: string, templateId: string, variables: Record<string, any>): Promise<EmailResult> {
    try {
      const template = emailTemplates[templateId];
      if (!template) {
        return { success: false, error: 'Template not found' };
      }

      if (!this.validateTemplate(templateId, variables)) {
        return { success: false, error: 'Missing required template variables' };
      }

      const subject = this.interpolateTemplate(template.subject, variables);
      const htmlContent = this.interpolateTemplate(template.htmlContent, variables);
      const textContent = this.interpolateTemplate(template.textContent, variables);

      // If Mailjet is not configured, log the email instead of sending
      if (!this.apiKey || !this.secretKey) {
        console.log('Email would be sent:', {
          to,
          subject,
          templateId,
          variables,
        });
        return { success: true, messageId: `mock-${Date.now()}` };
      }

      // Mailjet API call would go here
      const response = await this.callMailjetAPI({
        Messages: [{
          From: {
            Email: this.fromEmail,
            Name: this.fromName,
          },
          To: [{
            Email: to,
          }],
          Subject: subject,
          TextPart: textContent,
          HTMLPart: htmlContent,
        }],
      });

      return { success: true, messageId: response.Messages?.[0]?.MessageID };
    } catch (error) {
      console.error('Failed to send email:', error);
      return { success: false, error: String(error) };
    }
  }

  async sendBulkEmail(recipients: EmailRecipient[], templateId: string): Promise<BulkEmailResult> {
    const results = await Promise.allSettled(
      recipients.map(recipient => 
        this.sendEmail(recipient.email, templateId, recipient.variables)
      )
    );

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.success) {
        sent++;
      } else {
        failed++;
        const error = result.status === 'rejected' 
          ? result.reason 
          : result.value.error;
        errors.push(`${recipients[index].email}: ${error}`);
      }
    });

    return {
      success: failed === 0,
      sent,
      failed,
      errors,
    };
  }

  private async callMailjetAPI(payload: any): Promise<any> {
    if (!this.apiKey || !this.secretKey) {
      throw new Error('Mailjet credentials not configured');
    }

    // Mock implementation - replace with actual Mailjet API call
    return {
      Messages: [{
        MessageID: `mailjet-${Date.now()}`,
        Status: 'success',
      }],
    };
  }
}

// Email automation workflows
export class EmailAutomationService {
  private emailService: EmailService;

  constructor(emailService: EmailService) {
    this.emailService = emailService;
  }

  async sendWelcomeEmail(candidateName: string, candidateEmail: string): Promise<EmailResult> {
    return this.emailService.sendEmail(candidateEmail, 'welcome', {
      candidateName,
    });
  }

  async sendInterviewInvitation(
    candidateName: string,
    candidateEmail: string,
    interviewDetails: {
      positionTitle: string;
      interviewDate: string;
      interviewTime: string;
      duration: number;
      format: string;
      meetingLink?: string;
      location?: string;
    }
  ): Promise<EmailResult> {
    return this.emailService.sendEmail(candidateEmail, 'interview_invite', {
      candidateName,
      ...interviewDetails,
    });
  }

  async sendFollowUpEmail(
    candidateName: string,
    candidateEmail: string,
    positionTitle: string,
    updateMessage: string,
    nextSteps?: string
  ): Promise<EmailResult> {
    return this.emailService.sendEmail(candidateEmail, 'follow_up', {
      candidateName,
      positionTitle,
      updateMessage,
      nextSteps,
    });
  }

  async sendRejectionEmail(
    candidateName: string,
    candidateEmail: string,
    positionTitle: string,
    positiveNote: string
  ): Promise<EmailResult> {
    return this.emailService.sendEmail(candidateEmail, 'rejection', {
      candidateName,
      positionTitle,
      positiveNote,
    });
  }

  async sendBulkStageUpdateEmails(
    candidates: Array<{
      email: string;
      name: string;
      stage: string;
    }>,
    templateId: string
  ): Promise<BulkEmailResult> {
    const recipients = candidates.map(candidate => ({
      email: candidate.email,
      variables: {
        candidateName: candidate.name,
        stage: candidate.stage,
      },
    }));

    return this.emailService.sendBulkEmail(recipients, templateId);
  }
}

// Global email service instance
export const emailService = new MailjetEmailService();
export const emailAutomation = new EmailAutomationService(emailService);
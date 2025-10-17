import { EmailService, EmailAutomationService } from '../../services/email';
import { mockCandidates } from '../utils/mockData';

// Mock environment variables
process.env.MAILJET_API_KEY = 'test-api-key';
process.env.MAILJET_SECRET_KEY = 'test-secret-key';
process.env.FROM_EMAIL = 'test@example.com';

// Mock node-mailjet
jest.mock('node-mailjet', () => {
  return jest.fn().mockImplementation(() => ({
    post: jest.fn().mockReturnThis(),
    request: jest.fn().mockResolvedValue({
      response: { 
        data: { 
          Messages: [{ MessageID: 'test-message-id' }] 
        } 
      }
    })
  }));
});

describe('EmailService', () => {
  let emailService: EmailService;

  beforeEach(() => {
    jest.clearAllMocks();
    emailService = new EmailService();
  });

  describe('Template Validation', () => {
    it('should validate template with required variables', () => {
      const result = emailService['validateTemplate']('welcome', {
        candidateName: 'John Doe'
      });
      expect(result).toBe(true);
    });

    it('should fail validation for missing required variables', () => {
      const result = emailService['validateTemplate']('welcome', {});
      expect(result).toBe(false);
    });

    it('should return false for non-existent template', () => {
      const result = emailService['validateTemplate']('non-existent', {});
      expect(result).toBe(false);
    });
  });

  describe('Template Interpolation', () => {
    it('should interpolate simple variables', () => {
      const template = 'Hello {{name}}, welcome to {{company}}!';
      const variables = { name: 'John', company: 'ACME Corp' };
      
      const result = emailService['interpolateTemplate'](template, variables);
      expect(result).toBe('Hello John, welcome to ACME Corp!');
    });

    it('should handle missing variables gracefully', () => {
      const template = 'Hello {{name}}, your score is {{score}}';
      const variables = { name: 'John' };
      
      const result = emailService['interpolateTemplate'](template, variables);
      expect(result).toBe('Hello John, your score is ');
    });

    it('should handle conditional sections', () => {
      const template = 'Welcome{{#hasName}}, {{name}}{{/hasName}}!';
      
      const result1 = emailService['interpolateTemplate'](template, { 
        hasName: true, 
        name: 'John' 
      });
      expect(result1).toBe('Welcome, John!');
      
      const result2 = emailService['interpolateTemplate'](template, { 
        hasName: false 
      });
      expect(result2).toBe('Welcome!');
    });
  });

  describe('Email Sending', () => {
    it('should send email successfully', async () => {
      const result = await emailService.sendEmail('test@example.com', 'welcome', {
        candidateName: 'John Doe'
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('test-message-id');
    });

    it('should handle template not found error', async () => {
      const result = await emailService.sendEmail('test@example.com', 'non-existent', {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Template not found');
    });

    it('should handle missing required variables', async () => {
      const result = await emailService.sendEmail('test@example.com', 'welcome', {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing required template variables');
    });

    it('should log email when API keys not configured', async () => {
      // Remove API keys
      const originalApiKey = process.env.MAILJET_API_KEY;
      const originalSecretKey = process.env.MAILJET_SECRET_KEY;
      delete process.env.MAILJET_API_KEY;
      delete process.env.MAILJET_SECRET_KEY;

      // Create new instance without keys
      const serviceWithoutKeys = new EmailService();
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = await serviceWithoutKeys.sendEmail('test@example.com', 'welcome', {
        candidateName: 'John Doe'
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toContain('mock-');
      expect(consoleSpy).toHaveBeenCalledWith(
        'Email would be sent:',
        expect.objectContaining({
          to: 'test@example.com',
          templateId: 'welcome'
        })
      );

      // Restore keys
      process.env.MAILJET_API_KEY = originalApiKey;
      process.env.MAILJET_SECRET_KEY = originalSecretKey;
      consoleSpy.mockRestore();
    });
  });

  describe('Bulk Email Sending', () => {
    it('should send bulk emails successfully', async () => {
      const recipients = [
        { email: 'user1@example.com', variables: { candidateName: 'User 1' } },
        { email: 'user2@example.com', variables: { candidateName: 'User 2' } }
      ];

      const result = await emailService.sendBulkEmail(recipients, 'welcome');

      expect(result.success).toBe(true);
      expect(result.sent).toBe(2);
      expect(result.failed).toBe(0);
    });

    it('should handle partial failures in bulk send', async () => {
      const recipients = [
        { email: 'user1@example.com', variables: { candidateName: 'User 1' } },
        { email: 'user2@example.com', variables: {} }, // Missing required variable
        { email: 'user3@example.com', variables: { candidateName: 'User 3' } }
      ];

      const result = await emailService.sendBulkEmail(recipients, 'welcome');

      expect(result.success).toBe(false);
      expect(result.sent).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
    });

    it('should validate recipients limit', async () => {
      const recipients = Array(101).fill(null).map((_, i) => ({
        email: `user${i}@example.com`,
        variables: { candidateName: `User ${i}` }
      }));

      const result = await emailService.sendBulkEmail(recipients, 'welcome');

      expect(result.success).toBe(false);
      expect(result.error).toContain('100 recipients');
    });
  });

  describe('Campaign Templates', () => {
    it('should get all campaign templates', () => {
      const templates = emailService.getCampaignTemplates();

      expect(templates).toContain('welcome');
      expect(templates).toContain('interview_invite');
      expect(templates).toContain('follow_up');
      expect(templates).toContain('rejection');
    });

    it('should get template preview', () => {
      const preview = emailService.getTemplatePreview('welcome', {
        candidateName: 'John Doe'
      });

      expect(preview.subject).toContain('Welcome');
      expect(preview.html).toContain('John Doe');
      expect(preview.text).toContain('John Doe');
    });

    it('should return null for non-existent template preview', () => {
      const preview = emailService.getTemplatePreview('non-existent', {});
      expect(preview).toBeNull();
    });
  });
});

describe('EmailAutomationService', () => {
  let emailService: EmailService;
  let automationService: EmailAutomationService;

  beforeEach(() => {
    jest.clearAllMocks();
    emailService = new EmailService();
    automationService = new EmailAutomationService(emailService);
    
    // Mock email service methods
    emailService.sendEmail = jest.fn().mockResolvedValue({
      success: true,
      messageId: 'test-message-id'
    });
    emailService.sendBulkEmail = jest.fn().mockResolvedValue({
      success: true,
      sent: 2,
      failed: 0
    });
  });

  describe('Automated Email Workflows', () => {
    it('should send welcome email', async () => {
      const result = await automationService.sendWelcomeEmail(
        'John Doe',
        'john@example.com'
      );

      expect(result.success).toBe(true);
      expect(emailService.sendEmail).toHaveBeenCalledWith(
        'john@example.com',
        'welcome',
        { candidateName: 'John Doe' }
      );
    });

    it('should send interview invitation', async () => {
      const interviewDetails = {
        positionTitle: 'Senior Developer',
        interviewDate: '2024-02-01',
        interviewTime: '10:00 AM',
        duration: 60,
        format: 'video',
        meetingLink: 'https://meet.example.com/interview'
      };

      const result = await automationService.sendInterviewInvitation(
        'Jane Smith',
        'jane@example.com',
        interviewDetails
      );

      expect(result.success).toBe(true);
      expect(emailService.sendEmail).toHaveBeenCalledWith(
        'jane@example.com',
        'interview_invite',
        expect.objectContaining({
          candidateName: 'Jane Smith',
          positionTitle: 'Senior Developer',
          interviewDate: '2024-02-01'
        })
      );
    });

    it('should send follow-up email', async () => {
      const result = await automationService.sendFollowUpEmail(
        'Bob Wilson',
        'bob@example.com',
        'Product Manager',
        'Thank you for your time in our interview.',
        'We will contact you within 3 business days.'
      );

      expect(result.success).toBe(true);
      expect(emailService.sendEmail).toHaveBeenCalledWith(
        'bob@example.com',
        'follow_up',
        expect.objectContaining({
          candidateName: 'Bob Wilson',
          positionTitle: 'Product Manager'
        })
      );
    });

    it('should send rejection email', async () => {
      const result = await automationService.sendRejectionEmail(
        'Alice Johnson',
        'alice@example.com',
        'Marketing Coordinator',
        'We were impressed by your skills and experience'
      );

      expect(result.success).toBe(true);
      expect(emailService.sendEmail).toHaveBeenCalledWith(
        'alice@example.com',
        'rejection',
        expect.objectContaining({
          candidateName: 'Alice Johnson',
          positionTitle: 'Marketing Coordinator',
          positiveNote: 'We were impressed by your skills and experience'
        })
      );
    });
  });

  describe('Bulk Operations', () => {
    it('should send bulk stage update emails', async () => {
      const candidates = [
        { email: 'john@example.com', name: 'John Doe', stage: 'FIRST_INTERVIEW' },
        { email: 'jane@example.com', name: 'Jane Smith', stage: 'TECHNICAL_SCREEN' }
      ];

      const result = await automationService.sendBulkStageUpdateEmails(
        candidates,
        'stage_update'
      );

      expect(result.success).toBe(true);
      expect(emailService.sendBulkEmail).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            email: 'john@example.com',
            variables: expect.objectContaining({
              candidateName: 'John Doe',
              stage: 'FIRST_INTERVIEW'
            })
          })
        ]),
        'stage_update'
      );
    });

    it('should handle bulk send with custom campaigns', async () => {
      const campaign = {
        id: 'campaign-1',
        name: 'Q1 Recruitment',
        templateId: 'campaign_invite',
        recipients: [
          { email: 'user1@example.com', name: 'User 1' },
          { email: 'user2@example.com', name: 'User 2' }
        ]
      };

      const recipients = campaign.recipients.map(r => ({
        email: r.email,
        variables: { candidateName: r.name }
      }));

      const result = await emailService.sendBulkEmail(
        recipients,
        campaign.templateId
      );

      expect(result.success).toBe(true);
    });
  });

  describe('Scheduled Email Jobs', () => {
    it('should schedule follow-up emails', async () => {
      const candidates = [
        {
          id: 'cand-1',
          name: 'John Doe',
          email: 'john@example.com',
          pipelineStage: 'FIRST_INTERVIEW' as const,
          lastInterviewDate: new Date('2024-01-01')
        }
      ];

      // Simulate checking for candidates needing follow-up
      const needsFollowUp = candidates.filter(c => {
        const daysSinceInterview = Math.floor(
          (Date.now() - c.lastInterviewDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        return daysSinceInterview >= 3 && c.pipelineStage === 'FIRST_INTERVIEW';
      });

      for (const candidate of needsFollowUp) {
        await automationService.sendFollowUpEmail(
          candidate.name,
          candidate.email,
          'Software Engineer',
          'We are still reviewing candidates',
          'We will update you soon'
        );
      }

      expect(emailService.sendEmail).toHaveBeenCalledTimes(needsFollowUp.length);
    });
  });
});
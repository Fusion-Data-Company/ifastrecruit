import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { workflowEngine } from "../services/workflow-engine";
import { isAuthenticated, isAdmin } from "../replitAuth";
import { 
  insertWorkflowSchema,
  insertWorkflowTemplateSchema,
  insertWorkflowScheduleSchema
} from "@shared/schema";

// Validation schemas
const createWorkflowSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  triggerType: z.enum(['message', 'schedule', 'event', 'webhook', 'manual', 'form_submission']),
  triggerConfig: z.record(z.any()),
  actions: z.array(z.object({
    type: z.string(),
    config: z.record(z.any())
  })),
  status: z.enum(['active', 'inactive', 'draft', 'archived']).optional(),
  variables: z.record(z.any()).optional()
});

const updateWorkflowSchema = createWorkflowSchema.partial();

const runWorkflowSchema = z.object({
  triggerData: z.record(z.any()).optional()
});

const createScheduleSchema = z.object({
  workflowId: z.string(),
  scheduleType: z.enum(['once', 'recurring', 'interval']),
  cronExpression: z.string().optional(),
  intervalSeconds: z.number().optional(),
  nextRunAt: z.string(), // ISO date string
  timezone: z.string().optional()
});

export function registerWorkflowRoutes(app: Express) {
  // Initialize workflow engine scheduler
  workflowEngine.startScheduler();

  // Get all workflows
  app.get('/api/workflows', isAuthenticated, async (req: any, res) => {
    try {
      const filters: any = {};
      
      // Non-admin users can only see their own workflows
      if (!req.user?.isAdmin) {
        filters.createdBy = req.user?.claims?.sub;
      }
      
      if (req.query.status) {
        filters.status = req.query.status;
      }
      
      if (req.query.workspaceId) {
        filters.workspaceId = req.query.workspaceId;
      }

      const workflows = await storage.getWorkflows(filters);
      res.json(workflows);
    } catch (error: any) {
      console.error('Error fetching workflows:', error);
      res.status(500).json({ error: 'Failed to fetch workflows' });
    }
  });

  // Get single workflow
  app.get('/api/workflows/:id', isAuthenticated, async (req: any, res) => {
    try {
      const workflow = await storage.getWorkflow(req.params.id);
      
      if (!workflow) {
        return res.status(404).json({ error: 'Workflow not found' });
      }

      // Check permissions
      if (!req.user?.isAdmin && workflow.createdBy !== req.user?.claims?.sub) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      res.json(workflow);
    } catch (error: any) {
      console.error('Error fetching workflow:', error);
      res.status(500).json({ error: 'Failed to fetch workflow' });
    }
  });

  // Create workflow
  app.post('/api/workflows', isAuthenticated, async (req: any, res) => {
    try {
      const data = createWorkflowSchema.parse(req.body);
      
      const workflow = await storage.createWorkflow({
        ...data,
        createdBy: req.user.claims.sub,
        workspaceId: req.body.workspaceId || req.user.claims.sub,
        status: data.status || 'draft',
        version: 1
      });

      res.json(workflow);
    } catch (error: any) {
      console.error('Error creating workflow:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid workflow data', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to create workflow' });
    }
  });

  // Update workflow
  app.put('/api/workflows/:id', isAuthenticated, async (req: any, res) => {
    try {
      const workflow = await storage.getWorkflow(req.params.id);
      
      if (!workflow) {
        return res.status(404).json({ error: 'Workflow not found' });
      }

      // Check permissions
      if (!req.user?.isAdmin && workflow.createdBy !== req.user?.claims?.sub) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const data = updateWorkflowSchema.parse(req.body);
      
      // If workflow structure is changing, increment version
      let updates = { ...data };
      if (data.actions || data.triggerConfig) {
        updates.version = workflow.version + 1;
      }

      const updated = await storage.updateWorkflow(req.params.id, updates);
      res.json(updated);
    } catch (error: any) {
      console.error('Error updating workflow:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid workflow data', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to update workflow' });
    }
  });

  // Delete workflow
  app.delete('/api/workflows/:id', isAuthenticated, async (req: any, res) => {
    try {
      const workflow = await storage.getWorkflow(req.params.id);
      
      if (!workflow) {
        return res.status(404).json({ error: 'Workflow not found' });
      }

      // Check permissions (only creator or admin can delete)
      if (!req.user?.isAdmin && workflow.createdBy !== req.user?.claims?.sub) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      await storage.deleteWorkflow(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting workflow:', error);
      res.status(500).json({ error: 'Failed to delete workflow' });
    }
  });

  // Manually run workflow
  app.post('/api/workflows/:id/run', isAuthenticated, async (req: any, res) => {
    try {
      const workflow = await storage.getWorkflow(req.params.id);
      
      if (!workflow) {
        return res.status(404).json({ error: 'Workflow not found' });
      }

      // Check permissions
      if (!req.user?.isAdmin && workflow.createdBy !== req.user?.claims?.sub) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      if (workflow.status !== 'active') {
        return res.status(400).json({ error: 'Workflow is not active' });
      }

      const { triggerData } = runWorkflowSchema.parse(req.body);

      // Execute workflow asynchronously
      const run = await workflowEngine.executeWorkflow(
        workflow,
        req.user.claims.sub,
        triggerData || { source: 'manual' }
      );

      res.json(run);
    } catch (error: any) {
      console.error('Error running workflow:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid trigger data', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to run workflow' });
    }
  });

  // Get workflow execution history
  app.get('/api/workflows/:id/runs', isAuthenticated, async (req: any, res) => {
    try {
      const workflow = await storage.getWorkflow(req.params.id);
      
      if (!workflow) {
        return res.status(404).json({ error: 'Workflow not found' });
      }

      // Check permissions
      if (!req.user?.isAdmin && workflow.createdBy !== req.user?.claims?.sub) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const limit = parseInt(req.query.limit) || 50;
      const runs = await storage.getWorkflowRuns(req.params.id, limit);
      
      res.json(runs);
    } catch (error: any) {
      console.error('Error fetching workflow runs:', error);
      res.status(500).json({ error: 'Failed to fetch workflow runs' });
    }
  });

  // Get workflow run details
  app.get('/api/workflows/runs/:runId', isAuthenticated, async (req: any, res) => {
    try {
      const run = await storage.getWorkflowRun(req.params.runId);
      
      if (!run) {
        return res.status(404).json({ error: 'Workflow run not found' });
      }

      // Get workflow to check permissions
      const workflow = await storage.getWorkflow(run.workflowId);
      
      if (!workflow) {
        return res.status(404).json({ error: 'Workflow not found' });
      }

      // Check permissions
      if (!req.user?.isAdmin && workflow.createdBy !== req.user?.claims?.sub) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      res.json(run);
    } catch (error: any) {
      console.error('Error fetching workflow run:', error);
      res.status(500).json({ error: 'Failed to fetch workflow run' });
    }
  });

  // Get workflow templates
  app.get('/api/workflows/templates', isAuthenticated, async (req: any, res) => {
    try {
      const category = req.query.category as string;
      const templates = await storage.getWorkflowTemplates(category);
      
      res.json(templates);
    } catch (error: any) {
      console.error('Error fetching workflow templates:', error);
      res.status(500).json({ error: 'Failed to fetch workflow templates' });
    }
  });

  // Create workflow from template
  app.post('/api/workflows/from-template/:templateId', isAuthenticated, async (req: any, res) => {
    try {
      const template = await storage.getWorkflowTemplate(req.params.templateId);
      
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      // Update template usage count
      await storage.updateWorkflowTemplate(template.id, {
        usageCount: (template.usageCount || 0) + 1
      });

      // Create workflow from template
      const workflow = await storage.createWorkflow({
        name: req.body.name || template.name,
        description: req.body.description || template.description,
        triggerType: template.triggerType,
        triggerConfig: { ...template.triggerConfig, ...req.body.triggerConfigOverride },
        actions: template.actions,
        variables: template.variables,
        status: 'draft',
        createdBy: req.user.claims.sub,
        workspaceId: req.body.workspaceId || req.user.claims.sub,
        version: 1,
        metadata: { templateId: template.id }
      });

      res.json(workflow);
    } catch (error: any) {
      console.error('Error creating workflow from template:', error);
      res.status(500).json({ error: 'Failed to create workflow from template' });
    }
  });

  // Create workflow schedule
  app.post('/api/workflows/:id/schedule', isAuthenticated, async (req: any, res) => {
    try {
      const workflow = await storage.getWorkflow(req.params.id);
      
      if (!workflow) {
        return res.status(404).json({ error: 'Workflow not found' });
      }

      // Check permissions
      if (!req.user?.isAdmin && workflow.createdBy !== req.user?.claims?.sub) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const data = createScheduleSchema.parse(req.body);
      
      const schedule = await storage.createWorkflowSchedule({
        ...data,
        workflowId: req.params.id,
        nextRunAt: new Date(data.nextRunAt),
        isActive: true
      });

      res.json(schedule);
    } catch (error: any) {
      console.error('Error creating workflow schedule:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid schedule data', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to create workflow schedule' });
    }
  });

  // Get workflow schedules
  app.get('/api/workflows/:id/schedules', isAuthenticated, async (req: any, res) => {
    try {
      const workflow = await storage.getWorkflow(req.params.id);
      
      if (!workflow) {
        return res.status(404).json({ error: 'Workflow not found' });
      }

      // Check permissions
      if (!req.user?.isAdmin && workflow.createdBy !== req.user?.claims?.sub) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const schedules = await storage.getWorkflowSchedules(req.params.id);
      res.json(schedules);
    } catch (error: any) {
      console.error('Error fetching workflow schedules:', error);
      res.status(500).json({ error: 'Failed to fetch workflow schedules' });
    }
  });

  // Update workflow schedule
  app.put('/api/workflows/schedules/:scheduleId', isAuthenticated, async (req: any, res) => {
    try {
      const schedule = await storage.getWorkflowSchedule(req.params.scheduleId);
      
      if (!schedule) {
        return res.status(404).json({ error: 'Schedule not found' });
      }

      // Get workflow to check permissions
      const workflow = await storage.getWorkflow(schedule.workflowId);
      
      if (!workflow) {
        return res.status(404).json({ error: 'Workflow not found' });
      }

      // Check permissions
      if (!req.user?.isAdmin && workflow.createdBy !== req.user?.claims?.sub) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const updates = req.body;
      if (updates.nextRunAt) {
        updates.nextRunAt = new Date(updates.nextRunAt);
      }

      const updated = await storage.updateWorkflowSchedule(req.params.scheduleId, updates);
      res.json(updated);
    } catch (error: any) {
      console.error('Error updating workflow schedule:', error);
      res.status(500).json({ error: 'Failed to update workflow schedule' });
    }
  });

  // Delete workflow schedule
  app.delete('/api/workflows/schedules/:scheduleId', isAuthenticated, async (req: any, res) => {
    try {
      const schedule = await storage.getWorkflowSchedule(req.params.scheduleId);
      
      if (!schedule) {
        return res.status(404).json({ error: 'Schedule not found' });
      }

      // Get workflow to check permissions
      const workflow = await storage.getWorkflow(schedule.workflowId);
      
      if (!workflow) {
        return res.status(404).json({ error: 'Workflow not found' });
      }

      // Check permissions
      if (!req.user?.isAdmin && workflow.createdBy !== req.user?.claims?.sub) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      await storage.deleteWorkflowSchedule(req.params.scheduleId);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting workflow schedule:', error);
      res.status(500).json({ error: 'Failed to delete workflow schedule' });
    }
  });

  // Webhook endpoint for external triggers
  app.post('/api/workflows/webhook/:webhookId', async (req, res) => {
    try {
      await workflowEngine.handleWebhookTrigger(req.params.webhookId, req.body);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error handling webhook trigger:', error);
      res.status(500).json({ error: 'Failed to handle webhook trigger' });
    }
  });

  // Create workflow template (admin only)
  app.post('/api/workflows/templates', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const template = await storage.createWorkflowTemplate({
        ...req.body,
        createdBy: req.user.claims.sub,
        isPublic: true,
        usageCount: 0
      });

      res.json(template);
    } catch (error: any) {
      console.error('Error creating workflow template:', error);
      res.status(500).json({ error: 'Failed to create workflow template' });
    }
  });

  // Initialize pre-built templates on startup
  initializeWorkflowTemplates();
}

async function initializeWorkflowTemplates() {
  try {
    const existingTemplates = await storage.getWorkflowTemplates();
    
    if (existingTemplates.length === 0) {
      // Create default templates
      const templates = [
        {
          name: 'New Employee Onboarding',
          description: 'Automate the onboarding process for new employees',
          category: 'onboarding',
          icon: 'UserPlus',
          triggerType: 'event' as const,
          triggerConfig: { eventType: 'user_joined' },
          actions: [
            {
              type: 'send_message',
              config: {
                channelId: '{{general}}',
                message: 'Welcome {{trigger.userName}} to the team! 🎉'
              }
            },
            {
              type: 'create_task',
              config: {
                assignTo: '{{trigger.userId}}',
                taskDescription: 'Complete onboarding checklist',
                dueDate: '{{trigger.timestamp + 86400000}}'
              }
            },
            {
              type: 'send_email',
              config: {
                to: '{{trigger.userEmail}}',
                subject: 'Welcome to the Team!',
                body: 'Welcome aboard! Please find attached your onboarding materials.'
              }
            }
          ],
          variables: {},
          tags: ['hr', 'onboarding', 'new-employee'],
          isPublic: true,
          usageCount: 0
        },
        {
          name: 'Daily Standup Reminder',
          description: 'Send daily standup reminder to team channels',
          category: 'notification',
          icon: 'Clock',
          triggerType: 'schedule' as const,
          triggerConfig: { cronExpression: '0 9 * * 1-5' }, // 9 AM Monday-Friday
          actions: [
            {
              type: 'send_message',
              config: {
                channelId: '{{engineering}}',
                message: '@channel Daily standup starting in 15 minutes! Please prepare your updates.'
              }
            },
            {
              type: 'delay',
              config: { seconds: 900 } // 15 minutes
            },
            {
              type: 'send_message',
              config: {
                channelId: '{{engineering}}',
                message: 'Daily standup starting now! Join the call: {{meetingLink}}'
              }
            }
          ],
          variables: { meetingLink: 'https://meet.example.com/standup' },
          tags: ['meeting', 'reminder', 'daily'],
          isPublic: true,
          usageCount: 0
        },
        {
          name: 'Content Approval Process',
          description: 'Route content for approval before publishing',
          category: 'approval',
          icon: 'CheckCircle',
          triggerType: 'form_submission' as const,
          triggerConfig: { formId: 'content-submission' },
          actions: [
            {
              type: 'assign_to_user',
              config: {
                userId: '{{approver}}',
                title: 'Content Approval Required',
                message: 'New content submission: {{trigger.title}}'
              }
            },
            {
              type: 'approval_request',
              config: {
                approverId: '{{approver}}',
                message: 'Please review and approve the content submission'
              }
            },
            {
              type: 'condition',
              config: {
                leftOperand: 'approval_status',
                operator: 'equals',
                rightOperand: 'approved',
                skipActions: 2
              }
            },
            {
              type: 'send_message',
              config: {
                channelId: '{{content}}',
                message: 'Content "{{trigger.title}}" has been approved and published!'
              }
            },
            {
              type: 'api_call',
              config: {
                url: 'https://api.example.com/publish',
                method: 'POST',
                body: { contentId: '{{trigger.contentId}}' }
              }
            }
          ],
          variables: { approver: 'content-manager' },
          tags: ['content', 'approval', 'publishing'],
          isPublic: true,
          usageCount: 0
        },
        {
          name: 'Customer Feedback Collection',
          description: 'Collect and process customer feedback automatically',
          category: 'feedback',
          icon: 'MessageSquare',
          triggerType: 'message' as const,
          triggerConfig: { keyword: 'feedback', channelId: '{{support}}' },
          actions: [
            {
              type: 'create_task',
              config: {
                assignTo: 'support-team',
                taskDescription: 'Review customer feedback from {{trigger.senderId}}',
                dueDate: '{{trigger.timestamp + 172800000}}' // 48 hours
              }
            },
            {
              type: 'send_message',
              config: {
                channelId: '{{trigger.channelId}}',
                message: 'Thank you for your feedback! Our team will review it and get back to you soon.'
              }
            },
            {
              type: 'database_update',
              config: {
                table: 'feedback',
                recordId: '{{newFeedbackId}}',
                updates: {
                  userId: '{{trigger.senderId}}',
                  message: '{{trigger.content}}',
                  status: 'pending'
                }
              }
            }
          ],
          variables: {},
          tags: ['customer', 'feedback', 'support'],
          isPublic: true,
          usageCount: 0
        },
        {
          name: 'Incident Response',
          description: 'Automate incident response and escalation',
          category: 'incident',
          icon: 'AlertTriangle',
          triggerType: 'message' as const,
          triggerConfig: { keyword: 'incident', channelId: '{{ops}}' },
          actions: [
            {
              type: 'send_message',
              config: {
                channelId: '{{incidents}}',
                message: '🚨 New incident reported: {{trigger.content}}'
              }
            },
            {
              type: 'create_task',
              config: {
                assignTo: 'ops-team',
                taskDescription: 'Investigate and resolve incident',
                dueDate: '{{trigger.timestamp + 3600000}}' // 1 hour
              }
            },
            {
              type: 'condition',
              config: {
                leftOperand: 'trigger.content',
                operator: 'contains',
                rightOperand: 'critical',
                skipActions: 1
              }
            },
            {
              type: 'send_email',
              config: {
                to: 'ops-manager@example.com',
                subject: 'CRITICAL INCIDENT ALERT',
                body: 'A critical incident has been reported and requires immediate attention.'
              }
            },
            {
              type: 'api_call',
              config: {
                url: 'https://api.pagerduty.com/incidents',
                method: 'POST',
                headers: { 'Authorization': 'Token {{pagerdutyToken}}' },
                body: {
                  incident: {
                    type: 'incident',
                    title: 'Incident from Slack',
                    urgency: 'high'
                  }
                }
              }
            }
          ],
          variables: { pagerdutyToken: 'YOUR_TOKEN_HERE' },
          tags: ['incident', 'ops', 'emergency'],
          isPublic: true,
          usageCount: 0
        }
      ];

      // Create all templates
      for (const template of templates) {
        await storage.createWorkflowTemplate(template as any);
      }

      console.log('[WorkflowRoutes] Initialized workflow templates');
    }
  } catch (error) {
    console.error('[WorkflowRoutes] Error initializing workflow templates:', error);
  }
}
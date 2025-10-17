import { storage } from "../storage";
import {
  Workflow,
  WorkflowRun,
  InsertWorkflowRun,
  Message,
  Candidate,
  User,
  InsertReminder,
  InsertMessage,
  InsertNotification
} from "@shared/schema";
import { emailAutomation } from "./email";
import { apiManager } from "./external-apis";
import { cacheManager } from "./cache";
import { observabilityService } from "./observability";

interface WorkflowContext {
  workflowId: string;
  workflowVersion: number;
  runId: string;
  triggeredBy?: string;
  triggerData: any;
  variables: Map<string, any>;
  currentActionIndex: number;
  executionLog: Array<{
    actionIndex: number;
    actionType: string;
    timestamp: Date;
    status: 'started' | 'completed' | 'failed';
    result?: any;
    error?: string;
  }>;
}

interface ActionResult {
  success: boolean;
  data?: any;
  error?: string;
  shouldContinue: boolean;
}

export class WorkflowEngine {
  private static instance: WorkflowEngine;
  private runningWorkflows = new Map<string, WorkflowContext>();
  private schedulerInterval: NodeJS.Timer | null = null;

  private constructor() {}

  static getInstance(): WorkflowEngine {
    if (!WorkflowEngine.instance) {
      WorkflowEngine.instance = new WorkflowEngine();
    }
    return WorkflowEngine.instance;
  }

  async startScheduler(): Promise<void> {
    if (this.schedulerInterval) {
      return;
    }

    // Check for scheduled workflows every minute
    this.schedulerInterval = setInterval(async () => {
      await this.checkScheduledWorkflows();
    }, 60000);

    // Initial check
    await this.checkScheduledWorkflows();
    console.log("[WorkflowEngine] Scheduler started");
  }

  stopScheduler(): void {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
      console.log("[WorkflowEngine] Scheduler stopped");
    }
  }

  private async checkScheduledWorkflows(): Promise<void> {
    try {
      const schedules = await storage.getActiveSchedules();
      
      for (const schedule of schedules) {
        const workflow = await storage.getWorkflow(schedule.workflowId);
        if (!workflow || workflow.status !== 'active') {
          continue;
        }

        // Trigger the workflow
        await this.executeWorkflow(workflow, null, {
          source: 'schedule',
          scheduleId: schedule.id
        });

        // Update schedule for next run
        const nextRunAt = this.calculateNextRun(schedule);
        await storage.updateWorkflowSchedule(schedule.id, {
          lastRunAt: new Date(),
          nextRunAt
        });
      }
    } catch (error) {
      console.error("[WorkflowEngine] Error checking scheduled workflows:", error);
    }
  }

  private calculateNextRun(schedule: any): Date {
    const now = new Date();
    
    switch (schedule.scheduleType) {
      case 'once':
        // Deactivate after one run
        storage.updateWorkflowSchedule(schedule.id, { isActive: false });
        return now;
        
      case 'interval':
        return new Date(now.getTime() + (schedule.intervalSeconds * 1000));
        
      case 'recurring':
        // Parse cron expression and calculate next run
        // For now, default to 24 hours
        return new Date(now.getTime() + 86400000);
        
      default:
        return new Date(now.getTime() + 86400000);
    }
  }

  async executeWorkflow(
    workflow: Workflow,
    triggeredBy: string | null,
    triggerData: any
  ): Promise<WorkflowRun> {
    // Create workflow run record
    const run = await storage.createWorkflowRun({
      workflowId: workflow.id,
      workflowVersion: workflow.version,
      status: 'running',
      triggeredBy: triggeredBy || undefined,
      triggerData,
      startedAt: new Date()
    });

    // Initialize context
    const context: WorkflowContext = {
      workflowId: workflow.id,
      workflowVersion: workflow.version,
      runId: run.id,
      triggeredBy: triggeredBy || undefined,
      triggerData,
      variables: new Map(Object.entries(workflow.variables || {})),
      currentActionIndex: 0,
      executionLog: []
    };

    // Store trigger data as variables
    if (triggerData) {
      Object.entries(triggerData).forEach(([key, value]) => {
        context.variables.set(`trigger.${key}`, value);
      });
    }

    this.runningWorkflows.set(run.id, context);

    try {
      // Execute actions sequentially
      const actions = workflow.actions as any[];
      for (let i = 0; i < actions.length; i++) {
        context.currentActionIndex = i;
        const action = actions[i];

        const result = await this.executeAction(action, context);
        
        if (!result.shouldContinue) {
          break;
        }
      }

      // Mark run as completed
      const updatedRun = await storage.updateWorkflowRun(run.id, {
        status: 'completed',
        completedAt: new Date(),
        context: {
          variables: Object.fromEntries(context.variables),
          executionLog: context.executionLog
        }
      });

      this.runningWorkflows.delete(run.id);
      return updatedRun;

    } catch (error: any) {
      // Mark run as failed
      const updatedRun = await storage.updateWorkflowRun(run.id, {
        status: 'failed',
        completedAt: new Date(),
        errorMessage: error.message,
        context: {
          variables: Object.fromEntries(context.variables),
          executionLog: context.executionLog
        }
      });

      this.runningWorkflows.delete(run.id);
      throw error;
    }
  }

  private async executeAction(
    action: any,
    context: WorkflowContext
  ): Promise<ActionResult> {
    const startTime = new Date();
    
    // Log action start
    context.executionLog.push({
      actionIndex: context.currentActionIndex,
      actionType: action.type,
      timestamp: startTime,
      status: 'started'
    });

    try {
      let result: ActionResult;

      // Replace variables in action config
      const resolvedConfig = this.resolveVariables(action.config, context);

      switch (action.type) {
        case 'send_message':
          result = await this.executeSendMessage(resolvedConfig, context);
          break;
          
        case 'create_task':
          result = await this.executeCreateTask(resolvedConfig, context);
          break;
          
        case 'api_call':
          result = await this.executeApiCall(resolvedConfig, context);
          break;
          
        case 'database_update':
          result = await this.executeDatabaseUpdate(resolvedConfig, context);
          break;
          
        case 'send_email':
          result = await this.executeSendEmail(resolvedConfig, context);
          break;
          
        case 'condition':
          result = await this.executeCondition(resolvedConfig, context);
          break;
          
        case 'delay':
          result = await this.executeDelay(resolvedConfig, context);
          break;
          
        case 'approval_request':
          result = await this.executeApprovalRequest(resolvedConfig, context);
          break;
          
        case 'assign_to_user':
          result = await this.executeAssignToUser(resolvedConfig, context);
          break;
          
        case 'update_candidate':
          result = await this.executeUpdateCandidate(resolvedConfig, context);
          break;
          
        default:
          result = {
            success: false,
            error: `Unknown action type: ${action.type}`,
            shouldContinue: false
          };
      }

      // Log action completion
      context.executionLog.push({
        actionIndex: context.currentActionIndex,
        actionType: action.type,
        timestamp: new Date(),
        status: result.success ? 'completed' : 'failed',
        result: result.data,
        error: result.error
      });

      // Store result in variables for next actions
      if (result.data) {
        context.variables.set(`action${context.currentActionIndex}.result`, result.data);
      }

      return result;

    } catch (error: any) {
      // Log action failure
      context.executionLog.push({
        actionIndex: context.currentActionIndex,
        actionType: action.type,
        timestamp: new Date(),
        status: 'failed',
        error: error.message
      });

      throw error;
    }
  }

  private resolveVariables(config: any, context: WorkflowContext): any {
    if (typeof config === 'string') {
      // Replace variable references like {{variableName}}
      return config.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
        return context.variables.get(varName.trim()) || match;
      });
    }

    if (Array.isArray(config)) {
      return config.map(item => this.resolveVariables(item, context));
    }

    if (typeof config === 'object' && config !== null) {
      const resolved: any = {};
      for (const [key, value] of Object.entries(config)) {
        resolved[key] = this.resolveVariables(value, context);
      }
      return resolved;
    }

    return config;
  }

  // Action Implementations

  private async executeSendMessage(config: any, context: WorkflowContext): Promise<ActionResult> {
    try {
      const message: InsertMessage = {
        channelId: config.channelId,
        senderId: context.triggeredBy || 'system',
        content: config.message,
        metadata: {
          workflowRunId: context.runId
        }
      };

      const created = await storage.createMessage(message);

      return {
        success: true,
        data: { messageId: created.id },
        shouldContinue: true
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        shouldContinue: false
      };
    }
  }

  private async executeCreateTask(config: any, context: WorkflowContext): Promise<ActionResult> {
    try {
      const reminder: InsertReminder = {
        userId: config.assignTo || context.triggeredBy || 'system',
        targetUserId: config.targetUserId,
        channelId: config.channelId,
        message: config.taskDescription,
        remindAt: new Date(config.dueDate || Date.now() + 86400000), // Default 24h
        isRecurring: config.isRecurring || false,
        recurringPattern: config.recurringPattern
      };

      const created = await storage.createReminder(reminder);

      return {
        success: true,
        data: { reminderId: created.id },
        shouldContinue: true
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        shouldContinue: false
      };
    }
  }

  private async executeApiCall(config: any, context: WorkflowContext): Promise<ActionResult> {
    try {
      const response = await apiManager.makeRequest(
        config.url,
        config.method || 'GET',
        config.headers || {},
        config.body
      );

      return {
        success: true,
        data: response,
        shouldContinue: true
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        shouldContinue: config.continueOnError || false
      };
    }
  }

  private async executeDatabaseUpdate(config: any, context: WorkflowContext): Promise<ActionResult> {
    try {
      let result;

      switch (config.table) {
        case 'candidates':
          result = await storage.updateCandidate(config.recordId, config.updates);
          break;
        case 'users':
          result = await storage.updateUser(config.recordId, config.updates);
          break;
        default:
          throw new Error(`Unsupported table: ${config.table}`);
      }

      return {
        success: true,
        data: result,
        shouldContinue: true
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        shouldContinue: false
      };
    }
  }

  private async executeSendEmail(config: any, context: WorkflowContext): Promise<ActionResult> {
    try {
      await emailAutomation.sendEmail(
        config.to,
        config.subject,
        config.body,
        config.htmlBody
      );

      return {
        success: true,
        shouldContinue: true
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        shouldContinue: config.continueOnError || false
      };
    }
  }

  private async executeCondition(config: any, context: WorkflowContext): Promise<ActionResult> {
    try {
      const left = context.variables.get(config.leftOperand) || config.leftOperand;
      const right = context.variables.get(config.rightOperand) || config.rightOperand;
      
      let conditionMet = false;

      switch (config.operator) {
        case 'equals':
          conditionMet = left === right;
          break;
        case 'not_equals':
          conditionMet = left !== right;
          break;
        case 'contains':
          conditionMet = String(left).includes(String(right));
          break;
        case 'greater_than':
          conditionMet = Number(left) > Number(right);
          break;
        case 'less_than':
          conditionMet = Number(left) < Number(right);
          break;
        case 'is_empty':
          conditionMet = !left || left === '';
          break;
        case 'is_not_empty':
          conditionMet = !!left && left !== '';
          break;
        default:
          throw new Error(`Unknown operator: ${config.operator}`);
      }

      // Store condition result
      context.variables.set(`condition${context.currentActionIndex}`, conditionMet);

      // Skip actions if condition not met
      if (!conditionMet && config.skipActions) {
        context.currentActionIndex += config.skipActions;
      }

      return {
        success: true,
        data: { conditionMet },
        shouldContinue: true
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        shouldContinue: false
      };
    }
  }

  private async executeDelay(config: any, context: WorkflowContext): Promise<ActionResult> {
    try {
      const delayMs = config.seconds * 1000;
      await new Promise(resolve => setTimeout(resolve, delayMs));

      return {
        success: true,
        shouldContinue: true
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        shouldContinue: false
      };
    }
  }

  private async executeApprovalRequest(config: any, context: WorkflowContext): Promise<ActionResult> {
    try {
      // Create a notification for approval
      const notification: InsertNotification = {
        userId: config.approverId,
        type: 'message',
        title: 'Workflow Approval Required',
        message: config.message || 'Please approve this workflow step',
        metadata: {
          workflowRunId: context.runId,
          requiresApproval: true,
          approvalConfig: config
        }
      };

      const created = await storage.createNotification(notification);

      // For now, we'll pause the workflow here
      // In a real implementation, we'd need to handle approval callbacks
      await storage.updateWorkflowRun(context.runId, {
        status: 'paused',
        context: {
          waitingForApproval: true,
          approvalNotificationId: created.id
        }
      });

      return {
        success: true,
        data: { notificationId: created.id },
        shouldContinue: false // Stop execution until approved
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        shouldContinue: false
      };
    }
  }

  private async executeAssignToUser(config: any, context: WorkflowContext): Promise<ActionResult> {
    try {
      // Implementation depends on what we're assigning
      // For now, create a notification
      const notification: InsertNotification = {
        userId: config.userId,
        type: 'message',
        title: config.title || 'New Assignment',
        message: config.message,
        metadata: {
          workflowRunId: context.runId,
          assignmentType: config.assignmentType,
          assignmentData: config.assignmentData
        }
      };

      const created = await storage.createNotification(notification);

      return {
        success: true,
        data: { notificationId: created.id },
        shouldContinue: true
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        shouldContinue: false
      };
    }
  }

  private async executeUpdateCandidate(config: any, context: WorkflowContext): Promise<ActionResult> {
    try {
      const updated = await storage.updateCandidate(config.candidateId, config.updates);

      return {
        success: true,
        data: updated,
        shouldContinue: true
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        shouldContinue: false
      };
    }
  }

  // Trigger handlers

  async handleMessageTrigger(message: Message): Promise<void> {
    try {
      // Get all active workflows with message triggers
      const workflows = await storage.getWorkflows({ status: 'active' });
      
      for (const workflow of workflows) {
        if (workflow.triggerType !== 'message') continue;

        const triggerConfig = workflow.triggerConfig as any;
        
        // Check if message matches trigger conditions
        let shouldTrigger = false;

        if (triggerConfig.keyword && message.content.toLowerCase().includes(triggerConfig.keyword.toLowerCase())) {
          shouldTrigger = true;
        }

        if (triggerConfig.channelId && message.channelId !== triggerConfig.channelId) {
          shouldTrigger = false;
        }

        if (triggerConfig.userId && message.senderId !== triggerConfig.userId) {
          shouldTrigger = false;
        }

        if (shouldTrigger) {
          await this.executeWorkflow(workflow, message.senderId, {
            messageId: message.id,
            content: message.content,
            channelId: message.channelId,
            senderId: message.senderId
          });
        }
      }
    } catch (error) {
      console.error("[WorkflowEngine] Error handling message trigger:", error);
    }
  }

  async handleEventTrigger(eventType: string, eventData: any): Promise<void> {
    try {
      // Get all active workflows with event triggers
      const workflows = await storage.getWorkflows({ status: 'active' });
      
      for (const workflow of workflows) {
        if (workflow.triggerType !== 'event') continue;

        const triggerConfig = workflow.triggerConfig as any;
        
        if (triggerConfig.eventType === eventType) {
          await this.executeWorkflow(workflow, eventData.userId || null, eventData);
        }
      }
    } catch (error) {
      console.error("[WorkflowEngine] Error handling event trigger:", error);
    }
  }

  async handleWebhookTrigger(webhookId: string, data: any): Promise<void> {
    try {
      // Get all active workflows with webhook triggers
      const workflows = await storage.getWorkflows({ status: 'active' });
      
      for (const workflow of workflows) {
        if (workflow.triggerType !== 'webhook') continue;

        const triggerConfig = workflow.triggerConfig as any;
        
        if (triggerConfig.webhookId === webhookId) {
          await this.executeWorkflow(workflow, null, data);
        }
      }
    } catch (error) {
      console.error("[WorkflowEngine] Error handling webhook trigger:", error);
    }
  }
}

export const workflowEngine = WorkflowEngine.getInstance();
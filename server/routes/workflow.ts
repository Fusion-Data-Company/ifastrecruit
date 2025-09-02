import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage";

// Workflow rule validation schema
const workflowRuleSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  isActive: z.boolean(),
  priority: z.number().min(1).max(100),
  triggers: z.array(z.object({
    type: z.enum(['candidate_created', 'candidate_updated', 'stage_changed', 'score_updated', 'time_based', 'manual']),
    parameters: z.record(z.any()),
  })),
  conditions: z.array(z.object({
    field: z.string(),
    operator: z.enum(['equals', 'not_equals', 'greater_than', 'less_than', 'contains', 'not_contains', 'in', 'not_in']),
    value: z.any(),
    logic: z.enum(['and', 'or']).optional(),
  })),
  actions: z.array(z.object({
    type: z.enum(['move_stage', 'assign_tag', 'send_email', 'schedule_interview', 'update_score', 'notify_team', 'create_task']),
    parameters: z.record(z.any()),
  })),
});

interface WorkflowRule {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  triggers: any[];
  conditions: any[];
  actions: any[];
  priority: number;
  createdAt: string;
  lastTriggered?: string;
  triggerCount: number;
}

interface WorkflowEngine {
  rules: WorkflowRule[];
  executeRule: (ruleId: string, candidateData?: any) => Promise<any>;
  evaluateConditions: (conditions: any[], candidateData: any) => boolean;
  executeActions: (actions: any[], candidateData: any) => Promise<any[]>;
  processCandidate: (candidateData: any, triggerType: string) => Promise<void>;
}

class AutomationEngine implements WorkflowEngine {
  rules: WorkflowRule[] = [];

  constructor() {
    this.loadRules();
  }

  async loadRules() {
    try {
      this.rules = await storage.getWorkflowRules();
    } catch (error) {
      console.error('Failed to load workflow rules:', error);
      this.rules = [];
    }
  }

  async executeRule(ruleId: string, candidateData?: any): Promise<any> {
    const rule = this.rules.find(r => r.id === ruleId);
    if (!rule || !rule.isActive) {
      return { success: false, message: 'Rule not found or inactive' };
    }

    let processedCount = 0;
    let actionsExecuted = 0;

    try {
      // If no candidate data provided, get all candidates
      const candidates = candidateData ? [candidateData] : await storage.getCandidates();

      for (const candidate of candidates) {
        if (this.evaluateConditions(rule.conditions, candidate)) {
          const actionResults = await this.executeActions(rule.actions, candidate);
          actionsExecuted += actionResults.length;
          processedCount++;
        }
      }

      // Update rule statistics
      await storage.updateWorkflowRule(ruleId, {
        lastTriggered: new Date().toISOString(),
        triggerCount: rule.triggerCount + 1,
      });

      return {
        success: true,
        processedCount,
        actionsExecuted,
        ruleId,
      };
    } catch (error) {
      console.error(`Failed to execute rule ${ruleId}:`, error);
      return { success: false, message: String(error) };
    }
  }

  evaluateConditions(conditions: any[], candidateData: any): boolean {
    if (conditions.length === 0) return true;

    let result = true;
    let currentLogic = 'and';

    for (let i = 0; i < conditions.length; i++) {
      const condition = conditions[i];
      const fieldValue = this.getFieldValue(candidateData, condition.field);
      const conditionResult = this.evaluateCondition(fieldValue, condition.operator, condition.value);

      if (i === 0) {
        result = conditionResult;
      } else {
        if (currentLogic === 'and') {
          result = result && conditionResult;
        } else {
          result = result || conditionResult;
        }
      }

      // Set logic for next iteration
      if (condition.logic) {
        currentLogic = condition.logic;
      }
    }

    return result;
  }

  private getFieldValue(candidateData: any, field: string): any {
    switch (field) {
      case 'timeInStage':
        // Calculate time in current stage (in hours)
        const now = new Date();
        const createdAt = new Date(candidateData.createdAt);
        return Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60));
      case 'email':
        // Extract domain from email for domain-based conditions
        return candidateData.email?.split('@')[1] || '';
      default:
        return candidateData[field];
    }
  }

  private evaluateCondition(fieldValue: any, operator: string, expectedValue: any): boolean {
    switch (operator) {
      case 'equals':
        return fieldValue === expectedValue;
      case 'not_equals':
        return fieldValue !== expectedValue;
      case 'greater_than':
        return Number(fieldValue) > Number(expectedValue);
      case 'less_than':
        return Number(fieldValue) < Number(expectedValue);
      case 'contains':
        return String(fieldValue).toLowerCase().includes(String(expectedValue).toLowerCase());
      case 'not_contains':
        return !String(fieldValue).toLowerCase().includes(String(expectedValue).toLowerCase());
      case 'in':
        const inList = Array.isArray(expectedValue) ? expectedValue : [expectedValue];
        return inList.includes(fieldValue);
      case 'not_in':
        const notInList = Array.isArray(expectedValue) ? expectedValue : [expectedValue];
        return !notInList.includes(fieldValue);
      default:
        return false;
    }
  }

  async executeActions(actions: any[], candidateData: any): Promise<any[]> {
    const results = [];

    for (const action of actions) {
      try {
        const result = await this.executeAction(action, candidateData);
        results.push(result);
      } catch (error) {
        console.error(`Failed to execute action ${action.type}:`, error);
        results.push({ success: false, error: String(error) });
      }
    }

    return results;
  }

  private async executeAction(action: any, candidateData: any): Promise<any> {
    switch (action.type) {
      case 'move_stage':
        await storage.updateCandidate(candidateData.id, {
          pipelineStage: action.parameters.stage,
        });
        return { success: true, action: 'move_stage', stage: action.parameters.stage };

      case 'assign_tag':
        const currentTags = candidateData.tags || [];
        const newTag = action.parameters.tag;
        if (!currentTags.includes(newTag)) {
          await storage.updateCandidate(candidateData.id, {
            tags: [...currentTags, newTag],
          });
        }
        return { success: true, action: 'assign_tag', tag: newTag };

      case 'update_score':
        const newScore = action.parameters.score || candidateData.score + (action.parameters.increment || 0);
        await storage.updateCandidate(candidateData.id, {
          score: Math.max(0, Math.min(100, newScore)),
        });
        return { success: true, action: 'update_score', score: newScore };

      case 'send_email':
        // Integrate with email service (Mailjet)
        const emailResult = await this.sendAutomatedEmail(candidateData, action.parameters.template);
        return { success: true, action: 'send_email', template: action.parameters.template, ...emailResult };

      case 'notify_team':
        // Send notification to team via Slack or internal system
        await this.notifyTeam(candidateData, action.parameters.message);
        return { success: true, action: 'notify_team', message: action.parameters.message };

      case 'schedule_interview':
        // Create interview booking
        const booking = await storage.createBooking({
          candidateId: candidateData.id,
          startTs: new Date(Date.now() + (action.parameters.delayHours || 24) * 60 * 60 * 1000),
          endTs: new Date(Date.now() + (action.parameters.delayHours || 24) * 60 * 60 * 1000 + 60 * 60 * 1000), // 1 hour duration
          location: action.parameters.location || 'Virtual Meeting',
          status: 'PENDING',
        });
        return { success: true, action: 'schedule_interview', bookingId: booking.id };

      case 'create_task':
        // Create a task for the recruiting team
        await storage.createAuditLog({
          actor: 'automation',
          action: 'task_created',
          payloadJson: {
            candidateId: candidateData.id,
            task: action.parameters.description,
            priority: action.parameters.priority || 'medium',
          },
        });
        return { success: true, action: 'create_task', task: action.parameters.description };

      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  private async sendAutomatedEmail(candidateData: any, template: string): Promise<any> {
    // This would integrate with Mailjet API
    console.log(`Sending ${template} email to ${candidateData.email}`);
    return { sent: true, template, recipient: candidateData.email };
  }

  private async notifyTeam(candidateData: any, message: string): Promise<void> {
    // This would integrate with Slack API
    console.log(`Team notification: ${message} for candidate ${candidateData.name}`);
  }

  async processCandidate(candidateData: any, triggerType: string): Promise<void> {
    const applicableRules = this.rules.filter(rule => 
      rule.isActive && 
      rule.triggers.some(trigger => trigger.type === triggerType)
    ).sort((a, b) => b.priority - a.priority); // Higher priority first

    for (const rule of applicableRules) {
      try {
        await this.executeRule(rule.id, candidateData);
      } catch (error) {
        console.error(`Failed to process rule ${rule.id} for candidate ${candidateData.id}:`, error);
      }
    }
  }
}

// Global automation engine instance
const automationEngine = new AutomationEngine();

export function registerWorkflowRoutes(app: Express) {
  // Get all workflow rules
  app.get("/api/workflow-rules", async (req, res) => {
    try {
      const rules = await storage.getWorkflowRules();
      res.json(rules);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch workflow rules" });
    }
  });

  // Create workflow rule
  app.post("/api/workflow-rules", async (req, res) => {
    try {
      const ruleData = workflowRuleSchema.parse(req.body);
      const rule = await storage.createWorkflowRule({
        ...ruleData,
        triggerCount: 0,
        createdAt: new Date().toISOString(),
      });
      
      // Reload rules in automation engine
      await automationEngine.loadRules();
      
      res.json(rule);
    } catch (error) {
      res.status(400).json({ error: "Invalid rule data", details: String(error) });
    }
  });

  // Update workflow rule
  app.patch("/api/workflow-rules/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const rule = await storage.updateWorkflowRule(id, updates);
      
      // Reload rules in automation engine
      await automationEngine.loadRules();
      
      res.json(rule);
    } catch (error) {
      res.status(500).json({ error: "Failed to update workflow rule" });
    }
  });

  // Execute workflow rule manually
  app.post("/api/workflow-rules/:id/execute", async (req, res) => {
    try {
      const { id } = req.params;
      const result = await automationEngine.executeRule(id);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to execute workflow rule" });
    }
  });

  // Delete workflow rule
  app.delete("/api/workflow-rules/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteWorkflowRule(id);
      
      // Reload rules in automation engine
      await automationEngine.loadRules();
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete workflow rule" });
    }
  });

  // Process candidate through automation (called by other parts of the system)
  app.post("/api/automation/process-candidate", async (req, res) => {
    try {
      const { candidateData, triggerType } = req.body;
      await automationEngine.processCandidate(candidateData, triggerType);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to process candidate automation" });
    }
  });
}

// Export automation engine for use in other parts of the application
export { automationEngine };
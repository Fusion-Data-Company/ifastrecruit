import { WorkflowEngine } from '../../services/workflow-engine';
import { storage } from '../../storage';
import { MockService, TestFactory } from '../utils/testHelpers';
import { mockWorkflows, mockCandidates, mockUsers } from '../utils/mockData';

// Mock dependencies
jest.mock('../../storage');
jest.mock('../../integrations/slack');
jest.mock('../../services/email');

describe('WorkflowEngine', () => {
  let engine: WorkflowEngine;
  let mockStorage: any;

  beforeEach(() => {
    jest.clearAllMocks();
    engine = WorkflowEngine.getInstance();
    mockStorage = storage as jest.Mocked<typeof storage>;
    
    // Setup default mocks
    mockStorage.getWorkflows = jest.fn().mockResolvedValue([]);
    mockStorage.getActiveSchedules = jest.fn().mockResolvedValue([]);
    mockStorage.createWorkflowRun = jest.fn().mockResolvedValue({
      id: 'run-1',
      workflowId: 'workflow-1',
      status: 'running'
    });
    mockStorage.updateWorkflowRun = jest.fn().mockResolvedValue({
      id: 'run-1',
      status: 'completed'
    });
  });

  afterEach(() => {
    engine.stopScheduler();
  });

  describe('Workflow Execution', () => {
    it('should execute a simple workflow successfully', async () => {
      const workflow = TestFactory.createWorkflow({
        actions: [
          {
            type: 'send_message',
            config: {
              channelId: 'test-channel',
              message: 'Test message'
            }
          }
        ]
      });

      mockStorage.createMessage = jest.fn().mockResolvedValue({ id: 'msg-1' });

      const result = await engine.executeWorkflow(workflow, 'user-1');

      expect(mockStorage.createWorkflowRun).toHaveBeenCalledWith(
        expect.objectContaining({
          workflowId: workflow.id,
          triggeredBy: 'user-1',
          status: 'running'
        })
      );
      expect(mockStorage.updateWorkflowRun).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          status: 'completed'
        })
      );
      expect(result.status).toBe('completed');
    });

    it('should handle conditional actions correctly', async () => {
      const workflow = TestFactory.createWorkflow({
        variables: {
          score: 85
        },
        actions: [
          {
            type: 'condition',
            config: {
              condition: 'score > 80',
              trueActions: [
                {
                  type: 'send_email',
                  config: {
                    templateId: 'high_score',
                    to: 'test@example.com'
                  }
                }
              ],
              falseActions: [
                {
                  type: 'send_email',
                  config: {
                    templateId: 'low_score',
                    to: 'test@example.com'
                  }
                }
              ]
            }
          }
        ]
      });

      const emailService = require('../../services/email').emailService;
      emailService.sendEmail = jest.fn().mockResolvedValue({ success: true });

      await engine.executeWorkflow(workflow, 'user-1');

      expect(emailService.sendEmail).toHaveBeenCalledWith(
        'test@example.com',
        'high_score',
        expect.any(Object)
      );
    });

    it('should handle workflow failures gracefully', async () => {
      const workflow = TestFactory.createWorkflow({
        actions: [
          {
            type: 'api_call',
            config: {
              url: 'https://invalid-url-that-will-fail.com',
              method: 'GET'
            }
          }
        ]
      });

      // Mock fetch to fail
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      await expect(engine.executeWorkflow(workflow, 'user-1')).rejects.toThrow();

      expect(mockStorage.updateWorkflowRun).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          status: 'failed',
          errorMessage: expect.stringContaining('error')
        })
      );
    });

    it('should handle delay actions', async () => {
      jest.useFakeTimers();

      const workflow = TestFactory.createWorkflow({
        actions: [
          {
            type: 'delay',
            config: { seconds: 5 }
          },
          {
            type: 'send_message',
            config: {
              channelId: 'test-channel',
              message: 'Delayed message'
            }
          }
        ]
      });

      mockStorage.createMessage = jest.fn().mockResolvedValue({ id: 'msg-1' });

      const promise = engine.executeWorkflow(workflow, 'user-1');
      
      // Fast-forward time
      jest.advanceTimersByTime(5000);
      
      await promise;

      expect(mockStorage.createMessage).toHaveBeenCalled();
      
      jest.useRealTimers();
    });
  });

  describe('Trigger Handling', () => {
    it('should trigger workflow on message event', async () => {
      const workflow = TestFactory.createWorkflow({
        triggerType: 'event',
        triggerConfig: {
          event: 'message_received',
          conditions: {
            channelId: 'channel-1'
          }
        },
        actions: [
          {
            type: 'send_message',
            config: {
              channelId: 'channel-2',
              message: 'Auto-reply'
            }
          }
        ]
      });

      mockStorage.getWorkflows = jest.fn().mockResolvedValue([workflow]);
      mockStorage.createMessage = jest.fn().mockResolvedValue({ id: 'msg-1' });

      await engine.loadWorkflows();
      await engine.handleTrigger('message_received', {
        channelId: 'channel-1',
        message: 'Test message'
      });

      expect(mockStorage.createMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channelId: 'channel-2',
          content: 'Auto-reply'
        })
      );
    });

    it('should not trigger workflow when conditions do not match', async () => {
      const workflow = TestFactory.createWorkflow({
        triggerType: 'event',
        triggerConfig: {
          event: 'candidate_created',
          conditions: {
            score: { $gt: 90 }
          }
        },
        actions: [
          {
            type: 'send_email',
            config: {
              templateId: 'high_performer',
              to: '{{candidate.email}}'
            }
          }
        ]
      });

      mockStorage.getWorkflows = jest.fn().mockResolvedValue([workflow]);
      const emailService = require('../../services/email').emailService;
      emailService.sendEmail = jest.fn();

      await engine.loadWorkflows();
      await engine.handleTrigger('candidate_created', {
        candidate: {
          ...mockCandidates.bob,
          score: 78 // Below threshold
        }
      });

      expect(emailService.sendEmail).not.toHaveBeenCalled();
    });
  });

  describe('Scheduler', () => {
    it('should start and stop scheduler', async () => {
      await engine.startScheduler();
      expect(engine['schedulerInterval']).toBeDefined();

      engine.stopScheduler();
      expect(engine['schedulerInterval']).toBeNull();
    });

    it('should execute scheduled workflows', async () => {
      jest.useFakeTimers();

      const schedule = {
        id: 'schedule-1',
        workflowId: 'workflow-1',
        cronExpression: '0 9 * * *',
        nextRunAt: new Date()
      };

      const workflow = TestFactory.createWorkflow({
        id: 'workflow-1',
        status: 'active',
        actions: [
          {
            type: 'send_message',
            config: {
              channelId: 'test-channel',
              message: 'Scheduled message'
            }
          }
        ]
      });

      mockStorage.getActiveSchedules = jest.fn().mockResolvedValue([schedule]);
      mockStorage.getWorkflow = jest.fn().mockResolvedValue(workflow);
      mockStorage.updateWorkflowSchedule = jest.fn();
      mockStorage.createMessage = jest.fn().mockResolvedValue({ id: 'msg-1' });

      await engine.startScheduler();
      
      // Trigger the scheduled check
      jest.advanceTimersByTime(60000); // 1 minute
      
      // Wait for async operations
      await Promise.resolve();
      await Promise.resolve();

      expect(mockStorage.getWorkflow).toHaveBeenCalledWith('workflow-1');
      expect(mockStorage.updateWorkflowSchedule).toHaveBeenCalled();

      engine.stopScheduler();
      jest.useRealTimers();
    });
  });

  describe('Variable Resolution', () => {
    it('should resolve variables in action config', async () => {
      const workflow = TestFactory.createWorkflow({
        variables: {
          userName: 'John Doe',
          score: 95
        },
        actions: [
          {
            type: 'send_message',
            config: {
              channelId: 'test-channel',
              message: 'Hello {{userName}}, your score is {{score}}'
            }
          }
        ]
      });

      mockStorage.createMessage = jest.fn().mockResolvedValue({ id: 'msg-1' });

      await engine.executeWorkflow(workflow, 'user-1', {
        userName: 'Jane Smith',
        score: 88
      });

      expect(mockStorage.createMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Hello Jane Smith, your score is 88'
        })
      );
    });

    it('should handle nested variable paths', async () => {
      const workflow = TestFactory.createWorkflow({
        variables: {
          candidate: {
            name: 'John Doe',
            email: 'john@example.com',
            details: {
              score: 85
            }
          }
        },
        actions: [
          {
            type: 'send_email',
            config: {
              templateId: 'candidate_update',
              to: '{{candidate.email}}',
              variables: {
                name: '{{candidate.name}}',
                score: '{{candidate.details.score}}'
              }
            }
          }
        ]
      });

      const emailService = require('../../services/email').emailService;
      emailService.sendEmail = jest.fn().mockResolvedValue({ success: true });

      await engine.executeWorkflow(workflow, 'user-1');

      expect(emailService.sendEmail).toHaveBeenCalledWith(
        'john@example.com',
        'candidate_update',
        expect.objectContaining({
          name: 'John Doe',
          score: 85
        })
      );
    });
  });

  describe('Action Types', () => {
    it('should execute send_email action', async () => {
      const workflow = TestFactory.createWorkflow({
        actions: [
          {
            type: 'send_email',
            config: {
              templateId: 'welcome',
              to: 'test@example.com',
              variables: {
                name: 'Test User'
              }
            }
          }
        ]
      });

      const emailService = require('../../services/email').emailService;
      emailService.sendEmail = jest.fn().mockResolvedValue({ 
        success: true, 
        messageId: 'msg-id' 
      });

      await engine.executeWorkflow(workflow, 'user-1');

      expect(emailService.sendEmail).toHaveBeenCalledWith(
        'test@example.com',
        'welcome',
        { name: 'Test User' }
      );
    });

    it('should execute update_candidate action', async () => {
      const workflow = TestFactory.createWorkflow({
        actions: [
          {
            type: 'update_candidate',
            config: {
              candidateId: 'candidate-1',
              updates: {
                pipelineStage: 'FIRST_INTERVIEW',
                score: 90
              }
            }
          }
        ]
      });

      mockStorage.updateCandidate = jest.fn().mockResolvedValue({
        id: 'candidate-1',
        pipelineStage: 'FIRST_INTERVIEW'
      });

      await engine.executeWorkflow(workflow, 'user-1');

      expect(mockStorage.updateCandidate).toHaveBeenCalledWith(
        'candidate-1',
        expect.objectContaining({
          pipelineStage: 'FIRST_INTERVIEW',
          score: 90
        })
      );
    });

    it('should execute api_call action', async () => {
      const workflow = TestFactory.createWorkflow({
        actions: [
          {
            type: 'api_call',
            config: {
              url: 'https://api.example.com/webhook',
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: {
                event: 'workflow_executed'
              }
            }
          }
        ]
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      });

      await engine.executeWorkflow(workflow, 'user-1');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/webhook',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify({ event: 'workflow_executed' })
        })
      );
    });
  });
});
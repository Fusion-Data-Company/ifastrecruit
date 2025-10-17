import { ElevenLabsAutomationService } from '../../services/elevenlabs-automation';
import { ElevenLabsPoisonHandler } from '../../services/elevenlabs-poison-handler';
import { storage } from '../../storage';
import { elevenlabsIntegration } from '../../integrations/elevenlabs';
import { elevenLabsAgent } from '../../services/elevenlabs-agent';
import { mockElevenLabsConversations } from '../utils/mockData';

// Mock dependencies
jest.mock('../../storage');
jest.mock('../../integrations/elevenlabs');
jest.mock('../../services/elevenlabs-agent');

describe('ElevenLabsAutomationService', () => {
  let service: ElevenLabsAutomationService;
  let mockStorage: any;
  let mockElevenlabs: any;
  let mockAgent: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    service = new ElevenLabsAutomationService();
    mockStorage = storage as jest.Mocked<typeof storage>;
    mockElevenlabs = elevenlabsIntegration as jest.Mocked<typeof elevenlabsIntegration>;
    mockAgent = elevenLabsAgent as jest.Mocked<typeof elevenLabsAgent>;
    
    // Setup default mocks
    mockStorage.getElevenLabsTracking = jest.fn().mockResolvedValue({
      agentId: 'agent-test',
      isActive: true,
      lastProcessedAt: new Date('2024-01-10T09:00:00Z'),
      lastConversationId: null,
      totalProcessed: 0,
      totalFailed: 0
    });
    
    mockStorage.updateElevenLabsTracking = jest.fn().mockResolvedValue({});
    mockStorage.upsertElevenLabsTracking = jest.fn().mockResolvedValue({});
  });

  afterEach(() => {
    service.stopPolling();
    jest.useRealTimers();
  });

  describe('Polling Lifecycle', () => {
    it('should start polling successfully', async () => {
      mockElevenlabs.getAgentConversations = jest.fn().mockResolvedValue({
        conversations: []
      });

      await service.startPolling();

      expect(service['isPolling']).toBe(true);
      expect(service['pollingTimer']).toBeDefined();
    });

    it('should not start polling if already polling', async () => {
      await service.startPolling();
      const timer1 = service['pollingTimer'];
      
      await service.startPolling();
      const timer2 = service['pollingTimer'];
      
      expect(timer1).toBe(timer2);
    });

    it('should stop polling', async () => {
      await service.startPolling();
      service.stopPolling();

      expect(service['isPolling']).toBe(false);
      expect(service['pollingTimer']).toBeNull();
    });

    it('should execute initial poll after delay', async () => {
      mockElevenlabs.getAgentConversations = jest.fn().mockResolvedValue({
        conversations: []
      });

      await service.startPolling();
      
      // Advance timers to trigger initial poll (5 seconds)
      jest.advanceTimersByTime(5000);
      await Promise.resolve();

      expect(mockElevenlabs.getAgentConversations).toHaveBeenCalled();
    });

    it('should poll at regular intervals', async () => {
      mockElevenlabs.getAgentConversations = jest.fn().mockResolvedValue({
        conversations: []
      });

      await service.startPolling();
      
      // Initial poll
      jest.advanceTimersByTime(5000);
      await Promise.resolve();
      expect(mockElevenlabs.getAgentConversations).toHaveBeenCalledTimes(1);
      
      // First interval poll (30 seconds)
      jest.advanceTimersByTime(30000);
      await Promise.resolve();
      expect(mockElevenlabs.getAgentConversations).toHaveBeenCalledTimes(2);
      
      // Second interval poll
      jest.advanceTimersByTime(30000);
      await Promise.resolve();
      expect(mockElevenlabs.getAgentConversations).toHaveBeenCalledTimes(3);
    });
  });

  describe('Conversation Processing', () => {
    it('should process new conversations successfully', async () => {
      const newConversations = [mockElevenLabsConversations.conversation1];
      
      mockElevenlabs.getAgentConversations = jest.fn().mockResolvedValue({
        conversations: newConversations
      });
      
      mockAgent.processConversation = jest.fn().mockResolvedValue({
        success: true,
        candidate: {
          id: 'candidate-1',
          name: 'John Doe',
          email: 'john@example.com',
          pipelineStage: 'NEW'
        }
      });

      await service['pollForNewConversations']();

      expect(mockAgent.processConversation).toHaveBeenCalledWith('conv-1');
      expect(mockStorage.updateElevenLabsTracking).toHaveBeenCalledWith(
        'agent-test',
        expect.objectContaining({
          lastConversationId: 'conv-1',
          totalProcessed: expect.any(Number)
        })
      );
    });

    it('should skip processing when tracking is disabled', async () => {
      mockStorage.getElevenLabsTracking = jest.fn().mockResolvedValue({
        agentId: 'agent-test',
        isActive: false,
        lastProcessedAt: new Date()
      });

      await service['pollForNewConversations']();

      expect(mockElevenlabs.getAgentConversations).not.toHaveBeenCalled();
    });

    it('should handle processing errors gracefully', async () => {
      const conversation = mockElevenLabsConversations.conversation1;
      
      mockElevenlabs.getAgentConversations = jest.fn().mockResolvedValue({
        conversations: [conversation]
      });
      
      mockAgent.processConversation = jest.fn().mockRejectedValue(
        new Error('Processing failed')
      );

      await service['pollForNewConversations']();

      expect(mockStorage.updateElevenLabsTracking).toHaveBeenCalledWith(
        'agent-test',
        expect.objectContaining({
          totalFailed: expect.any(Number)
        })
      );
    });

    it('should handle no new conversations', async () => {
      mockElevenlabs.getAgentConversations = jest.fn().mockResolvedValue({
        conversations: []
      });

      await service['pollForNewConversations']();

      expect(mockAgent.processConversation).not.toHaveBeenCalled();
      expect(mockStorage.updateElevenLabsTracking).not.toHaveBeenCalled();
    });

    it('should broadcast SSE events on successful processing', async () => {
      const broadcastFn = jest.fn();
      service.setBroadcastFunction(broadcastFn);
      
      mockElevenlabs.getAgentConversations = jest.fn().mockResolvedValue({
        conversations: [mockElevenLabsConversations.conversation1]
      });
      
      mockAgent.processConversation = jest.fn().mockResolvedValue({
        success: true,
        candidate: {
          id: 'candidate-1',
          name: 'John Doe',
          email: 'john@example.com',
          pipelineStage: 'NEW'
        }
      });

      await service['pollForNewConversations']();

      expect(broadcastFn).toHaveBeenCalledWith(
        'candidate-created',
        expect.objectContaining({
          id: 'candidate-1',
          name: 'John Doe'
        })
      );
    });
  });

  describe('Manual Trigger', () => {
    it('should trigger manual processing successfully', async () => {
      mockElevenlabs.getAgentConversations = jest.fn().mockResolvedValue({
        conversations: [mockElevenLabsConversations.conversation1]
      });
      
      mockAgent.processConversation = jest.fn().mockResolvedValue({
        success: true,
        candidate: { id: 'candidate-1' }
      });

      const result = await service.triggerManualPoll();

      expect(result).toEqual({
        success: true,
        found: 1,
        processed: 1,
        failed: 0,
        errors: []
      });
    });

    it('should handle manual trigger errors', async () => {
      mockElevenlabs.getAgentConversations = jest.fn().mockRejectedValue(
        new Error('API Error')
      );

      const result = await service.triggerManualPoll();

      expect(result).toEqual({
        success: false,
        error: 'API Error',
        found: 0,
        processed: 0,
        failed: 0,
        errors: []
      });
    });
  });

  describe('Tracking Management', () => {
    it('should initialize tracking record if not exists', async () => {
      mockStorage.getElevenLabsTracking = jest.fn().mockResolvedValue(null);

      await service['initializeTracking']();

      expect(mockStorage.upsertElevenLabsTracking).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: 'agent-test',
          isActive: true,
          lastProcessedAt: expect.any(Date)
        })
      );
    });

    it('should update tracking error on failure', async () => {
      await service['updateTrackingError']('Test error');

      expect(mockStorage.updateElevenLabsTracking).toHaveBeenCalledWith(
        'agent-test',
        expect.objectContaining({
          lastError: 'Test error',
          lastErrorAt: expect.any(Date)
        })
      );
    });

    it('should update last processed time correctly', async () => {
      const conversations = [
        {
          ...mockElevenLabsConversations.conversation1,
          created_at: '2024-01-10T12:00:00Z'
        }
      ];
      
      mockElevenlabs.getAgentConversations = jest.fn().mockResolvedValue({
        conversations
      });
      
      mockAgent.processConversation = jest.fn().mockResolvedValue({
        success: true,
        candidate: { id: 'candidate-1' }
      });

      await service['pollForNewConversations']();

      expect(mockStorage.updateElevenLabsTracking).toHaveBeenCalledWith(
        'agent-test',
        expect.objectContaining({
          lastProcessedAt: new Date('2024-01-10T12:00:00Z')
        })
      );
    });
  });
});

describe('ElevenLabsPoisonHandler', () => {
  let handler: ElevenLabsPoisonHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    handler = new ElevenLabsPoisonHandler();
  });

  describe('Retry Logic', () => {
    it('should allow retry on first failure', () => {
      const result = handler.shouldRetryConversation('conv-1', 'Network error');

      expect(result.shouldRetry).toBe(true);
      expect(result.waitTimeMs).toBe(1000); // First backoff
    });

    it('should increase backoff time with each failure', () => {
      const convId = 'conv-2';
      
      // First failure
      let result = handler.shouldRetryConversation(convId, 'Error 1');
      expect(result.waitTimeMs).toBe(1000);
      
      // Second failure
      result = handler.shouldRetryConversation(convId, 'Error 2');
      expect(result.waitTimeMs).toBe(2000);
      
      // Third failure
      result = handler.shouldRetryConversation(convId, 'Error 3');
      expect(result.waitTimeMs).toBe(5000);
    });

    it('should mark as poisoned after max attempts', () => {
      const convId = 'conv-3';
      
      // Fail up to max attempts
      for (let i = 0; i < 5; i++) {
        handler.shouldRetryConversation(convId, `Error ${i}`);
      }
      
      // Should be poisoned on 6th attempt
      const result = handler.shouldRetryConversation(convId, 'Final error');
      
      expect(result.shouldRetry).toBe(false);
      expect(result.reason).toContain('poisoned');
      expect(handler.isPoisoned(convId)).toBe(true);
    });

    it('should mark success and reset retries', () => {
      const convId = 'conv-4';
      
      // Fail twice
      handler.shouldRetryConversation(convId, 'Error 1');
      handler.shouldRetryConversation(convId, 'Error 2');
      
      // Mark as successful
      handler.markSuccess(convId);
      
      // Should start fresh on next failure
      const result = handler.shouldRetryConversation(convId, 'New error');
      expect(result.shouldRetry).toBe(true);
      expect(result.waitTimeMs).toBe(1000); // Reset to first backoff
    });
  });

  describe('Error Categorization', () => {
    it('should categorize network errors', () => {
      const result = handler.shouldRetryConversation('conv-5', 'ECONNREFUSED');
      const poisonMsg = handler['poisonMessages'].get('conv-5');
      
      expect(poisonMsg?.errorType).toBe('NETWORK');
    });

    it('should categorize rate limit errors', () => {
      const result = handler.shouldRetryConversation('conv-6', '429 Too Many Requests');
      const poisonMsg = handler['poisonMessages'].get('conv-6');
      
      expect(poisonMsg?.errorType).toBe('RATE_LIMIT');
    });

    it('should categorize API errors', () => {
      const result = handler.shouldRetryConversation('conv-7', '400 Bad Request');
      const poisonMsg = handler['poisonMessages'].get('conv-7');
      
      expect(poisonMsg?.errorType).toBe('API_ERROR');
    });
  });

  describe('Manual Retry', () => {
    it('should allow manual retry of poisoned conversation', () => {
      const convId = 'conv-8';
      
      // Make it poisoned
      for (let i = 0; i <= 5; i++) {
        handler.shouldRetryConversation(convId, `Error ${i}`);
      }
      
      expect(handler.isPoisoned(convId)).toBe(true);
      
      // Manual retry
      const result = handler.manualRetry(convId);
      
      expect(result).toBe(true);
      expect(handler.isPoisoned(convId)).toBe(false);
    });

    it('should return false for non-existent conversation', () => {
      const result = handler.manualRetry('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('Poison List Management', () => {
    it('should get all poisoned conversations', () => {
      // Create some poisoned conversations
      for (let i = 1; i <= 3; i++) {
        const convId = `poison-${i}`;
        for (let j = 0; j <= 5; j++) {
          handler.shouldRetryConversation(convId, 'Error');
        }
      }
      
      const poisoned = handler.getPoisonedConversations();
      
      expect(poisoned).toHaveLength(3);
      expect(poisoned.every(p => p.isPoisoned)).toBe(true);
    });

    it('should clear all poison records', () => {
      // Add some records
      handler.shouldRetryConversation('conv-9', 'Error');
      handler.shouldRetryConversation('conv-10', 'Error');
      
      handler.clearAllPoisonRecords();
      
      expect(handler.getPoisonedConversations()).toHaveLength(0);
    });
  });
});
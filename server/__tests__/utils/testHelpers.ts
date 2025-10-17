import { db } from '../../db';
import { 
  users, 
  channels, 
  messages, 
  candidates, 
  workflows,
  workflowRuns,
  campaigns,
  interviews,
  bookings,
  notifications,
  calls
} from '@shared/schema';
import { eq, sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'crypto';

export class TestDatabase {
  private static instance: TestDatabase;
  
  static getInstance(): TestDatabase {
    if (!TestDatabase.instance) {
      TestDatabase.instance = new TestDatabase();
    }
    return TestDatabase.instance;
  }

  async setup() {
    // Clear all tables in reverse dependency order
    await this.cleanup();
  }

  async cleanup() {
    // Delete in reverse dependency order to avoid foreign key violations
    const tables = [
      'workflow_runs',
      'workflow_templates',
      'workflow_schedules',
      'workflows',
      'poll_votes',
      'polls',
      'reminders',
      'command_favorites',
      'command_permissions',
      'command_history',
      'slash_commands',
      'search_history',
      'saved_searches',
      'call_participants',
      'calls',
      'notifications',
      'direct_message_reactions',
      'message_reactions',
      'direct_messages',
      'messages',
      'file_uploads',
      'onboarding_responses',
      'channel_join_requests',
      'shared_channels',
      'channel_permissions',
      'channel_members',
      'user_channels',
      'channels',
      'jason_channel_behaviors',
      'jason_templates',
      'jason_settings',
      'conversation_memory',
      'conversation_context',
      'platform_conversations',
      'elevenlabs_tracking',
      'workflow_rules',
      'bookings',
      'interviews',
      'candidates',
      'apify_runs',
      'apify_actors',
      'campaigns',
      'audit_logs',
      'users'
    ];

    for (const table of tables) {
      try {
        await db.execute(sql.raw(`DELETE FROM ${table}`));
      } catch (error) {
        // Table might not exist or already empty
        console.debug(`Could not clear table ${table}:`, error);
      }
    }
  }

  async seed() {
    // Create test users
    const testUsers = await this.createTestUsers();
    
    // Create test channels
    const testChannels = await this.createTestChannels(testUsers);
    
    // Create test messages
    await this.createTestMessages(testUsers, testChannels);
    
    // Create test candidates
    await this.createTestCandidates();
    
    return { users: testUsers, channels: testChannels };
  }

  async createTestUsers() {
    const hashedPassword = await bcrypt.hash('testpassword', 10);
    
    const testUsersData = [
      {
        id: 'test-user-1',
        email: 'user1@test.com',
        firstName: 'Test',
        lastName: 'User1',
        password: hashedPassword,
        isAdmin: false,
        hasCompletedOnboarding: true
      },
      {
        id: 'test-user-2',
        email: 'user2@test.com',
        firstName: 'Test',
        lastName: 'User2',
        password: hashedPassword,
        isAdmin: false,
        hasCompletedOnboarding: true
      },
      {
        id: 'test-admin',
        email: 'admin@test.com',
        firstName: 'Test',
        lastName: 'Admin',
        password: hashedPassword,
        isAdmin: true,
        hasCompletedOnboarding: true
      }
    ];

    const created = await db.insert(users).values(testUsersData).returning();
    return created;
  }

  async createTestChannels(testUsers: any[]) {
    const testChannelsData = [
      {
        id: 'test-channel-1',
        name: 'test-general',
        description: 'General test channel',
        tier: 'NON_LICENSED' as const,
        isActive: true,
        createdBy: testUsers[0].id
      },
      {
        id: 'test-channel-2',
        name: 'test-florida',
        description: 'Florida licensed test channel',
        tier: 'FL_LICENSED' as const,
        isActive: true,
        createdBy: testUsers[1].id
      },
      {
        id: 'test-channel-3',
        name: 'test-multistate',
        description: 'Multi-state test channel',
        tier: 'MULTI_STATE' as const,
        isActive: true,
        createdBy: testUsers[2].id
      }
    ];

    const created = await db.insert(channels).values(testChannelsData).returning();
    return created;
  }

  async createTestMessages(testUsers: any[], testChannels: any[]) {
    const testMessagesData = [
      {
        channelId: testChannels[0].id,
        userId: testUsers[0].id,
        content: 'Test message 1',
        type: 'text' as const
      },
      {
        channelId: testChannels[0].id,
        userId: testUsers[1].id,
        content: 'Test message 2',
        type: 'text' as const
      }
    ];

    const created = await db.insert(messages).values(testMessagesData).returning();
    return created;
  }

  async createTestCandidates() {
    const testCandidatesData = [
      {
        id: 'test-candidate-1',
        name: 'John Doe',
        email: 'john.doe@test.com',
        phone: '555-0001',
        pipelineStage: 'NEW' as const,
        score: 85
      },
      {
        id: 'test-candidate-2',
        name: 'Jane Smith',
        email: 'jane.smith@test.com',
        phone: '555-0002',
        pipelineStage: 'FIRST_INTERVIEW' as const,
        score: 92
      }
    ];

    const created = await db.insert(candidates).values(testCandidatesData).returning();
    return created;
  }

  async createTestWorkflow(userId: string) {
    const testWorkflow = {
      id: 'test-workflow-1',
      name: 'Test Workflow',
      description: 'Test workflow for testing',
      status: 'active' as const,
      triggerType: 'manual' as const,
      actions: [
        {
          type: 'send_message',
          config: {
            channelId: 'test-channel-1',
            message: 'Test workflow message'
          }
        }
      ],
      createdBy: userId
    };

    const [created] = await db.insert(workflows).values(testWorkflow).returning();
    return created;
  }
}

export class MockService {
  static createMockStorage() {
    return {
      getUser: jest.fn(),
      getUserByEmail: jest.fn(),
      createUser: jest.fn(),
      updateUser: jest.fn(),
      deleteUser: jest.fn(),
      getChannels: jest.fn(),
      getChannel: jest.fn(),
      createChannel: jest.fn(),
      updateChannel: jest.fn(),
      deleteChannel: jest.fn(),
      getMessages: jest.fn(),
      getMessage: jest.fn(),
      createMessage: jest.fn(),
      updateMessage: jest.fn(),
      deleteMessage: jest.fn(),
      getCandidates: jest.fn(),
      getCandidate: jest.fn(),
      createCandidate: jest.fn(),
      updateCandidate: jest.fn(),
      deleteCandidate: jest.fn(),
      getWorkflows: jest.fn(),
      getWorkflow: jest.fn(),
      createWorkflow: jest.fn(),
      updateWorkflow: jest.fn(),
      deleteWorkflow: jest.fn(),
      createWorkflowRun: jest.fn(),
      updateWorkflowRun: jest.fn(),
      getWorkflowRun: jest.fn(),
      getWorkflowRuns: jest.fn()
    };
  }

  static createMockEmailService() {
    return {
      sendEmail: jest.fn().mockResolvedValue({ success: true, messageId: 'test-message-id' }),
      sendBulkEmail: jest.fn().mockResolvedValue({ success: true, sent: 10, failed: 0 }),
      validateTemplate: jest.fn().mockReturnValue(true),
      interpolateTemplate: jest.fn()
    };
  }

  static createMockSlackIntegration() {
    return {
      sendMessage: jest.fn().mockResolvedValue({ ok: true }),
      sendDirectMessage: jest.fn().mockResolvedValue({ ok: true }),
      uploadFile: jest.fn().mockResolvedValue({ ok: true }),
      createChannel: jest.fn().mockResolvedValue({ ok: true }),
      inviteToChannel: jest.fn().mockResolvedValue({ ok: true })
    };
  }

  static createMockApifyClient() {
    return {
      isConnected: true,
      listActors: jest.fn().mockResolvedValue([]),
      createActor: jest.fn().mockResolvedValue({ id: 'test-actor-id' }),
      runActor: jest.fn().mockResolvedValue({ id: 'test-run-id' }),
      getRunStatus: jest.fn().mockResolvedValue({ status: 'SUCCEEDED' }),
      getDataset: jest.fn().mockResolvedValue({ items: [] })
    };
  }

  static createMockElevenLabsIntegration() {
    return {
      getAgentConversations: jest.fn().mockResolvedValue({ conversations: [] }),
      getConversation: jest.fn().mockResolvedValue({ 
        conversation_id: 'test-conv-id',
        transcript: { messages: [] }
      }),
      getAudioRecording: jest.fn().mockResolvedValue(Buffer.from('test-audio')),
      analyzeConversation: jest.fn().mockResolvedValue({ 
        success: true,
        candidate: { name: 'Test', email: 'test@test.com' }
      })
    };
  }

  static createMockWebSocketClient() {
    const mockWs = {
      send: jest.fn(),
      close: jest.fn(),
      on: jest.fn(),
      emit: jest.fn(),
      readyState: 1 // OPEN
    };
    return mockWs;
  }

  static createMockRequest(overrides = {}) {
    return {
      body: {},
      params: {},
      query: {},
      headers: {},
      user: { id: 'test-user-id', email: 'test@test.com' },
      session: { userId: 'test-user-id' },
      ...overrides
    };
  }

  static createMockResponse() {
    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      end: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis()
    };
    return res;
  }
}

export class TestFactory {
  static createUser(overrides = {}) {
    return {
      id: uuidv4(),
      email: `test-${Date.now()}@test.com`,
      firstName: 'Test',
      lastName: 'User',
      password: 'hashedpassword',
      isAdmin: false,
      hasCompletedOnboarding: true,
      createdAt: new Date(),
      ...overrides
    };
  }

  static createChannel(overrides = {}) {
    return {
      id: uuidv4(),
      name: `test-channel-${Date.now()}`,
      description: 'Test channel',
      tier: 'NON_LICENSED' as const,
      isActive: true,
      createdBy: 'test-user-id',
      createdAt: new Date(),
      ...overrides
    };
  }

  static createMessage(overrides = {}) {
    return {
      id: uuidv4(),
      channelId: 'test-channel-id',
      userId: 'test-user-id',
      content: 'Test message content',
      type: 'text' as const,
      createdAt: new Date(),
      ...overrides
    };
  }

  static createCandidate(overrides = {}) {
    return {
      id: uuidv4(),
      name: 'Test Candidate',
      email: `candidate-${Date.now()}@test.com`,
      phone: '555-0000',
      pipelineStage: 'NEW' as const,
      score: 75,
      createdAt: new Date(),
      ...overrides
    };
  }

  static createWorkflow(overrides = {}) {
    return {
      id: uuidv4(),
      name: 'Test Workflow',
      description: 'Test workflow description',
      status: 'active' as const,
      triggerType: 'manual' as const,
      actions: [],
      createdBy: 'test-user-id',
      createdAt: new Date(),
      ...overrides
    };
  }

  static createNotification(overrides = {}) {
    return {
      id: uuidv4(),
      userId: 'test-user-id',
      type: 'message' as const,
      title: 'Test Notification',
      message: 'Test notification message',
      status: 'unread' as const,
      createdAt: new Date(),
      ...overrides
    };
  }
}

export async function withTestDatabase(fn: () => Promise<void>) {
  const testDb = TestDatabase.getInstance();
  
  try {
    await testDb.setup();
    await fn();
  } finally {
    await testDb.cleanup();
  }
}

export function mockDate(date: Date | string) {
  const mockedDate = new Date(date);
  jest.useFakeTimers();
  jest.setSystemTime(mockedDate);
  return () => jest.useRealTimers();
}
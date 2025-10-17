import request from 'supertest';
import express from 'express';
import { registerRoutes } from '../../routes';
import { TestDatabase, withTestDatabase } from '../utils/testHelpers';
import { mockUsers, mockChannels, mockCandidates } from '../utils/mockData';

// Mock authentication middleware
jest.mock('../../replitAuth', () => ({
  setupAuth: jest.fn(),
  isAuthenticated: (req: any, res: any, next: any) => {
    req.user = { 
      claims: { 
        sub: 'test-user-1', 
        email: 'test@example.com' 
      } 
    };
    next();
  },
  isAdmin: (req: any, res: any, next: any) => {
    req.user = { 
      claims: { 
        sub: 'test-admin', 
        email: 'admin@example.com' 
      } 
    };
    req.isAdmin = true;
    next();
  }
}));

describe('API Integration Tests', () => {
  let app: express.Express;
  let server: any;
  let testDb: TestDatabase;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    server = await registerRoutes(app);
    testDb = TestDatabase.getInstance();
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
  });

  beforeEach(async () => {
    await testDb.setup();
    await testDb.seed();
  });

  afterEach(async () => {
    await testDb.cleanup();
  });

  describe('Authentication Endpoints', () => {
    it('should get current user', async () => {
      const response = await request(app)
        .get('/api/auth/user')
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('email');
    });

    it('should get onboarding status', async () => {
      const response = await request(app)
        .get('/api/onboarding/status')
        .expect(200);

      expect(response.body).toHaveProperty('completed');
    });

    it('should complete onboarding', async () => {
      const response = await request(app)
        .post('/api/onboarding/complete')
        .field('hasFloridaLicense', 'true')
        .field('isMultiStateLicensed', 'false')
        .field('licensedStates', JSON.stringify(['FL']))
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('channels');
    });
  });

  describe('Channel Endpoints', () => {
    it('should list all channels', async () => {
      const response = await request(app)
        .get('/api/channels')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should get channel details', async () => {
      const response = await request(app)
        .get('/api/channels/test-channel-1')
        .expect(200);

      expect(response.body).toHaveProperty('id', 'test-channel-1');
      expect(response.body).toHaveProperty('name');
    });

    it('should create a new channel', async () => {
      const newChannel = {
        name: 'new-test-channel',
        description: 'A new test channel',
        tier: 'NON_LICENSED'
      };

      const response = await request(app)
        .post('/api/channels')
        .send(newChannel)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(newChannel.name);
    });

    it('should update channel', async () => {
      const updates = {
        description: 'Updated description'
      };

      const response = await request(app)
        .patch('/api/channels/test-channel-1')
        .send(updates)
        .expect(200);

      expect(response.body.description).toBe(updates.description);
    });

    it('should delete channel', async () => {
      await request(app)
        .delete('/api/channels/test-channel-1')
        .expect(204);

      // Verify channel is deleted
      await request(app)
        .get('/api/channels/test-channel-1')
        .expect(404);
    });
  });

  describe('Message Endpoints', () => {
    it('should get channel messages', async () => {
      const response = await request(app)
        .get('/api/channels/test-channel-1/messages')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should send a message', async () => {
      const message = {
        content: 'Test message content',
        type: 'text'
      };

      const response = await request(app)
        .post('/api/channels/test-channel-1/messages')
        .send(message)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.content).toBe(message.content);
    });

    it('should edit a message', async () => {
      // First create a message
      const createResponse = await request(app)
        .post('/api/channels/test-channel-1/messages')
        .send({ content: 'Original message' })
        .expect(201);

      const messageId = createResponse.body.id;

      // Then edit it
      const editResponse = await request(app)
        .patch(`/api/messages/${messageId}`)
        .send({ content: 'Edited message' })
        .expect(200);

      expect(editResponse.body.content).toBe('Edited message');
      expect(editResponse.body.isEdited).toBe(true);
    });

    it('should delete a message', async () => {
      // First create a message
      const createResponse = await request(app)
        .post('/api/channels/test-channel-1/messages')
        .send({ content: 'To be deleted' })
        .expect(201);

      const messageId = createResponse.body.id;

      // Then delete it
      await request(app)
        .delete(`/api/messages/${messageId}`)
        .expect(204);
    });
  });

  describe('Candidate Endpoints', () => {
    it('should list candidates', async () => {
      const response = await request(app)
        .get('/api/candidates')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should get candidate details', async () => {
      const response = await request(app)
        .get('/api/candidates/test-candidate-1')
        .expect(200);

      expect(response.body).toHaveProperty('id', 'test-candidate-1');
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('email');
    });

    it('should create a candidate', async () => {
      const newCandidate = {
        name: 'New Candidate',
        email: 'new@example.com',
        phone: '555-1234',
        pipelineStage: 'NEW',
        score: 80
      };

      const response = await request(app)
        .post('/api/candidates')
        .send(newCandidate)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(newCandidate.name);
    });

    it('should update candidate', async () => {
      const updates = {
        pipelineStage: 'FIRST_INTERVIEW',
        score: 90
      };

      const response = await request(app)
        .patch('/api/candidates/test-candidate-1')
        .send(updates)
        .expect(200);

      expect(response.body.pipelineStage).toBe(updates.pipelineStage);
      expect(response.body.score).toBe(updates.score);
    });

    it('should delete candidate', async () => {
      await request(app)
        .delete('/api/candidates/test-candidate-1')
        .expect(204);

      // Verify candidate is deleted
      await request(app)
        .get('/api/candidates/test-candidate-1')
        .expect(404);
    });
  });

  describe('Workflow Endpoints', () => {
    it('should list workflows', async () => {
      const response = await request(app)
        .get('/api/workflows')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should create a workflow', async () => {
      const newWorkflow = {
        name: 'Test Workflow',
        description: 'A test workflow',
        status: 'active',
        triggerType: 'manual',
        actions: [
          {
            type: 'send_message',
            config: {
              channelId: 'test-channel-1',
              message: 'Workflow test message'
            }
          }
        ]
      };

      const response = await request(app)
        .post('/api/workflows')
        .send(newWorkflow)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(newWorkflow.name);
    });

    it('should execute a workflow', async () => {
      // First create a workflow
      const workflow = {
        name: 'Execute Test',
        status: 'active',
        triggerType: 'manual',
        actions: [
          {
            type: 'send_message',
            config: {
              channelId: 'test-channel-1',
              message: 'Executed message'
            }
          }
        ]
      };

      const createResponse = await request(app)
        .post('/api/workflows')
        .send(workflow)
        .expect(201);

      const workflowId = createResponse.body.id;

      // Execute the workflow
      const executeResponse = await request(app)
        .post(`/api/workflows/${workflowId}/execute`)
        .expect(200);

      expect(executeResponse.body).toHaveProperty('runId');
      expect(executeResponse.body.status).toBe('running');
    });
  });

  describe('Search Endpoints', () => {
    it('should search messages', async () => {
      const response = await request(app)
        .get('/api/search')
        .query({
          q: 'test',
          scope: 'messages'
        })
        .expect(200);

      expect(response.body).toHaveProperty('results');
      expect(response.body).toHaveProperty('totalCount');
    });

    it('should search with filters', async () => {
      const response = await request(app)
        .get('/api/search')
        .query({
          q: 'test',
          scope: 'all',
          channelId: 'test-channel-1',
          from: '2024-01-01',
          to: '2024-12-31'
        })
        .expect(200);

      expect(response.body).toHaveProperty('results');
    });

    it('should save search', async () => {
      const saveData = {
        name: 'My Search',
        query: 'important',
        scope: 'messages',
        filters: {
          channelId: 'test-channel-1'
        }
      };

      const response = await request(app)
        .post('/api/search/saved')
        .send(saveData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(saveData.name);
    });

    it('should get saved searches', async () => {
      const response = await request(app)
        .get('/api/search/saved')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('File Upload Endpoints', () => {
    it('should upload a file', async () => {
      const response = await request(app)
        .post('/api/upload')
        .attach('file', Buffer.from('test content'), 'test.txt')
        .expect(200);

      expect(response.body).toHaveProperty('fileId');
      expect(response.body).toHaveProperty('filename', 'test.txt');
    });

    it('should parse resume upload', async () => {
      const resumeContent = `
        John Doe
        Email: john@example.com
        Phone: 555-1234
        
        Experience:
        Senior Developer at Tech Corp
      `;

      const response = await request(app)
        .post('/api/upload/resume')
        .attach('resume', Buffer.from(resumeContent), 'resume.txt')
        .expect(200);

      expect(response.body).toHaveProperty('parsed');
      expect(response.body.parsed).toHaveProperty('email');
    });
  });

  describe('Notification Endpoints', () => {
    it('should get notifications', async () => {
      const response = await request(app)
        .get('/api/notifications')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should mark notification as read', async () => {
      // First create a notification
      const notification = await testDb['createTestNotification']('test-user-1');

      const response = await request(app)
        .patch(`/api/notifications/${notification.id}/read`)
        .expect(200);

      expect(response.body.status).toBe('read');
    });

    it('should get unread count', async () => {
      const response = await request(app)
        .get('/api/notifications/unread-count')
        .expect(200);

      expect(response.body).toHaveProperty('count');
      expect(typeof response.body.count).toBe('number');
    });
  });

  describe('Call Endpoints', () => {
    it('should initiate a call', async () => {
      const callData = {
        type: 'voice',
        participants: ['test-user-2']
      };

      const response = await request(app)
        .post('/api/calls/initiate')
        .send(callData)
        .expect(201);

      expect(response.body).toHaveProperty('callId');
      expect(response.body).toHaveProperty('roomId');
    });

    it('should end a call', async () => {
      // First initiate a call
      const initiateResponse = await request(app)
        .post('/api/calls/initiate')
        .send({ type: 'voice', participants: [] })
        .expect(201);

      const callId = initiateResponse.body.callId;

      // Then end it
      const endResponse = await request(app)
        .post(`/api/calls/${callId}/end`)
        .expect(200);

      expect(endResponse.body.status).toBe('ended');
    });

    it('should get call history', async () => {
      const response = await request(app)
        .get('/api/calls/history')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('Admin Endpoints', () => {
    it('should get system stats (admin only)', async () => {
      const response = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(response.body).toHaveProperty('totalUsers');
      expect(response.body).toHaveProperty('totalChannels');
      expect(response.body).toHaveProperty('totalMessages');
    });

    it('should get audit logs (admin only)', async () => {
      const response = await request(app)
        .get('/api/admin/audit-logs')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent resource', async () => {
      const response = await request(app)
        .get('/api/channels/non-existent')
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 for invalid input', async () => {
      const response = await request(app)
        .post('/api/channels')
        .send({ 
          // Missing required fields
          description: 'Invalid channel' 
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 401 for unauthorized access', async () => {
      // Remove authentication for this test
      const originalAuth = app.get('auth');
      app.set('auth', null);

      const response = await request(app)
        .get('/api/protected-endpoint')
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Unauthorized');

      // Restore auth
      app.set('auth', originalAuth);
    });
  });
});
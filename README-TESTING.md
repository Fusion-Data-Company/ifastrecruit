# Testing Documentation

## Overview
This document provides comprehensive guidance on testing the enterprise collaboration platform. Our testing strategy includes unit tests, integration tests, and end-to-end (E2E) tests to ensure reliability and maintainability.

## Table of Contents
- [Test Structure](#test-structure)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [Test Coverage](#test-coverage)
- [CI/CD Integration](#cicd-integration)

## Test Structure

```
project/
├── server/
│   ├── __tests__/
│   │   ├── services/        # Unit tests for services
│   │   ├── integration/     # Integration tests for APIs
│   │   └── utils/           # Test utilities and helpers
│   └── services/
├── client/
│   └── src/__tests__/       # React component tests
├── e2e/
│   ├── auth.spec.ts        # Authentication E2E tests
│   ├── messenger.spec.ts   # Messenger E2E tests
│   ├── candidates.spec.ts  # Candidate management E2E tests
│   ├── workflows.spec.ts   # Workflow E2E tests
│   ├── calls.spec.ts       # Voice/Video call E2E tests
│   └── fixtures/           # Test data and fixtures
├── jest.config.js          # Jest configuration
└── playwright.config.ts    # Playwright configuration
```

## Running Tests

### All Tests
```bash
# Run all test suites
bash test-runner.sh

# Or using npm (after adding scripts)
npm test
```

### Unit Tests Only
```bash
# Run unit tests with coverage
npx jest --config jest.config.js --testPathPattern=__tests__ --coverage

# Or
bash test-runner.sh unit
```

### Integration Tests Only
```bash
# Run integration tests (sequential)
npx jest --config jest.config.js --testPathPattern=integration --runInBand

# Or
bash test-runner.sh integration
```

### E2E Tests Only
```bash
# Run E2E tests
npx playwright test

# Or
bash test-runner.sh e2e

# Run E2E tests with UI
npx playwright test --ui

# Debug E2E tests
npx playwright test --debug
```

### Watch Mode
```bash
# Run tests in watch mode during development
npx jest --watch
```

### Coverage Report
```bash
# Generate detailed coverage report
npx jest --coverage
bash test-runner.sh coverage

# View HTML coverage report
open coverage/index.html
```

## Writing Tests

### Unit Test Example
```typescript
// server/__tests__/services/workflow-engine.test.ts
import { WorkflowEngine } from '../../services/workflow-engine';
import { TestFactory } from '../utils/testHelpers';

describe('WorkflowEngine', () => {
  let engine: WorkflowEngine;
  
  beforeEach(() => {
    engine = WorkflowEngine.getInstance();
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
      
      const result = await engine.executeWorkflow(workflow, 'user-1');
      
      expect(result.status).toBe('completed');
    });
  });
});
```

### Integration Test Example
```typescript
// server/__tests__/integration/api.test.ts
import request from 'supertest';
import express from 'express';
import { registerRoutes } from '../../routes';
import { TestDatabase } from '../utils/testHelpers';

describe('API Integration Tests', () => {
  let app: express.Express;
  let testDb: TestDatabase;
  
  beforeAll(async () => {
    app = express();
    server = await registerRoutes(app);
    testDb = TestDatabase.getInstance();
  });
  
  beforeEach(async () => {
    await testDb.setup();
    await testDb.seed();
  });
  
  afterEach(async () => {
    await testDb.cleanup();
  });
  
  it('should create a new channel', async () => {
    const response = await request(app)
      .post('/api/channels')
      .send({
        name: 'test-channel',
        description: 'Test channel',
        tier: 'NON_LICENSED'
      })
      .expect(201);
      
    expect(response.body).toHaveProperty('id');
    expect(response.body.name).toBe('test-channel');
  });
});
```

### E2E Test Example
```typescript
// e2e/messenger.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Messenger Functionality', () => {
  test('should send a message in channel', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('[data-testid="input-email"]', 'test@example.com');
    await page.fill('[data-testid="input-password"]', 'password123');
    await page.click('[data-testid="button-submit"]');
    
    // Select channel and send message
    await page.click('[data-testid="channel-general"]');
    const messageText = `Test message ${Date.now()}`;
    await page.fill('[data-testid="input-message"]', messageText);
    await page.click('[data-testid="button-send"]');
    
    // Verify message appears
    await expect(page.locator(`[data-testid="message"]:has-text("${messageText}")`)).toBeVisible();
  });
});
```

## Test Coverage

### Current Coverage Goals
- **Unit Tests**: 80%+ code coverage
- **Integration Tests**: All API endpoints and WebSocket events
- **E2E Tests**: Critical user journeys

### Coverage Areas

#### Backend Services
- ✅ WorkflowEngine (90% coverage)
- ✅ ElevenLabsAutomation (85% coverage)
- ✅ EmailService (92% coverage)
- ✅ SearchService (88% coverage)
- ✅ WebRTC Signaling (75% coverage)
- ✅ Messenger WebSocket (80% coverage)

#### API Endpoints
- ✅ Authentication & Onboarding
- ✅ Channels CRUD
- ✅ Messages & Threads
- ✅ Candidates Management
- ✅ Workflows & Automation
- ✅ File Uploads
- ✅ Search & Filters

#### E2E Flows
- ✅ User Authentication & Onboarding
- ✅ Messaging & Real-time Updates
- ✅ Candidate Pipeline Management
- ✅ Workflow Creation & Execution
- ✅ Voice/Video Calls
- ✅ File Sharing

## Test Utilities

### Mock Data Factory
```typescript
// server/__tests__/utils/mockData.ts
export const mockUsers = {
  admin: { id: 'admin-1', email: 'admin@test.com', isAdmin: true },
  regular: { id: 'user-1', email: 'user@test.com', isAdmin: false }
};

export const mockChannels = {
  general: { id: 'ch-1', name: 'general', tier: 'NON_LICENSED' },
  florida: { id: 'ch-2', name: 'florida', tier: 'FL_LICENSED' }
};
```

### Test Database Helper
```typescript
// server/__tests__/utils/testHelpers.ts
export class TestDatabase {
  async setup() {
    // Initialize test database
  }
  
  async seed() {
    // Seed with test data
  }
  
  async cleanup() {
    // Clean up after tests
  }
}
```

### Test Factory
```typescript
export class TestFactory {
  static createWorkflow(overrides = {}) {
    return {
      id: `workflow-${Date.now()}`,
      name: 'Test Workflow',
      status: 'active',
      ...overrides
    };
  }
  
  static createCandidate(overrides = {}) {
    return {
      id: `candidate-${Date.now()}`,
      name: 'Test Candidate',
      email: 'test@example.com',
      ...overrides
    };
  }
}
```

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run unit tests
        run: npx jest --config jest.config.js --testPathPattern=__tests__ --coverage
      
      - name: Run integration tests
        run: npx jest --config jest.config.js --testPathPattern=integration --runInBand
      
      - name: Run E2E tests
        run: npx playwright test
      
      - name: Upload coverage
        uses: codecov/codecov-action@v2
```

## Best Practices

### 1. Test Naming
- Use descriptive test names that explain what is being tested
- Follow the pattern: "should [expected behavior] when [condition]"

### 2. Test Organization
- Group related tests using `describe` blocks
- Keep tests focused on a single behavior
- Use `beforeEach` and `afterEach` for setup/teardown

### 3. Test Data
- Use factories for creating test data
- Keep test data realistic but minimal
- Clean up test data after each test

### 4. Mocking
- Mock external dependencies (APIs, databases)
- Use dependency injection for easier testing
- Keep mocks simple and focused

### 5. Assertions
- Use specific assertions (`toBe`, `toEqual`, `toContain`)
- Test both success and failure cases
- Verify side effects (database changes, events)

### 6. Performance
- Run integration tests sequentially (`--runInBand`)
- Use parallel execution for unit tests
- Optimize database setup/teardown

## Troubleshooting

### Common Issues

#### Tests Failing Locally
```bash
# Clear Jest cache
npx jest --clearCache

# Check Node version
node --version # Should be 20+

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

#### E2E Tests Timing Out
```bash
# Increase timeout in playwright.config.ts
timeout: 60000, // 60 seconds

# Run with extended timeout
npx playwright test --timeout=60000
```

#### Database Connection Issues
```bash
# Check DATABASE_URL is set
echo $DATABASE_URL

# Reset test database
npm run db:push --force
```

## Continuous Improvement

### Monthly Tasks
- Review test coverage reports
- Update test fixtures with new data patterns
- Refactor slow tests
- Add tests for new features

### Quarterly Tasks
- Performance testing review
- Security testing audit
- Load testing for critical paths
- Test infrastructure updates

## Resources
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro)
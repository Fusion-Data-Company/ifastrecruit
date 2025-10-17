import { test, expect, Page } from '@playwright/test';
import { testWorkflows } from './fixtures/testData';

async function login(page: Page) {
  await page.goto('/login');
  await page.fill('[data-testid="input-email"]', 'admin@example.com');
  await page.fill('[data-testid="input-password"]', 'password123');
  await page.click('[data-testid="button-submit"]');
  await page.waitForURL('**/dashboard');
}

test.describe('Workflow Management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/workflows');
  });

  test('should display workflow list', async ({ page }) => {
    await expect(page.locator('[data-testid="workflows-list"]')).toBeVisible();
    await expect(page.locator('[data-testid="button-create-workflow"]')).toBeVisible();
  });

  test('should create manual workflow', async ({ page }) => {
    // Open create workflow dialog
    await page.click('[data-testid="button-create-workflow"]');
    
    // Fill workflow details
    const workflowName = `Test Workflow ${Date.now()}`;
    await page.fill('[data-testid="input-workflow-name"]', workflowName);
    await page.fill('[data-testid="textarea-workflow-description"]', 'Test workflow description');
    
    // Select trigger type
    await page.selectOption('[data-testid="select-trigger-type"]', 'manual');
    
    // Add actions
    await page.click('[data-testid="button-add-action"]');
    
    // Configure send message action
    await page.selectOption('[data-testid="select-action-type"]', 'send_message');
    await page.selectOption('[data-testid="select-channel"]', 'general');
    await page.fill('[data-testid="input-message-content"]', 'Workflow executed successfully');
    
    // Save workflow
    await page.click('[data-testid="button-save-workflow"]');
    
    // Verify workflow created
    await expect(page.locator(`[data-testid="workflow-card"]:has-text("${workflowName}")`)).toBeVisible();
  });

  test('should create event-triggered workflow', async ({ page }) => {
    // Open create workflow dialog
    await page.click('[data-testid="button-create-workflow"]');
    
    // Fill basic details
    await page.fill('[data-testid="input-workflow-name"]', 'Candidate Welcome Flow');
    await page.fill('[data-testid="textarea-workflow-description"]', 'Automated welcome for new candidates');
    
    // Select event trigger
    await page.selectOption('[data-testid="select-trigger-type"]', 'event');
    await page.selectOption('[data-testid="select-trigger-event"]', 'candidate_created');
    
    // Add email action
    await page.click('[data-testid="button-add-action"]');
    await page.selectOption('[data-testid="select-action-type"]', 'send_email');
    await page.selectOption('[data-testid="select-email-template"]', 'welcome');
    await page.fill('[data-testid="input-email-to"]', '{{candidate.email}}');
    
    // Add delay
    await page.click('[data-testid="button-add-action"]');
    await page.selectOption('[data-testid="select-action-type-1"]', 'delay');
    await page.fill('[data-testid="input-delay-seconds"]', '3600');
    
    // Add follow-up message
    await page.click('[data-testid="button-add-action"]');
    await page.selectOption('[data-testid="select-action-type-2"]', 'send_message');
    await page.selectOption('[data-testid="select-channel-2"]', 'hr-team');
    await page.fill('[data-testid="input-message-content-2"]', 'New candidate {{candidate.name}} has been welcomed');
    
    // Save workflow
    await page.click('[data-testid="button-save-workflow"]');
    
    // Verify workflow created
    await expect(page.locator('[data-testid="workflow-card"]:has-text("Candidate Welcome Flow")')).toBeVisible();
  });

  test('should execute manual workflow', async ({ page }) => {
    // Find or create a manual workflow
    const workflowCard = page.locator('[data-testid="workflow-card"]').filter({ hasText: 'Manual' }).first();
    
    // Click execute button
    await workflowCard.locator('[data-testid="button-execute"]').click();
    
    // Confirm execution
    await page.click('[data-testid="button-confirm-execute"]');
    
    // Verify execution started
    await expect(page.locator('[data-testid="toast-success"]')).toContainText('Workflow executed');
    
    // Check execution history
    await workflowCard.click();
    await page.click('[data-testid="tab-history"]');
    
    await expect(page.locator('[data-testid="execution-item"]').first()).toContainText('Running');
  });

  test('should edit workflow', async ({ page }) => {
    // Click on first workflow
    await page.click('[data-testid="workflow-card"]', { index: 0 });
    
    // Click edit button
    await page.click('[data-testid="button-edit-workflow"]');
    
    // Update description
    const newDescription = `Updated description ${Date.now()}`;
    await page.fill('[data-testid="textarea-workflow-description"]', newDescription);
    
    // Add new action
    await page.click('[data-testid="button-add-action"]');
    await page.selectOption('[data-testid="select-action-type-new"]', 'api_call');
    await page.fill('[data-testid="input-api-url"]', 'https://api.example.com/webhook');
    await page.selectOption('[data-testid="select-api-method"]', 'POST');
    
    // Save changes
    await page.click('[data-testid="button-save-changes"]');
    
    // Verify changes saved
    await expect(page.locator('[data-testid="text-workflow-description"]')).toContainText(newDescription);
  });

  test('should use conditional actions', async ({ page }) => {
    // Create new workflow
    await page.click('[data-testid="button-create-workflow"]');
    
    await page.fill('[data-testid="input-workflow-name"]', 'Conditional Workflow');
    await page.selectOption('[data-testid="select-trigger-type"]', 'manual');
    
    // Add condition action
    await page.click('[data-testid="button-add-action"]');
    await page.selectOption('[data-testid="select-action-type"]', 'condition');
    
    // Set condition
    await page.fill('[data-testid="input-condition"]', 'score > 90');
    
    // Add true branch action
    await page.click('[data-testid="button-add-true-action"]');
    await page.selectOption('[data-testid="select-true-action-type"]', 'send_email');
    await page.selectOption('[data-testid="select-email-template-true"]', 'high_performer');
    
    // Add false branch action
    await page.click('[data-testid="button-add-false-action"]');
    await page.selectOption('[data-testid="select-false-action-type"]', 'send_email');
    await page.selectOption('[data-testid="select-email-template-false"]', 'standard_review');
    
    // Save workflow
    await page.click('[data-testid="button-save-workflow"]');
    
    // Verify workflow created with conditions
    await expect(page.locator('[data-testid="workflow-card"]:has-text("Conditional Workflow")')).toBeVisible();
  });

  test('should disable/enable workflow', async ({ page }) => {
    // Find active workflow
    const workflowCard = page.locator('[data-testid="workflow-card"]').first();
    
    // Toggle workflow status
    await workflowCard.locator('[data-testid="switch-workflow-status"]').click();
    
    // Verify status changed
    await expect(workflowCard.locator('[data-testid="badge-status"]')).toContainText('Inactive');
    
    // Re-enable
    await workflowCard.locator('[data-testid="switch-workflow-status"]').click();
    await expect(workflowCard.locator('[data-testid="badge-status"]')).toContainText('Active');
  });

  test('should view workflow execution history', async ({ page }) => {
    // Click on workflow with executions
    await page.click('[data-testid="workflow-card"]', { index: 0 });
    
    // Go to history tab
    await page.click('[data-testid="tab-history"]');
    
    // Verify history table
    await expect(page.locator('[data-testid="history-table"]')).toBeVisible();
    
    // Click on execution to view details
    await page.click('[data-testid="execution-item"]', { index: 0 });
    
    // Verify execution details
    await expect(page.locator('[data-testid="execution-details"]')).toBeVisible();
    await expect(page.locator('[data-testid="execution-log"]')).toBeVisible();
  });

  test('should duplicate workflow', async ({ page }) => {
    // Find workflow to duplicate
    const originalWorkflow = page.locator('[data-testid="workflow-card"]').first();
    const originalName = await originalWorkflow.locator('[data-testid="text-workflow-name"]').textContent();
    
    // Open actions menu
    await originalWorkflow.locator('[data-testid="button-workflow-menu"]').click();
    
    // Click duplicate
    await page.click('[data-testid="button-duplicate-workflow"]');
    
    // Modify name in duplicate dialog
    const duplicateName = `${originalName} (Copy) ${Date.now()}`;
    await page.fill('[data-testid="input-duplicate-name"]', duplicateName);
    
    // Confirm duplicate
    await page.click('[data-testid="button-confirm-duplicate"]');
    
    // Verify duplicate created
    await expect(page.locator(`[data-testid="workflow-card"]:has-text("${duplicateName}")`)).toBeVisible();
  });

  test('should delete workflow', async ({ page }) => {
    // Create a workflow to delete
    await page.click('[data-testid="button-create-workflow"]');
    const workflowName = `To Delete ${Date.now()}`;
    await page.fill('[data-testid="input-workflow-name"]', workflowName);
    await page.selectOption('[data-testid="select-trigger-type"]', 'manual');
    await page.click('[data-testid="button-save-workflow"]');
    
    // Find the created workflow
    const workflowCard = page.locator(`[data-testid="workflow-card"]:has-text("${workflowName}")`);
    
    // Open menu and delete
    await workflowCard.locator('[data-testid="button-workflow-menu"]').click();
    await page.click('[data-testid="button-delete-workflow"]');
    
    // Confirm deletion
    await page.click('[data-testid="button-confirm-delete"]');
    
    // Verify workflow removed
    await expect(workflowCard).not.toBeVisible();
  });
});

test.describe('Workflow Templates', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/workflows');
  });

  test('should browse workflow templates', async ({ page }) => {
    // Open templates gallery
    await page.click('[data-testid="button-browse-templates"]');
    
    // Verify templates displayed
    await expect(page.locator('[data-testid="template-gallery"]')).toBeVisible();
    await expect(page.locator('[data-testid="template-card"]').first()).toBeVisible();
  });

  test('should use workflow template', async ({ page }) => {
    // Open templates
    await page.click('[data-testid="button-browse-templates"]');
    
    // Select a template
    const templateCard = page.locator('[data-testid="template-card"]').first();
    await templateCard.click();
    
    // View template details
    await expect(page.locator('[data-testid="template-preview"]')).toBeVisible();
    
    // Use template
    await page.click('[data-testid="button-use-template"]');
    
    // Customize template
    const customName = `From Template ${Date.now()}`;
    await page.fill('[data-testid="input-workflow-name"]', customName);
    
    // Save customized workflow
    await page.click('[data-testid="button-save-workflow"]');
    
    // Verify workflow created from template
    await expect(page.locator(`[data-testid="workflow-card"]:has-text("${customName}")`)).toBeVisible();
  });
});
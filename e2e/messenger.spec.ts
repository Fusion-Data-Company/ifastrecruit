import { test, expect, Page } from '@playwright/test';

// Helper function to login
async function login(page: Page, email: string = 'test@example.com') {
  await page.goto('/login');
  await page.fill('[data-testid="input-email"]', email);
  await page.fill('[data-testid="input-password"]', 'password123');
  await page.click('[data-testid="button-submit"]');
  await page.waitForURL('**/messenger');
}

test.describe('Messenger Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should display messenger interface', async ({ page }) => {
    // Verify main components are visible
    await expect(page.locator('[data-testid="sidebar-channels"]')).toBeVisible();
    await expect(page.locator('[data-testid="message-area"]')).toBeVisible();
    await expect(page.locator('[data-testid="input-message"]')).toBeVisible();
  });

  test('should send a message in channel', async ({ page }) => {
    // Select a channel
    await page.click('[data-testid="channel-general"]');
    
    // Type message
    const messageText = `Test message ${Date.now()}`;
    await page.fill('[data-testid="input-message"]', messageText);
    
    // Send message
    await page.click('[data-testid="button-send"]');
    
    // Verify message appears
    const message = page.locator(`[data-testid="message"]:has-text("${messageText}")`);
    await expect(message).toBeVisible();
    await expect(message).toContainText(messageText);
  });

  test('should edit a message', async ({ page }) => {
    // Send a message first
    const originalMessage = `Original message ${Date.now()}`;
    await page.fill('[data-testid="input-message"]', originalMessage);
    await page.click('[data-testid="button-send"]');
    
    // Wait for message to appear
    const message = page.locator(`[data-testid="message"]:has-text("${originalMessage}")`);
    await expect(message).toBeVisible();
    
    // Open message menu
    await message.hover();
    await page.click('[data-testid="button-message-menu"]');
    
    // Click edit
    await page.click('[data-testid="button-edit-message"]');
    
    // Edit the message
    const editedMessage = `Edited message ${Date.now()}`;
    await page.fill('[data-testid="input-edit-message"]', editedMessage);
    await page.click('[data-testid="button-save-edit"]');
    
    // Verify message is updated
    await expect(message).toContainText(editedMessage);
    await expect(message.locator('[data-testid="badge-edited"]')).toBeVisible();
  });

  test('should delete a message', async ({ page }) => {
    // Send a message first
    const messageText = `To be deleted ${Date.now()}`;
    await page.fill('[data-testid="input-message"]', messageText);
    await page.click('[data-testid="button-send"]');
    
    // Wait for message
    const message = page.locator(`[data-testid="message"]:has-text("${messageText}")`);
    await expect(message).toBeVisible();
    
    // Delete message
    await message.hover();
    await page.click('[data-testid="button-message-menu"]');
    await page.click('[data-testid="button-delete-message"]');
    
    // Confirm deletion
    await page.click('[data-testid="button-confirm-delete"]');
    
    // Verify message is removed
    await expect(message).not.toBeVisible();
  });

  test('should create a new channel', async ({ page }) => {
    // Click create channel button
    await page.click('[data-testid="button-create-channel"]');
    
    // Fill channel details
    const channelName = `test-channel-${Date.now()}`;
    await page.fill('[data-testid="input-channel-name"]', channelName);
    await page.fill('[data-testid="input-channel-description"]', 'Test channel description');
    await page.selectOption('[data-testid="select-channel-tier"]', 'NON_LICENSED');
    
    // Create channel
    await page.click('[data-testid="button-create"]');
    
    // Verify channel appears in sidebar
    await expect(page.locator(`[data-testid="channel-${channelName}"]`)).toBeVisible();
  });

  test('should send direct message', async ({ page }) => {
    // Click DM section
    await page.click('[data-testid="button-direct-messages"]');
    
    // Select a user
    await page.click('[data-testid="dm-user-john"]');
    
    // Send message
    const dmText = `Direct message ${Date.now()}`;
    await page.fill('[data-testid="input-message"]', dmText);
    await page.click('[data-testid="button-send"]');
    
    // Verify message appears
    await expect(page.locator(`[data-testid="message"]:has-text("${dmText}")`)).toBeVisible();
  });

  test('should upload a file', async ({ page }) => {
    // Click file upload button
    await page.click('[data-testid="button-attach-file"]');
    
    // Upload file
    const fileInput = page.locator('[data-testid="input-file-upload"]');
    await fileInput.setInputFiles('fixtures/test-document.pdf');
    
    // Wait for upload to complete
    await expect(page.locator('[data-testid="file-preview"]')).toBeVisible();
    
    // Send message with file
    await page.fill('[data-testid="input-message"]', 'Here is the document');
    await page.click('[data-testid="button-send"]');
    
    // Verify file attachment appears
    await expect(page.locator('[data-testid="file-attachment"]')).toBeVisible();
  });

  test('should show typing indicator', async ({ page, context }) => {
    // Open second browser context for second user
    const page2 = await context.newPage();
    await login(page2, 'user2@example.com');
    
    // Both users join same channel
    await page.click('[data-testid="channel-general"]');
    await page2.click('[data-testid="channel-general"]');
    
    // User 2 starts typing
    await page2.fill('[data-testid="input-message"]', 'Typing...');
    
    // User 1 should see typing indicator
    await expect(page.locator('[data-testid="typing-indicator"]')).toBeVisible();
    await expect(page.locator('[data-testid="typing-indicator"]')).toContainText('user2 is typing');
    
    // Close second page
    await page2.close();
  });

  test('should add reaction to message', async ({ page }) => {
    // Send a message
    const messageText = `React to this ${Date.now()}`;
    await page.fill('[data-testid="input-message"]', messageText);
    await page.click('[data-testid="button-send"]');
    
    // Find the message
    const message = page.locator(`[data-testid="message"]:has-text("${messageText}")`);
    
    // Add reaction
    await message.hover();
    await page.click('[data-testid="button-add-reaction"]');
    await page.click('[data-testid="emoji-👍"]');
    
    // Verify reaction appears
    await expect(message.locator('[data-testid="reaction-👍"]')).toBeVisible();
  });

  test('should search messages', async ({ page }) => {
    // Open search
    await page.click('[data-testid="button-search"]');
    
    // Enter search query
    await page.fill('[data-testid="input-search"]', 'test message');
    await page.press('[data-testid="input-search"]', 'Enter');
    
    // Verify search results
    await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
    await expect(page.locator('[data-testid="search-result-item"]').first()).toBeVisible();
  });

  test('should create thread reply', async ({ page }) => {
    // Send initial message
    const messageText = `Thread starter ${Date.now()}`;
    await page.fill('[data-testid="input-message"]', messageText);
    await page.click('[data-testid="button-send"]');
    
    // Find message and start thread
    const message = page.locator(`[data-testid="message"]:has-text("${messageText}")`);
    await message.hover();
    await page.click('[data-testid="button-reply-thread"]');
    
    // Thread panel should open
    await expect(page.locator('[data-testid="thread-panel"]')).toBeVisible();
    
    // Send thread reply
    const replyText = `Thread reply ${Date.now()}`;
    await page.fill('[data-testid="input-thread-reply"]', replyText);
    await page.click('[data-testid="button-send-reply"]');
    
    // Verify reply appears in thread
    await expect(page.locator(`[data-testid="thread-message"]:has-text("${replyText}")`)).toBeVisible();
    
    // Verify thread count on original message
    await expect(message.locator('[data-testid="thread-count"]')).toContainText('1 reply');
  });
});

test.describe('Channel Management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should browse and join channels', async ({ page }) => {
    // Open channel browser
    await page.click('[data-testid="button-browse-channels"]');
    
    // Search for channel
    await page.fill('[data-testid="input-search-channels"]', 'florida');
    
    // Join channel
    const channelCard = page.locator('[data-testid="channel-card-florida"]');
    await channelCard.locator('[data-testid="button-join"]').click();
    
    // Verify joined
    await expect(channelCard.locator('[data-testid="badge-joined"]')).toBeVisible();
    
    // Close browser
    await page.click('[data-testid="button-close-browser"]');
    
    // Verify channel appears in sidebar
    await expect(page.locator('[data-testid="channel-florida"]')).toBeVisible();
  });

  test('should manage channel settings', async ({ page }) => {
    // Select channel
    await page.click('[data-testid="channel-general"]');
    
    // Open channel settings
    await page.click('[data-testid="button-channel-info"]');
    await page.click('[data-testid="tab-settings"]');
    
    // Update channel description
    const newDescription = `Updated description ${Date.now()}`;
    await page.fill('[data-testid="input-channel-description"]', newDescription);
    await page.click('[data-testid="button-save-settings"]');
    
    // Verify settings saved
    await expect(page.locator('[data-testid="toast-success"]')).toContainText('Settings saved');
    
    // Reload and verify persistence
    await page.reload();
    await page.click('[data-testid="channel-general"]');
    await page.click('[data-testid="button-channel-info"]');
    
    await expect(page.locator('[data-testid="text-channel-description"]')).toContainText(newDescription);
  });
});
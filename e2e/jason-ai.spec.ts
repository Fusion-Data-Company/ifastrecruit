import { test, expect } from '@playwright/test';

test.describe('Jason AI Integration', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to messenger
    await page.goto('/messenger');

    // Wait for authentication and connection
    await page.waitForSelector('[data-testid="messenger-loaded"]', { timeout: 10000 });
  });

  test('should display Jason AI in users list', async ({ page }) => {
    // Check if Jason appears in DM users list
    await page.click('[data-testid="dm-tab"]');
    await expect(page.locator('text=Jason')).toBeVisible({ timeout: 5000 });
  });

  test('should respond to @Jason mention in channel', async ({ page }) => {
    // Select general channel
    await page.click('[data-testid="channel-general"]');

    // Type message with @Jason mention
    const messageInput = page.locator('[data-testid="message-input"]');
    await messageInput.fill('@Jason Hello! Can you help me understand licensing?');
    await page.click('[data-testid="send-button"]');

    // Wait for Jason's typing indicator
    await expect(page.locator('text=Jason is typing')).toBeVisible({ timeout: 3000 });

    // Wait for Jason's response (max 35 seconds for AI generation)
    await expect(page.locator('[data-testid="ai-message"]')).toBeVisible({ timeout: 35000 });

    // Verify response contains relevant information
    const aiMessage = await page.locator('[data-testid="ai-message"]').first().textContent();
    expect(aiMessage).toMatch(/licens/i); // Should mention licensing
  });

  test('should show AI badge on Jason messages', async ({ page }) => {
    await page.click('[data-testid="channel-general"]');

    // Send @mention
    await page.fill('[data-testid="message-input"]', '@Jason test');
    await page.click('[data-testid="send-button"]');

    // Wait for response
    await page.waitForSelector('[data-testid="ai-message"]', { timeout: 35000 });

    // Check for AI badge
    await expect(page.locator('text=AI Assistant')).toBeVisible();
  });

  test('should respond to DM sent to Jason', async ({ page }) => {
    // Open DM with Jason
    await page.click('[data-testid="dm-tab"]');
    await page.click('[data-testid="dm-user-jason"]');

    // Send DM
    const dmInput = page.locator('[data-testid="dm-input"]');
    await dmInput.fill('Hi Jason, what is the cost of licensing?');
    await page.click('[data-testid="send-dm-button"]');

    // Wait for response
    await expect(page.locator('[data-testid="dm-message-ai"]')).toBeVisible({ timeout: 35000 });

    // Verify mentions costs
    const response = await page.locator('[data-testid="dm-message-ai"]').first().textContent();
    expect(response).toMatch(/\$55|\$70|\$44/); // Should mention specific costs
  });

  test('should respect rate limiting', async ({ page }) => {
    await page.click('[data-testid="channel-general"]');

    // Send 11 messages quickly (limit is 10/min)
    for (let i = 0; i < 11; i++) {
      await page.fill('[data-testid="message-input"]', `@Jason Message ${i}`);
      await page.click('[data-testid="send-button"]');
      await page.waitForTimeout(100);
    }

    // Should see rate limit error toast
    await expect(page.locator('.toast:has-text("rate limit")')).toBeVisible({ timeout: 5000 });
  });

  test('should handle connection loss gracefully', async ({ page }) => {
    // Disconnect network
    await page.context().setOffline(true);

    // Should show disconnected banner
    await expect(page.locator('text=Connection lost')).toBeVisible({ timeout: 5000 });

    // Reconnect
    await page.context().setOffline(false);

    // Should show connecting/connected
    await expect(page.locator('text=Connecting to messenger')).toBeVisible({ timeout: 2000 });
    await expect(page.locator('text=Connection lost')).not.toBeVisible({ timeout: 10000 });
  });
});

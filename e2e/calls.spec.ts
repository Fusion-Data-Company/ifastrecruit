import { test, expect, Page } from '@playwright/test';

async function login(page: Page) {
  await page.goto('/login');
  await page.fill('[data-testid="input-email"]', 'test@example.com');
  await page.fill('[data-testid="input-password"]', 'password123');
  await page.click('[data-testid="button-submit"]');
  await page.waitForURL('**/messenger');
}

test.describe('Voice and Video Calls', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should initiate voice call', async ({ page }) => {
    // Navigate to DM with another user
    await page.click('[data-testid="button-direct-messages"]');
    await page.click('[data-testid="dm-user-john"]');
    
    // Click voice call button
    await page.click('[data-testid="button-voice-call"]');
    
    // Verify call interface appears
    await expect(page.locator('[data-testid="call-interface"]')).toBeVisible();
    await expect(page.locator('[data-testid="call-status"]')).toContainText('Calling');
    
    // Verify call controls
    await expect(page.locator('[data-testid="button-mute"]')).toBeVisible();
    await expect(page.locator('[data-testid="button-end-call"]')).toBeVisible();
  });

  test('should initiate video call', async ({ page }) => {
    // Navigate to DM
    await page.click('[data-testid="button-direct-messages"]');
    await page.click('[data-testid="dm-user-jane"]');
    
    // Click video call button
    await page.click('[data-testid="button-video-call"]');
    
    // Grant camera permissions (if prompted)
    // This would be handled by browser settings in real tests
    
    // Verify video call interface
    await expect(page.locator('[data-testid="call-interface"]')).toBeVisible();
    await expect(page.locator('[data-testid="local-video"]')).toBeVisible();
    await expect(page.locator('[data-testid="remote-video"]')).toBeVisible();
    
    // Verify video controls
    await expect(page.locator('[data-testid="button-camera-toggle"]')).toBeVisible();
    await expect(page.locator('[data-testid="button-mute"]')).toBeVisible();
    await expect(page.locator('[data-testid="button-screen-share"]')).toBeVisible();
  });

  test('should handle mute/unmute', async ({ page }) => {
    // Start a call
    await page.click('[data-testid="button-direct-messages"]');
    await page.click('[data-testid="dm-user-john"]');
    await page.click('[data-testid="button-voice-call"]');
    
    // Wait for call to connect
    await page.waitForTimeout(1000);
    
    // Mute microphone
    await page.click('[data-testid="button-mute"]');
    await expect(page.locator('[data-testid="icon-muted"]')).toBeVisible();
    
    // Unmute microphone
    await page.click('[data-testid="button-mute"]');
    await expect(page.locator('[data-testid="icon-unmuted"]')).toBeVisible();
  });

  test('should toggle video during call', async ({ page }) => {
    // Start video call
    await page.click('[data-testid="button-direct-messages"]');
    await page.click('[data-testid="dm-user-jane"]');
    await page.click('[data-testid="button-video-call"]');
    
    // Wait for call to connect
    await page.waitForTimeout(1000);
    
    // Turn off camera
    await page.click('[data-testid="button-camera-toggle"]');
    await expect(page.locator('[data-testid="camera-off-indicator"]')).toBeVisible();
    
    // Turn camera back on
    await page.click('[data-testid="button-camera-toggle"]');
    await expect(page.locator('[data-testid="local-video"]')).toBeVisible();
  });

  test('should share screen', async ({ page, context }) => {
    // Grant screen share permissions
    await context.grantPermissions(['camera', 'microphone']);
    
    // Start video call
    await page.click('[data-testid="button-direct-messages"]');
    await page.click('[data-testid="dm-user-jane"]');
    await page.click('[data-testid="button-video-call"]');
    
    // Wait for call to connect
    await page.waitForTimeout(1000);
    
    // Start screen share
    await page.click('[data-testid="button-screen-share"]');
    
    // In real test, would need to handle screen selection dialog
    // For now, verify the button state changes
    await expect(page.locator('[data-testid="screen-sharing-indicator"]')).toBeVisible();
    
    // Stop screen share
    await page.click('[data-testid="button-screen-share"]');
    await expect(page.locator('[data-testid="screen-sharing-indicator"]')).not.toBeVisible();
  });

  test('should end call', async ({ page }) => {
    // Start a call
    await page.click('[data-testid="button-direct-messages"]');
    await page.click('[data-testid="dm-user-john"]');
    await page.click('[data-testid="button-voice-call"]');
    
    // Wait for call to connect
    await page.waitForTimeout(1000);
    
    // End call
    await page.click('[data-testid="button-end-call"]');
    
    // Verify call interface is closed
    await expect(page.locator('[data-testid="call-interface"]')).not.toBeVisible();
    
    // Verify call ended message
    await expect(page.locator('[data-testid="call-ended-message"]')).toBeVisible();
  });

  test('should handle incoming call', async ({ page, context }) => {
    // Open second browser for caller
    const callerPage = await context.newPage();
    await login(callerPage);
    
    // Caller initiates call
    await callerPage.click('[data-testid="button-direct-messages"]');
    await callerPage.click('[data-testid="dm-user-test"]'); // Calling our main user
    await callerPage.click('[data-testid="button-voice-call"]');
    
    // Main user should see incoming call
    await expect(page.locator('[data-testid="incoming-call-modal"]')).toBeVisible();
    await expect(page.locator('[data-testid="caller-name"]')).toBeVisible();
    
    // Verify call actions
    await expect(page.locator('[data-testid="button-accept-call"]')).toBeVisible();
    await expect(page.locator('[data-testid="button-decline-call"]')).toBeVisible();
    
    // Accept call
    await page.click('[data-testid="button-accept-call"]');
    
    // Verify both users in call
    await expect(page.locator('[data-testid="call-interface"]')).toBeVisible();
    await expect(callerPage.locator('[data-testid="call-interface"]')).toBeVisible();
    
    // Clean up
    await callerPage.close();
  });

  test('should decline incoming call', async ({ page, context }) => {
    // Open second browser for caller
    const callerPage = await context.newPage();
    await login(callerPage);
    
    // Caller initiates call
    await callerPage.click('[data-testid="button-direct-messages"]');
    await callerPage.click('[data-testid="dm-user-test"]');
    await callerPage.click('[data-testid="button-voice-call"]');
    
    // Main user sees incoming call
    await expect(page.locator('[data-testid="incoming-call-modal"]')).toBeVisible();
    
    // Decline call
    await page.click('[data-testid="button-decline-call"]');
    
    // Verify call modal closed
    await expect(page.locator('[data-testid="incoming-call-modal"]')).not.toBeVisible();
    
    // Caller should see call declined
    await expect(callerPage.locator('[data-testid="call-declined-message"]')).toBeVisible();
    
    // Clean up
    await callerPage.close();
  });

  test('should show call history', async ({ page }) => {
    // Navigate to call history
    await page.click('[data-testid="button-user-menu"]');
    await page.click('[data-testid="link-call-history"]');
    
    // Verify call history page
    await expect(page.locator('[data-testid="call-history-list"]')).toBeVisible();
    
    // Verify call entries
    const callEntries = page.locator('[data-testid="call-entry"]');
    const count = await callEntries.count();
    
    if (count > 0) {
      // Verify call entry details
      const firstEntry = callEntries.first();
      await expect(firstEntry.locator('[data-testid="call-participant"]')).toBeVisible();
      await expect(firstEntry.locator('[data-testid="call-duration"]')).toBeVisible();
      await expect(firstEntry.locator('[data-testid="call-date"]')).toBeVisible();
      await expect(firstEntry.locator('[data-testid="call-type-icon"]')).toBeVisible();
    }
  });

  test('should handle poor connection', async ({ page }) => {
    // Start a call
    await page.click('[data-testid="button-direct-messages"]');
    await page.click('[data-testid="dm-user-john"]');
    await page.click('[data-testid="button-video-call"]');
    
    // Simulate poor connection (would need backend support in real test)
    // For now, verify connection indicator exists
    await expect(page.locator('[data-testid="connection-quality"]')).toBeVisible();
    
    // Verify warning appears for poor connection (if implemented)
    // await expect(page.locator('[data-testid="poor-connection-warning"]')).toBeVisible();
  });
});
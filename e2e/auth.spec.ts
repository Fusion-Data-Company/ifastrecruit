import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display login page', async ({ page }) => {
    await expect(page).toHaveTitle(/iFast/);
    await expect(page.locator('[data-testid="sign-in-form"]')).toBeVisible();
  });

  test('should login with valid credentials', async ({ page }) => {
    // Fill login form
    await page.fill('[data-testid="input-email"]', 'test@example.com');
    await page.fill('[data-testid="input-password"]', 'password123');
    
    // Submit form
    await page.click('[data-testid="button-submit"]');
    
    // Wait for redirect to dashboard
    await page.waitForURL('**/dashboard');
    
    // Verify user is logged in
    await expect(page.locator('[data-testid="user-avatar"]')).toBeVisible();
    await expect(page.locator('[data-testid="text-username"]')).toContainText('test@example.com');
  });

  test('should show error for invalid credentials', async ({ page }) => {
    // Fill login form with invalid credentials
    await page.fill('[data-testid="input-email"]', 'invalid@example.com');
    await page.fill('[data-testid="input-password"]', 'wrongpassword');
    
    // Submit form
    await page.click('[data-testid="button-submit"]');
    
    // Verify error message
    await expect(page.locator('[data-testid="alert-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="alert-error"]')).toContainText('Invalid credentials');
  });

  test('should complete onboarding flow', async ({ page }) => {
    // Login first
    await page.fill('[data-testid="input-email"]', 'newuser@example.com');
    await page.fill('[data-testid="input-password"]', 'password123');
    await page.click('[data-testid="button-submit"]');
    
    // Wait for onboarding modal
    await expect(page.locator('[data-testid="modal-onboarding"]')).toBeVisible();
    
    // Step 1: Basic Info
    await page.fill('[data-testid="input-firstname"]', 'John');
    await page.fill('[data-testid="input-lastname"]', 'Doe');
    await page.fill('[data-testid="input-phone"]', '555-1234');
    await page.click('[data-testid="button-next"]');
    
    // Step 2: License Info
    await page.check('[data-testid="checkbox-florida-license"]');
    await page.click('[data-testid="button-next"]');
    
    // Step 3: File Uploads
    const resumeInput = page.locator('[data-testid="input-resume"]');
    await resumeInput.setInputFiles('fixtures/sample-resume.pdf');
    await page.click('[data-testid="button-next"]');
    
    // Step 4: Complete
    await page.click('[data-testid="button-complete"]');
    
    // Verify onboarding complete
    await page.waitForURL('**/messenger');
    await expect(page.locator('[data-testid="modal-onboarding"]')).not.toBeVisible();
  });

  test('should logout successfully', async ({ page }) => {
    // Login first
    await page.fill('[data-testid="input-email"]', 'test@example.com');
    await page.fill('[data-testid="input-password"]', 'password123');
    await page.click('[data-testid="button-submit"]');
    await page.waitForURL('**/dashboard');
    
    // Click user menu
    await page.click('[data-testid="button-user-menu"]');
    
    // Click logout
    await page.click('[data-testid="button-logout"]');
    
    // Verify redirected to login
    await page.waitForURL('**/login');
    await expect(page.locator('[data-testid="sign-in-form"]')).toBeVisible();
  });

  test('should handle session expiry', async ({ page, context }) => {
    // Login
    await page.fill('[data-testid="input-email"]', 'test@example.com');
    await page.fill('[data-testid="input-password"]', 'password123');
    await page.click('[data-testid="button-submit"]');
    await page.waitForURL('**/dashboard');
    
    // Clear cookies to simulate session expiry
    await context.clearCookies();
    
    // Try to navigate to protected page
    await page.goto('/messenger');
    
    // Should redirect to login
    await page.waitForURL('**/login');
    await expect(page.locator('[data-testid="sign-in-form"]')).toBeVisible();
  });
});
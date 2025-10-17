import { test, expect, Page } from '@playwright/test';

async function login(page: Page) {
  await page.goto('/login');
  await page.fill('[data-testid="input-email"]', 'admin@example.com');
  await page.fill('[data-testid="input-password"]', 'password123');
  await page.click('[data-testid="button-submit"]');
  await page.waitForURL('**/dashboard');
}

test.describe('Candidate Management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/candidates');
  });

  test('should display candidates list', async ({ page }) => {
    // Verify table is visible
    await expect(page.locator('[data-testid="candidates-table"]')).toBeVisible();
    
    // Verify columns
    await expect(page.locator('th:has-text("Name")')).toBeVisible();
    await expect(page.locator('th:has-text("Email")')).toBeVisible();
    await expect(page.locator('th:has-text("Pipeline Stage")')).toBeVisible();
    await expect(page.locator('th:has-text("Score")')).toBeVisible();
  });

  test('should add new candidate', async ({ page }) => {
    // Open add candidate dialog
    await page.click('[data-testid="button-add-candidate"]');
    
    // Fill candidate details
    const candidateName = `Test Candidate ${Date.now()}`;
    await page.fill('[data-testid="input-candidate-name"]', candidateName);
    await page.fill('[data-testid="input-candidate-email"]', `test${Date.now()}@example.com`);
    await page.fill('[data-testid="input-candidate-phone"]', '555-1234');
    await page.selectOption('[data-testid="select-pipeline-stage"]', 'NEW');
    await page.fill('[data-testid="input-score"]', '85');
    
    // Upload resume
    const resumeInput = page.locator('[data-testid="input-resume"]');
    await resumeInput.setInputFiles('fixtures/sample-resume.pdf');
    
    // Save candidate
    await page.click('[data-testid="button-save-candidate"]');
    
    // Verify candidate appears in list
    await expect(page.locator(`[data-testid="candidate-row"]:has-text("${candidateName}")`)).toBeVisible();
  });

  test('should edit candidate details', async ({ page }) => {
    // Click on first candidate row
    await page.click('[data-testid="candidate-row"]', { index: 0 });
    
    // Open edit dialog
    await page.click('[data-testid="button-edit-candidate"]');
    
    // Update details
    const updatedScore = '95';
    await page.fill('[data-testid="input-score"]', updatedScore);
    await page.selectOption('[data-testid="select-pipeline-stage"]', 'FIRST_INTERVIEW');
    
    // Add notes
    await page.fill('[data-testid="textarea-notes"]', 'Excellent communication skills');
    
    // Save changes
    await page.click('[data-testid="button-save-changes"]');
    
    // Verify changes
    await expect(page.locator('[data-testid="text-score"]')).toContainText(updatedScore);
    await expect(page.locator('[data-testid="badge-stage"]')).toContainText('First Interview');
  });

  test('should filter candidates', async ({ page }) => {
    // Filter by pipeline stage
    await page.selectOption('[data-testid="filter-pipeline-stage"]', 'NEW');
    
    // Verify filtered results
    const rows = page.locator('[data-testid="candidate-row"]');
    const count = await rows.count();
    
    for (let i = 0; i < count; i++) {
      await expect(rows.nth(i).locator('[data-testid="badge-stage"]')).toContainText('New');
    }
    
    // Filter by score range
    await page.fill('[data-testid="filter-score-min"]', '80');
    await page.fill('[data-testid="filter-score-max"]', '100');
    await page.click('[data-testid="button-apply-filters"]');
    
    // Verify scores in range
    const scoreElements = page.locator('[data-testid="text-score"]');
    const scoreCount = await scoreElements.count();
    
    for (let i = 0; i < scoreCount; i++) {
      const scoreText = await scoreElements.nth(i).textContent();
      const score = parseInt(scoreText || '0');
      expect(score).toBeGreaterThanOrEqual(80);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  test('should search candidates', async ({ page }) => {
    // Search by name
    await page.fill('[data-testid="input-search-candidates"]', 'John');
    await page.press('[data-testid="input-search-candidates"]', 'Enter');
    
    // Verify search results
    const results = page.locator('[data-testid="candidate-row"]');
    const count = await results.count();
    
    for (let i = 0; i < count; i++) {
      const text = await results.nth(i).textContent();
      expect(text?.toLowerCase()).toContain('john');
    }
  });

  test('should move candidate through pipeline', async ({ page }) => {
    // Click on candidate
    await page.click('[data-testid="candidate-row"]', { index: 0 });
    
    // Open pipeline actions
    await page.click('[data-testid="button-pipeline-actions"]');
    
    // Move to next stage
    await page.click('[data-testid="button-move-to-technical"]');
    
    // Confirm move
    await page.click('[data-testid="button-confirm-move"]');
    
    // Verify stage updated
    await expect(page.locator('[data-testid="badge-stage"]')).toContainText('Technical Screen');
    
    // Verify activity log
    await page.click('[data-testid="tab-activity"]');
    await expect(page.locator('[data-testid="activity-item"]').first()).toContainText('Moved to Technical Screen');
  });

  test('should bulk update candidates', async ({ page }) => {
    // Select multiple candidates
    await page.check('[data-testid="checkbox-select-all"]');
    
    // Open bulk actions
    await page.click('[data-testid="button-bulk-actions"]');
    
    // Select bulk update
    await page.click('[data-testid="button-bulk-update"]');
    
    // Update pipeline stage
    await page.selectOption('[data-testid="select-bulk-stage"]', 'REJECTED');
    
    // Add bulk note
    await page.fill('[data-testid="textarea-bulk-note"]', 'Not a good fit for current openings');
    
    // Apply bulk update
    await page.click('[data-testid="button-apply-bulk"]');
    
    // Confirm
    await page.click('[data-testid="button-confirm-bulk"]');
    
    // Verify all updated
    const stages = page.locator('[data-testid="badge-stage"]');
    const count = await stages.count();
    
    for (let i = 0; i < count; i++) {
      await expect(stages.nth(i)).toContainText('Rejected');
    }
  });

  test('should export candidates', async ({ page }) => {
    // Open export dialog
    await page.click('[data-testid="button-export"]');
    
    // Select export format
    await page.selectOption('[data-testid="select-export-format"]', 'csv');
    
    // Select fields to export
    await page.check('[data-testid="checkbox-export-name"]');
    await page.check('[data-testid="checkbox-export-email"]');
    await page.check('[data-testid="checkbox-export-stage"]');
    
    // Start export
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('[data-testid="button-start-export"]')
    ]);
    
    // Verify download
    expect(download.suggestedFilename()).toContain('candidates');
    expect(download.suggestedFilename()).toContain('.csv');
  });
});

test.describe('Interview Scheduling', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/candidates');
  });

  test('should schedule interview', async ({ page }) => {
    // Click on candidate
    await page.click('[data-testid="candidate-row"]', { index: 0 });
    
    // Click schedule interview
    await page.click('[data-testid="button-schedule-interview"]');
    
    // Fill interview details
    await page.selectOption('[data-testid="select-interview-type"]', 'FIRST_INTERVIEW');
    await page.fill('[data-testid="input-interview-date"]', '2024-02-01');
    await page.fill('[data-testid="input-interview-time"]', '14:00');
    await page.fill('[data-testid="input-duration"]', '60');
    
    // Add interviewers
    await page.click('[data-testid="input-interviewers"]');
    await page.click('[data-testid="option-interviewer-john"]');
    await page.click('[data-testid="option-interviewer-jane"]');
    
    // Add meeting link
    await page.fill('[data-testid="input-meeting-link"]', 'https://meet.example.com/interview');
    
    // Send invite
    await page.check('[data-testid="checkbox-send-invite"]');
    
    // Schedule
    await page.click('[data-testid="button-schedule"]');
    
    // Verify interview scheduled
    await expect(page.locator('[data-testid="toast-success"]')).toContainText('Interview scheduled');
    
    // Verify in calendar view
    await page.goto('/interviews');
    await expect(page.locator('[data-testid="interview-event"]')).toBeVisible();
  });
});
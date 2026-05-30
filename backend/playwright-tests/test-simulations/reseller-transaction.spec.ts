import { test, expect } from '@playwright/test';
import { appendEvidence, createTestUser, ensureEvidenceDirs, loginAsReseller, writeBugReport } from '../helpers/api';

test.describe('Reseller Transaction Simulation', () => {
  test('login as reseller, purchase a product, and verify transaction in dashboard', async ({ page, request }) => {
    await ensureEvidenceDirs();
    
    // Add page error logging
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`[Browser Console Error] ${msg.text()} at ${msg.location().url}:${msg.location().lineNumber}`);
      }
    });
    page.on('pageerror', err => {
      console.log(`[Browser Page Crash] ${err.message}\n${err.stack}`);
    });

    const findings: string[] = [];

    // 1. Create a reseller user
    const user = await createTestUser(request, 'reseller');
    findings.push(`created_reseller_user ${user.email}`);

    // 2. Login as reseller
    await loginAsReseller(page, user.email, user.password);
    
    // Log all console messages and network requests for debugging
    page.on('console', msg => {
      console.log(`[Browser Console ${msg.type().toUpperCase()}] ${msg.text()}`);
    });

    page.on('response', response => {
      const url = response.url();
      if (url.includes('/api/')) {
        console.log(`[Network Response] ${response.status()} ${response.request().method()} ${url}`);
      }
    });

    await expect(page.locator('text=Dashboard Member').first()).toBeVisible({ timeout: 15000 });
    findings.push(`logged_in_successfully`);

    // 3. Navigate to catalog page
    await page.goto('/catalog');
    findings.push(`catalog_loaded`);

    // Take screenshot of catalog page before click
    await page.screenshot({ path: 'test-results/before-click.png' });

    // 4. Select the first product card
    const firstProduct = page.locator('h4').first();
    await expect(firstProduct).toBeVisible({ timeout: 15000 });
    const productName = await firstProduct.textContent();
    findings.push(`selected_product ${productName}`);
    
    // Click the card containing the h4
    const productCard = page.locator('div').filter({ has: firstProduct }).filter({ hasText: /Harga/ }).first();
    await expect(productCard).toBeVisible({ timeout: 15000 });
    await productCard.click();
    await page.waitForTimeout(2000);

    // Take screenshot of catalog page after click
    await page.screenshot({ path: 'test-results/after-click.png' });

    // 5. Fill customer phone number in the checkout modal
    const phoneInput = page.locator('input[type="tel"]').first();
    await expect(phoneInput).toBeVisible({ timeout: 10000 });
    await phoneInput.fill('081234567890');
    
    // 6. Complete purchase
    const submitButton = page.getByRole('button', { name: /Complete Purchase|Bayar|Pesan/i });
    await submitButton.click();
    
    // 7. Verify redirection to invoice page
    await page.waitForURL(/\/invoice\//, { timeout: 25000 });
    const invoiceUrl = page.url();
    const invoiceCode = invoiceUrl.split('/').pop() || '';
    findings.push(`invoice_redirected_successfully ${invoiceCode}`);

    console.log(`[Diagnostic] LocalStorage at /invoice: token=${await page.evaluate(() => localStorage.getItem('auth_token'))}, session=${await page.evaluate(() => localStorage.getItem('bayarku.auth.session'))}`);

    // 8. Go back to dashboard and verify transaction history
    await page.goto('/dashboard');
    
    console.log(`[Diagnostic] LocalStorage at /dashboard (after reload): token=${await page.evaluate(() => localStorage.getItem('auth_token'))}, session=${await page.evaluate(() => localStorage.getItem('bayarku.auth.session'))}`);
    
    // Handle session loss: if login form appears, re-login
    const loginHeading = page.locator('text=Masuk untuk melihat dashboard').first();
    if (await loginHeading.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('[Diagnostic] Session lost on /dashboard navigation — re-logging in');
      await loginAsReseller(page, user.email, user.password);
    }
    
    // Wait for transactions to be loaded
    const transactionItem = page.locator(`text=${invoiceCode}`).first();
    await expect(transactionItem).toBeVisible({ timeout: 15000 });
    
    const bodyText = await page.locator('body').textContent();
    const containsInvoice = bodyText?.includes(invoiceCode) || false;
    findings.push(`dashboard_contains_invoice ${containsInvoice}`);

    // Record findings
    await appendEvidence('reseller-transaction.txt', [
      `simulation=reseller-transaction timestamp=${new Date().toISOString()}`,
      ...findings
    ]);

    if (!containsInvoice) {
      await writeBugReport('reseller-transaction-not-found.md', `# Reseller transaction was not found in dashboard\n\nUser: ${user.email}\nExpected Invoice: ${invoiceCode}\nDashboard URL: ${page.url()}`);
    }

    expect(containsInvoice).toBe(true);
  });
});

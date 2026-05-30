import { test, expect } from '@playwright/test';
import { appendEvidence, ensureEvidenceDirs, writeBugReport } from '../helpers/api';

test.describe('Digiflazz Sandbox E2E Simulation', () => {
  test('guest checkout with XL 10.000 Sandbox Test product and verify invoice redirection', async ({ page }) => {
    await ensureEvidenceDirs();
    
    // Add page error logging
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`[Browser Console Error] ${msg.text()} at ${msg.location().url}:${msg.location().lineNumber}`);
      } else {
        console.log(`[Browser Console ${msg.type().toUpperCase()}] ${msg.text()}`);
      }
    });
    page.on('pageerror', err => {
      console.log(`[Browser Page Crash] ${err.message}\n${err.stack}`);
    });

    page.on('response', response => {
      const url = response.url();
      if (url.includes('/api/')) {
        console.log(`[Network Response] ${response.status()} ${response.request().method()} ${url}`);
      }
    });

    const findings: string[] = [];

    // 1. Navigate to catalog page
    await page.goto('/catalog');
    findings.push('catalog_loaded');
    
    // 2. Locate the "XL 10.000 (Sandbox Test)" product card (visible immediately without search now)
    const firstProduct = page.locator('text=XL 10.000 (Sandbox Test)').first();
    await expect(firstProduct).toBeVisible({ timeout: 15000 });
    findings.push('found_sandbox_product');

    // Click the product name element directly (bubbles up to the product card onClick handler)
    await firstProduct.click();
    await page.waitForTimeout(2000);

    // Take screenshot after click to verify Checkout Modal is open
    await page.screenshot({ path: 'test-results/sandbox-checkout-modal.png' });

    // 4. Fill customer phone number in the checkout modal (Using the official Digiflazz success test-case number: 087800001230)
    const phoneInput = page.locator('input[type="tel"]').first();
    await expect(phoneInput).toBeVisible({ timeout: 10000 });
    await phoneInput.fill('087800001230');

    // 5. Click Complete Purchase
    const submitButton = page.getByRole('button', { name: /Complete Purchase|Bayar|Pesan/i });
    await submitButton.click();
    
    // 6. Verify redirection to invoice page
    await page.waitForURL(/\/invoice\//, { timeout: 30000 });
    const invoiceUrl = page.url();
    const invoiceCode = invoiceUrl.split('/').pop() || '';
    findings.push(`invoice_redirected_successfully ${invoiceCode}`);

    // Take screenshot of the invoice page
    await page.screenshot({ path: 'test-results/sandbox-invoice-page.png' });

    // 7. Check if invoice details render properly
    const invoiceCodeLocator = page.locator(`text=${invoiceCode}`).first();
    await expect(invoiceCodeLocator).toBeVisible({ timeout: 15000 });
    findings.push('invoice_details_rendered');

    // Append evidence
    await appendEvidence('digiflazz-sandbox-e2e.txt', [
      `simulation=digiflazz-sandbox timestamp=${new Date().toISOString()}`,
      ...findings
    ]);

    console.log(`[Success] E2E Digiflazz Sandbox checkout simulation passed! Invoice code: ${invoiceCode}`);
  });
});

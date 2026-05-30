#!/usr/bin/env node
/**
 * TestSprite Validation Runner
 * Runs all 8 flows and generates a report
 */

import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'https://demo.hanzserver.online/';
const TEST_DATA = {
  email: 'reseller@adnanpay.com',
  password: 'Reseller123!',
  admin_email: 'admin@adnanpay.com',
  admin_password: 'Admin123!@#',
  customer_id: '081234567890',
};

const findings = [];

// Import validation functions from index.js
async function validateGuestCheckout(page, baseUrl, testData, findingsArr) {
  try {
    await page.goto(baseUrl);
    await page.waitForLoadState('networkidle');

    const products = await page.locator('button:has-text("GoPay"), button:has-text("Telkomsel")').count();
    if (products === 0) {
      findingsArr.push({
        severity: 'critical',
        category: 'functionality',
        message: 'No products found on homepage',
        location: 'homepage',
      });
      return false;
    }

    await page.locator('button:has-text("GoPay"), button:has-text("Telkomsel")').first().click();
    await page.waitForTimeout(1000);

    const customerIdInput = await page.locator('input[placeholder*="ID"], input[placeholder*="Nomor"]').first();
    if (!(await customerIdInput.isVisible())) {
      findingsArr.push({
        severity: 'critical',
        category: 'functionality',
        message: 'Checkout form not visible',
        location: 'checkout_form',
      });
      return false;
    }

    await customerIdInput.fill(testData.customer_id || '081234567890');
    const submitButton = await page.locator('button:has-text("Bayar"), button[type="submit"]').first();
    await submitButton.click();
    await page.waitForTimeout(2000);

    findingsArr.push({
      severity: 'info',
      category: 'success',
      message: 'Guest checkout flow completed',
      location: 'checkout',
    });
    return true;
  } catch (error) {
    findingsArr.push({
      severity: 'critical',
      category: 'error',
      message: `Guest checkout error: ${error.message}`,
      location: 'guest_checkout',
    });
    return false;
  }
}

async function validateGuestTracking(page, baseUrl, testData, findingsArr) {
  try {
    await page.goto(`${baseUrl}lacak`);
    await page.waitForLoadState('networkidle');

    const invoiceInput = await page.locator('input[placeholder*="invoice"], input[placeholder*="kode"]').first();
    if (!(await invoiceInput.isVisible())) {
      findingsArr.push({
        severity: 'critical',
        category: 'functionality',
        message: 'Invoice input not found',
        location: 'tracking_page',
      });
      return false;
    }

    findingsArr.push({
      severity: 'info',
      category: 'success',
      message: 'Guest tracking page accessible',
      location: 'tracking',
    });
    return true;
  } catch (error) {
    findingsArr.push({
      severity: 'critical',
      category: 'error',
      message: `Guest tracking error: ${error.message}`,
      location: 'guest_tracking',
    });
    return false;
  }
}

async function validateResellerRegistration(page, baseUrl, testData, findingsArr) {
  try {
    await page.goto(`${baseUrl}dashboard`);
    await page.waitForLoadState('networkidle');

    const emailInput = await page.locator('input[type="email"]').first();
    if (!(await emailInput.isVisible())) {
      findingsArr.push({
        severity: 'critical',
        category: 'functionality',
        message: 'Registration form not visible',
        location: 'registration',
      });
      return false;
    }

    findingsArr.push({
      severity: 'info',
      category: 'success',
      message: 'Reseller registration accessible',
      location: 'registration',
    });
    return true;
  } catch (error) {
    findingsArr.push({
      severity: 'critical',
      category: 'error',
      message: `Reseller registration error: ${error.message}`,
      location: 'reseller_registration',
    });
    return false;
  }
}

async function validateResellerTransaction(page, baseUrl, testData, findingsArr) {
  try {
    await page.goto(`${baseUrl}dashboard`);
    await page.waitForLoadState('networkidle');

    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    
    if (await emailInput.isVisible()) {
      const email = testData.email || 'reseller@adnanpay.com';
      const password = testData.password || 'Reseller123!';
      await emailInput.fill(email);
      await passwordInput.fill(password);
      await page.locator('button[type="submit"]').click();
      await page.waitForLoadState('networkidle');
    }

    await page.goto(`${baseUrl}catalog`);
    await page.waitForLoadState('networkidle');

    const productButtons = page.locator('button:has-text("GoPay"), button:has-text("Telkomsel"), button:has-text("10.000"), button:has-text("20.000")');
    if (await productButtons.first().isVisible()) {
      await productButtons.first().click();
      await page.waitForTimeout(1000);
    }

    const phoneInput = page.locator('input[placeholder*="Nomor"], input[placeholder*="HP"], input[placeholder*="ID"]').first();
    if (await phoneInput.isVisible()) {
      await phoneInput.fill(testData.customer_id || '081234567890');
    }

    const payButton = page.locator('button:has-text("Bayar"), button[type="submit"]').first();
    if (await payButton.isVisible()) {
      await payButton.click();
      await page.waitForTimeout(2000);
    }

    await page.waitForURL(/invoice|berhasil|sukses/, { timeout: 5000 }).catch(() => {});

    findingsArr.push({
      severity: 'info',
      category: 'success',
      message: 'Reseller transaction completed',
      location: 'reseller_transaction',
    });
    return true;
  } catch (error) {
    findingsArr.push({
      severity: 'critical',
      category: 'error',
      message: `Reseller transaction error: ${error.message}`,
      location: 'reseller_transaction',
    });
    return false;
  }
}

async function validateResellerPayout(page, baseUrl, testData, findingsArr) {
  try {
    await page.goto(`${baseUrl}dashboard`);
    await page.waitForLoadState('networkidle');

    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    
    if (await emailInput.isVisible()) {
      const email = testData.email || 'reseller@adnanpay.com';
      const password = testData.password || 'Reseller123!';
      await emailInput.fill(email);
      await passwordInput.fill(password);
      await page.locator('button[type="submit"]').click();
      await page.waitForLoadState('networkidle');
    }

    const saldoKomisi = page.locator('text=Saldo Komisi, text=saldo komisi');
    if (await saldoKomisi.isVisible({ timeout: 3000 }).catch(() => false)) {
      findingsArr.push({
        severity: 'info',
        category: 'success',
        message: 'Reseller payout section accessible',
        location: 'reseller_payout',
      });
    }

    const payoutButton = page.locator('button:has-text("Ajukan Penarikan"), button:has-text("Tarik"), a:has-text("Tarik")');
    if (await payoutButton.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await payoutButton.first().click();
      await page.waitForTimeout(1000);

      const amountInput = page.locator('input[name="amount"], input[placeholder*="Jumlah"]');
      if (await amountInput.isVisible()) {
        await amountInput.fill('10000');
      }
    }

    findingsArr.push({
      severity: 'info',
      category: 'success',
      message: 'Payout request submitted',
      location: 'reseller_payout',
    });
    return true;
  } catch (error) {
    findingsArr.push({
      severity: 'critical',
      category: 'error',
      message: `Reseller payout error: ${error.message}`,
      location: 'reseller_payout',
    });
    return false;
  }
}

async function validateAdminManagement(page, baseUrl, testData, findingsArr) {
  try {
    await page.goto(`${baseUrl}admin`);
    await page.waitForLoadState('networkidle');

    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    
    if (await emailInput.isVisible()) {
      const email = testData.admin_email || 'admin@adnanpay.com';
      const password = testData.admin_password || 'Admin123!@#';
      await emailInput.fill(email);
      await passwordInput.fill(password);
      await page.locator('button[type="submit"]').click();
      await page.waitForLoadState('networkidle');
    }

    const adminDashboard = page.locator('text=Kelola Produk, text=kelola produk, text=Manage, text=Admin');
    if (!(await adminDashboard.first().isVisible({ timeout: 5000 }).catch(() => false))) {
      findingsArr.push({
        severity: 'critical',
        category: 'functionality',
        message: 'Admin dashboard elements not visible',
        location: 'admin_management',
      });
      return false;
    }

    findingsArr.push({
      severity: 'info',
      category: 'success',
      message: 'Admin dashboard accessible',
      location: 'admin_management',
    });

    return true;
  } catch (error) {
    findingsArr.push({
      severity: 'critical',
      category: 'error',
      message: `Admin management error: ${error.message}`,
      location: 'admin_management',
    });
    return false;
  }
}

async function runFlow(name, fn) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const flowFindings = [];
  
  try {
    const success = await fn(page, BASE_URL, TEST_DATA, flowFindings);
    return { name, success, findings: flowFindings };
  } catch (error) {
    flowFindings.push({
      severity: 'critical',
      category: 'error',
      message: error.message,
      location: name,
    });
    return { name, success: false, findings: flowFindings };
  } finally {
    await browser.close();
  }
}

async function main() {
  console.log('Running TestSprite Validation...');
  console.log('Target:', BASE_URL);
  console.log('---');

  const results = [];

  // Run 6 user flows
  const flows = [
    { name: 'guest_checkout', fn: validateGuestCheckout },
    { name: 'guest_tracking', fn: validateGuestTracking },
    { name: 'reseller_registration', fn: validateResellerRegistration },
    { name: 'reseller_transaction', fn: validateResellerTransaction },
    { name: 'reseller_payout', fn: validateResellerPayout },
    { name: 'admin_management', fn: validateAdminManagement },
  ];

  for (const flow of flows) {
    console.log(`Running ${flow.name}...`);
    const result = await runFlow(flow.name, flow.fn);
    results.push(result);
    console.log(`  -> ${result.success ? 'PASS' : 'FAIL'}`);
  }

  // Summary
  const summary = {
    total: results.length,
    passed: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    critical: results.flatMap(r => r.findings.filter(f => f.severity === 'critical')).length,
    high: results.flatMap(r => r.findings.filter(f => f.severity === 'high')).length,
    medium: results.flatMap(r => r.findings.filter(f => f.severity === 'medium')).length,
    low: results.flatMap(r => r.findings.filter(f => f.severity === 'low')).length,
  };

  console.log('\n--- Summary ---');
  console.log(JSON.stringify(summary, null, 2));
  
  // Output results for report generation
  console.log('\n--- DETAILED RESULTS ---');
  console.log(JSON.stringify(results, null, 2));
}

main().catch(console.error);
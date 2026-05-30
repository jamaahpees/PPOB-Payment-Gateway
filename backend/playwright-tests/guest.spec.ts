import { test, expect } from '@playwright/test';

import { appendEvidence, apiJson, createTestOrder, ensureEvidenceDirs, writeBugReport } from './helpers/api';

test.describe('Wave 2 Guest features', () => {
  test('guest checkout, tracking, and invoice endpoints respond on demo', async ({ page, request }) => {
    await ensureEvidenceDirs();
    const findings: string[] = [];

    await page.goto('/');
    await expect(page).toHaveTitle(/Adnanpay/);
    findings.push(`landing_loaded ${page.url()}`);

    const catalog = await apiJson<{ products: Array<{ product: { sku_digiflazz: string } }> }>(request, '/api/catalog');
    findings.push(`catalog_status ${catalog.response.status()}`);
    const productCodes = (catalog.data?.products ?? []).map((item) => item.product.sku_digiflazz);
    findings.push(`catalog_products ${productCodes.join(',')}`);

    for (const required of ['xld10', '4NwT49']) {
      if (!productCodes.includes(required)) {
        await writeBugReport('guest-missing-dev-products.md', `# Missing dev product\n\nExpected product \`${required}\` was not returned by \`GET /api/catalog\` in demo mode.`);
      }
    }

    const order = await createTestOrder(request);
    findings.push(`order_created ${order.invoice_code} ${order.status}`);

    const payment = await apiJson<{ payment_id: string; status: string; redirect_url: string }>(request, '/api/payments/midtrans/initialize', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      data: { order_id: order.order_id, idempotency_key: `guest-${order.invoice_code}` },
    });
    findings.push(`payment_init_status ${payment.response.status()}`);

    if (!payment.response.ok()) {
      await writeBugReport('guest-payment-initialize.md', `# Guest payment initialization failed\n\nOrder: \`${order.order_id}\`\nStatus: ${payment.response.status()}\n\n\`\`\`json\n${payment.text}\n\`\`\``);
    }

    const invoice = await apiJson<unknown>(request, `/api/invoices/${order.invoice_code}`);
    findings.push(`invoice_status ${invoice.response.status()}`);
    if (!invoice.response.ok()) {
      const fallbackInvoice = await apiJson<unknown>(request, `/api/invoice-status/${order.invoice_code}`);
      findings.push(`invoice_status_fallback ${fallbackInvoice.response.status()}`);
      if (!fallbackInvoice.response.ok()) {
        await writeBugReport('guest-invoice-route.md', `# Invoice route failure\n\nBoth invoice endpoints failed for \`${order.invoice_code}\`.\n- /api/invoices status: ${invoice.response.status()}\n- /api/invoice-status status: ${fallbackInvoice.response.status()}`);
      }
    }

    await page.goto(`/invoice/${order.invoice_code}`);
    const visibleText = await page.locator('body').textContent();
    findings.push(`invoice_page_contains ${visibleText?.includes(order.invoice_code) ? 'invoice-code' : 'missing-invoice-code'}`);

    await appendEvidence('feature-test-guest.txt', [
      `wave=guest timestamp=${new Date().toISOString()}`,
      ...findings,
    ]);
  });
});

import { test, expect } from '@playwright/test';
import { appendEvidence, createTestUser, ensureEvidenceDirs, apiJson, demoApiBaseUrl } from '../helpers/api';
import crypto from 'crypto';

test.describe('E2E Buy-to-Deliver Simulation', () => {
  test('register → login → find product → create order → pay → trigger fulfillment → verify Sukses', async ({ request }) => {
    await ensureEvidenceDirs();
    const findings: string[] = [];

    // Step 1: Create test user (reseller)
    const user = await createTestUser(request, 'reseller');
    findings.push(`created_user ${user.email}`);

    // Step 2: Login via API to get token
    const loginRes = await apiJson<{ token: string }>(request, '/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      data: { email: user.email, password: user.password }
    });
    expect(loginRes.response.ok()).toBe(true);
    const token = loginRes.data.token;
    findings.push('login_ok');

    // Step 3: GET catalog products
    const catalogRes = await apiJson<{ products?: Array<{ product: { id: string; sku_digiflazz: string; name: string }; final_price_minor?: number; base_price_minor?: number }> }>(
      request, '/api/catalog/products'
    );
    expect(catalogRes.response.ok()).toBe(true);
    const products = catalogRes.data?.products ?? [];
    
    // Find xld10 (sandbox product) or use first available
    const sandboxProduct = products.find(p => p.product.sku_digiflazz === 'xld10') ?? products[0];
    expect(sandboxProduct).toBeDefined();
    const priceMinor = sandboxProduct.final_price_minor ?? sandboxProduct.base_price_minor ?? 10000;
    findings.push(`found_product ${sandboxProduct.product.sku_digiflazz} price=${priceMinor}`);

    // Step 4: Create order (legacy format with items array)
    console.log(`[Order Payload] items=[product_id=${sandboxProduct.product.id}, product_sku=${sandboxProduct.product.sku_digiflazz}]`);
    const orderRes = await apiJson<{ order_id: string; invoice_code: string; status: string }>(
      request, '/api/orders/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        data: {
          items: [{
            product_id: sandboxProduct.product.id,
            product_sku: sandboxProduct.product.sku_digiflazz,
            product_name: sandboxProduct.product.name,
            unit_price_minor: priceMinor,
            customer_phone: '087800001230'
          }]
        }
      }
    );
    console.log(`[Order Response] status=${orderRes.response.status()} body=${orderRes.text}`);
    expect(orderRes.response.ok()).toBe(true);
    
    // Legacy router returns: { success, order: { id, order_number, ... }, items, summary }
    const order_data = orderRes.data as { success?: boolean; order?: { id: string; order_number: string; status: string } };
    const order_id = order_data.order?.id;
    const invoice_code = order_data.order?.order_number;
    findings.push(`order_created ${invoice_code} order_id=${order_id}`);
    console.log(`[Created Order] invoice=${invoice_code} order_id=${order_id}`);

    // Step 5: Verify invoice exists
    const invoiceRes = await apiJson<{ status: string; invoice_code: string }>(
      request, `/api/invoices/${invoice_code}/status`
    );
    expect(invoiceRes.response.ok()).toBe(true);
    findings.push(`invoice_status_initial ${invoiceRes.data.status}`);

    // Step 6: Simulate payment via Midtrans webhook
    // Compute signature: SHA512(order_id + status_code + gross_amount + MIDTRANS_SERVER_KEY)
    // For test: use dummy signature that validates if dev mode bypasses signature check
    const midtransServerKey = process.env.MIDTRANS_SERVER_KEY || 'test-key';
    const statusCode = '200';
    const grossAmountStr = String(priceMinor);
    const signatureInput = invoice_code + statusCode + grossAmountStr + midtransServerKey;
    const computedSignature = crypto.createHash('sha512').update(signatureInput).digest('hex');

    const paymentWebhookRes = await apiJson(request, '/api/payments/midtrans/webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      data: {
        order_id: invoice_code,
        status_code: statusCode,
        gross_amount: grossAmountStr,
        signature_key: computedSignature,
        transaction_status: 'settlement',
        payment_type: 'bank_transfer',
        fraud_status: 'accept',
        transaction_id: 'TEST-TXN-' + Date.now()
      }
    });
    console.log(`[Payment Webhook] status=${paymentWebhookRes.response.status()}`);
    findings.push(`payment_webhook_status ${paymentWebhookRes.response.status()}`);

    // Wait for status to transition
    await new Promise(r => setTimeout(r, 2000));

    // Step 7: Trigger Digiflazz fulfillment
    const triggerRes = await apiJson<{ status: string; fulfillmentId?: string }>(
      request, '/api/fulfillments/digiflazz/trigger', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        data: { order_id }
      }
    );
    console.log(`[Fulfillment Trigger] status=${triggerRes.response.status()} body=${triggerRes.text}`);
    expect(triggerRes.response.status()).not.toBe(500);
    findings.push(`fulfillment_triggered status=${triggerRes.data?.status}`);

    // Step 8: Poll invoice status until Sukses (max 30s)
    let finalStatus = '';
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const statusRes = await apiJson<{ status: string }>(request, `/api/invoices/${invoice_code}/status`);
      finalStatus = statusRes.data?.status ?? '';
      console.log(`[Poll ${i + 1}] status=${finalStatus}`);
      if (['success', 'sukses', 'fulfilled', 'completed'].some(s => finalStatus.toLowerCase().includes(s))) break;
    }
    findings.push(`final_status ${finalStatus}`);

    // Step 9: Append evidence
    await appendEvidence('e2e-buy-to-deliver.txt', [
      `simulation=e2e-buy-to-deliver timestamp=${new Date().toISOString()}`,
      ...findings
    ]);

    // Step 10: Assert final status contains success/sukses
    expect(['success', 'sukses', 'fulfilled', 'completed'].some(s => finalStatus.toLowerCase().includes(s))).toBe(true);
  });
});
# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: test-simulations\e2e-buy-to-deliver.spec.ts >> E2E Buy-to-Deliver Simulation >> register → login → find product → create order → pay → trigger fulfillment → verify Sukses
- Location: playwright-tests\test-simulations\e2e-buy-to-deliver.spec.ts:6:7

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
```

# Test source

```ts
  30  |     
  31  |     // Find xld10 (sandbox product) or use first available
  32  |     const sandboxProduct = products.find(p => p.product.sku_digiflazz === 'xld10') ?? products[0];
  33  |     expect(sandboxProduct).toBeDefined();
  34  |     const priceMinor = sandboxProduct.final_price_minor ?? sandboxProduct.base_price_minor ?? 10000;
  35  |     findings.push(`found_product ${sandboxProduct.product.sku_digiflazz} price=${priceMinor}`);
  36  | 
  37  |     // Step 4: Create order (legacy format with items array)
  38  |     console.log(`[Order Payload] items=[product_id=${sandboxProduct.product.id}, product_sku=${sandboxProduct.product.sku_digiflazz}]`);
  39  |     const orderRes = await apiJson<{ order_id: string; invoice_code: string; status: string }>(
  40  |       request, '/api/orders/create', {
  41  |         method: 'POST',
  42  |         headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
  43  |         data: {
  44  |           items: [{
  45  |             product_id: sandboxProduct.product.id,
  46  |             product_sku: sandboxProduct.product.sku_digiflazz,
  47  |             product_name: sandboxProduct.product.name,
  48  |             unit_price_minor: priceMinor,
  49  |             customer_phone: '087800001230'
  50  |           }]
  51  |         }
  52  |       }
  53  |     );
  54  |     console.log(`[Order Response] status=${orderRes.response.status()} body=${orderRes.text}`);
  55  |     expect(orderRes.response.ok()).toBe(true);
  56  |     
  57  |     // Legacy router returns: { success, order: { id, order_number, ... }, items, summary }
  58  |     const order_data = orderRes.data as { success?: boolean; order?: { id: string; order_number: string; status: string } };
  59  |     const order_id = order_data.order?.id;
  60  |     const invoice_code = order_data.order?.order_number;
  61  |     findings.push(`order_created ${invoice_code} order_id=${order_id}`);
  62  |     console.log(`[Created Order] invoice=${invoice_code} order_id=${order_id}`);
  63  | 
  64  |     // Step 5: Verify invoice exists
  65  |     const invoiceRes = await apiJson<{ status: string; invoice_code: string }>(
  66  |       request, `/api/invoices/${invoice_code}/status`
  67  |     );
  68  |     expect(invoiceRes.response.ok()).toBe(true);
  69  |     findings.push(`invoice_status_initial ${invoiceRes.data.status}`);
  70  | 
  71  |     // Step 6: Simulate payment via Midtrans webhook
  72  |     // Compute signature: SHA512(order_id + status_code + gross_amount + MIDTRANS_SERVER_KEY)
  73  |     // For test: use dummy signature that validates if dev mode bypasses signature check
  74  |     const midtransServerKey = process.env.MIDTRANS_SERVER_KEY || 'test-key';
  75  |     const statusCode = '200';
  76  |     const grossAmountStr = String(priceMinor);
  77  |     const signatureInput = invoice_code + statusCode + grossAmountStr + midtransServerKey;
  78  |     const computedSignature = crypto.createHash('sha512').update(signatureInput).digest('hex');
  79  | 
  80  |     const paymentWebhookRes = await apiJson(request, '/api/payments/midtrans/webhook', {
  81  |       method: 'POST',
  82  |       headers: { 'content-type': 'application/json' },
  83  |       data: {
  84  |         order_id: invoice_code,
  85  |         status_code: statusCode,
  86  |         gross_amount: grossAmountStr,
  87  |         signature_key: computedSignature,
  88  |         transaction_status: 'settlement',
  89  |         payment_type: 'bank_transfer',
  90  |         fraud_status: 'accept',
  91  |         transaction_id: 'TEST-TXN-' + Date.now()
  92  |       }
  93  |     });
  94  |     console.log(`[Payment Webhook] status=${paymentWebhookRes.response.status()}`);
  95  |     findings.push(`payment_webhook_status ${paymentWebhookRes.response.status()}`);
  96  | 
  97  |     // Wait for status to transition
  98  |     await new Promise(r => setTimeout(r, 2000));
  99  | 
  100 |     // Step 7: Trigger Digiflazz fulfillment
  101 |     const triggerRes = await apiJson<{ status: string; fulfillmentId?: string }>(
  102 |       request, '/api/fulfillments/digiflazz/trigger', {
  103 |         method: 'POST',
  104 |         headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
  105 |         data: { order_id }
  106 |       }
  107 |     );
  108 |     console.log(`[Fulfillment Trigger] status=${triggerRes.response.status()} body=${triggerRes.text}`);
  109 |     expect(triggerRes.response.status()).not.toBe(500);
  110 |     findings.push(`fulfillment_triggered status=${triggerRes.data?.status}`);
  111 | 
  112 |     // Step 8: Poll invoice status until Sukses (max 30s)
  113 |     let finalStatus = '';
  114 |     for (let i = 0; i < 15; i++) {
  115 |       await new Promise(r => setTimeout(r, 2000));
  116 |       const statusRes = await apiJson<{ status: string }>(request, `/api/invoices/${invoice_code}/status`);
  117 |       finalStatus = statusRes.data?.status ?? '';
  118 |       console.log(`[Poll ${i + 1}] status=${finalStatus}`);
  119 |       if (['success', 'sukses', 'fulfilled', 'completed'].some(s => finalStatus.toLowerCase().includes(s))) break;
  120 |     }
  121 |     findings.push(`final_status ${finalStatus}`);
  122 | 
  123 |     // Step 9: Append evidence
  124 |     await appendEvidence('e2e-buy-to-deliver.txt', [
  125 |       `simulation=e2e-buy-to-deliver timestamp=${new Date().toISOString()}`,
  126 |       ...findings
  127 |     ]);
  128 | 
  129 |     // Step 10: Assert final status contains success/sukses
> 130 |     expect(['success', 'sukses', 'fulfilled', 'completed'].some(s => finalStatus.toLowerCase().includes(s))).toBe(true);
      |                                                                                                              ^ Error: expect(received).toBe(expected) // Object.is equality
  131 |   });
  132 | });
```
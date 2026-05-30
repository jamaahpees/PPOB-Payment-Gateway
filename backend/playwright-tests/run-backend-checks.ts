import { request } from '@playwright/test';

import { appendEvidence, apiJson, cleanupTestData, createTestOrder, createTestUser, ensureEvidenceDirs, writeBugReport } from './helpers/api';

async function main() {
  await ensureEvidenceDirs();
  const context = await request.newContext({ ignoreHTTPSErrors: true });
  const lines: string[] = [`wave=backend timestamp=${new Date().toISOString()}`];

  try {
    const health = await apiJson<{ status: string }>(context, '/health');
    lines.push(`health ${health.response.status()} ${(health.data as { status?: string })?.status ?? 'unknown'}`);

    const order = await createTestOrder(context, { product_code: 'xld10' });
    lines.push(`order ${order.order_id} ${order.invoice_code} ${order.status}`);

    const payment = await apiJson<Record<string, unknown>>(context, '/api/payments/midtrans/initialize', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      data: { order_id: order.order_id, idempotency_key: `backend-${order.invoice_code}` },
    });
    lines.push(`payment_init ${payment.response.status()}`);

    if (!payment.response.ok()) {
      await writeBugReport('backend-payment-init.md', `# Backend payment initialization failed\n\nOrder ${order.order_id}\n\n\`\`\`\n${payment.text}\n\`\`\``);
    }

    const member = await createTestUser(context, 'member');
    const account = await apiJson<Record<string, unknown>>(context, '/api/account/me', {
      method: 'GET',
      headers: { authorization: `Bearer ${member.session.token}` },
    });
    lines.push(`account_me ${account.response.status()}`);

    const transactions = await apiJson<Record<string, unknown>>(context, '/api/account/transactions/transactions', {
      method: 'GET',
      headers: { authorization: `Bearer ${member.session.token}` },
    });
    lines.push(`member_transactions ${transactions.response.status()}`);
  } finally {
    await cleanupTestData();
    await appendEvidence('feature-test-backend.txt', lines);
    await context.dispose();
  }
}

main().catch(async (error: unknown) => {
  await writeBugReport('backend-check-runner.md', `# Backend check runner failed\n\n${error instanceof Error ? error.stack ?? error.message : String(error)}`);
  process.exitCode = 1;
});

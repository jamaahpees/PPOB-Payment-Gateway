import fs from 'node:fs/promises';
import path from 'node:path';

import { expect, type APIRequestContext, type Page } from '@playwright/test';

import { buildGeneratedCredential, readOrdersFixture, readProductsFixture } from './fixtures';

export const demoApiBaseUrl = 'https://demo.hanzserver.online';
const repoRootDir = path.resolve(process.cwd(), '..');
const evidenceDir = path.resolve(repoRootDir, '.sisyphus', 'evidence');
const bugsDir = path.join(evidenceDir, 'bugs');
const runtimeDir = path.resolve(process.cwd(), 'playwright-tests', '.runtime');

export type AuthSession = Readonly<{
  user: {
    id: string;
    email: string;
    role: 'admin' | 'seller' | 'pengguna';
    is_reseller_active: boolean;
    reseller_status: 'none' | 'requested' | 'approved' | 'rejected';
    email_verified: boolean;
  };
  token: string;
  expires_in: string;
}>;

export async function ensureEvidenceDirs() {
  await fs.mkdir(evidenceDir, { recursive: true });
  await fs.mkdir(bugsDir, { recursive: true });
  await fs.mkdir(runtimeDir, { recursive: true });
}

export async function appendEvidence(fileName: string, lines: string[]) {
  await ensureEvidenceDirs();
  await fs.appendFile(path.join(evidenceDir, fileName), lines.join('\n') + '\n', 'utf8');
}

export async function writeBugReport(fileName: string, body: string) {
  await ensureEvidenceDirs();
  await fs.writeFile(path.join(bugsDir, fileName), body, 'utf8');
}

export async function apiJson<T>(request: APIRequestContext, input: string, init?: Parameters<APIRequestContext['fetch']>[1]) {
  const response = await request.fetch(`${demoApiBaseUrl}${input}`, init);
  const text = await response.text();
  let data: unknown = null;

  try {
    data = text === '' ? null : JSON.parse(text);
  } catch {
    data = text;
  }

  return { response, data: data as T, text };
}

export async function createTestUser(request: APIRequestContext, role: 'reseller' | 'member' = 'reseller') {
  const generated = buildGeneratedCredential(role === 'reseller' ? 'reseller' : 'member');
  const register = await apiJson<AuthSession>(request, '/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    data: { email: generated.email, password: generated.password },
  });

  if (!register.response.ok()) {
    throw new Error(`createTestUser failed: ${register.response.status()} ${register.text}`);
  }

  await fs.writeFile(path.join(runtimeDir, `user-${generated.email.replace(/[^a-z0-9]/gi, '_')}.json`), JSON.stringify({ ...generated, session: register.data }, null, 2));
  return { ...generated, session: register.data };
}

export async function createTestOrder(request: APIRequestContext, overrides?: Partial<{ product_code: string; provider: string; customer_ref: string; buyer_email: string | null }>) {
  const baseOrder = readOrdersFixture()[0];
  const products = readProductsFixture();
  const product = products.find((entry) => entry.sku_digiflazz === (overrides?.product_code ?? baseOrder.product_code));

  expect(product).toBeDefined();

  const productCode = overrides?.product_code ?? baseOrder.product_code;
  const catalog = await apiJson<{
    products?: Array<{
      product: { sku_digiflazz: string };
      final_price_minor?: number;
      role_price_minor?: number;
      base_price_minor?: number;
    }>;
  }>(request, '/api/catalog/products');
  const catalogProduct = (catalog.data?.products ?? []).find((entry) => entry.product.sku_digiflazz === productCode);

  expect(catalogProduct).toBeDefined();

  const amountMinor = catalogProduct?.final_price_minor ?? catalogProduct?.role_price_minor ?? catalogProduct?.base_price_minor;

  expect(amountMinor).toBeDefined();

  const payload = {
    product_code: productCode,
    provider: overrides?.provider ?? baseOrder.provider,
    customer_ref: overrides?.customer_ref ?? baseOrder.customer_ref,
    buyer_email: overrides?.buyer_email ?? baseOrder.buyer_email,
    amount_minor: amountMinor,
    currency: 'IDR',
  };

  const order = await apiJson<{ order_id: string; invoice_code: string; status: string }>(request, '/api/orders', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    data: payload,
  });

  if (!order.response.ok()) {
    throw new Error(`createTestOrder failed: ${order.response.status()} ${order.text}`);
  }

  await fs.writeFile(path.join(runtimeDir, `order-${order.data.invoice_code}.json`), JSON.stringify({ payload, order: order.data }, null, 2));
  return order.data;
}

export async function cleanupTestData() {
  await ensureEvidenceDirs();
  await appendEvidence('feature-test-fixtures.txt', [
    `cleanupTestData invoked at ${new Date().toISOString()}`,
    'No destructive cleanup endpoint is available in demo mode, so generated test identities are recorded only and left isolated in demo_ tables.',
  ]);
}

export async function loginAsReseller(page: Page, email: string, password: string) {
  await page.goto('/dashboard');
  const emailInput = page.getByPlaceholder('nama@email.com').or(page.getByLabel('Email')).first();
  await emailInput.fill(email);
  const passwordInput = page.getByPlaceholder('••••••••').or(page.getByLabel('Password')).first();
  await passwordInput.fill(password);
  const loginButton = page.getByRole('button', { name: /masuk sekarang/i }).or(page.getByRole('button', { name: /masuk ke dashboard/i })).first();
  await loginButton.click();
  // Wait for the dashboard to successfully load before completing the login helper
  await expect(page.locator('text=Dashboard Member').first()).toBeVisible({ timeout: 15000 });
}

export async function loginAsAdmin(page: Page, email: string, password: string) {
  await page.goto('/admin');
  const emailInput = page.getByPlaceholder('nama@email.com').or(page.getByLabel('Email')).first();
  await emailInput.fill(email);
  const passwordInput = page.getByPlaceholder('••••••••').or(page.getByLabel('Password')).first();
  await passwordInput.fill(password);
  const loginButton = page.getByRole('button', { name: /masuk admin/i }).or(page.getByRole('button', { name: /masuk/i })).first();
  await loginButton.click();
}

export async function selectProduct(page: Page, productCode: string) {
  const card = page.locator(`[data-product-code="${productCode}"]`).first();
  if (await card.count()) {
    await card.click();
    return;
  }

  await page.getByPlaceholder(/cari layanan, operator, atau nama game/i).fill(productCode);
  const productText = productCode.toLowerCase().includes('gopay') ? /gopay/i : /telkomsel/i;
  await page.getByText(productText).first().click();
}

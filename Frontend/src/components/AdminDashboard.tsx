import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, Boxes, CheckCircle2, Loader2, LockKeyhole, RefreshCcw, ShieldAlert, SlidersHorizontal, ToggleLeft, Trash2, UserCheck, UsersRound } from 'lucide-react';

import { AdminProductUpload } from './AdminProductUpload';
import { bearerHeaders, readJsonApi } from '../lib/api';

type AuthUserRole = 'admin' | 'seller' | 'pengguna';
type ResellerStatus = 'none' | 'requested' | 'approved' | 'rejected';
type PricingScopeType = 'global' | 'category' | 'product';

type AuthUser = Readonly<{
  id: string;
  email: string;
  role: AuthUserRole;
  is_reseller_active: boolean;
  reseller_status: ResellerStatus;
  email_verified: boolean;
  email_verified_at: string | null;
  created_at: string;
  updated_at: string;
}>;

type AuthSession = Readonly<{
  user: AuthUser;
  token: string;
  expires_in: string;
}>;

type AccountResponse = Readonly<{ user: AuthUser }>;
type AdminUsersResponse = Readonly<{ users: AuthUser[] }>;

type AdminProduct = Readonly<{
  id: string;
  sku_digiflazz: string;
  name: string;
  category: string;
  provider: string;
  base_price_minor: number;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}>;

type AdminProductsResponse = Readonly<{ products: AdminProduct[] }>;
type AdminProductResponse = Readonly<{ product: AdminProduct }>;

type PricingRule = Readonly<{
  id: string;
  scope_type: PricingScopeType;
  product_id: string | null;
  category: string | null;
  role_type: AuthUserRole;
  markup_fixed: number;
  markup_percentage: number;
  priority: number;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}>;

type PricingRulesResponse = Readonly<{ pricing_rules: PricingRule[] }>;
type PricingRuleResponse = Readonly<{ pricing_rule: PricingRule }>;

type AdminMonitorTransaction = Readonly<{
  order_id: string;
  invoice_code: string;
  user_id: string | null;
  status: string;
  product_code: string;
  provider: string;
  amount_minor: number;
  currency: string;
  created_at: string;
  payment: null | Readonly<{ status: string; provider: string }>;
  fulfillment: null | Readonly<{ status: string; provider: string; serial_number: string | null }>;
}>;

type AdminMonitorWebhook = Readonly<{
  webhook_id: string;
  provider: string;
  event_key: string;
  event_type: string;
  order_id: string | null;
  payment_id: string | null;
  processing_state: string;
  received_at: string;
  processed_at: string | null;
  error_message: string | null;
}>;

type AdminMonitoringResponse = Readonly<{
  transactions: AdminMonitorTransaction[];
  webhooks: AdminMonitorWebhook[];
  summary: Readonly<{
    transaction_count: number;
    webhook_count: number;
    failed_webhook_count: number;
  }>;
}>;

type DigiflazzOperationsResponse = Readonly<{
  balance: Readonly<{ deposit: number | null; rc: string | null; message: string | null }>;
  catalog: Readonly<{ product_count: number; active_count: number; inactive_count: number; last_synced_at: string | null }>;
  webhooks: Readonly<{ recent_count: number; failed_count: number }>;
}>;

type DigiflazzSyncResponse = Readonly<{
  product_count: number;
  active_count: number;
  inactive_count: number;
  synced_at: string;
}>;

type ProductFormState = Readonly<{
  sku_digiflazz: string;
  name: string;
  category: string;
  provider: string;
  base_price_minor: string;
  image_url: string;
  is_active: boolean;
}>;

type CategoryImageFormState = Readonly<{
  category: string;
  image_url: string;
}>;

type PricingFormState = Readonly<{
  scope_type: PricingScopeType;
  product_id: string;
  category: string;
  role_type: AuthUserRole;
  markup_fixed: string;
  markup_percentage: string;
  priority: string;
  is_active: boolean;
}>;

const storageKey = 'bayarku.auth.session';

const emptyProductForm: ProductFormState = {
  sku_digiflazz: '',
  name: '',
  category: '',
  provider: 'digiflazz',
  base_price_minor: '',
  image_url: '',
  is_active: true,
};

const emptyCategoryImageForm: CategoryImageFormState = {
  category: '',
  image_url: '',
};

const emptyPricingForm: PricingFormState = {
  scope_type: 'global',
  product_id: '',
  category: '',
  role_type: 'pengguna',
  markup_fixed: '0',
  markup_percentage: '0',
  priority: '0',
  is_active: true,
};

function readStoredSession(): AuthSession | null {
  try {
    const value = window.localStorage.getItem(storageKey);
    if (value === null) return null;
    const session = JSON.parse(value) as Partial<AuthSession>;
    if (typeof session.token !== 'string' || typeof session.user?.email !== 'string') return null;
    return session as AuthSession;
  } catch {
    return null;
  }
}

function storeSession(session: AuthSession | null) {
  if (session === null) {
    window.localStorage.removeItem(storageKey);
    return;
  }
  window.localStorage.setItem(storageKey, JSON.stringify(session));
}

function formatRupiah(amountMinor: number) {
  return 'Rp ' + amountMinor.toLocaleString('id-ID');
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function roleLabel(role: AuthUserRole) {
  const labels: Record<AuthUserRole, string> = { admin: 'Admin', seller: 'Reseller', pengguna: 'Member' };
  return labels[role];
}

function resellerLabel(status: ResellerStatus) {
  const labels: Record<ResellerStatus, string> = {
    none: 'Belum diajukan',
    requested: 'Menunggu review',
    approved: 'Disetujui',
    rejected: 'Ditolak',
  };
  return labels[status];
}

function productPayload(form: ProductFormState) {
  return {
    sku_digiflazz: form.sku_digiflazz,
    name: form.name,
    category: form.category,
    provider: form.provider,
    base_price_minor: Number(form.base_price_minor),
    is_active: form.is_active,
    metadata: form.image_url.trim() === '' ? {} : { image_url: form.image_url.trim(), category_image_url: form.image_url.trim() },
  };
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
    reader.readAsDataURL(file);
  });
}

function pricingPayload(form: PricingFormState) {
  return {
    scope_type: form.scope_type,
    product_id: form.scope_type === 'product' ? form.product_id : null,
    category: form.scope_type === 'category' ? form.category : null,
    role_type: form.role_type,
    markup_fixed: Number(form.markup_fixed),
    markup_percentage: Number(form.markup_percentage),
    priority: Number(form.priority),
    is_active: form.is_active,
    metadata: {},
  };
}

function updateProductList(products: AdminProduct[], product: AdminProduct) {
  return products.some((item) => item.id === product.id) ? products.map((item) => (item.id === product.id ? product : item)) : [product, ...products];
}

function updatePricingRuleList(rules: PricingRule[], rule: PricingRule) {
  return rules.some((item) => item.id === rule.id) ? rules.map((item) => (item.id === rule.id ? rule : item)) : [rule, ...rules];
}

function updateUserList(users: AuthUser[], user: AuthUser) {
  return users.map((item) => (item.id === user.id ? user : item));
}

export default function AdminDashboard() {
  const [session, setSession] = useState<AuthSession | null>(() => readStoredSession());
  const [verifiedUser, setVerifiedUser] = useState<AuthUser | null>(null);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [monitoring, setMonitoring] = useState<AdminMonitoringResponse | null>(null);
  const [digiflazzOps, setDigiflazzOps] = useState<DigiflazzOperationsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(session));
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [productForm, setProductForm] = useState<ProductFormState>(emptyProductForm);
  const [categoryImageForm, setCategoryImageForm] = useState<CategoryImageFormState>(emptyCategoryImageForm);
  const [pricingForm, setPricingForm] = useState<PricingFormState>(emptyPricingForm);

  const token = session?.token ?? null;
  const isAdmin = verifiedUser?.role === 'admin';
  const activeProducts = useMemo(() => products.filter((product) => product.is_active).length, [products]);
  const activePricingRules = useMemo(() => pricingRules.filter((rule) => rule.is_active).length, [pricingRules]);
  const resellerRequests = useMemo(() => users.filter((user) => user.reseller_status === 'requested').length, [users]);
  const monitoredTransactions = monitoring?.transactions.slice(0, 4) ?? [];
  const monitoredWebhooks = monitoring?.webhooks.slice(0, 4) ?? [];
  const productCategories = useMemo(() => Array.from(new Set(products.map((product) => product.category))).sort(), [products]);

  const loadAdminData = useCallback(async (activeToken: string) => {
    setIsLoading(true);
    setError(null);
    setNotice(null);

    try {
      const mePayload = await readJsonApi<AccountResponse>('/auth/me', { headers: bearerHeaders(activeToken) });
      setVerifiedUser(mePayload.user);
      setSession((currentSession) => {
        if (currentSession === null) return currentSession;
        const nextSession = { ...currentSession, user: mePayload.user };
        storeSession(nextSession);
        return nextSession;
      });

      if (mePayload.user.role !== 'admin') {
        setProducts([]);
        setPricingRules([]);
        setUsers([]);
        setMonitoring(null);
        setDigiflazzOps(null);
        return;
      }

      const [productPayloadResult, pricingPayloadResult, usersPayload, monitoringPayload, digiflazzPayload] = await Promise.all([
        readJsonApi<AdminProductsResponse>('/admin/catalog/products', { headers: bearerHeaders(activeToken) }),
        readJsonApi<PricingRulesResponse>('/admin/catalog/pricing-rules', { headers: bearerHeaders(activeToken) }),
        readJsonApi<AdminUsersResponse>('/admin/users', { headers: bearerHeaders(activeToken) }),
        readJsonApi<AdminMonitoringResponse>('/admin/monitoring', { headers: bearerHeaders(activeToken) }),
        readJsonApi<DigiflazzOperationsResponse>('/admin/digiflazz/operations', { headers: bearerHeaders(activeToken) }),
      ]);
      setProducts(productPayloadResult.products);
      setPricingRules(pricingPayloadResult.pricing_rules);
      setUsers(usersPayload.users);
      setMonitoring(monitoringPayload);
      setDigiflazzOps(digiflazzPayload);
    } catch (loadError) {
      setVerifiedUser(null);
      setProducts([]);
      setPricingRules([]);
      setUsers([]);
      setMonitoring(null);
      setDigiflazzOps(null);
      setError(loadError instanceof Error ? loadError.message : 'Admin dashboard gagal dimuat.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token === null) {
      setIsLoading(false);
      setVerifiedUser(null);
      setProducts([]);
      setPricingRules([]);
      setUsers([]);
      setMonitoring(null);
      setDigiflazzOps(null);
      return;
    }
    void loadAdminData(token);
  }, [loadAdminData, token]);

  const createProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (token === null || !isAdmin) return;
    setIsMutating(true);
    setError(null);
    setNotice(null);

    try {
      const payload = await readJsonApi<AdminProductResponse>('/admin/catalog/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...bearerHeaders(token) },
        body: JSON.stringify(productPayload(productForm)),
      });
      setProducts((currentProducts) => updateProductList(currentProducts, payload.product));
      setProductForm(emptyProductForm);
      setNotice('Produk admin berhasil dibuat dari API katalog.');
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Produk gagal dibuat.');
    } finally {
      setIsMutating(false);
    }
  };

  const updateProduct = async (product: AdminProduct, changes: Partial<Pick<AdminProduct, 'name' | 'base_price_minor' | 'is_active'>>) => {
    if (token === null || !isAdmin) return;
    setIsMutating(true);
    setError(null);
    setNotice(null);

    try {
      const payload = await readJsonApi<AdminProductResponse>(`/admin/catalog/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...bearerHeaders(token) },
        body: JSON.stringify(changes),
      });
      setProducts((currentProducts) => updateProductList(currentProducts, payload.product));
      setNotice('Produk admin diperbarui dari API katalog.');
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Produk gagal diperbarui.');
    } finally {
      setIsMutating(false);
    }
  };

  const uploadCategoryImage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (token === null || !isAdmin || categoryImageForm.category.trim() === '' || categoryImageForm.image_url.trim() === '') return;
    setIsMutating(true);
    setError(null);
    setNotice(null);

    try {
      const categoryProducts = products.filter((product) => product.category === categoryImageForm.category);
      const updatedProducts = await Promise.all(
        categoryProducts.map((product) =>
          readJsonApi<AdminProductResponse>(`/admin/catalog/products/${product.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', ...bearerHeaders(token) },
            body: JSON.stringify({
              metadata: {
                ...product.metadata,
                image_url: categoryImageForm.image_url.trim(),
                category_image_url: categoryImageForm.image_url.trim(),
                image_source: 'admin_category_upload',
              },
            }),
          }),
        ),
      );
      setProducts((currentProducts) => updatedProducts.reduce((nextProducts, payload) => updateProductList(nextProducts, payload.product), currentProducts));
      setCategoryImageForm(emptyCategoryImageForm);
      setNotice(`Gambar kategori ${categoryImageForm.category} diterapkan ke ${updatedProducts.length} produk.`);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Gambar kategori gagal disimpan.');
    } finally {
      setIsMutating(false);
    }
  };

  const deleteProduct = async (productId: string) => {
    if (token === null || !isAdmin) return;
    setIsMutating(true);
    setError(null);
    setNotice(null);

    try {
      await readJsonApi(`/admin/catalog/products/${productId}`, {
        method: 'DELETE',
        headers: bearerHeaders(token),
      });
      setProducts((currentProducts) => currentProducts.filter((product) => product.id !== productId));
      setNotice('Produk berhasil dihapus.');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Produk gagal dihapus.');
    } finally {
      setIsMutating(false);
    }
  };

  const handleCategoryImageFile = async (file: File | undefined) => {
    if (file === undefined) return;
    const dataUrl = await fileToDataUrl(file);
    setCategoryImageForm((current) => ({ ...current, image_url: dataUrl }));
  };

  const createPricingRule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (token === null || !isAdmin) return;
    setIsMutating(true);
    setError(null);
    setNotice(null);

    try {
      const payload = await readJsonApi<PricingRuleResponse>('/admin/catalog/pricing-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...bearerHeaders(token) },
        body: JSON.stringify(pricingPayload(pricingForm)),
      });
      setPricingRules((currentRules) => updatePricingRuleList(currentRules, payload.pricing_rule));
      setPricingForm(emptyPricingForm);
      setNotice('Pricing rule berhasil dibuat dari API katalog.');
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Pricing rule gagal dibuat.');
    } finally {
      setIsMutating(false);
    }
  };

  const updatePricingRule = async (rule: PricingRule, changes: Partial<Pick<PricingRule, 'markup_fixed' | 'is_active'>>) => {
    if (token === null || !isAdmin) return;
    setIsMutating(true);
    setError(null);
    setNotice(null);

    try {
      const payload = await readJsonApi<PricingRuleResponse>(`/admin/catalog/pricing-rules/${rule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...bearerHeaders(token) },
        body: JSON.stringify(changes),
      });
      setPricingRules((currentRules) => updatePricingRuleList(currentRules, payload.pricing_rule));
      setNotice('Pricing rule diperbarui dari API katalog.');
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Pricing rule gagal diperbarui.');
    } finally {
      setIsMutating(false);
    }
  };

  const updateUserReseller = async (user: AuthUser, action: 'approve' | 'demote' | 'suspend') => {
    if (token === null || !isAdmin) return;
    setIsMutating(true);
    setError(null);
    setNotice(null);

    try {
      const payload = await readJsonApi<AccountResponse>(`/admin/users/${user.id}/reseller/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...bearerHeaders(token) },
        body: JSON.stringify({}),
      });
      setUsers((currentUsers) => updateUserList(currentUsers, payload.user));
      setNotice(`${payload.user.email} diperbarui lewat API admin user.`);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Status user gagal diperbarui.');
    } finally {
      setIsMutating(false);
    }
  };

  const syncDigiflazzCatalog = async () => {
    if (token === null || !isAdmin) return;
    setIsMutating(true);
    setError(null);
    setNotice(null);

    try {
      const syncPayload = await readJsonApi<DigiflazzSyncResponse>('/admin/catalog/digiflazz/price-list/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...bearerHeaders(token) },
        body: JSON.stringify({}),
      });
      const opsPayload = await readJsonApi<DigiflazzOperationsResponse>('/admin/digiflazz/operations', { headers: bearerHeaders(token) });
      setDigiflazzOps(opsPayload);
      setNotice(`Sinkron Digiflazz selesai: ${syncPayload.product_count} produk, ${syncPayload.active_count} aktif.`);
      await loadAdminData(token);
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : 'Sinkron Digiflazz gagal.');
    } finally {
      setIsMutating(false);
    }
  };

  if (session === null || token === null) {
    return (
      <main className="pt-24 pb-16 bg-slate-50 min-h-screen" data-testid="admin-forbidden">
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl bg-slate-900 p-8 shadow-xl shadow-slate-200">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-400/20 via-sky-500/10 to-rose-500/10" />
            <div className="relative max-w-2xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-200">
                <LockKeyhole size={14} /> Login admin diperlukan
              </span>
              <h1 className="mt-5 text-3xl sm:text-4xl font-extrabold tracking-tight text-white">Admin dashboard Adnanpay</h1>
              <p className="mt-4 leading-7 text-slate-300">Masuk lewat dashboard member terlebih dahulu. Pengunjung anonim tidak memuat API admin dan tidak melihat kontrol produk, margin, atau user.</p>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (isLoading) {
    return (
      <main className="pt-24 pb-16 bg-slate-50 min-h-screen">
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm" data-testid="admin-loading">
            <Loader2 size={30} className="mx-auto animate-spin text-amber-500" />
            <p className="mt-3 text-sm font-semibold text-slate-600">Memverifikasi role admin dan memuat data operasional...</p>
          </div>
        </section>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="pt-24 pb-16 bg-slate-50 min-h-screen" data-testid="admin-forbidden">
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
          <div className="rounded-3xl border border-rose-100 bg-white p-8 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-rose-50 p-3 text-rose-600"><ShieldAlert size={24} /></div>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wider text-rose-600">Akses ditolak</p>
                <h1 className="mt-2 text-3xl font-extrabold text-slate-900">Role admin diperlukan.</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">/auth/me mengembalikan role {roleLabel(verifiedUser?.role ?? session.user.role)}. Kontrol produk, margin, user, dan operasional disembunyikan sampai backend memverifikasi admin.</p>
              </div>
            </div>
          </div>
          {error && <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-semibold text-rose-700" data-testid="admin-error">{error}</div>}
        </section>
      </main>
    );
  }

  return (
    <main className="pt-24 pb-16 bg-slate-50 min-h-screen">
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6" data-testid="admin-dashboard">
        <div className="relative overflow-hidden rounded-3xl bg-slate-900 p-6 sm:p-8 shadow-xl shadow-slate-200">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-400/20 via-sky-500/10 to-emerald-500/10" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-200"><CheckCircle2 size={14} /> Backend admin terverifikasi</span>
              <h1 className="mt-4 text-3xl sm:text-4xl font-extrabold tracking-tight text-white">Admin Operations Hub</h1>
              <p className="mt-2 text-slate-300" data-testid="admin-email">{verifiedUser.email}</p>
            </div>
            <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-white/10 p-3 text-center text-white">
              <div><p className="text-2xl font-extrabold" data-testid="admin-product-count">{products.length}</p><p className="text-xs text-slate-300">Produk</p></div>
              <div><p className="text-2xl font-extrabold" data-testid="admin-pricing-count">{pricingRules.length}</p><p className="text-xs text-slate-300">Rules</p></div>
              <div><p className="text-2xl font-extrabold" data-testid="admin-user-count">{users.length}</p><p className="text-xs text-slate-300">Users</p></div>
            </div>
          </div>
        </div>

        {(error || notice) && <div className={`rounded-2xl border p-4 text-sm font-semibold ${error ? 'border-rose-100 bg-rose-50 text-rose-700' : 'border-emerald-100 bg-emerald-50 text-emerald-700'}`} data-testid={error ? 'admin-error' : 'admin-notice'}>{error ?? notice}</div>}

        <div className="grid gap-6 lg:grid-cols-3">
          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center gap-3"><div className="rounded-2xl bg-amber-50 p-3 text-amber-600"><Boxes size={22} /></div><div><p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Catalog status</p><h2 className="text-xl font-extrabold text-slate-900">{activeProducts} produk aktif</h2></div></div><p className="mt-4 text-sm leading-6 text-slate-500">Status read-only dari /admin/catalog/products; backend tetap pemilik data harga dasar dan status aktif.</p></article>
          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center gap-3"><div className="rounded-2xl bg-sky-50 p-3 text-sky-600"><SlidersHorizontal size={22} /></div><div><p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Margin rules</p><h2 className="text-xl font-extrabold text-slate-900">{activePricingRules} rule aktif</h2></div></div><p className="mt-4 text-sm leading-6 text-slate-500">Pantauan margin bersumber dari API pricing admin; frontend hanya mengirim perubahan, bukan menghitung harga final.</p></article>
          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center gap-3"><div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600"><BarChart3 size={22} /></div><div><p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Operational logs</p><h2 className="text-xl font-extrabold text-slate-900">{monitoring?.summary.transaction_count ?? 0} transaksi</h2></div></div><p className="mt-4 text-sm leading-6 text-slate-500" data-testid="admin-ops-panel">Monitoring read-only dari /admin/monitoring mencakup {monitoring?.summary.webhook_count ?? 0} webhook, {monitoring?.summary.failed_webhook_count ?? 0} webhook gagal, dan {resellerRequests} request reseller.</p></article>
        </div>

        <section className="rounded-3xl border border-amber-100 bg-white p-6 shadow-sm" data-testid="digiflazz-ops-panel">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wider text-amber-600">Digiflazz Buyer Operations</p>
              <h2 className="text-2xl font-extrabold text-slate-900">Saldo, sinkron produk, dan monitoring webhook</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">Panel admin-only. Tidak menampilkan API key, signature, atau payload rahasia.</p>
            </div>
            <button type="button" onClick={syncDigiflazzCatalog} disabled={isMutating} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-500 px-5 py-3 text-sm font-extrabold text-white transition-all hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-slate-300" data-testid="digiflazz-sync-button">
              {isMutating ? <Loader2 size={17} className="animate-spin" /> : <RefreshCcw size={17} />} Sync Produk Digiflazz
            </button>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl bg-amber-50 p-4"><p className="text-xs font-bold uppercase text-amber-700">Saldo deposit</p><p className="mt-1 text-xl font-extrabold text-slate-900" data-testid="digiflazz-balance">{digiflazzOps?.balance.deposit === null || digiflazzOps?.balance.deposit === undefined ? 'Belum tersedia' : formatRupiah(digiflazzOps.balance.deposit)}</p></div>
            <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase text-slate-500">Produk cache</p><p className="mt-1 text-xl font-extrabold text-slate-900" data-testid="digiflazz-product-count">{digiflazzOps?.catalog.product_count ?? products.length}</p></div>
            <div className="rounded-2xl bg-emerald-50 p-4"><p className="text-xs font-bold uppercase text-emerald-700">Aktif / nonaktif</p><p className="mt-1 text-xl font-extrabold text-slate-900" data-testid="digiflazz-active-count">{digiflazzOps?.catalog.active_count ?? activeProducts} / {digiflazzOps?.catalog.inactive_count ?? Math.max(products.length - activeProducts, 0)}</p></div>
            <div className="rounded-2xl bg-rose-50 p-4"><p className="text-xs font-bold uppercase text-rose-700">Webhook gagal</p><p className="mt-1 text-xl font-extrabold text-slate-900" data-testid="digiflazz-webhook-failed">{digiflazzOps?.webhooks.failed_count ?? monitoring?.summary.failed_webhook_count ?? 0}</p></div>
          </div>
          <p className="mt-4 text-xs font-semibold text-slate-500" data-testid="digiflazz-last-sync">Last sync: {digiflazzOps?.catalog.last_synced_at ? formatDateTime(digiflazzOps.catalog.last_synced_at) : 'Belum ada sync Digiflazz tercatat.'}</p>
        </section>

        <div className="grid gap-6 lg:grid-cols-2" data-testid="admin-monitoring">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-extrabold uppercase tracking-wider text-emerald-600">Transactions</p><h2 className="text-2xl font-extrabold text-slate-900">Transaksi terbaru</h2>
            <div className="mt-5 space-y-3">
              {monitoredTransactions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500" data-testid="admin-transactions-empty">Belum ada transaksi.</div>
              ) : (
                monitoredTransactions.map((transaction) => (
                  <article key={transaction.order_id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4" data-testid={`admin-transaction-${transaction.order_id}`}>
                    <div className="flex items-start justify-between gap-3"><div><h3 className="font-bold text-slate-900">{transaction.product_code}</h3><p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{transaction.invoice_code}</p></div><span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-600">{transaction.status}</span></div>
                    <p className="mt-3 text-lg font-extrabold text-slate-900">{formatRupiah(transaction.amount_minor)}</p>
                    <p className="mt-1 text-xs text-slate-500">{formatDateTime(transaction.created_at)} � Payment {transaction.payment?.status ?? 'none'} � Fulfillment {transaction.fulfillment?.status ?? 'none'}</p>
                  </article>
                ))
              )}
            </div>
          </section>
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-extrabold uppercase tracking-wider text-sky-600">Webhooks</p><h2 className="text-2xl font-extrabold text-slate-900">Webhook terbaru</h2>
            <div className="mt-5 space-y-3">
              {monitoredWebhooks.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500" data-testid="admin-webhooks-empty">Belum ada webhook.</div>
              ) : (
                monitoredWebhooks.map((webhook) => (
                  <article key={webhook.webhook_id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4" data-testid={`admin-webhook-${webhook.webhook_id}`}>
                    <div className="flex items-start justify-between gap-3"><div><h3 className="font-bold text-slate-900">{webhook.provider}</h3><p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{webhook.event_type}</p></div><span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-600">{webhook.processing_state}</span></div>
                    <p className="mt-3 text-xs text-slate-500">{webhook.event_key}</p>
                    <p className="mt-1 text-xs text-slate-500">{formatDateTime(webhook.received_at)}</p>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm" aria-labelledby="admin-products-title">
            <p className="text-xs font-extrabold uppercase tracking-wider text-amber-600">Products</p><h2 id="admin-products-title" className="text-2xl font-extrabold text-slate-900">Katalog produk</h2>
            <form onSubmit={createProduct} className="mt-5 grid gap-3 md:grid-cols-2" data-testid="admin-product-form">
              <input aria-label="SKU produk" value={productForm.sku_digiflazz} onChange={(event) => setProductForm({ ...productForm, sku_digiflazz: event.target.value })} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100" placeholder="SKU Digiflazz" required />
              <input aria-label="Nama produk" value={productForm.name} onChange={(event) => setProductForm({ ...productForm, name: event.target.value })} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100" placeholder="Nama produk" required />
              <input aria-label="Kategori produk" value={productForm.category} onChange={(event) => setProductForm({ ...productForm, category: event.target.value })} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100" placeholder="Kategori" required />
              <input aria-label="Provider produk" value={productForm.provider} onChange={(event) => setProductForm({ ...productForm, provider: event.target.value })} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100" placeholder="Provider" required />
              <input aria-label="Harga dasar produk" type="number" min="0" value={productForm.base_price_minor} onChange={(event) => setProductForm({ ...productForm, base_price_minor: event.target.value })} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100" placeholder="Harga dasar" required />
              <input aria-label="URL gambar produk" value={productForm.image_url} onChange={(event) => setProductForm({ ...productForm, image_url: event.target.value })} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100" placeholder="URL/base64 gambar opsional" />
              <button type="submit" disabled={isMutating} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-extrabold text-white transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300" data-testid="admin-product-create">{isMutating ? <Loader2 size={17} className="animate-spin" /> : <Boxes size={17} />} Buat produk</button>
            </form>
            <AdminProductUpload
              token={token}
              disabled={isMutating || !isAdmin}
              onUploaded={(nextProducts, summary) => {
                setProducts(nextProducts);
                setNotice(summary);
                setError(null);
              }}
            />
            <form onSubmit={uploadCategoryImage} className="mt-5 rounded-3xl border border-amber-100 bg-amber-50/70 p-4" data-testid="admin-category-image-form">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                <label className="flex-1 text-sm font-bold text-slate-700">
                  Kategori gambar
                  <select value={categoryImageForm.category} onChange={(event) => setCategoryImageForm({ ...categoryImageForm, category: event.target.value })} className="mt-1 w-full rounded-2xl border border-amber-200 bg-white px-4 py-3 text-sm outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100" required>
                    <option value="">Pilih kategori</option>
                    {productCategories.map((category) => <option key={category} value={category}>{category}</option>)}
                  </select>
                </label>
                <label className="flex-1 text-sm font-bold text-slate-700">
                  Upload gambar
                  <input type="file" accept="image/*" onChange={(event) => void handleCategoryImageFile(event.target.files?.[0])} className="mt-1 w-full rounded-2xl border border-amber-200 bg-white px-4 py-2 text-sm outline-none file:mr-3 file:rounded-xl file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-xs file:font-bold file:text-white" />
                </label>
                <input aria-label="URL gambar kategori" value={categoryImageForm.image_url} onChange={(event) => setCategoryImageForm({ ...categoryImageForm, image_url: event.target.value })} className="flex-1 rounded-2xl border border-amber-200 bg-white px-4 py-3 text-sm outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100" placeholder="Atau paste URL/base64" />
                <button type="submit" disabled={isMutating || categoryImageForm.category === '' || categoryImageForm.image_url === ''} className="rounded-2xl bg-amber-400 px-5 py-3 text-sm font-extrabold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-slate-200" data-testid="admin-category-image-save">Simpan gambar kategori</button>
              </div>
              <p className="mt-2 text-xs text-slate-500">Gambar diterapkan ke semua produk dalam kategori yang dipilih. Di frontend semua gambar dipaksa rasio sama dan object-cover agar rapi di desktop/mobile.</p>
            </form>
            <div className="mt-5 space-y-3">
              {products.map((product) => <article key={product.id} className="rounded-2xl border border-slate-200 p-4" data-testid={`admin-product-${product.id}`}><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3">{typeof product.metadata.image_url === 'string' && <img src={product.metadata.image_url} alt={product.name} className="h-14 w-14 rounded-2xl object-cover" loading="lazy" />}<div><h3 className="font-extrabold text-slate-900">{product.name}</h3><p className="text-sm text-slate-500">{product.sku_digiflazz} · {product.category} · {formatRupiah(product.base_price_minor)}</p></div></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => void updateProduct(product, { name: product.name + ' Updated' })} disabled={isMutating} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition-all hover:bg-slate-50 disabled:opacity-60" data-testid={`admin-product-update-${product.id}`}>Update</button><button type="button" onClick={() => void updateProduct(product, { is_active: !product.is_active })} disabled={isMutating} className="inline-flex items-center gap-1 rounded-xl bg-amber-400 px-3 py-2 text-xs font-extrabold text-slate-950 transition-all hover:bg-amber-300 disabled:opacity-60" data-testid={`admin-product-toggle-${product.id}`}><ToggleLeft size={14} />{product.is_active ? 'Nonaktifkan' : 'Aktifkan'}</button><button type="button" onClick={() => void deleteProduct(product.id)} disabled={isMutating} className="inline-flex items-center gap-1 rounded-xl border border-rose-200 px-3 py-2 text-xs font-extrabold text-rose-600 transition-all hover:bg-rose-50 disabled:opacity-60" data-testid={`admin-product-delete-${product.id}`}><Trash2 size={14} />Hapus</button></div></div></article>)}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm" aria-labelledby="admin-pricing-title">
            <p className="text-xs font-extrabold uppercase tracking-wider text-sky-600">Margins</p><h2 id="admin-pricing-title" className="text-2xl font-extrabold text-slate-900">Pricing rules</h2>
            <form onSubmit={createPricingRule} className="mt-5 grid gap-3 md:grid-cols-2" data-testid="admin-pricing-form">
              <select aria-label="Scope pricing" value={pricingForm.scope_type} onChange={(event) => setPricingForm({ ...pricingForm, scope_type: event.target.value as PricingScopeType })} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"><option value="global">Global</option><option value="category">Category</option><option value="product">Product</option></select>
              <select aria-label="Role pricing" value={pricingForm.role_type} onChange={(event) => setPricingForm({ ...pricingForm, role_type: event.target.value as AuthUserRole })} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"><option value="pengguna">Member</option><option value="seller">Reseller</option><option value="admin">Admin</option></select>
              <input aria-label="Produk pricing" value={pricingForm.product_id} onChange={(event) => setPricingForm({ ...pricingForm, product_id: event.target.value })} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100" placeholder="Product ID untuk scope product" />
              <input aria-label="Kategori pricing" value={pricingForm.category} onChange={(event) => setPricingForm({ ...pricingForm, category: event.target.value })} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100" placeholder="Category untuk scope category" />
              <input aria-label="Markup fixed" type="number" min="0" value={pricingForm.markup_fixed} onChange={(event) => setPricingForm({ ...pricingForm, markup_fixed: event.target.value })} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100" required />
              <input aria-label="Markup percentage" type="number" min="0" step="0.01" value={pricingForm.markup_percentage} onChange={(event) => setPricingForm({ ...pricingForm, markup_percentage: event.target.value })} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100" required />
              <input aria-label="Priority pricing" type="number" value={pricingForm.priority} onChange={(event) => setPricingForm({ ...pricingForm, priority: event.target.value })} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100" required />
              <button type="submit" disabled={isMutating} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-extrabold text-white transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300" data-testid="admin-pricing-create">{isMutating ? <Loader2 size={17} className="animate-spin" /> : <SlidersHorizontal size={17} />} Buat pricing rule</button>
            </form>
            <div className="mt-5 space-y-3">
              {pricingRules.map((rule) => <article key={rule.id} className="rounded-2xl border border-slate-200 p-4" data-testid={`admin-pricing-${rule.id}`}><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-extrabold text-slate-900">{roleLabel(rule.role_type)} · {rule.scope_type}</h3><p className="text-sm text-slate-500">Fixed {formatRupiah(rule.markup_fixed)} · {rule.markup_percentage}% · priority {rule.priority}</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => void updatePricingRule(rule, { markup_fixed: rule.markup_fixed + 100 })} disabled={isMutating} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition-all hover:bg-slate-50 disabled:opacity-60" data-testid={`admin-pricing-update-${rule.id}`}>Update margin</button><button type="button" onClick={() => void updatePricingRule(rule, { is_active: !rule.is_active })} disabled={isMutating} className="rounded-xl bg-sky-100 px-3 py-2 text-xs font-extrabold text-sky-700 transition-all hover:bg-sky-200 disabled:opacity-60" data-testid={`admin-pricing-toggle-${rule.id}`}>{rule.is_active ? 'Pause' : 'Aktifkan'}</button></div></div></article>)}
            </div>
          </section>
        </div>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm" aria-labelledby="admin-users-title">
          <div className="flex items-center gap-3"><div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600"><UsersRound size={22} /></div><div><p className="text-xs font-extrabold uppercase tracking-wider text-emerald-600">Users</p><h2 id="admin-users-title" className="text-2xl font-extrabold text-slate-900">User dan reseller</h2></div></div>
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {users.map((user) => <article key={user.id} className="rounded-2xl border border-slate-200 p-4" data-testid={`admin-user-${user.id}`}><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-extrabold text-slate-900">{user.email}</h3><p className="text-sm text-slate-500">{roleLabel(user.role)} · {resellerLabel(user.reseller_status)} · {user.is_reseller_active ? 'aktif' : 'nonaktif'}</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => void updateUserReseller(user, 'approve')} disabled={isMutating} className="inline-flex items-center gap-1 rounded-xl bg-emerald-100 px-3 py-2 text-xs font-extrabold text-emerald-700 transition-all hover:bg-emerald-200 disabled:opacity-60" data-testid={`admin-user-approve-${user.id}`}><UserCheck size={14} />Approve</button><button type="button" onClick={() => void updateUserReseller(user, 'suspend')} disabled={isMutating} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition-all hover:bg-slate-50 disabled:opacity-60" data-testid={`admin-user-suspend-${user.id}`}>Suspend</button><button type="button" onClick={() => void updateUserReseller(user, 'demote')} disabled={isMutating} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition-all hover:bg-slate-50 disabled:opacity-60" data-testid={`admin-user-demote-${user.id}`}>Demote</button></div></div></article>)}
          </div>
        </section>
      </section>
    </main>
  );
}

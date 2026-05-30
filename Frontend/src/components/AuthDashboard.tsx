import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, BadgeCheck, Banknote, Boxes, CheckCircle2, Clock, CreditCard, Loader2, LogOut, ReceiptText, RefreshCw, ShieldCheck, Sparkles, UserRound, Wallet } from 'lucide-react';

import { bearerHeaders, readJsonApi } from '../lib/api';
import { setAuthToken, clearAuthToken } from '../lib/auth';

type AuthUserRole = 'admin' | 'seller' | 'pengguna';
type ResellerStatus = 'none' | 'requested' | 'approved' | 'rejected';

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

type AccountResponse = Readonly<{
  user: AuthUser;
}>;

type CatalogProduct = Readonly<{
  product: Readonly<{
    id: string;
    sku_digiflazz: string;
    name: string;
    category: string;
    provider: string;
  }>;
  role_type: AuthUserRole;
  base_price_minor: number;
  markup_minor: number;
  final_price_minor: number;
  pricing: Readonly<{
    source: string;
  }>;
}>;

type CatalogResponse = Readonly<{
  products: CatalogProduct[];
}>;

type TransactionHistoryItem = Readonly<{
  order_id: string;
  invoice_code: string;
  status: string;
  product_code: string;
  provider: string;
  amount_minor: number;
  currency: string;
  created_at: string;
  updated_at: string;
  payment: null | Readonly<{
    payment_id: string;
    provider: string;
    status: string;
    paid_at: string | null;
    updated_at: string;
  }>;
  fulfillment: null | Readonly<{
    fulfillment_id: string;
    provider: string;
    status: string;
    serial_number: string | null;
    processed_at: string | null;
    updated_at: string;
  }>;
}>;

type TransactionsResponse = Readonly<{
  transactions: TransactionHistoryItem[];
}>;

type PayoutBalance = Readonly<{
  payable_balance_minor: number;
}>;

type PayoutRequest = Readonly<{
  id: string;
  amount_minor: number;
  bank_name: string;
  account_number: string;
  account_holder: string;
  legal_name: string;
  nik: string;
  address: string;
  phone: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  created_at: string;
  updated_at: string;
}>;

type PayoutRequestsResponse = Readonly<{
  requests: PayoutRequest[];
}>;

type AuthMode = 'login' | 'register';

const storageKey = 'bayarku.auth.session';

function formatRupiah(amountMinor: number) {
  return 'Rp ' + amountMinor.toLocaleString('id-ID');
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function readStoredSession(): AuthSession | null {
  try {
    const value = window.localStorage.getItem(storageKey);
    if (value === null) {
      return null;
    }

    const session = JSON.parse(value) as Partial<AuthSession>;
    if (typeof session.token !== 'string' || typeof session.user?.email !== 'string') {
      return null;
    }

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

function resellerLabel(status: ResellerStatus) {
  const labels: Record<ResellerStatus, string> = {
    none: 'Belum diajukan',
    requested: 'Menunggu review admin',
    approved: 'Disetujui',
    rejected: 'Ditolak',
  };

  return labels[status];
}

function roleLabel(role: AuthUserRole) {
  const labels: Record<AuthUserRole, string> = {
    admin: 'Admin',
    seller: 'Reseller',
    pengguna: 'Member',
  };

  return labels[role];
}

export default function AuthDashboard() {
  const [session, setSession] = useState<AuthSession | null>(() => readStoredSession());
  const [accountUser, setAccountUser] = useState<AuthUser | null>(session?.user ?? null);
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
  const [transactions, setTransactions] = useState<TransactionHistoryItem[]>([]);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(Boolean(session));
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);
  const [isRequestingReseller, setIsRequestingReseller] = useState(false);
  const [resellerMessage, setResellerMessage] = useState<string | null>(null);

  const [payoutBalance, setPayoutBalance] = useState<number>(0);
  const [isLoadingPayoutBalance, setIsLoadingPayoutBalance] = useState(false);
  const [payoutRequests, setPayoutRequests] = useState<PayoutRequest[]>([]);
  const [isLoadingPayoutRequests, setIsLoadingPayoutRequests] = useState(false);
  const [isShowPayoutForm, setIsShowPayoutForm] = useState(false);
  const [isSubmittingPayout, setIsSubmittingPayout] = useState(false);
  const [payoutMessage, setPayoutMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [payoutForm, setPayoutForm] = useState({
    amount: '',
    bank_name: '',
    account_number: '',
    account_holder: '',
    legal_name: '',
    nik: '',
    address: '',
    phone: '',
  });

  const token = session?.token ?? null;
  const visibleProducts = useMemo(() => catalogProducts.slice(0, 4), [catalogProducts]);

  const loadDashboardData = useCallback(async (activeToken: string) => {
    setIsLoadingDashboard(true);
    setDashboardError(null);

    try {
      const [mePayload, accountPayload, catalogPayload, transactionsPayload] = await Promise.all([
        readJsonApi<AccountResponse>('/auth/me', { headers: bearerHeaders(activeToken) }),
        readJsonApi<AccountResponse>('/account/status', { headers: bearerHeaders(activeToken) }),
        readJsonApi<CatalogResponse>('/catalog/products', { headers: bearerHeaders(activeToken) }),
        readJsonApi<TransactionsResponse>('/account/transactions', { headers: bearerHeaders(activeToken) }),
      ]);

      setAccountUser(accountPayload.user);
      setCatalogProducts(catalogPayload.products);
      setTransactions(transactionsPayload.transactions);
      setSession((currentSession) => {
        if (currentSession === null) {
          return currentSession;
        }

        const updatedSession = { ...currentSession, user: mePayload.user };
        storeSession(updatedSession);
        return updatedSession;
      });
    } catch (error) {
      setSession(null);
      setAccountUser(null);
      setCatalogProducts([]);
      setTransactions([]);
      storeSession(null);
      setDashboardError(error instanceof Error ? error.message : 'Sesi tidak valid. Silakan masuk lagi.');
    } finally {
      setIsLoadingDashboard(false);
    }
  }, []);

  const loadPayoutData = useCallback(async (activeToken: string) => {
    setIsLoadingPayoutBalance(true);
    setIsLoadingPayoutRequests(true);

    try {
      const [balancePayload, requestsPayload] = await Promise.all([
        readJsonApi<PayoutBalance>('/payout/balance', { headers: bearerHeaders(activeToken) }),
        readJsonApi<PayoutRequestsResponse>('/payout/requests', { headers: bearerHeaders(activeToken) }),
      ]);

      setPayoutBalance(balancePayload.payable_balance_minor);
      setPayoutRequests(requestsPayload.requests);
    } catch {
      setPayoutBalance(0);
      setPayoutRequests([]);
    } finally {
      setIsLoadingPayoutBalance(false);
      setIsLoadingPayoutRequests(false);
    }
  }, []);

  useEffect(() => {
    if (token === null) {
      setIsLoadingDashboard(false);
      setCatalogProducts([]);
      setTransactions([]);
      return;
    }

    void loadDashboardData(token);
  }, [loadDashboardData, token]);

  useEffect(() => {
    if (token === null || accountUser?.role !== 'seller') {
      return;
    }

    void loadPayoutData(token);
  }, [loadPayoutData, token, accountUser?.role]);

  const submitAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmittingAuth(true);
    setAuthError(null);
    setDashboardError(null);
    setResellerMessage(null);

    try {
      const payload = await readJsonApi<AuthSession>(authMode === 'login' ? '/auth/login' : '/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      storeSession(payload);
      setSession(payload);
      setAccountUser(payload.user);
      setAuthToken(payload.token);
      setEmail('');
      setPassword('');
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Autentikasi gagal.');
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const logout = () => {
    storeSession(null);
    setSession(null);
    setAccountUser(null);
    setCatalogProducts([]);
    setTransactions([]);
    setDashboardError(null);
    setResellerMessage(null);
    clearAuthToken();
  };

  const requestReseller = async () => {
    if (token === null) {
      return;
    }

    setIsRequestingReseller(true);
    setResellerMessage(null);

    try {
      const payload = await readJsonApi<AccountResponse>('/account/reseller-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...bearerHeaders(token),
        },
        body: JSON.stringify({}),
      });
      setAccountUser(payload.user);
      setSession((currentSession) => {
        if (currentSession === null) {
          return currentSession;
        }

        const updatedSession = { ...currentSession, user: payload.user };
        storeSession(updatedSession);
        return updatedSession;
      });
      setResellerMessage('Permintaan reseller tersimpan. Status terbaru ditampilkan di sini.');
    } catch (error) {
      setResellerMessage(error instanceof Error ? error.message : 'Permintaan reseller gagal.');
    } finally {
      setIsRequestingReseller(false);
    }
  };

  const submitPayoutRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (token === null) {
      return;
    }

    setIsSubmittingPayout(true);
    setPayoutMessage(null);

    try {
      const amountIdr = parseFloat(payoutForm.amount);
      if (isNaN(amountIdr) || amountIdr <= 0) {
        throw new Error('Jumlah penarikan tidak valid.');
      }

      const amountMinor = Math.round(amountIdr * 100);

      await readJsonApi<{ message?: string }>('/payout/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...bearerHeaders(token),
        },
        body: JSON.stringify({
          amount_minor: amountMinor,
          bank_name: payoutForm.bank_name,
          account_number: payoutForm.account_number,
          account_holder: payoutForm.account_holder,
          legal_name: payoutForm.legal_name,
          nik: payoutForm.nik,
          address: payoutForm.address,
          phone: payoutForm.phone || undefined,
        }),
      });

      setPayoutMessage({ type: 'success', text: 'Pengajuan penarikan berhasil dikirim. Status: Menunggu' });
      setPayoutForm({
        amount: '',
        bank_name: '',
        account_number: '',
        account_holder: '',
        legal_name: '',
        nik: '',
        address: '',
        phone: '',
      });
      setIsShowPayoutForm(false);
      void loadPayoutData(token);
    } catch (error) {
      setPayoutMessage({ type: 'error', text: error instanceof Error ? error.message : 'Pengajuan penarikan gagal.' });
    } finally {
      setIsSubmittingPayout(false);
    }
  };

  const formatPayoutRupiah = (amountMinor: number) => {
    const amount = amountMinor / 100;
    return 'Rp ' + amount.toLocaleString('id-ID');
  };

  const payoutStatusLabel = (status: PayoutRequest['status']) => {
    const labels: Record<PayoutRequest['status'], string> = {
      pending: 'Menunggu',
      approved: 'Disetujui',
      rejected: 'Ditolak',
      paid: 'Dibayar',
    };
    return labels[status];
  };

  if (session === null || token === null) {
    return (
      <main className="pt-24 pb-16 bg-slate-50 min-h-screen">
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-6 items-stretch">
            <div className="relative overflow-hidden rounded-3xl bg-slate-900 p-8 sm:p-10 shadow-xl shadow-slate-200">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-400/20 via-sky-500/10 to-emerald-500/10" />
              <div className="relative max-w-xl">
                <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-200">
                  <ShieldCheck size={14} /> Area member
                </span>
                <h1 className="mt-5 text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                  Masuk untuk melihat dashboard transaksi Adnanpay.
                </h1>
                <p className="mt-4 text-slate-300 leading-7">
                  Dashboard membutuhkan token backend aktif. Pengunjung anonim tetap aman karena data akun, status reseller, dan harga katalog role-aware tidak dimuat sebelum login.
                </p>
                {dashboardError && (
                  <div className="mt-5 flex items-start gap-2 rounded-2xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-100" data-testid="dashboard-error">
                    <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
                    <span>{dashboardError}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/70" data-testid="auth-panel">
              <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setAuthMode('login')}
                  className={`rounded-xl px-4 py-2 text-sm font-bold transition-all ${authMode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Masuk
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode('register')}
                  className={`rounded-xl px-4 py-2 text-sm font-bold transition-all ${authMode === 'register' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Daftar
                </button>
              </div>

              <form onSubmit={submitAuth} className="mt-6 space-y-4">
                <div>
                  <label htmlFor="dashboard-email" className="text-sm font-semibold text-slate-700">
                    Email
                  </label>
                  <input
                    id="dashboard-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition-all focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                    placeholder="member@example.com"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="dashboard-password" className="text-sm font-semibold text-slate-700">
                    Password
                  </label>
                  <input
                    id="dashboard-password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition-all focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                    placeholder="Minimal 8 karakter"
                    required
                    minLength={8}
                  />
                </div>

                {authError && (
                  <div className="flex items-start gap-2 rounded-2xl border border-rose-100 bg-rose-50 p-3 text-sm text-rose-700" data-testid="auth-error">
                    <AlertCircle size={17} className="mt-0.5 flex-shrink-0" />
                    <span>{authError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmittingAuth}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-400 px-5 py-3 text-sm font-extrabold text-slate-950 shadow-lg shadow-amber-200 transition-all hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-70"
                  data-testid="auth-submit"
                >
                  {isSubmittingAuth ? <Loader2 size={18} className="animate-spin" /> : <UserRound size={18} />}
                  {authMode === 'login' ? 'Masuk ke dashboard' : 'Buat akun member'}
                </button>
              </form>
            </div>
          </div>
        </section>
      </main>
    );
  }

  const activeSession = session;

  return (
    <main className="pt-24 pb-16 bg-slate-50 min-h-screen">
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="relative overflow-hidden rounded-3xl bg-slate-900 p-6 sm:p-8 shadow-xl shadow-slate-200">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-400/20 via-sky-500/10 to-emerald-500/10" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-200">
                <CheckCircle2 size={14} /> Sesi aktif
              </span>
              <h1 className="mt-4 text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                Dashboard Member
              </h1>
              <p className="mt-2 text-slate-300" data-testid="dashboard-email">
                {accountUser?.email ?? activeSession.user.email}
              </p>
            </div>
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-bold text-white transition-all hover:bg-white/15"
            >
              <LogOut size={17} /> Logout
            </button>
          </div>
        </div>

        {isLoadingDashboard ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm" data-testid="dashboard-loading">
            <Loader2 size={28} className="mx-auto animate-spin text-amber-500" />
            <p className="mt-3 text-sm font-semibold text-slate-600">Memuat akun, status reseller, katalog, dan riwayat transaksi...</p>
          </div>
        ) : (
          <>
            {dashboardError && (
              <div className="flex items-start gap-2 rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-700" data-testid="dashboard-error">
                <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
                <span>{dashboardError}</span>
              </div>
            )}

            <div className="grid lg:grid-cols-3 gap-6">
              <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="rounded-2xl bg-amber-50 p-3 text-amber-600">
                    <BadgeCheck size={22} />
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-600" data-testid="dashboard-role">
                    {roleLabel(accountUser?.role ?? activeSession.user.role)}
                  </span>
                </div>
                <h2 className="mt-5 text-lg font-extrabold text-slate-900">Profil akun</h2>
                <p className="mt-2 text-sm text-slate-500">Role dan email berasal dari backend auth dan account status.</p>
              </article>

              <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-bold text-emerald-700">
                      <Sparkles size={17} /> Status reseller
                    </div>
                    <h2 className="mt-2 text-xl font-extrabold text-slate-900" data-testid="reseller-status">
                      {resellerLabel(accountUser?.reseller_status ?? activeSession.user.reseller_status)}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {accountUser?.is_reseller_active ? 'Harga reseller aktif untuk katalog.' : 'Ajukan reseller untuk ditinjau admin.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={requestReseller}
                    disabled={isRequestingReseller || accountUser?.reseller_status === 'requested' || accountUser?.reseller_status === 'approved'}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-extrabold text-white transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                    data-testid="reseller-request"
                  >
                    {isRequestingReseller ? <Loader2 size={17} className="animate-spin" /> : <RefreshCw size={17} />}
                    Ajukan reseller
                  </button>
                </div>
                {resellerMessage && (
                  <p className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-sm font-medium text-emerald-700" data-testid="reseller-message">
                    {resellerMessage}
                  </p>
                )}
              </article>
            </div>

            <div className="grid lg:grid-cols-[1.25fr_0.75fr] gap-6">
              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-extrabold text-slate-900">Harga katalog role-aware</h2>
                    <p className="mt-1 text-sm text-slate-500">Harga final ditampilkan langsung dari response backend katalog.</p>
                  </div>
                  <Boxes className="text-amber-500" size={24} />
                </div>
                <div className="mt-5 grid sm:grid-cols-2 gap-3" data-testid="catalog-products">
                  {visibleProducts.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 p-5 text-sm text-slate-500">Katalog belum tersedia.</div>
                  ) : (
                    visibleProducts.map((item) => (
                      <article key={item.product.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-bold text-slate-900">{item.product.name}</h3>
                            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{item.product.category}</p>
                          </div>
                          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-500">{item.role_type}</span>
                        </div>
                        <p className="mt-4 text-lg font-extrabold text-slate-900" data-testid={`catalog-price-${item.product.id}`}>
                          {formatRupiah(item.final_price_minor)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">Sumber pricing: {item.pricing.source}</p>
                      </article>
                    ))
                  )}
                </div>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="rounded-2xl bg-sky-50 p-3 text-sky-600 w-max">
                  <ReceiptText size={22} />
                </div>
                <h2 className="mt-5 text-xl font-extrabold text-slate-900">Riwayat transaksi</h2>
                <div className="mt-4 space-y-3" data-testid="transaction-history">
                  {transactions.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500" data-testid="transaction-empty-state">
                      Belum ada transaksi member.
                    </div>
                  ) : (
                    transactions.map((transaction) => (
                      <article key={transaction.order_id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4" data-testid={`transaction-${transaction.order_id}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-bold text-slate-900">{transaction.product_code}</h3>
                            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{transaction.invoice_code}</p>
                          </div>
                          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-600">{transaction.status}</span>
                        </div>
                        <p className="mt-4 text-lg font-extrabold text-slate-900">{formatRupiah(transaction.amount_minor)}</p>
                        <div className="mt-3 grid gap-2 text-xs text-slate-500">
                          <span>{formatDateTime(transaction.created_at)}</span>
                          <span>Payment: {transaction.payment?.status ?? 'belum ada'}</span>
                          <span>Fulfillment: {transaction.fulfillment?.status ?? 'belum ada'}</span>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </section>
            </div>

            {accountUser?.role === 'seller' && (
              <div className="space-y-6">
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-extrabold text-slate-900">Payout Komisi</h2>
                      <p className="mt-1 text-sm text-slate-500">Kelola penarikan saldo komisi reseller Anda.</p>
                    </div>
                    <Wallet className="text-amber-500" size={24} />
                  </div>

                  <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/50 p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-amber-800">Saldo Komisi Tersedia</p>
                        {isLoadingPayoutBalance ? (
                          <p className="mt-1 text-2xl font-extrabold text-slate-900">
                            <Loader2 size={24} className="animate-spin text-amber-500" />
                          </p>
                        ) : (
                          <p className="mt-1 text-2xl font-extrabold text-slate-900">
                            {formatPayoutRupiah(payoutBalance)}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsShowPayoutForm(!isShowPayoutForm)}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-400 px-5 py-3 text-sm font-extrabold text-slate-950 shadow-lg shadow-amber-200 transition-all hover:bg-amber-300"
                      >
                        <Banknote size={17} />
                        Ajukan Penarikan
                      </button>
                    </div>
                  </div>

                  {payoutMessage && (
                    <div className={`mt-4 flex items-start gap-2 rounded-2xl p-4 text-sm ${
                      payoutMessage.type === 'success'
                        ? 'border border-emerald-100 bg-emerald-50 text-emerald-700'
                        : 'border border-rose-100 bg-rose-50 text-rose-700'
                    }`}>
                      <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
                      <span>{payoutMessage.text}</span>
                    </div>
                  )}

                  {isShowPayoutForm && (
                    <form onSubmit={submitPayoutRequest} className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5 space-y-4">
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="payout-amount" className="text-sm font-semibold text-slate-700">
                            Jumlah (IDR)
                          </label>
                          <input
                            id="payout-amount"
                            type="number"
                            min="10000"
                            step="1"
                            value={payoutForm.amount}
                            onChange={(e) => setPayoutForm((f) => ({ ...f, amount: e.target.value }))}
                            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition-all focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                            placeholder="最低 Rp 10.000"
                            required
                          />
                        </div>
                        <div>
                          <label htmlFor="payout-bank" className="text-sm font-semibold text-slate-700">
                            Nama Bank
                          </label>
                          <input
                            id="payout-bank"
                            type="text"
                            value={payoutForm.bank_name}
                            onChange={(e) => setPayoutForm((f) => ({ ...f, bank_name: e.target.value }))}
                            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition-all focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                            placeholder="Contoh: BCA, BRI, Mandiri"
                            required
                          />
                        </div>
                        <div>
                          <label htmlFor="payout-account-number" className="text-sm font-semibold text-slate-700">
                            Nomor Rekening
                          </label>
                          <input
                            id="payout-account-number"
                            type="text"
                            value={payoutForm.account_number}
                            onChange={(e) => setPayoutForm((f) => ({ ...f, account_number: e.target.value }))}
                            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition-all focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                            placeholder="Nomor rekening bank"
                            required
                          />
                        </div>
                        <div>
                          <label htmlFor="payout-account-holder" className="text-sm font-semibold text-slate-700">
                            Nama Pemilik Rekening
                          </label>
                          <input
                            id="payout-account-holder"
                            type="text"
                            value={payoutForm.account_holder}
                            onChange={(e) => setPayoutForm((f) => ({ ...f, account_holder: e.target.value }))}
                            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition-all focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                            placeholder="Nama sesuai rekening bank"
                            required
                          />
                        </div>
                        <div>
                          <label htmlFor="payout-legal-name" className="text-sm font-semibold text-slate-700">
                            Nama Lengkap
                          </label>
                          <input
                            id="payout-legal-name"
                            type="text"
                            value={payoutForm.legal_name}
                            onChange={(e) => setPayoutForm((f) => ({ ...f, legal_name: e.target.value }))}
                            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition-all focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                            placeholder="Nama lengkap sesuai KTP"
                            required
                          />
                        </div>
                        <div>
                          <label htmlFor="payout-nik" className="text-sm font-semibold text-slate-700">
                            NIK
                          </label>
                          <input
                            id="payout-nik"
                            type="text"
                            value={payoutForm.nik}
                            onChange={(e) => setPayoutForm((f) => ({ ...f, nik: e.target.value }))}
                            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition-all focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                            placeholder="Nomor KTP"
                            required
                          />
                        </div>
                        <div>
                          <label htmlFor="payout-phone" className="text-sm font-semibold text-slate-700">
                            Telepon (Opsional)
                          </label>
                          <input
                            id="payout-phone"
                            type="tel"
                            value={payoutForm.phone}
                            onChange={(e) => setPayoutForm((f) => ({ ...f, phone: e.target.value }))}
                            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition-all focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                            placeholder="Nomor WhatsApp"
                          />
                        </div>
                      </div>
                      <div>
                        <label htmlFor="payout-address" className="text-sm font-semibold text-slate-700">
                          Alamat
                        </label>
                        <textarea
                          id="payout-address"
                          value={payoutForm.address}
                          onChange={(e) => setPayoutForm((f) => ({ ...f, address: e.target.value }))}
                          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition-all focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                          placeholder="Alamat lengkap sesuai KTP"
                          rows={3}
                          required
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isSubmittingPayout}
                        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-extrabold text-white shadow-lg transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {isSubmittingPayout ? <Loader2 size={18} className="animate-spin" /> : <CreditCard size={18} />}
                        Kirim Pengajuan Penarikan
                      </button>
                    </form>
                  )}
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-extrabold text-slate-900">Riwayat Penarikan</h2>
                      <p className="mt-1 text-sm text-slate-500">Lihat status pengajuan penarikan komisi sebelumnya.</p>
                    </div>
                    <Clock className="text-amber-500" size={24} />
                  </div>

                  <div className="mt-5 overflow-x-auto">
                    {isLoadingPayoutRequests ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 size={24} className="animate-spin text-amber-500" />
                      </div>
                    ) : payoutRequests.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
                        Belum ada pengajuan penarikan.
                      </div>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-100 text-left">
                            <th className="pb-3 font-bold text-slate-600">Tanggal</th>
                            <th className="pb-3 font-bold text-slate-600">Jumlah</th>
                            <th className="pb-3 font-bold text-slate-600">Bank</th>
                            <th className="pb-3 font-bold text-slate-600">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {payoutRequests.map((req) => (
                            <tr key={req.id} className="border-b border-slate-50 last:border-0">
                              <td className="py-3 text-slate-700">{formatDateTime(req.created_at)}</td>
                              <td className="py-3 font-extrabold text-slate-900">{formatPayoutRupiah(req.amount_minor)}</td>
                              <td className="py-3 text-slate-700">
                                {req.bank_name} - {req.account_number}
                              </td>
                              <td className="py-3">
                                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${
                                  req.status === 'pending'
                                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                    : req.status === 'approved' || req.status === 'paid'
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    : 'bg-rose-100 text-rose-800 border border-rose-200'
                                }`}>
                                  {payoutStatusLabel(req.status)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}

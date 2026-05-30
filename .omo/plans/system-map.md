# PPOB Payment Gateway — System Map

> Dokumen ini memetakan seluruh arsitektur, modul, alur data, dan infrastruktur aplikasi PPOB Payment Gateway (codename: BayarKu/AdnanPay).

---

## 1. Gambaran Umum Sistem

Aplikasi ini adalah **payment gateway PPOB** (Payment Point Online Bank) yang memungkinkan pengguna membeli produk digital (pulsa, paket data, token PLN, e-wallet, voucher game) melalui integrasi dengan **Digiflazz** (provider produk digital) dan pembayaran via **Midtrans** (payment gateway).

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│   Browser    │──────▶│   Frontend   │──────▶│   Backend    │──────▶│  Supabase    │
│  (React SPA) │◀──────│  (Vite+React)│◀──────│  (Express 5) │──────▶│  (Postgres)  │
└──────────────┘       └──────────────┘       └──────┬───────┘       └──────────────┘
                                                     │
                                                     ├──────▶ Digiflazz API (produk digital)
                                                     ├──────▶ Midtrans API (payment gateway)
                                                     └──────▶ MySQL (catalog fallback)
```

### Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Frontend | React 18, Vite 5, TypeScript, Tailwind CSS 3 |
| Backend | Express 5, TypeScript, Node.js |
| Database | Supabase (PostgreSQL) + MySQL (catalog fallback) |
| Auth | JWT (jsonwebtoken), bcryptjs |
| Testing | Jest (unit), Playwright (e2e), Supertest (API) |
| External APIs | Digiflazz (produk digital), Midtrans (payment) |
| Email | Nodemailer (SMTP) |
| Security | Helmet, CORS, express-rate-limit |
| Deployment | PM2, Nginx (reverse proxy), VPS |

---

## 2. Struktur Proyek

```
PPOB-Payment-Gateway/
├── Frontend/                    # React SPA
│   ├── src/
│   │   ├── App.tsx              # Router utama (hash-based)
│   │   ├── main.tsx             # Entry point
│   │   ├── components/          # UI components
│   │   │   ├── Header.tsx       # Navigation header
│   │   │   ├── Hero.tsx         # Landing hero section
│   │   │   ├── PromoCarousel.tsx
│   │   │   ├── Categories.tsx   # Category grid (Pulsa, PLN, Games, E-Money)
│   │   │   ├── HotDeals.tsx
│   │   │   ├── GameTopUp.tsx    # Top-up form (660+ lines, Midtrans path)
│   │   │   ├── ProductCatalog.tsx # Product catalog with checkout modal
│   │   │   ├── Checkout.tsx     # Checkout modal (~500 lines)
│   │   │   ├── ProductList.tsx
│   │   │   ├── Stats.tsx
│   │   │   ├── Features.tsx
│   │   │   ├── Footer.tsx
│   │   │   ├── InvoiceStatusPage.tsx  # Invoice tracking with polling
│   │   │   ├── AuthDashboard.tsx      # User/reseller dashboard
│   │   │   ├── AdminDashboard.tsx     # Admin dashboard
│   │   │   ├── AdminProductUpload.tsx
│   │   │   ├── LoginPage.tsx
│   │   │   ├── RegisterPage.tsx
│   │   │   ├── TransaksiPage.tsx      # Transaction history
│   │   │   ├── Navigation.tsx
│   │   │   └── admin/
│   │   │       └── VoucherManagement.tsx
│   │   ├── lib/
│   │   │   ├── api.ts           # API helpers (buildApiUrl, bearerHeaders, readJsonApi)
│   │   │   ├── auth.ts          # Token management (localStorage)
│   │   │   └── brand-images.ts  # Brand image mapping
│   │   └── test/
│   │       ├── setup.ts
│   │       └── app.smoke.test.tsx
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── package.json
│
├── backend/                     # Express API server
│   ├── src/
│   │   ├── index.ts             # Bootstrap & startup
│   │   ├── app.ts               # App factory (dependency injection)
│   │   ├── config/
│   │   │   └── env.ts           # Environment config parser & validator
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts
│   │   │   └── rate-limit.middleware.ts
│   │   ├── security/
│   │   │   ├── audit.ts         # Audit logger interface
│   │   │   ├── encryption.service.ts  # AES encryption for PII
│   │   │   └── rate-limit.ts    # Custom rate limiter
│   │   ├── shared/
│   │   │   └── validation.ts    # Zod schemas shared across modules
│   │   ├── modules/
│   │   │   ├── auth/            # Authentication & user management
│   │   │   ├── account/         # Account & reseller management
│   │   │   ├── admin/           # Admin operations
│   │   │   ├── catalog/         # Product catalog & pricing
│   │   │   ├── order/           # Order lifecycle
│   │   │   ├── payment/         # Payment processing (Midtrans)
│   │   │   ├── fulfillment/     # Order fulfillment (Digiflazz)
│   │   │   ├── postpaid/        # Postpaid bills (PLN, etc.)
│   │   │   ├── invoice-status/  # Invoice tracking
│   │   │   ├── dashboard/       # Dashboard & monitoring
│   │   │   ├── commission/      # Commission & affiliate
│   │   │   ├── payout/          # Payout/withdrawal
│   │   │   ├── audit/           # Provider audit trail
│   │   │   ├── digiflazz/       # Digiflazz buyer client
│   │   │   ├── email/           # Email service
│   │   │   ├── tax/             # Tax calculation
│   │   │   ├── reconcile/       # Reconciliation service
│   │   │   └── regression/      # Regression tests
│   │   ├── routes/
│   │   │   ├── health.ts        # Health check endpoints
│   │   │   ├── order.router.ts  # Legacy multi-item order (guest_orders)
│   │   │   ├── voucher.router.ts # Voucher CRUD & validation
│   │   │   └── dashboard.router.ts # Dashboard content
│   │   ├── scripts/             # Admin & data scripts
│   │   └── services/
│   │       └── product-cache.service.ts
│   ├── playwright-tests/        # E2E test suite
│   │   ├── guest.spec.ts
│   │   ├── reseller.spec.ts
│   │   ├── admin.spec.ts
│   │   ├── helpers/
│   │   │   └── api.ts
│   │   └── run-backend-checks.ts
│   ├── test-fixtures/
│   │   └── products.json
│   ├── package.json
│   └── tsconfig.json
│
└── mcp/                         # MCP integration stubs
    └── adnanpay-testsprite/
        └── index.js
```

---

## 3. Arsitektur Backend (Detail Modul)

### 3.1 Dependency Injection

Backend menggunakan **factory pattern** dengan dependency injection via `createApp(dependencies)`. Setiap modul menerima dependency melalui constructor, memungkinkan:
- Swap antara **InMemory** (test) dan **Supabase** (production) repository
- Inject mock `fetchImpl` untuk testing
- Configurable middleware dan rate limiting

### 3.2 Dual API Path Prefix

Rute didaftarkan pada **dua path prefix** sekaligus:
```
/api/*       → Direct access
/ppob-api/*  → Reverse proxy path
```

---

## 4. API Endpoint Map

### 4.1 Auth (`/api/auth`)

| Method | Path | Auth | Deskripsi |
|--------|------|------|-----------|
| POST | `/register` | Public | Registrasi user baru |
| POST | `/login` | Public | Login, returns JWT |
| GET | `/me` | Bearer | Ambil data user saat ini |
| GET | `/profile` | Bearer | Ambil profil lengkap |
| PUT | `/profile` | Bearer | Update profil (name, phone) |
| POST | `/change-pin` | Bearer | Ganti PIN transaksi |
| POST | `/email-verification/request` | Bearer | Kirim email verifikasi |
| POST | `/email-verification/resend` | Bearer | Kirim ulang email verifikasi |
| POST | `/email-verification/verify` | Bearer | Verifikasi token email |

### 4.2 Account (`/api/account`) — Auth Required

| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/status` | Status akun sendiri |
| GET | `/users/:userId/status` | Status akun user lain |
| POST | `/reseller-request` | Ajukan menjadi reseller |

### 4.3 Catalog (`/api/catalog`) — Public

| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/products` | List produk dengan paginasi, search, filter category |
| POST | `/products/:productId/prepare-order` | Quote harga produk berdasarkan role |

### 4.4 Catalog Admin (`/api/admin/catalog`) — Admin Only

| Method | Path | Deskripsi |
|--------|------|-----------|
| POST | `/digiflazz/price-list/sync` | Sync harga dari Digiflazz |
| GET | `/products` | List semua produk (admin) |
| POST | `/products` | Buat produk baru |
| PATCH | `/products/:productId` | Update produk |
| DELETE | `/products/:productId` | Hapus produk |
| GET | `/pricing-rules` | List pricing rules |
| POST | `/pricing-rules` | Buat pricing rule |
| PATCH | `/pricing-rules/:ruleId` | Update pricing rule |

### 4.5 Orders (`/api/orders`) — Public (guest) / Bearer (user)

| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/` | List order history (auth required) |
| POST | `/` | Buat order (guest atau user) |
| POST | `/create` | Buat multi-item order (legacy, guest_orders table) |
| GET | `/:orderId` | Detail order (legacy) |
| PUT | `/:orderId/status` | Update order status (legacy) |

### 4.6 Payments (`/api/payments`) — Rate Limited

| Method | Path | Deskripsi |
|--------|------|-----------|
| POST | `/midtrans/initialize` | Initialize Midtrans Snap payment |
| POST | `/midtrans/webhook` | Webhook callback dari Midtrans |

### 4.7 Fulfillments (`/api/fulfillments` + `/api/webhook`) — Rate Limited

| Method | Path | Deskripsi |
|--------|------|-----------|
| POST | `/digiflazz/trigger` | Trigger fulfillment manual |
| POST | `/digiflazz/recheck` | Recheck status fulfillment |
| POST | `/digiflazz/callback` | Webhook callback dari Digiflazz |

### 4.8 Postpaid (`/api/digiflazz`) — Auth Required

| Method | Path | Deskripsi |
|--------|------|-----------|
| POST | `/inq-pasca` | Inquiry tagihan pascabayar |
| POST | `/pay-pasca` | Bayar tagihan pascabayar |
| POST | `/status-pasca` | Cek status pembayaran pascabayar |
| POST | `/v1/transaction` | Digiflazz-compatible multi-command |
| POST | `/v1/inquiry-pln` | Inquiry PLN meter |
| POST | `/postpaid/inquiries` | Alias inquiry |
| POST | `/postpaid/payments` | Alias payment |
| POST | `/postpaid/status` | Alias status |

### 4.9 Payout (`/api/payout`) — Auth Required

| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/balance` | Saldo payable user |
| POST | `/request` | Ajukan pencairan (seller only) |
| GET | `/requests` | List history pencairan |

### 4.10 Invoice Status (`/api/invoices`) — Public

| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/:invoiceCode/status` | Cek status invoice + timeline |

### 4.11 Vouchers (`/api/vouchers`) — Public/Mixed

| Method | Path | Deskripsi |
|--------|------|-----------|
| POST | `/validate` | Validasi kode voucher |
| POST | `/apply` | Apply voucher ke order |
| POST | `/create` | Buat voucher baru |
| GET | `/list` | List semua voucher |
| PUT | `/:id` | Update voucher |
| DELETE | `/:id` | Hapus voucher |
| GET | `/:id/stats` | Statistik penggunaan voucher |

### 4.12 Admin (`/api/admin`) — Admin Only

| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/users` | List semua user |
| GET | `/users/:userId` | Detail user |
| POST | `/users/:userId/reseller/approve` | Approve reseller |
| POST | `/users/:userId/reseller/demote` | Demote seller |
| POST | `/users/:userId/reseller/suspend` | Suspend seller |
| POST | `/products/upload` | Upload produk via Excel |
| GET | `/monitoring` | Admin monitoring dashboard |
| GET | `/audit` | Audit trail |
| GET | `/commission/performance` | Commission performance |
| GET | `/digiflazz/operations` | Digiflazz operations |

### 4.13 Dashboard & Account (Auth Required)

| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/api/account/transactions` | Transaksi user |
| GET | `/api/account/audit` | Audit trail user |
| GET | `/api/account/commission/performance` | Performance curve |
| GET | `/api/dashboard/*` | Dashboard content |

### 4.14 Health Check

| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/health` | Health check |
| GET | `/api/health` | API health check |

---

## 5. Data Model

### 5.1 User & Auth

```
AuthUser {
  id: string (UUID)
  email: string
  role: "admin" | "seller" | "pengguna"
  is_reseller_active: boolean
  reseller_status: "none" | "requested" | "approved" | "rejected"
  email_verified_at: Date | null
  password_hash: string (bcrypt)
  metadata: { name, no_hp, pin_hash }
  created_at: Date
  updated_at: Date
}
```

### 5.2 Order Lifecycle

```
Status Flow:
  created → pending_payment → paid → fulfillment_pending → success
                                                       ↘ failed
  pending_payment → expired
  any → cancelled
```

```
OrderRecord {
  id: UUID
  order_number: string (invoice code)
  customer_ref: string | null      # Nomor tujuan (HP, meter, dll)
  user_id: UUID | null             # null = guest
  product_code: string             # Digiflazz SKU
  provider: string
  amount_minor: number             # Harga dalam satuan terkecil
  currency: string
  status: OrderStatus
  referral_code: string | null
  discount_code: string | null
  discount_amount_minor: number | null
  base_price_snapshot: number      # Harga dasar saat order
  markup_snapshot: number          # Markup saat order
  role_price_snapshot: number      # Harga final saat order
  pricing_rule_id_snapshot: UUID   # Pricing rule yang dipakai
  metadata: JSON
  created_at: Date
  updated_at: Date
}
```

### 5.3 Payment

```
PaymentRecord {
  id: UUID
  order_id: UUID
  provider: "midtrans"
  idempotency_key: string
  provider_payment_id: string | null
  provider_reference: string | null
  amount_minor: number
  currency: string
  status: "pending" | "paid" | "failed" | "expired" | "cancelled" | "refunded"
  paid_at: Date | null
  payload: JSON
}

WebhookEventRecord {
  id: UUID
  provider: string
  event_key: string
  event_type: string
  order_id: UUID | null
  payment_id: UUID | null
  payload: JSON
  processing_state: "pending" | "processed" | "ignored" | "failed"
}
```

### 5.4 Fulfillment

```
FulfillmentRecord {
  id: UUID
  order_id: UUID
  provider: "digiflazz"
  attempt_no: number
  provider_fulfillment_id: string | null
  provider_reference: string | null
  status: "queued" | "processing" | "success" | "failed"
  serial_number: string | null     # SN/token dari Digiflazz
  request_payload: JSON
  response_payload: JSON
  processed_at: Date | null
}
```

### 5.5 Catalog & Pricing

```
ProductRecord {
  id: UUID
  sku_digiflazz: string
  name: string
  category: string                 # "Pulsa", "Data", "Games", "E-Money", "PLN"
  provider: string                 # "digiflazz"
  base_price_minor: number
  is_active: boolean
  metadata: JSON
}

PricingRuleRecord {
  id: UUID
  scope_type: "global" | "category" | "product"
  product_id: UUID | null
  category: string | null
  role_type: "admin" | "seller" | "pengguna"
  markup_fixed: number             # Markup tetap (minor)
  markup_percentage: number        # Markup persentase (basis points)
  priority: number
  is_active: boolean
}
```

### 5.6 Payout

```
PayoutRequest {
  id: UUID
  user_id: UUID
  amount_minor: number
  status: string
  identity_data: encrypted JSON    # bank_name, account_number, etc
  created_at: Date
}
```

### 5.7 Voucher (Supabase Tables)

```
voucher_codes {
  id, code, type, discount_type, discount_value,
  max_usage, current_usage, is_active,
  valid_from, valid_until, applies_to, metadata
}

voucher_usage {
  id, voucher_code_id, order_id, user_id,
  discount_amount, original_amount, final_amount, used_at
}
```

### 5.8 Guest Orders (Legacy — Supabase Tables)

```
guest_orders {
  id, order_number, user_id, status,
  total_amount_minor, discount_amount_minor, final_amount_minor,
  voucher_code_id, payment_status, metadata
}

guest_order_items {
  id, order_id, product_id, product_sku, product_name,
  quantity, unit_price_minor, total_price_minor,
  customer_phone, customer_email, status, metadata
}
```

---

## 6. External API Integrations

### 6.1 Digiflazz (Product Provider)

**Base URL:** `https://api.digiflazz.com`

| Endpoint | Fungsi | Digunakan Oleh |
|----------|--------|----------------|
| `POST /v1/transaction` | Topup prepaid, postpaid inquiry/pay/status | FulfillmentService, PostpaidService |
| `POST /v1/price-list` | Ambil daftar harga produk | DigiflazzPriceListSyncService |
| `POST /v1/cek-saldo` | Cek saldo deposit Digiflazz | Dashboard (admin) |
| `POST /v1/inquiry-pln` | Inquiry PLN meter | PostpaidService |
| `POST /v1/deposit` | Buat tiket deposit | Dashboard (admin) |

**Authentication:** MD5 hash `md5(username + apiKey + sign_seed)`
- Sign seed: `ref_id` (topup), `"pricelist"` (price list), `"depo"` (balance)

**Webhook:** Digiflazz mengirim callback ke `/api/fulfillments/digiflazz/callback` dengan HMAC-SHA1 signature via `x-hub-signature` header.

**Topup Options (configurable):**
- `testing: boolean` — Mode testing Digiflazz
- `max_price: number` — Batas harga maksimum
- `callback_url: string` — URL callback custom
- `allow_dot: boolean` — Izinkan nomor dengan titik

### 6.2 Midtrans (Payment Gateway)

**Base URL:** `https://app.sandbox.midtrans.com` (sandbox) / `https://app.midtrans.com` (production)

| Endpoint | Fungsi |
|----------|--------|
| `POST /snap/v1/transactions` | Buat Snap token untuk payment popup |
| `POST /v2/charge` | Charge payment (credit card, bank transfer, e-wallet) |
| `GET /v2/{order_id}/status` | Cek status transaksi |

**Authentication:** Server Key via `Authorization: Basic base64(serverKey:)`

**Webhook:** Midtrans mengirim webhook ke `/api/payments/midtrans/webhook` dengan signature verification via `signature_key = SHA512(order_id + status_code + gross_amount + server_key)`.

**Payment Methods:** Credit Card, BCA VA, BRI VA, BNI VA, GoPay, dll.

---

## 7. Frontend Architecture

### 7.1 Routing (Hash-based SPA)

Frontend menggunakan **custom hash router** (bukan React Router), menggunakan `window.history.pushState` + custom event `bayarku:navigate`.

| Route | Page Component | Auth | Deskripsi |
|-------|---------------|------|-----------|
| `/` | Landing (Hero+PromoCarousel+Categories+HotDeals+Stats+Features) | Public | Homepage |
| `/login` | LoginPage | Public | Form login |
| `/register` | RegisterPage | Public | Form registrasi |
| `/catalog` | ProductCatalog | Public | Katalog produk + checkout |
| `/products/:category` | ProductList | Public | Produk per kategori |
| `/category/:slug` | ProductCatalog (filtered) | Public | Filter kategori (pulsa-data, listrik-air, games, e-wallet) |
| `/invoice/:code` | InvoiceStatusPage | Public | Tracking invoice (polling 2s) |
| `/dashboard` | AuthDashboard | Bearer | Dashboard user/reseller |
| `/transaksi` | TransaksiPage | Bearer | History transaksi |
| `/admin` | AdminDashboard | Admin | Panel admin |
| `/admin/vouchers` | VoucherManagement | Admin | Manajemen voucher |

### 7.2 Checkout Flow

#### Flow 1: ProductCatalog → Checkout (Tanpa Midtrans Popup)
```
User pilih produk → Checkout.tsx modal →
  → Form: customer info, quantity, voucher
  → POST /api/orders/create (multi-item legacy order)
  → Redirect ke /invoice/{code}
  → InvoiceStatusPage polling GET /api/invoices/{code}/status
```
**Catatan:** Flow ini TIDAK mengintegrasikan Midtrans Snap popup. Order dibuat dan langsung redirect ke invoice.

#### Flow 2: GameTopUp → Midtrans Redirect
```
User pilih produk → GameTopUp.tsx form →
  → POST /api/orders (single order)
  → POST /api/payments/midtrans/initialize
  → Tampilkan link "Lanjut ke Midtrans"
  → User klik → buka Midtrans di tab baru (redirect_url)
```
**Catatan:** Flow ini menggunakan `redirect_url` dari Midtrans, BUKAN Snap.js popup inline.

### 7.3 Invoice Status Polling

`InvoiceStatusPage.tsx` melakukan polling `GET /api/invoices/{code}/status` setiap **2 detik** dan menampilkan timeline:
```
pending_payment → paid → fulfillment_pending → success
```

### 7.4 Auth State Management

- Token disimpan di **localStorage** (`auth_token`)
- Helper di `lib/auth.ts`: `getAuthToken()`, `setAuthToken()`, `clearAuthToken()`, `isLoggedIn()`
- Semua API call yang membutuhkan auth mengirim `Authorization: Bearer {token}`

---

## 8. Security Architecture

### 8.1 Authentication & Authorization

| Layer | Mekanisme |
|-------|-----------|
| JWT | `jsonwebtoken` library, configurable expiry (`JWT_EXPIRES_IN`) |
| Password Hashing | `bcryptjs`, cost factor 4 (test) / 12+ (production) |
| Role-Based Access | 3 roles: `admin`, `seller`, `pengguna` |
| Middleware | `createAuthenticationMiddleware()` → verify JWT, inject `authUser` |
| Role Guard | `requireRoles(["admin"])` → 403 jika role tidak sesuai |

### 8.2 Rate Limiting

| Scope | Limit | Window |
|-------|-------|--------|
| Global `/api/` | 30 req | 1 menit |
| Catalog `/api/catalog/` | 120 req | 1 menit |
| Payment & Fulfillment | 60 req | Configurable |
| Disabled in test environment | — | — |

### 8.3 Security Headers

- **Helmet**: HTTP security headers (X-Content-Type-Options, X-Frame-Options, dll)
- **CORS**: Configurable origins (`ALLOWED_ORIGINS` env var)
- **Input Validation**: Zod schemas di semua endpoint
- **Server-controlled fields**: Field seperti `status`, `role`, `amount` tidak boleh di-set client
- **Webhook Signature**: HMAC-SHA1 (Digiflazz), SHA512 (Midtrans)
- **Encryption**: `encryption.service.ts` untuk enkripsi data PII (payout identity data)

### 8.4 Email Verification

- SMTP via Nodemailer (configurable: SMTP_HOST, SMTP_PORT, dll)
- Token-based verification dengan cooldown dan rate limit
- Diperlukan sebelum request reseller

---

## 9. Environment Variables

### Required
```
NODE_ENV=development|test|production
PORT=3001
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
MIDTRANS_SERVER_KEY=SB-Mid-server-xxx
```

### Optional (with defaults)
```
JWT_SECRET=                        # Min 32 chars, required in production
JWT_EXPIRES_IN=1h
PASSWORD_HASH_COST=12              # 4 in test, 12+ in production
MIDTRANS_API_BASE_URL=https://app.sandbox.midtrans.com
DIGIFLAZZ_USERNAME=                # Null = Digiflazz disabled
DIGIFLAZZ_API_KEY=                 # Null = Digiflazz disabled
DIGIFLAZZ_API_BASE_URL=https://api.digiflazz.com
DIGIFLAZZ_WEBHOOK_SECRET=          # Null = no signature check
DIGIFLAZZ_TOPUP_TESTING=true|false
DIGIFLAZZ_TOPUP_MAX_PRICE=number
DIGIFLAZZ_TOPUP_CALLBACK_URL=url
DIGIFLAZZ_TOPUP_ALLOW_DOT=true|false
SUPABASE_TABLE_PREFIX=             # Optional table prefix
CORS_ALLOWED_ORIGINS=url1,url2
ADMIN_BOOTSTRAP_TOKEN=             # Min 32 chars
MYSQL_HOST=                        # If set, MySQL used for catalog
MYSQL_USER=
MYSQL_PASSWORD=
MYSQL_DATABASE=
SMTP_HOST=                         # If all SMTP set → email verification enabled
SMTP_PORT=
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM_EMAIL=
SMTP_FROM_NAME=
ALLOWED_ORIGINS=                   # Legacy alias for CORS_ALLOWED_ORIGINS
```

---

## 10. Database Architecture

### 10.1 Supabase (PostgreSQL) — Primary Database

Digunakan untuk semua data utama: users, orders, payments, fulfillments, pricing, commissions, audit, payout.

**Table Prefix Support:** `SUPABASE_TABLE_PREFIX` env var memungkinkan namespacing tabel.

**Repository Pattern:** Setiap modul memiliki `InMemoryXxxRepository` (testing) dan `SupabaseXxxRepository` (production), diimplementasikan sebagai class yang menerima Supabase client configuration.

### 10.2 MySQL — Catalog Fallback

Jika `MYSQL_HOST` di-set, `MySqlCatalogRepository` digunakan untuk catalog dengan Supabase sebagai fallback. Digunakan untuk performa baca produk yang lebih baik.

---

## 11. Testing Infrastructure

### 11.1 Unit Tests (Jest)

- Lokasi: `backend/src/modules/*/\*.test.ts`
- Runner: Jest + ts-jest
- Mode: `--runInBand` (sequential)
- Mocking: InMemory repositories, custom `fetchImpl`, `authClock` for time-dependent tests

### 11.2 E2E Tests (Playwright)

- Lokasi: `backend/playwright-tests/`
- Config: `playwright.config.ts`
- Test files:
  - `guest.spec.ts` — Guest checkout, tracking, invoice
  - `reseller.spec.ts` — Registration, dashboard access
  - `admin.spec.ts` — Admin operations
- Helpers: `helpers/api.ts` — API client dengan `createTestOrder()`, `createAuthenticatedUser()`
- Fixtures: `test-fixtures/products.json` — Sandbox product codes

### 11.3 Regression Tests

- `regression/fraud-matrix.regression.test.ts`
- `regression/lifecycle.regression.test.ts`
- `regression/rbac-public-routes.regression.test.ts`

---

## 12. Deployment Architecture

### 12.1 VPS Target

| Property | Value |
|----------|-------|
| IP | `10.244.74.23` |
| Host | Accessible via SSH |
| User | root |
| Auth | Password (`1@241223`) |
| OS | Linux |

### 12.2 VPS Directory Structure

```
/mnt/usb/
├── webtopup-repo/          # Git repository (source code)
│   ├── backend/
│   ├── Frontend/
│   └── .git/
├── ppob-demo/              # Production deployment
│   ├── backend/
│   │   ├── dist/           # Compiled JS
│   │   ├── node_modules/
│   │   └── package.json
│   └── frontend/
│       └── dist/           # Built static files
├── .npm → symlink          # Moved to USB for space
├── .bun → symlink
└── .cache → symlink
```

### 12.3 Disk Optimization

Root partition (`/`) dioptimasi dengan memindahkan heavy directories ke `/mnt/usb/` (`/dev/sda1`):
- `~/.npm` → `/mnt/usb/.npm` (symlink)
- `~/.bun` → `/mnt/usb/.bun` (symlink)
- `~/.cache` → `/mnt/usb/.cache` (symlink)

**Result:** Disk usage turun dari 96% (276MB free) ke 63% (2.2GB free).

### 12.4 Process Management

```bash
pm2 start dist/index.js --name ppob-backend
pm2 restart ppob-backend
pm2 logs ppob-backend
```

### 12.5 Git Repository

- **Remote:** `https://github.com/jamaahpees/PPOB-Payment-Gateway.git`
- **Branch:** `PPOB-Adnanpay`
- **Deploy flow:** Local push → VPS git pull → build → sync → pm2 restart

### 12.6 Build Process

```bash
# Backend
cd /mnt/usb/webtopup-repo/backend
npm run build                  # tsc -p tsconfig.json
cp -r dist/ /mnt/usb/ppob-demo/backend/
npm install --omit=dev         # Production deps only

# Frontend
cd /mnt/usb/webtopup-repo/Frontend
npm run build                  # vite build
cp -r dist/ /mnt/usb/ppob-demo/frontend/

# Restart
pm2 restart ppob-backend
```

---

## 13. Known Gaps & TODO

| Area | Status | Deskripsi |
|------|--------|-----------|
| Midtrans Snap.js Popup | Missing | Frontend menggunakan redirect URL, bukan Snap.js inline popup |
| Payment Method Selection UI | Missing | Tidak ada UI pilih metode pembayaran (BCA, GoPay, dll) |
| Digiflazz Topup Tests | 10 Failed | Topup tests gagal di sandbox (testing flag / nomor test) |
| Midtrans Bank Transfer Tests | 5 Failed | Charge BCA/BRI/BNI/GoPay gagal di sandbox |
| Voucher Category Filter | TODO | `applies_to.categories` belum diimplementasi (line 93 voucher.router.ts) |
| Reconciliation Service | Stub | `reconcile.service.ts` ada tapi belum terintegrasi penuh |
| Tax Service | Stub | `tax.service.ts` ada tapi belum terintegrasi |

---

## 14. URL Encryption & Security

### 14.1 Encryption Service

**File:** `backend/src/security/encryption.service.ts`

Digunakan untuk mengenkripsi data sensitif PII (Personally Identifiable Information), terutama pada modul **Payout** (data identitas bank penjual).

```
Algorithm: AES-256-GCM
Key: 256-bit (32 bytes), Base64 encoded
Format: iv:authTag:ciphertext (semua hex-encoded)
```

#### Cara Kerja

```
ENCRYPT:
  Input: plaintext string (e.g., JSON identity data)
  1. Generate random 16-byte IV
  2. Create AES-256-GCM cipher with key + IV
  3. Encrypt plaintext → ciphertext
  4. Get auth tag (GCM integrity check)
  5. Output: "iv_hex:authTag_hex:ciphertext_hex"

DECRYPT:
  Input: "iv_hex:authTag_hex:ciphertext_hex"
  1. Split by ":" → [iv, authTag, ciphertext]
  2. Create AES-256-GCM decipher with key + IV
  3. Set auth tag for integrity verification
  4. Decrypt ciphertext → plaintext
  5. Auth tag mismatch → throws error (tamper detection)
```

#### Penggunaan di Payout

```typescript
// Saat user request payout, identity data dienkripsi sebelum disimpan
const payout = await payoutService.requestPayout({
  userId,
  amountMinor: 50000,
  identityData: {
    legalName, nik, address,
    bankName, accountNumber, accountHolder,
    phone, email
  }
});

// identityData dienkripsi dengan AES-256-GCM
// Disimpan sebagai encrypted blob di database
// Hanya bisa didecrypt dengan ENCRYPTION_KEY yang sama
```

#### Environment Variable

```
ENCRYPTION_KEY=AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyA=
# Default dev key (JANGAN pakai di production)
# Generate baru: generateEncryptionKey() → random 32 bytes → base64
```

#### Hash Function

Encryption service juga menyediakan `hash(data)` menggunakan SHA-256 untuk kebutuhan hashing non-reversible (email verification tokens, dll).

### 14.2 Webhook Signature Verification

#### Digiflazz Webhook

```
Algorithm: HMAC-SHA1
Header: x-hub-signature
Verification:
  expected = "sha1=" + HMAC-SHA1(webhook_secret, raw_body)
  compare = timingSafeEqual(actual, expected)
```
- Timing-safe comparison untuk mencegah timing attacks
- Jika `DIGIFLAZZ_WEBHOOK_SECRET` tidak di-set, signature check di-skip

#### Midtrans Webhook

```
Algorithm: SHA-512
Field: signature_key
Verification:
  expected = SHA512(order_id + status_code + gross_amount + server_key)
  Compare dengan signature_key dari payload
```

### 14.3 API Response Security

| Pattern | Implementasi |
|---------|-------------|
| Server-controlled fields | `status`, `role`, `amount`, `final_price` dll ditolak jika dikirim client |
| Password never returned | `passwordHash` tidak pernah ada di response |
| Token blacklist | JWT stateless, expiry sebagai satu-satunya invalidation |
| Rate limiting | Global 30/min, catalog 120/min, sensitive 60/min |
| CORS whitelist | Hanya origin yang di-allow bisa akses API |

---

## 15. Product Search & Query Optimization

### 15.1 In-Memory Product Cache

**File:** `backend/src/modules/catalog/product-cache.service.ts`

Seluruh catalog produk di-cache **in-memory** per role untuk performa pencarian maksimal.

```
Cache Structure:
  Map<AuthUserRole, {
    data: PricedProduct[],    // Semua produk dengan harga final
    lastFetch: number         // Timestamp cache
  }>

TTL: 5 menit (300 detik)
Strategy: Stale-while-revalidate (serve stale, refresh background)
Dedup: Menggunakan Map<roleType, Promise> untuk mencegah duplicate fetch
```

#### Cache Flow

```
Request masuk → Cek cache
  ├─ Cache HIT + fresh (< 5 min) → Return cache langsung
  ├─ Cache HIT + stale (> 5 min) → Return cache, trigger background refresh
  └─ Cache MISS → Fetch dari DB, cache, return

Background refresh:
  - Fire-and-forget (tidak blocking request)
  - Deduplication: jika refresh sudah berjalan, tunggu promise yang sama
  - Error di background refresh → log saja, cache lama tetap dipakai
```

### 15.2 Search & Filter Method

Endpoint `GET /api/catalog/products` menggunakan **query parameter-based search** yang ringan:

```
GET /api/catalog/products?page=1&limit=50&search=telkomsel&category=Pulsa
```

#### Parameter

| Parameter | Type | Default | Deskripsi |
|-----------|------|---------|-----------|
| `page` | number | 1 | Halaman (pagination) |
| `limit` | number | 50 | Item per halaman (max 100) |
| `search` | string | — | Keyword pencarian (case-insensitive) |
| `category` | string | — | Filter kategori exact match |

#### Search Implementation (O(n) linear scan pada cache)

```typescript
// Semua search dilakukan pada IN-MEMORY cache, BUKAN database query
// Artinya: sangat cepat, tidak ada DB hit untuk search

if (search) {
  const searchLower = search.toLowerCase();
  products = products.filter(p =>
    p.product.name.toLowerCase().includes(searchLower) ||        // Nama produk
    p.product.provider.toLowerCase().includes(searchLower) ||    // Provider
    p.product.skuDigiflazz.toLowerCase().includes(searchLower)   // SKU code
  );
}

if (category) {
  products = products.filter(p => p.product.category === category);
}
```

#### Search Fields

| Field | Match Type | Example |
|-------|-----------|---------|
| `name` | Case-insensitive substring | "telkomsel" → match "Telkomsel 10.000" |
| `provider` | Case-insensitive substring | "digiflazz" → match semua |
| `sku_digiflazz` | Case-insensitive substring | "xld10" → match "xld10" |

#### Category Values

```
Pulsa       → Pulsa reguler semua operator
Data        → Paket data / internet
Games       → Voucher game (Mobile Legends, Free Fire, dll)
E-Money     → E-wallet (GoPay, OVO, DANA, ShopeePay)
PLN         → Token PLN prabayar
```

#### Response Shape

```json
{
  "products": [
    {
      "product": {
        "id": "uuid",
        "sku_digiflazz": "xld10",
        "name": "XL 10.000",
        "category": "Pulsa",
        "provider": "digiflazz",
        "base_price_minor": 10800,
        "is_active": true,
        "metadata": {}
      },
      "role_type": "pengguna",
      "base_price_minor": 10800,
      "markup_minor": 1200,
      "final_price_minor": 12000,
      "pricing": {
        "source": "category",
        "rule_id": "uuid",
        "scope_type": "category",
        "priority": 0,
        "markup_fixed": 1200,
        "markup_percentage": 0
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 342,
    "totalPages": 7
  }
}
```

### 15.3 Pricing Engine

Pencarian produk menghasilkan harga yang **sudah dikalkulasi** berdasarkan role user:

```
Pricing Priority (highest wins):
  1. Product-specific rule  (scope_type = "product", product_id match)
  2. Category rule           (scope_type = "category", category match)
  3. Global rule             (scope_type = "global")
  4. Default (no markup)     (base_price_minor = final_price_minor)

Calculation:
  after_fixed = base_price_minor + markup_fixed
  final_price = round(after_fixed × (1 + markup_percentage / 100))

Example:
  Base: 10,800
  Markup fixed: 1,200
  Markup percentage: 0%
  Final: 10,800 + 1,200 = 12,000
```

### 15.4 Performance Characteristics

| Operation | Complexity | DB Hit | Notes |
|-----------|-----------|--------|-------|
| Search products | O(n) | No (cache) | n = total products, typically <1000 |
| Filter by category | O(n) | No (cache) | Linear scan on cached array |
| Pagination | O(1) slice | No (cache) | Array.slice() on filtered result |
| Cache refresh | O(n) | Yes | Fetch all products + pricing rules |
| Role resolution | O(1) | Conditional | JWT decode (no DB) or fallback to "pengguna" |

**Typical performance:** < 5ms untuk search + filter + pagination pada ~500 produk.

### 15.5 Cache Invalidation

```typescript
// Manual invalidation (e.g., setelah admin update produk)
productCache.invalidate(roleType);     // Invalidate specific role
productCache.invalidate();             // Invalidate semua role

// Auto-refresh: Stale-while-revalidate
// Cache akan otomatis refresh setelah 5 menit pada request berikutnya
```

---

## 16. Admin Credentials (Demo/Sandbox)

| Property | Value |
|----------|-------|
| Email | `admin@adnanpay-com` |
| Password | `Admin123!@#` |

---

*Dokumen ini di-generate otomatis dari eksplorasi codebase pada 30 Mei 2026.*

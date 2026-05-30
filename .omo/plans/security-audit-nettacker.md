# Plan: Vulnerability Analysis & OWASP Nettacker Security Scan

> **Goal**: Analisis komprehensif kerentanan keamanan pada PPOB Payment Gateway + setup OWASP Nettacker via Docker untuk automated penetration testing.

---

## Part 1: Code-Level Vulnerability Analysis

### Temuan dari Explorasi Langsung Codebase

---

### 🔴 CRITICAL — Harus diperbaiki sebelum production

#### V1: JWT Fallback Secret di Source Code
- **File**: `backend/src/middleware/auth.middleware.ts:34`
- **Kode**: `const jwtSecret = process.env.JWT_SECRET || "test-only-jwt-secret-at-least-32-bytes";`
- **Juga di**: `backend/src/app.ts:191` (fallback sama)
- ** Risiko**: Jika `JWT_SECRET` env var tidak set, semua JWT ditandatangani dengan secret yang diketahui publik (ada di source code). Attacker bisa forge token admin.
- **Fix**: Hapus fallback string. Throw error jika JWT_SECRET tidak ada.
  ```typescript
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) throw new Error('JWT_SECRET not configured');
  ```

#### V2: Encryption Key Fallback di Source Code
- **File**: `backend/src/app.ts:345`
- **Kode**: `encryptionKey: dependencies.encryptionConfig?.encryptionKey ?? "AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyA=="`
- **Risiko**: Base64 encryption key hardcoded. Jika env var tidak set, semua data terenkripsi (payout bank details) bisa didekripsi oleh siapa saja yang baca source code.
- **Fix**: Hapus fallback. Require `ENCRYPTION_KEY` env var.

#### V3: Test Credentials di Test Files
- **File**: `backend/src/modules/regression/rbac-public-routes.regression.test.ts:27-46`
- **Kode**: `serverKey: "test-server-key"`, `apiKey: "digiflazz-key"`
- **Risiko**: Pattern test credentials di repo bisa dicopy ke production. Tidak langsung exploit tapi bad practice.
- **Fix**: Ganti dengan env var atau random test values.

---

### 🟠 HIGH — Serius, perlu perhatian

#### V4: JWT Token Disimpan di localStorage (XSS → Token Theft)
- **File**: `Frontend/src/components/LoginPage.tsx:38`, `RegisterPage.tsx:45`, `AuthDashboard.tsx:146`, `AdminDashboard.tsx:187`
- **Kode**: `localStorage.setItem('bayarku.auth.session', JSON.stringify({ user, token, expires_in }))`
- **Risiko**: localStorage bisa diakses via JavaScript. Jika ada XSS vulnerability, attacker bisa steal token. localStorage juga tidak terproteksi dari browser extensions.
- **Fix**: Gunakan httpOnly cookies untuk token, atau minimal tambahkan XSS protection (CSP headers). localStorage hanya untuk non-sensitive data.

#### V5: CORS Origin Tidak Ketat di Development
- **File**: `backend/src/app.ts:128-129`
- **Kode**: `origin: process.env.ALLOWED_ORIGINS?.split(",") || ["http://localhost:5173", "https://demo.hanzserver.online"]`
- **Risiko**: Jika `ALLOWED_ORIGINS` tidak di-set di production, hanya localhost dan demo yang di-allow. TAPI jika developer menambahkan `"*"` atau origin yang terlalu luas, bisa jadi CORS bypass.
- **Fix**: Pastikan production `.env` hanya berisi domain yang valid. Validasi format origin.

#### V6: `trust proxy` Aktif Tanpa Validasi
- **File**: `backend/src/app.ts:122`
- **Kode**: `app.set("trust proxy", true);`
- **Risiko**: `true` mempercayai SEMUA proxy headers (X-Forwarded-For, X-Forwarded-Proto). Attacker bisa spoof IP untuk bypass rate limiting.
- **Fix**: Set ke jumlah hop proxy yang benar (misal `1` untuk single nginx reverse proxy), atau validasi proxy IP.

#### V7: `exec_sql` RPC di Supabase Scripts
- **File**: `backend/src/scripts/import-all-batches.ts:51`, `execute-mini-batch.ts:62`
- **Kode**: `await supabase.rpc('exec_sql', { sql_query: sql })`
- **Risiko**: RPC function `exec_sql` mengeksekusi raw SQL. Jika ada di production database dan Supabase service role key terexpose, SQL injection gateway.
- **Fix**: Pastikan `exec_sql` hanya ada di dev/migration scripts, tidak di runtime code. Hapus RPC function setelah migration.

#### V8: Error Messages Bocor ke Client
- **Files**: Multiple router files
- **Pattern**: `console.error("[Module] Error:", error)` + generic 500 response
- **Risiko**: Beberapa error handler mungkin leak stack trace atau internal error details di response.
- **Fix**: Pastikan semua error responses ke client hanya berisi generic message. Log detail hanya di server.

---

### 🟡 MEDIUM — Perlu diperbaiki

#### V9: Rate Limiting Tidak Coverage Semua Endpoint
- **File**: `backend/src/app.ts:383-436`
- **Unprotected routes** (no rate limit):
  - `POST /api/auth/register` — bisa di-abuse untuk mass registration
  - `POST /api/auth/login` — tapi ada `authLimiter` di auth.router.ts, perlu verify
  - `GET /api/catalog` — bisa di-abuse untuk scraping
  - `GET /api/invoices/{code}` — bisa brute-force invoice codes
  - `POST /api/orders` — bisa spam orders
- **Rate limited routes**: `/api/payments`, `/api/fulfillments`, `/api/webhook`
- **Fix**: Tambah rate limiting ke semua public-facing endpoints.

#### V10: No CSRF Protection
- **File**: Backend semua POST/PUT/DELETE endpoints
- **Risiko**: Karena token di localStorage (bukan httpOnly cookie), CSRF tidak langsung applicable. TAPI jika implementasi berubah ke cookies, perlu CSRF token.
- **Status**: Acceptable untuk arsitektur saat ini (Bearer token di header, bukan cookie).

#### V11: Banyak `as any` Type Casts
- **File**: `backend/src/modules/catalog/mysql-catalog.repository.ts:60,65,73,111,232`, `backend/src/app.ts:195,377`
- **Risiko**: Bypass TypeScript safety. Bisa hide runtime bugs yang menyebabkan unexpected behavior.
- **Fix**: Tambah proper type definitions untuk Supabase response dan MySQL rows.

#### V12: console.error Leak di Production
- **Files**: `payment.router.ts:47,100`, `order.router.ts:166`, `payment.service.ts:510`, `invoice-status.router.ts:72`, `product-cache.service.ts:111`
- **Risiko**: console.error di production bisa leak sensitive data ke logs. Jika log aggregation tidak aman, data bisa terekspos.
- **Fix**: Gunakan structured logger (pino/winston) dengan level control. Redact sensitive fields.

---

### 🟢 LOW — Best Practice

#### V13: No Content Security Policy (CSP) Headers
- **File**: `backend/src/app.ts:125`
- **Status**: `helmet()` sudah dipasang tapi default CSP mungkin terlalu longgar untuk Midtrans Snap.js (butuh script-src untuk app.sandbox.midtrans.com).
- **Fix**: Konfigurasi CSP header yang spesifik untuk allow Midtrans domain.

#### V14: No Subresource Integrity (SRI)
- **File**: Midtrans Snap.js akan di-load dynamically
- **Risiko**: Jika CDN Midtrans compromised, malicious JS bisa inject ke app.
- **Mitigasi**: Midtrans official CDN biasanya aman. SRI tidak bisa diterapkan pada dynamic script injection tanpa known hash.

#### V15: Admin Credentials di Dokumentasi
- **File**: `.omo/plans/system-map.md` dan conversation history
- **Kode**: `admin@adnanpay-com / Admin123!@#`
- **Risiko**: Jika dokumen ini terekspos, admin account bisa diakses.
- **Fix**: Jangan commit credentials ke git. Gunakan secret management.

---

## Part 2: OWASP Nettacker Setup

### Folder Structure

```
security/
├── docker-compose.yml          # Nettacker + dependencies
├── .env                        # Scan targets config (NOT committed)
├── .env.example                # Template
├── scans/                      # Scan results (NOT committed)
├── wordlists/                  # Custom wordlists for brute force tests
│   └── api-endpoints.txt       # PPOB-specific endpoint wordlist
└── README.md                   # How to use
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  nettacker:
    image: owasp/nettacker:latest
    container_name: ppob-nettacker
    ports:
      - "5000:5000"     # Web UI
    volumes:
      - ./scans:/root/.nettacker/data/results
      - ./wordlists:/opt/wordlists
    environment:
      - NETTACKER_API_KEY=${NETTACKER_API_KEY:-ppob-scan-2024}
    restart: unless-stopped
```

### .env.example

```
# Target Configuration
TARGET_LOCAL=http://localhost:5173
TARGET_LOCAL_API=http://localhost:3001
TARGET_VPS=https://demo.hanzserver.online
TARGET_VPS_IP=10.244.74.23

# Nettacker
NETTACKER_API_KEY=your-api-key-here
```

---

## Part 3: Scan Profiles

### Scan 1: Reconnaissance (Information Gathering)
```bash
docker exec ppob-nettacker nettacker \
  -i $TARGET_LOCAL_API \
  -m port_scan,http_status_scan,directory_scan \
  -t 10 \
  --method-args "directory_scan_http=/api/" \
  -o /root/.nettacker/data/results/recon.html \
  --format html
```

### Scan 2: Vulnerability Scan
```bash
docker exec ppob-nettacker nettacker \
  -i $TARGET_LOCAL_API \
  -m xss_scan,sqli_scan,csrf_scan \
  -t 5 \
  -o /root/.nettacker/data/results/vuln-scan.html \
  --format html
```

### Scan 3: Brute Force Test (Auth Endpoints)
```bash
docker exec ppob-nettacker nettacker \
  -i $TARGET_LOCAL_API \
  -m http_bruteforce \
  -t 3 \
  -u admin@adnanpay-com \
  -P /opt/wordlists/common-passwords.txt \
  -o /root/.nettacker/data/results/bruteforce.html \
  --format html
```

### Scan 4: Full Scan (VPS Target)
```bash
docker exec ppob-nettacker nettacker \
  -i $TARGET_VPS \
  -m all \
  -t 5 \
  -o /root/.nettacker/data/results/full-scan.html \
  --format html
```

---

## Tasks

### Wave 1: Security Folder Setup

- [ ] **W1-T1: Create security folder structure**
  - Create `security/` directory with subdirs: `scans/`, `wordlists/`
  - Create `security/.env.example` with target config template
  - Create `security/.env` with actual targets (NOT committed)
  - Create `security/.gitignore` to exclude scans/ and .env
  - Acceptance: Folder structure exists, .env and scans/ gitignored

- [ ] **W1-T2: Create docker-compose.yml for Nettacker**
  - File: `security/docker-compose.yml`
  - Image: `owasp/nettacker:latest`
  - Ports: 5000 (Web UI)
  - Volumes: scan results + wordlists
  - Acceptance: `docker-compose up -d` starts Nettacker container

- [ ] **W1-T3: Create PPOB-specific wordlists**
  - File: `security/wordlists/api-endpoints.txt` — all API routes from codebase
  - File: `security/wordlists/common-passwords.txt` — top 100 weak passwords
  - Acceptance: Wordlists contain PPOB-specific paths + common weak passwords

- [ ] **W1-T4: Create security/README.md**
  - Docker setup instructions
  - How to run each scan profile
  - How to read results
  - Credential/secret safety guidelines
  - Acceptance: README provides clear instructions for running scans

### Wave 2: Code-Level Security Fixes

- [ ] **W2-T1: Remove JWT fallback secret**
  - File: `backend/src/middleware/auth.middleware.ts:34`
  - Change: Remove `"test-only-jwt-secret-at-least-32-bytes"` fallback
  - Add: Throw error if JWT_SECRET not set
  - Also fix: `backend/src/app.ts:191` same fallback
  - Acceptance: App refuses to start without JWT_SECRET env var

- [ ] **W2-T2: Remove encryption key fallback**
  - File: `backend/src/app.ts:345`
  - Change: Remove hardcoded base64 key fallback
  - Add: Throw error if ENCRYPTION_KEY not set
  - Acceptance: App refuses to start without ENCRYPTION_KEY env var

- [ ] **W2-T3: Fix trust proxy configuration**
  - File: `backend/src/app.ts:122`
  - Change: `app.set("trust proxy", true)` → `app.set("trust proxy", 1)` (single proxy hop)
  - Acceptance: Rate limiting works correctly behind nginx

- [ ] **W2-T4: Add rate limiting to public endpoints**
  - File: `backend/src/app.ts`
  - Add rate limiters to: `/api/auth/register`, `/api/catalog`, `/api/invoices`, `/api/orders`
  - Configure: 20 req/min for catalog, 10 req/min for auth register, 30 req/min for orders
  - Acceptance: Public endpoints return 429 when rate exceeded

- [ ] **W2-T5: Sanitize error responses**
  - Files: All router files with `console.error` + generic 500 responses
  - Change: Ensure no stack traces or internal details leak to client
  - Add: Central error handler that logs internally but returns generic message
  - Acceptance: Error responses only contain { error: { code, message } } without internals

### Wave 3: Nettacker Scans

- [ ] **W3-T1: Run reconnaissance scan against local app**
  - Target: `http://localhost:3001`
  - Modules: `port_scan, http_status_scan, directory_scan`
  - Output: `security/scans/recon-local.html`
  - Acceptance: Scan completes, HTML report generated with findings

- [ ] **W3-T2: Run vulnerability scan against local app**
  - Target: `http://localhost:3001`
  - Modules: `xss_scan, sqli_scan, csrf_scan`
  - Output: `security/scans/vuln-local.html`
  - Acceptance: Scan completes, vulnerabilities identified if any

- [ ] **W3-T3: Run brute force test on auth endpoints**
  - Target: `http://localhost:3001`
  - Modules: `http_bruteforce`
  - Test accounts: admin + common passwords
  - Output: `security/scans/bruteforce.html`
  - Acceptance: Verify rate limiting blocks brute force attempts

- [ ] **W3-T4: Run full scan against VPS**
  - Target: `https://demo.hanzserver.online`
  - Modules: `all` (comprehensive)
  - Output: `security/scans/full-vps.html`
  - Acceptance: Full vulnerability report for production-like environment

### Wave 4: Fix Findings & Harden

- [ ] **W4-T1: Fix all critical/high findings from Nettacker scans**
  - Read each scan report
  - Fix each confirmed vulnerability
  - Re-scan to verify fix
  - Acceptance: All critical/high findings resolved

- [ ] **W4-T2: Add Content Security Policy headers for Midtrans**
  - File: `backend/src/app.ts`
  - Configure Helmet CSP to allow Midtrans Snap.js domains:
    - `script-src`: `'self'`, `https://app.sandbox.midtrans.com`, `https://app.midtrans.com`
    - `frame-src`: `https://app.sandbox.midtrans.com`, `https://app.midtrans.com`
    - `style-src`: `'self'`, `'unsafe-inline'` (Midtrans popup needs this)
  - Acceptance: CSP headers present, Midtrans popup still works

- [ ] **W4-T3: Generate final security audit report**
  - Compile all findings (code analysis + Nettacker results)
  - Create `security/AUDIT-REPORT.md` with:
    - Executive summary
    - All findings with severity
    - Remediation status
    - Remaining recommendations
  - Acceptance: Complete audit report with all findings documented

---

## Vulnerability Summary Table

| ID | Severity | Type | File | Status |
|----|----------|------|------|--------|
| V1 | 🔴 CRITICAL | Hardcoded JWT Secret | auth.middleware.ts:34 | Fix planned |
| V2 | 🔴 CRITICAL | Hardcoded Encryption Key | app.ts:345 | Fix planned |
| V3 | 🟠 HIGH | Test Credentials in Repo | regression test:27 | Low priority |
| V4 | 🟠 HIGH | Token in localStorage | LoginPage.tsx:38 | Risk accepted* |
| V5 | 🟠 HIGH | CORS Config | app.ts:128 | Needs review |
| V6 | 🟠 HIGH | Trust Proxy | app.ts:122 | Fix planned |
| V7 | 🟠 HIGH | exec_sql RPC | scripts/*.ts | Scripts only |
| V8 | 🟠 HIGH | Error Response Leak | Multiple routers | Fix planned |
| V9 | 🟡 MEDIUM | Missing Rate Limits | app.ts:383-436 | Fix planned |
| V10 | 🟡 MEDIUM | No CSRF | All POST routes | Acceptable** |
| V11 | 🟡 MEDIUM | `as any` Type Casts | Multiple files | Low priority |
| V12 | 🟡 MEDIUM | console.error in Prod | Multiple files | Low priority |
| V13 | 🟢 LOW | No CSP Config | app.ts:125 | Fix planned |
| V14 | 🟢 LOW | No SRI | index.html | Risk accepted |
| V15 | 🟢 LOW | Admin Creds in Docs | system-map.md | Don't commit |

\* V4: localStorage acceptable karena arsitektur SPA + Bearer token (bukan cookie-based auth). XSS-free codebase (no dangerouslySetInnerHTML found).

\** V10: CSRF tidak applicable karena Bearer token di Authorization header, bukan cookie.

---

## Guardrails

- **Jangan scan production tanpa izin** — Hanya scan localhost dan VPS demo yang dimiliki
- **Jangan commit credentials** — Semua target/keys di `.env` yang di-gitignore
- **Jangan run DDoS modules** — Nettacker punya flood modules, JANGAN gunakan
- **Backup sebelum fix** — Git commit semua perubahan security sebelum testing
- **Scan results sensitif** — Jangan share scan results ke public

---

## Out of Scope

- ❌ Aktifasi Midtrans payment channels (Dashboard task)
- ❌ Fix dependency vulnerabilities (npm audit — separate task)
- ❌ Infrastructure hardening (nginx config, SSL certificates)
- ❌ DDoS mitigation infrastructure (Cloudflare, CDN level)

# Plan: Midtrans Snap.js Popup Payment Integration

> **Goal**: Replace redirect-link payment flow with Midtrans Snap.js inline popup modal. User memilih metode pembayaran (CC, VA, GoPay, dll) langsung di dalam app tanpa pindah tab.

---

## Context

### Current State
- **Backend sudah siap**: `POST /api/payments/midtrans/initialize` return `{ token, redirect_url }` — token adalah Snap token yang bisa langsung dipakai `snap.pay(token)`
- **GameTopUp.tsx** (line 644-654): Menampilkan `<a href={redirect_url} target="_blank">` — user harus klik link, buka tab baru
- **Checkout.tsx** (line 488-495): Tombol "Complete Purchase" → `POST /api/orders/create` → redirect ke `/invoice/{code}` — TIDAK ADA Midtrans integration sama sekali
- **index.html**: Tidak ada Snap.js script tag

### Target State
- User klik "Bayar Sekarang" → popup Snap.js muncul di dalam halaman
- User pilih metode pembayaran di popup (Credit Card, BCA VA, GoPay, dll)
- Setelah pembayaran selesai/di-close → redirect ke halaman invoice

---

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Snap.js loading | Dynamic script injection via hook | Load dari env var, tidak hardcode di index.html |
| Client Key storage | `VITE_MIDTRANS_CLIENT_KEY` env var | Semua credential via env, tidak ada hardcode |
| Snap URL storage | `VITE_MIDTRANS_SNAP_URL` env var | Sandbox vs production URL via env |
| Snap invocation | `window.snap.pay(token, callbacks)` | Official Midtrans API |
| Hook pattern | Custom hook `useMidtransSnap` | Encapsulate snap.pay + callback logic |
| Payment flow trigger | Setelah backend return token, langsung panggil snap.pay | Token sudah available dari `/api/payments/midtrans/initialize` |
| Callback handling | onSuccess → redirect invoice, onPending → redirect invoice, onClose → show message, onError → show error | Standard Midtrans callback pattern |

---

## Files to Modify

| File | Change Type | Description |
|------|-------------|-------------|
| `Frontend/index.html` | NO CHANGE | Snap.js loaded dynamically via hook, bukan script tag |
| `Frontend/src/hooks/useMidtransSnap.ts` | CREATE | Custom hook untuk Snap.js integration |
| `Frontend/src/components/GameTopUp.tsx` | MODIFY | Ganti redirect link → snap.pay popup |
| `Frontend/src/components/Checkout.tsx` | MODIFY | Tambah Midtrans initialize + snap.pay setelah order creation |

---

## Parallel Execution Strategy (3 Independent Agents)

Untuk mempercepat pengerjaan secara paralel tanpa konflik merge, pekerjaan dibagi menjadi 3 Agent independen yang bekerja pada file terpisah:

```
                  ┌────────────────────────────────────────┐
                  │    AGENT 1: Hook & Env Foundation      │
                  │    - Frontend/src/hooks/useMidtransSnap.ts
                  │    - Frontend/.env.* files             │
                  └───────────────────┬────────────────────┘
                                      │
                                      │ (Defines contract & interface)
                                      ▼
        ┌─────────────────────────────┴─────────────────────────────┐
        │                                                           │
        ▼                                                           ▼
┌──────────────────────────────┐                            ┌──────────────────────────────┐
│  AGENT 2: GameTopUp component│                            │  AGENT 3: Checkout component  │
│  - components/GameTopUp.tsx  │                            │  - components/Checkout.tsx   │
│  - Replaces redirect link    │                            │  - Integrates Midtrans API   │
│    with snap.pay()           │                            │    & triggers snap.pay()     │
└──────────────────────────────┘                            └──────────────────────────────┘
```

---

## Tasks by Agent

### AGENT 1: Hook & Env Foundation (Independent)

- [ ] **A1-T1: Create .env.development with Midtrans config**
  - File: `Frontend/.env.development` (NEW)
  - Content:
    ```
    VITE_API_BASE_URL=http://localhost:3001
    VITE_MIDTRANS_CLIENT_KEY=<SANDBOX_CLIENT_KEY>
    VITE_MIDTRANS_SNAP_URL=https://app.sandbox.midtrans.com/snap/snap.js
    ```
  - Update `Frontend/.env.production` & `Frontend/.env.example`
  - Ensure `.env` is gitignored

- [ ] **A1-T2: Implement useMidtransSnap hook**
  - File: `Frontend/src/hooks/useMidtransSnap.ts` (NEW)
  - Must export:
    ```typescript
    export interface SnapCallbacks {
      onSuccess?: (result: any) => void;
      onPending?: (result: any) => void;
      onError?: (result: any) => void;
      onClose?: () => void;
    }
    export function useMidtransSnap(): {
      pay: (token: string, callbacks?: SnapCallbacks) => void;
      isReady: boolean;
      isLoading: boolean;
    }
    ```
  - Implement dynamic loading of `VITE_MIDTRANS_SNAP_URL` script tag with `data-client-key` attribute set to `VITE_MIDTRANS_CLIENT_KEY`
  - Acceptance: TypeScript compiles, tests pass, script loaded dynamically in browser.

---

### AGENT 2: GameTopUp Integration (Independent)

- [ ] **A2-T1: Implement Midtrans Snap in GameTopUp.tsx**
  - File: `Frontend/src/components/GameTopUp.tsx`
  - Imports: `import { useMidtransSnap } from '../hooks/useMidtransSnap';`
  - Changes:
    1. Call `useMidtransSnap()` hook at the top.
    2. Replace the old UI redirect link (`<a href={paymentResult.redirect_url}>Lanjut ke Midtrans</a>`) with a direct button "Bayar Sekarang" that triggers `pay(paymentResult.token, callbacks)`.
    3. Setup callbacks:
       - `onSuccess`: navigate to hash `/invoice/${orderResult.invoice_code}`
       - `onPending`: navigate to hash `/invoice/${orderResult.invoice_code}`
       - `onError`: show error message
       - `onClose`: show "Pembayaran dibatalkan" message
  - Acceptance: UI elements updated, compiler passes (uses stub if Agent 1 not finished).

---

### AGENT 3: Checkout Integration (Independent)

- [ ] **A3-T1: Implement Midtrans Snap in Checkout.tsx**
  - File: `Frontend/src/components/Checkout.tsx`
  - Imports: `import { useMidtransSnap } from '../hooks/useMidtransSnap';`
  - Changes:
    1. Call `useMidtransSnap()` hook at top.
    2. In `handleCheckout()`, after the order is created via `POST /api/orders/create`:
       - Make a backend call: `POST /api/payments/midtrans/initialize` with `order_id` and `idempotency_key`
       - On success, trigger `pay(result.token, callbacks)`.
    3. Setup callbacks:
       - `onSuccess`: close checkout modal, navigate to `/invoice/${invoiceCode}`
       - `onPending`: same as onSuccess
       - `onError`: show error in checkout modal
       - `onClose`: show canceled message inside checkout modal
  - Acceptance: Modal supports checkout flow to Midtrans, compiles successfully.

---

## Final Merge & Verification Wave (Combined)

- [ ] **M-T1: Run integration smoke tests**
  - Verify all 3 agents' code compiles together
  - Run type checks: `cd Frontend && npm run build`
- [ ] **M-T2: Deploy and verify live on VPS**
  - Pull code to VPS repository, compile, restart backend PM2
  - Do manual test on GameTopUp and Catalog Checkout to ensure popup shows up and processes sandbox payments.

---

## Credentials — All via .env Files

### Frontend env vars (NO hardcoded secrets in source code)

**`Frontend/.env.development`** (sandbox — demo/dev only):
```
VITE_API_BASE_URL=http://localhost:3001
VITE_MIDTRANS_CLIENT_KEY=<sandbox_client_key>
VITE_MIDTRANS_SNAP_URL=https://app.sandbox.midtrans.com/snap/snap.js
```

**`Frontend/.env.production`** (production):
```
VITE_API_BASE_URL=/api
VITE_MIDTRANS_CLIENT_KEY=<production_client_key>
VITE_MIDTRANS_SNAP_URL=https://app.midtrans.com/snap/snap.js
```

**`Frontend/.env.example`** (template for new developers):
```
VITE_API_BASE_URL=/api
VITE_MIDTRANS_CLIENT_KEY=your_midtrans_client_key_here
VITE_MIDTRANS_SNAP_URL=https://app.sandbox.midtrans.com/snap/snap.js
```

### Backend env vars (already configured)
```
MIDTRANS_SERVER_KEY=<from_backend_env>
MIDTRANS_API_BASE_URL=https://api.sandbox.midtrans.com
```

### Rule: ZERO credentials in source code
- ❌ Tidak boleh ada client key / server key di .ts, .tsx, .html files
- ❌ Tidak boleh ada credential di commit / git
- ✅ Semua via `import.meta.env.VITE_*` (frontend) dan `process.env.*` (backend)
- ✅ `.env` files di `.gitignore` (tidak di-commit)
- ✅ `.env.example` berisi placeholder, bukan real key

---

## Acceptance Criteria (Overall)

1. ✅ User klik "Bayar" → Midtrans Snap popup muncul di dalam halaman (bukan tab baru)
2. ✅ User bisa pilih Credit Card di popup → test payment berhasil
3. ✅ Setelah payment success/pending → redirect ke halaman invoice
4. ✅ Jika popup di-close → pesan "Pembayaran dibatalkan" muncul, user bisa retry
5. ✅ GameTopUp flow dan Checkout flow keduanya menggunakan Snap popup
6. ✅ Tidak ada crash jika Snap.js gagal load (fallback message)

---

## Guardrails

- **Jangan ubah backend** — Backend sudah return token dengan benar. Tidak perlu modifikasi.
- **Jangan hardcode Client Key** — Gunakan env var `VITE_MIDTRANS_CLIENT_KEY` agar bisa switch sandbox/production.
- **Jangan hapus redirect_url logic** — Keep as fallback jika Snap.js gagal load.
- **Bank transfer channels (BCA/BRI/BNI) masih 402** — Ini masalah Midtrans Dashboard activation, bukan kode. Snap popup akan tetap muncul tapi channel tersebut akan disabled di popup.

---

## Out of Scope

- ❌ Aktivasi payment channel di Midtrans Dashboard (user harus lakukan sendiri)
- ❌ Perbaikan test Midtrans yang gagal (bank transfer 402, GoPay 404)
- ❌ Backend changes
- ❌ Backend payment webhook changes

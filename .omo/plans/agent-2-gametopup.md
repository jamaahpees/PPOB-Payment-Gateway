# Agent 2: GameTopUp Component Integration Plan

> **Goal**: Mengintegrasikan Midtrans Snap popup ke dalam checkout flow GameTopUp.tsx, menggantikan link external redirect lama.

---

## 📋 Tasks

### 1. Edit `Frontend/src/components/GameTopUp.tsx`

- [x] Task completed

Lakukan modifikasi berikut:

#### **A. Import Hook**
Tambahkan import hook di baris atas file:
```typescript
import { useMidtransSnap } from '../hooks/useMidtransSnap';
```

#### **B. Inisialisasi Hook**
Panggil hook di dalam komponen `GameTopUp`:
```typescript
const { pay, isReady: isSnapReady } = useMidtransSnap();
const [isPaying, setIsPaying] = useState(false);
const [paymentError, setPaymentError] = useState<string | null>(null);
```

#### **C. Ganti Flow setelah Order & Payment Result didapat**
Cari fungsi submit handler / order initialization (biasanya memanggil `POST /api/payments/midtrans/initialize`).
- Setelah mendapatkan `paymentResult` (yang berisi `token` dan `redirect_url`):
- Jangan tampilkan redirect link. Langsung panggil `pay(paymentResult.token, callbacks)`.

#### **D. Konfigurasi Callbacks `snap.pay`**
```typescript
const handlePay = (token: string) => {
  setIsPaying(true);
  setPaymentError(null);
  
  pay(token, {
    onSuccess: (result) => {
      setIsPaying(false);
      // Redirect ke halaman invoice menggunakan hash router
      window.location.hash = `#/invoice/${orderResult.invoice_code}`;
    },
    onPending: (result) => {
      setIsPaying(false);
      window.location.hash = `#/invoice/${orderResult.invoice_code}`;
    },
    onError: (err) => {
      setIsPaying(false);
      setPaymentError('Pembayaran gagal. Silakan coba beberapa saat lagi.');
      console.error('Midtrans Error:', err);
    },
    onClose: () => {
      setIsPaying(false);
      // Biarkan order tetap dalam state pending agar user bisa retry
      setPaymentError('Pembayaran dibatalkan oleh pengguna.');
    }
  });
};
```

#### **E. Ganti Render UI Redirect Link**
Cari kode JSX yang me-render link Midtrans lama (sekitar line ~644-654):
```tsx
{/* SEBELUMNYA */}
{paymentResult && (
  <div className="mt-4">
    <a href={paymentResult.redirect_url} target="_blank" className="btn btn-primary">
      Lanjut ke Midtrans
    </a>
  </div>
)}
```

Ganti menjadi tombol **"Bayar Sekarang"** yang memicu `handlePay`:
```tsx
{/* SESUDAHNYA */}
{paymentResult && (
  <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-100">
    <h3 className="text-sm font-bold text-slate-700 mb-2">Selesaikan Pembayaran</h3>
    <p className="text-xs text-slate-500 mb-4">Silakan klik tombol di bawah untuk membayar menggunakan Midtrans Snap.</p>
    
    {paymentError && (
      <div className="mb-4 text-xs font-semibold text-rose-600 bg-rose-50 p-3 rounded-lg">
        {paymentError}
      </div>
    )}

    <button
      onClick={() => handlePay(paymentResult.token)}
      disabled={isPaying || !isSnapReady}
      className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-xl font-bold transition-all text-sm flex items-center justify-center gap-2"
    >
      {isPaying ? (
        <>
          <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
          Memproses Pembayaran...
        </>
      ) : (
        'Bayar Sekarang'
      )}
    </button>
  </div>
)}
```

---

## 🔍 Acceptance Criteria
1. Tidak ada tab baru yang terbuka saat user melakukan checkout game topup.
2. Popup Midtrans Snap berhasil terbuka di atas halaman GameTopUp ketika tombol "Bayar Sekarang" diklik.
3. Setelah user menutup popup (onClose) atau sukses membayar, state ditangani dengan benar.
4. Menjalankan build `npm run build` sukses tanpa error compiler.

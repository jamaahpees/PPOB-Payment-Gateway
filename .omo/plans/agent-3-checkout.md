# Agent 3: Checkout Component Integration Plan

> **Goal**: Mengintegrasikan Midtrans Snap popup ke dalam checkout flow katalog produk utama (`Checkout.tsx`).

---

## 📋 Tasks

### [x] 1. Edit `Frontend/src/components/Checkout.tsx`

Lakukan modifikasi berikut:

#### **A. Import Hook & Helper**
```typescript
import { useMidtransSnap } from '../hooks/useMidtransSnap';
import { buildApiUrl, readApiError } from '../lib/api';
```

#### **B. Inisialisasi Hook & State**
Panggil hook di dalam komponen `Checkout`:
```typescript
const { pay, isReady: isSnapReady } = useMidtransSnap();
const [isInitializingPayment, setIsInitializingPayment] = useState(false);
const [paymentError, setPaymentError] = useState<string | null>(null);
```

#### **C. Hubungkan ke handleCheckout Flow**
Cari fungsi `handleCheckout` yang memicu pembuatan order.
Di dalam flow sukses setelah order dibuat (`POST /api/orders/create`):
- Panggil API endpoint backend untuk generate token Midtrans: `POST /api/payments/midtrans/initialize`
- Mengirimkan body `{ order_id: createdOrderId }` (dapatkan ID order dari response order creation).
- Setelah token diterima, picu popup Snap.js.

```typescript
// Contoh implementasi di dalam handleCheckout:
try {
  setIsSubmitting(true);
  setPaymentError(null);

  // 1. Buat Order
  const orderRes = await fetch(buildApiUrl('/orders/create'), {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}` // jika auth diperlukan
    },
    body: JSON.stringify(orderData)
  });

  if (!orderRes.ok) {
    const errData = await orderRes.json();
    throw new Error(errData.message || 'Gagal membuat order');
  }

  const orderResult = await orderRes.json();
  const orderId = orderResult.id || orderResult.order_id; // sesuaikan property backend
  const invoiceCode = orderResult.invoice_code;

  if (!orderId) {
    throw new Error('Order ID tidak ditemukan dalam response');
  }

  // 2. Initialize Midtrans Snap Token
  setIsInitializingPayment(true);
  const paymentRes = await fetch(buildApiUrl('/payments/midtrans/initialize'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ order_id: orderId })
  });

  if (!paymentRes.ok) {
    const payErr = await paymentRes.json();
    throw new Error(payErr.message || 'Gagal menginisialisasi pembayaran Midtrans');
  }

  const paymentData = await paymentRes.json(); // { token, redirect_url }
  setIsInitializingPayment(false);

  // 3. Buka Snap Popup
  pay(paymentData.token, {
    onSuccess: (result) => {
      // Close checkout modal
      onClose();
      // Redirect ke invoice status page
      window.location.hash = `#/invoice/${invoiceCode}`;
    },
    onPending: (result) => {
      onClose();
      window.location.hash = `#/invoice/${invoiceCode}`;
    },
    onError: (err) => {
      setPaymentError('Gagal memproses pembayaran Midtrans.');
      console.error(err);
    },
    onClose: () => {
      // Jika diclose, arahkan ke halaman invoice agar user bisa bayar nanti
      onClose();
      window.location.hash = `#/invoice/${invoiceCode}`;
    }
  });

} catch (err: any) {
  setIsSubmitting(false);
  setIsInitializingPayment(false);
  setPaymentError(err.message || 'Terjadi kesalahan sistem');
}
```

#### **D. Tambahkan Pesan Error & Loading di UI Modal**
Tampilkan state loading jika sedang inisialisasi pembayaran, dan tampilkan `paymentError` di atas tombol submit modal.

---

## 🔍 Acceptance Criteria
1. [x] Alur checkout katalog produk utama kini terintegrasi langsung dengan Midtrans Snap popup.
2. [x] Token Midtrans diinisialisasi secara otomatis setelah order berhasil terbuat.
3. [x] Halaman redirect ke `/invoice/{code}` berjalan setelah transaksi sukses, pending, atau saat popup diclose.
4. [x] Menjalankan build `npm run build` di folder `Frontend` sukses tanpa compile error.

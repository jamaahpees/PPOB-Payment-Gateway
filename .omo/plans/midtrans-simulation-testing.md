# Midtrans & Digiflazz Sandbox E2E Simulation Plan

> **Goal**: Menguji seluruh alur transaksi dari pemilihan produk, inisialisasi pembayaran Snap.js popup, simulasi pembayaran Midtrans Sandbox, callback webhook backend, hingga simulasi status fulfillment Digiflazz di VPS.

---

## 🛠️ Simulation Settings & Test Credentials

### 1. Midtrans Sandbox Credentials
- **Client Key**: `SB-Mid-client-1MSPDrIDg0a71w-h`
- **Server Key**: `SB-Mid-server-qJvT62BTwM7X169rmYTew6dK`

### 2. Digiflazz Sandbox Phone Rules
Gunakan nomor handphone / ID pelanggan khusus ini untuk mensimulasikan respons Digiflazz:
- **087800001230** -> **SUCCESS** (Fulfillment otomatis berhasil Instan)
- **087800001232** -> **FAILED** (Fulfillment otomatis ditolak/gagal)
- **087800001233** -> **PENDING** (Fulfillment tertunda/dalam antrian)

---

## 🏃‍♂️ Flow 1: Game Topup E2E (Snap Popup)

### Langkah 1: Buat Order
1. Buka Halaman Game Topup di UI (atau `#/catalog` / `#/`).
2. Masukkan User ID & Zone ID. Contoh:
   - User ID: `12345678`
   - Zone ID: `1234`
3. Masukkan Email Pembeli (misal: `test-buyer@adnanpay.com`).
4. Masukkan Nomor Handphone khusus Digiflazz: **`087800001230`** (untuk tes sukses).
5. Pilih produk (misal: "Mobile Legends 10 Diamonds" - `xld10`).
6. Klik **"Beli Sekarang"**.

### Langkah 2: Popup Pembayaran (Midtrans Snap)
1. Setelah klik Beli Sekarang, tombol **"Bayar Sekarang"** akan muncul atau popup Snap akan langsung termuat secara dinamis.
2. Klik **"Bayar Sekarang"**.
3. **Popup Midtrans Snap** harus terbuka di tengah layar.
4. Pilih metode pembayaran **Credit Card**.
5. Gunakan nomor kartu uji coba Midtrans:
   - Card Number: **`4811 1111 1111 1111`** (Visa Success)
   - Expiry Date: Sembarang tanggal masa depan (misal: `12/28`)
   - CVV: `123`
6. Klik **"Pay Now"**.
7. Masukkan 3D Secure OTP: **`112233`** -> klik **"OK"**.

### Langkah 3: Verifikasi Callback & Invoice
1. Popup Snap akan otomatis ter-close setelah pembayaran sukses.
2. Halaman otomatis ter-redirect ke **`#/invoice/{invoice_code}`**.
3. Timeline status pada halaman invoice harus berubah:
   - `pending_payment` -> **`paid`** (Hijau)
   - `paid` -> **`fulfillment_pending`** (Proses ke Digiflazz)
   - **`success`** (Hijau, jika SN/Serial Number terisi otomatis dari Digiflazz).

---

## 🏃‍♂️ Flow 2: Catalog Checkout E2E (Multi-Item)

### Langkah 1: Tambah ke Keranjang
1. Buka katalog produk utama (`#/products` / `#/catalog`).
2. Pilih produk pulsa/data (misal: `xld10` Indosat).
3. Klik **"Checkout"**. Modal keranjang belanja/checkout akan muncul.
4. Masukkan nomor HP Digiflazz: **`087800001230`**.
5. Klik **"Complete Purchase"**.

### Langkah 2: Proses Pembayaran
1. Modal checkout akan memicu `POST /api/orders/create` -> `POST /api/payments/midtrans/initialize`.
2. Loading spinner akan muncul selama inisialisasi.
3. Popup Midtrans Snap terbuka otomatis.
4. Kali ini pilih **Virtual Account / Bank Transfer** (Contoh: **BCA** / **Permata**).
5. Ambil **Virtual Account Number** yang tampil di popup.

### Langkah 3: Gunakan Midtrans Sandbox Simulator
1. Buka tab baru di browser: **[Midtrans Sandbox Simulator](https://simulator.sandbox.midtrans.com/)**.
2. Pilih menu **BCA VA** / **Permata VA** (sesuai metode yang Anda pilih di popup).
3. Paste **Virtual Account Number** -> Klik **"Inquire"** -> Klik **"Pay"**.
4. Kembali ke halaman invoice PPOB app Anda. Dalam 2-5 detik, status invoice akan otomatis update menjadi **`paid`** via websocket/polling, tanpa reload halaman.
5. Verifikasi bahwa status fulfillment ke Digiflazz sukses.

---

## 🏃‍♂️ Flow 3: Uji Coba Error & Cancel

### Scenario A: User Cancel Transaksi (onClose)
1. Buat order baru.
2. Di dalam popup Snap, klik tombol **silang (X)** / "Back" di kiri atas untuk membatalkan pembayaran.
3. Popup tertutup. UI aplikasi harus memunculkan pesan merah: **"Pembayaran dibatalkan oleh pengguna."**
4. Tombol **"Bayar Sekarang"** harus tetap aktif agar user bisa mencoba kembali tanpa membuat order baru.

### Scenario B: Transaksi Kadaluarsa / Expired
1. Buat order baru via Virtual Account, tetapi jangan bayar di simulator.
2. Biarkan transaksi expired (default 24 jam, atau bisa diset di backend).
3. Status invoice pada halaman detail harus berubah menjadi **`expired`** dan opsi bayar diblokir.

### Scenario C: Digiflazz Pembelian Gagal (Fulfillment Failed)
1. Buat order Game Topup.
2. Gunakan nomor HP khusus gagal: **`087800001232`**.
3. Bayar dengan Credit Card (Visa Success: `4811 1111 1111 1111`).
4. Setelah transaksi Midtrans sukses, order berubah jadi `paid`.
5. Digiflazz akan memproses nomor `087800001232` -> **Respons Gagal**.
6. Status order di halaman invoice harus berubah menjadi **`failed`** (Merah) dengan catatan error dari Digiflazz.

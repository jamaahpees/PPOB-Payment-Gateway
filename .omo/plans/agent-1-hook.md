# Agent 1: Hook & Env Foundation Plan

> **Goal**: Membuat file environment configuration (`.env.*`) dan dynamic script injection hook untuk Midtrans Snap.js.

---

## 📋 Tasks

### 1. Setup `.env.*` Files

Buat/update file di folder `Frontend/` dengan konfigurasi berikut. **PASTIKAN tidak ada credential yang di-hardcode di file kode.**

#### **`Frontend/.env.development`** (Buat Baru)
```env
VITE_API_BASE_URL=http://localhost:3001
VITE_MIDTRANS_CLIENT_KEY=SB-Mid-client-1MSPDrIDg0a71w-h
VITE_MIDTRANS_SNAP_URL=https://app.sandbox.midtrans.com/snap/snap.js
```

#### **`Frontend/.env.production`** (Update)
```env
VITE_API_BASE_URL=/api
VITE_MIDTRANS_CLIENT_KEY=SB-Mid-client-1MSPDrIDg0a71w-h
VITE_MIDTRANS_SNAP_URL=https://app.midtrans.com/snap/snap.js
```

#### **`Frontend/.env.example`** (Update)
```env
VITE_API_BASE_URL=/api
VITE_MIDTRANS_CLIENT_KEY=your_midtrans_client_key_here
VITE_MIDTRANS_SNAP_URL=https://app.sandbox.midtrans.com/snap/snap.js
```

---

### 2. Buat Custom Hook `useMidtransSnap.ts`

Buat file baru di **`Frontend/src/hooks/useMidtransSnap.ts`**:

```typescript
import { useEffect, useState } from 'react';

export interface SnapCallbacks {
  onSuccess?: (result: any) => void;
  onPending?: (result: any) => void;
  onError?: (result: any) => void;
  onClose?: () => void;
}

declare global {
  interface Window {
    snap?: {
      pay: (token: string, callbacks?: SnapCallbacks) => void;
    };
  }
}

export function useMidtransSnap() {
  const [isReady, setReady] = useState(false);
  const [isLoading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Cek jika script sudah ada
    const existingScript = document.getElementById('midtrans-snap-script');
    
    if (existingScript) {
      if (window.snap) {
        setReady(true);
        setLoading(false);
      } else {
        existingScript.addEventListener('load', () => {
          setReady(true);
          setLoading(false);
        });
      }
      return;
    }

    // 2. Jika belum ada, load dynamically
    const snapUrl = import.meta.env.VITE_MIDTRANS_SNAP_URL;
    const clientKey = import.meta.env.VITE_MIDTRANS_CLIENT_KEY;

    if (!snapUrl || !clientKey) {
      console.error('Midtrans configuration missing in env vars');
      setLoading(false);
      return;
    }

    const script = document.createElement('script');
    script.id = 'midtrans-snap-script';
    script.src = snapUrl;
    script.setAttribute('data-client-key', clientKey);
    script.type = 'text/javascript';
    
    script.onload = () => {
      setReady(true);
      setLoading(false);
    };

    script.onerror = () => {
      console.error('Failed to load Midtrans Snap.js');
      setLoading(false);
    };

    document.head.appendChild(script);
  }, []);

  const pay = (token: string, callbacks?: SnapCallbacks) => {
    if (!window.snap) {
      console.error('Snap.js is not loaded yet');
      if (callbacks?.onError) {
        callbacks.onError(new Error('Snap.js is not loaded yet'));
      }
      return;
    }
    window.snap.pay(token, callbacks);
  };

  return { pay, isReady, isLoading };
}
```

---

## 🔍 Acceptance Criteria
1. File `.env.development`, `.env.production`, dan `.env.example` ter-create/update dengan benar.
2. File `Frontend/src/hooks/useMidtransSnap.ts` terbuat tanpa error TypeScript.
3. Menjalankan typecheck `npm run build` di folder `Frontend` sukses tanpa error.

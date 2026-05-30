# Playwright E2E Automation Testing Plan

> **Goal**: Mengotomatisasi pengujian alur checkout dan pembayaran menggunakan Playwright MCP untuk memverifikasi fungsionalitas popup Midtrans Snap.js di VPS secara langsung, lengkap dengan console log check dan screenshot capture.

---

## 🛠️ Testing Environment

- **Target App URL**: `http://10.244.74.23` (Frontend)
- **Target API Base**: `http://10.244.74.23/api`
- **Midtrans Simulator**: `https://simulator.sandbox.midtrans.com/`

---

## 📋 Automation Scenarios

### Scenario 1: Game Topup E2E Success Automation
Script ini mengotomatisasi langkah dari pengisian form hingga checkout sukses di GameTopUp.

#### **Execution Script (`scripts/test-gametopup.js`)**
```javascript
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();

  // Merekam console log error
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`[BROWSER ERROR] ${msg.text()}`);
    }
  });

  try {
    console.log('1. Navigasi ke website PPOB...');
    await page.goto('http://10.244.74.23/#/');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'step1-homepage.png' });

    console.log('2. Memilih kategori game topup...');
    // Klik input/katalog
    await page.fill('[data-testid="catalog-search"]', 'xld10');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'step2-search.png' });

    console.log('3. Isi ID pelanggan...');
    await page.fill('input[placeholder*="ID"]', '12345678');
    await page.fill('input[placeholder*="Zone"]', '1234');
    await page.fill('input[type="email"]', 'automated-test@adnanpay.com');
    await page.fill('input[placeholder*="Nomor Handphone"]', '087800001230'); // Sukses Digiflazz
    
    // Pilih nominal/produk
    await page.click('[data-testid="product-card-0"]');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'step3-form-filled.png' });

    console.log('4. Kirim checkout order...');
    await page.click('button[type="submit"]'); // Submit checkout form
    await page.waitForSelector('text=Bayar Sekarang', { timeout: 15000 });
    await page.screenshot({ path: 'step4-order-created.png' });

    console.log('5. Klik tombol Bayar Sekarang (Snap Popup)...');
    await page.click('text=Bayar Sekarang');
    
    // Tunggu iframe Snap Midtrans ter-render
    console.log('6. Menunggu iframe Midtrans Snap...');
    await page.waitForSelector('iframe#snap-midtrans', { timeout: 15000 });
    const iframeElement = await page.$('iframe#snap-midtrans');
    const snapFrame = await iframeElement.contentFrame();
    
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'step5-snap-popup-visible.png' });

    console.log('7. Pilih metode Credit Card di dalam iframe...');
    await snapFrame.click('text=Credit/Debit Card');
    await page.waitForTimeout(1000);

    // Isi detail kartu kredit sandbox
    console.log('8. Mengisi detail kartu kredit sandbox...');
    await snapFrame.fill('input[name="cardnumber"]', '4811111111111111');
    await snapFrame.fill('input[placeholder="MM / YY"]', '12/28');
    await snapFrame.fill('input[placeholder="CVV"]', '123');
    await page.screenshot({ path: 'step6-cc-filled.png' });

    console.log('9. Bayar...');
    await snapFrame.click('text=Pay Now');

    // Tunggu iframe 3DS OTP
    console.log('10. Menunggu OTP dialog...');
    await page.waitForTimeout(4000); // Tunggu modal 3DS
    const otpFrame = await snapFrame.frameLocator('iframe[src*="redirect"]');
    await otpFrame.locator('input#password').fill('112233');
    await page.screenshot({ path: 'step7-otp-prompt.png' });
    await otpFrame.locator('button[type="submit"]').click();

    console.log('11. Menunggu redirect ke invoice status page...');
    await page.waitForNavigation({ url: /.*\/invoice\/.*/, timeout: 30000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'step8-invoice-success.png' });

    console.log('✅ TEST PASSED: Game topup E2E berhasil sepenuhnya.');

  } catch (error) {
    console.error('❌ TEST FAILED:', error);
    await page.screenshot({ path: 'test-failure.png' });
  } finally {
    await browser.close();
  }
})();
```

---

## 🔍 Verification Checklist (Post-Automation)

### 1. Iframe verification
- [ ] Verifikasi `iframe#snap-midtrans` terbuat dan terisi UI Midtrans Snap.
- [ ] Verifikasi client key yang dikirim ke `snap.js` sesuai dengan `SB-Mid-client-1MSPDrIDg0a71w-h`.

### 2. Status Polling verification
- [ ] Setelah pembayaran sukses, UI Invoice Status Page langsung merespons timeline `paid` -> `fulfillment_pending` -> `success` tanpa reload halaman.

### 3. Error Handling check
- [ ] Jalankan automation kedua menggunakan nomor HP `087800001232` (gagal Digiflazz).
- [ ] Verifikasi timeline invoice menunjukkan status `failed` merah setelah pembayaran selesai.

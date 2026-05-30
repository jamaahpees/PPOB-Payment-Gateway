# Digiflazz Prepaid Buyer API Integration Specifications

This documentation serves as an authoritative technical reference for integrating the Digiflazz Prepaid Buyer API.

---

## 1. Authentication & Signature Generation

Digiflazz secures all API endpoints using MD5-based request signatures. The signature formula varies depending on the endpoint.

### Base Endpoint URLs
*   **Sandbox (Development)**: `https://api.digiflazz.com/v1` (Note: Uses the same endpoint; testing mode is activated via payload parameters)
*   **Production**: `https://api.digiflazz.com/v1`

### Signature Formulas

#### A. Price List & Balance Check (Deposit) Signature:
$$\text{sign} = \text{MD5}(\text{username} + \text{apiKey} + \text{"depo"})$$
*   `depo` is a static string component.

#### B. Transaction (Topup/Status Inquiry) Signature:
$$\text{sign} = \text{MD5}(\text{username} + \text{apiKey} + \text{ref\_id})$$
*   `ref_id` is the unique transaction reference code sent in your request body.

#### C. Price List (Pricelist Fetch) Signature:
$$\text{sign} = \text{MD5}(\text{username} + \text{apiKey} + \text{"pricelist"})$$
*   `pricelist` is a static string component.

#### Node.js / TypeScript Generation Implementation:
```typescript
import { createHash } from 'crypto';

function generateDigiflazzSignature(username: string, apiKey: string, refIdOrStatic: string): string {
  const rawString = username + apiKey + refIdOrStatic;
  return createHash('md5').update(rawString).digest('hex');
}
```

---

## 2. Core API Payloads & Request Structures

All requests are `POST` requests and require a JSON request body.

### A. Balance (Deposit) Inquiry
Check your current remaining deposit balance.

**Endpoint**: `POST /v1/cek-saldo`

#### Request Payload:
```json
{
  "cmd": "deposit",
  "username": "adnanpay",
  "sign": "f05781a704e6c3821a8cd398ea00123f"
}
```

#### Response Payload (wrapped in a `data` object):
```json
{
  "data": {
    "deposit": 15420950
  }
}
```

### B. Fetch Price List (All Products)
Fetch the price list of prepaid products. Limit: 1 request every 5 minutes (83 rate limit code).

**Endpoint**: `POST /v1/price-list`

#### Request Payload:
```json
{
  "cmd": "prepaid",
  "username": "adnanpay",
  "sign": "7cd02a8cd39ef81a704f05788ea00456"
}
```

### C. Create Topup Transaction
Execute a topup/purchase order.

**Endpoint**: `POST /v1/transaction`

#### Request Payload:
```json
{
  "username": "adnanpay",
  "buyer_sku_code": "xld10",
  "customer_no": "087800001230",
  "ref_id": "ORD-20260521-XLD10-01",
  "sign": "4a70f0578f8123fa704e6cd398ea0012",
  "testing": true
}
```
*Note: Include `"testing": true` when executing sandbox transactions.*

#### Response Payload (wrapped in `data`):
```json
{
  "data": {
    "ref_id": "ORD-20260521-XLD10-01",
    "customer_no": "087800001230",
    "buyer_sku_code": "xld10",
    "message": "Transaksi Sukses",
    "status": "Sukses",
    "rc": "00",
    "sn": "1234567890",
    "buyer_last_saldo": 990000,
    "price": 10000
  }
}
```

---

## 3. Webhook Callback Specifications

Digiflazz triggers webhooks asynchronously to your registered callback URL when transaction statuses change.

**Request Method**: `POST`  
**User-Agent (Prabayar/Prepaid)**: `Digiflazz-Hookshot`  
**User-Agent (Pascabayar/Postpaid)**: `Digiflazz-Pasca-Hookshot`

### Webhook Event Signature Security
If configured with a `secret` token in your connection settings, Digiflazz sends the header `X-Hub-Signature` containing an HMAC-SHA1 hex code generated from the request body.

$$\text{X-Hub-Signature} = \text{"sha1="} + \text{HMAC-SHA1}(\text{RequestBody}, \text{SecretKey})$$

#### Node.js / TypeScript Verification Code:
```typescript
import { createHmac } from 'crypto';

function verifyDigiflazzWebhook(rawBody: string, expectedSignature: string, secretKey: string): boolean {
  const hash = 'sha1=' + createHmac('sha1', secretKey).update(rawBody).digest('hex');
  return hash === expectedSignature;
}
```

### Webhook JSON Payload Example (Prepaid Success):
```json
{
  "data": {
    "ref_id": "ORD-20260521-XLD10-01",
    "customer_no": "087800001230",
    "buyer_sku_code": "xld10",
    "message": "Sukses",
    "status": "Sukses",
    "rc": "00",
    "buyer_last_saldo": 990000,
    "sn": "XL529384729104",
    "price": 10000
  }
}
```

---

## 4. Sandbox Testing & Environment Specifications

To run development testing without deducting deposit funds, send `"testing": true` in your transaction payload.

### Test Case Parameters (Prepaid)
Use the test SKU code `xld10` and these specific destination phone numbers (`customer_no`) to simulate exact sandbox outcomes:

| buyer_sku_code | customer_no | Target Outcome / Status | Callback Event Sequence |
|:---|:---|:---|:---|
| **xld10** | `087800001230` | **Sukses** (Success) | Instantly returns rc `00` Success |
| **xld10** | `087800001232` | **Gagal** (Failed) | Instantly returns rc `02` Gagal |
| **xld10** | `087800001233` | **Pending** -> **Sukses** | Returns rc `03` Pending -> Sends Webhook `Sukses` |
| **xld10** | `087800001234` | **Pending** -> **Gagal** | Returns rc `03` Pending -> Sends Webhook `Gagal` |

---

## 5. Important Response Codes (RC)

| RC | Message / Status | Transaction Formed | Action Plan |
|:---|:---|:---|:---|
| **00** | Transaksi Sukses | Yes | Deliver product to user, set state to successful. |
| **01** | Timeout | Yes | Do not retry automatically. Check status manually. |
| **02** | Transaksi Gagal | Yes | Refund user balance, set state to failed. |
| **03** | Transaksi Pending | Yes | Do not resubmit. Listen to callback or poll status. |
| **41** | Signature tidak valid | No | MD5 signature mismatch. Check secret key and format. |
| **83** | Limitasi pricelist (5 menit 1x) | No | Cache pricelist locally. Do not fetch dynamically. |
| **85** | Limitasi transaksi (1 menit 1x) | Yes | Duplicate transaction for same number blocked. |

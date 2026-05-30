# Midtrans Developer Integration Specifications

This documentation serves as an authoritative technical reference for integrating the Midtrans Payment Gateway.

---

## 1. Authentication & API Request Headers

Midtrans requires specific HTTP headers for authentication and data format definitions. All API requests use JSON payloads.

### API Environment Base URLs
*   **Sandbox**: `https://api.sandbox.midtrans.com`
*   **Production**: `https://api.midtrans.com`

### Required HTTP Headers
*   **Content-Type**: `application/json`
*   **Accept**: `application/json`
*   **Authorization**: `Basic <Base64EncodedServerKey>`

### Authorization Header Generation Formula
To create the Authorization header value:
1. Obtain your **Server Key** from the Midtrans Dashboard (MAP) -> *Settings* -> *Access Keys*.
2. Append a colon (`:`) character directly to the end of your Server Key. There is no password component (it is left blank).
3. Encode the resulting string `ServerKey:` into Base64 format.
4. Prepend the word `Basic ` to the encoded string.

#### Node.js / JavaScript Implementation:
```javascript
const serverKey = 'SB-Mid-server-abc123cde456';
const authHeader = 'Basic ' + Buffer.from(serverKey + ':').toString('base64');
// Resulting header: 'Authorization': 'Basic U0ItTWlkLXNlcnZlci1hYmMxMjNjZGU0NTY6'
```

*Note: For client-side requests from the browser (e.g., getting a credit card token), the secret Server Key must never be exposed. Use the **Client Key** via query parameters instead.*

---

## 2. Core Payment Operations

### A. Creating a Snap Transaction (Snap API)
Snap is Midtrans' hosted payment checkout UI. Your backend initiates a token request, and your frontend displays the Snap payment popup/redirect.

**Endpoint**: `POST /snap/v1/transactions`

#### Request Payload Structure:
```json
{
  "transaction_details": {
    "order_id": "ORD-20260521-99882",
    "gross_amount": 100000
  },
  "credit_card": {
    "secure": true
  },
  "customer_details": {
    "first_name": "Adnan",
    "last_name": "Pay",
    "email": "customer@adnanpay.com",
    "phone": "081234567890"
  },
  "item_details": [
    {
      "id": "xld10",
      "price": 100000,
      "quantity": 1,
      "name": "XL 10.000 Sandbox Test"
    }
  ]
}
```

#### Response Payload Structure:
```json
{
  "token": "a1b2c3d4-e5f6-7a8b-9c0d-e1f2a3b4c5d6",
  "redirect_url": "https://app.sandbox.midtrans.com/snap/v2/vtweb/a1b2c3d4-e5f6-7a8b-9c0d-e1f2a3b4c5d6"
}
```

### B. Core API Charge (Direct API Integration)
Core API bypasses hosted pages and allows you to initiate payment processes directly from your backend (e.g., generating Bank Transfer Virtual Accounts).

**Endpoint**: `POST /v2/charge`

#### Example payload for Bank Transfer (GoPay/Virtual Account):
```json
{
  "payment_type": "bank_transfer",
  "transaction_details": {
    "order_id": "ORD-20260521-99883",
    "gross_amount": 100000
  },
  "bank_transfer": {
    "bank": "bni"
  }
}
```

#### Response containing the payment identifier (e.g. Virtual Account number):
```json
{
  "status_code": "201",
  "status_message": "Success, Bank Transfer transaction is created",
  "transaction_id": "57d5293c-e65f-4a29-95e4-5959c3fa335b",
  "order_id": "ORD-20260521-99883",
  "gross_amount": "100000.00",
  "payment_type": "bank_transfer",
  "transaction_time": "2026-05-21 12:00:00",
  "transaction_status": "pending",
  "va_numbers": [
    {
      "bank": "bni",
      "va_number": "9881234567890123"
    }
  ]
}
```

---

## 3. Webhook (HTTP Notification) Specifications

Midtrans automatically posts a payload to your registered callback endpoint when a transaction updates.

**Request Method**: `POST`  
**Content-Type**: `application/json`

### Signature Verification (CRITICAL)
Every webhook contains a `signature_key` parameter. You **must** verify this key on your backend before acting on the notification to prevent fake transactions.

#### Signature Key Formula:
Generate a SHA-512 hash of the concatenated parameters:
$$\text{signature\_key} = \text{SHA-512}(\text{order\_id} + \text{status\_code} + \text{gross\_amount} + \text{ServerKey})$$

*   `gross_amount` must have the exact string formatting received in the payload (typically decimal padded, e.g. `"100000.00"`).
*   `ServerKey` is your confidential Server Key.

#### Node.js / TypeScript Verification Code:
```typescript
import { createHash } from 'crypto';

interface MidtransNotification {
  order_id: string;
  status_code: string;
  gross_amount: string;
  signature_key: string;
  transaction_status: string;
  fraud_status?: string;
  payment_type: string;
}

function verifyNotificationSignature(payload: MidtransNotification, serverKey: string): boolean {
  const rawString = payload.order_id + payload.status_code + payload.gross_amount + serverKey;
  const hash = createHash('sha512').update(rawString).digest('hex');
  return hash === payload.signature_key;
}
```

### Webhook JSON Payload Example:
```json
{
  "transaction_time": "2026-05-21 12:05:00",
  "transaction_status": "settlement",
  "transaction_id": "57d5293c-e65f-4a29-95e4-5959c3fa335b",
  "status_message": "midtrans payment notification",
  "status_code": "200",
  "signature_key": "16d6f84b2fb0468e2a9cf99a8ac4e5d803d42180347aaa70cb2a7abb13b5c6130458ca9c71956a962c0827637cd3bc7d40b21a8ae9fab12c7c3efe351b18d00a",
  "payment_type": "bank_transfer",
  "order_id": "ORD-20260521-99883",
  "merchant_id": "G141532850",
  "gross_amount": "100000.00",
  "currency": "IDR"
}
```

### Transaction Status Mapping

Implement the following database updates on status updates:

| `transaction_status` | `fraud_status` | Status Meaning / Database Mapping |
|:---|:---|:---|
| **capture** | `accept` | Credit Card transaction successful -> Set to **success** / **completed** |
| **capture** | `challenge` | Flagged by Fraud Detection (FDS) -> Hold order, review manually |
| **settlement** | *Any* / *None* | Non-Credit Card payment completed successfully -> Set to **success** / **completed** |
| **pending** | *Any* / *None* | Customer has received payment instructions -> Set to **pending** / **waiting_payment** |
| **deny** | *Any* / *None* | Rejected by bank or FDS -> Cancel order, set to **failed** |
| **cancel** | *Any* / *None* | Cancelled by merchant or customer -> Set to **cancelled** |
| **expire** | *Any* / *None* | Payment window expired -> Set to **expired** / **failed** |

---

## 4. Sandbox Testing & Environment Specifications

To test integrations safely without actual money, use the Sandbox environment.

*   **API Sandbox URL**: `https://api.sandbox.midtrans.com`
*   **Snap Sandbox Script URL**: `https://app.sandbox.midtrans.com/snap/snap.js`

### Sandbox Testing Credentials
Midtrans provides test payment flows in Sandbox mode:

#### 1. Sandbox Credit Cards
Use these card numbers to simulate specific transaction behaviors:
*   **Success (3D Secure)**: `4811 1111 1111 1114` (Expiry: any future date, CVV: any 3 digits)
*   **FDS Deny**: `4811 1111 1111 1122`
*   **FDS Challenge**: `4811 1111 1111 1130`
*   **3DS OTP**: Enter `112233` during checkout 3DS prompt.

#### 2. Sandbox Bank Transfer (Virtual Accounts)
When paying via simulated BNI/GRI/Permata Virtual Account, use the **Midtrans Sandbox Payment Simulator** at `https://simulator.sandbox.midtrans.com/` to trigger manual `settlement` or `expire` events on specific VAs.

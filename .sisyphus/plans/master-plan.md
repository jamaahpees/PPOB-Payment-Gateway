# Consolidated Master Plan - PPOB Payment System (Audited 2026-05-23)

## Execution Model
**ALL tasks executed by main agent directly. No subagent delegation.**
Working directory for backend commands: `D:\coding\1.PPOB PAYMENT\backend`
Working directory for frontend commands: `D:\coding\1.PPOB PAYMENT\Frontend`

## Status Summary
All core development waves (Waves 1–2, Security Hardening, Audit System, Database Migration, and Navigation/Checkout fixes) have been successfully built, tested, and deployed to production at `https://demo.hanzserver.online`.

**Critical gaps discovered during audit (2026-05-23):**
- T8 (`reseller-payout.spec.ts`) exists but does NOT satisfy acceptance criteria — payout backend router and frontend UI are missing, so payout flow cannot be simulated
- Backend `payout.service.ts` is complete but has no router → no API endpoint exposed
- Frontend has no payout request UI component
- TestSprite MCP used is a **local custom MCP** (`mcp/adnanpay-testsprite/index.js`) with stub implementations for `validateResellerTransaction`, `validateResellerPayout`, `validateAdminManagement` — these return `todo` findings only

The active work items remaining are:

1. **T8a** — Wire backend payout router (expose payout API endpoints).
2. **T8b** — Build frontend payout UI in dashboard (reseller can see balance + request payout form).
3. **T8c** — Rewrite `reseller-payout.spec.ts` to actually test payout flow end-to-end.
4. **T10** — Run all E2E simulations and capture evidence.
5. **T11–T13** — Run local TestSprite MCP validation and generate report.
6. **T14** — Fix bugs found during testing.
7. **T15** — Final verification wave (F1–F4).

---

## Active Checklist

### Wave 2: Reseller User Simulations

- [x] T7. Reseller transaction simulation
  - **Status**: `backend/playwright-tests/test-simulations/reseller-transaction.spec.ts` created and verified locally.

- [ ] **T8a. Wire payout backend router** *(PREREQUISITE for T8b, T8c)*
  - **Why this is needed**: `backend/src/modules/payout/payout.service.ts` and `payout.types.ts` exist with full business logic, but there is no `payout.router.ts` and the service is not registered in `backend/src/app.ts`. Without this, `POST /api/payout/request` and `GET /api/payout/requests` endpoints do not exist.
  - **What to do (main agent executes)**:
    1. Read `backend/src/modules/payout/payout.service.ts` and `payout.types.ts` to understand types.
    2. Read `backend/src/modules/commission/commission.router.ts` as a reference pattern for authenticated seller routes.
    3. Create `backend/src/modules/payout/payout.router.ts` with these endpoints:
       - `GET /api/payout/balance` — returns `{ payable_balance_minor: number }` for authenticated seller. Calls `payoutService.getUserPayableBalance(userId)`.
       - `POST /api/payout/request` — body: `{ amount_minor: number, bank_name: string, account_number: string, account_holder: string, legal_name: string, nik: string, address: string, phone?: string }`. Requires `role=seller`. Calls `payoutService.requestPayout(input)`. Returns 201 with payout request record.
       - `GET /api/payout/requests` — returns list of authenticated user's payout requests. Calls `payoutService.getUserPayoutRequests(userId)`.
    4. All 3 routes must use `authenticate` middleware (Bearer JWT). The `POST /request` route must also use `requireRoles(['seller'])`.
    5. Register the router in `backend/src/app.ts`: mount at `/api/payout`.
    6. Read `backend/src/app.ts` to understand how other routers are registered before editing.
  - **Acceptance Criteria**:
    - `GET /api/payout/balance` returns 200 with `payable_balance_minor` for authenticated reseller.
    - `POST /api/payout/request` returns 201 for valid input from authenticated seller.
    - `POST /api/payout/request` returns 401 if no token provided.
    - `POST /api/payout/request` returns 403 if user is not `role=seller`.
    - `GET /api/payout/requests` returns array (possibly empty) for authenticated seller.
    - `npm run typecheck` passes with zero errors from `backend/`.

- [ ] **T8b. Build frontend payout UI** *(PREREQUISITE for T8c)*
  - **Why this is needed**: `reseller-payout.spec.ts` comments explicitly state "payout UI does not exist in the application yet". Evidence `reseller-payout.txt` shows `dashboard_has_saldo_text false` — balance not displayed. The Playwright test currently only verifies page load, not payout flow.
  - **What to do (main agent executes)**:
    1. Read `Frontend/src/components/AuthDashboard.tsx` to understand layout and navigation patterns.
    2. Read `Frontend/src/lib/api.ts` and `Frontend/src/lib/auth.ts` to understand API call and token patterns.
    3. Add payout section to `AuthDashboard.tsx` (for `role=seller` users only):
       - Show current payable balance: call `GET /api/payout/balance` on mount, display `Rp {balance}` in a card with label "Saldo Komisi Tersedia".
       - Add "Ajukan Penarikan" button that opens an inline form (or modal) with fields: Jumlah Penarikan (`amount_minor` in IDR), Nama Bank, Nomor Rekening, Nama Pemilik Rekening, Nama Lengkap, NIK, Alamat, Telepon (optional).
       - On submit: call `POST /api/payout/request`. Show success message: "Pengajuan penarikan berhasil dikirim. Status: Menunggu". Show error message on failure.
       - List of existing payout requests from `GET /api/payout/requests` shown below the form: display request date, amount, status badge (pending/approved/rejected/paid).
    4. Guard the entire payout section with `user.role === 'seller'` check — non-sellers see nothing.
    5. Ensure Tailwind classes match existing dashboard style (amber/slate palette as seen in `TransaksiPage.tsx`).
  - **Acceptance Criteria**:
    - Dashboard shows "Saldo Komisi Tersedia: Rp X" for logged-in reseller.
    - "Ajukan Penarikan" button visible for seller role.
    - Payout form submits and shows success/error message.
    - Payout request history visible below form.
    - `npm run typecheck` in `Frontend/` passes.
    - `npm run build` in `Frontend/` completes without errors.

- [ ] **T8c. Rewrite reseller-payout.spec.ts to test actual payout flow**
  - **Why this is needed**: Current file only checks if dashboard and `/transaksi` page load. It does NOT test payout request creation or balance reservation per acceptance criteria.
  - **What to do (main agent executes)**:
    1. Read `backend/playwright-tests/helpers/api.ts` — understand `createTestUser`, `loginAsReseller`, `appendEvidence`.
    2. Read `backend/playwright-tests/test-simulations/reseller-transaction.spec.ts` as reference pattern.
    3. Rewrite `backend/playwright-tests/test-simulations/reseller-payout.spec.ts` with this flow:
       - Step 1: Create reseller test user via `createTestUser(request, 'reseller')`.
       - Step 2: Login via `loginAsReseller(page, email, password)`.
       - Step 3: Navigate to `/dashboard` — assert "Saldo Komisi Tersedia" is visible.
       - Step 4: Screenshot to `test-results/reseller-payout-balance.png`.
       - Step 5: Click "Ajukan Penarikan" — assert payout form appears.
       - Step 6: Fill form: amount=10000, bank_name="BCA", account_number="1234567890", account_holder="Test Reseller", legal_name="Test Reseller Legal", nik="1234567890123456", address="Jl Test No 1".
       - Step 7: Submit form — wait for success message matching `/berhasil|sukses|pending|menunggu/i`.
       - Step 8: Screenshot to `test-results/reseller-payout-success.png`.
       - Step 9: Verify via API: call `GET /api/payout/requests` with reseller Bearer token from `createTestUser` — assert response contains at least 1 payout request with `status === 'pending'`.
       - Step 10: Append evidence to `.sisyphus/evidence/reseller-payout.txt` with simulation result including payout request ID and status.
    4. Test PASSES only if: form visible → submitted → API confirms payout request created with `pending` status.
  - **Acceptance Criteria**:
    - Test creates a payout request via UI, confirms `pending` status via API.
    - Bank details stored correctly (verified via API response).
    - Balance reservation confirmed (payable balance decreases by requested amount after submit).
    - Screenshots saved to `test-results/`.
    - Evidence appended to `.sisyphus/evidence/reseller-payout.txt`.

---

### Wave 3: Playwright E2E Validation

- [ ] **T10. Verify all E2E simulations passed locally**
  - **What to do (main agent executes)**:
    1. Confirm baseURL is reachable: `curl https://demo.hanzserver.online/health`. If not reachable, document limitation and skip to T11.
    2. Run guest simulation (check file path first — it may be at `playwright-tests/guest.spec.ts` not in `test-simulations/`):
       ```powershell
       # workdir: D:\coding\1.PPOB PAYMENT\backend
       npx playwright test playwright-tests/test-simulations/ --reporter=list 2>&1 | Tee-Object -FilePath "..\\.sisyphus\\evidence\\e2e-all-run.txt"
       ```
    3. Run each individually and capture output:
       ```powershell
       npx playwright test playwright-tests/test-simulations/reseller-transaction.spec.ts --reporter=list 2>&1 | Tee-Object -FilePath "..\\.sisyphus\\evidence\\e2e-reseller-transaction-run.txt"
       npx playwright test playwright-tests/test-simulations/reseller-payout.spec.ts --reporter=list 2>&1 | Tee-Object -FilePath "..\\.sisyphus\\evidence\\e2e-reseller-payout-run.txt"
       ```
    4. Copy screenshots from `backend/test-results/` to `.sisyphus/evidence/` with prefix `e2e-`:
       ```powershell
       Get-ChildItem "test-results\*.png" | Copy-Item -Destination "..\\.sisyphus\\evidence\" -PassThru | ForEach-Object { Rename-Item $_.FullName ("..\.sisyphus\evidence\e2e-" + $_.Name) }
       ```
    5. Verify reseller payout evidence: check `.sisyphus/evidence/reseller-payout.txt` contains `pending` status entry from latest run.
  - **Acceptance Criteria**:
    - All 3 suites (reseller-transaction, reseller-payout, plus any guest sim) pass with 0 failures.
    - `.sisyphus/evidence/e2e-all-run.txt` exists and shows `0 failed`.
    - Screenshots saved to `.sisyphus/evidence/` with `e2e-` prefix.
    - `.sisyphus/evidence/reseller-payout.txt` contains a `pending` payout confirmation entry.

---

### Wave 4: TestSprite MCP Local Validation & Evidence

> **Architecture note**: TestSprite referenced here is the **local custom MCP server** at `mcp/adnanpay-testsprite/index.js`, not a cloud service. The `mcp/mcp andanpay-testsprite.json` contains a cloud API key for optional cloud TestSprite (`@testsprite/testsprite-mcp@latest`) — use if available, fall back to local MCP.

- [ ] **T11. Implement TestSprite MCP stub functions + verify server boots**
  - **Why this is needed**: `validateResellerTransaction`, `validateResellerPayout`, `validateAdminManagement` in `mcp/adnanpay-testsprite/index.js` are stubs returning `todo` findings — not real validation.
  - **What to do (main agent executes)**:
    1. Read `mcp/adnanpay-testsprite/index.js` in full.
    2. Implement `validateResellerTransaction(page, baseUrl, testData, findings)`:
       - Navigate to `${baseUrl}dashboard` → fill login form with `testData.email`/`testData.password` → submit → wait for dashboard.
       - Navigate to `${baseUrl}catalog` → click first product → fill phone input → click purchase → wait for `/invoice/` URL.
       - Push finding: `{ severity: 'info', category: 'success', message: 'Reseller transaction completed', location: 'reseller_transaction' }`.
       - On any caught error: push `critical` finding, return `false`.
    3. Implement `validateResellerPayout(page, baseUrl, testData, findings)`:
       - Navigate to `${baseUrl}dashboard` → login with `testData.email`/`testData.password` → wait for dashboard.
       - Assert "Saldo Komisi" text visible → push info finding.
       - Click "Ajukan Penarikan" → fill bank name and account fields → submit → wait for success message.
       - Push finding: `{ severity: 'info', category: 'success', message: 'Payout request submitted', location: 'reseller_payout' }`.
       - On any caught error: push `critical` finding, return `false`.
    4. Implement `validateAdminManagement(page, baseUrl, testData, findings)`:
       - Navigate to `${baseUrl}admin` → login with `testData.admin_email`/`testData.admin_password`.
       - Assert admin dashboard visible → push info finding.
       - Navigate to payout management section → assert payout list visible → push info finding.
       - On any caught error: push `critical` finding, return `false`.
    5. Boot test: 
       ```powershell
       # workdir: D:\coding\1.PPOB PAYMENT\mcp\adnanpay-testsprite
       npm install
       node index.js
       ```
       Should print `Adnanpay TestSprite MCP server running on stdio` without crash.
  - **Acceptance Criteria**:
    - All 6 flow types are fully implemented (not stubs).
    - `node mcp/adnanpay-testsprite/index.js` starts without error.

- [ ] **T12. Run TestSprite MCP validation flows and generate markdown report**
  - **What to do (main agent executes)**:
    1. Invoke the TestSprite MCP server tools. Target URL: `https://demo.hanzserver.online/`.
    2. Run flows in this order (use `test_data` with valid demo credentials from `DEMO_CREDENTIALS.md` or a fresh test user):
       - `validate_user_flow` with `flow_type="guest_checkout"`
       - `validate_user_flow` with `flow_type="guest_tracking"`
       - `validate_user_flow` with `flow_type="reseller_registration"`
       - `validate_user_flow` with `flow_type="reseller_transaction"` + `test_data={email, password}`
       - `validate_user_flow` with `flow_type="reseller_payout"` + `test_data={email, password}`
       - `validate_user_flow` with `flow_type="admin_management"` + `test_data={admin_email, admin_password}`
       - `accessibility_audit` with `url="https://demo.hanzserver.online/"`
       - `performance_audit` with `url="https://demo.hanzserver.online/"`
    3. Collect all JSON results from each tool call.
    4. Write `.sisyphus/evidence/testsprite-validation-report.md` containing:
       ```markdown
       # TestSprite Validation Report
       Date: {date}
       Target: https://demo.hanzserver.online/
       
       ## Summary Table
       | Flow | Status | Critical | High | Medium | Low |
       |------|--------|----------|------|--------|-----|
       | guest_checkout | PASS/FAIL | N | N | N | N |
       ...
       
       ## Accessibility Audit
       Violations: N
       Passes: N
       Critical violations: [list]
       
       ## Performance Audit
       Load time: Xms
       Assessment: good/needs improvement/poor
       
       ## Detailed Findings
       [Per flow: list all critical and high findings]
       ```
  - **Acceptance Criteria**:
    - All 8 tool invocations completed (pass or fail documented, no unhandled crash).
    - `.sisyphus/evidence/testsprite-validation-report.md` exists with all sections filled.
    - 0 unhandled exceptions in MCP execution.

- [ ] **T13. Deploy TestSuite to Production & Setup Continuous Monitoring**
  - **What to do (main agent executes)**:
    1. Attempt cloud TestSprite access:
       ```powershell
       npx @testsprite/testsprite-mcp@latest --version
       ```
    2. **If cloud accessible**: Load API_KEY from `mcp/mcp andanpay-testsprite.json`. Upload PRD specs. Configure target `https://adnanpay.com/`. Deploy. Set daily 08:00 WIB cron schedule. Enable failure alerting. Screenshot portal, save to `.sisyphus/evidence/testsprite-portal-setup.png`.
    3. **If cloud NOT accessible**: Write limitation doc at `.sisyphus/evidence/testsprite-cloud-limitation.md`. Create `.github/workflows/testsprite-scheduled.yml`:
       ```yaml
       name: TestSprite Scheduled Validation
       on:
         schedule:
           - cron: '0 1 * * *'  # 08:00 WIB daily
       jobs:
         validate:
           runs-on: ubuntu-latest
           steps:
             - uses: actions/checkout@v4
             - uses: actions/setup-node@v4
               with:
                 node-version: '20'
             - run: cd mcp/adnanpay-testsprite && npm install
             - run: |
                 # Run MCP validation flows via node
                 node mcp/adnanpay-testsprite/index.js
       ```
    4. Write `.sisyphus/evidence/testsprite-deployment-report.md` with deployment status (cloud or GitHub Actions).
  - **Acceptance Criteria**:
    - Cloud deployed OR `.github/workflows/testsprite-scheduled.yml` created.
    - `.sisyphus/evidence/testsprite-deployment-report.md` exists with status and target URL.

---

### Wave 5: Fixes and Final Audits

- [ ] **T14. Fix codebase based on TestSprite & Playwright findings**
  - **What to do (main agent executes)**:
    1. Read `.sisyphus/evidence/testsprite-validation-report.md`.
    2. Check `backend/test-results/` for Playwright failure screenshots.
    3. Triage all `critical` and `high` findings. Create fix list in `.sisyphus/evidence/t14-fixes.md`.
    4. Fix each critical finding: identify root cause → apply fix → re-run specific test/flow to confirm resolved.
    5. Fix each high finding or document with justified deferral reason.
    6. After all fixes, run full verification:
       ```powershell
       # workdir: D:\coding\1.PPOB PAYMENT\backend
       npm run lint && npm run typecheck && npm test && npm run build
       ```
       ```powershell
       # workdir: D:\coding\1.PPOB PAYMENT\Frontend
       npm run lint && npm run typecheck && npm run build
       ```
    7. Re-run Playwright simulations to confirm no regression:
       ```powershell
       # workdir: D:\coding\1.PPOB PAYMENT\backend
       npx playwright test playwright-tests/test-simulations/ --reporter=list
       ```
  - **Acceptance Criteria**:
    - 0 critical findings in TestSprite re-run.
    - All high findings resolved or justified.
    - `lint && typecheck && test && build` pass in both `backend/` and `Frontend/`.
    - Playwright test-simulations all pass.
    - `.sisyphus/evidence/t14-fixes.md` lists all changes made.

- [ ] **T15. Finalize Verification Waves (MANDATORY)**
  - **All sub-checks executed by main agent. User confirmation required before marking complete.**

  - [ ] **F1. Plan Compliance Audit**
    - Read this master plan. Compare every task against implemented code and evidence files.
    - Write `.sisyphus/evidence/final-verification-f1-compliance-audit-v2.md`:
      ```markdown
      | Task | Status | Evidence File |
      |------|--------|---------------|
      | T8a payout router | DONE | backend/src/modules/payout/payout.router.ts |
      | T8b payout UI | DONE | Frontend/src/components/AuthDashboard.tsx |
      | T8c payout spec | DONE | reseller-payout.spec.ts rewritten |
      | T10 E2E | DONE | e2e-all-run.txt |
      | T11 TestSprite impl | DONE | mcp/adnanpay-testsprite/index.js |
      | T12 Report | DONE | testsprite-validation-report.md |
      | T13 Deploy | DONE | testsprite-deployment-report.md |
      | T14 Fixes | DONE | t14-fixes.md |
      ```

  - [ ] **F2. Code Quality Review**
    - Run:
      ```powershell
      # workdir: D:\coding\1.PPOB PAYMENT\backend
      npm run lint 2>&1 | Tee-Object -FilePath "..\\.sisyphus\\evidence\\f2-lint-backend.txt"
      npm run typecheck 2>&1 | Tee-Object -FilePath "..\\.sisyphus\\evidence\\f2-typecheck-backend.txt"
      npm test 2>&1 | Tee-Object -FilePath "..\\.sisyphus\\evidence\\f2-test-backend.txt"
      ```
      ```powershell
      # workdir: D:\coding\1.PPOB PAYMENT\Frontend
      npm run lint 2>&1 | Tee-Object -FilePath "..\\.sisyphus\\evidence\\f2-lint-frontend.txt"
      npm run typecheck 2>&1 | Tee-Object -FilePath "..\\.sisyphus\\evidence\\f2-typecheck-frontend.txt"
      ```
    - Write `.sisyphus/evidence/final-verification-f2-code-quality-v2.md` summarizing results.

  - [ ] **F3. Real Manual QA (+ Playwright)**
    - Run full Playwright suite:
      ```powershell
      # workdir: D:\coding\1.PPOB PAYMENT\backend
      npx playwright test playwright-tests/ --reporter=list 2>&1 | Tee-Object -FilePath "..\\.sisyphus\\evidence\\f3-playwright-full.txt"
      ```
    - Verify via curl:
      ```bash
      curl https://demo.hanzserver.online/health
      curl -I https://demo.hanzserver.online/
      curl -X POST https://demo.hanzserver.online/api/auth/register \
        -H "Content-Type: application/json" \
        -d '{"email":"qa-f3@example.test","password":"QAtest123!"}'
      curl https://demo.hanzserver.online/api/payout/balance \
        -H "Authorization: Bearer {reseller_token}"
      ```
    - Write `.sisyphus/evidence/final-verification-f3-manual-qa-v2.md` with pass/fail per check.

  - [ ] **F4. Scope Fidelity Check**
    - Read `README.md` and `ARCHITECTURE.md`. Compare against implemented features.
    - Verify: Guest checkout ✓, Reseller transaction ✓, Reseller payout ✓, Admin management ✓.
    - Confirm no Seller/Management Digiflazz API endpoints added (per README: "Only Buyer docs are authoritative").
    - Write `.sisyphus/evidence/final-verification-f4-scope-fidelity-v2.md`.

  - **T15 Overall Acceptance Criteria**:
    - F1: All tasks listed have corresponding evidence or code file.
    - F2: 0 lint errors, 0 type errors, all Jest tests pass. Build succeeds in both workspaces.
    - F3: All Playwright tests pass. All curl smoke checks return expected status codes (200/201/401/403 as appropriate).
    - F4: All in-scope features verified. No out-of-scope contamination.
    - All F1-F4 reports saved to `.sisyphus/evidence/`.
    - **User provides explicit "okay" or "done" before T15 is marked complete.**

---

## Execution Order (Critical Path)

```
T8a (payout router) 
  → T8b (payout UI) 
    → T8c (rewrite payout spec)
      → T10 (E2E all simulations)
        → T11 (implement TestSprite stubs + boot)
          → T12 (run TestSprite + generate report)
            → T13 (deploy/schedule)
              → T14 (fix all findings)
                → T15: F1 → F2 → F3 → F4
                  → USER CONFIRMS "okay"
                    → COMPLETE
```

## Key File Paths Reference

| File | Purpose |
|------|---------|
| `backend/src/modules/payout/payout.service.ts` | Payout business logic (complete, do not edit) |
| `backend/src/modules/payout/payout.types.ts` | Payout TypeScript types |
| `backend/src/modules/payout/payout.router.ts` | **TO CREATE** in T8a |
| `backend/src/app.ts` | Register payout router here in T8a |
| `backend/src/modules/commission/commission.router.ts` | Reference pattern for T8a |
| `Frontend/src/components/AuthDashboard.tsx` | Add payout UI section here in T8b |
| `Frontend/src/lib/api.ts` | API helper — use `buildApiUrl()` pattern |
| `Frontend/src/lib/auth.ts` | Auth token — use `getAuthToken()` pattern |
| `backend/playwright-tests/test-simulations/reseller-payout.spec.ts` | Rewrite in T8c |
| `backend/playwright-tests/helpers/api.ts` | `createTestUser`, `loginAsReseller`, `appendEvidence` |
| `backend/playwright.config.ts` | `baseURL: https://demo.hanzserver.online/` |
| `mcp/adnanpay-testsprite/index.js` | Local TestSprite MCP server |
| `mcp/mcp andanpay-testsprite.json` | Cloud TestSprite API key (optional) |
| `.sisyphus/evidence/` | All evidence output directory |
| `DEMO_CREDENTIALS.md` | Demo login credentials for test flows |

## Final Verification Gate (BLOCKING)

Before marking T15 COMPLETE:
1. Main agent reads all F1-F4 evidence files and confirms they exist and are non-empty.
2. Main agent presents summary table to user.
3. **Wait for explicit user "okay" or "selesai" or "done".**
4. Only after user confirmation: mark T15 complete.

**Do NOT auto-complete T15. User confirmation is mandatory.**

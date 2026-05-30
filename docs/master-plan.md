# Consolidated Master Plan - PPOB Payment System

## Status Summary
All core development waves (Waves 1-2, Security Hardening, Audit System, Database Migration, and Navigation/Checkout fixes) have been successfully built, tested, and deployed to production at https://demo.hanzserver.online.

The active work items remaining are:
1. Complete Playwright reseller payout test simulation (`reseller-payout.spec.ts`).
2. Run local E2E verification of all user simulation scenarios (Guest checkout, Reseller transaction, Reseller payout).
3. Set up, configure, and execute TestSprite MCP tests locally and prepare for production deployment using the credentials in `mcp/mcp andanpay-testsprite.json`.

---

## Active Checklist

### Wave 2: Reseller User Simulations
- [x] T7. Reseller transaction simulation
  - **Verification**: Created `backend/playwright-tests/test-simulations/reseller-transaction.spec.ts`. Simulates login as reseller -> accesses catalog -> places order -> verifies reseller discount applied and recorded in transactions. Verified locally.
- [ ] T8. Reseller payout simulation
  - **What to do**: Create `backend/playwright-tests/test-simulations/reseller-payout.spec.ts`. Simulate login as reseller -> navigate to reseller dashboard -> request payout -> fill bank details -> submit -> verify payout request is created with "pending" status and balance is reserved.
  - **Acceptance Criteria**: Test script created, successfully requests payout, bank details stored correctly, reseller balance decreased/reserved accordingly.

### Wave 3: Playwright E2E Validation
- [ ] T10. Verify all E2E simulations passed locally
  - **What to do**: Run all test simulations (`npx playwright test test-simulations/` in backend), capture results, save snapshots/evidence, and verify SQL database status.
  - **Acceptance Criteria**: All test suites (guest, reseller transaction, reseller payout) execute and pass, with screenshots saved to `.sisyphus/evidence/`.

### Wave 4: TestSprite MCP Setup, Execution, & Production Deployment
- [ ] T11. Configure TestSprite MCP Environment
  - **What to do**: Initialize TestSprite using the configuration from `mcp/mcp andanpay-testsprite.json`. Load `API_KEY` to authenticate. Define testing scopes (Frontend, Backend, Codebase/Code Diff), credentials, target environment (`https://demo.hanzserver.online`), and upload the PRD specifications.
  - **Acceptance Criteria**: TestSprite server booted, connection verified, and testing configuration files generated in `testsprite_tests/`.
- [ ] T12. Run TestSprite MCP Test Suites
  - **What to do**: Execute local automated testing sweeps using TestSprite's magic workflows. Monitor real-time cloud execution, screenshots, and logs on the portal. Generate human-readable markdown reports.
  - **Acceptance Criteria**: Automated test suites complete successfully. Human-readable validation report saved to `.sisyphus/evidence/testsprite-validation-report.md`.
- [ ] T13. Deploy TestSuite to Staging/Production & Setup Continuous Monitoring
  - **What to do**: Follow the TestSprite production deployment protocol: Log in to the Web Portal, select the verified test suites, configure the target production environment URL (`https://demo.hanzserver.online`), deploy them, and set up a continuous cron/schedule monitoring flow with real-time alerting.
  - **Acceptance Criteria**: Verified tests successfully deployed to the cloud portal running against production URL with scheduled execution active.

### Wave 5: Fixes and Final Audits
- [ ] T14. Fix codebase based on TestSprite & Playwright findings
  - **What to do**: Automatically or manually resolve any bugs/crashes flagged during testing.
- [ ] T15. Finalize Verification Waves (MANDATORY)
  - **Acceptance Criteria**: Formally execute F1-F4 checklists:
    - [ ] F1. Plan Compliance Audit — oracle
    - [ ] F2. Code Quality Review — unspecified-high
    - [ ] F3. Real Manual QA — unspecified-high (+ playwright if UI)
    - [ ] F4. Scope Fidelity Check — deep
  - Save all final summary and fix reports in `.sisyphus/evidence/`.

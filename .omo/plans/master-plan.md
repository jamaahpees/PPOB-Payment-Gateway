# Consolidated Master Plan - PPOB Payment System (Audited 2026-05-30)

## Execution Model
**ALL tasks executed by main agent directly. No subagent delegation.**

## Status Summary
We are deploying the PPOB fullstack application code directly to the VPS at `10.244.74.23` / `demo.hanzserver.online` over SSH, migrating storage-heavy folders to the `/dev/sda1` mount to save internal disk space, switching the repository source to `https://github.com/jamaahpees/PPOB-Payment-Gateway.git`, pulling the latest changes (payout and dashboard features), rebuilding backend/frontend, and restarting Passenger/App processes.

## TODOs
1. Establish SSH connection to `10.244.74.23` (user: root, pass: 1@241223) using Python and paramiko, check free space and find mount path for `/dev/sda1`.
2. Locate the main web directories on the server (e.g., node_modules, logs, cache, or mock data).
3. Move storage-heavy directories to the `/dev/sda1` mount point, and symlink them back to their original locations.
4. Update the Git remote in the deployment folder to point to `https://github.com/jamaahpees/PPOB-Payment-Gateway.git`.
5. Pull the latest code on the `PPOB-Adnanpay` branch.
6. Install backend/frontend node dependencies and compile/build the codebase.
7. Restart the cPanel/Passenger node application or background daemon process.
8. Verify server health, invoice tracking, and dashboard reseller payout access directly via curl/Playwright.

---

## Final Verification Wave (MANDATORY GATES)
- [ ] F1. Plan Compliance Audit
- [ ] F2. Code Quality Review
- [ ] F3. Real Manual QA
- [ ] F4. Scope Fidelity Check

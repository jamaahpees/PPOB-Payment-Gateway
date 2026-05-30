# Consolidated VPS Deployment & Storage Optimization Plan

## Execution Model
**ALL tasks executed by main agent directly. No subagent delegation.**

## Status Summary
We are deploying the updated PPOB code (including the payout method) directly to the target VPS (`10.244.74.23` / `demo.hanzserver.online`) and moving storage-intensive directories/files to the `/dev/sda1` external storage volume.

## TODOs
1. Establish SSH connection to `10.244.74.23` with user `root` and password `1@241223`.
2. Inspect server partition table, identify `/dev/sda1` mount point, and locate heavy directories (like log files, node_modules, mock files, or cache).
3. Move storage-intensive directories to `/dev/sda1` and create symlinks back to their original locations.
4. Configure Git remote in the deployment folder to use the new `jamaahpees` repository (`https://github.com/jamaahpees/PPOB-Payment-Gateway.git`).
5. Pull latest code from the `PPOB-Adnanpay` branch.
6. Install dependencies and rebuild backend and frontend on the VPS.
7. Restart the backend daemon (or Passenger passenger-app/cPanel node server).
8. Verify health status and the presence of the payout feature.

---

## Final Verification Wave (MANDATORY GATES)
- [ ] F1. Plan Compliance Audit
- [ ] F2. Code Quality Review
- [ ] F3. Real Manual QA
- [ ] F4. Scope Fidelity Check

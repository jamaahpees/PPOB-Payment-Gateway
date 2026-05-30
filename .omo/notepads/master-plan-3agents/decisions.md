# Decisions
The payout service is already fully defined and implemented in backend/src/modules/payout/payout.service.ts and payout.types.ts.
Agent A is responsible for wiring the payout backend router (backend/src/modules/payout/payout.router.ts) and registering it in backend/src/app.ts.

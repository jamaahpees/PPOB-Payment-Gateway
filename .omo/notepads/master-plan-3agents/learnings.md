# Learnings
Routes needed:
- GET /balance -> returns { payable_balance_minor: number }
- POST /request -> body: { amount_minor, bank_name, account_number, account_holder, legal_name, nik, address, phone? } -> calls payoutService.requestPayout(input) -> returns 201 created.
- GET /requests -> returns the array of requests.
All routes must be protected by authenticate.
POST /request must be protected by requireRoles(['seller']).
Router is registered in backend/src/app.ts under /api/payout.

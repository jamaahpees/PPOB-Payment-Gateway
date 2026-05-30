import { type Request, type Response, Router } from "express";
import { type PayoutService } from "./payout.service";
import { type AuthenticatedRequest, requireRoles } from "../auth/auth.middleware";

export function createPayoutRouter(options: {
  payoutService: PayoutService;
}): Router {
  const router = Router();

  // GET /balance -> returns { payable_balance_minor: number }
  router.get("/balance", async (req: Request, res: Response, next) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.authUser!.id;
      const balance = await options.payoutService.getUserPayableBalance(userId);
      res.json({ payable_balance_minor: balance });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // POST /request -> body: { amount_minor, bank_name, account_number, account_holder, legal_name, nik, address, phone? } -> returns 201
  router.post("/request", requireRoles(["seller"]), async (req: Request, res: Response, next) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.authUser!.id;
      const email = authReq.authUser!.email || undefined;
      
      const {
        amount_minor,
        bank_name,
        account_number,
        account_holder,
        legal_name,
        nik,
        address,
        phone
      } = req.body;

      if (!amount_minor || !bank_name || !account_number || !account_holder || !legal_name || !nik || !address) {
        return res.status(400).json({ success: false, message: "Missing required fields" });
      }

      const payout = await options.payoutService.requestPayout({
        userId,
        amountMinor: Number(amount_minor),
        identityData: {
          legalName: legal_name,
          nik,
          address,
          bankName: bank_name,
          accountNumber: account_number,
          accountHolder: account_holder,
          phone: phone || undefined,
          email
        }
      });

      res.status(201).json({ success: true, payout });
    } catch (err: any) {
      if (err.message === "Insufficient payable balance") {
        res.status(400).json({ success: false, message: err.message });
      } else {
        res.status(500).json({ success: false, message: err.message });
      }
    }
  });

  // GET /requests -> returns array of user's payout requests
  router.get("/requests", async (req: Request, res: Response, next) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.authUser!.id;
      const requests = await options.payoutService.getUserPayoutRequests(userId);
      res.json(requests);
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  return router;
}

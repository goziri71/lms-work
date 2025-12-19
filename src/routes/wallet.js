import { Router } from "express";
import {
  getWalletBalance,
  fundWallet,
  getFundingHistory,
  getExchangeRate,
} from "../controllers/student/wallet.js";
import { authorize } from "../middlewares/authorize.js";

const router = Router();

// Wallet endpoints (student)
router.get("/balance", authorize, getWalletBalance);
router.post("/fund", authorize, fundWallet);
router.get("/transactions", authorize, getFundingHistory);
router.get("/rate", authorize, getExchangeRate);

export default router;


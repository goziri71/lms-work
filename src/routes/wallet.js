import { Router } from "express";
import {
  getWalletBalance,
  fundWallet,
  getFundingHistory,
} from "../controllers/student/wallet.js";
import { authorize } from "../middlewares/authorize.js";

const router = Router();

// Wallet endpoints (student)
router.get("/balance", authorize, getWalletBalance);
router.post("/fund", authorize, fundWallet);
router.get("/transactions", authorize, getFundingHistory);

export default router;


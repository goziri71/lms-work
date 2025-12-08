import { Router } from "express";
import {
  getWalletBalance,
  fundWallet,
} from "../controllers/student/wallet.js";
import { authorize } from "../middlewares/authorize.js";

const router = Router();

// Wallet endpoints (student)
router.get("/balance", authorize, getWalletBalance);
router.post("/fund", authorize, fundWallet);

export default router;


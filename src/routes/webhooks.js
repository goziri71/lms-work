import { Router } from "express";
import { flutterwaveWebhook } from "../controllers/payment/flutterwaveWebhook.js";

const router = Router();

// Flutterwave webhook (no auth required - uses signature verification)
router.post("/flutterwave", flutterwaveWebhook);

export default router;


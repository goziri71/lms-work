import { Router } from "express";
import {
  flutterwaveWebhook,
  flutterwaveWebhookSetup,
} from "../controllers/payment/flutterwaveWebhook.js";

const router = Router();

// Deployment helper: full webhook URL + config status (no secrets)
router.get("/flutterwave/setup", flutterwaveWebhookSetup);

// Flutterwave webhook (no auth required - uses signature verification)
router.post("/flutterwave", flutterwaveWebhook);

export default router;


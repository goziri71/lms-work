import { Op, Transaction } from "sequelize";
import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { PaymentTransaction } from "../../models/payment/paymentTransaction.js";
import { Funding } from "../../models/payment/funding.js";
import { Students } from "../../models/auth/student.js";
import { Semester } from "../../models/auth/semester.js";
import { db } from "../../database/database.js";
import {
  assertFlutterwaveWebhookAllowed,
  isTransactionSuccessful,
  getTransactionAmount,
  getTransactionCurrency,
  getTransactionReference,
  parseFlutterwaveMeta,
  verifyTransaction,
} from "../../services/flutterwaveService.js";
import {
  getWalletBalance,
  calculateLedgerBalance,
  fundStudentWalletFromFlutterwave,
} from "../../services/walletBalanceService.js";

/**
 * Flutterwave webhook endpoint
 * POST /api/webhooks/flutterwave
 *
 * This endpoint receives payment status updates from Flutterwave
 * It's more reliable than frontend callbacks
 */
export const flutterwaveWebhook = TryCatchFunction(async (req, res) => {
  const webhookCheck = assertFlutterwaveWebhookAllowed(req);
  if (!webhookCheck.ok) {
    return res.status(webhookCheck.status).json({ message: webhookCheck.message });
  }

  const event = req.body;

  if (
    event.event === "charge.completed" ||
    event.event === "transfer.completed"
  ) {
    const transactionData = event.data;

    const txRef = getTransactionReference(transactionData);
    if (!txRef) {
      console.error("No transaction reference in webhook");
      return res.status(400).json({ message: "No transaction reference" });
    }

    // Outbound transfers (e.g. tutor payouts with refs like PAYOUT-...) are not PaymentTransaction rows.
    // Student wallet top-ups use charge.completed; only those should resolve payment_transaction records.
    if (event.event === "transfer.completed") {
      console.log(
        `Flutterwave transfer.completed acknowledged (disbursement / payout, not student charge): ${txRef}`
      );
      return res.status(200).json({ message: "Webhook received" });
    }

    const paymentTransaction = await PaymentTransaction.findOne({
      where: {
        [Op.or]: [
          { transaction_reference: txRef },
          { flutterwave_transaction_id: transactionData.id?.toString() },
        ],
      },
    });

    if (!paymentTransaction) {
      // Client never called /api/wallet/fund — recover if charge carries meta.student_id from Flutterwave
      if (
        event.event === "charge.completed" &&
        isTransactionSuccessful(transactionData)
      ) {
        const meta = parseFlutterwaveMeta(transactionData);
        const rawSid = meta.student_id ?? meta.studentId;
        if (rawSid != null && String(rawSid).trim() !== "") {
          const sid = Number.parseInt(String(rawSid), 10);
          if (!Number.isNaN(sid) && sid > 0) {
            try {
              const vr = await verifyTransaction(String(txRef), {
                maxRetries: 3,
                retryDelayMs: 2000,
              });
              if (
                vr.success &&
                vr.transaction &&
                isTransactionSuccessful(vr.transaction)
              ) {
                const ft = vr.transaction;
                const student = await Students.findByPk(sid);
                if (student) {
                  const today = new Date().toISOString().split("T")[0];
                  let currentSemester = await Semester.findOne({
                    where: {
                      [Op.and]: [
                        Semester.sequelize.literal(
                          `DATE(start_date) <= '${today}'`
                        ),
                        Semester.sequelize.literal(
                          `DATE(end_date) >= '${today}'`
                        ),
                      ],
                    },
                    order: [["id", "DESC"]],
                  });
                  if (!currentSemester) {
                    currentSemester = await Semester.findOne({
                      where: Semester.sequelize.where(
                        Semester.sequelize.fn(
                          "UPPER",
                          Semester.sequelize.col("status")
                        ),
                        "ACTIVE"
                      ),
                      order: [["id", "DESC"]],
                    });
                  }
                  const academicYear =
                    currentSemester?.academic_year?.toString() || null;

                  await getWalletBalance(sid, true);
                  await fundStudentWalletFromFlutterwave({
                    studentId: sid,
                    txRef: getTransactionReference(ft) || txRef,
                    flutterwaveTransactionId: ft.id?.toString(),
                    amount: getTransactionAmount(ft),
                    currency: getTransactionCurrency(ft),
                    flutterwaveResponse: ft,
                    academicYear,
                    semester: currentSemester?.semester || null,
                    today,
                  });
                  console.log(
                    `✅ Webhook orphan recovery: wallet funding for student ${sid} (${txRef})`
                  );
                  return res.status(200).json({ message: "Webhook received" });
                }
              }
            } catch (e) {
              console.error("Webhook orphan wallet recovery failed:", e);
            }
          }
        }
      }
      console.warn(`Payment transaction not found for reference: ${txRef}`);
      return res.status(200).json({
        message: "Transaction not found (may be for different service)",
      });
    }

    if (paymentTransaction.status === "successful") {
      console.log(`Payment ${txRef} already processed`);
      return res.status(200).json({ message: "Already processed" });
    }

    if (!isTransactionSuccessful(transactionData)) {
      await paymentTransaction.update({
        status: "failed",
        error_message: transactionData.processor_response || "Payment failed",
        flutterwave_response: transactionData,
        last_verification_at: new Date(),
      });

      return res.status(200).json({ message: "Payment failed" });
    }

    const transactionAmount = getTransactionAmount(transactionData);
    if (
      Math.abs(transactionAmount - parseFloat(paymentTransaction.amount)) > 0.01
    ) {
      await paymentTransaction.update({
        status: "failed",
        error_message: "Payment amount mismatch",
        flutterwave_response: transactionData,
        last_verification_at: new Date(),
      });

      return res.status(200).json({ message: "Amount mismatch" });
    }

    if (paymentTransaction.payment_type === "wallet_funding") {
      const studentId = paymentTransaction.student_id;
      const today = new Date().toISOString().split("T")[0];

      const studentRow = await Students.findByPk(studentId);
      if (!studentRow) {
        console.error(`Student not found: ${studentId}`);
        await paymentTransaction.update({
          status: "failed",
          error_message: "Student not found",
          flutterwave_response: transactionData,
          last_verification_at: new Date(),
        });
        return res.status(200).json({ message: "Student not found" });
      }

      let currentSemester = await Semester.findOne({
        where: {
          [Op.and]: [
            Semester.sequelize.literal(`DATE(start_date) <= '${today}'`),
            Semester.sequelize.literal(`DATE(end_date) >= '${today}'`),
          ],
        },
        order: [["id", "DESC"]],
      });

      if (!currentSemester) {
        currentSemester = await Semester.findOne({
          where: Semester.sequelize.where(
            Semester.sequelize.fn("UPPER", Semester.sequelize.col("status")),
            "ACTIVE"
          ),
          order: [["id", "DESC"]],
        });
      }

      const academicYear = currentSemester?.academic_year?.toString() || null;

      await getWalletBalance(studentId, true);

      await db.transaction(async (transaction) => {
        const pt = await PaymentTransaction.findByPk(paymentTransaction.id, {
          transaction,
          lock: Transaction.LOCK.UPDATE,
        });
        if (!pt || pt.status === "successful") {
          return;
        }

        const student = await Students.findByPk(studentId, {
          transaction,
          lock: Transaction.LOCK.UPDATE,
        });
        if (!student) {
          await pt.update(
            {
              status: "failed",
              error_message: "Student not found",
              flutterwave_response: transactionData,
              last_verification_at: new Date(),
            },
            { transaction }
          );
          return;
        }

        const ledgerBalance = await calculateLedgerBalance(
          studentId,
          student.currency,
          transaction
        );
        const newBalance = ledgerBalance + parseFloat(pt.amount);

        await Funding.create(
          {
            student_id: studentId,
            amount: pt.amount,
            type: "Credit",
            service_name: "Wallet Funding",
            ref: pt.transaction_reference,
            date: today,
            semester: currentSemester?.semester || null,
            academic_year: academicYear,
            currency: pt.currency,
            balance: newBalance.toString(),
          },
          { transaction }
        );

        await student.update({ wallet_balance: newBalance }, { transaction });

        await pt.update(
          {
            status: "successful",
            flutterwave_transaction_id: transactionData.id?.toString(),
            processed_at: new Date(),
            flutterwave_response: transactionData,
          },
          { transaction }
        );

        console.log(
          `✅ Wallet funded: Student ${studentId} - ${pt.amount} ${pt.currency} (New balance: ${newBalance})`
        );
      });
    }
  }

  res.status(200).json({ message: "Webhook received" });
});

/**
 * GET /api/webhooks/flutterwave/setup
 * Returns the webhook URL to paste in Flutterwave Dashboard and whether this server has a secret configured.
 * Does not expose any secret values.
 */
export const flutterwaveWebhookSetup = TryCatchFunction(async (req, res) => {
  const publicBase =
    process.env.PUBLIC_API_URL?.replace(/\/$/, "") ||
    `${req.protocol}://${req.get("host") || "localhost"}`;
  const webhookUrl = `${publicBase}/api/webhooks/flutterwave`;
  const hasSecretHash = Boolean(
    process.env.FLUTTERWAVE_SECRET_HASH?.trim() ||
      process.env.FLW_SECRET_HASH?.trim()
  );
  const hasSecretKey = Boolean(process.env.FLUTTERWAVE_SECRET_KEY?.trim());

  res.status(200).json({
    webhook_url: webhookUrl,
    http_method: "POST",
    dashboard:
      "Flutterwave Dashboard → Settings → Developers → Webhooks (wording may vary by region)",
    server_env_for_secret_hash: "FLUTTERWAVE_SECRET_HASH or FLW_SECRET_HASH",
    secret_hash_configured_on_server: hasSecretHash,
    flutterwave_secret_key_configured: hasSecretKey,
    set_public_api_url:
      "Optional: set PUBLIC_API_URL in .env (e.g. https://api.yourdomain.com) so webhook_url is correct behind proxies.",
    how_to_configure_hash:
      "In Flutterwave, set a Secret Hash for webhooks. Put the exact same string in FLUTTERWAVE_SECRET_HASH on this server and restart. The mobile app never needs this value.",
    why_webhooks_are_not_sent_to_the_flutter_app:
      "Flutterwave only calls HTTPS URLs on your backend. A phone app has no stable public URL, so payments complete via redirect/deeplink and your app calls POST /api/wallet/fund (or similar) with the transaction reference.",
    wallet_funding_meta:
      "Pass meta.student_id (logged-in student id) when creating the Flutterwave payment so charge.completed webhooks can still credit the wallet if the app never calls POST /api/wallet/fund.",
  });
});

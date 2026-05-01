/**
 * One-off: inspect student wallet vs Funding ledger (read-only).
 * Usage: node scripts/diagnose-student-wallet.js <email>
 */
import dotenv from "dotenv";
dotenv.config();

import { db } from "../src/database/database.js";
import { Students } from "../src/models/auth/student.js";
import { Funding } from "../src/models/payment/funding.js";
import { PaymentTransaction } from "../src/models/payment/paymentTransaction.js";
import { Op, fn, col } from "sequelize";
import { calculateLedgerBalance } from "../src/services/walletBalanceService.js";

const email = process.argv[2];
if (!email) {
  console.error("Usage: node scripts/diagnose-student-wallet.js <email>");
  process.exit(1);
}

async function main() {
  await db.authenticate();

  const student = await Students.findOne({
    where: { email: email.toLowerCase().trim() },
    attributes: [
      "id",
      "fname",
      "lname",
      "email",
      "wallet",
      "wallet_balance",
      "currency",
    ],
  });

  if (!student) {
    console.log(JSON.stringify({ error: "Student not found", email }, null, 2));
    await db.close();
    process.exit(2);
  }

  const sid = student.id;
  const cur = (student.currency || "NGN").toString().toUpperCase();

  const ledger = await calculateLedgerBalance(sid, student.currency);
  const stored = parseFloat(student.wallet_balance) || 0;

  const creditsAgg = await Funding.findAll({
    where: {
      student_id: sid,
      type: "Credit",
      [Op.or]: [{ currency: cur }, { currency: null }, { currency: "" }],
    },
    attributes: [
      [fn("COUNT", col("id")), "cnt"],
      [fn("COALESCE", fn("SUM", col("amount")), 0), "sum"],
    ],
    raw: true,
  });

  const debitsAgg = await Funding.findAll({
    where: {
      student_id: sid,
      type: "Debit",
      [Op.or]: [{ currency: cur }, { currency: null }, { currency: "" }],
    },
    attributes: [
      [fn("COUNT", col("id")), "cnt"],
      [fn("COALESCE", fn("SUM", col("amount")), 0), "sum"],
    ],
    raw: true,
  });

  const topCredits = await Funding.findAll({
    where: {
      student_id: sid,
      type: "Credit",
      [Op.or]: [{ currency: cur }, { currency: null }, { currency: "" }],
    },
    order: [["amount", "DESC"]],
    limit: 15,
    raw: true,
  });

  const migrationRows = await Funding.findAll({
    where: {
      student_id: sid,
      service_name: "Wallet Balance Migration",
    },
    order: [["id", "DESC"]],
    limit: 20,
    raw: true,
  });

  const fwCount = await PaymentTransaction.count({
    where: { student_id: sid, status: "successful" },
  });

  const out = {
    student: {
      id: student.id,
      name: `${student.fname || ""} ${student.lname || ""}`.trim(),
      email: student.email,
      legacy_wallet_int: student.wallet,
      wallet_balance_column: stored,
      currency: cur,
    },
    ledger_from_funding_credits_minus_debits: Number(ledger),
    discrepancy_column_minus_ledger: Number((stored - ledger).toFixed(2)),
    aggregates: {
      credit_rows: creditsAgg[0],
      debit_rows: debitsAgg[0],
    },
    largest_credit_rows_sample: topCredits.map((r) => ({
      id: r.id,
      amount: r.amount != null ? Number(r.amount) : null,
      service_name: r.service_name,
      ref: r.ref,
      date: r.date,
      currency: r.currency,
    })),
    wallet_balance_migration_rows: migrationRows.map((r) => ({
      id: r.id,
      amount: r.amount != null ? Number(r.amount) : null,
      ref: r.ref,
      date: r.date,
    })),
    successful_payment_transactions_count: fwCount,
  };

  console.log(JSON.stringify(out, null, 2));
  await db.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Reverse specific Funding *Credit* rows by inserting matching *Debit* rows and updating wallet_balance.
 *
 * Usage:
 *   node scripts/reverse-wallet-test-credits.js <email> <funding_id_1,funding_id_2,...>
 *   node scripts/reverse-wallet-test-credits.js akadanzara@gmail.com 1,9,21,30,42
 *
 * Dry-run (no DB writes):
 *   DRY_RUN=1 node scripts/reverse-wallet-test-credits.js ...
 */
import dotenv from "dotenv";
dotenv.config();

import { db } from "../src/database/database.js";
import { Students } from "../src/models/auth/student.js";
import { Funding } from "../src/models/payment/funding.js";
import { Transaction } from "sequelize";
import { calculateLedgerBalance } from "../src/services/walletBalanceService.js";

const emailArg = process.argv[2];
const idsArg = process.argv[3];
const dryRun = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";

if (!emailArg || !idsArg) {
  console.error(
    "Usage: node scripts/reverse-wallet-test-credits.js <email> <comma-separated-funding-credit-ids>"
  );
  process.exit(1);
}

const fundingIds = idsArg
  .split(",")
  .map((s) => parseInt(s.trim(), 10))
  .filter((n) => Number.isInteger(n) && n > 0);

if (fundingIds.length === 0) {
  console.error("No valid funding IDs");
  process.exit(1);
}

async function main() {
  await db.authenticate();

  const student = await Students.findOne({
    where: { email: emailArg.toLowerCase().trim() },
    attributes: ["id", "email", "currency", "wallet_balance"],
  });

  if (!student) {
    console.error("Student not found:", emailArg);
    await db.close();
    process.exit(2);
  }

  const studentId = student.id;
  const currency = (student.currency || "NGN").toString().toUpperCase();
  const today = new Date().toISOString().split("T")[0];

  const credits = await Funding.findAll({
    where: {
      id: fundingIds,
      student_id: studentId,
      type: "Credit",
    },
  });

  if (credits.length !== fundingIds.length) {
    const foundIds = new Set(credits.map((r) => r.id));
    const missing = fundingIds.filter((id) => !foundIds.has(id));
    throw new Error(
      `Some IDs are missing or not Credit rows for this student: ${missing.join(", ")}`
    );
  }

  let totalDebit = 0;
  const plan = credits.map((c) => {
    const amt = parseFloat(c.amount) || 0;
    totalDebit += amt;
    return {
      funding_id: c.id,
      amount: amt,
      original_service: c.service_name,
      original_ref: c.ref,
    };
  });

  const ledgerBefore = await calculateLedgerBalance(studentId, student.currency);

  console.log(
    JSON.stringify(
      {
        dryRun,
        student: { id: studentId, email: student.email, currency },
        wallet_balance_column_before: parseFloat(student.wallet_balance) || 0,
        ledger_before: ledgerBefore,
        debits_to_insert: plan,
        total_debit_amount: totalDebit,
        ledger_after_expected: ledgerBefore - totalDebit,
      },
      null,
      2
    )
  );

  if (dryRun) {
    console.log("DRY_RUN: no changes made.");
    await db.close();
    return;
  }

  await db.transaction(async (t) => {
    await Students.findByPk(studentId, {
      transaction: t,
      lock: Transaction.LOCK.UPDATE,
    });

    for (const row of credits) {
      const amt = parseFloat(row.amount) || 0;
      const ref = `REVERSAL-TEST-CREDIT-${row.id}-${Date.now()}`;
      await Funding.create(
        {
          student_id: studentId,
          amount: amt,
          type: "Debit",
          service_name: `Reversal: test credit removed (original funding id ${row.id})`,
          ref,
          date: today,
          semester: null,
          academic_year: null,
          currency,
          balance: null,
        },
        { transaction: t }
      );
    }

    const newLedger = await calculateLedgerBalance(studentId, student.currency, t);
    await Students.update(
      { wallet_balance: newLedger },
      { where: { id: studentId }, transaction: t }
    );
  });

  const studentAfter = await Students.findByPk(studentId, {
    attributes: ["wallet_balance"],
  });
  const ledgerAfter = await calculateLedgerBalance(studentId, student.currency);

  console.log(
    JSON.stringify(
      {
        done: true,
        wallet_balance_after: parseFloat(studentAfter.wallet_balance) || 0,
        ledger_after: ledgerAfter,
      },
      null,
      2
    )
  );

  await db.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

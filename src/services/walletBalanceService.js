import { Funding } from "../models/payment/funding.js";
import { Students } from "../models/auth/student.js";
import { Semester } from "../models/auth/semester.js";
import { PaymentTransaction } from "../models/payment/paymentTransaction.js";
import { db } from "../database/database.js";
import { ErrorClass } from "../utils/errorClass/index.js";
import { Op, Transaction } from "sequelize";

/**
 * Funding rows for a student's wallet are summed in the student's wallet currency.
 * Legacy rows may have null/empty currency and are treated as matching the wallet.
 */
export function fundingCurrencyWhere(studentCurrency) {
  const c = (studentCurrency || "NGN").toString().toUpperCase();
  return {
    [Op.or]: [{ currency: c }, { currency: null }, { currency: "" }],
  };
}

/**
 * Ledger balance from Funding only (no migration), optionally within a transaction.
 */
export async function calculateLedgerBalance(
  studentId,
  studentCurrency,
  transaction = null
) {
  const cur = fundingCurrencyWhere(studentCurrency);
  const totalCredits = await Funding.sum("amount", {
    where: { student_id: studentId, type: "Credit", ...cur },
    transaction,
  });
  const totalDebits = await Funding.sum("amount", {
    where: { student_id: studentId, type: "Debit", ...cur },
    transaction,
  });
  return (totalCredits || 0) - (totalDebits || 0);
}

/**
 * Get wallet balance for a student
 * This function handles migration of old wallet balances from students.wallet_balance
 * to the Funding table if there's a discrepancy
 *
 * @param {number} studentId - Student ID
 * @param {boolean} autoMigrate - If true, automatically migrate old balance if discrepancy found
 * @returns {Promise<{balance: number, migrated: boolean, migrationAmount?: number}>}
 */
export async function getWalletBalance(studentId, autoMigrate = true) {
  const student = await Students.findByPk(studentId, {
    attributes: ["id", "wallet_balance", "currency"],
  });

  if (!student) {
    throw new Error("Student not found");
  }

  const calculatedBalance = await calculateLedgerBalance(
    studentId,
    student.currency
  );

  const oldBalance = parseFloat(student.wallet_balance) || 0;
  const discrepancy = oldBalance - calculatedBalance;

  if (discrepancy > 0.01 && autoMigrate) {
    const currentDate = new Date();
    const today = currentDate.toISOString().split("T")[0];

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

    await Funding.create({
      student_id: studentId,
      amount: discrepancy,
      type: "Credit",
      service_name: "Wallet Balance Migration",
      ref: `MIGRATION-${studentId}-${Date.now()}`,
      date: today,
      semester: currentSemester?.semester || null,
      academic_year: currentSemester?.academic_year?.toString() || null,
      currency: student.currency || "NGN",
      balance: oldBalance.toString(),
    });

    await student.update({
      wallet_balance: oldBalance,
    });

    console.log(
      `✅ Migrated wallet balance for student ${studentId}: ${discrepancy} ${student.currency || "NGN"} (Old: ${oldBalance}, Calculated: ${calculatedBalance})`
    );

    return {
      balance: oldBalance,
      migrated: true,
      migrationAmount: discrepancy,
    };
  }

  if (Math.abs(oldBalance - calculatedBalance) > 0.01) {
    await student.update({
      wallet_balance: calculatedBalance,
    });
  }

  return {
    balance: calculatedBalance,
    migrated: false,
  };
}

/**
 * Calculate wallet balance from Funding table only (no migration)
 *
 * @param {number} studentId
 * @param {string} [studentCurrency]
 * @param {import("sequelize").Transaction} [transaction]
 */
export async function calculateWalletBalanceFromFunding(
  studentId,
  studentCurrency = "NGN",
  transaction
) {
  return calculateLedgerBalance(studentId, studentCurrency, transaction);
}

/**
 * Atomically credit wallet after Flutterwave verification (API callback).
 */
export async function fundStudentWalletFromFlutterwave({
  studentId,
  txRef,
  flutterwaveTransactionId,
  amount,
  currency,
  flutterwaveResponse,
  academicYear,
  semester,
  today,
}) {
  await getWalletBalance(studentId, true);

  try {
    return await db.transaction(async (transaction) => {
      const student = await Students.findByPk(studentId, {
        transaction,
        lock: Transaction.LOCK.UPDATE,
        attributes: ["id", "wallet_balance", "currency"],
      });

      if (!student) {
        throw new ErrorClass("Student not found", 404);
      }

      const existing = await PaymentTransaction.findOne({
        where: {
          student_id: studentId,
          status: "successful",
          [Op.or]: [
            { transaction_reference: txRef },
            ...(flutterwaveTransactionId
              ? [{ flutterwave_transaction_id: flutterwaveTransactionId.toString() }]
              : []),
          ],
        },
        transaction,
      });

      const ledgerBalance = await calculateLedgerBalance(
        studentId,
        student.currency,
        transaction
      );

      if (existing) {
        return {
          duplicate: true,
          balance: ledgerBalance,
          txRef,
          amount,
          currency,
        };
      }

      const newBalance = ledgerBalance + amount;

      await PaymentTransaction.create(
        {
          student_id: studentId,
          transaction_reference: txRef,
          flutterwave_transaction_id: flutterwaveTransactionId?.toString() || null,
          amount,
          currency,
          status: "successful",
          payment_type: "wallet_funding",
          academic_year: academicYear,
          processed_at: new Date(),
          flutterwave_response: flutterwaveResponse,
        },
        { transaction }
      );

      await Funding.create(
        {
          student_id: studentId,
          amount,
          type: "Credit",
          service_name: "Wallet Funding",
          ref: txRef,
          date: today,
          semester: semester || null,
          academic_year: academicYear,
          currency,
          balance: newBalance.toString(),
        },
        { transaction }
      );

      await student.update(
        { wallet_balance: newBalance },
        { transaction }
      );

      return {
        duplicate: false,
        previousBalance: ledgerBalance,
        newBalance,
        balance: newBalance,
        txRef,
        amount,
        currency,
      };
    });
  } catch (err) {
    if (err?.name === "SequelizeUniqueConstraintError") {
      const { balance } = await getWalletBalance(studentId, true);
      return {
        duplicate: true,
        balance,
        txRef,
        amount,
        currency,
      };
    }
    throw err;
  }
}

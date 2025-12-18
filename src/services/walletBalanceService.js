import { Funding } from "../models/payment/funding.js";
import { Students } from "../models/auth/student.js";
import { Semester } from "../models/auth/semester.js";
import { Op } from "sequelize";

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
  // Get student
  const student = await Students.findByPk(studentId, {
    attributes: ["id", "wallet_balance", "currency"],
  });

  if (!student) {
    throw new Error("Student not found");
  }

  // Calculate balance from Funding table
  const totalCredits = await Funding.sum("amount", {
    where: { student_id: studentId, type: "Credit" },
  });
  const totalDebits = await Funding.sum("amount", {
    where: { student_id: studentId, type: "Debit" },
  });
  const calculatedBalance = (totalCredits || 0) - (totalDebits || 0);

  // Get old balance from student table
  const oldBalance = parseFloat(student.wallet_balance) || 0;

  // Check if there's a discrepancy
  const discrepancy = oldBalance - calculatedBalance;

  // If there's a positive discrepancy (old balance > calculated), migrate it
  if (discrepancy > 0.01 && autoMigrate) {
    // Get current semester for migration record
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

    // Create migration Funding record for the old balance
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

    // Update student wallet_balance to match (should already be correct, but ensure consistency)
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

  // If no migration needed, return calculated balance
  // But also update student.wallet_balance if it's different (to keep in sync)
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
 * Use this when you want the raw calculated balance
 * 
 * @param {number} studentId - Student ID
 * @returns {Promise<number>}
 */
export async function calculateWalletBalanceFromFunding(studentId) {
  const totalCredits = await Funding.sum("amount", {
    where: { student_id: studentId, type: "Credit" },
  });
  const totalDebits = await Funding.sum("amount", {
    where: { student_id: studentId, type: "Debit" },
  });
  return (totalCredits || 0) - (totalDebits || 0);
}


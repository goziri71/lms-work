/**
 * Audit and Fix Wallet Balances Script
 * 
 * This script:
 * 1. Audits wallet balances by recalculating from transaction history
 * 2. Identifies discrepancies
 * 3. Optionally fixes balances (with --fix flag)
 * 
 * Usage:
 *   node scripts/audit-fix-wallet-balances.js [--tutor-id=ID] [--tutor-type=TYPE] [--fix]
 */

import { db } from "../src/database/database.js";
import { Op, Sequelize } from "sequelize";
import { TutorWalletTransaction } from "../src/models/marketplace/tutorWalletTransaction.js";
import { SoleTutor } from "../src/models/marketplace/soleTutor.js";
import { Organization } from "../src/models/marketplace/organization.js";
import { TutorPayout } from "../src/models/marketplace/tutorPayout.js";

async function auditWalletBalance(tutorId, tutorType, fix = false) {
  try {
    console.log(`\n🔍 Auditing wallet for tutor ${tutorId} (${tutorType})...`);

    // Get current balance from tutor record
    let tutor;
    if (tutorType === "sole_tutor") {
      tutor = await SoleTutor.findByPk(tutorId);
    } else {
      tutor = await Organization.findByPk(tutorId);
    }

    if (!tutor) {
      console.error(`❌ Tutor ${tutorId} (${tutorType}) not found`);
      return;
    }

    const currentBalance = parseFloat(tutor.wallet_balance || 0);
    console.log(`📊 Current balance in database: ${currentBalance.toLocaleString()}`);

    // Get all wallet transactions
    const transactions = await TutorWalletTransaction.findAll({
      where: {
        tutor_id: tutorId,
        tutor_type: tutorType,
      },
      order: [["created_at", "ASC"]],
    });

    console.log(`📝 Found ${transactions.length} wallet transactions`);

    // Recalculate balance from transactions
    // IMPORTANT: Only count "successful" transactions to avoid counting failed/pending ones
    let calculatedBalance = 0;
    const transactionLog = [];

    for (const tx of transactions) {
      const amount = parseFloat(tx.amount || 0);
      const before = calculatedBalance;

      // Only count successful transactions in balance calculation
      // This ensures we don't count failed debits (which were refunded) or pending transactions
      if (tx.status === "successful") {
        if (tx.transaction_type === "credit") {
          calculatedBalance += amount;
        } else if (tx.transaction_type === "debit") {
          calculatedBalance -= amount;
        }
      }

      transactionLog.push({
        id: tx.id,
        type: tx.transaction_type,
        amount: amount,
        service: tx.service_name,
        ref: tx.transaction_reference,
        status: tx.status,
        before: before,
        after: calculatedBalance,
        created_at: tx.created_at,
        counted: tx.status === "successful", // Track if this transaction was counted
      });
    }

    console.log(`💰 Calculated balance from transactions: ${calculatedBalance.toLocaleString()}`);
    console.log(`📉 Difference: ${(currentBalance - calculatedBalance).toLocaleString()}`);

    // Check for pending payouts that should have been deducted
    const pendingPayouts = await TutorPayout.sum("amount", {
      where: {
        tutor_id: tutorId,
        tutor_type: tutorType,
        status: {
          [Op.in]: ["pending", "processing"],
        },
      },
    });

    const pendingPayoutsAmount = parseFloat(pendingPayouts || 0);
    if (pendingPayoutsAmount > 0) {
      console.log(`⚠️  Pending payouts: ${pendingPayoutsAmount.toLocaleString()}`);
      console.log(`💵 Available balance (after pending): ${(calculatedBalance - pendingPayoutsAmount).toLocaleString()}`);
    }

    // Check for failed payouts that should have been refunded
    const failedPayouts = await TutorPayout.findAll({
      where: {
        tutor_id: tutorId,
        tutor_type: tutorType,
        status: "failed",
      },
      order: [["created_at", "DESC"]],
      limit: 10,
    });

    if (failedPayouts.length > 0) {
      console.log(`\n⚠️  Found ${failedPayouts.length} failed payouts:`);
      for (const payout of failedPayouts) {
        const refunded = payout.metadata?.refunded;
        console.log(`  - Payout ${payout.id}: ${payout.amount} (refunded: ${refunded ? "Yes" : "No"})`);
      }
    }

    // Show recent transactions
    console.log(`\n📋 Recent transactions (last 10):`);
    transactionLog.slice(-10).forEach((tx, idx) => {
      const sign = tx.type === "credit" ? "+" : "-";
      console.log(
        `  ${idx + 1}. ${tx.created_at.toISOString().split("T")[0]} | ${sign}${tx.amount.toLocaleString()} | ${tx.service} | ${tx.status} | Balance: ${tx.after.toLocaleString()}`
      );
    });

    // Check for suspicious transactions (large amounts, duplicates, etc.)
    console.log(`\n🔎 Checking for suspicious transactions...`);
    const suspicious = [];

    // Check for duplicate refunds
    const refundRefs = new Map();
    transactionLog.forEach((tx) => {
      if (tx.service === "Payout Refund") {
        const key = tx.ref;
        if (refundRefs.has(key)) {
          suspicious.push({
            type: "duplicate_refund",
            transaction: tx,
            duplicate_of: refundRefs.get(key),
          });
        } else {
          refundRefs.set(key, tx);
        }
      }
    });

    // Check for large credits
    transactionLog.forEach((tx) => {
      if (tx.type === "credit" && tx.amount > 1000000) {
        suspicious.push({
          type: "large_credit",
          transaction: tx,
        });
      }
    });

    if (suspicious.length > 0) {
      console.log(`⚠️  Found ${suspicious.length} suspicious transactions:`);
      suspicious.forEach((s) => {
        console.log(`  - ${s.type}:`, s.transaction);
      });
    } else {
      console.log(`✅ No suspicious transactions found`);
    }

    // Fix balance if requested (with extra safety checks)
    if (fix) {
      const difference = currentBalance - calculatedBalance;
      
      // Safety check: Only fix if difference is significant (more than 1 unit)
      // This prevents tiny rounding errors from being "fixed"
      if (Math.abs(difference) > 1.0) {
        console.log(`\n⚠️  WARNING: About to correct balance!`);
        console.log(`   Current balance: ${currentBalance.toLocaleString()}`);
        console.log(`   Calculated balance: ${calculatedBalance.toLocaleString()}`);
        console.log(`   Difference: ${difference.toLocaleString()}`);
        console.log(`   This will ${difference > 0 ? "REDUCE" : "INCREASE"} the balance by ${Math.abs(difference).toLocaleString()}`);
        
        // Double-check: Verify calculation one more time
        console.log(`\n🔍 Double-checking calculation...`);
        const recheckTransactions = await TutorWalletTransaction.findAll({
          where: {
            tutor_id: tutorId,
            tutor_type: tutorType,
            status: "successful", // Only count successful transactions
          },
          order: [["created_at", "ASC"]],
        });

        let recheckBalance = 0;
        for (const tx of recheckTransactions) {
          const amount = parseFloat(tx.amount || 0);
          if (tx.transaction_type === "credit") {
            recheckBalance += amount;
          } else if (tx.transaction_type === "debit") {
            recheckBalance -= amount;
          }
        }

        console.log(`   Recheck calculated balance: ${recheckBalance.toLocaleString()}`);
        
        // If recheck matches calculated, proceed
        if (Math.abs(recheckBalance - calculatedBalance) < 0.01) {
          console.log(`   ✅ Recheck matches calculated balance`);
        } else {
          console.log(`   ⚠️  WARNING: Recheck differs from calculated!`);
          console.log(`   Recheck: ${recheckBalance.toLocaleString()}`);
          console.log(`   Calculated: ${calculatedBalance.toLocaleString()}`);
          console.log(`   ❌ ABORTING: Calculation mismatch detected. Please investigate manually.`);
          return {
            tutorId,
            tutorType,
            currentBalance,
            calculatedBalance,
            recheckBalance,
            difference: currentBalance - calculatedBalance,
            pendingPayouts: pendingPayoutsAmount,
            availableBalance: calculatedBalance - pendingPayoutsAmount,
            suspiciousTransactions: suspicious.length,
            error: "Calculation mismatch - fix aborted for safety",
          };
        }

        // Final confirmation prompt (in production, you might want actual user input)
        console.log(`\n⚠️  FINAL WARNING: This will modify the database!`);
        console.log(`   Press Ctrl+C within 10 seconds to cancel...`);
        await new Promise((resolve) => setTimeout(resolve, 10000));

        const transaction = await db.transaction({
          isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE,
        });
        
        try {
          // Lock tutor record
          const lockedTutor = tutorType === "sole_tutor"
            ? await SoleTutor.findByPk(tutorId, {
                lock: Sequelize.Transaction.LOCK.UPDATE,
                transaction,
              })
            : await Organization.findByPk(tutorId, {
                lock: Sequelize.Transaction.LOCK.UPDATE,
                transaction,
              });

          if (!lockedTutor) {
            await transaction.rollback();
            throw new Error("Tutor not found during correction");
          }

          // Verify balance hasn't changed since we started
          const balanceAtLock = parseFloat(lockedTutor.wallet_balance || 0);
          if (Math.abs(balanceAtLock - currentBalance) > 0.01) {
            await transaction.rollback();
            console.log(`   ❌ ABORTED: Balance changed during correction (was ${currentBalance}, now ${balanceAtLock})`);
            throw new Error("Balance changed during correction - aborting for safety");
          }

          // Update balance
          await lockedTutor.update(
            { wallet_balance: calculatedBalance },
            { transaction }
          );

          // Create correction transaction record (for audit trail)
          await TutorWalletTransaction.create(
            {
              tutor_id: tutorId,
              tutor_type: tutorType,
              transaction_type: difference > 0 ? "debit" : "credit",
              amount: Math.abs(difference),
              currency: lockedTutor.currency || "NGN",
              service_name: "Balance Correction (Audit)",
              transaction_reference: `CORRECTION-${tutorId}-${Date.now()}`,
              balance_before: currentBalance,
              balance_after: calculatedBalance,
              status: "successful",
              metadata: {
                correction_reason: "Balance audit correction - recalculated from transaction history",
                original_balance: currentBalance,
                calculated_balance: calculatedBalance,
                recheck_balance: recheckBalance,
                difference: difference,
                correction_date: new Date().toISOString(),
                audit_script_version: "1.0",
              },
            },
            { transaction }
          );

          await transaction.commit();
          console.log(`\n✅ Balance corrected successfully!`);
          console.log(`   New balance: ${calculatedBalance.toLocaleString()}`);
        } catch (error) {
          await transaction.rollback();
          console.error(`\n❌ Error fixing balance:`, error.message);
          throw error;
        }
      } else {
        console.log(`\n✅ Balance is correct (difference < 1 unit), no fix needed`);
        console.log(`   Difference: ${difference.toLocaleString()}`);
      }
    } else {
      console.log(`\n💡 To fix the balance, run with --fix flag`);
      console.log(`   ⚠️  WARNING: --fix will modify the database!`);
    }

    return {
      tutorId,
      tutorType,
      currentBalance,
      calculatedBalance,
      difference: currentBalance - calculatedBalance,
      pendingPayouts: pendingPayoutsAmount,
      availableBalance: calculatedBalance - pendingPayoutsAmount,
      suspiciousTransactions: suspicious.length,
    };
  } catch (error) {
    console.error(`❌ Error auditing wallet:`, error);
    throw error;
  }
}

async function main() {
  try {
    const args = process.argv.slice(2);
    const tutorIdArg = args.find((arg) => arg.startsWith("--tutor-id="));
    const tutorTypeArg = args.find((arg) => arg.startsWith("--tutor-type="));
    const fixArg = args.includes("--fix");

    const tutorId = tutorIdArg ? parseInt(tutorIdArg.split("=")[1]) : null;
    const tutorType = tutorTypeArg ? tutorTypeArg.split("=")[1] : null;

    console.log("📦 Starting wallet balance audit...");
    console.log(`Database: ${db.getDialect()}`);

    if (tutorId && tutorType) {
      // Audit specific tutor
      await auditWalletBalance(tutorId, tutorType, fixArg);
    } else {
      // Audit all tutors with suspicious balances
      console.log("\n🔍 Finding tutors with suspicious balances...");

      // Get all sole tutors
      const soleTutors = await SoleTutor.findAll({
        attributes: ["id", "wallet_balance", "email"],
        where: {
          wallet_balance: {
            [Op.gt]: 1000000, // More than 1 million
          },
        },
        order: [["wallet_balance", "DESC"]],
        limit: 50,
      });

      // Get all organizations
      const organizations = await Organization.findAll({
        attributes: ["id", "wallet_balance", "email"],
        where: {
          wallet_balance: {
            [Op.gt]: 1000000, // More than 1 million
          },
        },
        order: [["wallet_balance", "DESC"]],
        limit: 50,
      });

      console.log(`\nFound ${soleTutors.length} sole tutors with balance > 1M`);
      console.log(`Found ${organizations.length} organizations with balance > 1M`);

      const allTutors = [
        ...soleTutors.map((t) => ({ id: t.id, type: "sole_tutor", balance: t.wallet_balance, email: t.email })),
        ...organizations.map((t) => ({ id: t.id, type: "organization", balance: t.wallet_balance, email: t.email })),
      ];

      if (allTutors.length === 0) {
        console.log("✅ No tutors with suspicious balances found");
        return;
      }

      console.log(`\n📊 Top tutors by balance:`);
      allTutors
        .sort((a, b) => b.balance - a.balance)
        .slice(0, 10)
        .forEach((t, idx) => {
          console.log(`  ${idx + 1}. Tutor ${t.id} (${t.type}): ${parseFloat(t.balance).toLocaleString()} - ${t.email}`);
        });

      if (fixArg) {
        console.log(`\n⚠️  FIX MODE: Will correct balances for all tutors listed above`);
        console.log(`Press Ctrl+C within 5 seconds to cancel...`);
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }

      // Audit each tutor
      const results = [];
      for (const tutor of allTutors) {
        try {
          const result = await auditWalletBalance(tutor.id, tutor.type, fixArg);
          results.push(result);
        } catch (error) {
          console.error(`❌ Error auditing tutor ${tutor.id}:`, error.message);
        }
      }

      // Summary
      console.log(`\n📊 Audit Summary:`);
      console.log(`  Total audited: ${results.length}`);
      console.log(`  With discrepancies: ${results.filter((r) => Math.abs(r.difference) > 0.01).length}`);
      const totalDifference = results.reduce((sum, r) => sum + r.difference, 0);
      console.log(`  Total difference: ${totalDifference.toLocaleString()}`);
    }
  } catch (error) {
    console.error("\n❌ Audit failed:", error);
    throw error;
  } finally {
    await db.close();
  }
}

// Run audit
main()
  .then(() => {
    console.log("\n🎉 Audit completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Audit failed:", error);
    process.exit(1);
  });


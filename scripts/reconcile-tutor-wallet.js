/**
 * Reconcile Tutor Wallet Balance Script
 * 
 * This script audits and reconciles a specific tutor's wallet balance
 * by recalculating from transaction history and checking for duplicate refunds.
 * 
 * Usage:
 *   node scripts/reconcile-tutor-wallet.js --tutor-id=ID --tutor-type=TYPE [--fix]
 * 
 * Example:
 *   node scripts/reconcile-tutor-wallet.js --tutor-id=1 --tutor-type=sole_tutor --fix
 */

import dotenv from "dotenv";
import { connectDB } from "../src/database/database.js";
import { db } from "../src/database/database.js";
import { Op, Sequelize } from "sequelize";
import { TutorWalletTransaction } from "../src/models/marketplace/tutorWalletTransaction.js";
import { SoleTutor } from "../src/models/marketplace/soleTutor.js";
import { Organization } from "../src/models/marketplace/organization.js";
import { TutorPayout } from "../src/models/marketplace/tutorPayout.js";

dotenv.config();

async function reconcileTutorWallet(tutorId, tutorType, fix = false) {
  try {
    const connected = await connectDB();
    if (!connected) {
      console.error("❌ Failed to connect to database");
      process.exit(1);
    }

    console.log("\n" + "=".repeat(60));
    console.log("🔍 WALLET BALANCE RECONCILIATION");
    console.log("=".repeat(60));
    console.log(`\nTutor ID: ${tutorId}`);
    console.log(`Tutor Type: ${tutorType}`);
    console.log(`Fix Mode: ${fix ? "ENABLED ⚠️" : "DISABLED (Read-only)"}\n`);

    // Get tutor record
    let tutor;
    if (tutorType === "sole_tutor") {
      tutor = await SoleTutor.findByPk(tutorId);
    } else if (tutorType === "organization") {
      tutor = await Organization.findByPk(tutorId);
    } else {
      console.error(`❌ Invalid tutor type: ${tutorType}`);
      process.exit(1);
    }

    if (!tutor) {
      console.error(`❌ Tutor ${tutorId} (${tutorType}) not found`);
      process.exit(1);
    }

    const currentBalance = parseFloat(tutor.wallet_balance || 0);
    console.log(`📊 Current balance in database: ${currentBalance.toLocaleString()}\n`);

    // Get all wallet transactions
    const transactions = await TutorWalletTransaction.findAll({
      where: {
        tutor_id: tutorId,
        tutor_type: tutorType,
      },
      order: [["created_at", "ASC"]],
    });

    console.log(`📝 Found ${transactions.length} wallet transactions\n`);

    // Calculate balance from transactions
    // IMPORTANT: Only count successful transactions
    // - Failed debits should NOT be counted (they were refunded)
    // - Successful credits should be counted (including refunds)
    // - Successful debits should be counted (actual deductions)
    let calculatedBalance = 0;
    const transactionHistory = [];

    for (const tx of transactions) {
      const amount = parseFloat(tx.amount || 0);
      const before = calculatedBalance;
      
      // Only count successful transactions
      // Failed debits are not counted because they were refunded
      // Pending transactions are not counted until they complete
      if (tx.status === "successful") {
        if (tx.transaction_type === "credit") {
          calculatedBalance += amount;
        } else if (tx.transaction_type === "debit") {
          calculatedBalance -= amount;
        }
      }
      
      transactionHistory.push({
        id: tx.id,
        type: tx.transaction_type,
        amount: amount,
        balance_before: before,
        balance_after: calculatedBalance,
        service: tx.service_name,
        reference: tx.transaction_reference,
        status: tx.status,
        created_at: tx.created_at,
        metadata: tx.metadata,
        counted: tx.status === "successful", // Track if counted
      });
    }

    console.log(`💰 Calculated balance from transactions: ${calculatedBalance.toLocaleString()}\n`);

    // Check for duplicate refunds
    console.log("🔍 Checking for duplicate refunds...\n");
    const payoutRefunds = transactions.filter(
      (tx) =>
        tx.service_name === "Payout Refund" &&
        tx.transaction_type === "credit" &&
        tx.status === "successful"
    );

    const refundGroups = {};
    for (const refund of payoutRefunds) {
      const payoutRef = refund.metadata?.payout_reference || refund.transaction_reference?.replace("REFUND-", "");
      if (payoutRef) {
        if (!refundGroups[payoutRef]) {
          refundGroups[payoutRef] = [];
        }
        refundGroups[payoutRef].push(refund);
      }
    }

    const duplicateRefunds = Object.entries(refundGroups).filter(
      ([_, refunds]) => refunds.length > 1
    );

    if (duplicateRefunds.length > 0) {
      console.log(`⚠️  Found ${duplicateRefunds.length} payout(s) with duplicate refunds:\n`);
      for (const [payoutRef, refunds] of duplicateRefunds) {
        console.log(`   Payout Reference: ${payoutRef}`);
        console.log(`   Number of refunds: ${refunds.length}`);
        const totalRefunded = refunds.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
        console.log(`   Total refunded: ${totalRefunded.toLocaleString()}`);
        console.log(`   Refund IDs: ${refunds.map((r) => r.id).join(", ")}\n`);
      }
    } else {
      console.log("✅ No duplicate refunds found\n");
    }

    // Check payout records
    console.log("🔍 Checking payout records...\n");
    const payouts = await TutorPayout.findAll({
      where: {
        tutor_id: tutorId,
        tutor_type: tutorType,
      },
      order: [["created_at", "ASC"]],
    });

    console.log(`📝 Found ${payouts.length} payout record(s)\n`);

    const pendingPayouts = payouts.filter(
      (p) => p.status === "pending" || p.status === "processing"
    );
    const failedPayouts = payouts.filter((p) => p.status === "failed");
    const successfulPayouts = payouts.filter((p) => p.status === "successful");

    console.log(`   - Pending/Processing: ${pendingPayouts.length}`);
    console.log(`   - Failed: ${failedPayouts.length}`);
    console.log(`   - Successful: ${successfulPayouts.length}\n`);

    // Check for failed payouts that weren't refunded
    const unrefundedFailedPayouts = [];
    for (const payout of failedPayouts) {
      const refunded = payout.metadata?.refunded === true;
      const refundTx = transactions.find(
        (tx) =>
          tx.service_name === "Payout Refund" &&
          tx.metadata?.payout_id === payout.id &&
          tx.status === "successful"
      );

      if (!refunded && !refundTx) {
        unrefundedFailedPayouts.push(payout);
      }
    }

    if (unrefundedFailedPayouts.length > 0) {
      console.log(`⚠️  Found ${unrefundedFailedPayouts.length} failed payout(s) that may not be refunded:\n`);
      for (const payout of unrefundedFailedPayouts) {
        console.log(`   Payout ID: ${payout.id}`);
        console.log(`   Amount: ${parseFloat(payout.amount).toLocaleString()}`);
        console.log(`   Reference: ${payout.flutterwave_reference}`);
        console.log(`   Status: ${payout.status}`);
        console.log(`   Failure Reason: ${payout.failure_reason || "N/A"}\n`);
      }
    } else {
      console.log("✅ All failed payouts appear to be refunded\n");
    }

    // Calculate difference
    const difference = currentBalance - calculatedBalance;
    const differenceAbs = Math.abs(difference);

    console.log("=".repeat(60));
    console.log("📊 RECONCILIATION SUMMARY");
    console.log("=".repeat(60));
    console.log(`Current Balance:     ${currentBalance.toLocaleString()}`);
    console.log(`Calculated Balance:  ${calculatedBalance.toLocaleString()}`);
    console.log(`Difference:         ${difference > 0 ? "+" : ""}${difference.toLocaleString()}`);
    console.log("=".repeat(60) + "\n");

    if (differenceAbs < 0.01) {
      console.log("✅ Balance is correct! No discrepancies found.\n");
    } else {
      console.log(`⚠️  DISCREPANCY DETECTED!\n`);
      console.log(`   Difference: ${difference > 0 ? "+" : ""}${difference.toLocaleString()}\n`);

      if (fix) {
        console.log("⚠️  FIX MODE ENABLED - This will update the wallet balance!");
        console.log("   Press Ctrl+C within 10 seconds to cancel...\n");
        await new Promise((resolve) => setTimeout(resolve, 10000));

        const transaction = await db.transaction({
          isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE,
        });

        try {
          // Lock tutor record
          let lockedTutor;
          if (tutorType === "sole_tutor") {
            lockedTutor = await SoleTutor.findByPk(tutorId, {
              lock: Sequelize.Transaction.LOCK.UPDATE,
              transaction,
            });
          } else {
            lockedTutor = await Organization.findByPk(tutorId, {
              lock: Sequelize.Transaction.LOCK.UPDATE,
              transaction,
            });
          }

          if (lockedTutor) {
            const oldBalance = parseFloat(lockedTutor.wallet_balance || 0);
            await lockedTutor.update(
              { wallet_balance: calculatedBalance },
              { transaction }
            );

            await transaction.commit();

            console.log("✅ Balance updated successfully!");
            console.log(`   Old balance: ${oldBalance.toLocaleString()}`);
            console.log(`   New balance: ${calculatedBalance.toLocaleString()}\n`);
          } else {
            await transaction.rollback();
            console.error("❌ Failed to lock tutor record");
          }
        } catch (error) {
          await transaction.rollback();
          console.error("❌ Error updating balance:", error);
          throw error;
        }
      } else {
        console.log("💡 To fix this discrepancy, run the script with --fix flag:");
        console.log(
          `   node scripts/reconcile-tutor-wallet.js --tutor-id=${tutorId} --tutor-type=${tutorType} --fix\n`
        );
      }
    }

    // Export transaction history
    console.log("📄 Transaction History (last 20):\n");
    transactionHistory.slice(-20).forEach((tx, idx) => {
      const counted = tx.counted ? "✓" : "✗";
      const statusBadge = tx.status === "successful" ? "✅" : tx.status === "failed" ? "❌" : "⏳";
      console.log(
        `${idx + 1}. ${counted} ${statusBadge} [${tx.type.toUpperCase()}] ${tx.amount.toLocaleString()} | Balance: ${tx.balance_after.toLocaleString()} | ${tx.service} | ${tx.reference}`
      );
    });
    
    // Show summary of counted vs not counted
    const counted = transactionHistory.filter(tx => tx.counted).length;
    const notCounted = transactionHistory.filter(tx => !tx.counted).length;
    console.log(`\n📊 Transaction Summary:`);
    console.log(`   Counted (successful): ${counted}`);
    console.log(`   Not counted (failed/pending): ${notCounted}`);

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Reconciliation failed:", error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
let tutorId = null;
let tutorType = null;
let fix = false;

for (const arg of args) {
  if (arg.startsWith("--tutor-id=")) {
    tutorId = parseInt(arg.split("=")[1]);
  } else if (arg.startsWith("--tutor-type=")) {
    tutorType = arg.split("=")[1];
  } else if (arg === "--fix") {
    fix = true;
  }
}

if (!tutorId || !tutorType) {
  console.error("❌ Missing required arguments");
  console.error("\nUsage:");
  console.error(
    "  node scripts/reconcile-tutor-wallet.js --tutor-id=ID --tutor-type=TYPE [--fix]"
  );
  console.error("\nExample:");
  console.error(
    "  node scripts/reconcile-tutor-wallet.js --tutor-id=1 --tutor-type=sole_tutor --fix"
  );
  process.exit(1);
}

reconcileTutorWallet(tutorId, tutorType, fix);


/**
 * Find Tutor ID Script
 * 
 * This script helps find tutor ID from payout records or email
 * 
 * Usage:
 *   node scripts/find-tutor-id.js --email=EMAIL
 *   node scripts/find-tutor-id.js --payout-id=PAYOUT_ID
 */

import dotenv from "dotenv";
import { connectDB } from "../src/database/database.js";
import { SoleTutor } from "../src/models/marketplace/soleTutor.js";
import { Organization } from "../src/models/marketplace/organization.js";
import { TutorPayout } from "../src/models/marketplace/tutorPayout.js";

dotenv.config();

async function findTutorId(email = null, payoutId = null) {
  try {
    const connected = await connectDB();
    if (!connected) {
      console.error("❌ Failed to connect to database");
      process.exit(1);
    }

    if (payoutId) {
      console.log(`\n🔍 Finding tutor from payout ID: ${payoutId}\n`);
      const payout = await TutorPayout.findByPk(payoutId);
      
      if (!payout) {
        console.error(`❌ Payout ${payoutId} not found`);
        process.exit(1);
      }

      console.log(`📊 Payout Details:`);
      console.log(`   ID: ${payout.id}`);
      console.log(`   Amount: ${parseFloat(payout.amount).toLocaleString()}`);
      console.log(`   Status: ${payout.status}`);
      console.log(`   Tutor ID: ${payout.tutor_id}`);
      console.log(`   Tutor Type: ${payout.tutor_type}`);
      console.log(`   Reference: ${payout.flutterwave_reference}\n`);

      // Get tutor details
      let tutor;
      if (payout.tutor_type === "sole_tutor") {
        tutor = await SoleTutor.findByPk(payout.tutor_id);
      } else {
        tutor = await Organization.findByPk(payout.tutor_id);
      }

      if (tutor) {
        const balance = parseFloat(tutor.wallet_balance || 0);
        console.log(`👤 Tutor Details:`);
        if (payout.tutor_type === "sole_tutor") {
          console.log(`   Name: ${tutor.fname} ${tutor.lname}`);
        } else {
          console.log(`   Name: ${tutor.name}`);
        }
        console.log(`   Email: ${tutor.email}`);
        console.log(`   Wallet Balance: ${balance.toLocaleString()}\n`);
      }

      console.log(`\n✅ Run reconciliation with:`);
      console.log(`   node scripts/reconcile-tutor-wallet.js --tutor-id=${payout.tutor_id} --tutor-type=${payout.tutor_type} --fix\n`);
    } else if (email) {
      console.log(`\n🔍 Finding tutor from email: ${email}\n`);
      
      // Try sole tutor first
      let tutor = await SoleTutor.findOne({
        where: { email: email.toLowerCase() },
      });

      if (tutor) {
        const balance = parseFloat(tutor.wallet_balance || 0);
        console.log(`✅ Found Sole Tutor:`);
        console.log(`   ID: ${tutor.id}`);
        console.log(`   Name: ${tutor.fname} ${tutor.lname}`);
        console.log(`   Email: ${tutor.email}`);
        console.log(`   Wallet Balance: ${balance.toLocaleString()}\n`);
        console.log(`\n✅ Run reconciliation with:`);
        console.log(`   node scripts/reconcile-tutor-wallet.js --tutor-id=${tutor.id} --tutor-type=sole_tutor --fix\n`);
        return;
      }

      // Try organization
      tutor = await Organization.findOne({
        where: { email: email.toLowerCase() },
      });

      if (tutor) {
        const balance = parseFloat(tutor.wallet_balance || 0);
        console.log(`✅ Found Organization:`);
        console.log(`   ID: ${tutor.id}`);
        console.log(`   Name: ${tutor.name}`);
        console.log(`   Email: ${tutor.email}`);
        console.log(`   Wallet Balance: ${balance.toLocaleString()}\n`);
        console.log(`\n✅ Run reconciliation with:`);
        console.log(`   node scripts/reconcile-tutor-wallet.js --tutor-id=${tutor.id} --tutor-type=organization --fix\n`);
        return;
      }

      console.error(`❌ No tutor found with email: ${email}`);
      process.exit(1);
    } else {
      // List recent payouts with issues
      console.log(`\n🔍 Recent Failed Payouts:\n`);
      const failedPayouts = await TutorPayout.findAll({
        where: {
          status: "failed",
        },
        order: [["created_at", "DESC"]],
        limit: 10,
      });

      if (failedPayouts.length === 0) {
        console.log("No failed payouts found\n");
      } else {
        for (const payout of failedPayouts) {
          let tutor;
          if (payout.tutor_type === "sole_tutor") {
            tutor = await SoleTutor.findByPk(payout.tutor_id);
          } else {
            tutor = await Organization.findByPk(payout.tutor_id);
          }

          const tutorName = tutor
            ? payout.tutor_type === "sole_tutor"
              ? `${tutor.fname} ${tutor.lname}`
              : tutor.name
            : "Unknown";
          const balance = tutor ? parseFloat(tutor.wallet_balance || 0) : 0;

          console.log(`Payout ID: ${payout.id}`);
          console.log(`   Tutor: ${tutorName} (ID: ${payout.tutor_id}, Type: ${payout.tutor_type})`);
          console.log(`   Amount: ${parseFloat(payout.amount).toLocaleString()}`);
          console.log(`   Wallet Balance: ${balance.toLocaleString()}`);
          console.log(`   Reference: ${payout.flutterwave_reference}`);
          console.log(`   Run: node scripts/reconcile-tutor-wallet.js --tutor-id=${payout.tutor_id} --tutor-type=${payout.tutor_type} --fix\n`);
        }
      }
    }

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error:", error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
let email = null;
let payoutId = null;

for (const arg of args) {
  if (arg.startsWith("--email=")) {
    email = arg.split("=")[1];
  } else if (arg.startsWith("--payout-id=")) {
    payoutId = parseInt(arg.split("=")[1]);
  }
}

if (!email && !payoutId) {
  // If no arguments, show recent failed payouts
  findTutorId();
} else {
  findTutorId(email, payoutId);
}


/**
 * Simple script to set tutor wallet balance to a specific amount
 * 
 * Usage:
 *   node scripts/set-tutor-balance.js --tutor-id=ID --tutor-type=TYPE --balance=AMOUNT
 * 
 * Example:
 *   node scripts/set-tutor-balance.js --tutor-id=1 --tutor-type=sole_tutor --balance=180
 */

import dotenv from "dotenv";
import { connectDB } from "../src/database/database.js";
import { db } from "../src/database/database.js";
import { Sequelize } from "sequelize";
import { SoleTutor } from "../src/models/marketplace/soleTutor.js";
import { Organization } from "../src/models/marketplace/organization.js";

dotenv.config();

async function setBalance(tutorId, tutorType, balance) {
  try {
    const connected = await connectDB();
    if (!connected) {
      console.error("❌ Failed to connect to database");
      process.exit(1);
    }

    console.log(`\n🔧 Setting wallet balance for tutor ${tutorId} (${tutorType}) to ${balance} NGN\n`);

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

    const oldBalance = parseFloat(tutor.wallet_balance || 0);
    console.log(`📊 Current balance: ${oldBalance.toLocaleString()}`);
    console.log(`📊 New balance: ${balance.toLocaleString()}\n`);

    // Use transaction for safety
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

      if (!lockedTutor) {
        await transaction.rollback();
        console.error("❌ Failed to lock tutor record");
        process.exit(1);
      }

      // Update balance
      await lockedTutor.update(
        { wallet_balance: balance },
        { transaction }
      );

      await transaction.commit();

      console.log("✅ Balance updated successfully!");
      console.log(`   Old: ${oldBalance.toLocaleString()} NGN`);
      console.log(`   New: ${balance.toLocaleString()} NGN\n`);

      process.exit(0);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error("\n❌ Error:", error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
let tutorId = null;
let tutorType = null;
let balance = null;

for (const arg of args) {
  if (arg.startsWith("--tutor-id=")) {
    tutorId = parseInt(arg.split("=")[1]);
  } else if (arg.startsWith("--tutor-type=")) {
    tutorType = arg.split("=")[1];
  } else if (arg.startsWith("--balance=")) {
    balance = parseFloat(arg.split("=")[1]);
  }
}

if (!tutorId || !tutorType || balance === null) {
  console.error("❌ Missing required arguments");
  console.error("\nUsage:");
  console.error("  node scripts/set-tutor-balance.js --tutor-id=ID --tutor-type=TYPE --balance=AMOUNT");
  console.error("\nExample:");
  console.error("  node scripts/set-tutor-balance.js --tutor-id=1 --tutor-type=sole_tutor --balance=180");
  process.exit(1);
}

setBalance(tutorId, tutorType, balance);


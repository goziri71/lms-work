import { connectDB } from "../src/database/database.js";
import { PaymentSetup } from "../src/models/payment/paymentSetup.js";

/**
 * Import payment setup data from SQL dump
 * This script imports the payment setup items from the provided SQL dump
 */
async function importPaymentSetupData() {
  try {
    // Connect to database
    const connected = await connectDB();
    if (!connected) {
      console.error("❌ Failed to connect to database");
      process.exit(1);
    }

    console.log("📦 Starting payment setup data import...\n");

    // Data from SQL dump
    const paymentSetupData = [
      {
        id: 10,
        item: "Semester registration",
        amount: 100,
        description: "",
        semester: "2ND",
        currency: "USD",
      },
      {
        id: 16,
        item: "Semester registration",
        amount: 50000,
        description: "Tuition Deposit",
        semester: "2ND",
        currency: "NGN",
      },
      {
        id: 18,
        item: "Semester registration",
        amount: 100,
        description: "Tuition Deposit",
        semester: "1ST",
        currency: "USD",
      },
      {
        id: 19,
        item: "ICT Fee",
        amount: 25,
        description: "ICT Fee",
        semester: "1ST",
        currency: "USD",
      },
      {
        id: 20,
        item: "Semester registration",
        amount: 50000,
        description: "Semester registration",
        semester: "1ST",
        currency: "NGN",
      },
      {
        id: 21,
        item: "ICT Fee",
        amount: 25,
        description: "ICT Fee",
        semester: "2ND",
        currency: "USD",
      },
    ];

    let imported = 0;
    let skipped = 0;
    let errors = 0;

    for (const item of paymentSetupData) {
      try {
        // Check if item with this ID already exists
        const existing = await PaymentSetup.findByPk(item.id);

        if (existing) {
          // Update existing record
          await existing.update({
            item: item.item,
            amount: item.amount,
            description: item.description || "",
            semester: item.semester,
            currency: item.currency,
          });
          console.log(`✅ Updated payment setup #${item.id}: ${item.item} (${item.semester} - ${item.currency})`);
          imported++;
        } else {
          // Create new record with specified ID
          // Note: We need to use raw SQL to set the ID since Sequelize auto-increment might interfere
          await PaymentSetup.sequelize.query(
            `INSERT INTO payment_setup (id, item, amount, description, semester, currency) 
             VALUES (:id, :item, :amount, :description, :semester, :currency)
             ON CONFLICT (id) DO UPDATE SET
               item = EXCLUDED.item,
               amount = EXCLUDED.amount,
               description = EXCLUDED.description,
               semester = EXCLUDED.semester,
               currency = EXCLUDED.currency`,
            {
              replacements: {
                id: item.id,
                item: item.item,
                amount: item.amount,
                description: item.description || "",
                semester: item.semester,
                currency: item.currency,
              },
              type: PaymentSetup.sequelize.QueryTypes.INSERT,
            }
          );
          console.log(`✅ Imported payment setup #${item.id}: ${item.item} (${item.semester} - ${item.currency})`);
          imported++;
        }
      } catch (error) {
        console.error(`❌ Error importing item #${item.id}:`, error.message);
        errors++;
      }
    }

    console.log("\n📊 Import Summary:");
    console.log(`   ✅ Imported/Updated: ${imported}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log(`   📦 Total: ${paymentSetupData.length}`);

    // Verify import
    const totalCount = await PaymentSetup.count();
    console.log(`\n📋 Total payment setup items in database: ${totalCount}`);

    console.log("\n✅ Payment setup data import completed!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Fatal error during import:", error);
    process.exit(1);
  }
}

// Run the import
importPaymentSetupData();


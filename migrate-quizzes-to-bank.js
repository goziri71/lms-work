import "dotenv/config";
import { connectDB } from "./src/database/database.js";
import { setupAssociations } from "./src/models/associations.js";
import { setupExamAssociations } from "./src/models/exams/index.js";
import { bulkImportQuizzesToBank } from "./src/services/examBankSync.js";

async function migrate() {
  console.log("🔄 Connecting to databases...");
  const connected = await connectDB();
  if (!connected) {
    console.error("❌ Database connection failed");
    process.exit(1);
  }

  setupAssociations();
  setupExamAssociations();

  console.log("\n📦 Starting quiz migration to exam bank...");
  const result = await bulkImportQuizzesToBank();

  console.log(
    `\n✅ Migration complete! Imported ${result.imported} questions.`
  );
  process.exit(0);
}

migrate().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});

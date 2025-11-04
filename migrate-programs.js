import { connectDB, db } from "./src/database/database.js";
import { Program } from "./src/models/program/program.js";

/**
 * Migration script to create programs table and import data
 * Run this with: node migrate-programs.js
 */

// Programs data from SQL dump
const programsData = [
  { id: 4, faculty_id: 2, title: "Bsc. Economics", description: "Bsc. Economics", date: "2023-08-14 21:41:33", token: "a87ff679a2f3e71d9181a67b7542122c", status: "N" },
  { id: 8, faculty_id: 2, title: "Bsc. Business Administration", description: "Bsc. Business Administration", date: "2020-06-24 10:18:28", token: "c9f0f895fb98ab9159f51fd0297e236d", status: "Y" },
  { id: 9, faculty_id: 2, title: "Bsc. Accounting", description: "Bsc. Accounting", date: "2024-03-22 19:31:26", token: "45c48cce2e2d7fbdea1afc51c7c6ad26", status: "N" },
  { id: 17, faculty_id: 8, title: "Bsc. Computer Science", description: "Bsc. Computer Science", date: "2020-06-24 10:21:42", token: "70efdf2ec9b086079795c442636b55fb", status: "Y" },
  { id: 21, faculty_id: 9, title: "Bsc. Sociology", description: "Bsc. Sociology", date: "2023-08-14 21:41:42", token: "3c59dc048e8850243be8079a5c74d079", status: "N" },
  { id: 24, faculty_id: 10, title: "Bsc. Diplomacy & International Relations", description: "Bsc. Diplomacy & International Relations", date: "2021-09-10 11:22:45", token: "1ff1de774005f8da13f42943881c655f", status: "N" },
  { id: 27, faculty_id: 2, title: "MBA Business Administration", description: "MBA", date: "2021-08-18 08:47:16", token: "02e74f10e0327ad868d138f2b4fdd6f0", status: "Y" },
  { id: 32, faculty_id: 8, title: "Msc. Software Engineering", description: "Msc. Computer Science", date: "2023-08-14 21:42:45", token: "6364d3f0f495b6ab9dcf8d3b5c6e0b01", status: "Y" },
  { id: 35, faculty_id: 8, title: "Bsc. Urban & Reginal Planning", description: "Bsc. Urban & Reginal Planning", date: "2023-08-14 21:41:49", token: "1c383cd30b7c298ab50293adfecb7b18", status: "N" },
  { id: 42, faculty_id: 12, title: "BA. Mass Communication", description: "BA. Mass Communication", date: "2024-07-10 21:07:40", token: "a1d0c6e83f027327d8461063f4ac58a6", status: "Y" },
  { id: 43, faculty_id: 12, title: "Advance French Language Certificate", description: "Advance French Language", date: "2023-08-14 21:41:54", token: "17e62166fc8586dfa4d1bc0e1742c08b", status: "N" },
  { id: 44, faculty_id: 14, title: "B.Edu Primary Education", description: "B.Edu Primary Education", date: "2024-03-22 19:31:49", token: "f7177163c833dff4b38fc8d2872f1ec6", status: "N" },
  { id: 45, faculty_id: 14, title: "M.sc Educational Management & Planning", description: "M.sc Educational Management & Planning", date: "2024-03-22 19:31:53", token: "6c8349cc7260ae62e3b1396831a8398f", status: "N" },
  { id: 46, faculty_id: 8, title: "Msc. Cyber Security", description: "Msc. Cyber Security", date: "2021-10-12 15:58:43", token: "d9d4f495e875a2e075a1a4a6e1b9770f", status: "Y" },
  { id: 48, faculty_id: 2, title: "Graduate Member - CIHRSM", description: "Chartered Institute of Human Resource & Strategic Management", date: "2024-03-22 19:32:00", token: "642e92efb79421734881b53e1e1b18b6", status: "N" },
  { id: 49, faculty_id: 2, title: "Associate Member - CIHRSM", description: "Chartered Institute of Human Resource & Strategic Management", date: "2024-03-22 19:32:02", token: "f457c545a9ded88f18ecee47145a72c0", status: "N" },
  { id: 50, faculty_id: 2, title: "Full Member - CIHRSM", description: "Chartered Institute of Human Resource & Strategic Management", date: "2024-03-22 19:32:07", token: "c0c7c76d30bd3dcaefc96f40275bdc0a", status: "N" },
  { id: 51, faculty_id: 2, title: "Fellow Member - CIHRSM", description: "Chartered Institute of Human Resource & Strategic Management", date: "2024-03-22 19:32:13", token: "2838023a778dfaecdc212708f721b788", status: "N" },
  { id: 52, faculty_id: 8, title: "Msc. Information Technology", description: "Msc. Information Technology", date: "2023-04-10 15:36:52", token: "9a1158154dfa42caddbd0694a4e9bdc8", status: "Y" },
  { id: 53, faculty_id: 8, title: "Bsc. Information Technology", description: "Bsc. Information Technology", date: "2025-03-07 13:49:31", token: "d82c8d1619ad8176d665453cfb2e55f0", status: "N" },
  { id: 54, faculty_id: 10, title: "Information Technology Law", description: "Information Technology Law", date: "2024-03-22 19:32:21", token: "a684eceee76fc522773286a895bc8436", status: "N" },
  { id: 55, faculty_id: 8, title: "Business Innovations & Technology", description: "Business Innovations & Technology", date: "2024-03-22 19:32:25", token: "b53b3a3d6ab90ce0268229151c9bde11", status: "N" },
  { id: 56, faculty_id: 8, title: "PGD Information Technology", description: "PGD Information Technology", date: "2023-09-27 18:50:48", token: "9f61408e3afb633e50cdf1b20de6f466", status: "Y" },
  { id: 57, faculty_id: 8, title: "Doctorate Programs (PhD)", description: "Doctorate Programs (PhD)", date: "2023-10-25 12:55:20", token: "72b32a1f754ba1c09b3695e0cb6cde7f", status: "Y" },
  { id: 58, faculty_id: 2, title: "PD Human Resource Management", description: "PD Human Resource Management", date: "2024-03-22 19:32:39", token: "66f041e16a60928b05a7e228a89c3799", status: "Y" },
  { id: 59, faculty_id: 8, title: "PD Digital Marketing", description: "PD Digital Marketing", date: "2024-03-22 19:34:23", token: "093f65e080a295f8076b1c5722a46aa2", status: "N" },
  { id: 60, faculty_id: 10, title: "PD Technology Law and Intelligence", description: "PD Technology Law and Intelligence", date: "2024-03-22 19:34:32", token: "072b030ba126b2f4b2374f342be9ed44", status: "N" },
  { id: 61, faculty_id: 6, title: "PD. Real Esate & Facility Management", description: "PD. Real Esate & Facility Management", date: "2024-03-22 19:34:37", token: "7f39f8317fbdb1988ef4c628eba02591", status: "N" },
  { id: 62, faculty_id: 14, title: "PGD Educational Planning and Management", description: "PGD Educational Planning and Management", date: "2024-03-22 19:34:39", token: "44f683a84163b3523afe57c2e008bc8c", status: "N" },
  { id: 63, faculty_id: 8, title: "Msc. Public Health", description: "Msc. Public Health", date: "2024-09-27 14:27:55", token: "03afdbd66e7929b125f8597834fa83a4", status: "Y" },
];

async function migratePrograms() {
  try {
    console.log("🔄 Connecting to database...");
    const connected = await connectDB();

    if (!connected) {
      console.error("❌ Failed to connect to database");
      process.exit(1);
    }

    console.log("🔄 Creating programs table...");

    // Create table (alter: true will update existing table structure)
    await Program.sync({ force: false, alter: true });
    console.log("✅ Programs table created/updated successfully");

    // Check if data already exists
    const existingCount = await Program.count();
    
    if (existingCount > 0) {
      console.log(`⚠️  Found ${existingCount} existing programs in database`);
      console.log("   Skipping data import to avoid duplicates");
      console.log("   If you want to reimport, delete existing records first");
    } else {
      console.log("🔄 Importing program data...");

      // Bulk insert all programs
      await Program.bulkCreate(programsData, {
        updateOnDuplicate: ["title", "description", "date", "token", "status"],
      });

      const importedCount = await Program.count();
      console.log(`✅ Successfully imported ${importedCount} programs`);
    }

    // Show summary
    const activeCount = await Program.count({ where: { status: "Y" } });
    const inactiveCount = await Program.count({ where: { status: "N" } });

    console.log("\n📊 Programs Summary:");
    console.log(`   Total Programs: ${activeCount + inactiveCount}`);
    console.log(`   Active (Y): ${activeCount}`);
    console.log(`   Inactive (N): ${inactiveCount}`);

    // Show some examples
    console.log("\n📋 Sample Programs:");
    const samplePrograms = await Program.findAll({
      where: { status: "Y" },
      limit: 5,
      attributes: ["id", "title", "status"],
    });

    samplePrograms.forEach((prog) => {
      console.log(`   - ${prog.title} (ID: ${prog.id})`);
    });

    console.log("\n🎉 Programs migration completed successfully!");
    console.log("\n💡 Next steps:");
    console.log("   1. Update associations.js to link Programs with Faculty");
    console.log("   2. Students already have program_id field");
    console.log("   3. Create API endpoints to manage programs");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error migrating programs:", error);
    console.error(error.stack);
    process.exit(1);
  }
}

migratePrograms();


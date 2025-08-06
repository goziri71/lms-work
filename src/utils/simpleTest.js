import { db } from "../database/database.js";

async function simpleTest() {
  try {
    console.log("🔍 Starting simple database test...");

    // Test 1: Basic connection
    console.log("1. Testing connection...");
    await db.authenticate();
    console.log("✅ Connection successful");

    // Test 2: List all tables
    console.log("2. Checking available tables...");
    const [tables] = await db.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
    );
    console.log("📋 Tables found:", tables.length);
    tables.forEach((table) => {
      console.log(`   - ${table.table_name}`);
    });

    // Test 3: Check if students table exists
    const studentsTable = tables.find((t) => t.table_name === "students");
    if (studentsTable) {
      console.log("✅ Students table exists");

      // Test 4: Check students table structure
      console.log("3. Checking students table structure...");
      const [columns] = await db.query(
        "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'students' ORDER BY ordinal_position"
      );
      console.log("📊 Students table columns:");
      columns.forEach((col) => {
        console.log(`   - ${col.column_name} (${col.data_type})`);
      });

      // Test 5: Try a simple count query
      console.log("4. Testing simple query...");
      const [countResult] = await db.query(
        "SELECT COUNT(*) as count FROM students"
      );
      console.log(`📈 Students count: ${countResult[0].count}`);
    } else {
      console.log("❌ Students table not found");
      console.log(
        "Available tables:",
        tables.map((t) => t.table_name)
      );
    }
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    console.error("Full error:", error);
  } finally {
    // Close the connection
    await db.close();
    console.log("🔒 Database connection closed");
  }
}

// Run the test
simpleTest();

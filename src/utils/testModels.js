import { db } from "../database/database.js";
import { Students } from "../models/auth/student.js";
import { Staff } from "../models/auth/staff.js";

async function testModels() {
  try {
    console.log("🔍 Testing Sequelize models...");
    
    // Test 1: Check database connection
    console.log("1. Testing database connection...");
    await db.authenticate();
    console.log("✅ Database connection successful");
    
    // Test 2: Sync models (this will create tables if they don't exist)
    console.log("2. Syncing models...");
    await db.sync({ alter: true }); // Use alter: true to update existing tables
    console.log("✅ Models synced successfully");
    
    // Test 3: Test Students model
    console.log("3. Testing Students model...");
    const studentCount = await Students.count();
    console.log(`📊 Students count: ${studentCount}`);
    
    // Test 4: Test Staff model
    console.log("4. Testing Staff model...");
    const staffCount = await Staff.count();
    console.log(`📊 Staff count: ${staffCount}`);
    
    // Test 5: Test finding a specific student
    console.log("5. Testing findOne query...");
    const testStudent = await Students.findOne({
      where: { email: 'goziri71@gmail.com' }
    });
    
    if (testStudent) {
      console.log("✅ Found student:", {
        id: testStudent.id,
        email: testStudent.email,
        fname: testStudent.fname,
        lname: testStudent.lname
      });
    } else {
      console.log("❌ Student not found with email: goziri71@gmail.com");
    }
    
    console.log("🎉 All tests passed!");
    
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
testModels(); 
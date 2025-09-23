import { db, dbLibrary } from "./src/database/database.js";
import { setupAssociations } from "./src/models/associations.js";

async function restoreAllTables() {
  try {
    console.log("🔄 Restoring all database tables...");
    
    // First, sync the LMS database (students, staff, courses)
    console.log("1. Syncing LMS database...");
    await db.sync({ alter: true });
    console.log("✅ LMS database synced");
    
    // Set up associations
    console.log("2. Setting up associations...");
    setupAssociations();
    console.log("✅ Associations set up");
    
    // Then sync the Library database (modules, units, quizzes)
    console.log("3. Syncing Library database...");
    await dbLibrary.sync({ alter: true });
    console.log("✅ Library database synced");
    
    // Verify critical tables exist
    console.log("4. Verifying tables...");
    
    // Check LMS tables
    const lmsTables = await db.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name IN ('students', 'staff', 'courses', 'course_reg')
    `);
    console.log("LMS tables:", lmsTables[0].map(t => t.table_name));
    
    // Check Library tables
    const libraryTables = await dbLibrary.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name IN ('modules', 'units', 'quiz', 'quiz_questions', 'quiz_options', 'quiz_attempts', 'quiz_answers')
    `);
    console.log("Library tables:", libraryTables[0].map(t => t.table_name));
    
    console.log("🎉 All tables restored successfully!");
    console.log("✅ LMS database: students, staff, courses, course_reg");
    console.log("✅ Library database: modules, units, quiz, quiz_questions, quiz_options, quiz_attempts, quiz_answers");
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error restoring tables:", error);
    process.exit(1);
  }
}

restoreAllTables();

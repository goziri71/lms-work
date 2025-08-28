import { db } from "../database/database.js";

async function fixCourseRegIds() {
  try {
    console.log("🔧 Starting course_reg.course_id remapping...");
    
    // Get existing course IDs
    const [courses] = await db.query("SELECT id FROM courses ORDER BY id");
    const courseIds = courses.map(c => c.id);
    
    if (courseIds.length === 0) {
      console.log("❌ No courses found in courses table");
      return;
    }
    
    console.log(`📚 Found ${courseIds.length} courses with IDs:`, courseIds);
    
    // Get all course_reg entries
    const [courseRegs] = await db.query("SELECT id, course_id FROM course_reg ORDER BY id");
    console.log(`📝 Found ${courseRegs.length} course_reg entries to remap`);
    
    // Remap course_id values sequentially using existing course IDs
    let updatedCount = 0;
    for (let i = 0; i < courseRegs.length; i++) {
      const newCourseId = courseIds[i % courseIds.length]; // Cycle through available course IDs
      
      await db.query(
        "UPDATE course_reg SET course_id = ? WHERE id = ?",
        { replacements: [newCourseId, courseRegs[i].id] }
      );
      
      updatedCount++;
      if (updatedCount % 100 === 0) {
        console.log(`✅ Updated ${updatedCount} entries...`);
      }
    }
    
    console.log(`🎉 Successfully remapped ${updatedCount} course_reg entries`);
    
    // Verify the fix
    const [verification] = await db.query(`
      SELECT COUNT(*) as count 
      FROM course_reg cr 
      INNER JOIN courses c ON c.id = cr.course_id
    `);
    
    console.log(`🔍 Verification: ${verification[0].count} course_reg entries now have valid course references`);
    
  } catch (error) {
    console.error("❌ Error fixing course_reg IDs:", error);
  } finally {
    await db.close();
    process.exit(0);
  }
}

fixCourseRegIds();

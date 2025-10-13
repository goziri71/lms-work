import { connectDB } from "./src/database/database.js";
import {
  QuestionBank,
  QuestionObjective,
  QuestionTheory,
  Exam,
  ExamItem,
  ExamAttempt,
  ExamAnswerObjective,
  ExamAnswerTheory,
  setupExamAssociations,
} from "./src/models/exams/index.js";
import { VideoCall, VideoCallParticipant } from "./src/models/video/index.js";

async function syncTables() {
  try {
    console.log("🔄 Connecting to databases...");
    await connectDB();

    console.log("\n📊 Setting up exam associations...");
    setupExamAssociations();

    console.log("\n📊 Syncing video tables to Library DB (skip if exists)...");
    await VideoCall.sync({ force: false });
    console.log("✅ video_calls table synced to Library DB");
    await VideoCallParticipant.sync({ force: false });
    console.log("✅ video_call_participants table synced to Library DB");

    console.log("\n📊 Syncing exam bank tables to Library DB...");
    await QuestionBank.sync({ alter: true });
    console.log("✅ question_bank table synced");
    await QuestionObjective.sync({ alter: true });
    console.log("✅ question_objective table synced");
    await QuestionTheory.sync({ alter: true });
    console.log("✅ question_theory table synced");

    console.log("\n📊 Syncing exam definition tables...");
    await Exam.sync({ alter: true });
    console.log("✅ exams table synced");
    await ExamItem.sync({ alter: true });
    console.log("✅ exam_items table synced");

    console.log("\n📊 Syncing exam delivery tables...");
    await ExamAttempt.sync({ alter: true });
    console.log("✅ exam_attempts table synced");
    await ExamAnswerObjective.sync({ alter: true });
    console.log("✅ exam_answers_objective table synced");
    await ExamAnswerTheory.sync({ alter: true });
    console.log("✅ exam_answers_theory table synced");

    console.log("\n🎉 All exam tables synced successfully to Library DB!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error syncing tables:", error);
    process.exit(1);
  }
}

syncTables();

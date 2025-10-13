import {
  QuestionBank,
  QuestionObjective,
  QuestionTheory,
} from "../models/exams/index.js";

/**
 * Sync a quiz question to the exam bank
 * Call this whenever a quiz question is created or updated
 */
export async function syncQuizQuestionToBank(quizQuestion, quizOptions = []) {
  try {
    const {
      id: quizQuestionId,
      quiz_id,
      question_text,
      question_type,
      points,
      correct_answer,
      image_url,
      video_url,
    } = quizQuestion;

    // Get quiz metadata to find course_id and created_by
    const { Quiz } = await import("../models/modules/quiz.js");
    const quiz = await Quiz.findByPk(quiz_id, {
      attributes: ["module_id", "created_by"],
    });
    if (!quiz) return null;

    const { Modules } = await import("../models/modules/modules.js");
    const module = await Modules.findByPk(quiz.module_id, {
      attributes: ["course_id"],
    });
    if (!module) return null;

    const course_id = module.course_id;
    const created_by = quiz.created_by;

    // Check if already in bank (by source_id)
    let bankQuestion = await QuestionBank.findOne({
      where: { source_type: "quiz", source_id: quizQuestionId },
    });

    const bankType =
      question_type === "multiple_choice" ? "objective" : "theory";
    const difficulty = points <= 2 ? "easy" : points <= 4 ? "medium" : "hard";

    if (bankQuestion) {
      // Update existing
      await bankQuestion.update({
        question_type: bankType,
        difficulty,
        status: "approved", // auto-approve quiz questions
      });
    } else {
      // Create new
      bankQuestion = await QuestionBank.create({
        course_id,
        created_by,
        question_type: bankType,
        difficulty,
        status: "approved",
        source_type: "quiz",
        source_id: quizQuestionId,
      });
    }

    // Sync the specific question content
    if (bankType === "objective") {
      // Skip if no correct answer is set (invalid question)
      if (!correct_answer) {
        console.warn(
          `⚠️  Skipping objective question ${quizQuestionId} - no correct answer set`
        );
        return null;
      }

      // Map quiz options to exam bank format
      const options = quizOptions.map((opt) => ({
        id: opt.id.toString(),
        text: opt.option_text,
      }));

      let objQuestion = await QuestionObjective.findOne({
        where: { question_bank_id: bankQuestion.id },
      });

      if (objQuestion) {
        await objQuestion.update({
          question_text,
          options,
          correct_option: correct_answer,
          marks: points || 1,
          image_url,
          video_url,
        });
      } else {
        await QuestionObjective.create({
          question_bank_id: bankQuestion.id,
          question_text,
          options,
          correct_option: correct_answer,
          marks: points || 1,
          image_url,
          video_url,
        });
      }
    } else {
      // Theory question
      let theoryQuestion = await QuestionTheory.findOne({
        where: { question_bank_id: bankQuestion.id },
      });

      if (theoryQuestion) {
        await theoryQuestion.update({
          question_text,
          max_marks: points || 5,
          image_url,
          video_url,
        });
      } else {
        await QuestionTheory.create({
          question_bank_id: bankQuestion.id,
          question_text,
          max_marks: points || 5,
          image_url,
          video_url,
        });
      }
    }

    return bankQuestion;
  } catch (error) {
    console.error("Error syncing quiz question to bank:", error);
    return null;
  }
}

/**
 * Delete a question from the exam bank when quiz question is deleted
 */
export async function deleteQuizQuestionFromBank(quizQuestionId) {
  try {
    const bankQuestion = await QuestionBank.findOne({
      where: { source_type: "quiz", source_id: quizQuestionId },
    });

    if (bankQuestion) {
      // Cascade delete will handle objective/theory records
      await bankQuestion.destroy();
      console.log(`Deleted question ${quizQuestionId} from exam bank`);
    }
  } catch (error) {
    console.error("Error deleting quiz question from bank:", error);
  }
}

/**
 * Bulk import existing quiz questions to the bank (one-time migration)
 */
export async function bulkImportQuizzesToBank(courseId = null) {
  try {
    const { Quiz } = await import("../models/modules/quiz.js");
    const { QuizQuestions } = await import(
      "../models/modules/quiz_questions.js"
    );
    const { QuizOptions } = await import("../models/modules/quiz_options.js");
    const { Modules } = await import("../models/modules/modules.js");

    const moduleWhere = courseId ? { course_id: courseId } : {};
    const modules = await Modules.findAll({
      where: moduleWhere,
      attributes: ["id", "course_id"],
    });
    const moduleIds = modules.map((m) => m.id);

    if (moduleIds.length === 0) {
      console.log("No modules found");
      return { imported: 0 };
    }

    const quizzes = await Quiz.findAll({
      where: { module_id: moduleIds },
      include: [
        {
          model: QuizQuestions,
          as: "questions",
          include: [{ model: QuizOptions, as: "options" }],
        },
      ],
    });

    let imported = 0;
    for (const quiz of quizzes) {
      for (const question of quiz.questions || []) {
        await syncQuizQuestionToBank(question, question.options || []);
        imported++;
      }
    }

    console.log(`✅ Bulk imported ${imported} quiz questions to exam bank`);
    return { imported };
  } catch (error) {
    console.error("Error bulk importing quizzes:", error);
    return { imported: 0, error: error.message };
  }
}

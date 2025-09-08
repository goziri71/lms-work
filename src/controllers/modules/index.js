import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { Modules } from "../../models/modules/modules.js";
import { Units } from "../../models/modules/units.js";
import { Courses } from "../../models/course/courses.js";
import multer from "multer";
import { supabase } from "../../utils/supabase.js";
import { UnitNotes } from "../../models/modules/unit_notes.js";
import { dbLibrary } from "../../database/database.js";
import {
  Discussions,
  DiscussionMessages,
} from "../../models/modules/discussions.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024 * 1024 }, // up to 1GB
});

export const uploadMiddleware = upload.single("video");

// Create a module (Library DB) tied to an LMS course
export const createModule = TryCatchFunction(async (req, res) => {
  const staffId = Number(req.user?.id ?? req.user);
  console.log(staffId);
  const { course_id, title, description, status } = req.body;

  if (!Number.isInteger(staffId) || staffId <= 0) {
    throw new ErrorClass("Unauthorized", 401);
  }
  if (!course_id || !title) {
    throw new ErrorClass("course_id and title are required", 400);
  }

  const course = await Courses.findByPk(course_id);
  console.log(course);
  console.log(course.staff_id);
  if (!course) {
    throw new ErrorClass("Course not found", 404);
  }
  if (course.staff_id !== staffId) {
    throw new ErrorClass("You do not own this course", 403);
  }

  const moduleRecord = await Modules.create({
    course_id,
    title,
    description: description ?? "",
    status: status ?? "draft",
    created_by: staffId,
    updated_by: staffId,
  });

  res.status(201).json({
    status: true,
    code: 201,
    message: "Module created",
    data: moduleRecord,
  });
});

// List modules for a course (Library DB)
export const getModulesByCourse = TryCatchFunction(async (req, res) => {
  const staffId = Number(req.user?.id ?? req.user);
  const courseId = Number(req.params.courseId);

  if (!Number.isInteger(courseId) || courseId <= 0) {
    throw new ErrorClass("Invalid course id", 400);
  }

  const course = await Courses.findByPk(courseId);
  if (!course) {
    throw new ErrorClass("Course not found", 404);
  }
  // Optional: restrict staff to own courses
  if (Number.isInteger(staffId) && staffId > 0 && course.staff_id !== staffId) {
    throw new ErrorClass("You do not own this course", 403);
  }

  const modules = await Modules.findAll({ where: { course_id: courseId } });
  res.status(200).json({
    status: true,
    code: 200,
    message: "Modules fetched successfully",
    data: modules,
  });
});

// Update a module
export const updateModule = TryCatchFunction(async (req, res) => {
  const staffId = Number(req.user?.id ?? req.user);
  const moduleId = Number(req.params.moduleId);
  const updates = req.body || {};

  if (!Number.isInteger(moduleId) || moduleId <= 0) {
    throw new ErrorClass("Invalid module id", 400);
  }

  const moduleRecord = await Modules.findByPk(moduleId);
  if (!moduleRecord) {
    throw new ErrorClass("Module not found", 404);
  }

  const course = await Courses.findByPk(moduleRecord.course_id);
  if (!course) {
    throw new ErrorClass("Course not found", 404);
  }
  if (course.staff_id !== staffId) {
    throw new ErrorClass("You do not own this course", 403);
  }

  // Protect immutable fields
  delete updates.id;
  delete updates.course_id;
  updates.updated_by = staffId;

  await moduleRecord.update(updates);

  res.status(200).json({
    status: true,
    code: 200,
    message: "Module updated",
    data: moduleRecord,
  });
});

// Delete a module (will cascade to units via Library DB association)
export const deleteModule = TryCatchFunction(async (req, res) => {
  const staffId = Number(req.user?.id ?? req.user);
  const moduleId = Number(req.params.moduleId);

  if (!Number.isInteger(moduleId) || moduleId <= 0) {
    throw new ErrorClass("Invalid module id", 400);
  }

  const moduleRecord = await Modules.findByPk(moduleId);
  if (!moduleRecord) {
    throw new ErrorClass("Module not found", 404);
  }

  const course = await Courses.findByPk(moduleRecord.course_id);
  if (!course) {
    throw new ErrorClass("Course not found", 404);
  }
  if (course.staff_id !== staffId) {
    throw new ErrorClass("You do not own this course", 403);
  }

  // Ensure we remove all related data: units and unit_notes
  await dbLibrary.transaction(async (t) => {
    const units = await Units.findAll({
      where: { module_id: moduleId },
      transaction: t,
    });
    const unitIds = units.map((u) => u.id);

    if (unitIds.length > 0) {
      // Delete notes associated with units in this module
      await UnitNotes.destroy({ where: { unit_id: unitIds }, transaction: t });
      // Delete units themselves
      await Units.destroy({ where: { module_id: moduleId }, transaction: t });
    }

    // Finally delete the module
    await moduleRecord.destroy({ transaction: t });
  });

  res.status(200).json({
    status: true,
    code: 200,
    message: "Module deleted",
  });
});

// Units Controllers
export const createUnit = TryCatchFunction(async (req, res) => {
  const staffId = Number(req.user?.id ?? req.user);
  const { module_id, title, content, content_type, order, status } = req.body;

  if (!module_id || !title) {
    throw new ErrorClass("module_id and title are required", 400);
  }

  const moduleRecord = await Modules.findByPk(module_id);
  if (!moduleRecord) {
    throw new ErrorClass("Module not found", 404);
  }

  const course = await Courses.findByPk(moduleRecord.course_id);
  if (!course) {
    throw new ErrorClass("Course not found", 404);
  }
  if (course.staff_id !== staffId) {
    throw new ErrorClass("You do not own this course", 403);
  }

  const unit = await Units.create({
    module_id,
    title,
    content: content ?? null,
    content_type: content_type ?? "html",
    order: order ?? 1,
    status: status ?? "draft",
    created_by: staffId,
    updated_by: staffId,
  });

  res.status(201).json({
    status: true,
    code: 201,
    message: "Unit created",
    data: unit,
  });
});

export const getUnitsByModule = TryCatchFunction(async (req, res) => {
  const staffId = Number(req.user?.id ?? req.user);
  const moduleId = Number(req.params.moduleId);

  if (!Number.isInteger(moduleId) || moduleId <= 0) {
    throw new ErrorClass("Invalid module id", 400);
  }

  const moduleRecord = await Modules.findByPk(moduleId);
  if (!moduleRecord) {
    throw new ErrorClass("Module not found", 404);
  }

  const course = await Courses.findByPk(moduleRecord.course_id);
  if (!course) {
    throw new ErrorClass("Course not found", 404);
  }
  if (Number.isInteger(staffId) && staffId > 0 && course.staff_id !== staffId) {
    throw new ErrorClass("You do not own this course", 403);
  }

  const units = await Units.findAll({ where: { module_id: moduleId } });
  res.status(200).json({
    status: true,
    code: 200,
    message: "Units fetched successfully",
    data: units,
  });
});

export const updateUnit = TryCatchFunction(async (req, res) => {
  const staffId = Number(req.user?.id ?? req.user);
  const unitId = Number(req.params.unitId);
  const updates = req.body || {};

  if (!Number.isInteger(unitId) || unitId <= 0) {
    throw new ErrorClass("Invalid unit id", 400);
  }

  const unit = await Units.findByPk(unitId);
  if (!unit) {
    throw new ErrorClass("Unit not found", 404);
  }

  const moduleRecord = await Modules.findByPk(unit.module_id);
  const course = await Courses.findByPk(moduleRecord.course_id);
  if (course.staff_id !== staffId) {
    throw new ErrorClass("You do not own this course", 403);
  }

  delete updates.id;
  delete updates.module_id;
  updates.updated_by = staffId;

  await unit.update(updates);

  res.status(200).json({
    status: true,
    code: 200,
    message: "Unit updated",
    data: unit,
  });
});

export const deleteUnit = TryCatchFunction(async (req, res) => {
  const staffId = Number(req.user?.id ?? req.user);
  const unitId = Number(req.params.unitId);

  if (!Number.isInteger(unitId) || unitId <= 0) {
    throw new ErrorClass("Invalid unit id", 400);
  }

  const unit = await Units.findByPk(unitId);
  if (!unit) {
    throw new ErrorClass("Unit not found", 404);
  }

  const moduleRecord = await Modules.findByPk(unit.module_id);
  const course = await Courses.findByPk(moduleRecord.course_id);
  if (course.staff_id !== staffId) {
    throw new ErrorClass("You do not own this course", 403);
  }

  await unit.destroy();

  res.status(200).json({
    status: true,
    code: 200,
    message: "Unit deleted",
  });
});

// Upload video to Supabase and set unit.video_url
export const uploadUnitVideo = TryCatchFunction(async (req, res) => {
  const staffId = Number(req.user?.id ?? req.user);
  const moduleId = Number(req.params.moduleId);
  const unitId = Number(req.params.unitId);

  if (
    !Number.isInteger(moduleId) ||
    moduleId <= 0 ||
    !Number.isInteger(unitId) ||
    unitId <= 0
  ) {
    throw new ErrorClass("Invalid module or unit id", 400);
  }

  const moduleRecord = await Modules.findByPk(moduleId);
  if (!moduleRecord) throw new ErrorClass("Module not found", 404);
  const course = await Courses.findByPk(moduleRecord.course_id);
  if (!course) throw new ErrorClass("Course not found", 404);
  if (course.staff_id !== staffId)
    throw new ErrorClass("You do not own this course", 403);

  const unit = await Units.findByPk(unitId);
  if (!unit || unit.module_id !== moduleId)
    throw new ErrorClass("Unit not found in module", 404);

  if (!req.file) {
    throw new ErrorClass("video file is required (field name 'video')", 400);
  }

  const bucket = process.env.VIDEOS_BUCKET || "lmsvideo";
  const ext = (req.file.mimetype?.split("/")[1] || "mp4").toLowerCase();
  const objectPath = `videos/original/${unitId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(objectPath, req.file.buffer, {
      contentType: req.file.mimetype,
      upsert: true,
    });
  if (error) {
    throw new ErrorClass(`Upload failed: ${error.message}`, 500);
  }

  const publicUrl = supabase.storage.from(bucket).getPublicUrl(objectPath)
    .data.publicUrl;
  await unit.update({ video_url: publicUrl });

  res.status(200).json({
    status: true,
    code: 200,
    message: "Video uploaded",
    data: { video_url: publicUrl },
  });
});

// ========== Unit Notes (student) ==========
export const upsertUnitNote = TryCatchFunction(async (req, res) => {
  const studentId = Number(req.user?.id ?? req.user);
  const unitId = Number(req.params.unitId || req.body.unit_id);
  const { note_text } = req.body;
  if (!Number.isInteger(studentId) || studentId <= 0) {
    throw new ErrorClass("Unauthorized or invalid user id", 401);
  }
  if (!Number.isInteger(unitId) || unitId <= 0 || !note_text) {
    throw new ErrorClass("unit_id and note_text are required", 400);
  }
  const [note] = await UnitNotes.upsert({
    unit_id: unitId,
    student_id: studentId,
    note_text,
  });
  res
    .status(200)
    .json({ status: true, code: 200, message: "Note saved", data: note });
});

export const getUnitNote = TryCatchFunction(async (req, res) => {
  const studentId = Number(req.user?.id ?? req.user);
  const unitId = Number(req.params.unitId);
  const note = await UnitNotes.findOne({
    where: { unit_id: unitId, student_id: studentId },
  });
  res
    .status(200)
    .json({ status: true, code: 200, message: "Note fetched", data: note });
});

export const deleteUnitNote = TryCatchFunction(async (req, res) => {
  const studentId = Number(req.user?.id ?? req.user);
  const unitId = Number(req.params.unitId);
  await UnitNotes.destroy({
    where: { unit_id: unitId, student_id: studentId },
  });
  res.status(200).json({ status: true, code: 200, message: "Note deleted" });
});

// ========== Discussions ==========
export const listDiscussions = TryCatchFunction(async (req, res) => {
  const { course_id, academic_year, semester } = req.query;
  if (!course_id || !academic_year || !semester) {
    throw new ErrorClass(
      "course_id, academic_year, semester are required",
      400
    );
  }
  const items = await Discussions.findAll({
    where: { course_id, academic_year, semester },
  });
  res.status(200).json({
    status: true,
    code: 200,
    message: "Discussions fetched",
    data: items,
  });
});

export const createDiscussion = TryCatchFunction(async (req, res) => {
  const staffId = Number(req.user?.id ?? req.user);
  const { course_id, academic_year, semester } = req.body;
  if (!course_id || !academic_year || !semester) {
    throw new ErrorClass(
      "course_id, academic_year, semester are required",
      400
    );
  }
  const course = await Courses.findByPk(course_id);
  if (!course || course.staff_id !== staffId)
    throw new ErrorClass("Unauthorized", 403);
  const disc = await Discussions.create({
    course_id,
    academic_year,
    semester,
    created_by_staff_id: staffId,
  });
  res.status(201).json({
    status: true,
    code: 201,
    message: "Discussion created",
    data: disc,
  });
});

export const listDiscussionMessages = TryCatchFunction(async (req, res) => {
  const discussionId = Number(req.params.discussionId);
  const msgs = await DiscussionMessages.findAll({
    where: { discussion_id: discussionId },
    order: [["created_at", "ASC"]],
  });
  res
    .status(200)
    .json({ status: true, code: 200, message: "Messages fetched", data: msgs });
});

export const postDiscussionMessage = TryCatchFunction(async (req, res) => {
  const user = req.user;
  const discussionId = Number(req.params.discussionId);
  const { message_text } = req.body;
  if (!message_text) throw new ErrorClass("message_text is required", 400);
  const sender_type = user.userType === "staff" ? "staff" : "student";
  const sender_id = Number(user.id);
  const msg = await DiscussionMessages.create({
    discussion_id: discussionId,
    sender_type,
    sender_id,
    message_text,
  });
  res
    .status(201)
    .json({ status: true, code: 201, message: "Message posted", data: msg });
});

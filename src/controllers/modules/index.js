import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { Modules } from "../../models/modules/modules.js";
import { Units } from "../../models/modules/units.js";
import { Courses } from "../../models/course/courses.js";

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

  await moduleRecord.destroy();

  res.status(200).json({
    status: true,
    code: 200,
    message: "Module deleted",
  });
});

// Units Controllers
export const createUnit = TryCatchFunction(async (req, res) => {
  const staffId = Number(req.user?.id ?? req.user);
  const {
    module_id,
    title,
    content,
    content_type,
    order,
    duration_min,
    status,
  } = req.body;

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
    duration_min: duration_min ?? null,
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

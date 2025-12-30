import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { Modules } from "../../models/modules/modules.js";
import { Units } from "../../models/modules/units.js";
import { Courses } from "../../models/course/courses.js";
import multer from "multer";
import { supabase } from "../../utils/supabase.js";
import { UnitNotes } from "../../models/modules/unit_notes.js";
import { dbLibrary } from "../../database/database.js";
import { Op } from "sequelize";
import { db } from "../../database/database.js";
import {
  Discussions,
  DiscussionMessages,
} from "../../models/modules/discussions.js";
import {
  canAccessCourse,
  getCreatorId,
} from "../../utils/examAccessControl.js";
import { logAdminActivity } from "../../middlewares/adminAuthorize.js";

// Helper function to normalize userType (handle admin with super_admin role)
function normalizeUserType(req) {
  let userType = req.user?.userType;
  // If userType is "admin" but role is "super_admin", treat as super_admin
  if (userType === "admin" && req.user?.role === "super_admin") {
    userType = "super_admin";
  }
  // If userType is undefined/null, try to infer from role
  if (!userType && req.user?.role === "super_admin") {
    userType = "super_admin";
  }
  if (!userType && req.user?.role === "wpu_admin") {
    userType = "admin";
  }
  return userType;
}

// Helper function to extract base64 images from HTML and upload to Supabase
const processHtmlImages = async (htmlContent, unitId) => {
  if (!htmlContent) return htmlContent;

  // Regex to find base64 images in HTML
  const base64ImageRegex =
    /<img[^>]+src="data:image\/([^;]+);base64,([^"]+)"[^>]*>/g;
  let processedHtml = htmlContent;
  const matches = [...htmlContent.matchAll(base64ImageRegex)];

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const [fullMatch, imageType, base64Data] = match;

    try {
      // Convert base64 to buffer
      const imageBuffer = Buffer.from(base64Data, "base64");

      // Upload to same bucket as videos but in images folder
      const bucket = process.env.VIDEOS_BUCKET || "lmsvideo";
      const objectPath = `images/units/${unitId}/image_${i}_${Date.now()}.${imageType}`;

      const { error } = await supabase.storage
        .from(bucket)
        .upload(objectPath, imageBuffer, {
          contentType: `image/${imageType}`,
          upsert: true,
        });

      if (!error) {
        const publicUrl = supabase.storage.from(bucket).getPublicUrl(objectPath)
          .data.publicUrl;
        // Replace base64 with URL in HTML
        processedHtml = processedHtml.replace(
          fullMatch,
          fullMatch.replace(/src="[^"]*"/, `src="${publicUrl}"`)
        );
      } else {
        console.error(`Failed to upload image ${i}:`, error);
      }
    } catch (err) {
      console.error(`Error processing image ${i}:`, err);
    }
  }

  return processedHtml;
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024 * 1024 }, // up to 1GB
});

export const uploadMiddleware = upload.single("video");

// Create a module (Library DB) tied to an LMS course
export const createModule = TryCatchFunction(async (req, res) => {
  const userId = Number(req.user?.id);
  let userType = normalizeUserType(req);
  const { course_id, title, description, status } = req.body;

  if (!Number.isInteger(userId) || userId <= 0) {
    throw new ErrorClass("Unauthorized", 401);
  }
  if (!course_id || !title) {
    throw new ErrorClass("course_id and title are required", 400);
  }

  const course = await Courses.findByPk(course_id);
  if (!course) {
    throw new ErrorClass("Course not found", 404);
  }

  // Verify user can access the course (admin can access all, staff only their own)
  // If userType is undefined/null, check if it's staff by course ownership
  if (!userType) {
    // Fallback: check if user is staff by course ownership
    if (course.staff_id === userId) {
      userType = "staff";
    } else {
      throw new ErrorClass("Unauthorized - user type not recognized", 401);
    }
  }

  const hasAccess = await canAccessCourse(userType, userId, course_id);
  if (!hasAccess) {
    throw new ErrorClass(
      "You do not have permission to create module for this course",
      403
    );
  }

  // Get creator ID (admin ID for admins, staff ID for staff)
  const creatorId = getCreatorId(userType, userId);

  const moduleRecord = await Modules.create({
    course_id,
    title,
    description: description ?? "",
    status: status ?? "draft",
    created_by: creatorId,
    updated_by: creatorId,
  });

  // Log admin activity if created by admin
  if (userType === "admin" || userType === "super_admin") {
    try {
      await logAdminActivity(
        userId,
        "created_module",
        "module",
        moduleRecord.id,
        {
          course_id: course_id,
          title: title,
        }
      );
    } catch (logError) {
      console.error("Error logging admin activity:", logError);
    }
  }

  res.status(201).json({
    status: true,
    code: 201,
    message: "Module created",
    data: moduleRecord,
  });
});

// List modules for a course (Library DB)
export const getModulesByCourse = TryCatchFunction(async (req, res) => {
  const userId = Number(req.user?.id);
  let userType = normalizeUserType(req);
  const courseId = Number(req.params.courseId);

  if (!Number.isInteger(courseId) || courseId <= 0) {
    throw new ErrorClass("Invalid course id", 400);
  }

  const course = await Courses.findByPk(courseId);
  if (!course) {
    throw new ErrorClass("Course not found", 404);
  }
  // Authorization: support current middleware where req.user is numeric id
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new ErrorClass("Unauthorized", 401);
  }

  // Admins can access all courses
  let authorized = false;
  if (userType === "admin" || userType === "super_admin") {
    authorized = true;
  }
  // Staff path: owner of the course
  else if (course.staff_id === userId) {
    authorized = true;
  }
  // Student path: enrolled via course_reg
  else {
    const [rows] = await db.query(
      "SELECT 1 FROM course_reg WHERE course_id = :courseId AND student_id = :studentId LIMIT 1",
      { replacements: { courseId, studentId: userId } }
    );
    if (Array.isArray(rows) && rows.length > 0) {
      authorized = true;
    }
  }
  if (!authorized) {
    throw new ErrorClass("Unauthorized", 401);
  }

  const modules = await Modules.findAll({
    where: { course_id: courseId },
    include: [
      {
        model: Units,
        as: "units",
        required: false,
        order: [["created_at", "ASC"], ["id", "ASC"]],
      },
    ],
    order: [["created_at", "ASC"], ["id", "ASC"]],
  });
  res.status(200).json({
    status: true,
    code: 200,
    message: "Modules fetched successfully",
    data: modules,
  });
});

// Update a module
export const updateModule = TryCatchFunction(async (req, res) => {
  const userId = Number(req.user?.id);
  let userType = normalizeUserType(req);
  const moduleId = Number(req.params.moduleId);
  const updates = req.body || {};

  if (!Number.isInteger(userId) || userId <= 0) {
    throw new ErrorClass("Unauthorized", 401);
  }
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

  // Verify user can access the course (admin can access all, staff only their own)
  const hasAccess = await canAccessCourse(
    userType,
    userId,
    moduleRecord.course_id
  );
  if (!hasAccess) {
    throw new ErrorClass(
      "You do not have permission to update this module",
      403
    );
  }

  // Protect immutable fields
  delete updates.id;
  delete updates.course_id;
  updates.updated_by = getCreatorId(userType, userId);

  const originalValues = {
    title: moduleRecord.title,
    description: moduleRecord.description,
    status: moduleRecord.status,
  };

  await moduleRecord.update(updates);

  // Log admin activity if admin modified staff-created module
  if (
    (userType === "admin" || userType === "super_admin") &&
    moduleRecord.created_by !== userId
  ) {
    try {
      await logAdminActivity(userId, "updated_module", "module", moduleId, {
        course_id: moduleRecord.course_id,
        original_creator_id: moduleRecord.created_by,
        changes: {
          before: originalValues,
          after: {
            title: updates.title || originalValues.title,
            description:
              updates.description !== undefined
                ? updates.description
                : originalValues.description,
            status: updates.status || originalValues.status,
          },
        },
      });
    } catch (logError) {
      console.error("Error logging admin activity:", logError);
    }
  }

  res.status(200).json({
    status: true,
    code: 200,
    message: "Module updated",
    data: moduleRecord,
  });
});

// Delete a module (will cascade to units via Library DB association)
export const deleteModule = TryCatchFunction(async (req, res) => {
  const userId = Number(req.user?.id);
  let userType = normalizeUserType(req);
  const moduleId = Number(req.params.moduleId);

  if (!Number.isInteger(userId) || userId <= 0) {
    throw new ErrorClass("Unauthorized", 401);
  }
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

  // Verify user can access the course (admin can access all, staff only their own)
  const hasAccess = await canAccessCourse(
    userType,
    userId,
    moduleRecord.course_id
  );
  if (!hasAccess) {
    throw new ErrorClass(
      "You do not have permission to delete this module",
      403
    );
  }

  const moduleInfo = {
    id: moduleRecord.id,
    title: moduleRecord.title,
    course_id: moduleRecord.course_id,
    created_by: moduleRecord.created_by,
  };

  // Log admin activity if admin deleted staff-created module
  if (
    (userType === "admin" || userType === "super_admin") &&
    moduleRecord.created_by !== userId
  ) {
    try {
      await logAdminActivity(userId, "deleted_module", "module", moduleId, {
        course_id: moduleRecord.course_id,
        title: moduleRecord.title,
        original_creator_id: moduleRecord.created_by,
      });
    } catch (logError) {
      console.error("Error logging admin activity:", logError);
    }
  }

  // Ensure we remove all related data: units and unit_notes
  await dbLibrary.transaction(async (t) => {
    const units = await Units.findAll({
      where: { module_id: moduleId },
      transaction: t,
    });

    // Delete notes associated with this module (notes are module-level, not unit-level)
    await UnitNotes.destroy({
      where: { module_id: moduleId },
      transaction: t,
    });

    // Cleanup Supabase storage for each unit (videos and images)
    const bucket = process.env.VIDEOS_BUCKET || "lmsvideo";
    for (const unit of units) {
      // Remove video file if present
      if (unit.video_url) {
        try {
          const url = unit.video_url;
          const marker = `/storage/v1/object/public/${bucket}/`;
          const idx = url.indexOf(marker);
          if (idx !== -1) {
            const objectPath = url.substring(idx + marker.length);
            await supabase.storage.from(bucket).remove([objectPath]);
          }
        } catch (e) {
          console.warn(
            "Failed to remove unit video from storage:",
            e?.message || e
          );
        }
      }
      // Remove any images under images/units/<unitId>/
      try {
        const folder = `images/units/${unit.id}`;
        const { data: files } = await supabase.storage
          .from(bucket)
          .list(folder, { limit: 100 });
        if (Array.isArray(files) && files.length > 0) {
          const paths = files.map((f) => `${folder}/${f.name}`);
          await supabase.storage.from(bucket).remove(paths);
        }
      } catch (e) {
        console.warn(
          "Failed to remove unit images from storage:",
          e?.message || e
        );
      }
    }
    // Delete units themselves
    await Units.destroy({ where: { module_id: moduleId }, transaction: t });

    // Finally delete the module
    await moduleRecord.destroy({ transaction: t });
  });

  res.status(200).json({
    status: true,
    code: 200,
    message: "Module deleted",
  });
});

export const createUnit = TryCatchFunction(async (req, res) => {
  const userId = Number(req.user?.id);
  let userType = normalizeUserType(req);
  const { module_id, title, content, content_type, order, status } = req.body;

  if (!Number.isInteger(userId) || userId <= 0) {
    throw new ErrorClass("Unauthorized", 401);
  }
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

  // Verify user can access the course (admin can access all, staff only their own)
  // If userType is undefined/null, check if it's staff by course ownership
  if (!userType) {
    // Fallback: check if user is staff by course ownership
    if (course.staff_id === userId) {
      userType = "staff";
    } else {
      throw new ErrorClass("Unauthorized - user type not recognized", 401);
    }
  }

  const hasAccess = await canAccessCourse(
    userType,
    userId,
    moduleRecord.course_id
  );
  if (!hasAccess) {
    throw new ErrorClass(
      "You do not have permission to create unit for this course",
      403
    );
  }

  // Get creator ID (admin ID for admins, staff ID for staff)
  const creatorId = getCreatorId(userType, userId);

  // Create unit first to get ID for image uploads
  const unit = await Units.create({
    module_id,
    title,
    content: null, // We'll update this after processing images
    content_type: content_type ?? "html",
    order: order ?? 1,
    status: status ?? "draft",
    created_by: creatorId,
    updated_by: creatorId,
  });

  // Process images if content exists and is HTML
  let processedContent = content ?? null;
  if (content && (content_type === "html" || !content_type)) {
    processedContent = await processHtmlImages(content, unit.id);
  }

  // Update unit with processed content (with image URLs)
  await unit.update({ content: processedContent });

  // Log admin activity if created by admin
  if (userType === "admin" || userType === "super_admin") {
    try {
      await logAdminActivity(userId, "created_unit", "unit", unit.id, {
        module_id: module_id,
        course_id: moduleRecord.course_id,
        title: title,
      });
    } catch (logError) {
      console.error("Error logging admin activity:", logError);
    }
  }

  res.status(201).json({
    status: true,
    code: 201,
    message: "Unit created",
    data: unit,
  });
});

// // Units Controllers
// export const createUnit = TryCatchFunction(async (req, res) => {
//   const staffId = Number(req.user?.id);
//   const { module_id, title, content, content_type, order, status } = req.body;

//   if (!module_id || !title) {
//     throw new ErrorClass("module_id and title are required", 400);
//   }

//   const moduleRecord = await Modules.findByPk(module_id);
//   if (!moduleRecord) {
//     throw new ErrorClass("Module not found", 404);
//   }

//   const course = await Courses.findByPk(moduleRecord.course_id);
//   if (!course) {
//     throw new ErrorClass("Course not found", 404);
//   }
//   if (course.staff_id !== staffId) {
//     throw new ErrorClass("You do not own this course", 403);
//   }

//   const unit = await Units.create({
//     module_id,
//     title,
//     content: content ?? null,
//     content_type: content_type ?? "html",
//     order: order ?? 1,
//     status: status ?? "draft",
//     created_by: staffId,
//     updated_by: staffId,
//   });

//   res.status(201).json({
//     status: true,
//     code: 201,
//     message: "Unit created",
//     data: unit,
//   });
// });

export const getUnitsByModule = TryCatchFunction(async (req, res) => {
  const userId = Number(req.user?.id);
  let userType = normalizeUserType(req);
  const moduleId = Number(req.params.moduleId);

  if (!Number.isInteger(userId) || userId <= 0) {
    throw new ErrorClass("Unauthorized", 401);
  }
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

  // Verify user can access the course (admin can access all, staff only their own)
  const hasAccess = await canAccessCourse(
    userType,
    userId,
    moduleRecord.course_id
  );
  if (!hasAccess) {
    throw new ErrorClass(
      "You do not have permission to view units for this course",
      403
    );
  }

  const units = await Units.findAll({
    where: { module_id: moduleId },
    order: [["created_at", "ASC"], ["id", "ASC"]],
  });
  res.status(200).json({
    status: true,
    code: 200,
    message: "Units fetched successfully",
    data: units,
  });
});

// Also update the updateUnit function to handle images
export const updateUnit = TryCatchFunction(async (req, res) => {
  const userId = Number(req.user?.id);
  let userType = normalizeUserType(req);
  const unitId = Number(req.params.unitId);
  const updates = req.body || {};

  if (!Number.isInteger(userId) || userId <= 0) {
    throw new ErrorClass("Unauthorized", 401);
  }
  if (!Number.isInteger(unitId) || unitId <= 0) {
    throw new ErrorClass("Invalid unit id", 400);
  }

  const unit = await Units.findByPk(unitId);
  if (!unit) {
    throw new ErrorClass("Unit not found", 404);
  }

  const moduleRecord = await Modules.findByPk(unit.module_id);
  if (!moduleRecord) {
    throw new ErrorClass("Module not found", 404);
  }

  const course = await Courses.findByPk(moduleRecord.course_id);
  if (!course) {
    throw new ErrorClass("Course not found", 404);
  }

  // Verify user can access the course (admin can access all, staff only their own)
  const hasAccess = await canAccessCourse(
    userType,
    userId,
    moduleRecord.course_id
  );
  if (!hasAccess) {
    throw new ErrorClass("You do not have permission to update this unit", 403);
  }

  delete updates.id;
  delete updates.module_id;
  updates.updated_by = getCreatorId(userType, userId);

  const originalValues = {
    title: unit.title,
    content: unit.content,
    status: unit.status,
  };

  // Process images if content is being updated and it's HTML
  if (
    updates.content &&
    (updates.content_type === "html" ||
      unit.content_type === "html" ||
      (!updates.content_type && !unit.content_type))
  ) {
    updates.content = await processHtmlImages(updates.content, unitId);
  }

  await unit.update(updates);

  res.status(200).json({
    status: true,
    code: 200,
    message: "Unit updated",
    data: unit,
  });
});

// export const updateUnit = TryCatchFunction(async (req, res) => {
//   const staffId = Number(req.user?.id);
//   const unitId = Number(req.params.unitId);
//   const updates = req.body || {};

//   if (!Number.isInteger(unitId) || unitId <= 0) {
//     throw new ErrorClass("Invalid unit id", 400);
//   }

//   const unit = await Units.findByPk(unitId);
//   if (!unit) {
//     throw new ErrorClass("Unit not found", 404);
//   }

//   const moduleRecord = await Modules.findByPk(unit.module_id);
//   const course = await Courses.findByPk(moduleRecord.course_id);
//   if (course.staff_id !== staffId) {
//     throw new ErrorClass("You do not own this course", 403);
//   }

//   delete updates.id;
//   delete updates.module_id;
//   updates.updated_by = staffId;

//   await unit.update(updates);

//   res.status(200).json({
//     status: true,
//     code: 200,
//     message: "Unit updated",
//     data: unit,
//   });
// });

export const deleteUnit = TryCatchFunction(async (req, res) => {
  const userId = Number(req.user?.id);
  let userType = normalizeUserType(req);
  const unitId = Number(req.params.unitId);

  if (!Number.isInteger(userId) || userId <= 0) {
    throw new ErrorClass("Unauthorized", 401);
  }
  if (!Number.isInteger(unitId) || unitId <= 0) {
    throw new ErrorClass("Invalid unit id", 400);
  }

  const unit = await Units.findByPk(unitId);
  if (!unit) {
    throw new ErrorClass("Unit not found", 404);
  }

  const moduleRecord = await Modules.findByPk(unit.module_id);
  if (!moduleRecord) {
    throw new ErrorClass("Module not found", 404);
  }

  const course = await Courses.findByPk(moduleRecord.course_id);
  if (!course) {
    throw new ErrorClass("Course not found", 404);
  }

  // Verify user can access the course (admin can access all, staff only their own)
  const hasAccess = await canAccessCourse(
    userType,
    userId,
    moduleRecord.course_id
  );
  if (!hasAccess) {
    throw new ErrorClass("You do not have permission to delete this unit", 403);
  }

  const unitInfo = {
    id: unit.id,
    title: unit.title,
    module_id: unit.module_id,
    course_id: moduleRecord.course_id,
    created_by: unit.created_by,
  };

  // Cleanup associated storage (notes are module-level, not unit-level, so we don't delete them)
  await dbLibrary.transaction(async (t) => {
    const bucket = process.env.VIDEOS_BUCKET || "lmsvideo";
    // Remove video file if present
    if (unit.video_url) {
      try {
        const url = unit.video_url;
        const marker = `/storage/v1/object/public/${bucket}/`;
        const idx = url.indexOf(marker);
        if (idx !== -1) {
          const objectPath = url.substring(idx + marker.length);
          await supabase.storage.from(bucket).remove([objectPath]);
        }
      } catch (e) {
        console.warn(
          "Failed to remove unit video from storage:",
          e?.message || e
        );
      }
    }
    // Remove any images under images/units/<unitId>/
    try {
      const folder = `images/units/${unit.id}`;
      const { data: files } = await supabase.storage
        .from(bucket)
        .list(folder, { limit: 100 });
      if (Array.isArray(files) && files.length > 0) {
        const paths = files.map((f) => `${folder}/${f.name}`);
        await supabase.storage.from(bucket).remove(paths);
      }
    } catch (e) {
      console.warn(
        "Failed to remove unit images from storage:",
        e?.message || e
      );
    }

    await unit.destroy({ transaction: t });
  });

  // Log admin activity if admin deleted staff-created unit
  if (
    (userType === "admin" || userType === "super_admin") &&
    unit.created_by !== userId
  ) {
    try {
      await logAdminActivity(userId, "deleted_unit", "unit", unitId, {
        module_id: unit.module_id,
        course_id: moduleRecord.course_id,
        title: unit.title,
        original_creator_id: unit.created_by,
      });
    } catch (logError) {
      console.error("Error logging admin activity:", logError);
    }
  }

  res.status(200).json({
    status: true,
    code: 200,
    message: "Unit deleted",
  });
});

// Upload video to Supabase and set unit.video_url
export const uploadUnitVideo = TryCatchFunction(async (req, res) => {
  const userId = Number(req.user?.id);
  let userType = normalizeUserType(req);
  const moduleId = Number(req.params.moduleId);
  const unitId = Number(req.params.unitId);

  if (!Number.isInteger(userId) || userId <= 0) {
    throw new ErrorClass("Unauthorized", 401);
  }
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

  // Verify user can access the course (admin can access all, staff only their own)
  // If userType is undefined/null, check if it's staff by course ownership
  if (!userType) {
    // Fallback: check if user is staff by course ownership
    if (course.staff_id === userId) {
      userType = "staff";
    } else {
      throw new ErrorClass("Unauthorized - user type not recognized", 401);
    }
  }

  const hasAccess = await canAccessCourse(
    userType,
    userId,
    moduleRecord.course_id
  );
  if (!hasAccess) {
    throw new ErrorClass(
      "You do not have permission to upload video for this course",
      403
    );
  }

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

// ========== Module Notes (student) ==========
export const upsertModuleNote = TryCatchFunction(async (req, res) => {
  const studentId = Number(req.user?.id);
  const moduleId = Number(req.params.moduleId || req.body.module_id);
  const { note_text, title } = req.body;

  if (!Number.isInteger(studentId) || studentId <= 0) {
    throw new ErrorClass("Unauthorized or invalid user id", 401);
  }

  if (!Number.isInteger(moduleId) || moduleId <= 0 || !note_text) {
    throw new ErrorClass("module_id and note_text are required", 400);
  }

  // if (!title || !note_text) {
  //   throw new ErrorClass("title and note_text are required", 400);
  // }

  const note = await UnitNotes.create({
    module_id: moduleId,
    student_id: studentId,
    title,
    note_text,
  });
  res.status(200).json({
    status: true,
    code: 200,
    message: "Note saved",
    data: note,
  });
});

export const updateModuleNote = TryCatchFunction(async (req, res) => {
  const studentId = Number(req.user?.id);
  const noteId = Number(req.params.noteId);
  const { note_text, title } = req.body;
  if (!Number.isInteger(studentId) || studentId <= 0) {
    throw new ErrorClass("Unauthorized or invalid user id", 401);
  }
  if (!Number.isInteger(noteId) || noteId <= 0 || !note_text) {
    throw new ErrorClass("note_id and note_text are required", 400);
  }
  const [affectedRows] = await UnitNotes.update(
    { note_text, title },
    { where: { id: noteId, student_id: studentId } }
  );

  if (affectedRows === 0) {
    throw new ErrorClass("Note not found", 404);
  }

  const updatedNote = await UnitNotes.findByPk(noteId);
  res.status(200).json({
    status: true,
    code: 200,
    message: "Note updated",
    data: updatedNote,
  });
});

export const getModuleNote = TryCatchFunction(async (req, res) => {
  const studentId = Number(req.user?.id);
  const moduleId = Number(req.params.moduleId);
  const notes = await UnitNotes.findAll({
    where: { module_id: moduleId, student_id: studentId },
    order: [["updated_at", "DESC"]],
  });
  res
    .status(200)
    .json({ status: true, code: 200, message: "Notes fetched", data: notes });
});

export const deleteModuleNote = TryCatchFunction(async (req, res) => {
  const studentId = Number(req.user?.id);
  const moduleId = Number(req.params.moduleId);
  const noteId = Number(req.params.noteId);

  if (!Number.isInteger(studentId)) {
    throw new ErrorClass("Unauthorized or invalid user id", 401);
  }
  if (!Number.isInteger(moduleId)) {
    throw new ErrorClass("Invalid module id", 400);
  }
  if (!Number.isInteger(noteId)) {
    throw new ErrorClass("Invalid note id", 400);
  }

  await UnitNotes.destroy({
    where: { module_id: moduleId, student_id: studentId, id: noteId },
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
  const staffId = Number(req.user?.id);
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
  const user = req.user?.id;
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

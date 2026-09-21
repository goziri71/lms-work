import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { Modules } from "../../models/modules/modules.js";
import { Units } from "../../models/modules/units.js";
import { Courses } from "../../models/course/courses.js";
import { Op } from "sequelize";
import multer from "multer";
import { supabase } from "../../utils/supabase.js";

// Configure multer for video uploads
const uploadVideo = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB max for videos
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "video/mp4",
      "video/mpeg",
      "video/quicktime",
      "video/x-msvideo",
      "video/webm",
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new ErrorClass("Only video files are allowed (MP4, MPEG, MOV, AVI, WEBM)", 400), false);
    }
  },
});

// Middleware export
export const uploadVideoMiddleware = uploadVideo.single("video");

/**
 * Helper function to verify tutor owns the course
 */
async function verifyTutorCourseAccess(tutor, userType, courseId) {
  const ownerType = userType === "sole_tutor" ? "sole_tutor" : "organization";
  const ownerId = tutor.id;

  const course = await Courses.findOne({
    where: {
      id: courseId,
      owner_type: ownerType,
      owner_id: ownerId,
      is_marketplace: true,
    },
  });

  if (!course) {
    throw new ErrorClass("Course not found or you don't have access to it", 404);
  }

  return course;
}

/**
 * Create a module for a marketplace course
 * POST /api/marketplace/tutor/courses/:courseId/modules
 */
export const createModule = TryCatchFunction(async (req, res) => {
  const tutor = req.tutor;
  const userType = req.user.userType;
  const { courseId } = req.params;
  const { title, description, status = "draft" } = req.body;

  if (!title) {
    throw new ErrorClass("Title is required", 400);
  }

  // Verify tutor owns the course
  await verifyTutorCourseAccess(tutor, userType, parseInt(courseId));

  // Create module
  const moduleRecord = await Modules.create({
    course_id: parseInt(courseId),
    title: title.trim(),
    description: description || "",
    status: status,
    created_by: tutor.id,
    updated_by: tutor.id,
  });

  res.status(201).json({
    success: true,
    message: "Module created successfully",
    data: {
      module: {
        id: moduleRecord.id,
        course_id: moduleRecord.course_id,
        title: moduleRecord.title,
        description: moduleRecord.description,
        status: moduleRecord.status,
        created_at: moduleRecord.created_at,
      },
    },
  });
});

/**
 * Get all modules for a marketplace course
 * GET /api/marketplace/tutor/courses/:courseId/modules
 */
export const getModulesByCourse = TryCatchFunction(async (req, res) => {
  const tutor = req.tutor;
  const userType = req.user.userType;
  const { courseId } = req.params;

  // Verify tutor owns the course
  await verifyTutorCourseAccess(tutor, userType, parseInt(courseId));

  // Get modules with units count
  const modules = await Modules.findAll({
    where: {
      course_id: parseInt(courseId),
    },
    include: [
      {
        model: Units,
        as: "units",
        attributes: ["id"],
        required: false,
      },
    ],
    order: [["created_at", "ASC"], ["id", "ASC"]],
  });

  const modulesData = modules.map((module) => {
    const moduleJson = module.toJSON();
    return {
      id: moduleJson.id,
      course_id: moduleJson.course_id,
      title: moduleJson.title,
      description: moduleJson.description,
      status: moduleJson.status,
      units_count: moduleJson.units?.length || 0,
      created_at: moduleJson.created_at,
      updated_at: moduleJson.updated_at,
    };
  });

  res.status(200).json({
    success: true,
    message: "Modules retrieved successfully",
    data: {
      modules: modulesData,
    },
  });
});

/**
 * Update a module
 * PATCH /api/marketplace/tutor/modules/:moduleId
 */
export const updateModule = TryCatchFunction(async (req, res) => {
  const tutor = req.tutor;
  const userType = req.user.userType;
  const { moduleId } = req.params;
  const { title, description, status } = req.body;

  // Get module
  const moduleRecord = await Modules.findByPk(parseInt(moduleId));
  if (!moduleRecord) {
    throw new ErrorClass("Module not found", 404);
  }

  // Verify tutor owns the course
  await verifyTutorCourseAccess(tutor, userType, moduleRecord.course_id);

  // Update module
  const updates = {};
  if (title !== undefined) updates.title = title.trim();
  if (description !== undefined) updates.description = description;
  if (status !== undefined) updates.status = status;
  updates.updated_by = tutor.id;

  await moduleRecord.update(updates);

  res.status(200).json({
    success: true,
    message: "Module updated successfully",
    data: {
      module: {
        id: moduleRecord.id,
        course_id: moduleRecord.course_id,
        title: moduleRecord.title,
        description: moduleRecord.description,
        status: moduleRecord.status,
        updated_at: moduleRecord.updated_at,
      },
    },
  });
});

/**
 * Delete a module
 * DELETE /api/marketplace/tutor/modules/:moduleId
 */
export const deleteModule = TryCatchFunction(async (req, res) => {
  const tutor = req.tutor;
  const userType = req.user.userType;
  const { moduleId } = req.params;

  // Get module
  const moduleRecord = await Modules.findByPk(parseInt(moduleId));
  if (!moduleRecord) {
    throw new ErrorClass("Module not found", 404);
  }

  // Verify tutor owns the course
  await verifyTutorCourseAccess(tutor, userType, moduleRecord.course_id);

  // Check if module has units
  const unitsCount = await Units.count({
    where: { module_id: parseInt(moduleId) },
  });

  if (unitsCount > 0) {
    throw new ErrorClass(
      "Cannot delete module with existing units. Please delete all units first.",
      400
    );
  }

  await moduleRecord.destroy();

  res.status(200).json({
    success: true,
    message: "Module deleted successfully",
  });
});

/**
 * Create a unit for a module
 * POST /api/marketplace/tutor/modules/:moduleId/units
 */
export const createUnit = TryCatchFunction(async (req, res) => {
  const tutor = req.tutor;
  const userType = req.user.userType;
  const { moduleId } = req.params;
  const {
    title,
    content,
    content_type = "html",
    order = 1,
    status = "draft",
    duration_min,
  } = req.body;

  if (!title) {
    throw new ErrorClass("Title is required", 400);
  }

  // Get module
  const moduleRecord = await Modules.findByPk(parseInt(moduleId));
  if (!moduleRecord) {
    throw new ErrorClass("Module not found", 404);
  }

  // Verify tutor owns the course
  await verifyTutorCourseAccess(tutor, userType, moduleRecord.course_id);

  // Create unit
  const unit = await Units.create({
    module_id: parseInt(moduleId),
    title: title.trim(),
    content: content || null,
    content_type: content_type,
    order: order,
    status: status,
    duration_min: duration_min || null,
    created_by: tutor.id,
    updated_by: tutor.id,
  });

  res.status(201).json({
    success: true,
    message: "Unit created successfully",
    data: {
      unit: {
        id: unit.id,
        module_id: unit.module_id,
        title: unit.title,
        content: unit.content,
        content_type: unit.content_type,
        order: unit.order,
        status: unit.status,
        duration_min: unit.duration_min,
        created_at: unit.created_at,
      },
    },
  });
});

/**
 * Get all units for a module
 * GET /api/marketplace/tutor/modules/:moduleId/units
 */
export const getUnitsByModule = TryCatchFunction(async (req, res) => {
  const tutor = req.tutor;
  const userType = req.user.userType;
  const { moduleId } = req.params;

  // Get module
  const moduleRecord = await Modules.findByPk(parseInt(moduleId));
  if (!moduleRecord) {
    throw new ErrorClass("Module not found", 404);
  }

  // Verify tutor owns the course
  await verifyTutorCourseAccess(tutor, userType, moduleRecord.course_id);

  // Get units
  const units = await Units.findAll({
    where: {
      module_id: parseInt(moduleId),
    },
    order: [["created_at", "ASC"], ["id", "ASC"]],
  });

  res.status(200).json({
    success: true,
    message: "Units retrieved successfully",
    data: {
      units: units.map((unit) => ({
        id: unit.id,
        module_id: unit.module_id,
        title: unit.title,
        content: unit.content,
        content_type: unit.content_type,
        photo_url: unit.photo_url,
        video_url: unit.video_url,
        order: unit.order,
        status: unit.status,
        duration_min: unit.duration_min,
        created_at: unit.created_at,
        updated_at: unit.updated_at,
      })),
    },
  });
});

/**
 * Update a unit
 * PATCH /api/marketplace/tutor/units/:unitId
 */
export const updateUnit = TryCatchFunction(async (req, res) => {
  const tutor = req.tutor;
  const userType = req.user.userType;
  const { unitId } = req.params;
  const { title, content, content_type, order, status, duration_min } = req.body;

  // Get unit
  const unit = await Units.findByPk(parseInt(unitId));
  if (!unit) {
    throw new ErrorClass("Unit not found", 404);
  }

  // Get module to verify course ownership
  const moduleRecord = await Modules.findByPk(unit.module_id);
  if (!moduleRecord) {
    throw new ErrorClass("Module not found", 404);
  }

  // Verify tutor owns the course
  await verifyTutorCourseAccess(tutor, userType, moduleRecord.course_id);

  // Update unit
  const updates = {};
  if (title !== undefined) updates.title = title.trim();
  if (content !== undefined) updates.content = content;
  if (content_type !== undefined) updates.content_type = content_type;
  if (order !== undefined) updates.order = order;
  if (status !== undefined) updates.status = status;
  if (duration_min !== undefined) updates.duration_min = duration_min;
  updates.updated_by = tutor.id;

  await unit.update(updates);

  res.status(200).json({
    success: true,
    message: "Unit updated successfully",
    data: {
      unit: {
        id: unit.id,
        module_id: unit.module_id,
        title: unit.title,
        content: unit.content,
        content_type: unit.content_type,
        order: unit.order,
        status: unit.status,
        duration_min: unit.duration_min,
        updated_at: unit.updated_at,
      },
    },
  });
});

/**
 * Delete a unit
 * DELETE /api/marketplace/tutor/units/:unitId
 */
export const deleteUnit = TryCatchFunction(async (req, res) => {
  const tutor = req.tutor;
  const userType = req.user.userType;
  const { unitId } = req.params;

  // Get unit
  const unit = await Units.findByPk(parseInt(unitId));
  if (!unit) {
    throw new ErrorClass("Unit not found", 404);
  }

  // Get module to verify course ownership
  const moduleRecord = await Modules.findByPk(unit.module_id);
  if (!moduleRecord) {
    throw new ErrorClass("Module not found", 404);
  }

  // Verify tutor owns the course
  await verifyTutorCourseAccess(tutor, userType, moduleRecord.course_id);

  await unit.destroy();

  res.status(200).json({
    success: true,
    message: "Unit deleted successfully",
  });
});

/**
 * Upload video for a unit
 * POST /api/marketplace/tutor/modules/:moduleId/units/:unitId/video
 */
export const uploadUnitVideo = TryCatchFunction(async (req, res) => {
  const tutor = req.tutor;
  const userType = req.user.userType;
  const { moduleId, unitId } = req.params;

  if (!req.file) {
    throw new ErrorClass("Video file is required (field name: 'video')", 400);
  }

  // Get unit
  const unit = await Units.findByPk(parseInt(unitId));
  if (!unit) {
    throw new ErrorClass("Unit not found", 404);
  }

  // Verify unit belongs to module
  if (unit.module_id !== parseInt(moduleId)) {
    throw new ErrorClass("Unit does not belong to this module", 400);
  }

  // Get module to verify course ownership
  const moduleRecord = await Modules.findByPk(parseInt(moduleId));
  if (!moduleRecord) {
    throw new ErrorClass("Module not found", 404);
  }

  // Verify tutor owns the course
  await verifyTutorCourseAccess(tutor, userType, moduleRecord.course_id);

  // Upload to Supabase
  const bucket = process.env.VIDEOS_BUCKET || "lmsvideo";
  const tutorId = tutor.id;
  const timestamp = Date.now();
  const ext = (req.file.mimetype?.split("/")[1] || "mp4").toLowerCase();
  const sanitizedFileName = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
  const objectPath = `tutors/${tutorId}/videos/${moduleId}/${unitId}/${timestamp}_${sanitizedFileName}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(objectPath, req.file.buffer, {
      contentType: req.file.mimetype,
      upsert: false,
    });

  if (uploadError) {
    throw new ErrorClass(`Upload failed: ${uploadError.message}`, 500);
  }

  // Generate signed URL for private bucket (expires in 1 year)
  // For private buckets, signed URLs are required; for public buckets, this still works
  const { data: signedUrlData, error: urlError } = await supabase.storage
    .from(bucket)
    .createSignedUrl(objectPath, 31536000); // 1 year expiration

  let videoUrl;
  if (urlError) {
    // Fallback to public URL if signed URL fails (for public buckets)
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(objectPath);
    videoUrl = urlData.publicUrl;
  } else {
    // Use signed URL for private bucket
    videoUrl = signedUrlData.signedUrl;
  }

  // Update unit with video URL
  await unit.update({ video_url: videoUrl });

  res.status(200).json({
    success: true,
    message: "Video uploaded successfully",
    data: {
      video_url: videoUrl,
      file_path: objectPath,
      unit_id: unit.id,
    },
  });
});


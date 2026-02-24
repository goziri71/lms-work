import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { SavedJob } from "../../models/marketplace/savedJob.js";
import { searchJobs, cleanupExpiredCache } from "../../services/jobSearchService.js";
import { Op } from "sequelize";

let isSavedJobsTableAvailable = true;

/**
 * Search jobs from the German Federal Employment Agency
 * GET /api/marketplace/jobs/search
 * Auth: Student required
 * Query: was, berufsfeld, arbeitszeit, angebotsart, befristung,
 *        veroeffentlichtseit, zeitarbeit, arbeitgeber, page, size
 */
export const searchJobListings = TryCatchFunction(async (req, res) => {
  const studentId = req.user?.id;
  if (!studentId) {
    throw new ErrorClass("Authentication required", 401);
  }

  const {
    was,
    berufsfeld,
    arbeitszeit,
    angebotsart,
    befristung,
    veroeffentlichtseit,
    zeitarbeit,
    arbeitgeber,
    page,
    size,
  } = req.query;

  const result = await searchJobs({
    was,
    berufsfeld,
    arbeitszeit,
    angebotsart,
    befristung,
    veroeffentlichtseit,
    zeitarbeit,
    arbeitgeber,
    page,
    size,
  });

  // Check which jobs are saved by this student
  const jobs = result.jobs || [];
  let savedJobIds = [];

  if (jobs.length > 0) {
    const hashIds = jobs
      .map((j) => j.hashId || j.refnr || null)
      .filter(Boolean);

    if (hashIds.length > 0 && isSavedJobsTableAvailable) {
      try {
        const savedEntries = await SavedJob.findAll({
          where: {
            student_id: studentId,
            job_hash_id: { [Op.in]: hashIds },
          },
          attributes: ["job_hash_id"],
        });
        savedJobIds = savedEntries.map((s) => s.job_hash_id);
      } catch (savedErr) {
        if (savedErr?.message?.includes('relation "saved_jobs" does not exist')) {
          isSavedJobsTableAvailable = false;
          console.warn("saved_jobs table missing; returning jobs with is_saved=false.");
        } else {
          throw savedErr;
        }
      }
    }
  }

  const jobsList = jobs.map((job) => {
    const jobId = job.hashId || job.refnr || null;
    return {
      id: jobId,
      title: job.titel || job.title || null,
      employer: job.arbeitgeber || job.employer || null,
      location: job.arbeitsort?.ort || job.location || null,
      region: job.arbeitsort?.region || null,
      country: job.arbeitsort?.land || "Deutschland",
      published_date: job.eintrittsdatum || job.aktuelleVeroeffentlichungsdatum || null,
      work_type: job.arbeitszeit || null,
      contract_type: job.befristung || null,
      offer_type: job.angebotsart || null,
      job_url: job.externeUrl || job.url || null,
      logo_url: job.logoHashId
        ? `https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/ed/v1/arbeitgeberlogo/${job.logoHashId}`
        : null,
      is_saved: savedJobIds.includes(jobId),
      raw: job,
    };
  });

  // Trigger lazy cache cleanup (~1% of requests)
  if (Math.random() < 0.01) {
    cleanupExpiredCache().catch(() => {});
  }

  res.status(200).json({
    success: true,
    data: {
      jobs: jobsList,
      total: result.total || 0,
      page: result.page || 1,
      size: result.size || 25,
      total_pages: result.total
        ? Math.ceil(result.total / (result.size || 25))
        : 0,
      cache_source: result.cache_source,
    },
  });
});

/**
 * Save/bookmark a job
 * POST /api/marketplace/jobs/save
 * Auth: Student required
 * Body: { job_hash_id, title, employer, location, job_url, job_data }
 */
export const saveJob = TryCatchFunction(async (req, res) => {
  const studentId = req.user?.id;
  if (!studentId) {
    throw new ErrorClass("Authentication required", 401);
  }

  const { job_hash_id, title, employer, location, job_url, job_data } = req.body;

  if (!job_hash_id) {
    throw new ErrorClass("job_hash_id is required", 400);
  }

  if (!title) {
    throw new ErrorClass("title is required", 400);
  }

  const existing = await SavedJob.findOne({
    where: { student_id: studentId, job_hash_id },
  });

  if (existing) {
    throw new ErrorClass("You have already saved this job", 409);
  }

  const saved = await SavedJob.create({
    student_id: studentId,
    job_hash_id,
    title,
    employer: employer || null,
    location: location || null,
    job_url: job_url || null,
    job_data: job_data || null,
  });

  res.status(201).json({
    success: true,
    message: "Job saved successfully",
    data: {
      id: saved.id,
      job_hash_id: saved.job_hash_id,
      title: saved.title,
    },
  });
});

/**
 * Unsave/remove a bookmarked job
 * DELETE /api/marketplace/jobs/save/:jobHashId
 * Auth: Student required
 */
export const unsaveJob = TryCatchFunction(async (req, res) => {
  const studentId = req.user?.id;
  if (!studentId) {
    throw new ErrorClass("Authentication required", 401);
  }

  const { jobHashId } = req.params;

  const saved = await SavedJob.findOne({
    where: { student_id: studentId, job_hash_id: jobHashId },
  });

  if (!saved) {
    throw new ErrorClass("Saved job not found", 404);
  }

  await saved.destroy();

  res.status(200).json({
    success: true,
    message: "Job removed from saved list",
  });
});

/**
 * Get all saved/bookmarked jobs
 * GET /api/marketplace/jobs/saved
 * Auth: Student required
 * Query: page, limit
 */
export const getSavedJobs = TryCatchFunction(async (req, res) => {
  const studentId = req.user?.id;
  if (!studentId) {
    throw new ErrorClass("Authentication required", 401);
  }

  const { page = 1, limit = 20 } = req.query;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (pageNum - 1) * limitNum;

  const { count, rows: savedJobs } = await SavedJob.findAndCountAll({
    where: { student_id: studentId },
    order: [["created_at", "DESC"]],
    limit: limitNum,
    offset,
  });

  res.status(200).json({
    success: true,
    data: {
      jobs: savedJobs.map((j) => ({
        id: j.id,
        job_hash_id: j.job_hash_id,
        title: j.title,
        employer: j.employer,
        location: j.location,
        job_url: j.job_url,
        job_data: j.job_data,
        saved_at: j.created_at,
      })),
      pagination: {
        total: count,
        page: pageNum,
        limit: limitNum,
        total_pages: Math.ceil(count / limitNum),
      },
    },
  });
});

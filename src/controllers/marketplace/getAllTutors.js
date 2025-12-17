import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { SoleTutor } from "../../models/marketplace/soleTutor.js";
import { Organization } from "../../models/marketplace/organization.js";
import { Courses } from "../../models/course/courses.js";
import { Op } from "sequelize";
import { Sequelize } from "sequelize";

/**
 * Get all tutors and organizations that have published marketplace courses
 * GET /api/marketplace/tutors
 *
 * Returns a list of all tutors/organizations that students can filter by
 * when browsing marketplace courses. Includes WPU as an option.
 */
export const getAllTutors = TryCatchFunction(async (req, res) => {
  // This endpoint is public/student-accessible (no strict auth required)
  // But we can optionally check if user is logged in

  // Get all unique owner_id + owner_type combinations from published marketplace courses
  // Separate query for non-WPU courses (sole_tutor, organization)
  const publishedCourses = await Courses.findAll({
    where: {
      is_marketplace: true,
      marketplace_status: "published",
      owner_type: { [Op.in]: ["sole_tutor", "organization"] },
      owner_id: { [Op.ne]: null }, // Must have owner_id for tutors/orgs
    },
    attributes: [
      "owner_id",
      "owner_type",
      [Sequelize.fn("COUNT", Sequelize.col("id")), "course_count"],
    ],
    group: ["owner_id", "owner_type"],
    raw: true,
  });

  // Separate by owner type
  const soleTutorIds = publishedCourses
    .filter((c) => c.owner_type === "sole_tutor")
    .map((c) => c.owner_id);

  const organizationIds = publishedCourses
    .filter((c) => c.owner_type === "organization")
    .map((c) => c.owner_id);

  // Get WPU course count (owner_type = "wpu" or "wsp", owner_id can be null or any value)
  const wpuCourseCount = await Courses.count({
    where: {
      is_marketplace: true,
      marketplace_status: "published",
      owner_type: { [Op.in]: ["wpu", "wsp"] },
    },
  });

  // Fetch sole tutors (only active ones)
  const soleTutors = await SoleTutor.findAll({
    where: {
      id: { [Op.in]: soleTutorIds },
      status: "active", // Only active tutors
    },
    attributes: [
      "id",
      "fname",
      "lname",
      "mname",
      "specialization",
      "profile_image",
      "rating",
      "total_reviews",
    ],
    order: [["fname", "ASC"]],
  });

  // Fetch organizations (only active ones)
  const organizations = await Organization.findAll({
    where: {
      id: { [Op.in]: organizationIds },
      status: "active", // Only active organizations
    },
    attributes: [
      "id",
      "name",
      "description",
      "logo",
      "rating",
      "total_reviews",
    ],
    order: [["name", "ASC"]],
  });

  // Build response with course counts
  const tutorsList = [];

  // Add WPU option if there are WPU courses
  if (wpuCourseCount > 0) {
    tutorsList.push({
      owner_id: null, // WPU doesn't have a specific owner_id
      owner_type: "wpu",
      name: "WPU",
      display_name: "WPU Courses",
      course_count: wpuCourseCount,
      profile_image: null,
      logo: null,
      rating: null,
      total_reviews: null,
    });
  }

  // Add sole tutors
  soleTutors.forEach((tutor) => {
    const courseData = publishedCourses.find(
      (c) => c.owner_id === tutor.id && c.owner_type === "sole_tutor"
    );
    tutorsList.push({
      owner_id: tutor.id,
      owner_type: "sole_tutor",
      name: `${tutor.fname} ${tutor.lname}`.trim(),
      display_name: tutor.mname
        ? `${tutor.fname} ${tutor.mname} ${tutor.lname}`.trim()
        : `${tutor.fname} ${tutor.lname}`.trim(),
      specialization: tutor.specialization,
      course_count: courseData ? parseInt(courseData.course_count) : 0,
      profile_image: tutor.profile_image,
      rating: tutor.rating ? parseFloat(tutor.rating) : null,
      total_reviews: tutor.total_reviews || 0,
    });
  });

  // Add organizations
  organizations.forEach((org) => {
    const courseData = publishedCourses.find(
      (c) => c.owner_id === org.id && c.owner_type === "organization"
    );
    tutorsList.push({
      owner_id: org.id,
      owner_type: "organization",
      name: org.name,
      display_name: org.name,
      description: org.description,
      course_count: courseData ? parseInt(courseData.course_count) : 0,
      logo: org.logo,
      rating: org.rating ? parseFloat(org.rating) : null,
      total_reviews: org.total_reviews || 0,
    });
  });

  // Sort by name (WPU first, then alphabetically)
  tutorsList.sort((a, b) => {
    if (a.owner_type === "wpu") return -1;
    if (b.owner_type === "wpu") return 1;
    return a.display_name.localeCompare(b.display_name);
  });

  res.status(200).json({
    status: true,
    code: 200,
    message: "Tutors and organizations retrieved successfully",
    data: tutorsList,
    meta: {
      total: tutorsList.length,
      sole_tutors: soleTutors.length,
      organizations: organizations.length,
      wpu_included: wpuCourseCount > 0,
    },
  });
});
